import test from "node:test";
import assert from "node:assert/strict";
import {
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
    spawnSync
} from "node:child_process";

import {
    ExecutionTraceService
} from "../src/runtime/ExecutionTraceService.js";
import {
    createExecutionCoveragePoint,
    ExecutionCoverageKind,
    normalizeExecutionCoverageEvent
} from "../src/runtime/ExecutionCoverageEvent.js";
import {
    completeRuntimeTrace,
    configureRuntimeTrace
} from "../src/compiler/runtime/CliTraceConfiguration.js";
import {
    ExecutionTraceFileSession
} from "../extension/adapters/ExecutionTraceFileSession.js";
import {
    VSCodeCodeHost
} from "../extension/adapters/VSCodeCodeHost.js";
import {
    createEmptyExecutionTrace,
    reduceExecutionTrace
} from "../frontend/src/execution/ExecutionTraceState.js";

test("la sesión agrega pasos, limita la traza y conserva el estado final", () => {
    const service =
        new ExecutionTraceService({
            maxSteps: 2
        });
    const events = [];
    const emitted = [];
    const subscription =
        service.subscribe(event => {
            events.push(event.type);
            emitted.push(event);
        });
    const trace = service.start({
        sourcePath: "programa.clrs",
        documentVersion: 4,
        debug: true
    });

    service.accept(trace.traceId, {
        type: "location",
        location: location(1)
    });
    service.accept(trace.traceId, {
        type: "location",
        location: location(2)
    });
    service.accept(trace.traceId, {
        type: "stopped",
        reason: "breakpoint",
        breakpointIds: [7],
        text: "Condición satisfecha",
        location: location(2),
        state: {
            frames: [{
                name: "PRINCIPAL",
                locals: [{
                    name: "dato",
                    value: "1"
                }]
            }]
        }
    });

    const pausedSnapshot =
        service.getSnapshot();

    assert.equal(
        pausedSnapshot.debug.status,
        "paused"
    );
    assert.equal(
        pausedSnapshot.debug
            .location.startLine,
        2
    );
    assert.equal(
        pausedSnapshot.debug
            .state.frames[0]
            .locals[0].value,
        "1"
    );
    assert.deepEqual(
        pausedSnapshot.debug
            .breakpointIds,
        [7]
    );
    assert.equal(
        pausedSnapshot.debug.text,
        "Condición satisfecha"
    );

    service.accept(trace.traceId, {
        type: "output",
        category: "console",
        output: "dato = 1\n",
        location: location(2),
        breakpointId: 7
    });

    const output = emitted.find(
        event => event.type === "output"
    );

    assert.equal(output.output, "dato = 1\n");
    assert.equal(output.breakpointId, 7);
    assert.equal(
        output.location.startLine,
        2
    );

    service.accept(trace.traceId, {
        type: "continued"
    });

    assert.equal(
        service.getSnapshot()
            .debug.status,
        "running"
    );
    service.accept(trace.traceId, {
        type: "location",
        location: location(3)
    });
    service.accept(trace.traceId, {
        type: "end",
        status: "correct"
    });

    const snapshot = service.getSnapshot();

    assert.equal(snapshot.steps.length, 2);
    assert.equal(snapshot.truncated, true);
    assert.equal(snapshot.status, "correct");
    assert.equal(
        snapshot.debug.status,
        "ended"
    );
    assert.deepEqual(
        events,
        [
            "start",
            "step",
            "step",
            "stopped",
            "output",
            "continued",
            "truncated",
            "end"
        ]
    );

    subscription.dispose();
    service.dispose();
});

test("la traza valida y limita eventos de cobertura por separado", () => {
    const service = new ExecutionTraceService({
        maxSteps: 1,
        maxCoverageEvents: 2
    });
    const emitted = [];

    service.subscribe(event => {
        emitted.push(event);
    });
    const trace = service.start({
        sourcePath: "programa.clrs",
        documentVersion: 3
    });
    const statement = createExecutionCoveragePoint(
        ExecutionCoverageKind.STATEMENT,
        location(2)
    );
    const branch = {
        ...createExecutionCoveragePoint(
            ExecutionCoverageKind.BRANCH,
            location(3)
        ),
        outcome: false
    };

    assert.equal(
        service.accept(trace.traceId, {
            type: "coverage",
            ...statement
        }),
        true
    );
    assert.equal(
        service.accept(trace.traceId, {
            type: "coverage",
            ...branch
        }),
        true
    );
    assert.equal(
        service.accept(trace.traceId, {
            type: "coverage",
            ...statement
        }),
        true
    );

    const snapshot = service.getSnapshot();

    assert.equal(snapshot.coverageEvents.length, 2);
    assert.equal(
        snapshot.coverageEvents[0].kind,
        "statement"
    );
    assert.equal(
        snapshot.coverageEvents[1].outcome,
        false
    );
    assert.equal(snapshot.coverageTruncated, true);
    assert.equal(snapshot.maxCoverageEvents, 2);
    assert.equal(
        emitted.filter(event =>
            event.type === "coverage"
        ).length,
        2
    );
    assert.equal(
        emitted.filter(event =>
            event.type ===
                "coverage-truncated"
        ).length,
        1
    );

    service.dispose();
});

test("la evidencia de cobertura rechaza identidades y resultados inválidos", () => {
    const point = createExecutionCoveragePoint(
        ExecutionCoverageKind.BRANCH,
        location(4)
    );

    assert.equal(
        normalizeExecutionCoverageEvent({
            ...point
        }),
        null
    );
    assert.equal(
        normalizeExecutionCoverageEvent({
            ...point,
            pointId: "branch:otra-ubicacion",
            outcome: true
        }),
        null
    );
    assert.equal(
        normalizeExecutionCoverageEvent({
            ...point,
            outcome: true
        }).outcome,
        true
    );
});

test("la traza entrega el resultado de prueba después del fin del runtime", () => {
    const service = new ExecutionTraceService();
    const events = [];

    service.subscribe(event => events.push(event));
    const trace = service.start({
        sourcePath: "programa.clrs",
        debug: true
    });

    service.accept(trace.traceId, {
        type: "end",
        status: "correct"
    });
    const accepted = service.accept(trace.traceId, {
        type: "test-result",
        status: "correct",
        stdout: "3\n",
        stderr: "",
        exitCode: 0,
        signal: null,
        outputTruncated: false
    });

    assert.equal(accepted, true);
    assert.deepEqual(events.at(-1), {
        type: "test-result",
        traceId: trace.traceId,
        sourcePath: "programa.clrs",
        documentVersion: null,
        status: "correct",
        stdout: "3\n",
        stderr: "",
        exitCode: 0,
        signal: null,
        outputTruncated: false
    });
});

test("el lector incremental procesa únicamente líneas JSONL completas", () => {
    const memory = {
        exists: false,
        source: ""
    };
    const events = [];
    let intervalCallback = null;
    let cleared = false;
    const session =
        new ExecutionTraceFileSession({
            tracePath: "trace.jsonl",
            onEvent: event =>
                events.push(event),
            logger: silentLogger(),
            fileSystem: {
                existsSync() {
                    return memory.exists;
                },
                readFileSync() {
                    return memory.source;
                },
                unlinkSync() {
                    memory.exists = false;
                }
            },
            setInterval(callback) {
                intervalCallback = callback;
                return 7;
            },
            clearInterval(id) {
                assert.equal(id, 7);
                cleared = true;
            },
            setTimeout(callback, delay) {
                assert.equal(delay, 1000);
                callback();
            }
        });

    session.start();
    memory.exists = true;
    memory.source =
        '{"type":"location","location":';
    intervalCallback();
    assert.deepEqual(events, []);

    memory.source +=
        '{"startLine":1}}\n' +
        '{"type":"end","status":"correct"}\n';
    intervalCallback();

    assert.deepEqual(
        events.map(event => event.type),
        ["location", "end"]
    );
    assert.equal(cleared, true);
    assert.equal(memory.exists, false);
});

test("el lector conserva la traza de una prueba hasta recibir su resultado", () => {
    const memory = {
        exists: false,
        source: ""
    };
    const events = [];
    let intervalCallback = null;
    let cleared = false;
    const session = new ExecutionTraceFileSession({
        tracePath: "trace-test.jsonl",
        onEvent: event => events.push(event),
        logger: silentLogger(),
        fileSystem: {
            existsSync() {
                return memory.exists;
            },
            readFileSync() {
                return memory.source;
            },
            unlinkSync() {
                memory.exists = false;
            }
        },
        setInterval(callback) {
            intervalCallback = callback;
            return 9;
        },
        clearInterval() {
            cleared = true;
        },
        setTimeout(callback) {
            callback();
        }
    });

    session.start();
    memory.exists = true;
    memory.source =
        '{"type":"end","status":"correct","awaitProcess":true}\n';
    intervalCallback();

    assert.equal(cleared, false);
    assert.equal(memory.exists, true);

    memory.source +=
        '{"type":"test-result","status":"correct","stdout":"","stderr":"","exitCode":0}\n';
    intervalCallback();

    assert.deepEqual(
        events.map(event => event.type),
        ["end", "test-result"]
    );
    assert.equal(cleared, true);
    assert.equal(memory.exists, false);
});

test("el argumento interno de traza no llega al controlador CLI", () => {
    const environment = {};
    const configuration =
        configureRuntimeTrace(
            [
                "programa.clrs",
                "--trace-file",
                "trace.jsonl",
                "--control-file",
                "control.json"
            ],
            environment
        );

    assert.deepEqual(
        configuration,
        {
            sourceArgs: ["programa.clrs"],
            traceFile: "trace.jsonl",
            controlFile: "control.json"
        }
    );
    assert.equal(
        environment.CLRS_TRACE_FILE,
        "trace.jsonl"
    );
    assert.equal(
        environment.CLRS_CONTROL_FILE,
        "control.json"
    );
});

test("el CLI cierra la traza aunque la compilación falle antes del runtime", () => {
    let source = "";
    const completed = completeRuntimeTrace(
        "trace.jsonl",
        "error",
        {
            existsSync() {
                return source !== "";
            },
            readFileSync() {
                return source;
            },
            appendFileSync(
                fileName,
                addition
            ) {
                assert.equal(
                    fileName,
                    "trace.jsonl"
                );
                source += addition;
            }
        }
    );

    assert.equal(completed, true);
    assert.deepEqual(
        source.trim().split("\n")
            .map(line => JSON.parse(line)),
        [
            { type: "start" },
            {
                type: "end",
                status: "error"
            }
        ]
    );
});

test("el CLI completa una prueba depurada aunque falle antes del runtime", () => {
    let source = "";
    const completed = completeRuntimeTrace(
        "trace.jsonl",
        "error",
        {
            existsSync() {
                return source !== "";
            },
            readFileSync() {
                return source;
            },
            appendFileSync(fileName, addition) {
                assert.equal(fileName, "trace.jsonl");
                source += addition;
            }
        },
        { CLRS_TEST_DEBUG: "1" }
    );
    const events = source.trim().split("\n")
        .map(line => JSON.parse(line));

    assert.equal(completed, true);
    assert.deepEqual(events, [
        { type: "start" },
        {
            type: "end",
            status: "error",
            awaitProcess: true
        },
        {
            type: "test-result",
            status: "error",
            stdout: "",
            stderr: "",
            exitCode: 1,
            signal: null,
            outputTruncated: false
        }
    ]);
});

test("el runtime emite una traza real sin alterar su salida", () => {
    const temporaryDirectory =
        mkdtempSync(
            path.join(
                os.tmpdir(),
                "clrs-trace-test-"
            )
        );
    const sourcePath = path.join(
        temporaryDirectory,
        "programa.clrs"
    );
    const tracePath = path.join(
        temporaryDirectory,
        "trace.jsonl"
    );

    try {
        writeFileSync(
            sourcePath,
            "dato = 1\nescribir dato\n",
            "utf8"
        );

        const execution = spawnSync(
            process.execPath,
            [
                path.resolve(
                    "src/compiler/CliEntry.js"
                ),
                sourcePath,
                "--trace-file",
                tracePath
            ],
            {
                encoding: "utf8",
                timeout: 15000
            }
        );
        const events = readFileSync(
            tracePath,
            "utf8"
        ).trim()
            .split("\n")
            .map(line => JSON.parse(line));

        assert.equal(execution.status, 0);
        assert.match(execution.stdout, /1/);
        assert.equal(events[0].type, "start");
        assert.ok(
            events.some(event =>
                event.type === "location" &&
                event.location.startLine === 2
            )
        );
        assert.ok(
            events.some(event =>
                event.type === "coverage" &&
                event.kind === "statement" &&
                event.location.startLine === 2
            )
        );
        assert.deepEqual(
            events.at(-1),
            {
                type: "end",
                status: "correct"
            }
        );
    } finally {
        rmSync(
            temporaryDirectory,
            {
                recursive: true,
                force: true
            }
        );
    }
});

test("el runtime instrumenta funciones, ramas y ciclos sin cambiar el resultado", () => {
    const temporaryDirectory = mkdtempSync(
        path.join(
            os.tmpdir(),
            "clrs-coverage-test-"
        )
    );
    const sourcePath = path.join(
        temporaryDirectory,
        "cobertura.clrs"
    );
    const tracePath = path.join(
        temporaryDirectory,
        "coverage.jsonl"
    );

    try {
        writeFileSync(
            sourcePath,
            [
                "AUX()",
                "    valor = 1",
                "PRINCIPAL()",
                "    AUX()",
                "    dato = 0",
                "    si dato == 0",
                "        escribir dato",
                "    mientras dato < 2",
                "        dato = dato + 1",
                "    escribir dato"
            ].join("\n") + "\n",
            "utf8"
        );

        const execution = spawnSync(
            process.execPath,
            [
                path.resolve(
                    "src/compiler/CliEntry.js"
                ),
                sourcePath,
                "--trace-file",
                tracePath
            ],
            {
                encoding: "utf8",
                timeout: 15000
            }
        );
        const events = readFileSync(
            tracePath,
            "utf8"
        ).trim().split("\n")
            .map(line => JSON.parse(line));
        const coverage = events.filter(
            event => event.type === "coverage"
        );
        const loopOutcomes = coverage
            .filter(event =>
                event.kind === "loop"
            )
            .map(event => event.outcome);
        const functionFlow = events
            .filter(event =>
                event.type ===
                    "execution-flow"
            )
            .map(event => ({
                kind: event.flow?.kind,
                functionName:
                    event.flow?.functionName,
                frameId:
                    event.flow?.frameId,
                parentFrameId:
                    event.flow
                        ?.parentFrameId ?? null
            }));

        assert.equal(execution.status, 0);
        assert.match(execution.stdout, /0\s+2/u);
        assert.ok(coverage.some(event =>
            event.kind === "function" &&
            event.name === "PRINCIPAL"
        ));
        assert.ok(coverage.some(event =>
            event.kind === "branch" &&
            event.outcome === true
        ));
        assert.deepEqual(
            loopOutcomes,
            [true, true, false]
        );
        assert.deepEqual(
            functionFlow,
            [
                {
                    kind: "enter",
                    functionName: "PRINCIPAL",
                    frameId: 1,
                    parentFrameId: null
                },
                {
                    kind: "enter",
                    functionName: "AUX",
                    frameId: 2,
                    parentFrameId: 1
                },
                {
                    kind: "return",
                    functionName: "AUX",
                    frameId: 2,
                    parentFrameId: 1
                },
                {
                    kind: "return",
                    functionName: "PRINCIPAL",
                    frameId: 1,
                    parentFrameId: null
                }
            ]
        );
        assert.ok(coverage.every(event =>
            typeof event.pointId === "string" &&
            event.location?.startLine >= 1
        ));
    } finally {
        rmSync(temporaryDirectory, {
            recursive: true,
            force: true
        });
    }
});

test("una ejecución depurada consume la entrada declarada y publica su resultado", () => {
    const temporaryDirectory = mkdtempSync(
        path.join(os.tmpdir(), "clrs-debug-test-")
    );
    const sourcePath = path.join(
        temporaryDirectory,
        "programa.clrs"
    );
    const inputPath = path.join(
        temporaryDirectory,
        "entrada.txt"
    );
    const tracePath = path.join(
        temporaryDirectory,
        "trace.jsonl"
    );

    try {
        writeFileSync(
            sourcePath,
            "dato = 0\nleer dato\nescribir dato\n",
            "utf8"
        );
        writeFileSync(inputPath, "42\n", "utf8");

        const execution = spawnSync(
            process.execPath,
            [
                path.resolve("src/compiler/CliEntry.js"),
                sourcePath,
                "--trace-file",
                tracePath
            ],
            {
                encoding: "utf8",
                timeout: 15000,
                env: {
                    ...process.env,
                    CLRS_TEST_MODE: "1",
                    CLRS_TEST_DEBUG: "1",
                    CLRS_TEST_SEED: "37",
                    CLRS_TEST_INPUT_FILE: inputPath
                }
            }
        );
        const events = readFileSync(tracePath, "utf8")
            .trim().split("\n")
            .map(line => JSON.parse(line));
        const result = events.find(event =>
            event.type === "test-result"
        );

        assert.equal(execution.status, 0);
        assert.match(execution.stdout, /42/u);
        assert.equal(result.status, "correct");
        assert.equal(result.stdout, "42\n");
        assert.equal(result.stderr, "");
        assert.equal(result.exitCode, 0);
    } finally {
        rmSync(temporaryDirectory, {
            recursive: true,
            force: true
        });
    }
});

test("el estado del webview reconstruye eventos incrementales", () => {
    let state = createEmptyExecutionTrace();

    state = reduceExecutionTrace(
        state,
        {
            type: "execution-event",
            event: {
                type: "start",
                trace: {
                    traceId: "execution-1",
                    status: "running",
                    steps: [],
                    maxSteps: 10
                }
            }
        }
    );

    state = reduceExecutionTrace(
        state,
        {
            type: "execution-event",
            event: {
                type: "step",
                traceId: "execution-1",
                step: {
                    index: 0,
                    location: location(3)
                }
            }
        }
    );
    state = reduceExecutionTrace(
        state,
        {
            type: "execution-event",
            event: {
                type: "end",
                traceId: "execution-1",
                status: "correct"
            }
        }
    );

    assert.equal(state.steps.length, 1);
    assert.equal(
        state.steps[0].location.startLine,
        3
    );
    assert.equal(state.status, "correct");
});

test("el host conserva la terminal interactiva y añade el canal lateral", () => {
    const commands = [];
    const service =
        new ExecutionTraceService();
    let traceOptions = null;
    const terminal = {
        name: "CLRS",
        show() {},
        sendText(command) {
            commands.push(command);
        }
    };
    const host = new VSCodeCodeHost(
        {
            window: {
                terminals: [terminal]
            }
        },
        {
            terminalName: "CLRS",
            outputChannelName: "CLRS"
        },
        {
            executionTraceService: service,
            logger: silentLogger(),
            traceSessionFactory(options) {
                traceOptions = options;

                return {
                    start() {},
                    dispose() {}
                };
            }
        }
    );

    const trace = host.runCli(
        "interpreter.js",
        "programa.clrs",
        { documentVersion: 8 }
    );

    assert.equal(trace.status, "running");
    assert.equal(trace.documentVersion, 8);
    assert.match(
        commands[1],
        /--trace-file ".+\.jsonl"/
    );

    traceOptions.onEvent({
        type: "location",
        location: location(4)
    });
    traceOptions.onEvent({
        type: "end",
        status: "correct"
    });

    assert.equal(
        service.getSnapshot().steps.length,
        1
    );
    assert.equal(
        service.getSnapshot().status,
        "correct"
    );

    host.dispose();
    service.dispose();
});

test("el host detiene la ejecución interactiva y cancela su traza", () => {
    const commands = [];
    const disposals = [];
    const service =
        new ExecutionTraceService();
    const terminal = {
        name: "CLRS",
        show() {},
        sendText(command, addNewLine) {
            commands.push({
                command,
                addNewLine
            });
        }
    };
    const host = new VSCodeCodeHost(
        {
            window: {
                terminals: [terminal]
            }
        },
        {
            terminalName: "CLRS",
            outputChannelName: "CLRS"
        },
        {
            executionTraceService: service,
            logger: silentLogger(),
            traceSessionFactory() {
                return {
                    start() {},
                    dispose(options) {
                        disposals.push(options);
                    }
                };
            }
        }
    );

    host.runCli(
        "interpreter.js",
        "programa.clrs",
        { documentVersion: 8 }
    );

    assert.equal(host.stopExecution(), true);
    assert.deepEqual(commands.at(-1), {
        command: "\u0003",
        addNewLine: false
    });
    assert.equal(
        service.getSnapshot().status,
        "cancelled"
    );
    assert.deepEqual(disposals, [{
        cleanupDelayMs: 1000
    }]);
    assert.equal(host.stopExecution(), false);

    host.dispose();
    service.dispose();
});

test("el depurador inicia el intérprete como proceso raíz de la terminal", () => {
    const created = [];
    const service =
        new ExecutionTraceService();
    const host = new VSCodeCodeHost(
        {
            window: {
                terminals: [],
                createTerminal(options) {
                    const terminal = {
                        name: options.name,
                        options,
                        shown: false,
                        show() {
                            this.shown = true;
                        },
                        sendText() {}
                    };

                    created.push(terminal);
                    return terminal;
                }
            }
        },
        {
            terminalName: "CLRS",
            outputChannelName: "CLRS"
        },
        {
            executionTraceService: service,
            logger: silentLogger(),
            traceSessionFactory() {
                return {
                    start() {},
                    dispose() {}
                };
            },
            controlSessionFactory() {
                return {
                    start() {
                        return this;
                    },
                    terminate() {},
                    dispose() {}
                };
            }
        }
    );

    const launched = host.runCli(
        "C:/extension/CliEntry.js",
        "C:/workspace/programa.clrs",
        {
            debug: true,
            documentVersion: 4,
            stopOnEntry: true,
            breakpoints: [{
                id: 1,
                line: 2
            }]
        }
    );

    assert.equal(created.length, 1);
    assert.equal(created[0].shown, true);
    assert.equal(
        created[0].options.shellPath,
        "node"
    );
    assert.deepEqual(
        created[0].options.shellArgs.slice(0, 2),
        [
            "C:/extension/CliEntry.js",
            "C:/workspace/programa.clrs"
        ]
    );
    assert.ok(
        created[0].options.shellArgs
            .includes("--trace-file")
    );
    assert.ok(
        created[0].options.shellArgs
            .includes("--control-file")
    );
    assert.equal(
        launched.trace.status,
        "running"
    );
    assert.ok(launched.controlSession);

    host.dispose();
    service.dispose();
});

test("el host entrega entrada y semilla de prueba al proceso depurado", () => {
    const created = [];
    const writes = [];
    const removals = [];
    let traceOptions = null;
    const service = new ExecutionTraceService();
    const host = new VSCodeCodeHost(
        {
            window: {
                terminals: [],
                createTerminal(options) {
                    const terminal = {
                        name: options.name,
                        options,
                        show() {}
                    };
                    created.push(terminal);
                    return terminal;
                }
            }
        },
        {
            terminalName: "CLRS",
            outputChannelName: "CLRS"
        },
        {
            executionTraceService: service,
            logger: silentLogger(),
            randomUUID() {
                return "test-input";
            },
            writeFileSync(...args) {
                writes.push(args);
            },
            rmSync(...args) {
                removals.push(args);
            },
            traceSessionFactory(options) {
                traceOptions = options;
                return {
                    start() {},
                    dispose() {}
                };
            },
            controlSessionFactory() {
                return {
                    start() {
                        return this;
                    },
                    terminate() {},
                    dispose() {}
                };
            }
        }
    );

    host.runCli(
        "C:/extension/CliEntry.js",
        "C:/workspace/programa.clrs",
        {
            debug: true,
            test: {
                stdin: "8\n13\n",
                seed: 91
            }
        }
    );

    const environment = created[0].options.env;

    assert.equal(environment.CLRS_TEST_MODE, "1");
    assert.equal(environment.CLRS_TEST_DEBUG, "1");
    assert.equal(environment.CLRS_TEST_SEED, "91");
    assert.match(
        environment.CLRS_TEST_INPUT_FILE,
        /clrs-test-input-test-input\.txt$/u
    );
    assert.deepEqual(writes[0], [
        environment.CLRS_TEST_INPUT_FILE,
        "8\n13\n",
        "utf8"
    ]);

    traceOptions.onFinish();

    assert.deepEqual(removals, [[
        environment.CLRS_TEST_INPUT_FILE,
        { force: true }
    ]]);
    service.dispose();
});

function location(startLine) {
    return {
        startLine,
        startColumn: 1,
        endLine: startLine,
        endColumn: 5
    };
}

function silentLogger() {
    return {
        error() {}
    };
}
