import {
    BROKER_LLM_PROTOCOL_ID,
    BROKER_LLM_PROTOCOL_VERSION,
    BrokerLLMProtocolError,
    isBrokerLLMPlainRecord
} from "./BrokerLLMProtocol.js";
import {
    normalizeBrokerLLMProviderId
} from "./BrokerLLMProvider.js";

export const BrokerLLMFinishReason =
    Object.freeze({
        STOP: "stop",
        LENGTH: "length",
        CONTENT_FILTER: "content_filter",
        TOOL_CALL: "tool_call",
        UNKNOWN: "unknown"
    });

const TRANSPORT_KEYS = Object.freeze([
    "output",
    "model",
    "finishReason",
    "usage",
    "responseId"
]);

export function createBrokerLLMResult(
    request,
    transportResult,
    responseValidator,
    providerId = "custom"
) {
    requireTransportResult(transportResult);

    if (
        responseValidator == null ||
        typeof responseValidator.validate !==
            "function"
    ) {
        throw BrokerLLMProtocolError
            .invalidPort();
    }

    const output = responseValidator.validate(
        request,
        transportResult.output
    );

    return Object.freeze({
        protocol: BROKER_LLM_PROTOCOL_ID,
        protocolVersion:
            BROKER_LLM_PROTOCOL_VERSION,
        requestId: request.requestId,
        operation: request.operation,
        responseSchema:
            request.responseSchema,
        providerId:
            normalizeBrokerLLMProviderId(
                providerId
            ),
        model: transportResult.model == null
            ? request.model
            : requireText(
                transportResult.model,
                "model",
                256
            ),
        finishReason: requireFinishReason(
            transportResult.finishReason ??
                BrokerLLMFinishReason.STOP
        ),
        usage: transportResult.usage == null
            ? null
            : createUsage(
                transportResult.usage
            ),
        responseId:
            transportResult.responseId == null
                ? null
                : requireIdentifier(
                    transportResult.responseId,
                    "responseId"
                ),
        output
    });
}

export function createBrokerLLMStreamDelta({
    request,
    sequence,
    text
}) {
    if (
        !Number.isSafeInteger(sequence) ||
        sequence < 0
    ) {
        invalidResponse("stream.sequence");
    }

    return Object.freeze({
        requestId: request.requestId,
        operation: request.operation,
        sequence,
        text: requireStreamText(
            text,
            "stream.text",
            65_536
        )
    });
}

function requireTransportResult(value) {
    if (!isBrokerLLMPlainRecord(value)) {
        invalidResponse("transportResult");
    }

    const keys = Object.keys(value);

    if (
        !Object.hasOwn(value, "output") ||
        keys.some(
            key => !TRANSPORT_KEYS.includes(key)
        )
    ) {
        invalidResponse("transportResult");
    }
}

function createUsage(value) {
    if (
        !isBrokerLLMPlainRecord(value) ||
        !hasExactKeys(value, [
            "inputTokens",
            "outputTokens",
            "totalTokens"
        ])
    ) {
        invalidResponse("usage");
    }

    const inputTokens = requireCount(
        value.inputTokens,
        "usage.inputTokens"
    );
    const outputTokens = requireCount(
        value.outputTokens,
        "usage.outputTokens"
    );
    const totalTokens = requireCount(
        value.totalTokens,
        "usage.totalTokens"
    );

    if (
        totalTokens !==
        inputTokens + outputTokens
    ) {
        invalidResponse("usage.totalTokens");
    }

    return Object.freeze({
        inputTokens,
        outputTokens,
        totalTokens
    });
}

function requireFinishReason(value) {
    if (
        !Object.values(
            BrokerLLMFinishReason
        ).includes(value)
    ) {
        invalidResponse("finishReason");
    }

    return value;
}

function requireCount(value, field) {
    if (
        !Number.isSafeInteger(value) ||
        value < 0
    ) {
        invalidResponse(field);
    }

    return value;
}

function requireIdentifier(value, field) {
    const selected = requireText(
        value,
        field,
        128
    );

    if (
        !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u
            .test(selected)
    ) {
        invalidResponse(field);
    }

    return selected;
}

function requireText(value, field, maximum) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > maximum ||
        value.includes("\u0000")
    ) {
        invalidResponse(field);
    }

    return value;
}

function requireStreamText(
    value,
    field,
    maximum
) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > maximum ||
        value.includes("\u0000")
    ) {
        invalidResponse(field);
    }

    return value;
}

function hasExactKeys(value, expected) {
    const keys = Object.keys(value);

    return keys.length === expected.length &&
        expected.every(
            key => Object.hasOwn(value, key)
        );
}

function invalidResponse(field) {
    throw BrokerLLMProtocolError
        .invalidResponse(field);
}
