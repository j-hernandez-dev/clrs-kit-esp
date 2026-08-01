import test from "node:test";
import assert from "node:assert/strict";

import {
    applicationSuccess
} from "../src/application/ApplicationResult.js";
import {
    createCliApplication
} from "../src/application/composition/createCliApplication.js";
import {
    RunProgramUseCase
} from "../src/application/usecases/RunProgramUseCase.js";
import {
    ApplicationError
} from "../src/errors/ApplicationError.js";
import {
    createExtensionApplication
} from "../extension/composition/createExtensionApplication.js";
import {
    createWebviewApplication
} from "../flow/src/composition/createWebviewApplication.js";
import {
    DiagramModelStatus
} from "../flow/src/state/DiagramModelStore.js";

test("la raíz CLI comparte dependencias y aplica su configuración", async () => {
    const requests = [];
    const compilationService = {
        async tryRunSource(
            sourceCode,
            sourcePath
        ) {
            requests.push({
                sourceCode,
                sourcePath
            });

            return applicationSuccess({
                executed: true
            });
        }
    };
    const application =
        createCliApplication({
            compilationService,
            sourceFileReader: {
                async read() {
                    return "escribir 1";
                }
            },
            resolvePath:
                fileName =>
                    `/resolved/${fileName}`,
            logger: silentLogger(),
            config: {
                successExitCode: 7,
                failureExitCode: 9
            }
        });

    const execution =
        await application.execute([
            "programa.clrs"
        ]);

    assert.equal(execution.exitCode, 7);
    assert.equal(
        application
            .runProgramUseCase
            .compilationService,
        compilationService
    );
    assert.deepEqual(
        requests,
        [{
            sourceCode: "escribir 1",
            sourcePath:
                "/resolved/programa.clrs"
        }]
    );
    assert.equal(
        Object.isFrozen(
            application.config
        ),
        true
    );
});

test("la raíz de VS Code registra, comparte y libera toda la aplicación", () => {
    const fake = createFakeVSCode();
    const context = {
        extensionPath: "/extension",
        extensionUri: {
            path: "/extension"
        },
        subscriptions: []
    };
    const application =
        createExtensionApplication({
            vscodeApi: fake.api,
            context,
            config: {
                initialShowCost: false,
                terminalName:
                    "CLRS test",
                diagramInitialSourceDelay:
                    25
            }
        });

    assert.deepEqual(
        [...fake.commandHandlers.keys()],
        [
            "CLRS.runCode",
            "CLRS.copyCostExpression",
            "CLRS.toggleCost",
            "CLRS.generateCodeDiagram",
            "CLRS.generateCode",
            "CLRS.toggleDiagram",
            "CLRS.exportSVG"
        ]
    );
    assert.equal(
        application
            .providers
            .codeLens
            .analyzeCostUseCase,
        application.useCases.analyzeCost
    );
    assert.equal(
        application
            .providers
            .costDecorator
            .analyzeCostUseCase,
        application.useCases.analyzeCost
    );
    assert.equal(
        application
            .providers
            .staticDiagnostics
            .diagnosticsService,
        application
            .diagnosticsService
    );
    assert.equal(
        application.viewState.showCost,
        false
    );
    assert.equal(
        application.config
            .diagnosticsDebounceMs,
        300
    );
    assert.equal(
        application.hosts.code
            .terminalName,
        "CLRS test"
    );
    assert.equal(
        context.subscriptions[0],
        application
    );

    application.dispose();
    application.dispose();

    assert.ok(
        fake.disposables.every(
            item => item.disposed
        )
    );
    assert.equal(
        fake.decoration.disposed,
        true
    );
    assert.ok(
        fake.emitters.every(
            item => item.disposed
        )
    );
});

test("la raíz webview comparte caso de uso, store y bridge", () => {
    let disconnectCount = 0;
    const bridge = {
        connect() {
            return () => {};
        },
        disconnect() {
            disconnectCount += 1;
        }
    };
    const application =
        createWebviewApplication({
            bridge,
            config: {
                initialSourceCode:
                    "dato <- 1"
            }
        });
    const state =
        application.store
            .setSource("dato <- 1");

    assert.equal(
        application.store
            .generateDiagramUseCase,
        application
            .generateDiagramUseCase
    );
    assert.equal(
        state.status,
        DiagramModelStatus.READY
    );
    assert.equal(
        application.config
            .initialSourceCode,
        "dato <- 1"
    );

    application.dispose();
    application.dispose();

    assert.equal(disconnectCount, 1);
});

test("una composición incompleta falla con error estructurado", () => {
    assert.throws(
        () => new RunProgramUseCase(),
        error =>
            error instanceof
                ApplicationError &&
            error.code ===
                "CLRS_APPLICATION_CONFIGURATION_ERROR" &&
            error.diagnostics[0]
                .dependency ===
                "compilationService"
    );

    assert.throws(
        () =>
            createExtensionApplication({
                vscodeApi: {},
                context: {
                    subscriptions: []
                }
            }),
        error =>
            error instanceof
                ApplicationError &&
            error.code ===
                "CLRS_APPLICATION_CONFIGURATION_ERROR"
    );
});

function silentLogger() {
    return {
        log() {},
        error() {}
    };
}

function createFakeVSCode() {
    const commandHandlers =
        new Map();
    const disposables = [];
    const emitters = [];
    const disposable = () => {
        const item = {
            disposed: false,
            dispose() {
                item.disposed = true;
            }
        };

        disposables.push(item);

        return item;
    };
    const decoration = disposable();

    class EventEmitter {

        constructor() {
            this.disposed = false;
            this.event = () => {};
            emitters.push(this);
        }

        fire() {}

        dispose() {
            this.disposed = true;
        }
    }

    class ThemeColor {

        constructor(id) {
            this.id = id;
        }
    }

    return {
        commandHandlers,
        disposables,
        emitters,
        decoration,
        api: {
            commands: {
                registerCommand(
                    command,
                    handler
                ) {
                    commandHandlers.set(
                        command,
                        handler
                    );
                    return disposable();
                }
            },
            languages: {
                registerCodeLensProvider() {
                    return disposable();
                },
                createDiagnosticCollection() {
                    const collection =
                        disposable();

                    collection.set =
                        () => {};
                    collection.delete =
                        () => {};
                    collection.clear =
                        () => {};

                    return collection;
                }
            },
            window: {
                activeTextEditor: null,
                terminals: [],
                showInformationMessage() {},
                showErrorMessage() {},
                createTextEditorDecorationType() {
                    return decoration;
                },
                onDidChangeActiveTextEditor() {
                    return disposable();
                },
                onDidChangeVisibleTextEditors() {
                    return disposable();
                }
            },
            workspace: {
                workspaceFolders: [],
                textDocuments: [],
                onDidOpenTextDocument() {
                    return disposable();
                },
                onDidChangeTextDocument() {
                    return disposable();
                },
                onDidSaveTextDocument() {
                    return disposable();
                },
                onDidCloseTextDocument() {
                    return disposable();
                }
            },
            env: {
                clipboard: {
                    async writeText() {}
                }
            },
            EventEmitter,
            ThemeColor,
            DecorationRangeBehavior: {
                OpenClosed: 1
            },
            ViewColumn: {
                Beside: 2
            }
        }
    };
}
