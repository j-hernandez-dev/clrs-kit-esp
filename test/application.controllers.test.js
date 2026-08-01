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
    CodeCommandController
} from "../extension/controllers/CodeCommandController.js";
import {
    DiagramCommandController
} from "../extension/controllers/DiagramCommandController.js";
import {
    DiagramService
} from "../flow/src/services/DiagramService.js";

const sourceCode = [
    "PRINCIPAL()",
    "    dato <- 1",
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
        /async function PRINCIPAL/
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
        async save() {
            actions.push("save");
        }
    };
    const host = {
        getActiveDocument: () =>
            document,
        getWorkspaceRoot: () =>
            "workspace",
        runCli(interpreter, source) {
            actions.push([
                "run",
                interpreter,
                source
            ]);
        },
        async writeClipboard(text) {
            actions.push([
                "clipboard",
                text
            ]);
        },
        showGeneratedPath(outputPath) {
            actions.push([
                "output",
                outputPath
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

    assert.equal(runResult.ok, true);
    assert.equal(generateResult.ok, true);
    assert.equal(copyResult.ok, true);
    assert.equal(actions[0], "save");
    assert.equal(actions[1][0], "run");
    assert.equal(actions[2][0], "output");
    assert.deepEqual(
        actions[3],
        ["clipboard", "n"]
    );
    assert.deepEqual(
        messages,
        [
            "Ejecutando código.",
            "Generando código.",
            "Expresión copiada al portapapeles"
        ]
    );
});

test("DiagramCommandController gestiona panel, mensajes y limpieza", async () => {
    const messages = [];
    const resources = [];
    const panel = {
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
        dispose() {
            panel.disposed = true;
        }
    };
    const scheduled = [];
    const host = {
        getActiveDocument() {
            return {
                fileName:
                    "programa.clrs",
                getSource: () =>
                    sourceCode
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
            initialSourceDelay: 500
        });

    const opened =
        await controller.toggleDiagram({});
    scheduled[0]();
    const exported =
        await controller.exportSvg();
    const saved =
        await controller
            .handlePanelMessage({
                type: "svg",
                svg:
                    "<svg></svg>"
            });
    panel.disposeListener();

    assert.equal(opened.ok, true);
    assert.equal(exported.ok, true);
    assert.equal(saved.ok, true);
    assert.deepEqual(
        messages,
        [
            {
                type: "source",
                source: sourceCode
            },
            {
                type: "export-svg"
            }
        ]
    );
    assert.deepEqual(
        notices,
        [
            "Diagrama exportado correctamente."
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
