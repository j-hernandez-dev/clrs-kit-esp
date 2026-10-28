import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
    createCLRSTestSuite,
    deriveCLRSTestCaseSeed
} from "../src/testing/index.js";
import {
    CLRSTestDebugController
} from "../extension/testing/index.js";

const DEFINITION_PATH = path.resolve(
    "workspace",
    "suma.clrs-tests.json"
);
const PROGRAM_PATH = path.resolve(
    "workspace",
    "suma.clrs"
);

test("registra Depurar e inicia el DAP con la entrada y semilla del caso", async () => {
    const fixture = createFixture();
    const controller = fixture.create();
    const profile = controller.start();

    fixture.debug.onStart = configuration => {
        fixture.traces.emit({
            type: "start",
            trace: {
                traceId: "debug-test-1",
                sourcePath: PROGRAM_PATH
            }
        });
        queueMicrotask(() => fixture.traces.emit({
            type: "test-result",
            traceId: "debug-test-1",
            status: "correct",
            stdout: "5\n",
            stderr: "",
            exitCode: 0,
            signal: null,
            outputTruncated: false
        }));

        return configuration;
    };

    await profile.runHandler({
        include: [fixture.items.cases[0]]
    }, cancellationToken());

    const run = fixture.testController.runs[0];
    const configuration = fixture.debug.starts[0]
        .configuration;

    assert.equal(profile.label, "Depurar");
    assert.equal(profile.kind, 2);
    assert.equal(profile.isDefault, true);
    assert.equal(profile.supportsContinuousRun, false);
    assert.equal(configuration.type, "clrs");
    assert.equal(configuration.request, "launch");
    assert.equal(configuration.program, PROGRAM_PATH);
    assert.equal(configuration.stopOnEntry, true);
    assert.equal(configuration.__clrsDocumentVersion, 7);
    assert.equal(configuration.__clrsTest.stdin, "2\n3\n");
    assert.equal(
        configuration.__clrsTest.seed,
        deriveCLRSTestCaseSeed(
            0,
            "suite:suma",
            "case:suma"
        )
    );
    assert.equal(
        fixture.debug.starts[0].folder.name,
        "workspace"
    );
    assert.deepEqual(run.enqueuedItems, [
        fixture.items.cases[0]
    ]);
    assert.deepEqual(run.startedItems, [
        fixture.items.cases[0]
    ]);
    assert.equal(run.passedItems.length, 1);
    assert.match(run.outputs[0].text, /Estado: Aprobada/u);
    assert.equal(run.ended, true);
});

test("compara la salida depurada mediante el mismo resultado nativo", async () => {
    const fixture = createFixture();
    const controller = fixture.create();

    fixture.debug.onStart = () => {
        fixture.traces.emit({
            type: "start",
            trace: {
                traceId: "debug-test-diff",
                sourcePath: PROGRAM_PATH
            }
        });
        queueMicrotask(() => fixture.traces.emit({
            type: "test-result",
            traceId: "debug-test-diff",
            status: "correct",
            stdout: "6\n",
            stderr: "",
            exitCode: 0,
            signal: null,
            outputTruncated: false
        }));
    };

    await controller.start().runHandler({
        include: [fixture.items.cases[0]]
    }, cancellationToken());

    const run = fixture.testController.runs[0];
    const messages = run.failedItems[0].message;

    assert.equal(run.failedItems.length, 1);
    assert.equal(messages.length, 2);
    assert.match(
        messages[0].message,
        /primer carácter diferente/u
    );
    assert.equal(
        messages[1].expectedOutput,
        "5\n"
    );
    assert.equal(
        messages[1].actualOutput,
        "6\n"
    );
});

test("exige un único caso y no abre sesiones ambiguas", async () => {
    const fixture = createFixture({
        cases: [
            caseSource("case:uno", "Caso uno"),
            caseSource("case:dos", "Caso dos")
        ]
    });
    const controller = fixture.create();

    await controller.start().runHandler(
        {},
        cancellationToken()
    );

    const run = fixture.testController.runs[0];

    assert.equal(fixture.debug.starts.length, 0);
    assert.equal(run.erroredItems.length, 2);
    assert.match(
        run.erroredItems[0].message.message,
        /único caso/u
    );
});

test("convierte un inicio rechazado por VS Code en error de prueba", async () => {
    const fixture = createFixture();
    const controller = fixture.create();

    fixture.debug.startResult = false;

    await controller.start().runHandler({
        include: [fixture.items.cases[0]]
    }, cancellationToken());

    const run = fixture.testController.runs[0];

    assert.equal(run.erroredItems.length, 1);
    assert.match(
        run.erroredItems[0].message.message,
        /no pudo iniciar/u
    );
    assert.equal(run.ended, true);
});

test("cancelar detiene sólo la sesión de la prueba activa", async () => {
    const fixture = createFixture();
    const controller = fixture.create();
    const token = cancellationToken();
    const running = controller.start().runHandler({
        include: [fixture.items.cases[0]]
    }, token);

    await waitFor(() =>
        fixture.debug.starts.length === 1
    );
    token.cancel();
    await running;

    const session = fixture.debug.sessions[0];
    const run = fixture.testController.runs[0];

    assert.deepEqual(
        fixture.debug.stoppedSessions,
        [session]
    );
    assert.equal(run.skippedItems.length, 1);
    assert.equal(run.ended, true);
    assert.equal(token.subscription.disposed, true);
});

test("al disponer el perfil cancela la depuración que aún está activa", async () => {
    const fixture = createFixture();
    const controller = fixture.create();
    const running = controller.start().runHandler({
        include: [fixture.items.cases[0]]
    }, cancellationToken());

    await waitFor(() =>
        fixture.debug.sessions.length === 1
    );
    controller.dispose();
    await running;

    assert.deepEqual(
        fixture.debug.stoppedSessions,
        [fixture.debug.sessions[0]]
    );
    assert.equal(
        fixture.testController.runs[0]
            .skippedItems.length,
        1
    );
});

test("depura un caso de BROKER.95 sin depender de una definición declarativa", async () => {
    const fixture = createFixture({
        metadataOverrides: {
            sourceId: "broker95",
            sourceKey: "7",
            definitionPath: null
        }
    });
    const controller = fixture.create();
    let request = null;

    controller.registerExternalSource({
        id: "broker95",
        async prepareDebug(source) {
            request = source;
            return {
                suite: fixture.suite,
                testCase: fixture.suite.cases[0]
            };
        }
    });
    fixture.debug.onStart = () => {
        fixture.traces.emit({
            type: "start",
            trace: {
                traceId: "broker-debug",
                sourcePath: PROGRAM_PATH
            }
        });
        queueMicrotask(() => fixture.traces.emit({
            type: "test-result",
            traceId: "broker-debug",
            status: "correct",
            stdout: "5\n",
            stderr: "",
            exitCode: 0,
            signal: null,
            outputTruncated: false
        }));
    };

    await controller.start().runHandler({
        include: [fixture.items.cases[0]]
    }, cancellationToken());

    assert.deepEqual(request, {
        sourceKey: "7",
        caseId: "case:suma"
    });
    assert.equal(
        fixture.debug.starts[0]
            .configuration.program,
        PROGRAM_PATH
    );
    assert.equal(
        fixture.testController.runs[0]
            .passedItems.length,
        1
    );
});

function createFixture(options = {}) {
    const suite = createCLRSTestSuite({
        id: "suite:suma",
        name: "Suite suma",
        programPath: PROGRAM_PATH,
        definitionPath: DEFINITION_PATH,
        cases: options.cases ?? [caseSource(
            "case:suma",
            "Suma dos valores"
        )]
    });
    const testController = nativeController();
    const metadata = new Map();
    const items = addSuiteItems({
        testController,
        suite,
        metadata,
        metadataOverrides:
            options.metadataOverrides
    });
    const entry = {
        definitionPath: DEFINITION_PATH,
        status: "ready",
        suite,
        issue: null
    };
    const debug = fakeDebug();
    const traces = eventSource();
    const vscode = fakeVSCode(debug);

    return {
        debug,
        traces,
        items,
        suite,
        testController,
        create() {
            return new CLRSTestDebugController({
                vscodeApi: vscode,
                discoveryController: {
                    controller: testController,
                    getMetadata(item) {
                        return metadata.get(item.id) ?? null;
                    }
                },
                discovery: {
                    findByDefinitionPath() {
                        return entry;
                    }
                },
                workspace: {
                    toUri(sourcePath) {
                        return { fsPath: sourcePath };
                    },
                    getWorkspaceFolder() {
                        return { name: "workspace" };
                    },
                    getDocumentVersion() {
                        return 7;
                    }
                },
                executionTraceService: traces,
                debugType: "clrs",
                developerLogger: { error() {} }
            });
        }
    };
}

function caseSource(id, name) {
    return {
        id,
        name,
        input: {
            stdin: id === "case:suma"
                ? "2\n3\n"
                : ""
        },
        expectation: {
            stdout: id === "case:suma"
                ? "5\n"
                : ""
        }
    };
}

function addSuiteItems({
    testController,
    suite,
    metadata,
    metadataOverrides = {}
}) {
    const root = testController.createTestItem(
        "suite:item",
        suite.name,
        { fsPath: DEFINITION_PATH }
    );
    const cases = suite.cases.map(testCase => {
        const item = testController.createTestItem(
            `case:item:${testCase.id}`,
            testCase.name,
            { fsPath: DEFINITION_PATH }
        );

        metadata.set(item.id, {
            kind: "case",
            definitionPath: DEFINITION_PATH,
            suiteId: suite.id,
            caseId: testCase.id,
            runnable: true,
            ...metadataOverrides
        });
        return item;
    });

    root.children.replace(cases);
    testController.items.replace([root]);
    metadata.set(root.id, {
        kind: "suite",
        definitionPath: DEFINITION_PATH,
        suiteId: suite.id,
        caseId: null,
        runnable: true,
        ...metadataOverrides
    });

    return { root, cases };
}

function fakeDebug() {
    const starts = [];
    const stoppedSessions = [];
    const sessions = [];
    const startListeners = new Set();
    const terminateListeners = new Set();

    return {
        starts,
        sessions,
        stoppedSessions,
        startResult: true,
        onStart: null,
        async startDebugging(folder, configuration) {
            starts.push({ folder, configuration });

            if (this.startResult !== true) {
                return this.startResult;
            }

            const session = { configuration };

            sessions.push(session);
            for (const listener of startListeners) {
                listener(session);
            }
            this.onStart?.(configuration);
            return true;
        },
        async stopDebugging(session) {
            stoppedSessions.push(session);
            for (const listener of terminateListeners) {
                listener(session);
            }
            return true;
        },
        onDidStartDebugSession(listener) {
            startListeners.add(listener);
            return disposable(() =>
                startListeners.delete(listener)
            );
        },
        onDidTerminateDebugSession(listener) {
            terminateListeners.add(listener);
            return disposable(() =>
                terminateListeners.delete(listener)
            );
        }
    };
}

function eventSource() {
    const listeners = new Set();

    return {
        subscribe(listener) {
            listeners.add(listener);
            return disposable(() =>
                listeners.delete(listener)
            );
        },
        emit(event) {
            for (const listener of listeners) {
                listener(event);
            }
        }
    };
}

function nativeController() {
    const controller = {
        items: collection(),
        profiles: [],
        runs: [],
        createTestItem(id, label, uri) {
            return {
                id,
                label,
                uri,
                error: undefined,
                children: collection()
            };
        },
        createRunProfile(
            label,
            kind,
            runHandler,
            isDefault,
            tag,
            supportsContinuousRun
        ) {
            const profile = {
                label,
                kind,
                runHandler,
                isDefault,
                tag,
                supportsContinuousRun,
                disposed: false,
                dispose() {
                    profile.disposed = true;
                }
            };

            controller.profiles.push(profile);
            return profile;
        },
        createTestRun(request, name, persist) {
            const run = testRun(request, name, persist);

            controller.runs.push(run);
            return run;
        }
    };

    return controller;
}

function testRun(request, name, persist) {
    return {
        request,
        name,
        persist,
        enqueuedItems: [],
        startedItems: [],
        skippedItems: [],
        passedItems: [],
        failedItems: [],
        erroredItems: [],
        outputs: [],
        ended: false,
        enqueued(item) {
            this.enqueuedItems.push(item);
        },
        started(item) {
            this.startedItems.push(item);
        },
        skipped(item) {
            this.skippedItems.push(item);
        },
        passed(item, duration) {
            this.passedItems.push({ item, duration });
        },
        failed(item, message, duration) {
            this.failedItems.push({ item, message, duration });
        },
        errored(item, message, duration) {
            this.erroredItems.push({ item, message, duration });
        },
        appendOutput(text, location, item) {
            this.outputs.push({ text, location, item });
        },
        end() {
            this.ended = true;
        }
    };
}

function collection() {
    const values = new Map();

    return {
        get size() {
            return values.size;
        },
        replace(items) {
            values.clear();
            for (const item of items) {
                values.set(item.id, item);
            }
        },
        forEach(callback) {
            for (const item of values.values()) {
                callback(item, this);
            }
        }
    };
}

function fakeVSCode(debug) {
    class TestMessage {
        constructor(message) {
            this.message = message;
        }

        static diff(message, expected, actual) {
            const value = new TestMessage(message);
            value.expectedOutput = expected;
            value.actualOutput = actual;
            return value;
        }
    }

    class Range {
        constructor(...values) {
            this.values = values;
        }
    }

    class Location {
        constructor(uri, range) {
            this.uri = uri;
            this.range = range;
        }
    }

    return {
        debug,
        TestRunProfileKind: { Run: 1, Debug: 2 },
        TestMessage,
        Range,
        Location
    };
}

function cancellationToken() {
    let listener = null;
    const subscription = {
        disposed: false,
        dispose() {
            subscription.disposed = true;
        }
    };

    return {
        isCancellationRequested: false,
        subscription,
        onCancellationRequested(value) {
            listener = value;
            return subscription;
        },
        cancel() {
            this.isCancellationRequested = true;
            listener?.();
        }
    };
}

function disposable(onDispose = () => {}) {
    return {
        dispose() {
            onDispose();
        }
    };
}

async function waitFor(predicate) {
    const timeoutAt = Date.now() + 2_000;

    while (!predicate()) {
        if (Date.now() >= timeoutAt) {
            assert.fail("La condición esperada no se cumplió.");
        }

        await new Promise(resolve =>
            setTimeout(resolve, 5)
        );
    }
}
