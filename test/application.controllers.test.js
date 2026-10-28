import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
    applicationFailure,
    applicationSuccess
} from "../src/application/ApplicationResult.js";
import {
    CliController
} from "../src/application/controllers/CliController.js";
import {
    ConsolePresenter
} from "../src/application/presenters/ConsolePresenter.js";
import {
    WebviewPresenter
} from "../src/application/presenters/WebviewPresenter.js";
import {
    AnalyzeCostUseCase
} from "../src/application/usecases/AnalyzeCostUseCase.js";
import {
    GenerateDiagramUseCase
} from "../src/application/usecases/GenerateDiagramUseCase.js";
import {
    GenerateJavaScriptUseCase
} from "../src/application/usecases/GenerateJavaScriptUseCase.js";
import {
    RunProgramUseCase
} from "../src/application/usecases/RunProgramUseCase.js";
import {
    CompilationService
} from "../src/compiler/services/CompilationService.js";
import {
    ApplicationError
} from "../src/errors/ApplicationError.js";
import {
    ExecutionTraceService
} from "../src/runtime/ExecutionTraceService.js";
import {
    CodeCommandController
} from "../extension/controllers/CodeCommandController.js";
import {
    DiagramCommandController
} from "../extension/controllers/DiagramCommandController.js";
import {
    DiagramService
} from "../frontend/src/services/DiagramService.js";

const sourceCode = [
    "PRINCIPAL()",
    "    dato = 1",
    "    escribir dato"
].join("\n");

test("los cuatro casos de uso comparten el mismo contrato integral", async () => {
    const writtenArtifacts = [];
    const compilationService =
        new CompilationService({
            fileEmitter: {
                async writeArtifact(artifact) {
                    writtenArtifacts.push(
                        artifact
                    );
                    return artifact;
                }
            },
            projectExporter: {
                async export(artifact) {
                    writtenArtifacts.push(
                        artifact
                    );
                    return artifact;
                }
            },
            programRunner: {
                async run(request) {
                    return {
                        ok: true,
                        exitCode: 0,
                        programPath:
                            request.programPath
                    };
                }
            }
        });
    const generate =
        new GenerateJavaScriptUseCase({
            compilationService
        });
    const run = new RunProgramUseCase({
        compilationService
    });
    const analyze =
        new AnalyzeCostUseCase({
            compilationService
        });
    const diagram =
        new GenerateDiagramUseCase({
            diagramService:
                new DiagramService()
        });
    const request = {
        sourceCode,
        sourcePath: "integral.clrs"
    };

    const generated =
        await generate.execute(request);
    const executed =
        await run.execute(request);
    const analyzed =
        analyze.execute(request);
    const diagrammed =
        diagram.execute(request);

    assert.equal(generated.ok, true);
    assert.match(
        generated.value.generatedCode,
        /async function \$clrs\$0\$f\$5052494e434950414c/
    );
    assert.equal(executed.ok, true);
    assert.equal(
        executed.value.execution.exitCode,
        0
    );
    assert.equal(analyzed.ok, true);
    assert.equal(
        analyzed.value.statementsCost.length,
        1
    );
    assert.equal(diagrammed.ok, true);
    assert.ok(
        diagrammed.value.diagram
            .subgraphs.some(
                item =>
                    item.id ===
                    "function_PRINCIPAL"
            )
    );
    assert.equal(
        writtenArtifacts.length,
        2
    );
});

test("los casos de uso propagan el mismo error sintáctico", async () => {
    const compilationService =
        new CompilationService({
            fileEmitter: {
                async writeArtifact(artifact) {
                    return artifact;
                }
            }
        });
    const invalidRequest = {
        sourceCode: "si",
        sourcePath: "invalido.clrs"
    };
    const results = [
        await new GenerateJavaScriptUseCase({
            compilationService
        }).execute(invalidRequest),
        await new RunProgramUseCase({
            compilationService
        }).execute(invalidRequest),
        new AnalyzeCostUseCase({
            compilationService
        }).execute(invalidRequest),
        new GenerateDiagramUseCase({
            diagramService:
                new DiagramService()
        }).execute(invalidRequest)
    ];

    for (const result of results) {
        assert.equal(result.ok, false);
        assert.equal(
            result.errors[0].phase,
            "parser"
        );
    }
});

test("CliController traduce archivo, resultado y código de salida", async () => {
    const presented = [];
    const controller = new CliController({
        sourceFileReader: {
            async read(sourcePath) {
                assert.equal(
                    sourcePath,
                    path.resolve(
                        "programa.clrs"
                    )
                );
                return sourceCode;
            }
        },
        runProgramUseCase: {
            async execute(request) {
                return applicationSuccess(
                    request
                );
            }
        },
        presenter: {
            present(result) {
                presented.push(result);
                return result.ok ? 0 : 1;
            }
        },
        resolvePath: path.resolve
    });

    const execution =
        await controller.execute([
            "programa.clrs"
        ]);
    const missing =
        await controller.execute([]);

    assert.equal(execution.exitCode, 0);
    assert.equal(
        execution.result.value.sourceCode,
        sourceCode
    );
    assert.equal(missing.exitCode, 1);
    assert.ok(
        missing.result.errors[0]
        instanceof ApplicationError
    );
    assert.equal(presented.length, 2);
});

test("CodeCommandController coordina terminal, generación y portapapeles", async () => {
    const actions = [];
    const document = {
        filePath:
            path.join(
                "proyecto",
                "programa.clrs"
            ),
        getText: () => sourceCode,
        version: 7,
        async save() {
            actions.push("save");
        }
    };
    const host = {
        getActiveDocument: () =>
            document,
        getWorkspaceRoot: () =>
            "workspace",
        runCli(interpreter, source, options) {
            actions.push([
                "run",
                interpreter,
                source,
                options
            ]);
        },
        stopExecution() {
            return true;
        },
        async writeClipboard(text) {
            actions.push([
                "clipboard",
                text
            ]);
        },
        showGeneratedPath(outputPath, artifact) {
            actions.push([
                "output",
                outputPath,
                artifact
            ]);
        }
    };
    const messages = [];
    const presenter = {
        info(message) {
            messages.push(message);
        },
        present(result) {
            return result;
        }
    };
    const controller =
        new CodeCommandController({
            host,
            presenter,
            generateJavaScriptUseCase: {
                async execute(request) {
                    return applicationSuccess({
                        outputPath:
                            path.join(
                                "workspace",
                                ".clrs",
                                "js",
                                "programa.js"
                            ),
                        request
                    });
                }
            },
            path
        });

    const runResult =
        await controller.runProgram(
            "extension"
        );
    const generateResult =
        await controller
            .generateJavaScript();
    const copyResult =
        await controller
            .copyCostExpression("n");
    const stopResult =
        controller.stopProgram();

    assert.equal(runResult.ok, true);
    assert.equal(generateResult.ok, true);
    assert.equal(copyResult.ok, true);
    assert.equal(stopResult.ok, true);
    assert.equal(
        stopResult.value.stopped,
        true
    );
    assert.equal(actions[0], "save");
    assert.equal(actions[1][0], "run");
    assert.deepEqual(
        actions[1][3],
        { documentVersion: 7 }
    );
    assert.equal(actions[2][0], "output");
    assert.equal(
        actions[2][1],
        path.join(
            "workspace",
            ".clrs",
            "js",
            "programa.js"
        )
    );
    assert.equal(
        actions[2][2].request.sourcePath,
        document.filePath
    );
    assert.deepEqual(
        actions[3],
        ["clipboard", "n"]
    );
    assert.deepEqual(
        messages,
        [
            "Ejecutando código.",
            "Generando código.",
            "Expresión copiada al portapapeles",
            "Ejecución de código CLRS detenida."
        ]
    );
});

test("CodeCommandController ejecuta un documento enlazado sin depender del editor activo", async () => {
    const actions = [];
    const linkedDocument = {
        filePath: path.join(
            "proyecto",
            "enlazado.clrs"
        ),
        version: 12,
        async save() {
            actions.push("save-linked");
            return true;
        }
    };
    const controller =
        new CodeCommandController({
            host: {
                getActiveDocument: () => null,
                getWorkspaceRoot: () => null,
                runCli(
                    interpreter,
                    source,
                    options
                ) {
                    actions.push({
                        interpreter,
                        source,
                        options
                    });
                },
                stopExecution() {
                    return false;
                },
                async writeClipboard() {},
                showGeneratedPath() {}
            },
            presenter: {
                info(message) {
                    actions.push(message);
                },
                present(result) {
                    return result;
                }
            },
            generateJavaScriptUseCase: {
                async execute() {
                    return applicationSuccess({});
                }
            },
            path
        });

    const result = await controller.runDocument(
        "extension",
        linkedDocument
    );

    assert.equal(result.ok, true);
    assert.equal(actions[0], "save-linked");
    assert.equal(
        actions[1].source,
        linkedDocument.filePath
    );
    assert.deepEqual(
        actions[1].options,
        { documentVersion: 12 }
    );
    assert.equal(
        actions[2],
        "Ejecutando código."
    );
});

test("DiagramCommandController gestiona panel, mensajes y limpieza", async () => {
    const messages = [];
    const resources = [];
    const panel = {
        revealCount: 0,
        async postMessage(message) {
            messages.push(message);
        },
        onMessage(listener) {
            panel.messageListener =
                listener;
            return disposable(resources);
        },
        onDispose(listener) {
            panel.disposeListener =
                listener;
            return disposable(resources);
        },
        reveal() {
            panel.revealCount += 1;
        },
        dispose() {
            panel.disposed = true;
        }
    };
    const scheduled = [];
    const revealedLocations = [];
    const savedDocuments = [];
    const executedDocuments = [];
    let stoppedExecutions = 0;
    const selection = {
        startLine: 2,
        startColumn: 5,
        endLine: 2,
        endColumn: 5
    };
    const host = {
        getActiveDocument() {
            return {
                fileName:
                    "programa.clrs",
                getSource: () =>
                    sourceCode,
                getSourceOrigin: () => ({
                    startLine: 1,
                    startColumn: 1
                }),
                isWholeDocument: () => true,
                getSelection: () =>
                    selection
            };
        },
        createPanel: () => panel,
        schedule(callback) {
            scheduled.push(callback);
            return disposable(resources);
        },
        onDocumentChange() {
            return disposable(resources);
        },
        onSelectionChange() {
            return disposable(resources);
        },
        async revealLocation(
            document,
            location
        ) {
            revealedLocations.push(
                location
            );
            return true;
        },
        async saveDocument(document) {
            savedDocuments.push(document.fileName);
            return true;
        },
        async saveSvg(svg) {
            assert.equal(
                svg,
                "<svg></svg>"
            );
            return true;
        }
    };
    const notices = [];
    const presenter = {
        info(message) {
            notices.push(message);
        },
        present(result) {
            return result;
        }
    };
    const controller =
        new DiagramCommandController({
            host,
            presenter,
            executionTraceService: {
                getSnapshot() {
                    return null;
                },
                subscribe() {
                    return disposable(
                        resources
                    );
                }
            },
            async executeDocument(document) {
                executedDocuments.push(document);
                return applicationSuccess({
                    sourcePath: document.fileName
                });
            },
            stopDocument() {
                stoppedExecutions += 1;
                return applicationSuccess({
                    stopped: true
                });
            },
            initialSourceDelay: 500
        });

    const opened =
        await controller.toggleDiagram({});
    await panel.messageListener({
        type: "webview-ready"
    });
    await panel.messageListener({
        type: "webview-ready"
    });
    const exported =
        await controller.exportSvg();
    const navigated =
        await controller
            .handlePanelMessage({
                type: "navigate",
                location: selection
            });
    const saved =
        await controller
            .handlePanelMessage({
                type: "svg",
                svg:
                    "<svg></svg>"
            });
    const savedDocument =
        await controller
            .handlePanelMessage({
                type: "save-document"
            });
    const executedDocument =
        await controller
            .handlePanelMessage({
                type: "execute-document"
            });
    const stoppedDocument =
        await controller
            .handlePanelMessage({
                type: "stop-document"
            });
    const ignoredDebugCommand =
        await controller
            .handlePanelMessage({
                type: "debug-command",
                action: "next"
            });
    panel.disposeListener();
    controller.dispose();

    assert.equal(opened.ok, true);
    assert.equal(exported.ok, true);
    assert.equal(saved.ok, true);
    assert.equal(
        savedDocument.value.saved,
        true
    );
    assert.equal(executedDocument.ok, true);
    assert.equal(stoppedDocument.ok, true);
    assert.equal(stoppedExecutions, 1);
    assert.equal(
        ignoredDebugCommand.value.ignored,
        true
    );
    assert.equal(
        navigated.value.navigated,
        true
    );
    assert.deepEqual(
        revealedLocations,
        [selection]
    );
    assert.deepEqual(
        savedDocuments,
        ["programa.clrs"]
    );
    assert.equal(executedDocuments.length, 1);
    assert.equal(
        executedDocuments[0].fileName,
        "programa.clrs"
    );
    assert.deepEqual(
        messages,
        [
            {
                type: "source",
                source: sourceCode,
                sourceOrigin: {
                    startLine: 1,
                    startColumn: 1
                },
                documentVersion: null,
                wholeDocument: true,
                semanticDiagnostics: [],
                selection
            },
            {
                type: "source",
                source: sourceCode,
                sourceOrigin: {
                    startLine: 1,
                    startColumn: 1
                },
                documentVersion: null,
                wholeDocument: true,
                semanticDiagnostics: [],
                selection
            },
            {
                type: "export-svg"
            }
        ]
    );
    assert.deepEqual(
        notices,
        [
            "Diagrama exportado correctamente.",
            "Archivo CLRS guardado."
        ]
    );
    assert.ok(
        resources.every(
            resource =>
                resource.disposed
        )
    );
    assert.equal(
        panel.disposed,
        undefined
    );
});

test("DiagramCommandController conserva el panel vinculado al documento", async () => {
    const resources = [];
    const document = {
        documentUri: "file:///programa.clrs",
        fileName: "programa.clrs",
        getSource: () => sourceCode,
        getSourceOrigin: () => ({
            startLine: 1,
            startColumn: 1
        }),
        getSelection: () => null
    };
    let activeDocument = document;
    let createdPanels = 0;
    const panel = {
        revealCount: 0,
        postMessage() {
            return true;
        },
        onMessage() {
            return disposable(resources);
        },
        onDispose() {
            return disposable(resources);
        },
        reveal() {
            panel.revealCount += 1;
        },
        dispose() {
            panel.disposed = true;
        }
    };
    const controller =
        new DiagramCommandController({
            host: {
                getActiveDocument: () =>
                    activeDocument,
                createPanel() {
                    createdPanels += 1;
                    return panel;
                },
                schedule: () =>
                    disposable(resources),
                onDocumentChange: () =>
                    disposable(resources),
                onSelectionChange: () =>
                    disposable(resources),
                revealLocation: async () => true,
                saveDocument: async () => true,
                saveSvg: async () => true
            },
            presenter: {
                present() {},
                info() {}
            },
            executionTraceService: {
                getSnapshot: () => null,
                subscribe: () =>
                    disposable(resources)
            },
            initialSourceDelay: 0
        });

    const opened =
        await controller.toggleDiagram({});
    const reused =
        await controller.toggleDiagram({});

    activeDocument = null;

    const revealedWithoutEditor =
        await controller.toggleDiagram({});

    assert.equal(opened.value.reused, false);
    assert.equal(reused.value.reused, true);
    assert.equal(
        revealedWithoutEditor.value.reused,
        true
    );
    assert.equal(createdPanels, 1);
    assert.equal(panel.revealCount, 2);

    controller.dispose();
});

test("DiagramCommandController adjunta diagnósticos semánticos sin bloquear la fuente", () => {
    const messages = [];
    const resources = [];
    const rawDocument = {
        uri: {
            toString: () =>
                "file:///semantica.clrs"
        },
        version: 7,
        getText: () =>
            "PRINCIPAL()\n    escribir ausente"
    };
    const document = {
        document: rawDocument,
        version: 7,
        getSource: () => rawDocument.getText(),
        getSourceOrigin: () => ({
            startLine: 1,
            startColumn: 1
        }),
        isWholeDocument: () => true,
        getSelection: () => null
    };
    const controller =
        new DiagramCommandController({
            host: {
                getActiveDocument: () => document,
                createPanel: () => null,
                schedule: () =>
                    disposable(resources),
                onDocumentChange: () =>
                    disposable(resources),
                onSelectionChange: () =>
                    disposable(resources),
                revealLocation: async () => true,
                saveDocument: async () => true,
                saveSvg: async () => true
            },
            presenter: {
                present() {},
                info() {}
            },
            executionTraceService: {
                getSnapshot: () => null,
                subscribe: () =>
                    disposable(resources)
            },
            documentAnalysisService: {
                analyzeDocument(received) {
                    assert.equal(
                        received,
                        rawDocument
                    );

                    return {
                        diagnostics: [
                            {
                                code:
                                    "CLRS_SEMANTIC_UNDEFINED",
                                message:
                                    "El identificador no está definido.",
                                phase: "semantic",
                                severity: "error",
                                location: {
                                    startLine: 2,
                                    startColumn: 14
                                }
                            },
                            {
                                code: "CLRS_PARSER_TEST",
                                message: "Sintaxis inválida.",
                                phase: "parser"
                            }
                        ]
                    };
                }
            },
            initialSourceDelay: 0
        });

    controller.postSource(
        {
            postMessage(message) {
                messages.push(message);
            }
        },
        document
    );
    controller.dispose();

    assert.equal(messages.length, 1);
    assert.equal(
        messages[0].source,
        rawDocument.getText()
    );
    assert.deepEqual(
        messages[0].semanticDiagnostics,
        [{
            code: "CLRS_SEMANTIC_UNDEFINED",
            message:
                "El identificador no está definido.",
            phase: "semantic",
            severity: "error",
            location: {
                startLine: 2,
                startColumn: 14
            }
        }]
    );
});

test("DiagramCommandController aplica una edición correlacionada y responde al Webview", async () => {
    const panelMessages = [];
    const appliedPlans = [];
    const notices = [];
    const document = {
        version: 9,
        fileName: "programa.clrs",
        getSource: () =>
            "PRINCIPAL()\n    dato = 1",
        getSourceOrigin: () => ({
            startLine: 1,
            startColumn: 1
        }),
        getSelection: () => null
    };
    const panel = {
        postMessage(message) {
            panelMessages.push(message);
            return true;
        },
        onMessage(listener) {
            panel.listener = listener;
            return disposable([]);
        },
        onDispose() {
            return disposable([]);
        },
        reveal() {},
        dispose() {}
    };
    const host = {
        getActiveDocument: () => document,
        createPanel: () => panel,
        schedule: () => disposable([]),
        onDocumentChange: () =>
            disposable([]),
        onSelectionChange: () =>
            disposable([]),
        revealLocation: async () => true,
        saveDocument: async () => true,
        saveSvg: async () => true,
        async applySourceEdits(
            selectedDocument,
            plan
        ) {
            assert.equal(
                selectedDocument,
                document
            );
            appliedPlans.push(plan);
            return true;
        }
    };
    const plan = {
        operation: "update-node",
        expectedDocumentVersion: 9,
        edits: [{
            startOffset: 16,
            endOffset: 24,
            expectedText: "dato = 1",
            newText: "dato = 2"
        }]
    };
    const controller =
        new DiagramCommandController({
            host,
            presenter: {
                info(message) {
                    notices.push(message);
                },
                present(result) {
                    return result;
                }
            },
            editingService: {
                plan(request) {
                    assert.equal(
                        request.documentVersion,
                        9
                    );
                    assert.equal(
                        request.expectedDocumentVersion,
                        9
                    );
                    return plan;
                }
            },
            executionTraceService: {
                getSnapshot: () => null,
                subscribe: () =>
                    disposable([])
            },
            initialSourceDelay: 0
        });

    await controller.toggleDiagram({});
    const result =
        await panel.listener({
            type: "diagram-edit",
            requestId: "diagram-edit-1",
            expectedDocumentVersion: 9,
            intent: {
                schemaVersion: 1
            }
        });

    assert.equal(result.ok, true);
    assert.deepEqual(appliedPlans, [plan]);
    assert.deepEqual(
        panelMessages.at(-1),
        {
            type: "diagram-edit-result",
            requestId: "diagram-edit-1",
            ok: true,
            operation: "update-node"
        }
    );
    assert.deepEqual(
        notices,
        [
            "Figura actualizada en el código fuente."
        ]
    );

    controller.dispose();
});

test("DiagramCommandController agrupa y reenvía pasos de ejecución", async () => {
    const messages = [];
    const traceService =
        new ExecutionTraceService();
    const disposableResource = {
        dispose() {}
    };
    const panel = {
        postMessage(message) {
            messages.push(message);
            return Promise.resolve(true);
        },
        onMessage() {
            return disposableResource;
        },
        onDispose() {
            return disposableResource;
        },
        dispose() {}
    };
    const document = {
        fileName: "programa.clrs",
        matchesExecutionTrace: () => true,
        getSource: () => sourceCode,
        getSourceOrigin: () => ({
            startLine: 1,
            startColumn: 1
        }),
        getSelection: () => null
    };
    const controller =
        new DiagramCommandController({
            host: {
                getActiveDocument: () =>
                    document,
                createPanel: () => panel,
                schedule: () =>
                    disposableResource,
                onDocumentChange: () =>
                    disposableResource,
                onSelectionChange: () =>
                    disposableResource,
                revealLocation: async () => true,
                saveDocument: async () => true,
                saveSvg: async () => true
            },
            presenter: {
                present() {},
                info() {}
            },
            executionTraceService:
                traceService,
            initialSourceDelay: 0
        });

    await controller.toggleDiagram({});

    const trace = traceService.start({
        sourcePath: "programa.clrs",
        documentVersion: 1
    });

    traceService.accept(trace.traceId, {
        type: "location",
        location: {
            startLine: 2,
            startColumn: 5
        }
    });
    traceService.accept(trace.traceId, {
        type: "location",
        location: {
            startLine: 3,
            startColumn: 5
        }
    });
    traceService.accept(trace.traceId, {
        type: "end",
        status: "correct"
    });

    assert.deepEqual(
        messages.map(message =>
            message.event?.type
        ),
        ["start", "steps", "end"]
    );
    assert.equal(
        messages[1].event.steps.length,
        2
    );

    controller.dispose();
    traceService.dispose();
});

test("DiagramCommandController publica y descarta cobertura según la versión enlazada", async () => {
    const messages = [];
    let coverageListener = null;
    let snapshot = {
        revision: 1,
        sourcePath: "programa.clrs",
        documentVersion: 3,
        coverage: {
            complete: true,
            truncated: false,
            testCount: 1,
            evidenceTestCount: 1,
            summary: {
                totalPoints: 1,
                coveredPoints: 1
            },
            points: [{
                pointId: "statement:2",
                kind: "statement",
                name: null,
                location: {
                    sourcePath: "programa.clrs",
                    startLine: 2,
                    startColumn: 5,
                    endLine: 2,
                    endColumn: 12
                },
                hitCount: 1,
                outcomeCounts: {
                    true: 0,
                    false: 0
                }
            }]
        }
    };
    const resource = { dispose() {} };
    const panel = {
        postMessage(message) {
            messages.push(message);
            return true;
        },
        onMessage: () => resource,
        onDispose: () => resource,
        dispose() {}
    };
    const document = {
        fileName: "programa.clrs",
        filePath: "programa.clrs",
        version: 3,
        getSource: () => sourceCode,
        getSourceOrigin: () => ({
            startLine: 1,
            startColumn: 1
        }),
        getSelection: () => null,
        matchesTestCoverage(candidate) {
            return candidate.sourcePath ===
                this.filePath &&
                candidate.documentVersion ===
                this.version;
        }
    };
    const controller = new DiagramCommandController({
        host: {
            getActiveDocument: () => document,
            createPanel: () => panel,
            schedule: callback => {
                callback();
                return resource;
            },
            onDocumentChange: () => resource,
            onSelectionChange: () => resource,
            revealLocation: async () => true,
            saveDocument: async () => true,
            saveSvg: async () => true
        },
        presenter: {
            present() {},
            info() {}
        },
        executionTraceService: {
            getSnapshot: () => null,
            subscribe: () => resource
        },
        testCoverageStore: {
            getSnapshot: () => snapshot,
            subscribe(listener) {
                coverageListener = listener;
                return resource;
            }
        },
        initialSourceDelay: 0
    });

    await controller.toggleDiagram({});

    const projected = messages.findLast(message =>
        message.type === "test-coverage"
    );

    assert.equal(projected.coverage.revision, 1);
    assert.equal(
        projected.coverage.points[0].hitCount,
        1
    );

    document.version = 4;
    snapshot = {
        ...snapshot,
        revision: 2
    };
    coverageListener(snapshot);

    assert.equal(
        messages.findLast(message =>
            message.type === "test-coverage"
        ).coverage,
        null
    );

    controller.dispose();
});

test("los presentadores traducen resultados sin conocer casos de uso", () => {
    const consoleMessages = [];
    const consolePresenter =
        new ConsolePresenter({
            logger: {
                log(message) {
                    consoleMessages.push(
                        message
                    );
                },
                error(message) {
                    consoleMessages.push(
                        message
                    );
                }
            }
        });
    const posted = [];
    const webviewPresenter =
        new WebviewPresenter({
            postMessage(message) {
                posted.push(message);
                return true;
            }
        });
    const failure =
        applicationFailure(
            ApplicationError
                .invalidRequest(
                    "Solicitud inválida."
                )
        );

    assert.equal(
        consolePresenter.present(failure),
        1
    );
    webviewPresenter.present(
        failure,
        "analysis-result"
    );

    assert.match(
        consoleMessages[0],
        /Solicitud inválida/
    );
    assert.equal(
        posted[0].type,
        "analysis-result"
    );
    assert.equal(posted[0].ok, false);
    assert.equal(
        posted[0].errors[0].phase,
        "application"
    );
});

function disposable(resources) {
    const resource = {
        disposed: false,
        dispose() {
            resource.disposed = true;
        }
    };

    resources.push(resource);

    return resource;
}
