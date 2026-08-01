import test from "node:test";
import assert from "node:assert/strict";

import {
    createDefaultDiagram
} from "../flow/src/config/DefaultDiagram.js";
import {
    createWebviewApplication
} from "../flow/src/composition/createWebviewApplication.js";
import {
    WebviewBridge
} from "../flow/src/extension/Bridge.js";
import {
    DiagramService
} from "../flow/src/services/DiagramService.js";
import {
    DiagramModelStatus
} from "../flow/src/state/DiagramModelStore.js";
import {
    DiagramGenerationError
} from "../src/errors/DiagramGenerationError.js";
import {
    ParserError
} from "../src/errors/FrontendErrors.js";

test("DiagramService distingue fuente vacía y programa válido", () => {
    const service = new DiagramService();
    const empty =
        service.buildFromSource("   ");
    const valid =
        service.buildFromSource(
            "dato <- 1"
        );

    assert.equal(empty.ok, true);
    assert.equal(empty.value.empty, true);
    assert.equal(empty.value.ast, null);
    assert.deepEqual(
        empty.value.diagram,
        createDefaultDiagram()
    );

    assert.equal(valid.ok, true);
    assert.equal(valid.value.empty, false);
    assert.equal(
        valid.value.ast.type,
        "Program"
    );
    assert.equal(
        valid.value.diagram.nodes[1].label,
        "dato <- 1"
    );
});

test("DiagramService conserva errores del frontend", () => {
    const result =
        new DiagramService()
            .buildFromSource("si");

    assert.equal(result.ok, false);
    assert.equal(result.value, null);
    assert.ok(
        result.errors[0]
        instanceof ParserError
    );
    assert.equal(
        result.errors[0].phase,
        "parser"
    );
});

test("DiagramService normaliza fallos de generación", () => {
    const expectedError =
        DiagramGenerationError
            .unsupportedNode({
                type: "Desconocido",
                location: null
            });
    const service = new DiagramService({
        diagramVisitorFactory: () => ({
            build() {
                throw expectedError;
            }
        })
    });
    const result =
        service.buildFromSource(
            "dato <- 1"
        );

    assert.equal(result.ok, false);
    assert.equal(
        result.errors[0],
        expectedError
    );
    assert.equal(
        result.errors[0].phase,
        "diagram"
    );
});

test("DiagramModelStore conserva el último modelo válido", () => {
    const store =
        createWebviewApplication().store;
    const statuses = [];
    const unsubscribe = store.subscribe(
        state => {
            statuses.push(state.status);
        }
    );

    const ready =
        store.setSource("dato <- 1");
    const validModel = ready.model;
    const failed =
        store.setSource("si");

    unsubscribe();

    assert.equal(
        ready.status,
        DiagramModelStatus.READY
    );
    assert.equal(
        failed.status,
        DiagramModelStatus.ERROR
    );
    assert.equal(
        failed.model,
        validModel
    );
    assert.equal(
        failed.errors[0].phase,
        "parser"
    );
    assert.deepEqual(
        statuses,
        [
            "loading",
            "ready",
            "loading",
            "error"
        ]
    );
});

test("DiagramModelStore vuelve al estado inicial con fuente vacía", () => {
    const store =
        createWebviewApplication().store;

    store.setSource("dato <- 1");
    const state = store.setSource("");

    assert.equal(
        state.status,
        DiagramModelStatus.IDLE
    );
    assert.equal(state.ast, null);
    assert.deepEqual(
        state.model,
        createDefaultDiagram()
    );
});

test("WebviewBridge recibe fuente, exporta SVG y limpia listeners", async () => {
    const eventTarget =
        new FakeEventTarget();
    const messages = [];
    const sources = [];
    let acquireCount = 0;
    const bridge = new WebviewBridge({
        eventTarget,
        acquireVsCodeApi() {
            acquireCount += 1;

            return {
                postMessage(message) {
                    messages.push(message);
                }
            };
        },
        exportSvg: async () =>
            "<svg></svg>",
        logger: silentLogger()
    });
    const disconnect = bridge.connect({
        onSource(source) {
            sources.push(source);
        }
    });

    eventTarget.dispatch({
        data: {
            type: "source",
            source: "dato <- 1"
        }
    });
    await bridge.handleMessage({
        data: {
            type: "export-svg"
        }
    });

    disconnect();
    eventTarget.dispatch({
        data: {
            type: "source",
            source: "dato <- 2"
        }
    });

    bridge.connect();
    bridge.disconnect();

    assert.deepEqual(
        sources,
        ["dato <- 1"]
    );
    assert.deepEqual(
        messages,
        [{
            type: "svg",
            svg:
                "<svg></svg>"
        }]
    );
    assert.equal(acquireCount, 1);
    assert.equal(
        eventTarget.listenerCount,
        0
    );
});

test("WebviewBridge funciona fuera de VS Code", async () => {
    const eventTarget =
        new FakeEventTarget();
    const warnings = [];
    let receivedSource = null;
    const bridge = new WebviewBridge({
        eventTarget,
        acquireVsCodeApi: null,
        logger: {
            warn(message) {
                warnings.push(message);
            },
            error() {}
        }
    });

    bridge.connect({
        onSource(source) {
            receivedSource = source;
        }
    });
    eventTarget.dispatch({
        data: {
            type: "source",
            source: "dato <- 1"
        }
    });
    const exportResult =
        await bridge.handleMessage({
            data: {
                type: "export-svg"
            }
        });

    bridge.disconnect();

    assert.equal(
        receivedSource,
        "dato <- 1"
    );
    assert.equal(
        exportResult.handled,
        false
    );
    assert.deepEqual(
        warnings,
        ["Running outside VS Code."]
    );
});

class FakeEventTarget {

    constructor() {
        this.listeners = new Set();
    }

    get listenerCount() {
        return this.listeners.size;
    }

    addEventListener(type, listener) {
        if (type === "message") {
            this.listeners.add(listener);
        }
    }

    removeEventListener(type, listener) {
        if (type === "message") {
            this.listeners.delete(listener);
        }
    }

    dispatch(event) {
        for (const listener of this.listeners) {
            listener(event);
        }
    }
}

function silentLogger() {
    return {
        warn() {},
        error() {}
    };
}
