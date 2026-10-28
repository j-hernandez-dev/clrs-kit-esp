import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
    BrokerContractState
} from "../src/broker95/index.js";
import {
    BrokerCLRSTestIntegration
} from "../extension/testing/index.js";

const PROGRAM_PATH = path.resolve(
    "workspace",
    "contrato.clrs"
);

test("proyecta sólo los casos públicos del contrato activo", async () => {
    const game = gameSession(activeState());
    const integration = new BrokerCLRSTestIntegration({
        gameSession: game,
        documentHost: documentHost(),
        executor: executor()
    });
    const changes = [];
    const subscription = integration.subscribe(
        snapshot => changes.push(snapshot)
    );
    const snapshot = await integration.start();
    const root = snapshot.roots[0];

    assert.equal(snapshot.sourceId, "broker95");
    assert.equal(root.sourceKey, "7");
    assert.equal(
        root.label,
        "BROKER.95 · Suma tolerante"
    );
    assert.equal(root.cases.length, 2);
    assert.deepEqual(
        Object.keys(root.cases[0]).sort(),
        [
            "description",
            "error",
            "id",
            "label",
            "runnable"
        ]
    );
    assert.equal(
        JSON.stringify(snapshot).includes("13"),
        false
    );
    assert.equal(Object.isFrozen(snapshot), true);

    game.emit({
        ...activeState(),
        revision: 4,
        activeContractId: null
    });

    assert.equal(integration.getSnapshot().roots.length, 0);
    assert.equal(changes.length, 2);

    subscription.dispose();
    integration.dispose();
});

test("ejecuta y prepara la depuración con el documento CLRS resuelto en el Host", async () => {
    const requests = [];
    const integration = new BrokerCLRSTestIntegration({
        gameSession: gameSession(activeState()),
        documentHost: documentHost(),
        executor: executor(requests)
    });

    await integration.start();
    const result = await integration.execute({
        sourceKey: "7",
        caseIds: ["TC-2"],
        signal: new AbortController().signal
    });
    const request = requests[0];

    assert.equal(request.sourceCode, "escribir 13");
    assert.equal(request.sourceVersion, 9);
    assert.deepEqual(request.caseIds, ["TC-2"]);
    assert.equal(request.suite.programPath, PROGRAM_PATH);
    assert.equal(
        request.suite.cases[0].input.stdin,
        "5\n8\n"
    );
    assert.equal(
        request.suite.cases[1].expectation.stdout,
        "13 ± 0.01"
    );
    assert.equal(
        request.suite.cases[1]
            .expectation.comparison,
        "number-tolerance"
    );
    assert.equal(result.suite, request.suite);
    assert.equal(result.execution.tag, "execution");

    const debug = await integration.prepareDebug({
        sourceKey: "7",
        caseId: "TC-1"
    });

    assert.equal(debug.suite.programPath, PROGRAM_PATH);
    assert.equal(debug.testCase.id, "TC-1");
});

test("rechaza contratos o documentos obsoletos sin revelar datos internos", async () => {
    const withoutDocument = new BrokerCLRSTestIntegration({
        gameSession: gameSession(activeState()),
        documentHost: documentHost(null),
        executor: executor()
    });

    await withoutDocument.start();
    await assert.rejects(
        () => withoutDocument.execute({
            sourceKey: "7",
            caseIds: ["TC-1"]
        }),
        error =>
            error.code ===
                "BROKER95_TEST_DOCUMENT_REQUIRED" &&
            /Abre el programa CLRS/u.test(
                error.publicMessage
            )
    );
    await assert.rejects(
        () => withoutDocument.prepareDebug({
            sourceKey: "otro",
            caseId: "TC-1"
        }),
        error =>
            error.code ===
                "BROKER95_TEST_CONTRACT_STALE"
    );
});

function activeState() {
    return {
        revision: 3,
        activeContractId: 7,
        contracts: [contract()]
    };
}

function contract() {
    return Object.freeze({
        id: 7,
        state: BrokerContractState.ACTIVE,
        contractType: "client",
        title: "Suma tolerante",
        testCases: Object.freeze([
            testCase({
                id: "TC-1",
                stdin: "5\n8\n",
                expected: "13\n",
                comparison: "exact"
            }),
            testCase({
                id: "TC-2",
                expected: "13 ± 0.01",
                comparison: "number-tolerance"
            })
        ])
    });
}

function testCase(overrides = {}) {
    return Object.freeze({
        id: "TC-1",
        kind: "normal",
        explanation: "Comprueba la suma solicitada.",
        stdin: "",
        expected: "",
        comparison: "exact",
        timeoutMs: 1_000,
        ...overrides
    });
}

function gameSession(initialState) {
    let state = initialState;
    const listeners = new Set();

    return {
        async initialize() {
            return { state };
        },
        getState() {
            return state;
        },
        subscribe(listener) {
            listeners.add(listener);
            return {
                dispose() {
                    listeners.delete(listener);
                }
            };
        },
        emit(next) {
            state = next;
            for (const listener of listeners) {
                listener(state);
            }
        }
    };
}

function documentHost(reference = {
    filePath: PROGRAM_PATH,
    sourceCode: "escribir 13",
    version: 9
}) {
    return {
        getActiveDocumentReference() {
            return reference;
        }
    };
}

function executor(requests = []) {
    return {
        async execute(request) {
            requests.push(request);
            return Object.freeze({
                tag: "execution",
                results: Object.freeze([])
            });
        }
    };
}
