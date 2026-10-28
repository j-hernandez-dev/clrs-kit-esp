import {
    BrokerCipherStreamPhase,
    BrokerHostMessageType,
    BrokerOperationStatus,
    BrokerTerminalEntryKind,
    parseBrokerHostMessage
} from "../../../src/broker95/protocol/index.js";
import {
    Broker95CipherVisualState,
    createBroker95CipherSignal
} from "./scene/Broker95CipherVisualState.js";
import {
    BROKER_DEFAULT_AUDIO_PREFERENCES
} from "../../../src/broker95/configuration/index.js";
import {
    BROKER_DEFAULT_LLM_PROVIDER_ID,
    listBrokerLLMProviderDescriptors
} from "../../../src/broker95/llm/index.js";
import {
    createBroker95LearningNavigation,
    openBroker95LearningRoute,
    openBroker95LearningLesson,
    reconcileBroker95LearningNavigation,
    showBroker95LearningNetwork,
    showBroker95LearningRoute
} from "./panels/Broker95LearningNavigation.js";

export const Broker95ConnectionStatus =
    Object.freeze({
        CONNECTING: "connecting",
        READY: "ready",
        ERROR: "error"
    });

export const Broker95Panel = Object.freeze({
    TERMINAL: "terminal",
    CONTRACT: "contract",
    LEARNING: "learning",
    ECONOMY: "economy",
    STATISTICS: "statistics",
    SETTINGS: "settings"
});

export const BROKER95_MAX_VISIBLE_ENTRIES = 200;

export class Broker95ViewStore {

    constructor() {
        this.listeners = new Set();
        this.localEntrySequence = 0;
        this.localCreatedOrder = 0;
        this.cipherSignalSequence = 0;
        this.state = freezeState({
            connection:
                Broker95ConnectionStatus
                    .CONNECTING,
            sessionId: null,
            gameState: null,
            learningContractNotice: null,
            learningNavigation:
                createBroker95LearningNavigation(),
            settings: Object.freeze({
                providerId:
                    BROKER_DEFAULT_LLM_PROVIDER_ID,
                providers:
                    listBrokerLLMProviderDescriptors(),
                model: "",
                credential: Object.freeze({
                    kind: "api-key",
                    required: true,
                    configured: false
                }),
                hasApiKey: false,
                audio:
                    BROKER_DEFAULT_AUDIO_PREFERENCES
            }),
            llmStatus: null,
            connectionCheck: null,
            lmStudioModels: null,
            operation: Object.freeze({
                status:
                    BrokerOperationStatus.IDLE,
                operation: null
            }),
            terminalEntries: [],
            activePanel:
                Broker95Panel.TERMINAL,
            cipherSignal: null,
            lastError: null
        });
    }

    getState = () => this.state;

    subscribe = listener => {
        if (typeof listener !== "function") {
            throw new TypeError(
                "BROKER.95 view listener must be a function."
            );
        }

        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    };

    setActivePanel(panel) {
        if (
            !Object.values(Broker95Panel)
                .includes(panel)
        ) {
            throw new TypeError(
                "Unknown BROKER.95 panel."
            );
        }

        if (this.state.activePanel === panel) {
            return false;
        }

        this.#update({
            ...this.state,
            activePanel: panel
        });

        return true;
    }

    openLearningLesson(lessonId) {
        const learningNavigation =
            openBroker95LearningLesson(
                this.state.learningNavigation,
                lessonId,
                this.state.gameState
            );

        if (
            learningNavigation ===
            this.state.learningNavigation
        ) {
            return false;
        }

        this.#update({
            ...this.state,
            learningNavigation
        });

        return true;
    }

    openLearningRoute(routeId) {
        const learningNavigation =
            openBroker95LearningRoute(
                this.state.learningNavigation,
                routeId,
                this.state.gameState
            );

        if (
            learningNavigation ===
            this.state.learningNavigation
        ) {
            return false;
        }

        this.#update({
            ...this.state,
            learningNavigation
        });

        return true;
    }

    showLearningRoute() {
        const learningNavigation =
            showBroker95LearningRoute(
                this.state.learningNavigation
            );

        if (
            learningNavigation ===
            this.state.learningNavigation
        ) {
            return false;
        }

        this.#update({
            ...this.state,
            learningNavigation
        });

        return true;
    }

    showLearningNetwork() {
        const learningNavigation =
            showBroker95LearningNetwork(
                this.state.learningNavigation
            );

        if (
            learningNavigation ===
            this.state.learningNavigation
        ) {
            return false;
        }

        this.#update({
            ...this.state,
            learningNavigation
        });

        return true;
    }

    dismissLearningContractNotice() {
        if (
            this.state
                .learningContractNotice == null
        ) {
            return false;
        }

        this.#update({
            ...this.state,
            learningContractNotice: null
        });

        return true;
    }

    appendUserInput(input) {
        const text = String(input ?? "");

        if (text.trim().length === 0) {
            return false;
        }

        this.localEntrySequence += 1;
        this.localCreatedOrder += 1;
        this.#appendEntries([{
            id:
                `local-user:${this.localEntrySequence}`,
            kind: BrokerTerminalEntryKind.USER,
            text,
            createdOrder:
                this.localCreatedOrder
        }]);

        return true;
    }

    applyHostMessage(source) {
        const message =
            parseBrokerHostMessage(source);

        switch (message.type) {
            case BrokerHostMessageType.READY:
                this.#acceptReady(message);
                break;

            case BrokerHostMessageType
                .STATE_UPDATED:
                {
                    const previousGameState =
                        this.state.gameState;
                    const synchronizedState =
                        newestPublicGameState(
                            previousGameState,
                            message.payload.state
                        );
                    const stateChanged =
                        synchronizedState !==
                        previousGameState;
                    const enteredGameOver =
                        synchronizedState
                            .gameOver === true &&
                        previousGameState
                            ?.gameOver !== true;
                    const cipherSignal = stateChanged
                        ? this.#deriveGameStateSignal(
                            previousGameState,
                            synchronizedState
                        )
                        : null;

                    this.#update({
                        ...this.state,
                        gameState: synchronizedState,
                        learningContractNotice:
                            reconcileLearningContractNotice(
                                this.state
                                    .learningContractNotice,
                                synchronizedState
                            ),
                        learningNavigation:
                            reconcileBroker95LearningNavigation(
                                this.state
                                    .learningNavigation,
                                synchronizedState
                            ),
                        cipherSignal:
                            cipherSignal ??
                            this.state.cipherSignal,
                        activePanel:
                            enteredGameOver
                                ? Broker95Panel
                                    .STATISTICS
                                : this.state
                                    .activePanel
                    });
                }
                break;

            case BrokerHostMessageType
                .TERMINAL_APPEND:
                this.#appendEntries(
                    message.payload.entries
                );
                break;

            case BrokerHostMessageType
                .OPERATION_STATUS:
                this.#update({
                    ...this.state,
                    operation:
                        message.payload,
                    connectionCheck:
                        message.payload.status === BrokerOperationStatus.BUSY &&
                        message.payload.operation ===
                            "llm/test-connection"
                            ? null
                            : this.state.connectionCheck,
                    lmStudioModels:
                        message.payload.operation ===
                            "llm/discover-lm-studio-models"
                            ? null
                            : this.state.lmStudioModels,
                    lastError:
                        message.payload.status ===
                            BrokerOperationStatus.BUSY
                            ? null
                            : this.state.lastError
                });
                break;

            case BrokerHostMessageType
                .SETTINGS_UPDATED:
                this.#update({
                    ...this.state,
                    settings:
                        message.payload.settings,
                    lastError: null,
                    connectionCheck: null,
                    lmStudioModels: null
                });
                break;

            case BrokerHostMessageType
                .LLM_STATUS:
                this.#update({
                    ...this.state,
                    llmStatus:
                        message.payload.llmStatus,
                    connectionCheck: message.payload.llmStatus.reason === "ready"
                        ? this.state.connectionCheck : null
                });
                break;

            case BrokerHostMessageType
                .LLM_CONNECTION_RESULT:
                if (message.payload.providerId !== this.state.settings.providerId) break;
                this.#update({
                    ...this.state,
                    lastError: null,
                    connectionCheck:
                        message.payload
                });
                break;

            case BrokerHostMessageType
                .LM_STUDIO_MODELS:
                this.#update({
                    ...this.state,
                    lmStudioModels:
                        message.payload
                });
                break;

            case BrokerHostMessageType
                .LEARNING_CONTRACT_CREATED:
                {
                    const previousGameState =
                        this.state.gameState;
                    const synchronizedState =
                        newestPublicGameState(
                            previousGameState,
                            message.payload.state
                        );
                    const stateChanged =
                        synchronizedState !==
                            previousGameState;
                    const notice = Object.freeze({
                        requestId:
                            message.requestId,
                        learningRouteId:
                            message.payload
                                .learningRouteId,
                        routeTitle:
                            message.payload
                                .routeTitle,
                        lessonId:
                            message.payload.lessonId,
                        lessonOrder:
                            message.payload
                                .lessonOrder,
                        lessonTitle:
                            message.payload
                                .lessonTitle,
                        sectionId:
                            message.payload.sectionId,
                        contractId:
                            message.payload.contractId,
                        title:
                            message.payload.title,
                        learningAttempt:
                            message.payload
                                .learningAttempt,
                        repetition:
                            message.payload.repetition
                    });
                    const cipherSignal = stateChanged
                        ? this.#deriveGameStateSignal(
                            previousGameState,
                            synchronizedState
                        )
                        : null;

                    this.#update({
                        ...this.state,
                        gameState: synchronizedState,
                        learningContractNotice:
                            reconcileLearningContractNotice(
                                notice,
                                synchronizedState
                            ),
                        learningNavigation:
                            reconcileBroker95LearningNavigation(
                                this.state
                                    .learningNavigation,
                                synchronizedState
                            ),
                        cipherSignal:
                            cipherSignal ??
                            this.state.cipherSignal,
                        lastError: null
                    });
                }
                break;

            case BrokerHostMessageType
                .CIPHER_STREAM:
                this.#acceptCipherStream(
                    message.payload
                );
                break;

            case BrokerHostMessageType.ERROR:
                this.#acceptError(
                    message.payload
                );
                break;

            default:
                break;
        }

        return this.state;
    }

    reportBridgeError(error) {
        const publicError = Object.freeze({
            code:
                error?.code ??
                "BROKER95_WEBVIEW_PROTOCOL_ERROR",
            message:
                "Se perdió la comunicación con el Host de BROKER.95.",
            recoverable: true,
            requestType: null
        });

        this.#update({
            ...this.state,
            connection:
                Broker95ConnectionStatus.ERROR,
            lastError: publicError,
            cipherSignal:
                this.#createCipherSignal(
                    Broker95CipherVisualState.WARNING
                )
        });
        this.#appendSystemError(publicError);
    }

    #acceptReady(message) {
        const sessionChanged =
            message.payload.sessionId !==
            this.state.sessionId;
        const next = {
            ...this.state,
            connection:
                Broker95ConnectionStatus.READY,
            sessionId:
                message.payload.sessionId,
            gameState: message.payload.state,
            learningContractNotice:
                sessionChanged
                    ? null
                    : reconcileLearningContractNotice(
                        this.state
                            .learningContractNotice,
                        message.payload.state
                    ),
            learningNavigation:
                sessionChanged
                    ? createBroker95LearningNavigation()
                    : reconcileBroker95LearningNavigation(
                        this.state
                            .learningNavigation,
                        message.payload.state
                    ),
            settings: message.payload.settings,
            llmStatus:
                message.payload.llmStatus,
            connectionCheck: null,
            lmStudioModels: null,
            lastError: null,
            cipherSignal:
                sessionChanged
                    ? null
                    : this.state.cipherSignal,
            activePanel:
                message.payload.state
                    .gameOver === true
                    ? Broker95Panel.STATISTICS
                    : this.state.activePanel
        };

        this.#update(next);

        if (sessionChanged) {
            this.#appendEntries([{
                id:
                    `session:${message.payload.sessionId}`,
                kind:
                    BrokerTerminalEntryKind.SYSTEM,
                text:
                    "Enlace local establecido. Escribe ai -? para consultar los comandos.",
                createdOrder: 0
            }]);
        }
    }

    #acceptError(error) {
        this.#update({
            ...this.state,
            lastError: error,
            connectionCheck: error.code.startsWith("BROKER95_LLM_")
                ? null : this.state.connectionCheck,
            cipherSignal:
                this.#createCipherSignal(
                    Broker95CipherVisualState.WARNING
                )
        });
        this.#appendSystemError(error);
    }

    #appendSystemError(error) {
        this.localEntrySequence += 1;
        this.localCreatedOrder += 1;
        this.#appendEntries([{
            id:
                `local-error:${this.localEntrySequence}`,
            kind: BrokerTerminalEntryKind.ERROR,
            text: error.message,
            createdOrder:
                this.localCreatedOrder
        }]);
    }

    #acceptCipherStream(stream) {
        const id = `cipher:${stream.streamId}`;
        const current =
            this.state.terminalEntries
                .find(entry =>
                    entry.id === id
                );
        const terminalEntries =
            this.state.terminalEntries
                .filter(entry =>
                    entry.id !== id
                );
        const text = stream.phase ===
            BrokerCipherStreamPhase.DELTA
            ? `${current?.text ?? ""}${stream.text}`
            : stream.text ||
                current?.text || "";
        const kind = stream.phase ===
            BrokerCipherStreamPhase.ERROR
            ? BrokerTerminalEntryKind.ERROR
            : BrokerTerminalEntryKind.CIPHER;
        const cipherSignal =
            stream.phase ===
                BrokerCipherStreamPhase.ERROR
                ? this.#createCipherSignal(
                    Broker95CipherVisualState.WARNING
                )
                : stream.phase ===
                    BrokerCipherStreamPhase.END
                    ? this.#createCipherSignal(
                        Broker95CipherVisualState.ATTENTIVE
                    )
                    : this.state.cipherSignal;

        terminalEntries.push({
            id,
            kind,
            text,
            createdOrder:
                current?.createdOrder ??
                ++this.localCreatedOrder
        });
        this.#replaceEntries(
            terminalEntries,
            cipherSignal
        );
    }

    #appendEntries(entries) {
        const byId = new Map(
            this.state.terminalEntries
                .map(entry => [
                    entry.id,
                    entry
                ])
        );

        for (const entry of entries) {
            byId.set(entry.id, entry);
            this.localCreatedOrder = Math.max(
                this.localCreatedOrder,
                entry.createdOrder
            );
        }

        this.#replaceEntries(
            [...byId.values()]
        );
    }

    #replaceEntries(
        entries,
        cipherSignal = this.state.cipherSignal
    ) {
        this.#update({
            ...this.state,
            cipherSignal,
            terminalEntries:
                entries.slice(
                    -BROKER95_MAX_VISIBLE_ENTRIES
                )
        });
    }

    #update(next) {
        this.state = freezeState(next);

        for (const listener of this.listeners) {
            listener(this.state);
        }
    }

    #deriveGameStateSignal(previous, next) {
        if (
            next?.gameOver === true &&
            previous?.gameOver !== true
        ) {
            return this.#createCipherSignal(
                Broker95CipherVisualState.ERROR
            );
        }

        if (
            containsNewId(
                previous?.failedContractIds,
                next?.failedContractIds
            )
        ) {
            return this.#createCipherSignal(
                Broker95CipherVisualState.WARNING
            );
        }

        if (
            containsNewId(
                previous?.completedContractIds,
                next?.completedContractIds
            )
        ) {
            return this.#createCipherSignal(
                Broker95CipherVisualState.SUCCESS
            );
        }

        if (
            next?.activeContractId != null &&
            next.activeContractId !==
                previous?.activeContractId
        ) {
            return this.#createCipherSignal(
                Broker95CipherVisualState.ATTENTIVE
            );
        }

        return null;
    }

    #createCipherSignal(visualState) {
        this.cipherSignalSequence += 1;

        return createBroker95CipherSignal(
            this.cipherSignalSequence,
            visualState
        );
    }
}

function freezeState(state) {
    return Object.freeze({
        ...state,
        learningContractNotice:
            state.learningContractNotice == null
                ? null
                : Object.isFrozen(
                    state.learningContractNotice
                )
                    ? state.learningContractNotice
                    : Object.freeze({
                        ...state
                            .learningContractNotice
                    }),
        learningNavigation:
            createBroker95LearningNavigation(
                state.learningNavigation
            ),
        cipherSignal:
            state.cipherSignal == null
                ? null
                : Object.isFrozen(
                    state.cipherSignal
                )
                    ? state.cipherSignal
                    : Object.freeze({
                        ...state.cipherSignal
                    }),
        terminalEntries: Object.freeze(
            state.terminalEntries.map(
                entry => Object.isFrozen(entry)
                    ? entry
                    : Object.freeze({
                        ...entry
                    })
            )
        )
    });
}

function containsNewId(previous = [], next = []) {
    const known = new Set(previous ?? []);

    return (next ?? []).some(id => !known.has(id));
}

function newestPublicGameState(
    current,
    incoming
) {
    if (current == null) {
        return incoming;
    }

    return incoming.revision <= current.revision
        ? current
        : incoming;
}

function reconcileLearningContractNotice(
    notice,
    gameState
) {
    if (notice == null || gameState == null) {
        return null;
    }

    const lesson = gameState.learning?.progress?.[
        notice.learningRouteId
    ]?.lessons.find(
            item =>
                item.lessonId ===
                    notice.lessonId
        );
    const contract = gameState.contracts
        ?.find(
            item =>
                item.id === notice.contractId
        );

    return lesson?.activeContractId ===
            notice.contractId &&
        contract?.contractType === "learning" &&
        contract.lessonId === notice.lessonId
        ? notice
        : null;
}

export const broker95ViewStore =
    new Broker95ViewStore();
