import {
    BrokerLLMFinishReason
} from "./BrokerLLMResult.js";
import {
    BrokerLLMProtocolError
} from "./BrokerLLMProtocol.js";
import {
    normalizeBrokerLLMProviderId
} from "./BrokerLLMProvider.js";

export const BrokerLLMProviderFailureKind =
    Object.freeze({
        NETWORK: "network",
        TIMEOUT: "timeout",
        HTTP: "http",
        AUTHENTICATION: "authentication",
        QUOTA: "quota",
        MODEL_UNAVAILABLE:
            "model-unavailable",
        INVALID_RESPONSE:
            "invalid-response",
        INVALID_STREAM: "invalid-stream",
        STREAM_FAILED: "stream-failed",
        PROVIDER: "provider"
    });

const FAILURE_CODES = Object.freeze({
    [BrokerLLMProviderFailureKind.NETWORK]:
        "BROKER95_LLM_PROVIDER_NETWORK_FAILED",
    [BrokerLLMProviderFailureKind.TIMEOUT]:
        "BROKER95_LLM_PROVIDER_TIMEOUT",
    [BrokerLLMProviderFailureKind.HTTP]:
        "BROKER95_LLM_PROVIDER_HTTP_FAILED",
    [BrokerLLMProviderFailureKind.AUTHENTICATION]:
        "BROKER95_LLM_PROVIDER_AUTHENTICATION_FAILED",
    [BrokerLLMProviderFailureKind.QUOTA]:
        "BROKER95_LLM_PROVIDER_QUOTA_EXHAUSTED",
    [BrokerLLMProviderFailureKind.MODEL_UNAVAILABLE]:
        "BROKER95_LLM_PROVIDER_MODEL_UNAVAILABLE",
    [BrokerLLMProviderFailureKind.INVALID_RESPONSE]:
        "BROKER95_LLM_PROVIDER_RESPONSE_INVALID",
    [BrokerLLMProviderFailureKind.INVALID_STREAM]:
        "BROKER95_LLM_PROVIDER_STREAM_INVALID",
    [BrokerLLMProviderFailureKind.STREAM_FAILED]:
        "BROKER95_LLM_PROVIDER_STREAM_FAILED",
    [BrokerLLMProviderFailureKind.PROVIDER]:
        "BROKER95_LLM_PROVIDER_FAILED"
});

const FAILURE_PUBLIC_MESSAGES = Object.freeze({
    [BrokerLLMProviderFailureKind.NETWORK]:
        "No fue posible conectar con CIPHER.",
    [BrokerLLMProviderFailureKind.TIMEOUT]:
        "CIPHER tardó demasiado en responder.",
    [BrokerLLMProviderFailureKind.HTTP]:
        "CIPHER no pudo completar la solicitud.",
    [BrokerLLMProviderFailureKind.AUTHENTICATION]:
        "El proveedor rechazó la credencial de CIPHER.",
    [BrokerLLMProviderFailureKind.QUOTA]:
        "El proveedor agotó la cuota disponible para CIPHER.",
    [BrokerLLMProviderFailureKind.MODEL_UNAVAILABLE]:
        "El modelo configurado no está disponible para CIPHER.",
    [BrokerLLMProviderFailureKind.INVALID_RESPONSE]:
        "CIPHER devolvió una respuesta que no pudo procesarse.",
    [BrokerLLMProviderFailureKind.INVALID_STREAM]:
        "La transmisión de CIPHER no pudo procesarse.",
    [BrokerLLMProviderFailureKind.STREAM_FAILED]:
        "La transmisión de CIPHER falló.",
    [BrokerLLMProviderFailureKind.PROVIDER]:
        "El proveedor no pudo procesar la solicitud de CIPHER."
});

const FINISH_REASON_ALIASES = new Map([
    ["stop", BrokerLLMFinishReason.STOP],
    ["end_turn", BrokerLLMFinishReason.STOP],
    ["completed", BrokerLLMFinishReason.STOP],
    ["length", BrokerLLMFinishReason.LENGTH],
    ["max_tokens", BrokerLLMFinishReason.LENGTH],
    ["max_output_tokens", BrokerLLMFinishReason.LENGTH],
    ["content_filter", BrokerLLMFinishReason.CONTENT_FILTER],
    ["safety", BrokerLLMFinishReason.CONTENT_FILTER],
    ["recitation", BrokerLLMFinishReason.CONTENT_FILTER],
    ["prohibited_content", BrokerLLMFinishReason.CONTENT_FILTER],
    ["tool_call", BrokerLLMFinishReason.TOOL_CALL],
    ["tool_calls", BrokerLLMFinishReason.TOOL_CALL],
    ["function_call", BrokerLLMFinishReason.TOOL_CALL]
]);

export class BrokerLLMProviderError extends Error {

    constructor(source = {}) {
        const providerId =
            normalizeBrokerLLMProviderId(
                source.providerId
            );
        const failureKind =
            requireFailureKind(
                source.failureKind
            );
        const operation = requireOperation(
            source.operation
        );
        const status = normalizeHttpStatus(
            source.status
        );
        const technicalMessage =
            requireTechnicalMessage(
                source.technicalMessage ??
                    `BROKER.95 ${providerId} provider failed during ${operation}.`
            );

        super(technicalMessage, {
            cause: source.cause
        });
        this.name = "BrokerLLMProviderError";
        this.code = requireErrorCode(
            source.code ??
                FAILURE_CODES[failureKind]
        );
        this.publicMessage =
            requirePublicMessage(
                source.publicMessage ??
                    FAILURE_PUBLIC_MESSAGES[
                        failureKind
                    ]
            );
        this.providerId = providerId;
        this.failureKind = failureKind;
        this.httpStatus = status;
        this.diagnostics = Object.freeze([
            Object.freeze({
                providerId,
                operation,
                ...(status == null
                    ? {}
                    : { status })
            })
        ]);
    }
}

export function createBrokerLLMProviderError(
    source
) {
    return new BrokerLLMProviderError(source);
}

export function normalizeBrokerLLMFinishReason(
    value
) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0
    ) {
        return BrokerLLMFinishReason.UNKNOWN;
    }

    return FINISH_REASON_ALIASES.get(
        value.trim().toLowerCase()
    ) ?? BrokerLLMFinishReason.UNKNOWN;
}

export function normalizeBrokerLLMUsage(value) {
    if (value == null) {
        return null;
    }

    if (!isRecord(value)) {
        return null;
    }

    const fields = selectUsageFields(value);

    if (!fields) {
        return null;
    }

    const inputTokens = value[fields.input];
    const outputTokens = value[fields.output];
    const suppliedTotal = fields.total == null
        ? null
        : value[fields.total];

    if (
        !isTokenCount(inputTokens) ||
        !isTokenCount(outputTokens) ||
        (
            suppliedTotal != null &&
            !isTokenCount(suppliedTotal)
        )
    ) {
        return null;
    }

    const totalTokens = suppliedTotal ??
        inputTokens + outputTokens;

    if (
        !Number.isSafeInteger(totalTokens) ||
        totalTokens !==
            inputTokens + outputTokens
    ) {
        return null;
    }

    return Object.freeze({
        inputTokens,
        outputTokens,
        totalTokens
    });
}

export function normalizeBrokerLLMModel(
    value,
    fallback
) {
    const selected = normalizeOptionalText(
        value,
        256
    );

    if (selected != null) {
        return selected;
    }

    const normalizedFallback =
        normalizeOptionalText(
            fallback,
            256
        );

    if (normalizedFallback == null) {
        throw BrokerLLMProtocolError
            .invalidResponse("model");
    }

    return normalizedFallback;
}

export function normalizeBrokerLLMResponseId(
    ...candidates
) {
    for (const candidate of candidates) {
        const selected = normalizeOptionalText(
            candidate,
            128
        );

        if (
            selected != null &&
            /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u
                .test(selected)
        ) {
            return selected;
        }
    }

    return null;
}

export function createBrokerLLMTransportResult({
    output,
    model,
    fallbackModel,
    finishReason,
    usage,
    responseIds = []
}) {
    if (
        typeof output !== "string" ||
        output.length === 0 ||
        output.length > 1_048_576 ||
        output.includes("\u0000") ||
        !Array.isArray(responseIds) ||
        responseIds.length > 8
    ) {
        throw BrokerLLMProtocolError
            .invalidResponse(
                "transportResult"
            );
    }

    return Object.freeze({
        output,
        model: normalizeBrokerLLMModel(
            model,
            fallbackModel
        ),
        finishReason:
            normalizeBrokerLLMFinishReason(
                finishReason
            ),
        usage: normalizeBrokerLLMUsage(
            usage
        ),
        responseId:
            normalizeBrokerLLMResponseId(
                ...responseIds
            )
    });
}

export function parseBrokerLLMProviderJson(
    source,
    context = {}
) {
    try {
        if (typeof source !== "string") {
            throw new TypeError(
                "Provider JSON source must be text."
            );
        }

        return JSON.parse(source);
    } catch (cause) {
        throw createBrokerLLMProviderError({
            providerId: context.providerId,
            operation: context.operation,
            failureKind: context.streaming
                ? BrokerLLMProviderFailureKind
                    .INVALID_STREAM
                : BrokerLLMProviderFailureKind
                    .INVALID_RESPONSE,
            cause
        });
    }
}

function selectUsageFields(value) {
    return [
        {
            input: "inputTokens",
            output: "outputTokens",
            total: "totalTokens"
        },
        {
            input: "prompt_tokens",
            output: "completion_tokens",
            total: "total_tokens"
        },
        {
            input: "input_tokens",
            output: "output_tokens",
            total: "total_tokens"
        },
        {
            input: "promptTokenCount",
            output: "candidatesTokenCount",
            total: "totalTokenCount"
        },
        {
            input: "prompt_eval_count",
            output: "eval_count",
            total: null
        }
    ].find(fields =>
        Object.hasOwn(value, fields.input) &&
        Object.hasOwn(value, fields.output)
    ) ?? null;
}

function requireFailureKind(value) {
    if (
        !Object.values(
            BrokerLLMProviderFailureKind
        ).includes(value)
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("failureKind");
    }

    return value;
}

function requireOperation(value) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > 64 ||
        /[\u0000-\u001F\u007F]/u.test(value)
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("operation");
    }

    return value;
}

function requireTechnicalMessage(value) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > 2_048 ||
        value.includes("\u0000")
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest(
                "technicalMessage"
            );
    }

    return value;
}

function requirePublicMessage(value) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > 2_048 ||
        value.includes("\u0000")
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("publicMessage");
    }

    return value;
}

function requireErrorCode(value) {
    if (
        typeof value !== "string" ||
        !/^BROKER95_[A-Z0-9_]{3,96}$/u
            .test(value)
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("code");
    }

    return value;
}

function normalizeHttpStatus(value) {
    if (value == null) {
        return null;
    }

    if (
        !Number.isInteger(value) ||
        value < 100 ||
        value > 599
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("status");
    }

    return value;
}

function normalizeOptionalText(value, maximum) {
    if (typeof value !== "string") {
        return null;
    }

    const selected = value.trim();

    return selected.length > 0 &&
        selected.length <= maximum &&
        !selected.includes("\u0000")
        ? selected
        : null;
}

function isTokenCount(value) {
    return Number.isSafeInteger(value) &&
        value >= 0;
}

function isRecord(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value);
}
