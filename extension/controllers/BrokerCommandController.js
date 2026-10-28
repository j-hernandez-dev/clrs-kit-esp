import {
    randomUUID
} from "node:crypto";

import {
    applicationFailure,
    applicationSuccess
} from "../../src/application/ApplicationResult.js";
import {
    requireFunction,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    BrokerHostMessageType,
    BrokerTerminalEntryKind,
    BrokerWebviewRequestGuard,
    BrokerWebviewMessageType,
    createBrokerHostMessage,
    parseBrokerWebviewMessage
} from "../../src/broker95/protocol/index.js";
import {
    clearBrokerCategoryHistory,
    resetBrokerGameProgress
} from "../../src/broker95/core/index.js";
import {
    assertBrokerLlmAvailable
} from "../../src/broker95/llm/BrokerLlmAvailability.js";
import {
    createBrokerLlmConfigurationStatus
} from "../../src/broker95/configuration/BrokerLlmConfigurationStatus.js";
import {
    BrokerLLMProviderId
} from "../../src/broker95/llm/BrokerLLMProvider.js";
import {
    BrokerTerminalCommandType
} from "../../src/broker95/terminal/BrokerTerminalCommand.js";
import {
    parseBrokerTerminalInput
} from "../../src/broker95/terminal/BrokerTerminalParser.js";
import {
    formatBrokerSubmissionAsk
} from "../../src/broker95/submission/BrokerSubmissionAskFormatter.js";
import {
    formatBrokerSubmissionReview
} from "../../src/broker95/submission/BrokerSubmissionReviewFormatter.js";
import {
    formatBrokerSubmissionPush
} from "../../src/broker95/submission/BrokerSubmissionPushFormatter.js";
import {
    formatBrokerLearningContractCreated
} from "../../src/broker95/contracts/BrokerLearningContractTerminalFormatter.js";
import {
    getBrokerLearningRouteProgress
} from "../../src/broker95/learning/BrokerLearningRoutesProgress.js";

export class BrokerCommandController {

    constructor(options = {}) {
        this.host = requirePort(
            options.host,
            "brokerHost",
            ["createPanel"]
        );
        this.presenter = requirePort(
            options.presenter,
            "notificationPresenter",
            ["present"]
        );
        this.gameSession = requirePort(
            options.gameSession,
            "brokerGameSession",
            ["getState", "subscribe"]
        );
        this.configuration = requirePort(
            options.configuration,
            "brokerPublicConfiguration",
            ["getSnapshot", "subscribe"]
        );
        this.configurationCommands =
            options.configurationCommands == null
                ? null
                : requirePort(
                    options.configurationCommands,
                    "brokerConfigurationCommands",
                    [
                        "setProvider",
                        "setModel",
                        "setBaseUrl",
                        "setAudioPreferences",
                        "setApiKey",
                        "deleteApiKey"
                    ]
                );
        this.llm = options.llm == null
            ? null
            : requirePort(
                options.llm,
                "brokerLlmPort",
                ["testConnection"]
            );
        this.lmStudioLocalService =
            options.lmStudioLocalService == null
                ? null
                : requirePort(
                    options.lmStudioLocalService,
                    "lmStudioLocalService",
                    ["discoverModels"]
                );
        this.contractCycle =
            options.contractCycle == null
                ? null
                : requirePort(
                    options.contractCycle,
                    "brokerContractCycle",
                    ["canExecute", "execute"]
                );
        this.learningContractService =
            options.learningContractService == null
                ? null
                : requirePort(
                    options.learningContractService,
                    "brokerLearningContractService",
                    ["obtain"]
                );
        this.learningCatalogs =
            options.learningCatalogs;
        this.economy =
            options.economy == null
                ? null
                : requirePort(
                    options.economy,
                    "brokerEconomy",
                    ["purchase"]
                );
        this.submissionReview =
            options.submissionReview == null
                ? null
                : requirePort(
                    options.submissionReview,
                    "brokerSubmissionReview",
                    ["review"]
                );
        this.submissionAsk =
            options.submissionAsk == null
                ? null
                : requirePort(
                    options.submissionAsk,
                    "brokerSubmissionAsk",
                    ["ask"]
                );
        this.submissionPush =
            options.submissionPush == null
                ? null
                : requirePort(
                    options.submissionPush,
                    "brokerSubmissionPush",
                    ["push"]
                );
        this.initialize = requireFunction(
            options.initialize,
            "initializeBroker95"
        );
        this.createSessionId =
            requireFunction(
                options.createSessionId ??
                    defaultSessionId,
                "createBrokerSessionId"
            );
        this.developerLogger =
            options.developerLogger ??
            console;
        this.performanceMonitor =
            options.performanceMonitor == null
                ? null
                : requirePort(
                    options.performanceMonitor,
                    "performanceMonitor",
                    ["now", "record"]
                );
        this.requestGuard = requirePort(
            options.requestGuard ??
                new BrokerWebviewRequestGuard(),
            "brokerWebviewRequestGuard",
            ["begin", "reset"]
        );
        this.panel = null;
        this.extensionContext = null;
        this.panelResources = [];
        this.sessionId = null;
        this.webviewReady = false;
        this.webviewOpenedAt = null;
        this.configurationMutationDepth = 0;
        this.terminalOperationQueue =
            Promise.resolve();
        this.terminalEntrySequence = 0;
        this.terminalCreatedOrder = 0;
        this.cipherStreamSequence = 0;
        this.activeReviewAbortController = null;
        this.activeAskAbortController = null;
        this.activePushAbortController = null;
        this.activeConnectionAbortController = null;
        this.activeLmStudioDiscoveryAbortController =
            null;
        this.disposed = false;
    }

    open(context) {
        if (this.disposed) {
            return this.#presentFailure(
                new Error(
                    "BROKER.95 command controller is disposed."
                )
            );
        }

        if (this.panel) {
            this.panel.reveal();

            return applicationSuccess({
                panel: this.panel,
                sessionId: this.sessionId,
                reused: true
            });
        }

        try {
            const panel = requirePort(
                this.host.createPanel(context),
                "brokerPanel",
                [
                    "postMessage",
                    "onMessage",
                    "onDispose",
                    "reveal",
                    "dispose"
                ]
            );

            this.panel = panel;
            this.extensionContext = context;
            this.sessionId =
                normalizeSessionId(
                    this.createSessionId()
                );
            this.webviewReady = false;
            this.webviewOpenedAt =
                this.performanceMonitor?.now() ??
                null;
            this.panelResources = [
                panel.onMessage(message => {
                    void this.handleMessage(
                        message,
                        panel
                    ).catch(error => {
                        this.#logPostFailure(
                            error
                        );
                    });
                }),
                panel.onDispose(() => {
                    if (this.panel === panel) {
                        this.#releasePanel(false);
                    }
                }),
                this.gameSession.subscribe(
                    state => {
                        this.#postStateUpdate(
                            panel,
                            state
                        );
                    }
                ),
                this.configuration.subscribe(
                    snapshot => {
                        this.#postConfigurationUpdate(
                            panel,
                            snapshot
                        );
                    }
                )
            ];

            return applicationSuccess({
                panel,
                sessionId: this.sessionId,
                reused: false
            });
        } catch (error) {
            this.#releasePanel(true);
            return this.#presentFailure(error);
        }
    }

    async handleMessage(rawMessage, panel = this.panel) {
        if (!panel || panel !== this.panel) {
            return applicationSuccess({
                ignored: true,
                reason: "stale-panel"
            });
        }

        let message;

        try {
            message = parseBrokerWebviewMessage(
                rawMessage
            );
        } catch (error) {
            await this.#postError(
                panel,
                error,
                null,
                null
            );

            return applicationFailure(error);
        }

        let requestLease;

        try {
            requestLease =
                this.requestGuard.begin(message);
        } catch (error) {
            await this.#postError(
                panel,
                error,
                message.requestId,
                message.type,
                error?.code ??
                    "BROKER95_PROTOCOL_REQUEST_REJECTED",
                error?.publicMessage ??
                    "La solicitud de BROKER.95 fue rechazada."
            );

            return applicationFailure(error);
        }

        try {
            if (
                message.type ===
                    BrokerWebviewMessageType.READY ||
                message.type ===
                    BrokerWebviewMessageType.REQUEST_STATE
            ) {
                if (
                    message.type ===
                    BrokerWebviewMessageType.READY
                ) {
                    this.#recordWebviewReady();
                }

                return await this.#postReady(
                    panel,
                    message.requestId
                );
            }

            if (
                message.type ===
                    BrokerWebviewMessageType
                        .TEST_LLM_CONNECTION
            ) {
                if (!this.llm) {
                    return await this.#operationUnavailable(
                        panel,
                        message
                    );
                }

                return await this.#testLlmConnection(
                    panel,
                    message
                );
            }

            if (
                message.type ===
                    BrokerWebviewMessageType
                        .DISCOVER_LM_STUDIO_MODELS
            ) {
                if (!this.lmStudioLocalService) {
                    return await this.#operationUnavailable(
                        panel,
                        message
                    );
                }

                return await this
                    .#discoverLmStudioModels(
                        panel,
                        message
                    );
            }

            if (
                message.type ===
                    BrokerWebviewMessageType.SET_PROVIDER ||
                message.type ===
                    BrokerWebviewMessageType.SET_MODEL ||
                message.type ===
                    BrokerWebviewMessageType.SET_BASE_URL ||
                message.type ===
                    BrokerWebviewMessageType.SET_AUDIO ||
                message.type ===
                    BrokerWebviewMessageType.SET_API_KEY ||
                message.type ===
                    BrokerWebviewMessageType.DELETE_API_KEY
            ) {
                return await this.#applyConfiguration(
                    panel,
                    message
                );
            }

            if (
                message.type ===
                    BrokerWebviewMessageType
                        .OBTAIN_LEARNING_CONTRACT
            ) {
                if (!this.learningContractService) {
                    return await this.#operationUnavailable(
                        panel,
                        message
                    );
                }

                return await this.#enqueueTerminalOperation(
                    () => this.#obtainLearningContract(
                        panel,
                        message
                    )
                );
            }

            if (
                message.type ===
                    BrokerWebviewMessageType
                        .PURCHASE_COUNTERMEASURE
            ) {
                if (!this.economy) {
                    return await this.#operationUnavailable(
                        panel,
                        message
                    );
                }

                return await this.#enqueueTerminalOperation(
                    () => this.#purchaseCountermeasure(
                        panel,
                        message
                    )
                );
            }

            if (
                message.type ===
                    BrokerWebviewMessageType
                        .CLEAR_CATEGORY_HISTORY ||
                message.type ===
                    BrokerWebviewMessageType
                        .RESET_GAME_PROGRESS
            ) {
                return await this.#enqueueTerminalOperation(
                    () => this.#executePanelAction(
                        panel,
                        message
                    )
                );
            }

            if (
                message.type ===
                BrokerWebviewMessageType.SUBMIT_TERMINAL
            ) {
                return await this.#submitTerminal(
                    panel,
                    message
                );
            }

            return await this.#operationUnavailable(
                panel,
                message
            );
        } finally {
            requestLease.release();
        }
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.#releasePanel(true);
    }

    async #postReady(panel, requestId) {
        try {
            await this.initialize();

            if (panel !== this.panel) {
                return applicationSuccess({
                    ignored: true,
                    reason: "stale-panel"
                });
            }

            const configuration =
                this.configuration.getSnapshot();
            const message =
                createBrokerHostMessage({
                    type:
                        BrokerHostMessageType.READY,
                    requestId,
                    payload: {
                        sessionId:
                            this.sessionId,
                        state:
                            this.gameSession
                                .getState(),
                        settings:
                            configuration.settings,
                        llmStatus:
                            configuration.llmStatus
                    }
                }, {
                    catalogs:
                        this.learningCatalogs
                });

            await panel.postMessage(message);
            this.webviewReady = true;

            return applicationSuccess({
                message,
                sessionId: this.sessionId
            });
        } catch (error) {
            this.webviewReady = false;
            await this.#postError(
                panel,
                error,
                requestId,
                BrokerWebviewMessageType.READY,
                "BROKER95_INITIALIZATION_FAILED",
                "No fue posible iniciar BROKER.95."
            );

            return applicationFailure(error);
        }
    }

    #recordWebviewReady() {
        if (
            this.performanceMonitor == null ||
            this.webviewOpenedAt == null
        ) {
            return false;
        }

        const duration = Math.max(
            0,
            this.performanceMonitor.now() -
                this.webviewOpenedAt
        );

        this.webviewOpenedAt = null;
        return this.performanceMonitor.record(
            "webview.broker95.ready",
            duration
        );
    }

    #postStateUpdate(panel, state) {
        if (
            !this.webviewReady ||
            panel !== this.panel
        ) {
            return false;
        }

        this.#postEvent(
            panel,
            createBrokerHostMessage({
                type:
                    BrokerHostMessageType
                        .STATE_UPDATED,
                payload: {
                    state,
                    reason: "game/state-changed"
                }
            }, {
                catalogs:
                    this.learningCatalogs
            })
        );

        return true;
    }

    #postConfigurationUpdate(
        panel,
        snapshot
    ) {
        if (
            !this.webviewReady ||
            panel !== this.panel ||
            this.configurationMutationDepth > 0
        ) {
            return false;
        }

        this.#postEvent(
            panel,
            createBrokerHostMessage({
                type:
                    BrokerHostMessageType
                        .SETTINGS_UPDATED,
                payload: {
                    settings: snapshot.settings
                }
            })
        );
        this.#postEvent(
            panel,
            createBrokerHostMessage({
                type:
                    BrokerHostMessageType
                        .LLM_STATUS,
                payload: {
                    llmStatus:
                        snapshot.llmStatus
                }
            })
        );

        return true;
    }

    async #applyConfiguration(
        panel,
        message
    ) {
        if (!this.configurationCommands) {
            return this.#operationUnavailable(
                panel,
                message
            );
        }

        this.configurationMutationDepth += 1;

        try {
            switch (message.type) {
                case BrokerWebviewMessageType
                    .SET_PROVIDER:
                    await this.configurationCommands
                        .setProvider(
                            message.payload.providerId
                        );
                    break;

                case BrokerWebviewMessageType
                    .SET_MODEL:
                    await this.configurationCommands
                        .setModel(
                            message.payload.model
                        );
                    break;

                case BrokerWebviewMessageType
                    .SET_BASE_URL:
                    await this.configurationCommands
                        .setBaseUrl(
                            message.payload.baseUrl
                        );
                    break;

                case BrokerWebviewMessageType
                    .SET_AUDIO:
                    await this.configurationCommands
                        .setAudioPreferences(
                            message.payload
                        );
                    break;

                case BrokerWebviewMessageType
                    .SET_API_KEY:
                    await this.configurationCommands
                        .setApiKey(
                            message.payload.apiKey
                        );
                    break;

                case BrokerWebviewMessageType
                    .DELETE_API_KEY:
                    await this.configurationCommands
                        .deleteApiKey();
                    break;

                default:
                    break;
            }

            const snapshot =
                this.configuration.getSnapshot();

            if (panel !== this.panel) {
                return applicationSuccess({
                    ignored: true,
                    reason: "stale-panel"
                });
            }

            await panel.postMessage(
                createBrokerHostMessage({
                    type:
                        BrokerHostMessageType
                            .SETTINGS_UPDATED,
                    requestId:
                        message.requestId,
                    payload: {
                        settings:
                            snapshot.settings
                    }
                })
            );
            await panel.postMessage(
                createBrokerHostMessage({
                    type:
                        BrokerHostMessageType
                            .LLM_STATUS,
                    payload: {
                        llmStatus:
                            snapshot.llmStatus
                    }
                })
            );

            return applicationSuccess({
                settings: snapshot.settings,
                llmStatus: snapshot.llmStatus
            });
        } catch (error) {
            await this.#postError(
                panel,
                error,
                message.requestId,
                message.type,
                null,
                error?.publicMessage ??
                    "No fue posible guardar la configuración de BROKER.95."
            );

            return applicationFailure(error);
        } finally {
            this.configurationMutationDepth -= 1;
        }
    }

    async #operationUnavailable(panel, message) {
        const error = new Error(
            `BROKER.95 operation is not implemented in this block: ${message.type}.`
        );

        await this.#postError(
            panel,
            error,
            message.requestId,
            message.type,
            "BROKER95_OPERATION_NOT_AVAILABLE",
            "Esta operación de BROKER.95 todavía no está disponible."
        );

        return applicationFailure(error);
    }

    async #testLlmConnection(panel, message) {
        const operation = "llm/test-connection";
        const abortController =
            new AbortController();

        this.activeConnectionAbortController
            ?.abort();
        this.activeConnectionAbortController =
            abortController;
        this.#postEvent(
            panel,
            createBrokerHostMessage({
                type:
                    BrokerHostMessageType
                        .OPERATION_STATUS,
                payload: {
                    status: "busy",
                    operation
                }
            })
        );

        try {
            const snapshot =
                this.configuration.getSnapshot();

            assertBrokerLlmAvailable(
                createBrokerLlmConfigurationStatus(snapshot.settings)
            );

            const result = await this.llm
                .testConnection(
                    {
                        requestId:
                            message.requestId,
                        model:
                            snapshot.settings.model
                    },
                    {
                        signal:
                            abortController.signal
                    }
                );

            if (panel !== this.panel) {
                return applicationSuccess({
                    ignored: true,
                    reason: "stale-panel"
                });
            }

            const hostMessage =
                createBrokerHostMessage({
                    type:
                        BrokerHostMessageType
                            .LLM_CONNECTION_RESULT,
                    requestId:
                        message.requestId,
                    payload: {
                        providerId:
                            result.providerId,
                        model: result.model,
                        connected: true,
                        message:
                            result.output.message
                    }
                });

            await panel.postMessage(hostMessage);

            return applicationSuccess({
                providerId: result.providerId,
                model: result.model,
                connected: true
            });
        } catch (error) {
            await this.#postError(
                panel,
                error,
                message.requestId,
                message.type,
                error?.code ??
                    "BROKER95_LLM_CONNECTION_TEST_FAILED",
                error?.publicMessage ??
                    "No fue posible comprobar el enlace con CIPHER."
            );

            return applicationFailure(error);
        } finally {
            if (
                this.activeConnectionAbortController ===
                    abortController
            ) {
                this.activeConnectionAbortController =
                    null;
            }

            if (panel === this.panel) {
                this.#postEvent(
                    panel,
                    createBrokerHostMessage({
                        type:
                            BrokerHostMessageType
                                .OPERATION_STATUS,
                        payload: {
                            status: "idle",
                            operation: null
                        }
                    })
                );
            }
        }
    }

    async #discoverLmStudioModels(
        panel,
        message
    ) {
        const operation =
            "llm/discover-lm-studio-models";
        const abortController =
            new AbortController();

        this.activeLmStudioDiscoveryAbortController
            ?.abort();
        this.activeLmStudioDiscoveryAbortController =
            abortController;
        this.#postEvent(
            panel,
            createBrokerHostMessage({
                type:
                    BrokerHostMessageType
                        .OPERATION_STATUS,
                payload: {
                    status: "busy",
                    operation
                }
            })
        );

        try {
            const snapshot =
                this.configuration.getSnapshot();

            if (
                snapshot.settings.providerId !==
                BrokerLLMProviderId.LM_STUDIO
            ) {
                const error = new Error(
                    "LM Studio model discovery requires the active LM Studio provider."
                );

                error.code =
                    "BROKER95_LM_STUDIO_NOT_SELECTED";
                error.publicMessage =
                    "Selecciona LM Studio antes de buscar modelos locales.";
                throw error;
            }

            const result = await this
                .lmStudioLocalService
                .discoverModels({
                    signal: abortController.signal
                });

            if (panel !== this.panel) {
                return applicationSuccess({
                    ignored: true,
                    reason: "stale-panel"
                });
            }

            await panel.postMessage(
                createBrokerHostMessage({
                    type:
                        BrokerHostMessageType
                            .LM_STUDIO_MODELS,
                    requestId:
                        message.requestId,
                    payload: result
                })
            );

            return applicationSuccess(result);
        } catch (error) {
            await this.#postError(
                panel,
                error,
                message.requestId,
                message.type,
                error?.code ??
                    "BROKER95_LM_STUDIO_DISCOVERY_FAILED",
                error?.publicMessage ??
                    "No fue posible consultar los modelos de LM Studio."
            );

            return applicationFailure(error);
        } finally {
            if (
                this.activeLmStudioDiscoveryAbortController ===
                    abortController
            ) {
                this.activeLmStudioDiscoveryAbortController =
                    null;
            }

            if (panel === this.panel) {
                this.#postEvent(
                    panel,
                    createBrokerHostMessage({
                        type:
                            BrokerHostMessageType
                                .OPERATION_STATUS,
                        payload: {
                            status: "idle",
                            operation: null
                        }
                    })
                );
            }
        }
    }

    async #executePanelAction(panel, message) {
        const clearHistory =
            message.type ===
            BrokerWebviewMessageType
                .CLEAR_CATEGORY_HISTORY;
        const operation = clearHistory
            ? "settings/clear-category-history"
            : "settings/reset-game-progress";

        this.#postEvent(
            panel,
            createBrokerHostMessage({
                type:
                    BrokerHostMessageType
                        .OPERATION_STATUS,
                payload: {
                    status: "busy",
                    operation
                }
            })
        );

        try {
            let state = null;

            if (clearHistory) {
                if (
                    typeof this.gameSession
                        .transact !== "function"
                ) {
                    return this.#operationUnavailable(
                        panel,
                        message
                    );
                }

                state = await this.gameSession
                    .transact(
                        clearBrokerCategoryHistory
                    );
            } else {
                if (
                    typeof this.gameSession
                        .transact !== "function"
                ) {
                    return this.#operationUnavailable(
                        panel,
                        message
                    );
                }

                state = await this.gameSession
                    .transact(
                        resetBrokerGameProgress
                    );
            }

            if (panel !== this.panel) {
                return applicationSuccess({
                    ignored: true,
                    reason: "stale-panel"
                });
            }

            const entries =
                this.#createTerminalEntries([{
                    kind:
                        BrokerTerminalEntryKind
                            .SYSTEM,
                    text: clearHistory
                        ? "Historial adaptativo de categorías limpiado. La partida, los contratos, el saldo y las estadísticas se conservaron."
                        : "Progreso de partida borrado. Contratos, saldo, alerta, estadísticas, perfil técnico y rutas de Aprendizaje se reiniciaron; el historial adaptativo de categorías se conservó."
                }]);
            const hostMessage =
                createBrokerHostMessage({
                    type:
                        BrokerHostMessageType
                            .TERMINAL_APPEND,
                    requestId:
                        message.requestId,
                    payload: { entries }
                });

            await panel.postMessage(hostMessage);

            return applicationSuccess({
                operation,
                stateRevision:
                    state?.revision ?? null,
                entries
            });
        } catch (error) {
            await this.#postError(
                panel,
                error,
                message.requestId,
                message.type,
                error?.code ??
                    "BROKER95_SETTINGS_ACTION_FAILED",
                clearHistory
                    ? "No fue posible limpiar el historial de categorías."
                    : "No fue posible borrar el progreso de la partida."
            );

            return applicationFailure(error);
        } finally {
            if (panel === this.panel) {
                this.#postEvent(
                    panel,
                    createBrokerHostMessage({
                        type:
                            BrokerHostMessageType
                                .OPERATION_STATUS,
                        payload: {
                            status: "idle",
                            operation: null
                        }
                    })
                );
            }
        }
    }

    async #submitTerminal(panel, message) {
        let command;

        try {
            command = parseBrokerTerminalInput(
                message.payload.input
            );
        } catch (error) {
            await this.#postError(
                panel,
                error,
                message.requestId,
                message.type,
                error?.code ??
                    "BROKER95_TERMINAL_INPUT_INVALID",
                error?.publicMessage ??
                    "La instrucción de terminal no es válida."
            );

            return applicationFailure(error);
        }

        if (command.requiresLlm) {
            try {
                assertBrokerLlmAvailable(
                    this.configuration
                        .getSnapshot()
                        .llmStatus
                );
            } catch (error) {
                await this.#postError(
                    panel,
                    error,
                    message.requestId,
                    message.type,
                    error?.code ??
                        "BROKER95_LLM_PROVIDER_ERROR",
                    error?.publicMessage ??
                        "CIPHER no está disponible en este momento."
                );

                return applicationFailure(error);
            }
        }

        if (
            command.type ===
                BrokerTerminalCommandType
                    .REVIEW_CODE &&
            this.submissionReview
        ) {
            return this.#enqueueTerminalOperation(
                () => this.#executeSubmissionReview(
                    panel,
                    message,
                    command
                )
            );
        }

        if (
            command.type ===
                BrokerTerminalCommandType
                    .ASK_CODE &&
            this.submissionAsk
        ) {
            return this.#enqueueTerminalOperation(
                () => this.#executeSubmissionAsk(
                    panel,
                    message,
                    command
                )
            );
        }

        if (
            command.type ===
                BrokerTerminalCommandType
                    .PUSH_CODE &&
            this.submissionPush
        ) {
            return this.#enqueueTerminalOperation(
                () => this.#executeSubmissionPush(
                    panel,
                    message,
                    command
                )
            );
        }

        if (
            !this.contractCycle ||
            !this.contractCycle.canExecute(command)
        ) {
            return this.#operationUnavailable(
                panel,
                message
            );
        }

        return this.#enqueueTerminalOperation(
            () => this.#executeContractCycle(
                panel,
                message,
                command
            )
        );
    }

    async #executeSubmissionReview(
        panel,
        message,
        command
    ) {
        const operation = "submission/review";
        const abortController =
            new AbortController();

        this.activeReviewAbortController =
            abortController;

        this.#postEvent(
            panel,
            createBrokerHostMessage({
                type:
                    BrokerHostMessageType
                        .OPERATION_STATUS,
                payload: {
                    status: "busy",
                    operation
                }
            })
        );

        try {
            const result = await this.submissionReview
                .review({
                    requestId:
                        message.requestId,
                    documentSelector:
                        command.documentSelector,
                    signal:
                        abortController.signal
                });

            if (panel !== this.panel) {
                return applicationSuccess({
                    ignored: true,
                    reason: "stale-panel"
                });
            }

            const hostMessage =
                createBrokerHostMessage({
                    type:
                        BrokerHostMessageType
                            .CIPHER_STREAM,
                    requestId:
                        message.requestId,
                    payload: {
                        streamId: this
                            .#nextCipherStreamId(),
                        phase: "end",
                        text:
                            formatBrokerSubmissionReview(
                                result
                            )
                    }
                });

            await panel.postMessage(hostMessage);

            return applicationSuccess({
                operation,
                contractId: result.contractId,
                document: result.document,
                review: result.review
            });
        } catch (error) {
            await this.#postError(
                panel,
                error,
                message.requestId,
                message.type,
                error?.code ??
                    "BROKER95_REVIEW_FAILED",
                error?.publicMessage ??
                    "No fue posible completar la revisión."
            );

            return applicationFailure(error);
        } finally {
            if (
                this.activeReviewAbortController ===
                    abortController
            ) {
                this.activeReviewAbortController = null;
            }

            if (panel === this.panel) {
                this.#postEvent(
                    panel,
                    createBrokerHostMessage({
                        type:
                            BrokerHostMessageType
                                .OPERATION_STATUS,
                        payload: {
                            status: "idle",
                            operation: null
                        }
                    })
                );
            }
        }
    }

    async #executeSubmissionPush(
        panel,
        message,
        command
    ) {
        const operation = "submission/push";
        const abortController =
            new AbortController();

        this.activePushAbortController =
            abortController;

        this.#postEvent(
            panel,
            createBrokerHostMessage({
                type:
                    BrokerHostMessageType
                        .OPERATION_STATUS,
                payload: {
                    status: "busy",
                    operation
                }
            })
        );

        try {
            const result = await this.submissionPush
                .push({
                    requestId:
                        message.requestId,
                    documentSelector:
                        command.documentSelector,
                    signal:
                        abortController.signal
                });

            if (panel !== this.panel) {
                return applicationSuccess({
                    ignored: true,
                    reason: "stale-panel"
                });
            }

            const hostMessage =
                createBrokerHostMessage({
                    type:
                        BrokerHostMessageType
                            .CIPHER_STREAM,
                    requestId:
                        message.requestId,
                    payload: {
                        streamId: this
                            .#nextCipherStreamId(
                                "push"
                            ),
                        phase: "end",
                        text:
                            formatBrokerSubmissionPush(
                                result
                            )
                    }
                });

            await panel.postMessage(hostMessage);

            return applicationSuccess({
                operation,
                contract: result.contract,
                document: result.document,
                finalScore: result.finalScore,
                dimensionScores:
                    result.dimensionScores,
                settlement: result.settlement
            });
        } catch (error) {
            await this.#postError(
                panel,
                error,
                message.requestId,
                message.type,
                error?.code ??
                    "BROKER95_PUSH_FAILED",
                error?.publicMessage ??
                    "No fue posible completar la entrega definitiva."
            );

            return applicationFailure(error);
        } finally {
            if (
                this.activePushAbortController ===
                    abortController
            ) {
                this.activePushAbortController = null;
            }

            if (panel === this.panel) {
                this.#postEvent(
                    panel,
                    createBrokerHostMessage({
                        type:
                            BrokerHostMessageType
                                .OPERATION_STATUS,
                        payload: {
                            status: "idle",
                            operation: null
                        }
                    })
                );
            }
        }
    }

    async #executeSubmissionAsk(
        panel,
        message,
        command
    ) {
        const operation = "submission/ask";
        const abortController =
            new AbortController();

        this.activeAskAbortController =
            abortController;

        this.#postEvent(
            panel,
            createBrokerHostMessage({
                type:
                    BrokerHostMessageType
                        .OPERATION_STATUS,
                payload: {
                    status: "busy",
                    operation
                }
            })
        );

        try {
            const result = await this.submissionAsk
                .ask({
                    requestId: message.requestId,
                    question: command.question,
                    signal: abortController.signal
                });

            if (panel !== this.panel) {
                return applicationSuccess({
                    ignored: true,
                    reason: "stale-panel"
                });
            }

            await panel.postMessage(
                createBrokerHostMessage({
                    type:
                        BrokerHostMessageType
                            .CIPHER_STREAM,
                    requestId: message.requestId,
                    payload: {
                        streamId: this
                            .#nextCipherStreamId(
                                "ask"
                            ),
                        phase: "end",
                        text:
                            formatBrokerSubmissionAsk(
                                result
                            )
                    }
                })
            );

            return applicationSuccess({
                operation,
                contract: result.contract,
                document: result.document,
                answer: result.answer
            });
        } catch (error) {
            await this.#postError(
                panel,
                error,
                message.requestId,
                message.type,
                error?.code ??
                    "BROKER95_ASK_FAILED",
                error?.publicMessage ??
                    "No fue posible completar la consulta."
            );

            return applicationFailure(error);
        } finally {
            if (
                this.activeAskAbortController ===
                    abortController
            ) {
                this.activeAskAbortController = null;
            }

            if (panel === this.panel) {
                this.#postEvent(
                    panel,
                    createBrokerHostMessage({
                        type:
                            BrokerHostMessageType
                                .OPERATION_STATUS,
                        payload: {
                            status: "idle",
                            operation: null
                        }
                    })
                );
            }
        }
    }

    #nextCipherStreamId(prefix = "review") {
        this.cipherStreamSequence += 1;
        return `${prefix}:${this.cipherStreamSequence}`;
    }

    #enqueueTerminalOperation(operation) {
        const result = this.terminalOperationQueue.then(
            operation,
            operation
        );

        this.terminalOperationQueue = result.then(
            () => undefined,
            () => undefined
        );

        return result;
    }

    async #obtainLearningContract(
        panel,
        message
    ) {
        const operation =
            "learning-contract/obtain";

        this.#postEvent(
            panel,
            createBrokerHostMessage({
                type:
                    BrokerHostMessageType
                        .OPERATION_STATUS,
                payload: {
                    status: "busy",
                    operation
                }
            })
        );

        try {
            const result =
                await this.learningContractService
                    .obtain({
                        learningRouteId:
                            message.payload
                                .learningRouteId,
                        lessonId:
                            message.payload.lessonId,
                        requestId:
                            message.requestId
                    });

            if (panel !== this.panel) {
                return applicationSuccess({
                    ignored: true,
                    reason: "stale-panel"
                });
            }

            const learningProgress =
                this.gameSession
                .getState()
                .learningProgress;
            const routeProgress =
                getBrokerLearningRouteProgress(
                    learningProgress,
                    result.contract
                        .learningRouteId,
                    {
                        catalogs:
                            this.learningCatalogs
                    }
                );
            const lessonLink =
                routeProgress
                .lessonContractLinks[
                    result.lesson.lessonId
                ] ?? null;
            const hostMessage =
                createBrokerHostMessage({
                    type:
                        BrokerHostMessageType
                            .LEARNING_CONTRACT_CREATED,
                    requestId:
                        message.requestId,
                    payload: {
                        learningRouteId:
                            result.contract
                                .learningRouteId,
                        routeTitle:
                            result.lesson.routeTitle,
                        lessonId:
                            result.lesson.lessonId,
                        lessonOrder:
                            result.lesson.lessonOrder,
                        lessonTitle:
                            result.lesson.lessonTitle,
                        sectionId:
                            result.lesson.sectionId,
                        contractId:
                            result.contract.id,
                        title:
                            result.contract.title,
                        learningAttempt:
                            result.contract
                                .learningAttempt,
                        repetition:
                            lessonLink?.repetition ===
                                true,
                        state:
                            this.gameSession
                                .getState()
                    }
                }, {
                    catalogs:
                        this.learningCatalogs
                });
            const entries =
                this.#createTerminalEntries([{
                    kind:
                        BrokerTerminalEntryKind
                            .CIPHER,
                    text:
                        formatBrokerLearningContractCreated(
                            result
                        )
                }]);
            const terminalMessage =
                createBrokerHostMessage({
                    type:
                        BrokerHostMessageType
                            .TERMINAL_APPEND,
                    requestId:
                        message.requestId,
                    payload: { entries }
                });

            await panel.postMessage(hostMessage);
            await panel.postMessage(
                terminalMessage
            );

            return applicationSuccess({
                operation,
                contract: result.contract,
                lesson: result.lesson,
                stateRevision:
                    result.stateRevision,
                message: hostMessage,
                entries:
                    terminalMessage.payload.entries
            });
        } catch (error) {
            await this.#postError(
                panel,
                error,
                message.requestId,
                message.type,
                error?.code ??
                    "BROKER95_LEARNING_CONTRACT_FAILED",
                error?.publicMessage ??
                    "No fue posible obtener el contrato de aprendizaje."
            );

            return applicationFailure(error);
        } finally {
            if (panel === this.panel) {
                this.#postEvent(
                    panel,
                    createBrokerHostMessage({
                        type:
                            BrokerHostMessageType
                                .OPERATION_STATUS,
                        payload: {
                            status: "idle",
                            operation: null
                        }
                    })
                );
            }
        }
    }

    async #executeContractCycle(
        panel,
        message,
        command
    ) {
        const operation = terminalOperationName(command);

        this.#postEvent(
            panel,
            createBrokerHostMessage({
                type: BrokerHostMessageType.OPERATION_STATUS,
                payload: {
                    status: "busy",
                    operation
                }
            })
        );

        try {
            const result = await this.contractCycle.execute(
                command,
                {
                    requestId:
                        message.requestId
                }
            );

            if (panel !== this.panel) {
                return applicationSuccess({
                    ignored: true,
                    reason: "stale-panel"
                });
            }

            const entries = this.#createTerminalEntries(
                result.messages
            );
            const hostMessage = createBrokerHostMessage({
                type: BrokerHostMessageType.TERMINAL_APPEND,
                requestId: message.requestId,
                payload: { entries }
            });

            await panel.postMessage(hostMessage);

            return applicationSuccess({
                operation: result.operation,
                entries: hostMessage.payload.entries
            });
        } catch (error) {
            await this.#postError(
                panel,
                error,
                message.requestId,
                message.type,
                error?.code ??
                    "BROKER95_CONTRACT_CYCLE_FAILED",
                error?.publicMessage ??
                    "No fue posible completar la operaci\u00f3n del contrato."
            );

            return applicationFailure(error);
        } finally {
            if (panel === this.panel) {
                this.#postEvent(
                    panel,
                    createBrokerHostMessage({
                        type:
                            BrokerHostMessageType
                                .OPERATION_STATUS,
                        payload: {
                            status: "idle",
                            operation: null
                        }
                    })
                );
            }
        }
    }

    async #purchaseCountermeasure(
        panel,
        message
    ) {
        const operation =
            "economy/purchase-countermeasure";

        this.#postEvent(
            panel,
            createBrokerHostMessage({
                type:
                    BrokerHostMessageType
                        .OPERATION_STATUS,
                payload: {
                    status: "busy",
                    operation
                }
            })
        );

        try {
            const result = await this.economy
                .purchase(
                    message.payload
                        .countermeasureId,
                    {
                        requestId:
                            message.requestId
                    }
                );

            if (panel !== this.panel) {
                return applicationSuccess({
                    ignored: true,
                    reason: "stale-panel"
                });
            }

            const entries =
                this.#createTerminalEntries(
                    result.messages
                );
            const hostMessage =
                createBrokerHostMessage({
                    type:
                        BrokerHostMessageType
                            .TERMINAL_APPEND,
                    requestId:
                        message.requestId,
                    payload: { entries }
                });

            await panel.postMessage(hostMessage);

            return applicationSuccess({
                operation: result.operation,
                countermeasure:
                    result.countermeasure,
                money: result.money,
                alertLevel:
                    result.alertLevel,
                stateRevision:
                    result.stateRevision,
                entries:
                    hostMessage.payload.entries
            });
        } catch (error) {
            await this.#postError(
                panel,
                error,
                message.requestId,
                message.type,
                error?.code ??
                    "BROKER95_COUNTERMEASURE_PURCHASE_FAILED",
                error?.publicMessage ??
                    "No fue posible aplicar la contramedida."
            );

            return applicationFailure(error);
        } finally {
            if (panel === this.panel) {
                this.#postEvent(
                    panel,
                    createBrokerHostMessage({
                        type:
                            BrokerHostMessageType
                                .OPERATION_STATUS,
                        payload: {
                            status: "idle",
                            operation: null
                        }
                    })
                );
            }
        }
    }

    #createTerminalEntries(messages) {
        if (!Array.isArray(messages)) {
            throw new Error(
                "BROKER.95 operation returned invalid terminal messages."
            );
        }

        return messages.map(message => {
            this.terminalEntrySequence += 1;
            this.terminalCreatedOrder += 1;

            return Object.freeze({
                id:
                    `host-terminal:${this.terminalEntrySequence}`,
                kind: message.kind,
                text: message.text,
                createdOrder:
                    this.terminalCreatedOrder
            });
        });
    }

    #postEvent(panel, message) {
        try {
            const result =
                panel.postMessage(message);

            if (
                result != null &&
                typeof result.then ===
                    "function"
            ) {
                void Promise.resolve(result)
                    .catch(error => {
                        this.#logPostFailure(
                            error
                        );
                    });
            }
        } catch (error) {
            this.#logPostFailure(error);
        }
    }

    #logPostFailure(error) {
        try {
            this.developerLogger.error?.(
                "BROKER.95 Webview event delivery failed.",
                error
            );
        } catch {
            // La entrega asíncrona no altera el estado del Host.
        }
    }

    async #postError(
        panel,
        error,
        requestId,
        requestType,
        code = null,
        publicMessage = null
    ) {
        try {
            this.developerLogger.error?.(
                "BROKER.95 Webview command failed.",
                {
                    name:
                        error?.name ??
                        "Error",
                    code:
                        error?.code ??
                        "BROKER95_UNKNOWN_ERROR"
                }
            );
        } catch {
            // El registro no debe impedir una respuesta controlada.
        }

        if (!panel || panel !== this.panel) {
            return false;
        }

        const message = createBrokerHostMessage({
            type: BrokerHostMessageType.ERROR,
            requestId,
            payload: {
                code:
                    code ??
                    error?.code ??
                    "BROKER95_PROTOCOL_MESSAGE_INVALID",
                message:
                    publicMessage ??
                    error?.publicMessage ??
                    "BROKER.95 recibió un mensaje no válido.",
                recoverable: true,
                requestType
            }
        });

        try {
            return await panel.postMessage(
                message
            );
        } catch (postError) {
            this.#logPostFailure(postError);
            return false;
        }
    }

    #releasePanel(disposePanel) {
        const panel = this.panel;

        this.activeReviewAbortController?.abort();
        this.activeReviewAbortController = null;
        this.activeAskAbortController?.abort();
        this.activeAskAbortController = null;
        this.activePushAbortController?.abort();
        this.activePushAbortController = null;
        this.activeConnectionAbortController?.abort();
        this.activeConnectionAbortController = null;
        this.activeLmStudioDiscoveryAbortController
            ?.abort();
        this.activeLmStudioDiscoveryAbortController =
            null;

        this.panel = null;
        this.extensionContext = null;
        this.sessionId = null;
        this.webviewReady = false;
        this.webviewOpenedAt = null;
        this.requestGuard.reset();

        for (
            const resource
            of this.panelResources
        ) {
            resource?.dispose?.();
        }

        this.panelResources = [];

        if (disposePanel) {
            panel?.dispose?.();
        }
    }

    #presentFailure(error) {
        const result = applicationFailure(error);

        this.presenter.present(result);
        return result;
    }
}

function defaultSessionId() {
    return `broker95:${randomUUID()}`;
}

function normalizeSessionId(value) {
    const selected = String(value ?? "");

    if (
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u
            .test(selected)
    ) {
        throw new Error(
            "Invalid BROKER.95 Webview session ID."
        );
    }

    return selected;
}

function terminalOperationName(command) {
    const option = command.option ?? "root";

    return `terminal/${option.replace(/^-+/u, "")}`;
}
