import path from "node:path";
import { GuiRuntimePreparation } from "../../src/compiler/gui/GuiRuntimePreparation.js";
import { NodeGtkDependencyManager } from "../../src/infrastructure/gui/NodeGtkDependencyManager.js";

import {
    AnalyzeCostUseCase
} from "../../src/application/usecases/AnalyzeCostUseCase.js";
import {
    GenerateJavaScriptUseCase
} from "../../src/application/usecases/GenerateJavaScriptUseCase.js";
import {
    requireFunction,
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    CompilationService
} from "../../src/compiler/services/CompilationService.js";
import {
    LanguageDiagnosticsService
} from "../../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    SemanticCallDiagnosticsService
} from "../../src/language/diagnostics/SemanticCallDiagnosticsService.js";
import {
    DocumentAnalysisService
} from "../../src/language/analysis/DocumentAnalysisService.js";
import {
    complexityReportBuilder
} from "../../src/complex/report/ComplexityReportBuilder.js";
import {
    LanguageIntelligenceService
} from "../../src/language/intelligence/LanguageIntelligenceService.js";
import {
    SemanticTokenService
} from "../../src/language/intelligence/SemanticTokenService.js";
import {
    RenameService
} from "../../src/language/refactoring/RenameService.js";
import {
    CLRSFormatter
} from "../../src/language/formatting/CLRSFormatter.js";
import {
    CLRSCorrectionExplanationPlanner,
    CLRSCorrectionPlanner
} from "../../src/language/corrections/index.js";
import {
    ExecutionTraceService
} from "../../src/runtime/ExecutionTraceService.js";
import {
    CLRSNodeTestProcessRunner,
    CLRSTestDiscoveryService,
    CLRSTestExecutor
} from "../../src/testing/index.js";
import {
    BrokerGameSession
} from "../../src/broker95/application/BrokerGameSession.js";
import {
    BrokerEconomyService
} from "../../src/broker95/economy/BrokerEconomyService.js";
import {
    BrokerConfigurationService,
    createBrokerPublicConfigurationView
} from "../../src/broker95/configuration/BrokerConfigurationService.js";
import {
    BrokerConversationSession,
    createBrokerConversationSummaryView
} from "../../src/broker95/conversation/BrokerConversationSession.js";
import {
    BrokerConversationService
} from "../../src/broker95/conversation/BrokerConversationService.js";
import {
    brokerLearningRouteCatalogs
} from "../../src/broker95/learning/index.js";
import {
    BrokerContractCycleService,
    BrokerContractService,
    BrokerLearningContractService
} from "../../src/broker95/contracts/index.js";
import {
    BrokerClrsDocumentCaptureService,
    BrokerClrsTestProcessRunner,
    BrokerStaticEvidenceService,
    BrokerSubmissionAskService,
    BrokerSubmissionEvaluationService,
    BrokerSubmissionPushService,
    BrokerSubmissionReviewService,
    BrokerTestExecutionService
} from "../../src/broker95/submission/index.js";
import {
    BrokerLlmAvailabilityService,
    createBrokerPublicLlmAvailabilityView
} from "../../src/broker95/llm/BrokerLlmAvailability.js";
import {
    BrokerLLMProviderRegistry,
    BrokerLLMProviderId,
    getBrokerLLMProviderDescriptor
} from "../../src/broker95/llm/index.js";
import {
    VSCodeCodeHost
} from "../adapters/VSCodeCodeHost.js";
import {
    VSCodeDiagramHost
} from "../adapters/VSCodeDiagramHost.js";
import {
    VSCodeDebugHost
} from "../adapters/VSCodeDebugHost.js";
import {
    VSCodeClrsDocumentResolver
} from "../adapters/VSCodeClrsDocumentResolver.js";
import {
    VSCodeComplexityReportHost
} from "../adapters/VSCodeComplexityReportHost.js";
import {
    VSCodeBrokerHost
} from "../adapters/VSCodeBrokerHost.js";
import {
    VSCodeBrokerDocumentHost
} from "../adapters/VSCodeBrokerDocumentHost.js";
import {
    VSCodeGlobalStateBrokerGameRepository
} from "../adapters/VSCodeGlobalStateBrokerGameRepository.js";
import {
    VSCodeGlobalStateBrokerSettingsRepository
} from "../adapters/VSCodeGlobalStateBrokerSettingsRepository.js";
import {
    VSCodeGlobalStateBrokerConversationRepository
} from "../adapters/VSCodeGlobalStateBrokerConversationRepository.js";
import {
    VSCodeSecretStorageBrokerCredentialRepository
} from "../adapters/VSCodeSecretStorageBrokerCredentialRepository.js";
import {
    BrokerCLRSTestIntegration,
    CLRSTestDebugController,
    CLRSTestCoveragePresenter,
    CLRSTestCoverageStore,
    CLRSTestDiscoveryController,
    CLRSTestResultPresenter,
    CLRSTestRunController,
    VSCodeCLRSTestWorkspace
} from "../testing/index.js";
import {
    GroqBroker95LLMAdapter
} from "../adapters/GroqBroker95LLMAdapter.js";
import {
    GeminiBroker95LLMAdapter
} from "../adapters/GeminiBroker95LLMAdapter.js";
import {
    DeepSeekBroker95LLMAdapter
} from "../adapters/DeepSeekBroker95LLMAdapter.js";
import {
    OllamaBroker95LLMAdapter
} from "../adapters/OllamaBroker95LLMAdapter.js";
import {
    OpenAIBroker95LLMAdapter
} from "../adapters/OpenAIBroker95LLMAdapter.js";
import {
    OpenAICompatibleBroker95LLMAdapter
} from "../adapters/OpenAICompatibleBroker95LLMAdapter.js";
import {
    LMStudioBroker95LocalService
} from "../adapters/LMStudioBroker95LocalService.js";
import {
    DisposableStore
} from "../application/DisposableStore.js";
import {
    registerCodeCommands
} from "../commands/CodeCommands.js";
import {
    registerDiagramCommands
} from "../commands/DiagramCommands.js";
import {
    registerDebugCommands
} from "../commands/DebugCommands.js";
import {
    registerLanguageNavigation
} from "../commands/LanguageNavigation.js";
import {
    registerLanguageRefactoring
} from "../commands/LanguageRefactoring.js";
import {
    registerLanguageFormatting
} from "../commands/LanguageFormatting.js";
import {
    registerLanguageCorrections
} from "../commands/LanguageCorrections.js";
import {
    registerGettingStartedCommands
} from "../commands/GettingStartedCommands.js";
import {
    registerContextualStartCommands
} from "../commands/ContextualStartCommands.js";
import {
    registerCopilotCommands
} from "../commands/CopilotCommands.js";
import {
    registerLanguageIntelligence
} from "../commands/LanguageIntelligence.js";
import {
    registerSemanticTokens
} from "../commands/SemanticTokens.js";
import {
    registerComplexityReportCommands
} from "../commands/ComplexityReportCommands.js";
import {
    registerBrokerCommands
} from "../commands/BrokerCommands.js";
import {
    loadWebviewHtml
} from "../commands/webview/WebViewContent.js";
import {
    createExtensionConfiguration
} from "../config/ExtensionConfiguration.js";
import {
    CodeCommandController
} from "../controllers/CodeCommandController.js";
import {
    DiagramCommandController
} from "../controllers/DiagramCommandController.js";
import {
    DebugCommandController
} from "../controllers/DebugCommandController.js";
import {
    ComplexityReportController
} from "../controllers/ComplexityReportController.js";
import {
    BrokerCommandController
} from "../controllers/BrokerCommandController.js";
import {
    CLRSDebugAdapterFactory
} from "../debug/CLRSDebugAdapterFactory.js";
import {
    CLRSDebugConfigurationProvider
} from "../debug/CLRSDebugConfigurationProvider.js";
import {
    VSCodeNotificationPresenter
} from "../presenters/VSCodeNotificationPresenter.js";
import {
    CLRSCodeLensProvider
} from "../providers/CodeLensProvider.js";
import {
    CLRSLanguageIntelligenceProvider
} from "../providers/LanguageIntelligenceProvider.js";
import {
    CLRSCostDecorator
} from "../providers/DecoratorProvider.js";
import {
    CLRSStaticDiagnosticsProvider
} from "../providers/StaticDiagnosticsProvider.js";
import {
    CLRSSymbolNavigationProvider
} from "../providers/SymbolNavigationProvider.js";
import {
    CLRSCallHierarchyProvider
} from "../providers/CallHierarchyProvider.js";
import {
    CLRSSemanticTokensProvider
} from "../providers/SemanticTokensProvider.js";
import {
    CLRSRenameProvider
} from "../providers/RenameProvider.js";
import {
    CLRSDocumentFormattingProvider
} from "../providers/FormattingProvider.js";
import {
    CLRSCodeActionProvider
} from "../providers/CodeActionProvider.js";
import {
    createViewState
} from "../providers/ViewState.js";
import {
    RuntimePerformanceMonitor
} from "../../src/performance/RuntimePerformanceMonitor.js";

/**
 * Único punto que conoce las implementaciones concretas de la extensión.
 */
export function createExtensionApplication(
    options = {}
) {
    const vscode =
        requireObject(
            options.vscodeApi,
            "vscodeApi"
        );
    const context =
        requireObject(
            options.context,
            "extensionContext"
        );
    const brokerLearningCatalogs =
        options.brokerLearningCatalogs ??
        brokerLearningRouteCatalogs;

    requirePort(
        vscode.commands,
        "vscodeApi.commands",
        [
            "registerCommand",
            "executeCommand"
        ]
    );
    requirePort(
        vscode.debug,
        "vscodeApi.debug",
        [
            "startDebugging",
            "stopDebugging",
            "onDidStartDebugSession",
            "onDidTerminateDebugSession",
            "registerDebugConfigurationProvider",
            "registerDebugAdapterDescriptorFactory"
        ]
    );
    requireFunction(
        vscode.DebugAdapterInlineImplementation,
        "vscodeApi.DebugAdapterInlineImplementation"
    );
    requirePort(
        vscode.languages,
        "vscodeApi.languages",
        [
            "registerCodeLensProvider",
            "createDiagnosticCollection",
            "registerDocumentSymbolProvider",
            "registerDefinitionProvider",
            "registerReferenceProvider",
            "registerCallHierarchyProvider",
            "registerCompletionItemProvider",
            "registerHoverProvider",
            "registerSignatureHelpProvider",
            "registerInlayHintsProvider",
            "registerDocumentSemanticTokensProvider",
            "registerRenameProvider",
            "registerDocumentFormattingEditProvider",
            "registerCodeActionsProvider"
        ]
    );
    requirePort(
        vscode.window,
        "vscodeApi.window",
        [
            "showInformationMessage",
            "showErrorMessage",
            "createWebviewPanel",
            "createTextEditorDecorationType",
            "onDidChangeActiveTextEditor",
            "onDidChangeVisibleTextEditors"
        ]
    );
    requirePort(
        vscode.workspace,
        "vscodeApi.workspace",
        [
            "findFiles",
            "createFileSystemWatcher",
            "onDidOpenTextDocument",
            "onDidChangeTextDocument",
            "onDidSaveTextDocument",
            "onDidCloseTextDocument",
            "getWorkspaceFolder"
        ]
    );
    requirePort(
        vscode.workspace.fs,
        "vscodeApi.workspace.fs",
        ["readFile", "stat"]
    );
    requirePort(
        vscode.tests,
        "vscodeApi.tests",
        ["createTestController"]
    );
    requireObject(
        vscode.TestRunProfileKind,
        "vscodeApi.TestRunProfileKind"
    );
    requireFunction(
        vscode.TestMessage,
        "vscodeApi.TestMessage"
    );
    requireFunction(
        vscode.Location,
        "vscodeApi.Location"
    );
    requireFunction(
        vscode.Range,
        "vscodeApi.Range"
    );
    requirePort(
        vscode.Uri,
        "vscodeApi.Uri",
        ["file", "joinPath"]
    );
    requireFunction(
        vscode.EventEmitter,
        "vscodeApi.EventEmitter"
    );
    requirePort(
        context.subscriptions,
        "extensionContext.subscriptions",
        ["push"]
    );
    requirePort(
        context.globalState,
        "extensionContext.globalState",
        ["get", "update"]
    );
    requirePort(
        context.secrets,
        "extensionContext.secrets",
        ["get", "store", "delete"]
    );

    const config =
        createExtensionConfiguration(
            options.config
        );
    const lifecycle =
        options.lifecycle ??
        new DisposableStore();

    requirePort(
        lifecycle,
        "extensionLifecycle",
        ["add", "dispose"]
    );
    const developerLogger =
        options.developerLogger ??
        console;
    const performanceMonitor =
        options.performanceMonitor ??
        new RuntimePerformanceMonitor();

    requirePort(
        performanceMonitor,
        "performanceMonitor",
        [
            "now",
            "record",
            "measure",
            "getSnapshot",
            "dispose"
        ]
    );
    lifecycle.add(performanceMonitor);

    try {
        const brokerGameRepository =
            options.brokerGameRepository ??
            new VSCodeGlobalStateBrokerGameRepository(
                context.globalState
            );
        const brokerGameSession =
            options.brokerGameSession ??
            new BrokerGameSession({
                repository:
                    brokerGameRepository,
                developerLogger,
                catalogs:
                    brokerLearningCatalogs
            });

        requirePort(
            brokerGameSession,
            "brokerGameSession",
            [
                "initialize",
                "getState",
                "getLoadResult",
                "transact",
                "subscribe",
                "dispose"
            ]
        );
        lifecycle.add(brokerGameSession);

        const brokerGameReady =
            brokerGameSession.initialize();

        void brokerGameReady.catch(error => {
            try {
                developerLogger.error?.(
                    "BROKER.95 persistent game initialization failed.",
                    error
                );
            } catch {
                // BROKER.95 no debe afectar la activación de CLRS Kit.
            }
        });

        const brokerSettingsRepository =
            options.brokerSettingsRepository ??
            new VSCodeGlobalStateBrokerSettingsRepository(
                context.globalState
            );
        const brokerCredentialRepository =
            options.brokerCredentialRepository ??
            new VSCodeSecretStorageBrokerCredentialRepository(
                context.secrets,
                { developerLogger }
            );
        let brokerConfigurationService;
        const brokerProviderRegistry =
            options.brokerProviderRegistry ??
            new BrokerLLMProviderRegistry({
                resolveSelectedProviderId: () =>
                    brokerConfigurationService
                        .getPublicSettings()
                        .providerId,
                developerLogger
            });
        brokerConfigurationService =
            options.brokerConfigurationService ??
            new BrokerConfigurationService({
                settingsRepository:
                    brokerSettingsRepository,
                credentialRepository:
                    brokerCredentialRepository,
                providerRegistry:
                    brokerProviderRegistry,
                developerLogger
            });

        requirePort(
            brokerConfigurationService,
            "brokerConfigurationService",
            [
                "initialize",
                "getPublicSettings",
                "getLlmStatus",
                "getPublicSnapshot",
                "setProvider",
                "setModel",
                "setBaseUrl",
                "setAudioPreferences",
                "setApiKey",
                "deleteApiKey",
                "resolvePrivateLlmSettings",
                "resolvePrivateLlmEndpointSettings",
                "subscribe",
                "dispose"
            ]
        );
        lifecycle.add(Object.freeze({
            dispose() {
                brokerConfigurationService
                    .dispose();
            }
        }));

        const brokerConfiguration =
            createBrokerPublicConfigurationView(
                brokerConfigurationService
            );
        const brokerLlmAvailabilityService =
            options.brokerLlmAvailabilityService ??
            new BrokerLlmAvailabilityService({
                configuration: brokerConfiguration,
                developerLogger
            });

        requirePort(
            brokerLlmAvailabilityService,
            "brokerLlmAvailabilityService",
            [
                "getSnapshot",
                "getLlmStatus",
                "recordFailure",
                "recordSuccess",
                "subscribe",
                "dispose"
            ]
        );
        lifecycle.add(brokerLlmAvailabilityService);
        const brokerLlmAvailability =
            createBrokerPublicLlmAvailabilityView(
                brokerLlmAvailabilityService
            );
        const brokerLlmAdapters = options.brokerLlmPort != null
            ? [options.brokerLlmPort]
            : [
                new GroqBroker95LLMAdapter({
                    configurationService:
                        brokerConfigurationService,
                    availability:
                        brokerLlmAvailabilityService,
                    fetch: options.brokerFetch,
                    timeoutMs:
                        options.brokerLlmTimeoutMs,
                    developerLogger
                }),
                new GeminiBroker95LLMAdapter({
                    configurationService:
                        brokerConfigurationService,
                    availability:
                        brokerLlmAvailabilityService,
                    fetch: options.brokerGeminiFetch ??
                        options.brokerFetch,
                    timeoutMs:
                        options.brokerGeminiLlmTimeoutMs ??
                        options.brokerLlmTimeoutMs,
                    developerLogger
                }),
                new DeepSeekBroker95LLMAdapter({
                    configurationService:
                        brokerConfigurationService,
                    availability:
                        brokerLlmAvailabilityService,
                    fetch: options.brokerDeepSeekFetch ??
                        options.brokerFetch,
                    timeoutMs:
                        options.brokerDeepSeekLlmTimeoutMs ??
                        options.brokerLlmTimeoutMs,
                    developerLogger
                }),
                new OllamaBroker95LLMAdapter({
                    configurationService:
                        brokerConfigurationService,
                    availability:
                        brokerLlmAvailabilityService,
                    fetch: options.brokerOllamaFetch ??
                        options.brokerFetch,
                    apiBaseUrl:
                        options.brokerOllamaApiBaseUrl,
                    timeoutMs:
                        options.brokerOllamaLlmTimeoutMs ??
                        options.brokerLlmTimeoutMs,
                    developerLogger
                }),
                new OpenAIBroker95LLMAdapter({
                    configurationService:
                        brokerConfigurationService,
                    availability:
                        brokerLlmAvailabilityService,
                    fetch: options.brokerOpenAIFetch ??
                        options.brokerFetch,
                    timeoutMs:
                        options.brokerOpenAILlmTimeoutMs ??
                        options.brokerLlmTimeoutMs,
                    developerLogger
                }),
                ...[
                    BrokerLLMProviderId.LM_STUDIO,
                    BrokerLLMProviderId.XAI,
                    BrokerLLMProviderId.TOGETHER,
                    BrokerLLMProviderId.ZAI,
                    BrokerLLMProviderId.HUGGING_FACE,
                    BrokerLLMProviderId.OPENROUTER
                ].map(providerId =>
                    new OpenAICompatibleBroker95LLMAdapter({
                        providerId,
                        configurationService:
                            brokerConfigurationService,
                        availability:
                            brokerLlmAvailabilityService,
                        fetch:
                            openAICompatibleFetch(
                                options,
                                providerId
                            ),
                        timeoutMs:
                            options
                                .brokerOpenAICompatibleLlmTimeoutMs ??
                            options.brokerLlmTimeoutMs,
                        developerLogger
                    })
                )
            ];

        for (const brokerLlmAdapter of brokerLlmAdapters) {
            requirePort(
                brokerLlmAdapter,
                "brokerLlmAdapter",
                [
                    "getProviderId",
                    "generateContract",
                    "reviewSubmission",
                    "evaluateSubmission",
                    "chat",
                    "testConnection"
                ]
            );
            const brokerAdapterProviderId =
                brokerLlmAdapter.getProviderId();

            if (!brokerProviderRegistry.has(brokerAdapterProviderId)) {
                brokerProviderRegistry.register(
                    options.brokerLlmPort != null
                        ? options.brokerLlmProviderDescriptor ??
                            getBrokerLLMProviderDescriptor(
                                brokerAdapterProviderId
                            )
                        : getBrokerLLMProviderDescriptor(
                            brokerAdapterProviderId
                        ),
                    brokerLlmAdapter
                );
            }
        }

        const brokerLlmPort =
            brokerProviderRegistry;
        const brokerLmStudioLocalService =
            options.brokerLmStudioLocalService ??
            new LMStudioBroker95LocalService({
                configurationService:
                    brokerConfigurationService,
                fetch: options.brokerLmStudioFetch ??
                    options.brokerOpenAICompatibleFetch ??
                    options.brokerFetch,
                timeoutMs:
                    options
                        .brokerLmStudioDiscoveryTimeoutMs,
                developerLogger
            });

        requirePort(
            brokerLmStudioLocalService,
            "lmStudioLocalService",
            ["discoverModels"]
        );

        requirePort(
            brokerLlmPort,
            "brokerLlmProviderRegistry",
            [
                "generateContract",
                "reviewSubmission",
                "askSubmission",
                "evaluateSubmission",
                "chat",
                "testConnection"
            ]
        );
        const brokerContractService =
            options.brokerContractService ??
            new BrokerContractService({
                gameSession: brokerGameSession,
                llm: brokerLlmPort,
                lmStudioLocalService:
                    brokerLmStudioLocalService,
                availability: brokerLlmAvailability,
                random: options.brokerContractRandom,
                now: options.brokerContractClock,
                createRequestId:
                    options.createBrokerContractRequestId
            });

        requirePort(
            brokerContractService,
            "brokerContractService",
            ["generate"]
        );
        const brokerLearningContractService =
            options.brokerLearningContractService ??
            new BrokerLearningContractService({
                gameSession: brokerGameSession,
                llm: brokerLlmPort,
                availability:
                    brokerLlmAvailability,
                now:
                    options.brokerContractClock,
                createRequestId:
                    options
                        .createBrokerLearningContractRequestId,
                catalogs:
                    brokerLearningCatalogs
            });

        requirePort(
            brokerLearningContractService,
            "brokerLearningContractService",
            ["obtain"]
        );
        const brokerContractCycle =
            options.brokerContractCycle ??
            new BrokerContractCycleService({
                gameSession: brokerGameSession,
                contractService:
                    brokerContractService,
                now: options.brokerContractClock
            });

        requirePort(
            brokerContractCycle,
            "brokerContractCycle",
            ["canExecute", "execute"]
        );
        const brokerEconomy =
            options.brokerEconomy ??
            new BrokerEconomyService({
                gameSession: brokerGameSession
            });

        requirePort(
            brokerEconomy,
            "brokerEconomy",
            ["purchase"]
        );
        const brokerConfigurationReady =
            brokerConfigurationService
                .initialize();

        void brokerConfigurationReady
            .catch(error => {
                try {
                    developerLogger.error?.(
                        "BROKER.95 secure configuration initialization failed.",
                        error
                    );
                } catch {
                    // La configuración no bloquea CLRS Kit.
                }
            });

        const brokerConversationRepository =
            options.brokerConversationRepository ??
            new VSCodeGlobalStateBrokerConversationRepository(
                context.globalState
            );
        const brokerConversationSession =
            options.brokerConversationSession ??
            new BrokerConversationSession({
                repository:
                    brokerConversationRepository,
                developerLogger
            });

        requirePort(
            brokerConversationSession,
            "brokerConversationSession",
            [
                "initialize",
                "getState",
                "getTurns",
                "getLlmMessages",
                "getSummary",
                "appendTurn",
                "clear",
                "subscribe",
                "dispose"
            ]
        );
        lifecycle.add(Object.freeze({
            dispose() {
                brokerConversationSession
                    .dispose();
            }
        }));

        const brokerConversation =
            createBrokerConversationSummaryView(
                brokerConversationSession
            );
        const brokerConversationInternalReady =
            brokerConversationSession.initialize();
        const brokerConversationReady =
            brokerConversationInternalReady
                .then(result =>
                    Object.freeze({
                        source: result.source,
                        summary:
                            brokerConversation
                                .getSummary(),
                        retentionApplied:
                            result.retentionApplied,
                        recoveryCode:
                            result.recoveryCode
                    })
                );

        void brokerConversationInternalReady
            .catch(error => {
                try {
                    developerLogger.error?.(
                        "BROKER.95 bounded conversation initialization failed.",
                        error
                    );
                } catch {
                    // El historial no bloquea CLRS Kit.
                }
            });
        void brokerConversationReady.catch(() => {
            // La promesa interna ya registró el detalle técnico.
        });

        const brokerConversationService =
            options.brokerConversationService ??
            new BrokerConversationService({
                gameSession: brokerGameSession,
                conversationSession:
                    brokerConversationSession,
                llm: brokerLlmPort,
                availability:
                    brokerLlmAvailability,
                createRequestId:
                    options
                        .createBrokerConversationRequestId
            });

        requirePort(
            brokerConversationService,
            "brokerConversationService",
            ["chat"]
        );

        const compilationService =
            options.compilationService ??
            new CompilationService();
        const testRuntimePreparation = options.testRuntimePreparation ?? compilationService.runtimePreparation ??
            new GuiRuntimePreparation({ dependencyManager: new NodeGtkDependencyManager({ extensionRoot: context.extensionPath }) });
        const diagnosticsService =
            options.diagnosticsService ??
            new LanguageDiagnosticsService();
        const callGraphDiagnosticsService =
            options
                .callGraphDiagnosticsService ??
            new SemanticCallDiagnosticsService();

        requirePort(
            callGraphDiagnosticsService,
            "callGraphDiagnosticsService",
            ["diagnose"]
        );

        const documentAnalysisService =
            options.documentAnalysisService ??
            new DocumentAnalysisService({
                languageDiagnosticsService:
                    diagnosticsService,
                analyzeCost:
                    ast =>
                        compilationService
                            .analyzeCostAST(ast),
                maximumSnapshots:
                    config
                        .maximumAnalysisSnapshots,
                performanceMonitor
            });

        requirePort(
            documentAnalysisService,
            "documentAnalysisService",
            [
                "analyze",
                "analyzeDocument",
                "invalidateDocument",
                "dispose"
            ]
        );

        lifecycle.add(
            documentAnalysisService
        );
        const clrsTestWorkspace =
            options.clrsTestWorkspace ??
            new VSCodeCLRSTestWorkspace(vscode);
        const clrsTestDiscovery =
            options.clrsTestDiscovery ??
            new CLRSTestDiscoveryService({
                workspace: clrsTestWorkspace
            });

        requirePort(
            clrsTestDiscovery,
            "clrsTestDiscovery",
            [
                "discover",
                "refresh",
                "remove",
                "getSnapshot",
                "subscribe",
                "dispose"
            ]
        );
        lifecycle.add(clrsTestDiscovery);

        const clrsTestController =
            options.clrsTestController ??
            new CLRSTestDiscoveryController({
                vscodeApi: vscode,
                discovery: clrsTestDiscovery,
                workspace: clrsTestWorkspace,
                developerLogger
            });

        requirePort(
            clrsTestController,
            "clrsTestController",
            [
                "start",
                "refresh",
                "render",
                "attachExternalSource",
                "onDidActivate",
                "getMetadata",
                "getSnapshot",
                "dispose"
            ]
        );
        lifecycle.add(clrsTestController);

        const clrsTestDeclarativeReady =
            clrsTestController.start();

        void clrsTestDeclarativeReady.catch(error => {
            try {
                developerLogger.error?.(
                    "CLRS test discovery initialization failed.",
                    error
                );
            } catch {
                // El descubrimiento no bloquea las demás herramientas.
            }
        });

        const clrsTestProcessRunner =
            options.clrsTestProcessRunner ??
            new CLRSNodeTestProcessRunner();
        const clrsTestExecutor =
            options.clrsTestExecutor ??
            new CLRSTestExecutor({
                runtimePreparation: testRuntimePreparation,
                documentAnalysisService,
                javaScriptGenerator:
                    compilationService.generator,
                processRunner:
                    clrsTestProcessRunner,
                now: options.clrsTestExecutionClock
            });

        requirePort(
            clrsTestExecutor,
            "clrsTestExecutor",
            ["execute"]
        );

        const clrsTestResultPresenter =
            options.clrsTestResultPresenter ??
            new CLRSTestResultPresenter({
                vscodeApi: vscode,
                workspace: clrsTestWorkspace
            });

        requirePort(
            clrsTestResultPresenter,
            "clrsTestResultPresenter",
            ["present"]
        );

        const clrsTestCoverageStore =
            options.clrsTestCoverageStore ??
            new CLRSTestCoverageStore();

        requirePort(
            clrsTestCoverageStore,
            "clrsTestCoverageStore",
            [
                "publish",
                "getSnapshot",
                "subscribe",
                "dispose"
            ]
        );
        lifecycle.add(clrsTestCoverageStore);

        const clrsTestCoveragePresenter =
            options.clrsTestCoveragePresenter ??
            new CLRSTestCoveragePresenter({
                vscodeApi: vscode,
                workspace: clrsTestWorkspace,
                coverageStore:
                    clrsTestCoverageStore
            });

        requirePort(
            clrsTestCoveragePresenter,
            "clrsTestCoveragePresenter",
            [
                "present",
                "loadDetailedCoverage",
                "loadDetailedCoverageForTest"
            ]
        );

        const clrsTestRunController =
            options.clrsTestRunController ??
            new CLRSTestRunController({
                vscodeApi: vscode,
                discoveryController:
                    clrsTestController,
                discovery: clrsTestDiscovery,
                workspace: clrsTestWorkspace,
                executor: clrsTestExecutor,
                resultPresenter:
                    clrsTestResultPresenter,
                coveragePresenter:
                    clrsTestCoveragePresenter,
                coverageStore:
                    clrsTestCoverageStore,
                developerLogger
            });

        requirePort(
            clrsTestRunController,
            "clrsTestRunController",
            [
                "start",
                "registerExternalSource",
                "run",
                "dispose"
            ]
        );
        lifecycle.add(clrsTestRunController);
        clrsTestRunController.start();

        const brokerDocumentHost =
            options.brokerDocumentHost ??
            new VSCodeBrokerDocumentHost(vscode, {
                languageId: config.languageId
            });

        if (
            typeof brokerDocumentHost.dispose ===
                "function"
        ) {
            lifecycle.add(brokerDocumentHost);
        }

        const brokerClrsTestIntegration =
            options.brokerClrsTestIntegration ??
            new BrokerCLRSTestIntegration({
                gameSession: brokerGameSession,
                documentHost: brokerDocumentHost,
                executor: clrsTestExecutor
            });

        requirePort(
            brokerClrsTestIntegration,
            "brokerClrsTestIntegration",
            [
                "start",
                "getSnapshot",
                "subscribe",
                "execute",
                "prepareDebug",
                "dispose"
            ]
        );
        lifecycle.add(brokerClrsTestIntegration);
        clrsTestRunController.registerExternalSource(
            brokerClrsTestIntegration
        );
        const brokerClrsTestsReady =
            clrsTestController.attachExternalSource(
                brokerClrsTestIntegration
            );
        const clrsTestDiscoveryReady = Promise.all([
            clrsTestDeclarativeReady,
            brokerClrsTestsReady
        ]).then(([snapshot]) => snapshot);

        void brokerClrsTestsReady.catch(error => {
            try {
                developerLogger.error?.(
                    "BROKER.95 test discovery initialization failed.",
                    error
                );
            } catch {
                // La integración no bloquea las demás herramientas.
            }
        });

        const brokerDocumentCapture =
            options.brokerDocumentCapture ??
            new BrokerClrsDocumentCaptureService({
                documentHost: brokerDocumentHost,
                documentAnalysisService,
                languageId: config.languageId,
                now: options.brokerDocumentCaptureClock
            });

        requirePort(
            brokerDocumentCapture,
            "brokerDocumentCapture",
            ["capture"]
        );
        const brokerStaticEvidence =
            options.brokerStaticEvidence ??
            new BrokerStaticEvidenceService({
                documentCapture: brokerDocumentCapture,
                documentAnalysisService
            });

        requirePort(
            brokerStaticEvidence,
            "brokerStaticEvidence",
            ["collect", "collectCapture"]
        );
        const brokerTestProcessRunner =
            options.brokerTestProcessRunner ??
            new BrokerClrsTestProcessRunner({
                runner: clrsTestProcessRunner
            });
        const brokerTestExecution =
            options.brokerTestExecution ??
            new BrokerTestExecutionService({
                runtimePreparation: testRuntimePreparation,
                gameSession: brokerGameSession,
                documentCapture: brokerDocumentCapture,
                documentAnalysisService,
                javaScriptGenerator:
                    compilationService.generator,
                programRunner:
                    brokerTestProcessRunner,
                now: options.brokerTestExecutionClock
            });

        requirePort(
            brokerTestExecution,
            "brokerTestExecution",
            [
                "executeActiveContract",
                "executeContract",
                "executeContractCapture"
            ]
        );
        const brokerSubmissionReview =
            options.brokerSubmissionReview ??
            new BrokerSubmissionReviewService({
                gameSession: brokerGameSession,
                availability:
                    brokerLlmAvailability,
                llm: brokerLlmPort,
                documentCapture:
                    brokerDocumentCapture,
                testExecution:
                    brokerTestExecution,
                staticEvidence:
                    brokerStaticEvidence,
                createRequestId:
                    options
                        .createBrokerReviewRequestId,
                catalogs:
                    brokerLearningCatalogs
            });

        requirePort(
            brokerSubmissionReview,
            "brokerSubmissionReview",
            ["review"]
        );
        const brokerSubmissionAsk =
            options.brokerSubmissionAsk ??
            new BrokerSubmissionAskService({
                gameSession: brokerGameSession,
                availability:
                    brokerLlmAvailability,
                llm: brokerLlmPort,
                documentCapture:
                    brokerDocumentCapture,
                testExecution:
                    brokerTestExecution,
                staticEvidence:
                    brokerStaticEvidence,
                createRequestId:
                    options.createBrokerAskRequestId,
                catalogs:
                    brokerLearningCatalogs
            });

        requirePort(
            brokerSubmissionAsk,
            "brokerSubmissionAsk",
            ["ask"]
        );
        const brokerSubmissionEvaluation =
            options.brokerSubmissionEvaluation ??
            new BrokerSubmissionEvaluationService({
                gameSession: brokerGameSession,
                availability:
                    brokerLlmAvailability,
                llm: brokerLlmPort,
                documentCapture:
                    brokerDocumentCapture,
                testExecution:
                    brokerTestExecution,
                staticEvidence:
                    brokerStaticEvidence,
                createRequestId:
                    options
                        .createBrokerEvaluationRequestId,
                catalogs:
                    brokerLearningCatalogs
            });

        requirePort(
            brokerSubmissionEvaluation,
            "brokerSubmissionEvaluation",
            ["evaluate", "evaluateCapture"]
        );
        const brokerSubmissionPush =
            options.brokerSubmissionPush ??
            new BrokerSubmissionPushService({
                gameSession: brokerGameSession,
                documentCapture:
                    brokerDocumentCapture,
                evaluation:
                    brokerSubmissionEvaluation,
                now: options.brokerSubmissionPushNow,
                catalogs:
                    brokerLearningCatalogs
            });

        requirePort(
            brokerSubmissionPush,
            "brokerSubmissionPush",
            ["push"]
        );
        const generateJavaScriptUseCase =
            options
                .generateJavaScriptUseCase ??
            new GenerateJavaScriptUseCase({
                compilationService
            });
        const analyzeCostUseCase =
            options.analyzeCostUseCase ??
            new AnalyzeCostUseCase({
                compilationService
            });
        const presenter =
            options.presenter ??
            new VSCodeNotificationPresenter(
                vscode.window,
                {
                    developerLogger:
                        options.developerLogger ??
                        console
                }
            );
        const executionTraceService =
            options.executionTraceService ??
            new ExecutionTraceService({
                maxSteps:
                    options.executionTraceLimit
            });

        requirePort(
            executionTraceService,
            "executionTraceService",
            [
                "start",
                "accept",
                "cancel",
                "requestCancellation",
                "getSnapshot",
                "subscribe",
                "dispose"
            ]
        );
        lifecycle.add(executionTraceService);
        const debugExecutionTraceService =
            options.debugExecutionTraceService ??
            new ExecutionTraceService({
                maxSteps:
                    options.executionTraceLimit,
                traceIdPrefix:
                    "debug-execution"
            });

        requirePort(
            debugExecutionTraceService,
            "debugExecutionTraceService",
            [
                "start",
                "accept",
                "cancel",
                "requestCancellation",
                "getSnapshot",
                "subscribe",
                "dispose"
            ]
        );
        lifecycle.add(
            debugExecutionTraceService
        );
        const viewState =
            options.viewState ??
            createViewState(
                config.initialShowCost
            );
        const clrsDocumentResolver =
            options.clrsDocumentResolver ??
            new VSCodeClrsDocumentResolver(
                vscode,
                config.languageId
            );

        lifecycle.add(clrsDocumentResolver);
        const codeHost =
            options.codeHost ??
            new VSCodeCodeHost(
                vscode,
                config,
                {
                    executionTraceService,
                    documentResolver:
                        clrsDocumentResolver,
                    logger:
                        options.developerLogger ??
                        console
                }
            );

        lifecycle.add(codeHost);
        const debugCodeHost =
            options.debugCodeHost ??
            new VSCodeCodeHost(
                vscode,
                config,
                {
                    executionTraceService:
                        debugExecutionTraceService,
                    documentResolver:
                        clrsDocumentResolver,
                    logger:
                        options.developerLogger ??
                        console
                }
            );

        lifecycle.add(debugCodeHost);

        const codeController =
            options.codeController ??
            new CodeCommandController({
                host: codeHost,
                presenter,
                generateJavaScriptUseCase,
                path:
                    options.path ?? path,
                cliEntryRelativePath:
                    config
                        .cliEntryRelativePath
            });
        const debugHost =
            options.debugHost ??
            new VSCodeDebugHost(
                vscode,
                config.languageId,
                clrsDocumentResolver
            );
        const debugController =
            options.debugController ??
            new DebugCommandController({
                host: debugHost,
                presenter,
                debugType:
                    config.debugType,
                debugName:
                    config.debugName
            });
        const debugConfigurationProvider =
            options
                .debugConfigurationProvider ??
            new CLRSDebugConfigurationProvider({
                host: debugHost,
                presenter,
                debugType:
                    config.debugType,
                debugName:
                    config.debugName
            });
        const debugAdapterFactory =
            options.debugAdapterFactory ??
            new CLRSDebugAdapterFactory({
                vscodeApi: vscode,
                executionTraceService:
                    debugExecutionTraceService,
                logger:
                    options.developerLogger ??
                    console,
                launchProgram:
                    configuration =>
                        debugCodeHost.runCli(
                            path.join(
                                context.extensionPath,
                                config
                                    .cliEntryRelativePath
                            ),
                            configuration.program,
                            {
                                debug: true,
                                breakpoints:
                                    configuration
                                        .__clrsBreakpoints,
                                stopOnEntry:
                                    configuration
                                        .stopOnEntry,
                                documentVersion:
                                    configuration
                                        .__clrsDocumentVersion,
                                test:
                                    configuration
                                        .__clrsTest
                            }
                        )
            });
        const clrsTestDebugController =
            options.clrsTestDebugController ??
            new CLRSTestDebugController({
                vscodeApi: vscode,
                discoveryController:
                    clrsTestController,
                discovery: clrsTestDiscovery,
                workspace: clrsTestWorkspace,
                executionTraceService:
                    debugExecutionTraceService,
                resultPresenter:
                    clrsTestResultPresenter,
                debugType: config.debugType,
                developerLogger,
                now: options.clrsTestDebugClock
            });

        requirePort(
            clrsTestDebugController,
            "clrsTestDebugController",
            [
                "start",
                "registerExternalSource",
                "run",
                "dispose"
            ]
        );
        clrsTestDebugController.registerExternalSource(
            brokerClrsTestIntegration
        );
        lifecycle.add(clrsTestDebugController);
        clrsTestDebugController.start();
        const codeLensProvider =
            options.codeLensProvider ??
            new CLRSCodeLensProvider({
                analyzeCostUseCase,
                documentAnalysisService,
                vscodeApi: vscode,
                viewState,
                languageId:
                    config.languageId
            });

        lifecycle.add(codeLensProvider);

        const costDecorator =
            options.costDecorator ??
            new CLRSCostDecorator({
                analyzeCostUseCase,
                documentAnalysisService,
                vscodeApi: vscode,
                viewState,
                languageId:
                    config.languageId
            });

        lifecycle.add(costDecorator);

        const staticDiagnosticsProvider =
            options
                .staticDiagnosticsProvider ??
            new CLRSStaticDiagnosticsProvider({
                vscodeApi: vscode,
                diagnosticsService,
                documentAnalysisService,
                derivedDiagnosticsService:
                    callGraphDiagnosticsService,
                languageId:
                    config.languageId,
                debounceMs:
                    config
                        .diagnosticsDebounceMs,
                developerLogger:
                    options.developerLogger ??
                    console
            });

        requirePort(
            staticDiagnosticsProvider,
            "staticDiagnosticsProvider",
            [
                "start",
                "refresh",
                "dispose"
            ]
        );

        lifecycle.add(
            staticDiagnosticsProvider
        );
        staticDiagnosticsProvider.start();

        const symbolNavigationProvider =
            options
                .symbolNavigationProvider ??
            new CLRSSymbolNavigationProvider({
                vscodeApi: vscode,
                documentAnalysisService,
                languageId:
                    config.languageId,
                developerLogger:
                    options.developerLogger ??
                    console
            });

        requirePort(
            symbolNavigationProvider,
            "symbolNavigationProvider",
            [
                "provideDocumentSymbols",
                "provideDefinition",
                "provideReferences",
                "dispose"
            ]
        );

        lifecycle.add(
            symbolNavigationProvider
        );

        const callHierarchyProvider =
            options.callHierarchyProvider ??
            new CLRSCallHierarchyProvider({
                vscodeApi: vscode,
                documentAnalysisService,
                languageId:
                    config.languageId,
                developerLogger:
                    options.developerLogger ??
                    console
            });

        requirePort(
            callHierarchyProvider,
            "callHierarchyProvider",
            [
                "prepareCallHierarchy",
                "provideCallHierarchyIncomingCalls",
                "provideCallHierarchyOutgoingCalls",
                "dispose"
            ]
        );

        lifecycle.add(
            callHierarchyProvider
        );

        const languageIntelligenceService =
            options
                .languageIntelligenceService ??
            new LanguageIntelligenceService();

        requirePort(
            languageIntelligenceService,
            "languageIntelligenceService",
            [
                "getCompletions",
                "getHover",
                "getSignatureHelp",
                "getInlayHints"
            ]
        );

        const languageIntelligenceProvider =
            options
                .languageIntelligenceProvider ??
            new CLRSLanguageIntelligenceProvider({
                vscodeApi: vscode,
                documentAnalysisService,
                intelligenceService:
                    languageIntelligenceService,
                languageId:
                    config.languageId,
                developerLogger:
                    options.developerLogger ??
                    console
            });

        requirePort(
            languageIntelligenceProvider,
            "languageIntelligenceProvider",
            [
                "provideCompletionItems",
                "provideHover",
                "provideSignatureHelp",
                "provideInlayHints",
                "dispose"
            ]
        );

        lifecycle.add(
            languageIntelligenceProvider
        );

        const semanticTokenService =
            options.semanticTokenService ??
            new SemanticTokenService();

        requirePort(
            semanticTokenService,
            "semanticTokenService",
            ["getDocumentTokens"]
        );

        const semanticTokensProvider =
            options.semanticTokensProvider ??
            new CLRSSemanticTokensProvider({
                vscodeApi: vscode,
                documentAnalysisService,
                semanticTokenService,
                languageId:
                    config.languageId,
                developerLogger:
                    options.developerLogger ??
                    console
            });

        requirePort(
            semanticTokensProvider,
            "semanticTokensProvider",
            [
                "provideDocumentSemanticTokens",
                "dispose"
            ]
        );

        lifecycle.add(
            semanticTokensProvider
        );

        const renameService =
            options.renameService ??
            new RenameService();

        requirePort(
            renameService,
            "renameService",
            [
                "prepareRename",
                "planRename"
            ]
        );

        const renameProvider =
            options.renameProvider ??
            new CLRSRenameProvider({
                vscodeApi: vscode,
                documentAnalysisService,
                renameService,
                languageId:
                    config.languageId,
                developerLogger:
                    options.developerLogger ??
                    console
            });

        requirePort(
            renameProvider,
            "renameProvider",
            [
                "prepareRename",
                "provideRenameEdits",
                "dispose"
            ]
        );

        lifecycle.add(renameProvider);

        const formatter =
            options.formatter ??
            new CLRSFormatter();

        requirePort(
            formatter,
            "formatter",
            ["format"]
        );

        const formattingProvider =
            options.formattingProvider ??
            new CLRSDocumentFormattingProvider({
                vscodeApi: vscode,
                documentAnalysisService,
                formatter,
                languageId:
                    config.languageId,
                developerLogger:
                    options.developerLogger ??
                    console
            });

        requirePort(
            formattingProvider,
            "formattingProvider",
            [
                "provideDocumentFormattingEdits",
                "dispose"
            ]
        );

        lifecycle.add(formattingProvider);

        const correctionPlanner =
            options.correctionPlanner ??
            new CLRSCorrectionPlanner();

        requirePort(
            correctionPlanner,
            "correctionPlanner",
            ["planInequivocalCorrections"]
        );

        const correctionExplanationPlanner =
            options
                .correctionExplanationPlanner ??
            new CLRSCorrectionExplanationPlanner();

        requirePort(
            correctionExplanationPlanner,
            "correctionExplanationPlanner",
            ["planExplanatoryCorrections"]
        );

        const codeActionProvider =
            options.codeActionProvider ??
            new CLRSCodeActionProvider({
                vscodeApi: vscode,
                documentAnalysisService,
                correctionPlanner,
                explanationPlanner:
                    correctionExplanationPlanner,
                languageId:
                    config.languageId,
                developerLogger
            });

        requirePort(
            codeActionProvider,
            "codeActionProvider",
            [
                "provideCodeActions",
                "presentExplanation",
                "dispose"
            ]
        );

        lifecycle.add(codeActionProvider);

        const htmlLoader =
            options.loadWebviewHtml ??
            (
                (webview, extensionUri) =>
                    loadWebviewHtml(
                        webview,
                        extensionUri,
                        vscode,
                        { performanceMonitor }
                    )
            );
        const diagramHost =
            options.diagramHost ??
            new VSCodeDiagramHost(
                vscode,
                htmlLoader,
                {
                    ...config,
                    documentResolver:
                        clrsDocumentResolver
                }
            );
        const diagramController =
            options.diagramController ??
            new DiagramCommandController({
                host: diagramHost,
                presenter,
                executionTraceService,
                testCoverageStore:
                    clrsTestCoverageStore,
                documentAnalysisService,
                executeDocument: document =>
                    codeController.runDocument(
                        context.extensionPath,
                        document
                    ),
                stopDocument: () =>
                    codeController.stopProgram(),
                developerLogger:
                    options.developerLogger ??
                    console,
                initialSourceDelay:
                    config
                        .diagramInitialSourceDelay,
                performanceMonitor
            });

        lifecycle.add(diagramController);

        const reportBuilder =
            options.complexityReportBuilder ??
            complexityReportBuilder;
        const reportHtmlLoader =
            options.loadComplexityReportHtml ??
            (
                (webview, extensionUri) =>
                    loadWebviewHtml(
                        webview,
                        extensionUri,
                        vscode,
                        {
                            mode:
                                "complexity-report",
                            performanceMonitor
                        }
                    )
            );
        const complexityReportHost =
            options.complexityReportHost ??
            new VSCodeComplexityReportHost(
                vscode,
                reportHtmlLoader,
                config
            );
        const complexityReportController =
            options.complexityReportController ??
            new ComplexityReportController({
                host:
                    complexityReportHost,
                presenter,
                documentAnalysisService,
                reportBuilder,
                updateDelay:
                    config
                        .complexityReportUpdateDelay,
                developerLogger:
                    options.developerLogger ??
                    console,
                performanceMonitor
            });

        lifecycle.add(
            complexityReportController
        );

        const brokerHtmlLoader =
            options.loadBrokerWebviewHtml ??
            (
                (webview, extensionUri) =>
                    loadWebviewHtml(
                        webview,
                        extensionUri,
                        vscode,
                        {
                            mode: "broker95",
                            performanceMonitor
                        }
                    )
            );
        const brokerHost =
            options.brokerHost ??
            new VSCodeBrokerHost(
                vscode,
                brokerHtmlLoader,
                config
            );
        const brokerController =
            options.brokerController ??
            new BrokerCommandController({
                host: brokerHost,
                presenter,
                gameSession:
                    brokerGameSession,
                configuration:
                    brokerLlmAvailability,
                configurationCommands:
                    brokerConfigurationService,
                llm: brokerLlmPort,
                contractCycle:
                    brokerContractCycle,
                learningContractService:
                    brokerLearningContractService,
                learningCatalogs:
                    brokerLearningCatalogs,
                economy:
                    brokerEconomy,
                submissionReview:
                    brokerSubmissionReview,
                submissionAsk:
                    brokerSubmissionAsk,
                submissionPush:
                    brokerSubmissionPush,
                initialize: async () => {
                    await Promise.all([
                        brokerGameReady,
                        brokerConfigurationReady,
                        brokerConversationReady
                    ]);
                },
                createSessionId:
                    options
                        .createBrokerSessionId,
                developerLogger,
                performanceMonitor
            });

        lifecycle.add(brokerController);

        const codeRegistration =
            registerCodeCommands(
                context,
                {
                    vscodeApi: vscode,
                    controller:
                        codeController,
                    codeLensProvider,
                    costDecorator,
                    viewState,
                    lifecycle,
                    config
                }
            );
        const diagramRegistration =
            registerDiagramCommands(
                context,
                {
                    vscodeApi: vscode,
                    controller:
                        diagramController,
                    lifecycle
                }
            );
        const complexityReportRegistration =
            registerComplexityReportCommands(
                context,
                {
                    vscodeApi: vscode,
                    controller:
                        complexityReportController,
                    lifecycle
                }
            );
        const brokerRegistration =
            registerBrokerCommands(
                context,
                {
                    vscodeApi: vscode,
                    controller:
                        brokerController,
                    lifecycle
                }
            );
        const debugRegistration =
            registerDebugCommands({
                vscodeApi: vscode,
                controller:
                    debugController,
                configurationProvider:
                    debugConfigurationProvider,
                adapterFactory:
                    debugAdapterFactory,
                lifecycle,
                debugType:
                    config.debugType
            });
        const navigationRegistration =
            registerLanguageNavigation({
                vscodeApi: vscode,
                provider:
                    symbolNavigationProvider,
                callHierarchyProvider,
                lifecycle,
                languageId:
                    config.languageId
            });
        const intelligenceRegistration =
            registerLanguageIntelligence({
                vscodeApi: vscode,
                provider:
                    languageIntelligenceProvider,
                lifecycle,
                languageId:
                    config.languageId
            });
        const semanticTokensRegistration =
            registerSemanticTokens({
                vscodeApi: vscode,
                provider:
                    semanticTokensProvider,
                lifecycle,
                languageId:
                    config.languageId
            });
        const refactoringRegistration =
            registerLanguageRefactoring({
                vscodeApi: vscode,
                provider: renameProvider,
                lifecycle,
                languageId:
                    config.languageId
            });
        const formattingRegistration =
            registerLanguageFormatting({
                vscodeApi: vscode,
                provider:
                    formattingProvider,
                lifecycle,
                languageId:
                    config.languageId
            });
        const correctionsRegistration =
            registerLanguageCorrections({
                vscodeApi: vscode,
                provider:
                    codeActionProvider,
                lifecycle,
                languageId:
                    config.languageId
            });
        const gettingStartedRegistration =
            registerGettingStartedCommands({
                vscodeApi: vscode,
                lifecycle,
                languageId:
                    config.languageId
            });
        const contextualStartRegistration =
            registerContextualStartCommands({
                vscodeApi: vscode,
                lifecycle,
                languageId:
                    config.languageId
            });
        const copilotRegistration =
            registerCopilotCommands({
                vscodeApi: vscode,
                lifecycle,
                extensionPath:
                    context.extensionPath
            });
        const application = {
            config,
            lifecycle,
            performance:
                performanceMonitor,
            compilationService,
            diagnosticsService,
            callGraphDiagnosticsService,
            documentAnalysisService,
            languageIntelligenceService,
            semanticTokenService,
            renameService,
            formatter,
            correctionPlanner,
            correctionExplanationPlanner,
            executionTraceService,
            debugExecutionTraceService,
            testing: Object.freeze({
                workspace: clrsTestWorkspace,
                discovery: clrsTestDiscovery,
                controller: clrsTestController,
                executor: clrsTestExecutor,
                processRunner:
                    clrsTestProcessRunner,
                resultPresenter:
                    clrsTestResultPresenter,
                coveragePresenter:
                    clrsTestCoveragePresenter,
                coverageStore:
                    clrsTestCoverageStore,
                runController:
                    clrsTestRunController,
                get runProfile() {
                    return clrsTestRunController
                        .profile;
                },
                debugController:
                    clrsTestDebugController,
                get debugProfile() {
                    return clrsTestDebugController
                        .profile;
                },
                brokerIntegration:
                    brokerClrsTestIntegration,
                ready: clrsTestDiscoveryReady
            }),
            broker95: Object.freeze({
                repository:
                    brokerGameRepository,
                session:
                    brokerGameSession,
                ready: brokerGameReady,
                configuration:
                    brokerConfiguration,
                providerRegistry:
                    brokerProviderRegistry,
                lmStudioLocalService:
                    brokerLmStudioLocalService,
                configurationReady:
                    brokerConfigurationReady,
                conversation:
                    brokerConversation,
                conversationReady:
                    brokerConversationReady,
                conversationService:
                    brokerConversationService,
                contractService:
                    brokerContractService,
                contractCycle:
                    brokerContractCycle,
                learningContractService:
                    brokerLearningContractService,
                economy:
                    brokerEconomy,
                documentCapture:
                    brokerDocumentCapture,
                staticEvidence:
                    brokerStaticEvidence,
                testExecution:
                    brokerTestExecution,
                nativeTests:
                    brokerClrsTestIntegration,
                submissionReview:
                    brokerSubmissionReview,
                submissionAsk:
                    brokerSubmissionAsk,
                submissionEvaluation:
                    brokerSubmissionEvaluation,
                submissionPush:
                    brokerSubmissionPush
            }),
            useCases: Object.freeze({
                generateJavaScript:
                    generateJavaScriptUseCase,
                analyzeCost:
                    analyzeCostUseCase
            }),
            presenter,
            viewState,
            hosts: Object.freeze({
                code: codeHost,
                debugCode: debugCodeHost,
                diagram: diagramHost,
                complexityReport:
                    complexityReportHost,
                broker: brokerHost,
                brokerDocument:
                    brokerDocumentHost,
                debug: debugHost
            }),
            controllers: Object.freeze({
                code: codeController,
                diagram:
                    diagramController,
                complexityReport:
                    complexityReportController,
                broker:
                    brokerController,
                debug:
                    debugController
            }),
            providers: Object.freeze({
                codeLens:
                    codeLensProvider,
                costDecorator,
                staticDiagnostics:
                    staticDiagnosticsProvider,
                symbolNavigation:
                    symbolNavigationProvider,
                callHierarchy:
                    callHierarchyProvider,
                intelligence:
                    languageIntelligenceProvider,
                semanticTokens:
                    semanticTokensProvider,
                rename: renameProvider,
                formatting:
                    formattingProvider,
                codeActions:
                    codeActionProvider,
                debugConfiguration:
                    debugConfigurationProvider,
                debugAdapterFactory
            }),
            registrations:
                Object.freeze({
                    code:
                        codeRegistration,
                    diagram:
                        diagramRegistration,
                    complexityReport:
                        complexityReportRegistration,
                    broker:
                        brokerRegistration,
                    debugging:
                        debugRegistration,
                    navigation:
                        navigationRegistration,
                    intelligence:
                        intelligenceRegistration,
                    semanticTokens:
                        semanticTokensRegistration,
                    refactoring:
                        refactoringRegistration,
                    formatting:
                        formattingRegistration,
                    corrections:
                        correctionsRegistration,
                    gettingStarted:
                        gettingStartedRegistration,
                    contextualStart:
                        contextualStartRegistration,
                    copilot:
                        copilotRegistration
                }),
            dispose() {
                lifecycle.dispose();
            }
        };

        context.subscriptions.push(
            application
        );

        return Object.freeze(application);
    } catch (error) {
        lifecycle.dispose();
        throw error;
    }
}

function openAICompatibleFetch(options, providerId) {
    const providerFetch = {
        [BrokerLLMProviderId.LM_STUDIO]:
            options.brokerLmStudioFetch,
        [BrokerLLMProviderId.XAI]:
            options.brokerXaiFetch,
        [BrokerLLMProviderId.TOGETHER]:
            options.brokerTogetherFetch,
        [BrokerLLMProviderId.ZAI]:
            options.brokerZaiFetch,
        [BrokerLLMProviderId.HUGGING_FACE]:
            options.brokerHuggingFaceFetch,
        [BrokerLLMProviderId.OPENROUTER]:
            options.brokerOpenRouterFetch
    }[providerId];

    return providerFetch ??
        options.brokerOpenAICompatibleFetch ??
        options.brokerFetch;
}
