import {
    BrokerWebviewMessageType,
    createBrokerWebviewMessage,
    parseBrokerHostMessage
} from "../../../src/broker95/protocol/index.js";

export class Broker95Bridge {

    constructor(options = {}) {
        this.eventTarget =
            options.eventTarget === undefined
                ? globalThis.window ?? null
                : options.eventTarget;
        this.acquireVsCodeApi =
            options.acquireVsCodeApi ===
                undefined
                ? globalThis
                    .acquireVsCodeApi
                : options.acquireVsCodeApi;
        this.logger = options.logger ?? console;
        this.createClientId =
            options.createClientId ??
            createWebviewClientId;

        if (
            typeof this.createClientId !==
            "function"
        ) {
            throw new TypeError(
                "BROKER.95 Webview client ID factory must be a function."
            );
        }

        this.clientId = normalizeClientId(
            this.createClientId()
        );
        this.vscodeApi = null;
        this.apiResolved = false;
        this.connected = false;
        this.requestSequence = 0;
        this.onMessage = null;
        this.onError = null;
        this.messageListener = event => {
            this.#acceptHostMessage(event?.data);
        };
    }

    connect(options = {}) {
        this.onMessage =
            options.onMessage ??
            this.onMessage;
        this.onError =
            options.onError ??
            this.onError;

        if (!this.connected) {
            this.#resolveApi();
            this.eventTarget?.addEventListener?.(
                "message",
                this.messageListener
            );
            this.connected = true;
            this.notifyReady();
        }

        return () => this.disconnect();
    }

    disconnect() {
        if (!this.connected) {
            return;
        }

        this.eventTarget?.removeEventListener?.(
            "message",
            this.messageListener
        );
        this.connected = false;
    }

    notifyReady() {
        return this.#send(
            BrokerWebviewMessageType.READY,
            { clientVersion: null }
        );
    }

    requestState() {
        return this.#send(
            BrokerWebviewMessageType
                .REQUEST_STATE,
            {}
        );
    }

    submitTerminal(input) {
        return this.#send(
            BrokerWebviewMessageType
                .SUBMIT_TERMINAL,
            { input }
        );
    }

    obtainLearningContract(
        lessonId,
        learningRouteId = "programming"
    ) {
        return this.#send(
            BrokerWebviewMessageType
                .OBTAIN_LEARNING_CONTRACT,
            {
                learningRouteId,
                lessonId
            }
        );
    }

    purchaseCountermeasure(
        countermeasureId
    ) {
        return this.#send(
            BrokerWebviewMessageType
                .PURCHASE_COUNTERMEASURE,
            { countermeasureId }
        );
    }

    setModel(model) {
        return this.#send(
            BrokerWebviewMessageType.SET_MODEL,
            { model }
        );
    }

    setProvider(providerId) {
        return this.#send(
            BrokerWebviewMessageType
                .SET_PROVIDER,
            { providerId }
        );
    }

    setBaseUrl(baseUrl) {
        return this.#send(
            BrokerWebviewMessageType
                .SET_BASE_URL,
            { baseUrl }
        );
    }

    setAudioPreferences({ muted, volume }) {
        return this.#send(
            BrokerWebviewMessageType.SET_AUDIO,
            { muted, volume }
        );
    }

    setApiKey(apiKey) {
        return this.#send(
            BrokerWebviewMessageType.SET_API_KEY,
            { apiKey }
        );
    }

    deleteApiKey() {
        return this.#send(
            BrokerWebviewMessageType
                .DELETE_API_KEY,
            {}
        );
    }

    testLlmConnection() {
        return this.#send(
            BrokerWebviewMessageType
                .TEST_LLM_CONNECTION,
            {}
        );
    }

    discoverLmStudioModels() {
        return this.#send(
            BrokerWebviewMessageType
                .DISCOVER_LM_STUDIO_MODELS,
            {}
        );
    }

    clearCategoryHistory() {
        return this.#send(
            BrokerWebviewMessageType
                .CLEAR_CATEGORY_HISTORY,
            {}
        );
    }

    resetGameProgress() {
        return this.#send(
            BrokerWebviewMessageType
                .RESET_GAME_PROGRESS,
            {}
        );
    }

    #send(type, payload) {
        const api = this.#resolveApi();

        if (!api) {
            return null;
        }

        try {
            const message =
                createBrokerWebviewMessage({
                    type,
                    requestId:
                        this.#nextRequestId(),
                    payload
                });

            api.postMessage(message);
            return message.requestId;
        } catch (error) {
            this.#reportError(error);
            return null;
        }
    }

    #acceptHostMessage(source) {
        try {
            const message =
                parseBrokerHostMessage(
                    source
                );

            this.onMessage?.(message);
        } catch (error) {
            this.#reportError(error);
        }
    }

    #resolveApi() {
        if (this.apiResolved) {
            return this.vscodeApi;
        }

        this.apiResolved = true;

        try {
            if (
                typeof this.acquireVsCodeApi ===
                    "function"
            ) {
                this.vscodeApi =
                    this.acquireVsCodeApi();
            }
        } catch (error) {
            this.#reportError(error);
        }

        return this.vscodeApi;
    }

    #nextRequestId() {
        this.requestSequence += 1;
        return `broker95-webview:${this.clientId}:${this.requestSequence}`;
    }

    #reportError(error) {
        if (this.onError) {
            this.onError(error);
            return;
        }

        this.logger.error?.(
            "BROKER.95 Webview bridge failed.",
            error
        );
    }
}

function createWebviewClientId() {
    const cryptoApi = globalThis.crypto;

    if (
        typeof cryptoApi?.randomUUID ===
        "function"
    ) {
        return cryptoApi.randomUUID();
    }

    if (
        typeof cryptoApi?.getRandomValues ===
        "function"
    ) {
        const values = new Uint32Array(4);

        cryptoApi.getRandomValues(values);

        return [...values]
            .map(value =>
                value.toString(16)
                    .padStart(8, "0")
            )
            .join("");
    }

    throw new Error(
        "BROKER.95 Webview secure client identity is unavailable."
    );
}

function normalizeClientId(value) {
    const selected = String(value ?? "");

    if (
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u
            .test(selected)
    ) {
        throw new TypeError(
            "Invalid BROKER.95 Webview client ID."
        );
    }

    return selected;
}

export const broker95Bridge =
    new Broker95Bridge();
