import path from "node:path";

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
    VSCodeCodeHost
} from "../adapters/VSCodeCodeHost.js";
import {
    VSCodeDiagramHost
} from "../adapters/VSCodeDiagramHost.js";
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
    VSCodeNotificationPresenter
} from "../presenters/VSCodeNotificationPresenter.js";
import {
    CLRSCodeLensProvider
} from "../providers/CodeLensProvider.js";
import {
    CLRSCostDecorator
} from "../providers/DecoratorProvider.js";
import {
    CLRSStaticDiagnosticsProvider
} from "../providers/StaticDiagnosticsProvider.js";
import {
    createViewState
} from "../providers/ViewState.js";

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

    requirePort(
        vscode.commands,
        "vscodeApi.commands",
        ["registerCommand"]
    );
    requirePort(
        vscode.languages,
        "vscodeApi.languages",
        [
            "registerCodeLensProvider",
            "createDiagnosticCollection"
        ]
    );
    requirePort(
        vscode.window,
        "vscodeApi.window",
        [
            "showInformationMessage",
            "showErrorMessage",
            "createTextEditorDecorationType",
            "onDidChangeActiveTextEditor",
            "onDidChangeVisibleTextEditors"
        ]
    );
    requirePort(
        vscode.workspace,
        "vscodeApi.workspace",
        [
            "onDidOpenTextDocument",
            "onDidChangeTextDocument",
            "onDidSaveTextDocument",
            "onDidCloseTextDocument"
        ]
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

    try {
        const compilationService =
            options.compilationService ??
            new CompilationService();
        const diagnosticsService =
            options.diagnosticsService ??
            new LanguageDiagnosticsService();
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
        const viewState =
            options.viewState ??
            createViewState(
                config.initialShowCost
            );
        const codeHost =
            options.codeHost ??
            new VSCodeCodeHost(
                vscode,
                config
            );

        lifecycle.add(codeHost);

        const codeController =
            options.codeController ??
            new CodeCommandController({
                host: codeHost,
                presenter,
                generateJavaScriptUseCase,
                path:
                    options.path ?? path
            });
        const codeLensProvider =
            options.codeLensProvider ??
            new CLRSCodeLensProvider({
                analyzeCostUseCase,
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

        const htmlLoader =
            options.loadWebviewHtml ??
            (
                (webview, extensionUri) =>
                    loadWebviewHtml(
                        webview,
                        extensionUri,
                        vscode
                    )
            );
        const diagramHost =
            options.diagramHost ??
            new VSCodeDiagramHost(
                vscode,
                htmlLoader,
                config
            );
        const diagramController =
            options.diagramController ??
            new DiagramCommandController({
                host: diagramHost,
                presenter,
                initialSourceDelay:
                    config
                        .diagramInitialSourceDelay
            });

        lifecycle.add(diagramController);

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
        const application = {
            config,
            lifecycle,
            compilationService,
            diagnosticsService,
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
                diagram: diagramHost
            }),
            controllers: Object.freeze({
                code: codeController,
                diagram:
                    diagramController
            }),
            providers: Object.freeze({
                codeLens:
                    codeLensProvider,
                costDecorator,
                staticDiagnostics:
                    staticDiagnosticsProvider
            }),
            registrations:
                Object.freeze({
                    code:
                        codeRegistration,
                    diagram:
                        diagramRegistration
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
