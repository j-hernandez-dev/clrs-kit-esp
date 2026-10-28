import {
    BrokerProtocolError
} from "./BrokerProtocolError.js";
import {
    BROKER_PROTOCOL_ID,
    BROKER_PROTOCOL_VERSION,
    BrokerCipherStreamPhase,
    BrokerHostMessageType,
    BrokerLlmStatus,
    BrokerLlmStatusReason,
    BrokerOperationStatus,
    BrokerProtocolDirection,
    BrokerTerminalEntryKind,
    BrokerWebviewMessageType
} from "./BrokerProtocolTypes.js";
import {
    createBrokerPublicGameState
} from "./BrokerPublicState.js";
import {
    BrokerCountermeasure
} from "../core/BrokerGameRules.js";
import {
    BrokerLearningRouteId
} from "../learning/BrokerLearningRoutesProgress.js";
import {
    BROKER_DEFAULT_AUDIO_PREFERENCES
} from "../configuration/BrokerSettings.js";
import {
    BROKER_DEFAULT_LLM_PROVIDER_ID,
    BrokerLLMEndpointKind,
    BrokerLLMProviderId,
    createBrokerLLMProviderDescriptor,
    listBrokerLLMProviderDescriptors,
    normalizeBrokerLLMProviderId
} from "../llm/BrokerLLMProvider.js";
import {
    normalizeBrokerLocalLlmBaseUrl
} from "../llm/BrokerLLMEndpoint.js";
import {
    createBrokerPublicCredentialState
} from "../llm/BrokerLLMCredential.js";

const ENVELOPE_KEYS = Object.freeze([
    "protocol",
    "protocolVersion",
    "direction",
    "type",
    "requestId",
    "payload"
]);
const WEBVIEW_TYPES = new Set(
    Object.values(BrokerWebviewMessageType)
);
const HOST_TYPES = new Set(
    Object.values(BrokerHostMessageType)
);

export function createBrokerWebviewMessage({
    type,
    requestId,
    payload = {}
}) {
    return parseBrokerWebviewMessage({
        protocol: BROKER_PROTOCOL_ID,
        protocolVersion:
            BROKER_PROTOCOL_VERSION,
        direction:
            BrokerProtocolDirection
                .WEBVIEW_TO_HOST,
        type,
        requestId,
        payload
    });
}

export function createBrokerHostMessage({
    type,
    requestId = null,
    payload = {}
}, options = {}) {
    return parseBrokerHostMessage({
        protocol: BROKER_PROTOCOL_ID,
        protocolVersion:
            BROKER_PROTOCOL_VERSION,
        direction:
            BrokerProtocolDirection
                .HOST_TO_WEBVIEW,
        type,
        requestId,
        payload
    }, options);
}

export function parseBrokerWebviewMessage(
    value
) {
    return parseEnvelope(
        value,
        BrokerProtocolDirection
            .WEBVIEW_TO_HOST
    );
}

export function parseBrokerHostMessage(
    value,
    options = {}
) {
    return parseEnvelope(
        value,
        BrokerProtocolDirection
            .HOST_TO_WEBVIEW,
        options
    );
}

function parseEnvelope(
    value,
    direction,
    options = {}
) {
    const envelope = requireRecord(
        value,
        "envelope"
    );

    requireExactKeys(
        envelope,
        ENVELOPE_KEYS,
        ENVELOPE_KEYS,
        "envelope"
    );

    if (
        envelope.protocol !==
        BROKER_PROTOCOL_ID
    ) {
        protocolError(
            "BROKER95_PROTOCOL_ID_INVALID",
            "El mensaje no pertenece al protocolo de BROKER.95.",
            "protocol"
        );
    }

    if (
        envelope.protocolVersion !==
        BROKER_PROTOCOL_VERSION
    ) {
        protocolError(
            "BROKER95_PROTOCOL_VERSION_UNSUPPORTED",
            "La versión del protocolo de BROKER.95 no es compatible.",
            "protocolVersion"
        );
    }

    if (envelope.direction !== direction) {
        protocolError(
            "BROKER95_PROTOCOL_DIRECTION_INVALID",
            "La dirección del mensaje de BROKER.95 no es válida.",
            "direction"
        );
    }

    const requestId = requireRequestId(
        envelope.requestId,
        direction ===
            BrokerProtocolDirection
                .WEBVIEW_TO_HOST
    );
    const type = requireMessageType(
        envelope.type,
        direction
    );
    const payload = direction ===
        BrokerProtocolDirection
            .WEBVIEW_TO_HOST
        ? parseWebviewPayload(
            type,
            envelope.payload
        )
        : parseHostPayload(
            type,
            envelope.payload,
            options
        );

    return Object.freeze({
        protocol: BROKER_PROTOCOL_ID,
        protocolVersion:
            BROKER_PROTOCOL_VERSION,
        direction,
        type,
        requestId,
        payload
    });
}

function parseWebviewPayload(type, value) {
    switch (type) {
        case BrokerWebviewMessageType.READY:
            return parseReadyRequest(value);

        case BrokerWebviewMessageType
            .REQUEST_STATE:
        case BrokerWebviewMessageType
            .DELETE_API_KEY:
        case BrokerWebviewMessageType
            .TEST_LLM_CONNECTION:
        case BrokerWebviewMessageType
            .DISCOVER_LM_STUDIO_MODELS:
        case BrokerWebviewMessageType
            .CLEAR_CATEGORY_HISTORY:
        case BrokerWebviewMessageType
            .RESET_GAME_PROGRESS:
            return parseEmptyPayload(value);

        case BrokerWebviewMessageType
            .SUBMIT_TERMINAL:
            return parseTerminalRequest(value);

        case BrokerWebviewMessageType
            .OBTAIN_LEARNING_CONTRACT:
            return parseLearningContractRequest(
                value
            );

        case BrokerWebviewMessageType
            .PURCHASE_COUNTERMEASURE:
            return parseCountermeasureRequest(
                value
            );

        case BrokerWebviewMessageType
            .SET_PROVIDER:
            return parseProviderRequest(value);

        case BrokerWebviewMessageType
            .SET_MODEL:
            return parseModelRequest(value);

        case BrokerWebviewMessageType
            .SET_BASE_URL:
            return parseBaseUrlRequest(value);

        case BrokerWebviewMessageType
            .SET_AUDIO:
            return parseAudioRequest(value);

        case BrokerWebviewMessageType
            .SET_API_KEY:
            return parseApiKeyRequest(value);

        default:
            return unreachableMessageType();
    }
}

function parseHostPayload(
    type,
    value,
    options = {}
) {
    switch (type) {
        case BrokerHostMessageType.READY:
            return parseHostReady(value, options);

        case BrokerHostMessageType
            .STATE_UPDATED:
            return parseStateUpdated(value, options);

        case BrokerHostMessageType
            .TERMINAL_APPEND:
            return parseTerminalAppend(value);

        case BrokerHostMessageType
            .OPERATION_STATUS:
            return parseOperationStatus(value);

        case BrokerHostMessageType
            .SETTINGS_UPDATED:
            return parseSettingsUpdated(value);

        case BrokerHostMessageType
            .LLM_STATUS:
            return parseLlmStatusPayload(value);

        case BrokerHostMessageType
            .LLM_CONNECTION_RESULT:
            return parseLlmConnectionResult(value);

        case BrokerHostMessageType
            .LM_STUDIO_MODELS:
            return parseLmStudioModels(value);

        case BrokerHostMessageType
            .LEARNING_CONTRACT_CREATED:
            return parseLearningContractCreated(
                value,
                options
            );

        case BrokerHostMessageType
            .CIPHER_STREAM:
            return parseCipherStream(value);

        case BrokerHostMessageType.ERROR:
            return parseHostError(value);

        default:
            return unreachableMessageType();
    }
}

function parseReadyRequest(value) {
    const payload = requireRecord(
        value,
        "payload"
    );

    requireExactKeys(
        payload,
        ["clientVersion"],
        [],
        "payload"
    );

    return Object.freeze({
        clientVersion:
            payload.clientVersion == null
                ? null
                : requireString(
                    payload.clientVersion,
                    "clientVersion",
                    { maximumLength: 64 }
                )
    });
}

function parseEmptyPayload(value) {
    const payload = requireRecord(
        value,
        "payload"
    );

    requireExactKeys(
        payload,
        [],
        [],
        "payload"
    );

    return Object.freeze({});
}

function parseTerminalRequest(value) {
    const payload = exactPayload(
        value,
        ["input"]
    );

    return Object.freeze({
        input: requireString(
            payload.input,
            "input",
            {
                allowEmpty: true,
                trim: false,
                maximumLength: 16384
            }
        )
    });
}

function parseLearningContractRequest(value) {
    const payload = exactPayload(
        value,
        ["learningRouteId", "lessonId"]
    );
    const learningRouteId = requireEnum(
        payload.learningRouteId,
        BrokerLearningRouteId,
        "learningRouteId"
    );
    const lessonId = requireIdentifier(
        payload.lessonId,
        "lessonId"
    );

    if (
        !/^(?:algorithm-)?lesson-[0-9]{3,}$/u
            .test(lessonId)
    ) {
        invalidField("lessonId");
    }

    return Object.freeze({
        learningRouteId,
        lessonId
    });
}

function parseCountermeasureRequest(value) {
    const payload = exactPayload(
        value,
        ["countermeasureId"]
    );
    const countermeasureId = requireString(
        payload.countermeasureId,
        "countermeasureId",
        { maximumLength: 64 }
    );

    requireEnum(
        countermeasureId,
        BrokerCountermeasure,
        "countermeasureId"
    );

    return Object.freeze({
        countermeasureId
    });
}

function parseModelRequest(value) {
    const payload = exactPayload(
        value,
        ["model"]
    );

    return Object.freeze({
        model: requireString(
            payload.model,
            "model",
            {
                allowEmpty: true,
                maximumLength: 256
            }
        )
    });
}

function parseBaseUrlRequest(value) {
    const payload = exactPayload(
        value,
        ["baseUrl"]
    );
    let baseUrl;

    try {
        baseUrl = normalizeBrokerLocalLlmBaseUrl(
            payload.baseUrl
        );
    } catch {
        invalidField("baseUrl");
    }

    return Object.freeze({ baseUrl });
}

function parseProviderRequest(value) {
    const payload = exactPayload(
        value,
        ["providerId"]
    );

    return Object.freeze({
        providerId: parseProviderId(
            payload.providerId
        )
    });
}

function parseAudioRequest(value) {
    return parseAudioPreferences(
        exactPayload(
            value,
            ["muted", "volume"]
        )
    );
}

function parseApiKeyRequest(value) {
    const payload = exactPayload(
        value,
        ["apiKey"]
    );

    return Object.freeze({
        apiKey: requireString(
            payload.apiKey,
            "apiKey",
            { maximumLength: 16384 }
        )
    });
}

function parseHostReady(value, options = {}) {
    const payload = exactPayload(
        value,
        [
            "sessionId",
            "state",
            "settings",
            "llmStatus"
        ]
    );

    return Object.freeze({
        sessionId: requireIdentifier(
            payload.sessionId,
            "sessionId"
        ),
        state: createBrokerPublicGameState(
            payload.state,
            options
        ),
        settings: parseSettings(
            payload.settings
        ),
        llmStatus: parseLlmStatus(
            payload.llmStatus
        )
    });
}

function parseStateUpdated(value, options = {}) {
    const payload = exactPayload(
        value,
        ["state", "reason"]
    );

    return Object.freeze({
        state: createBrokerPublicGameState(
            payload.state,
            options
        ),
        reason: requireString(
            payload.reason,
            "reason",
            { maximumLength: 128 }
        )
    });
}

function parseTerminalAppend(value) {
    const payload = exactPayload(
        value,
        ["entries"]
    );

    if (
        !Array.isArray(payload.entries) ||
        payload.entries.length === 0 ||
        payload.entries.length > 200
    ) {
        invalidField("entries");
    }

    return Object.freeze({
        entries: Object.freeze(
            payload.entries.map(
                parseTerminalEntry
            )
        )
    });
}

function parseTerminalEntry(value) {
    const entry = exactPayload(
        value,
        [
            "id",
            "kind",
            "text",
            "createdOrder"
        ],
        "terminalEntry"
    );
    const kind = requireEnum(
        entry.kind,
        BrokerTerminalEntryKind,
        "kind"
    );

    return Object.freeze({
        id: requireIdentifier(
            entry.id,
            "id"
        ),
        kind,
        text: requireString(
            entry.text,
            "text",
            {
                allowEmpty: true,
                trim: false,
                maximumLength: 65536
            }
        ),
        createdOrder: requireInteger(
            entry.createdOrder,
            "createdOrder",
            0
        )
    });
}

function parseOperationStatus(value) {
    const payload = exactPayload(
        value,
        ["status", "operation"]
    );
    const status = requireEnum(
        payload.status,
        BrokerOperationStatus,
        "status"
    );
    const operation =
        payload.operation == null
            ? null
            : requireString(
                payload.operation,
                "operation",
                { maximumLength: 128 }
            );

    if (
        (status === BrokerOperationStatus.IDLE &&
            operation != null) ||
        (status === BrokerOperationStatus.BUSY &&
            operation == null)
    ) {
        invalidField("operation");
    }

    return Object.freeze({
        status,
        operation
    });
}

function parseSettingsUpdated(value) {
    const payload = exactPayload(
        value,
        ["settings"]
    );

    return Object.freeze({
        settings: parseSettings(
            payload.settings
        )
    });
}

function parseSettings(value) {
    const settings = exactPayload(
        value,
        ["model", "hasApiKey"],
        "settings",
        [
            "audio",
            "baseUrl",
            "providerId",
            "providers",
            "credential"
        ]
    );

    const providerId = parseProviderId(
        settings.providerId ??
            BROKER_DEFAULT_LLM_PROVIDER_ID
    );
    const providers = parseProviderDescriptors(
        settings.providers ??
            listBrokerLLMProviderDescriptors(),
        providerId
    );
    const selectedDescriptor = providers.find(
        provider =>
            provider.id === providerId
    );

    const hasApiKey = requireBoolean(
        settings.hasApiKey,
        "hasApiKey"
    );
    const credential =
        settings.credential == null
            ? createBrokerPublicCredentialState(
                providerId,
                hasApiKey,
                selectedDescriptor
            )
            : parseCredentialState(
                settings.credential,
                providerId,
                hasApiKey,
                selectedDescriptor
            );
    let baseUrl = null;

    if (settings.baseUrl != null) {
        if (
            selectedDescriptor.endpointKind !==
            BrokerLLMEndpointKind.LOCAL
        ) {
            invalidField("settings.baseUrl");
        }

        try {
            baseUrl = normalizeBrokerLocalLlmBaseUrl(
                settings.baseUrl
            );
        } catch {
            invalidField("settings.baseUrl");
        }
    }

    return Object.freeze({
        providerId,
        providers,
        model: requireString(
            settings.model,
            "model",
            {
                allowEmpty: true,
                maximumLength: 256
            }
        ),
        credential,
        hasApiKey,
        ...(baseUrl == null
            ? {}
            : { baseUrl }),
        audio: settings.audio == null
            ? BROKER_DEFAULT_AUDIO_PREFERENCES
            : parseAudioPreferences(
                settings.audio,
                "settings.audio"
            )
    });
}

function parseCredentialState(
    value,
    providerId,
    hasApiKey,
    descriptor
) {
    const source = exactPayload(
        value,
        ["kind", "required", "configured"],
        "settings.credential"
    );
    const expected =
        createBrokerPublicCredentialState(
            providerId,
            hasApiKey,
            descriptor
        );
    const selected = Object.freeze({
        kind: requireString(
            source.kind,
            "settings.credential.kind",
            { maximumLength: 32 }
        ),
        required: requireBoolean(
            source.required,
            "settings.credential.required"
        ),
        configured: requireBoolean(
            source.configured,
            "settings.credential.configured"
        )
    });

    if (
        selected.kind !== expected.kind ||
        selected.required !== expected.required ||
        selected.configured !==
            expected.configured
    ) {
        invalidField("settings.credential");
    }

    return selected;
}

function parseProviderId(value) {
    const providerId = requireString(
        value,
        "providerId",
        {
            allowEmpty: false,
            maximumLength: 32
        }
    );

    try {
        return normalizeBrokerLLMProviderId(
            providerId
        );
    } catch {
        invalidField("providerId");
    }
}

function parseProviderDescriptors(
    value,
    selectedProviderId
) {
    if (
        !Array.isArray(value) ||
        value.length === 0 ||
        value.length > 16
    ) {
        invalidField("settings.providers");
    }

    let providers;

    try {
        providers = value.map(
            provider =>
                createBrokerLLMProviderDescriptor(
                    provider
                )
        );
    } catch {
        invalidField("settings.providers");
    }

    const ids = providers.map(
        provider => provider.id
    );

    if (
        new Set(ids).size !== ids.length ||
        !ids.includes(selectedProviderId)
    ) {
        invalidField("settings.providers");
    }

    return Object.freeze(providers);
}

function parseAudioPreferences(
    value,
    field = "audio"
) {
    const audio = exactPayload(
        value,
        ["muted", "volume"],
        field
    );

    return Object.freeze({
        muted: requireBoolean(
            audio.muted,
            `${field}.muted`
        ),
        volume: requireInteger(
            audio.volume,
            `${field}.volume`,
            0,
            100
        )
    });
}

function parseLlmStatusPayload(value) {
    const payload = exactPayload(
        value,
        ["llmStatus"]
    );

    return Object.freeze({
        llmStatus: parseLlmStatus(
            payload.llmStatus
        )
    });
}

function parseLlmConnectionResult(value) {
    const payload = exactPayload(
        value,
        [
            "providerId",
            "model",
            "connected",
            "message"
        ]
    );

    if (payload.connected !== true) {
        invalidField("connected");
    }

    return Object.freeze({
        providerId: parseProviderId(
            payload.providerId
        ),
        model: requireString(
            payload.model,
            "model",
            { maximumLength: 256 }
        ),
        connected: true,
        message: requireString(
            payload.message,
            "message",
            { maximumLength: 1024 }
        )
    });
}

function parseLmStudioModels(value) {
    const payload = exactPayload(
        value,
        ["providerId", "baseUrl", "models"]
    );

    if (
        payload.providerId !==
        BrokerLLMProviderId.LM_STUDIO ||
        !Array.isArray(payload.models) ||
        payload.models.length > 512
    ) {
        invalidField("lmStudioModels");
    }

    let baseUrl;

    try {
        baseUrl = normalizeBrokerLocalLlmBaseUrl(
            payload.baseUrl
        );
    } catch {
        invalidField("baseUrl");
    }

    const models = payload.models.map(
        (model, index) => requireString(
            model,
            `models[${index}]`,
            { maximumLength: 256 }
        ).trim()
    );

    if (
        models.some(model => model.length === 0) ||
        models.some(model =>
            /[\u0000-\u001F\u007F]/u.test(model)
        ) ||
        new Set(models).size !== models.length
    ) {
        invalidField("models");
    }

    return Object.freeze({
        providerId:
            BrokerLLMProviderId.LM_STUDIO,
        baseUrl,
        models: Object.freeze(models)
    });
}

function parseLlmStatus(value) {
    const statusValue = exactPayload(
        value,
        ["status", "reason", "message"],
        "llmStatus"
    );
    const status = requireEnum(
        statusValue.status,
        BrokerLlmStatus,
        "status"
    );
    const reason = requireEnum(
        statusValue.reason,
        BrokerLlmStatusReason,
        "reason"
    );

    requireLlmStatusConsistency(
        status,
        reason
    );

    return Object.freeze({
        status,
        reason,
        message: requireString(
            statusValue.message,
            "message",
            { maximumLength: 1024 }
        )
    });
}

function parseCipherStream(value) {
    const payload = exactPayload(
        value,
        ["streamId", "phase", "text"]
    );

    return Object.freeze({
        streamId: requireIdentifier(
            payload.streamId,
            "streamId"
        ),
        phase: requireEnum(
            payload.phase,
            BrokerCipherStreamPhase,
            "phase"
        ),
        text: requireString(
            payload.text,
            "text",
            {
                allowEmpty: true,
                trim: false,
                maximumLength: 65536
            }
        )
    });
}

function parseLearningContractCreated(
    value,
    options = {}
) {
    const payload = exactPayload(
        value,
        [
            "learningRouteId",
            "routeTitle",
            "lessonId",
            "lessonOrder",
            "lessonTitle",
            "sectionId",
            "contractId",
            "title",
            "learningAttempt",
            "repetition",
            "state"
        ]
    );
    const learningRouteId = requireEnum(
        payload.learningRouteId,
        BrokerLearningRouteId,
        "learningRouteId"
    );
    const routeTitle = requireString(
        payload.routeTitle,
        "routeTitle",
        { maximumLength: 80 }
    );
    const lessonId = requireIdentifier(
        payload.lessonId,
        "lessonId"
    );
    const lessonOrder = requireInteger(
        payload.lessonOrder,
        "lessonOrder",
        1
    );
    const lessonTitle = requireString(
        payload.lessonTitle,
        "lessonTitle",
        { maximumLength: 240 }
    );
    const sectionId = requireIdentifier(
        payload.sectionId,
        "sectionId"
    );

    if (
        !/^(?:algorithm-)?lesson-[0-9]{3,}$/u.test(
            lessonId
        ) ||
        !/^(?:algorithm-)?section-[0-9]{2,}$/u.test(
            sectionId
        )
    ) {
        invalidField("learningContract");
    }

    const contractId = requireInteger(
        payload.contractId,
        "contractId",
        1
    );
    const title = requireString(
        payload.title,
        "title",
        { maximumLength: 240 }
    );
    const learningAttempt = requireInteger(
        payload.learningAttempt,
        "learningAttempt",
        1
    );
    const repetition = requireBoolean(
        payload.repetition,
        "repetition"
    );
    const state = createBrokerPublicGameState(
        payload.state,
        options
    );
    const contract = state.contracts.find(
        item => item.id === contractId
    );
    const routeLesson = state.learning.progress[
        learningRouteId
    ]?.lessons.find(
            item => item.lessonId === lessonId
        );
    const route = state.learning.routes.find(
        item => item.routeId === learningRouteId
    );
    const catalogLesson =
        state.learning.catalogs[
            learningRouteId
        ]?.lessons.find(
            item => item.id === lessonId
        );

    if (
        contract?.contractType !== "learning" ||
        contract.learningRouteId !==
            learningRouteId ||
        contract.lessonId !== lessonId ||
        contract.sectionId !== sectionId ||
        contract.title !== title ||
        contract.learningAttempt !==
            learningAttempt ||
        route?.title !== routeTitle ||
        catalogLesson?.order !== lessonOrder ||
        catalogLesson?.title !== lessonTitle ||
        catalogLesson?.sectionId !== sectionId ||
        routeLesson?.activeContractId !==
            contractId ||
        routeLesson.learningAttempt !==
            learningAttempt ||
        routeLesson.repetition !== repetition
    ) {
        invalidField("learningContract");
    }

    return Object.freeze({
        learningRouteId,
        routeTitle,
        lessonId,
        lessonOrder,
        lessonTitle,
        sectionId,
        contractId,
        title,
        learningAttempt,
        repetition,
        state
    });
}

function parseHostError(value) {
    const payload = exactPayload(
        value,
        ["code", "message", "recoverable"],
        "payload",
        ["requestType"]
    );

    return Object.freeze({
        code: requireString(
            payload.code,
            "code",
            { maximumLength: 128 }
        ),
        message: requireString(
            payload.message,
            "message",
            { maximumLength: 4096 }
        ),
        recoverable: requireBoolean(
            payload.recoverable,
            "recoverable"
        ),
        requestType:
            payload.requestType == null
                ? null
                : requireString(
                    payload.requestType,
                    "requestType",
                    { maximumLength: 128 }
                )
    });
}

function requireLlmStatusConsistency(
    status,
    reason
) {
    const allowed = {
        [BrokerLlmStatus.READY]: [
            BrokerLlmStatusReason.READY
        ],
        [BrokerLlmStatus.UNCONFIGURED]: [
            BrokerLlmStatusReason
                .MODEL_MISSING,
            BrokerLlmStatusReason
                .API_KEY_MISSING
        ],
        [BrokerLlmStatus.OFFLINE]: [
            BrokerLlmStatusReason
                .OFFLINE,
            BrokerLlmStatusReason.TIMEOUT
        ],
        [BrokerLlmStatus.RATE_LIMITED]: [
            BrokerLlmStatusReason
                .QUOTA_EXHAUSTED
        ],
        [BrokerLlmStatus.UNAVAILABLE]: [
            BrokerLlmStatusReason
                .AUTHENTICATION_FAILED,
            BrokerLlmStatusReason
                .MODEL_UNAVAILABLE,
            BrokerLlmStatusReason
                .PROVIDER_ERROR,
            BrokerLlmStatusReason
                .INVALID_RESPONSE
        ]
    };

    if (!allowed[status].includes(reason)) {
        invalidField("llmStatus");
    }
}

function exactPayload(
    value,
    required,
    field = "payload",
    optional = []
) {
    const payload = requireRecord(
        value,
        field
    );

    requireExactKeys(
        payload,
        [...required, ...optional],
        required,
        field
    );

    return payload;
}

function requireMessageType(type, direction) {
    const selected = requireString(
        type,
        "type",
        { maximumLength: 128 }
    );
    const known = direction ===
        BrokerProtocolDirection
            .WEBVIEW_TO_HOST
        ? WEBVIEW_TYPES
        : HOST_TYPES;

    if (!known.has(selected)) {
        protocolError(
            "BROKER95_PROTOCOL_MESSAGE_TYPE_UNKNOWN",
            "El tipo de mensaje de BROKER.95 no está permitido.",
            "type"
        );
    }

    return selected;
}

function requireRequestId(value, required) {
    if (!required && value == null) {
        return null;
    }

    return requireIdentifier(
        value,
        "requestId"
    );
}

function requireIdentifier(value, field) {
    const selected = requireString(
        value,
        field,
        { maximumLength: 128 }
    );

    if (
        !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u
            .test(selected)
    ) {
        invalidField(field);
    }

    return selected;
}

function requireRecord(value, field) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        (
            Object.getPrototypeOf(value) !==
                Object.prototype &&
            Object.getPrototypeOf(value) !==
                null
        )
    ) {
        invalidField(field);
    }

    return value;
}

function requireExactKeys(
    value,
    allowed,
    required,
    field
) {
    const keys = Object.keys(value);

    if (
        keys.some(key =>
            !allowed.includes(key)
        ) ||
        required.some(key =>
            !Object.hasOwn(value, key)
        )
    ) {
        invalidField(field);
    }
}

function requireString(
    value,
    field,
    options = {}
) {
    if (typeof value !== "string") {
        invalidField(field);
    }

    const selected = options.trim === false
        ? value
        : value.trim();
    const maximumLength =
        options.maximumLength ?? 4096;

    if (
        (
            options.allowEmpty !== true &&
            selected.length === 0
        ) ||
        selected.length > maximumLength
    ) {
        invalidField(field);
    }

    return selected;
}

function requireBoolean(value, field) {
    if (typeof value !== "boolean") {
        invalidField(field);
    }

    return value;
}

function requireInteger(
    value,
    field,
    minimum,
    maximum = Number.MAX_SAFE_INTEGER
) {
    if (
        !Number.isSafeInteger(value) ||
        value < minimum ||
        value > maximum
    ) {
        invalidField(field);
    }

    return value;
}

function requireEnum(value, enumeration, field) {
    if (!Object.values(enumeration).includes(value)) {
        invalidField(field);
    }

    return value;
}

function invalidField(field) {
    protocolError(
        "BROKER95_PROTOCOL_PAYLOAD_INVALID",
        "El mensaje recibido contiene información no válida.",
        field
    );
}

function unreachableMessageType() {
    protocolError(
        "BROKER95_PROTOCOL_MESSAGE_TYPE_UNKNOWN",
        "El tipo de mensaje de BROKER.95 no está permitido.",
        "type"
    );
}

function protocolError(
    code,
    publicMessage,
    field
) {
    throw new BrokerProtocolError(
        code,
        publicMessage,
        [{ field }]
    );
}
