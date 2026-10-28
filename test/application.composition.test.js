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
    listBrokerLLMProviderDescriptors
} from "../src/broker95/llm/index.js";
import {
    BROKER_GAME_SCHEMA_VERSION
} from "../src/broker95/core/index.js";
import {
    createExtensionApplication
} from "../extension/composition/createExtensionApplication.js";
import {
    createWebviewApplication
} from "../frontend/src/composition/createWebviewApplication.js";
import {
    DiagramModelStatus
} from "../frontend/src/state/DiagramModelStore.js";

const IMPLEMENTED_BROKER_PROVIDER_IDS =
    Object.freeze([
        "groq",
        "gemini",
        "deepseek",
        "ollama",
        "openai",
        "lm-studio",
        "xai",
        "together",
        "zai",
        "hugging-face",
        "openrouter"
    ]);

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

test("la raíz de VS Code registra, comparte y libera toda la aplicación", async () => {
    const fake = createFakeVSCode();
    const globalState =
        createFakeGlobalState();
    const secrets = createFakeSecrets();
    const context = {
        extensionPath: "/extension",
        extensionUri: {
            path: "/extension"
        },
        globalState,
        secrets,
        subscriptions: []
    };
    const application =
        createExtensionApplication({
            vscodeApi: fake.api,
            context,
            loadBrokerWebviewHtml() {
                return "<!doctype html><html><body>BROKER.95</body></html>";
            },
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
            "CLRS.stopCode",
            "CLRS.copyCostExpression",
            "CLRS.toggleCost",
            "CLRS.generateCodeDiagram",
            "CLRS.generateCode",
            "CLRS.toggleDiagram",
            "CLRS.exportSVG",
            "CLRS.showComplexityReport",
            "CLRS.playBroker95",
            "CLRS.debugCode",
            "CLRS.formatDocument",
            "CLRS.explainCorrection",
            "CLRS.openWalkthrough",
            "CLRS.createFirstProgram",
            "CLRS.createFirstTestSuite",
            "CLRS.createExampleProject",
            "CLRS.createGuiProject",
            "CLRS.openContextualStart",
            "CLRS.installCopilotCliSupport"
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
            .codeLens
            .documentAnalysisService,
        application
            .documentAnalysisService
    );
    assert.equal(
        application.registrations
            .gettingStarted
            .walkthroughId,
        "clrsGettingStarted"
    );
    assert.equal(
        application.registrations
            .contextualStart.commandId,
        "CLRS.openContextualStart"
    );
    assert.equal(
        application.registrations
            .copilot.commandId,
        "CLRS.installCopilotCliSupport"
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
            .costDecorator
            .documentAnalysisService,
        application
            .documentAnalysisService
    );
    assert.equal(
        application
            .providers
            .codeActions
            .correctionPlanner,
        application.correctionPlanner
    );
    assert.equal(
        application
            .providers
            .codeActions
            .explanationPlanner,
        application
            .correctionExplanationPlanner
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
        application
            .providers
            .staticDiagnostics
            .documentAnalysisService,
        application
            .documentAnalysisService
    );
    assert.equal(
        application
            .providers
            .staticDiagnostics
            .derivedDiagnosticsService,
        application
            .callGraphDiagnosticsService
    );
    assert.equal(
        application
            .providers
            .symbolNavigation
            .documentAnalysisService,
        application
            .documentAnalysisService
    );
    assert.equal(
        application
            .providers
            .intelligence
            .documentAnalysisService,
        application
            .documentAnalysisService
    );
    assert.equal(
        application
            .providers
            .intelligence
            .intelligenceService,
        application
            .languageIntelligenceService
    );
    assert.equal(
        application
            .providers
            .semanticTokens
            .documentAnalysisService,
        application
            .documentAnalysisService
    );
    assert.equal(
        application
            .providers
            .semanticTokens
            .semanticTokenService,
        application.semanticTokenService
    );
    assert.equal(
        application
            .providers
            .rename
            .documentAnalysisService,
        application
            .documentAnalysisService
    );
    assert.equal(
        application
            .providers
            .rename
            .renameService,
        application.renameService
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
        application.hosts.code
            .executionTraceService,
        application.executionTraceService
    );
    assert.equal(
        application.controllers.diagram
            .executionTraceService,
        application.executionTraceService
    );
    assert.equal(
        application.controllers
            .complexityReport
            .documentAnalysisService,
        application.documentAnalysisService
    );
    assert.equal(
        application.registrations
            .complexityReport
            .controller,
        application.controllers
            .complexityReport
    );
    assert.equal(
        application.registrations
            .broker.controller,
        application.controllers.broker
    );
    assert.equal(
        application.controllers.broker
            .host,
        application.hosts.broker
    );
    assert.equal(
        application.controllers.broker
            .economy,
        application.broker95.economy
    );
    assert.equal(
        typeof application.broker95
            .economy.purchase,
        "function"
    );
    assert.equal(
        application.controllers.broker
            .conversation,
        undefined
    );
    assert.equal(
        typeof application.broker95
            .conversationService.chat,
        "function"
    );
    assert.equal(
        application.broker95
            .documentCapture
            .documentAnalysisService,
        application.documentAnalysisService
    );
    assert.equal(
        application.hosts
            .brokerDocument
            .languageId,
        application.config.languageId
    );
    assert.equal(
        application.broker95
            .testExecution
            .documentCapture,
        application.broker95.documentCapture
    );
    assert.equal(
        application.broker95
            .staticEvidence
            .documentCapture,
        application.broker95.documentCapture
    );
    assert.equal(
        application.broker95
            .staticEvidence
            .documentAnalysisService,
        application.documentAnalysisService
    );
    assert.equal(
        application.broker95
            .testExecution
            .documentAnalysisService,
        application.documentAnalysisService
    );
    assert.equal(
        application.broker95
            .submissionReview
            .documentCapture,
        application.broker95.documentCapture
    );
    assert.equal(
        application.broker95
            .submissionReview
            .testExecution,
        application.broker95.testExecution
    );
    assert.equal(
        application.broker95
            .submissionReview
            .staticEvidence,
        application.broker95.staticEvidence
    );
    assert.equal(
        application.controllers.broker
            .submissionReview,
        application.broker95.submissionReview
    );
    assert.equal(
        application.broker95
            .submissionEvaluation
            .documentCapture,
        application.broker95.documentCapture
    );
    assert.equal(
        application.broker95
            .submissionEvaluation
            .testExecution,
        application.broker95.testExecution
    );
    assert.equal(
        application.broker95
            .submissionEvaluation
            .staticEvidence,
        application.broker95.staticEvidence
    );
    assert.equal(
        application.broker95
            .submissionPush
            .documentCapture,
        application.broker95.documentCapture
    );
    assert.equal(
        application.broker95
            .submissionPush
            .evaluation,
        application.broker95.submissionEvaluation
    );
    assert.equal(
        application.controllers.broker
            .submissionPush,
        application.broker95.submissionPush
    );
    assert.equal(
        application
            .providers
            .debugAdapterFactory
            .executionTraceService,
        application.debugExecutionTraceService
    );
    assert.notEqual(
        application.executionTraceService,
        application.debugExecutionTraceService
    );
    assert.equal(
        application.debugExecutionTraceService
            .traceIdPrefix,
        "debug-execution"
    );
    assert.equal(
        application.hosts.debugCode
            .executionTraceService,
        application.debugExecutionTraceService
    );
    await application.testing.ready;
    assert.equal(
        application.testing.discovery,
        application.testing.controller.discovery
    );
    assert.equal(
        application.testing.workspace,
        application.testing.controller.workspace
    );
    assert.equal(fake.testControllers.length, 0);
    assert.equal(
        application.testing.controller
            .isActive,
        false
    );
    assert.equal(
        application.testing.executor
            .documentAnalysisService,
        application.documentAnalysisService
    );
    assert.equal(
        application.testing.executor
            .javaScriptGenerator,
        application.compilationService.generator
    );
    assert.equal(
        application.testing.runController
            .resultPresenter,
        application.testing.resultPresenter
    );
    assert.equal(
        application.broker95.testExecution
            .programRunner.runner,
        application.testing.processRunner
    );
    assert.equal(
        application.testing.runProfile,
        null
    );
    assert.equal(
        application.testing.debugProfile,
        null
    );
    assert.equal(
        application.testing.debugController
            .executionTraceService,
        application.debugExecutionTraceService
    );
    assert.equal(
        application
            .registrations
            .debugging
            .controller,
        application.controllers.debug
    );
    assert.equal(
        context.subscriptions[0],
        application
    );
    const brokerLoad =
        await application.broker95.ready;

    assert.equal(
        brokerLoad.source,
        "created"
    );
    assert.equal(
        application.broker95
            .session.getState()
            .schemaVersion,
        BROKER_GAME_SCHEMA_VERSION
    );
    assert.equal(
        globalState.values.has(
            "broker95.gameState"
        ),
        true
    );
    const configurationLoad =
        await application.broker95
            .configurationReady;

    assert.equal(
        configurationLoad.source,
        "created"
    );
    assert.deepEqual(
        application.broker95
            .configuration.getSettings(),
        {
            providerId: "groq",
            providers:
                implementedBrokerProviders(),
            model: "",
            credential: {
                kind: "api-key",
                required: true,
                configured: false
            },
            hasApiKey: false,
            audio: {
                muted: false,
                volume: 45
            }
        }
    );
    assert.deepEqual(
        application.broker95
            .providerRegistry
            .listDescriptors(),
        implementedBrokerProviders()
    );
    assert.equal(
        application.broker95
            .configuration
            .resolvePrivateLlmSettings,
        undefined
    );
    assert.equal(
        typeof application.broker95.llm,
        "undefined"
    );
    assert.equal(
        application.lifecycle.resources
            .some(resource =>
                typeof resource
                    .resolvePrivateLlmSettings ===
                    "function"
            ),
        false
    );
    assert.equal(
        globalState.values.has(
            "broker95.settings"
        ),
        true
    );
    assert.equal(secrets.values.size, 0);
    const conversationLoad =
        await application.broker95
            .conversationReady;

    assert.equal(
        conversationLoad.source,
        "created"
    );
    assert.deepEqual(
        conversationLoad.summary,
        {
            revision: 0,
            turnCount: 0,
            messageCount: 0,
            totalCharacters: 0,
            limits: {
                maximumTurns: 48,
                maximumCharacters:
                    131072,
                maximumMessageCharacters:
                    65536
            }
        }
    );
    assert.deepEqual(
        application.broker95
            .conversation.getSummary(),
        conversationLoad.summary
    );
    assert.equal(
        application.broker95
            .conversation.getTurns,
        undefined
    );
    assert.equal(
        application.broker95
            .conversation.appendTurn,
        undefined
    );
    assert.equal(
        application.broker95
            .conversation.getLlmMessages,
        undefined
    );
    assert.equal(
        application.lifecycle.resources
            .some(resource =>
                typeof resource.appendTurn ===
                    "function"
            ),
        false
    );
    assert.equal(
        globalState.values.has(
            "broker95.conversation"
        ),
        true
    );
    const brokerOpen =
        fake.commandHandlers
            .get("CLRS.playBroker95")();

    assert.equal(brokerOpen.ok, true);
    assert.equal(
        brokerOpen.value.reused,
        false
    );
    assert.equal(
        fake.webviewPanels.length,
        1
    );
    assert.equal(
        fake.webviewPanels[0].viewType,
        "clrsBroker95"
    );
    assert.equal(
        fake.webviewPanels[0].title,
        "BROKER.95"
    );
    assert.equal(
        fake.webviewPanels[0]
            .options.enableScripts,
        true
    );
    assert.equal(
        fake.webviewPanels[0]
            .options.enableCommandUris,
        false
    );
    assert.equal(
        fake.webviewPanels[0]
            .options.retainContextWhenHidden,
        true
    );
    assert.deepEqual(
        fake.webviewPanels[0]
            .options.portMapping,
        []
    );
    assert.equal(
        fake.webviewPanels[0]
            .options.localResourceRoots.length,
        1
    );
    assert.match(
        fake.webviewPanels[0]
            .webview.html,
        /BROKER\.95/u
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
    assert.ok(
        fake.testControllers.every(
            item => item.disposed
        )
    );
});

function implementedBrokerProviders() {
    return listBrokerLLMProviderDescriptors()
        .filter(provider =>
            IMPLEMENTED_BROKER_PROVIDER_IDS
                .includes(provider.id)
        );
}

test("la raíz webview comparte caso de uso, store y bridge", () => {
    let disconnectCount = 0;
    const bridge = {
        connect() {
            return () => {};
        },
        navigateToLocation() {
            return true;
        },
        requestDiagramEdit() {
            return "diagram-edit-1";
        },
        requestDocumentSave() {
            return true;
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
                    "dato = 1"
            }
        });
    const state =
        application.store
            .setSource("dato = 1");

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
        "dato = 1"
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

function createFakeGlobalState() {
    const values = new Map();

    return {
        values,
        get(key) {
            return values.get(key);
        },
        async update(key, value) {
            if (value === undefined) {
                values.delete(key);
            } else {
                values.set(key, value);
            }
        }
    };
}

function createFakeSecrets() {
    const values = new Map();

    return {
        values,
        async get(key) {
            return values.get(key);
        },
        async store(key, value) {
            values.set(key, value);
        },
        async delete(key) {
            values.delete(key);
        }
    };
}

function createFakeVSCode() {
    const commandHandlers =
        new Map();
    const disposables = [];
    const emitters = [];
    const webviewPanels = [];
    const testControllers = [];
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

    class DebugAdapterInlineImplementation {

        constructor(implementation) {
            this.implementation =
                implementation;
        }
    }

    class SemanticTokensLegend {

        constructor(
            tokenTypes,
            tokenModifiers
        ) {
            this.tokenTypes = tokenTypes;
            this.tokenModifiers =
                tokenModifiers;
        }
    }

    class SemanticTokensBuilder {

        constructor() {
            this.entries = [];
        }

        push(...entry) {
            this.entries.push(entry);
        }

        build() {
            return {
                entries: this.entries
            };
        }
    }

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

    const Uri = {
        file(filePath) {
            return {
                path: filePath,
                fsPath: filePath,
                toString() {
                    return `file://${filePath}`;
                }
            };
        },
        joinPath(base, ...segments) {
            const root =
                base?.path ??
                base?.fsPath ??
                "";
            const joined = [
                root,
                ...segments
            ].join("/");

            return {
                path: joined,
                fsPath: joined
            };
        }
    };

    return {
        commandHandlers,
        disposables,
        emitters,
        decoration,
        webviewPanels,
        testControllers,
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
                },
                async executeCommand() {
                    return true;
                }
            },
            debug: {
                async startDebugging() {
                    return true;
                },
                async stopDebugging() {
                    return true;
                },
                onDidStartDebugSession() {
                    return disposable();
                },
                onDidTerminateDebugSession() {
                    return disposable();
                },
                registerDebugConfigurationProvider() {
                    return disposable();
                },
                registerDebugAdapterDescriptorFactory() {
                    return disposable();
                }
            },
            languages: {
                registerCodeLensProvider() {
                    return disposable();
                },
                registerDocumentSymbolProvider() {
                    return disposable();
                },
                registerDefinitionProvider() {
                    return disposable();
                },
                registerReferenceProvider() {
                    return disposable();
                },
                registerCallHierarchyProvider() {
                    return disposable();
                },
                registerCompletionItemProvider() {
                    return disposable();
                },
                registerHoverProvider() {
                    return disposable();
                },
                registerSignatureHelpProvider() {
                    return disposable();
                },
                registerInlayHintsProvider() {
                    return disposable();
                },
                registerDocumentSemanticTokensProvider() {
                    return disposable();
                },
                registerRenameProvider() {
                    return disposable();
                },
                registerDocumentFormattingEditProvider() {
                    return disposable();
                },
                registerCodeActionsProvider() {
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
                createWebviewPanel(
                    viewType,
                    title,
                    viewColumn,
                    options
                ) {
                    const disposeListeners = [];
                    const panel = {
                        viewType,
                        title,
                        viewColumn,
                        options,
                        revealCount: 0,
                        disposed: false,
                        webview: {
                            html: "",
                            cspSource:
                                "vscode-webview://test",
                            async postMessage() {
                                return true;
                            },
                            onDidReceiveMessage() {
                                return disposable();
                            }
                        },
                        onDidDispose(listener) {
                            disposeListeners.push(
                                listener
                            );
                            return disposable();
                        },
                        reveal() {
                            panel.revealCount += 1;
                        },
                        dispose() {
                            if (panel.disposed) {
                                return;
                            }

                            panel.disposed = true;

                            for (
                                const listener
                                of disposeListeners
                            ) {
                                listener();
                            }
                        }
                    };

                    webviewPanels.push(panel);
                    return panel;
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
                fs: {
                    async readFile() {
                        return new Uint8Array();
                    },
                    async stat() {
                        return { type: 1 };
                    }
                },
                async findFiles() {
                    return [];
                },
                createFileSystemWatcher() {
                    const watcher = disposable();

                    watcher.onDidCreate = () =>
                        disposable();
                    watcher.onDidChange = () =>
                        disposable();
                    watcher.onDidDelete = () =>
                        disposable();

                    return watcher;
                },
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
                },
                onDidChangeWorkspaceFolders() {
                    return disposable();
                },
                getWorkspaceFolder() {
                    return undefined;
                }
            },
            tests: {
                createTestController(id, label) {
                    const controller = {
                        id,
                        label,
                        items: testItemCollection(),
                        disposed: false,
                        createTestItem(
                            itemId,
                            itemLabel,
                            uri
                        ) {
                            return {
                                id: itemId,
                                label: itemLabel,
                                uri,
                                children:
                                    testItemCollection()
                            };
                        },
                        createRunProfile(
                            profileLabel,
                            kind,
                            runHandler,
                            isDefault
                        ) {
                            const profile =
                                disposable();
                            profile.label =
                                profileLabel;
                            profile.kind = kind;
                            profile.runHandler =
                                runHandler;
                            profile.isDefault =
                                isDefault;
                            return profile;
                        },
                        createTestRun() {
                            return {
                                enqueued() {},
                                started() {},
                                skipped() {},
                                failed() {},
                                errored() {},
                                passed() {},
                                appendOutput() {},
                                end() {}
                            };
                        },
                        dispose() {
                            controller.disposed = true;
                        }
                    };

                    testControllers.push(controller);
                    return controller;
                }
            },
            env: {
                clipboard: {
                    async writeText() {}
                }
            },
            EventEmitter,
            DebugAdapterInlineImplementation,
            TestMessage,
            Location,
            Range,
            TestRunProfileKind: {
                Run: 1,
                Debug: 2,
                Coverage: 3
            },
            ThemeColor,
            SemanticTokensLegend,
            SemanticTokensBuilder,
            CodeActionKind: {
                QuickFix: "quickfix"
            },
            DecorationRangeBehavior: {
                OpenClosed: 1
            },
            ViewColumn: {
                Beside: 2
            },
            Uri
        }
    };
}

function testItemCollection() {
    const items = new Map();

    return {
        get size() {
            return items.size;
        },
        get(id) {
            return items.get(id);
        },
        replace(values) {
            items.clear();

            for (const value of values) {
                items.set(value.id, value);
            }
        },
        forEach(callback) {
            for (const value of items.values()) {
                callback(value, this);
            }
        },
        [Symbol.iterator]() {
            return items.entries();
        }
    };
}
