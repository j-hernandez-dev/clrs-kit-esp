import {
    BROKER_LLM_MAX_JSON_CHARACTERS,
    BrokerLLMOperation,
    BrokerLLMProtocolError,
    BrokerLLMResponseFormat,
    cloneBrokerLLMJson,
    getBrokerLLMOperationDescriptor,
    isBrokerLLMPlainRecord
} from "./BrokerLLMProtocol.js";

export class BrokerLLMResponseValidator {

    validate(request, value) {
        const descriptor =
            getBrokerLLMOperationDescriptor(
                request?.operation
            );

        if (
            request?.responseSchema !==
                descriptor.responseSchema ||
            request?.responseFormat !==
                descriptor.responseFormat
        ) {
            throw BrokerLLMProtocolError
                .invalidResponse("request");
        }

        if (
            descriptor.responseFormat ===
                BrokerLLMResponseFormat.TEXT
        ) {
            return normalizeTextResponse(value);
        }

        const parsed = parseResponse(value);
        let normalized;

        try {
            normalized = cloneBrokerLLMJson(
                parsed,
                "response"
            );
        } catch (error) {
            if (
                error instanceof
                BrokerLLMProtocolError
            ) {
                throw BrokerLLMProtocolError
                    .invalidResponse(
                        "response",
                        error
                    );
            }

            throw error;
        }

        requireRecord(normalized, "response");

        switch (request.operation) {
            case BrokerLLMOperation.CHAT:
                validateChat(normalized);
                break;

            case BrokerLLMOperation
                .TEST_CONNECTION:
                validateConnection(normalized);
                break;

            default:
                if (
                    Object.keys(normalized)
                        .length === 0
                ) {
                    invalidResponse("response");
                }
        }

        return normalized;
    }
}

function normalizeTextResponse(value) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > 65_536 ||
        value.includes("\u0000")
    ) {
        invalidResponse("response.text");
    }

    return value.trim();
}

export const brokerLLMResponseValidator =
    new BrokerLLMResponseValidator();

export function validateBrokerLLMResponse(
    request,
    value
) {
    return brokerLLMResponseValidator.validate(
        request,
        value
    );
}

function parseResponse(value) {
    if (typeof value !== "string") {
        return value;
    }

    if (
        value.length === 0 ||
        value.length >
            BROKER_LLM_MAX_JSON_CHARACTERS
    ) {
        invalidResponse("response");
    }

    try {
        return JSON.parse(value);
    } catch (cause) {
        throw BrokerLLMProtocolError
            .invalidResponse(
                "response.json",
                cause
            );
    }
}

function validateChat(value) {
    requireExactKeys(
        value,
        ["message"],
        "response"
    );
    requireText(
        value.message,
        "response.message",
        65_536
    );
}

function validateConnection(value) {
    requireExactKeys(
        value,
        ["connected", "message"],
        "response",
        ["connected"]
    );

    if (typeof value.connected !== "boolean") {
        invalidResponse("response.connected");
    }

    if (value.message != null) {
        requireText(
            value.message,
            "response.message",
            4_096
        );
    }
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
}

function requireRecord(value, field) {
    if (!isBrokerLLMPlainRecord(value)) {
        invalidResponse(field);
    }
}

function requireExactKeys(
    value,
    allowed,
    field,
    required = allowed
) {
    requireRecord(value, field);
    const keys = Object.keys(value);

    if (
        keys.some(
            key => !allowed.includes(key)
        ) ||
        required.some(
            key => !Object.hasOwn(value, key)
        )
    ) {
        invalidResponse(field);
    }
}

function invalidResponse(field) {
    throw BrokerLLMProtocolError
        .invalidResponse(field);
}
