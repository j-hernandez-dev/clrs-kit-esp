import test from "node:test";
import assert from "node:assert/strict";
import {
    readFileSync
} from "node:fs";

import {
    ExecutionTraceService
} from "../src/runtime/ExecutionTraceService.js";
import {
    DebugCommandController
} from "../extension/controllers/DebugCommandController.js";
import {
    CLRSDebugAdapter
} from "../extension/debug/CLRSDebugAdapter.js";
import {
    CLRSDebugAdapterFactory
} from "../extension/debug/CLRSDebugAdapterFactory.js";
import {
    CLRSDebugConfigurationProvider
} from "../extension/debug/CLRSDebugConfigurationProvider.js";

test("la sesión DAP controla breakpoints, avance y frame fuente", () => {
    const messages = [];
    const traceService =
        new ExecutionTraceService();
    const emitter =
        createMessageEmitter(messages);
    let launchedConfiguration = null;
    let trace = null;
    const controlCommands = [];
    const controlSession = {
        setBreakpoints(lines) {
            controlCommands.push({
                command: "breakpoints",
                lines
            });
        },
        continue() {
            controlCommands.push({
                command: "continue"
            });
        },
        stepIn() {
            controlCommands.push({
                command: "stepIn"
            });
        },
        stepOver() {
            controlCommands.push({
                command: "stepOver"
            });
        },
        stepOut() {
            controlCommands.push({
                command: "stepOut"
            });
        },
        pause() {
            controlCommands.push({
                command: "pause"
            });
        },
        terminate() {
            controlCommands.push({
                command: "terminate"
            });
        }
    };
    const adapter =
        new CLRSDebugAdapter({
            messageEmitter: emitter,
            executionTraceService:
                traceService,
            launchProgram(configuration) {
                launchedConfiguration =
                    configuration;
                trace = traceService.start({
                    sourcePath:
                        configuration.program,
                    documentVersion:
                        configuration
                            .__clrsDocumentVersion
                });
                return { controlSession };
            },
            logger: silentLogger()
        });

    adapter.handleMessage(request(
        1,
        "initialize"
    ));
    adapter.handleMessage(request(
        2,
        "launch",
        {
            type: "clrs",
            request: "launch",
            name: "Depurar CLRS",
            program: "/workspace/a.clrs",
            __clrsDocumentVersion: 7
        }
    ));
    adapter.handleMessage(request(
        3,
        "setBreakpoints",
        {
            source: {
                path: "/workspace/a.clrs"
            },
            breakpoints: [{ line: 2 }]
        }
    ));
    adapter.handleMessage(request(
        4,
        "configurationDone"
    ));

    assert.equal(
        launchedConfiguration.program,
        "/workspace/a.clrs"
    );
    assert.equal(
        responseFor(messages, 1)
            .body
            .supportsConfigurationDoneRequest,
        true
    );
    assert.equal(
        responseFor(messages, 1)
            .body
            .supportsTerminateRequest,
        true
    );
    assert.equal(
        responseFor(messages, 1)
            .body
            .supportTerminateDebuggee,
        true
    );
    assert.equal(
        responseFor(messages, 1)
            .body
            .supportsConditionalBreakpoints,
        true
    );
    assert.equal(
        responseFor(messages, 1)
            .body
            .supportsHitConditionalBreakpoints,
        true
    );
    assert.equal(
        responseFor(messages, 1)
            .body
            .supportsLogPoints,
        true
    );
    assert.ok(
        messages.some(message =>
            message.type === "event" &&
            message.event === "initialized"
        )
    );
    assert.equal(
        responseFor(messages, 3)
            .body
            .breakpoints[0]
            .verified,
        true
    );
    assert.deepEqual(
        launchedConfiguration
            .__clrsBreakpoints,
        [{
            id: 1,
            line: 2,
            column: null,
            condition: null,
            hitCondition: null,
            logSegments: null
        }]
    );
    assert.equal(
        responseFor(messages, 4).success,
        true
    );

    traceService.accept(
        trace.traceId,
        {
            type: "location",
            location: debugLocation(2)
        }
    );
    traceService.accept(
        trace.traceId,
        {
            type: "stopped",
            reason: "breakpoint",
            breakpointIds: [1],
            location: debugLocation(2),
            state: {
                globalLocation:
                    debugLocation(1),
                globals: [{
                    name: "base",
                    type: "número",
                    value: "10",
                    children: []
                }],
                frames: [{
                    id: 1,
                    name: "PRINCIPAL",
                    location:
                        debugLocation(2),
                    parameters: [],
                    locals: [{
                        name: "dato",
                        type: "número",
                        value: "1",
                        children: []
                    }]
                }]
            }
        }
    );
    adapter.handleMessage(request(
        5,
        "stackTrace",
        { threadId: 1 }
    ));
    adapter.handleMessage(request(
        6,
        "scopes",
        {
            frameId:
                responseFor(messages, 5)
                    .body
                    .stackFrames[0].id
        }
    ));
    adapter.handleMessage(request(
        7,
        "variables",
        {
            variablesReference:
                responseFor(messages, 6)
                    .body.scopes[0]
                    .variablesReference
        }
    ));
    adapter.handleMessage(request(
        8,
        "next",
        { threadId: 1 }
    ));
    adapter.handleMessage(request(
        9,
        "stepIn",
        { threadId: 1 }
    ));
    adapter.handleMessage(request(
        10,
        "stepOut",
        { threadId: 1 }
    ));

    assert.ok(
        messages.some(message =>
            message.type === "event" &&
            message.event === "stopped" &&
            message.body.reason ===
                "breakpoint" &&
            message.body
                .hitBreakpointIds?.[0] === 1
        )
    );
    assert.equal(
        responseFor(messages, 5)
            .body
            .stackFrames[0]
            .line,
        2
    );
    assert.deepEqual(
        responseFor(messages, 5)
            .body.stackFrames
            .map(frame => frame.name),
        ["PRINCIPAL", "Programa CLRS"]
    );
    assert.deepEqual(
        responseFor(messages, 7)
            .body.variables
            .map(variable =>
                [variable.name, variable.value]
            ),
        [["dato", "1"]]
    );
    assert.deepEqual(
        controlCommands,
        [
            { command: "stepOver" },
            { command: "stepIn" },
            { command: "stepOut" }
        ]
    );

    traceService.accept(
        trace.traceId,
        {
            type: "output",
            category: "console",
            output: "dato = 1\n",
            location: debugLocation(2),
            breakpointId: 1
        }
    );

    const logOutput = messages.find(
        message =>
            message.type === "event" &&
            message.event === "output" &&
            message.body.output ===
                "dato = 1\n"
    );

    assert.equal(
        logOutput.body.source.path,
        "/workspace/a.clrs"
    );
    assert.equal(logOutput.body.line, 2);

    traceService.accept(
        trace.traceId,
        {
            type: "end",
            status: "correct"
        }
    );

    assert.ok(
        messages.some(message =>
            message.type === "event" &&
            message.event === "output" &&
            message.body.output.includes(
                "terminó correctamente"
            )
        )
    );
    assert.equal(
        messages.filter(message =>
            message.type === "event" &&
            message.event === "terminated"
        ).length,
        1
    );

    adapter.dispose();
    assert.equal(emitter.disposed, true);
    traceService.dispose();
});

test("valida breakpoints avanzados y conserva IDs entre reconfiguraciones", () => {
    const messages = [];
    const traceService =
        new ExecutionTraceService();
    let launchedConfiguration = null;
    const adapter = new CLRSDebugAdapter({
        messageEmitter:
            createMessageEmitter(messages),
        executionTraceService:
            traceService,
        launchProgram(configuration) {
            launchedConfiguration =
                configuration;
            traceService.start({
                sourcePath:
                    configuration.program,
                documentVersion: 1,
                debug: true
            });

            return {
                controlSession: {
                    setBreakpoints() {},
                    continue() {},
                    stepIn() {},
                    stepOver() {},
                    stepOut() {},
                    pause() {},
                    terminate() {}
                }
            };
        },
        logger: silentLogger()
    });

    adapter.handleMessage(request(
        1,
        "initialize"
    ));
    adapter.handleMessage(request(
        2,
        "launch",
        {
            program: "/workspace/a.clrs"
        }
    ));
    adapter.handleMessage(request(
        3,
        "setBreakpoints",
        {
            source: {
                path: "/workspace/a.clrs"
            },
            breakpoints: [{
                line: 2,
                condition: "i > 1",
                hitCondition: ">= 2",
                logMessage: "i = {i}"
            }]
        }
    ));
    adapter.handleMessage(request(
        4,
        "setBreakpoints",
        {
            source: {
                path: "/workspace/a.clrs"
            },
            breakpoints: [{
                line: 4,
                condition: "i >"
            }]
        }
    ));
    adapter.handleMessage(request(
        5,
        "setBreakpoints",
        {
            source: {
                path: "/workspace/a.clrs"
            },
            breakpoints: [
                { line: 3 },
                { line: 2 }
            ]
        }
    ));
    adapter.handleMessage(request(
        6,
        "configurationDone"
    ));

    const firstId =
        responseFor(messages, 3)
            .body.breakpoints[0].id;
    const invalid =
        responseFor(messages, 4)
            .body.breakpoints[0];
    const configured =
        responseFor(messages, 5)
            .body.breakpoints;

    assert.equal(firstId, 1);
    assert.equal(invalid.verified, false);
    assert.match(
        invalid.message,
        /expresión CLRS válida/
    );
    assert.deepEqual(
        configured.map(item => ({
            line: item.line,
            id: item.id
        })),
        [
            { line: 3, id: 3 },
            { line: 2, id: 1 }
        ]
    );
    assert.deepEqual(
        launchedConfiguration
            .__clrsBreakpoints
            .map(item => ({
                id: item.id,
                line: item.line
            })),
        [
            { id: 3, line: 3 },
            { id: 1, line: 2 }
        ]
    );

    adapter.dispose();
    traceService.dispose();
});

test("una fuente ajena no borra los breakpoints del programa activo", () => {
    const messages = [];
    const traceService =
        new ExecutionTraceService();
    let launchedConfiguration = null;
    const configuredAtRuntime = [];
    const adapter = new CLRSDebugAdapter({
        messageEmitter:
            createMessageEmitter(messages),
        executionTraceService:
            traceService,
        launchProgram(configuration) {
            launchedConfiguration =
                configuration;
            traceService.start({
                sourcePath:
                    configuration.program,
                documentVersion: 1,
                debug: true
            });

            return {
                controlSession: {
                    setBreakpoints(value) {
                        configuredAtRuntime.push(
                            value
                        );
                    },
                    terminate() {}
                }
            };
        },
        logger: silentLogger()
    });

    adapter.handleMessage(request(
        1,
        "launch",
        {
            program: "/workspace/a.clrs"
        }
    ));
    adapter.handleMessage(request(
        2,
        "setBreakpoints",
        {
            source: {
                path: "/workspace/a.clrs"
            },
            breakpoints: [{ line: 2 }]
        }
    ));
    adapter.handleMessage(request(
        3,
        "setBreakpoints",
        {
            source: {
                path: "/workspace/otro.clrs"
            },
            breakpoints: [{ line: 9 }]
        }
    ));
    adapter.handleMessage(request(
        4,
        "configurationDone"
    ));

    assert.deepEqual(
        launchedConfiguration
            .__clrsBreakpoints
            .map(item => item.line),
        [2]
    );
    assert.equal(
        responseFor(messages, 3)
            .body.breakpoints[0]
            .verified,
        false
    );
    assert.deepEqual(
        configuredAtRuntime,
        []
    );

    adapter.dispose();
    traceService.dispose();
});

test("detener DAP cancela la traza y espera el cierre real del runtime", () => {
    const messages = [];
    const traceService =
        new ExecutionTraceService();
    const controlCommands = [];
    let trace = null;
    const adapter = new CLRSDebugAdapter({
        messageEmitter:
            createMessageEmitter(messages),
        executionTraceService:
            traceService,
        launchProgram(configuration) {
            trace = traceService.start({
                sourcePath:
                    configuration.program,
                documentVersion: 1,
                debug: true
            });

            return {
                controlSession: {
                    terminate() {
                        controlCommands.push(
                            "terminate"
                        );
                    }
                }
            };
        },
        logger: silentLogger()
    });

    adapter.handleMessage(request(
        1,
        "launch",
        {
            program: "/workspace/a.clrs"
        }
    ));
    adapter.handleMessage(request(
        2,
        "configurationDone"
    ));
    adapter.handleMessage(request(
        3,
        "disconnect"
    ));

    assert.deepEqual(
        controlCommands,
        ["terminate"]
    );
    assert.equal(
        responseFor(messages, 3).success,
        true
    );
    assert.equal(
        traceService.getSnapshot()
            .cancellationRequested,
        true
    );
    assert.equal(
        traceService.getSnapshot()
            .debug.status,
        "stopping"
    );
    assert.equal(
        messages.filter(message =>
            message.type === "event" &&
            message.event === "terminated"
        ).length,
        0
    );

    traceService.accept(
        trace.traceId,
        {
            type: "location",
            location: debugLocation(8)
        }
    );
    assert.equal(
        traceService.getSnapshot()
            .steps.length,
        0
    );

    traceService.accept(
        trace.traceId,
        {
            type: "end",
            status: "correct"
        }
    );

    assert.equal(
        traceService.getSnapshot().status,
        "cancelled"
    );
    assert.equal(
        messages.filter(message =>
            message.type === "event" &&
            message.event === "terminated"
        ).length,
        1
    );

    adapter.dispose();
    traceService.dispose();
});

test("el proveedor crea y completa configuraciones CLRS sin launch.json", () => {
    const publicErrors = [];
    const activeDocument = {
        filePath: "/workspace/programa.clrs",
        version: 3
    };
    const provider =
        new CLRSDebugConfigurationProvider({
            host: {
                getActiveDocument() {
                    return activeDocument;
                }
            },
            presenter: {
                error(message) {
                    publicErrors.push(message);
                }
            },
            debugType: "clrs",
            debugName:
                "Depurar programa CLRS"
        });

    assert.deepEqual(
        provider.provideDebugConfigurations(),
        [{
            type: "clrs",
            request: "launch",
            name: "Depurar programa CLRS",
            program:
                "/workspace/programa.clrs",
            __clrsDocumentVersion: 3,
            stopOnEntry: true
        }]
    );
    assert.deepEqual(
        provider.resolveDebugConfiguration(
            undefined,
            {
                type: "clrs",
                request: "launch",
                name: "Prueba",
                program: "${file}"
            }
        ),
        {
            type: "clrs",
            request: "launch",
            name: "Prueba",
            program:
                "/workspace/programa.clrs",
            __clrsDocumentVersion: 3,
            stopOnEntry: true
        }
    );
    assert.equal(
        provider.resolveDebugConfiguration(
            undefined,
            {
                program: "${file}",
                stopOnEntry: false
            }
        ).stopOnEntry,
        false
    );
    assert.equal(
        provider.resolveDebugConfiguration(
            undefined,
            { program: "/workspace/a.js" }
        ),
        undefined
    );
    assert.match(
        publicErrors[0],
        /archivo CLRS válido/
    );
});

test("el comando guarda el documento y solicita una sesión CLRS", async () => {
    let saved = false;
    let launchRequest = null;
    const document = {
        filePath: "/workspace/a.clrs",
        version: 9,
        uri: { path: "/workspace/a.clrs" },
        async save() {
            saved = true;
            return true;
        }
    };
    const controller =
        new DebugCommandController({
            host: {
                getActiveDocument() {
                    return document;
                },
                getWorkspaceFolder() {
                    return {
                        name: "workspace"
                    };
                },
                async startDebugging(
                    folder,
                    configuration
                ) {
                    launchRequest = {
                        folder,
                        configuration
                    };
                    return true;
                }
            },
            presenter: {
                present() {},
                info() {}
            },
            debugType: "clrs",
            debugName:
                "Depurar programa CLRS"
        });

    const result =
        await controller.startDebugging();

    assert.equal(result.ok, true);
    assert.equal(saved, true);
    assert.equal(
        launchRequest.configuration.program,
        "/workspace/a.clrs"
    );
    assert.equal(
        launchRequest.configuration
            .__clrsDocumentVersion,
        9
    );
    assert.equal(
        launchRequest.configuration
            .stopOnEntry,
        true
    );
});

test("la fábrica entrega adaptadores DAP en memoria y los libera", () => {
    const traceService =
        new ExecutionTraceService();
    const vscode = {
        EventEmitter: TestEventEmitter,
        DebugAdapterInlineImplementation:
            class DebugAdapterInlineImplementation {
                constructor(implementation) {
                    this.implementation =
                        implementation;
                }
            }
    };
    const factory =
        new CLRSDebugAdapterFactory({
            vscodeApi: vscode,
            executionTraceService:
                traceService,
            launchProgram() {},
            logger: silentLogger()
        });
    const descriptor =
        factory.createDebugAdapterDescriptor();

    assert.ok(
        descriptor.implementation instanceof
            CLRSDebugAdapter
    );
    assert.equal(factory.adapters.size, 1);

    factory.dispose();

    assert.equal(factory.adapters.size, 0);
    assert.equal(
        descriptor.implementation.disposed,
        true
    );
    traceService.dispose();
});

test("el manifiesto habilita breakpoints para archivos CLRS", () => {
    const manifest = JSON.parse(
        readFileSync(
            new URL(
                "../package.json",
                import.meta.url
            ),
            "utf8"
        )
    );

    assert.deepEqual(
        manifest.contributes.breakpoints,
        [{ language: "clrs-es" }]
    );
    assert.equal(
        manifest.contributes
            .debuggers[0]
            .configurationAttributes
            .launch.properties
            .stopOnEntry.default,
        true
    );
});

function request(seq, command, args) {
    return {
        seq,
        type: "request",
        command,
        ...(args === undefined
            ? {}
            : { arguments: args })
    };
}

function responseFor(messages, requestSeq) {
    return messages.find(message =>
        message.type === "response" &&
        message.request_seq === requestSeq
    );
}

function createMessageEmitter(messages) {
    return {
        disposed: false,
        event() {},
        fire(message) {
            messages.push(message);
        },
        dispose() {
            this.disposed = true;
        }
    };
}

function debugLocation(startLine) {
    return {
        startLine,
        startColumn: 1,
        endLine: startLine,
        endColumn: 5
    };
}

class TestEventEmitter {

    constructor() {
        this.event = () => {};
        this.disposed = false;
    }

    fire() {}

    dispose() {
        this.disposed = true;
    }
}

function silentLogger() {
    return {
        log() {},
        error() {}
    };
}
