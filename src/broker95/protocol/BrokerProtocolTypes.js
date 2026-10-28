export const BROKER_PROTOCOL_ID =
    "broker95";
export const BROKER_PROTOCOL_VERSION = 8;

export const BrokerProtocolDirection =
    Object.freeze({
        WEBVIEW_TO_HOST:
            "webview_to_host",
        HOST_TO_WEBVIEW:
            "host_to_webview"
    });

export const BrokerWebviewMessageType =
    Object.freeze({
        READY: "webview/ready",
        REQUEST_STATE:
            "game/request-state",
        OBTAIN_LEARNING_CONTRACT:
            "learning/obtain-contract",
        SUBMIT_TERMINAL:
            "terminal/submit",
        PURCHASE_COUNTERMEASURE:
            "alert/purchase-countermeasure",
        SET_PROVIDER:
            "settings/set-provider",
        SET_MODEL: "settings/set-model",
        SET_BASE_URL:
            "settings/set-base-url",
        SET_AUDIO:
            "settings/set-audio",
        SET_API_KEY:
            "settings/set-api-key",
        DELETE_API_KEY:
            "settings/delete-api-key",
        TEST_LLM_CONNECTION:
            "settings/test-llm-connection",
        DISCOVER_LM_STUDIO_MODELS:
            "settings/discover-lm-studio-models",
        CLEAR_CATEGORY_HISTORY:
            "settings/clear-category-history",
        RESET_GAME_PROGRESS:
            "settings/reset-game-progress"
    });

export const BrokerHostMessageType =
    Object.freeze({
        READY: "host/ready",
        STATE_UPDATED:
            "game/state-updated",
        TERMINAL_APPEND:
            "terminal/append",
        OPERATION_STATUS:
            "operation/status",
        SETTINGS_UPDATED:
            "settings/updated",
        LLM_STATUS: "llm/status",
        LLM_CONNECTION_RESULT:
            "llm/connection-result",
        LM_STUDIO_MODELS:
            "llm/lm-studio-models",
        LEARNING_CONTRACT_CREATED:
            "learning/contract-created",
        CIPHER_STREAM:
            "cipher/stream",
        ERROR: "host/error"
    });

export const BrokerTerminalEntryKind =
    Object.freeze({
        USER: "user",
        SYSTEM: "system",
        ERROR: "error",
        DIM: "dim",
        CIPHER: "cipher"
    });

export const BrokerOperationStatus =
    Object.freeze({
        IDLE: "idle",
        BUSY: "busy"
    });

export const BrokerCipherStreamPhase =
    Object.freeze({
        START: "start",
        DELTA: "delta",
        END: "end",
        ERROR: "error"
    });

export const BrokerLlmStatus =
    Object.freeze({
        READY: "ready",
        UNCONFIGURED: "unconfigured",
        OFFLINE: "offline",
        RATE_LIMITED: "rate_limited",
        UNAVAILABLE: "unavailable"
    });

export const BrokerLlmStatusReason =
    Object.freeze({
        READY: "ready",
        MODEL_MISSING: "model_missing",
        API_KEY_MISSING: "api_key_missing",
        OFFLINE: "offline",
        QUOTA_EXHAUSTED:
            "quota_exhausted",
        AUTHENTICATION_FAILED:
            "authentication_failed",
        MODEL_UNAVAILABLE:
            "model_unavailable",
        TIMEOUT: "timeout",
        PROVIDER_ERROR: "provider_error",
        INVALID_RESPONSE:
            "invalid_response",

        // Alias de compatibilidad para los consumidores ya compuestos.
        MISSING_MODEL: "model_missing",
        MISSING_API_KEY: "api_key_missing",
        NETWORK_UNAVAILABLE: "offline"
    });
