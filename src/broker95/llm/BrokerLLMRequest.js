import {
    BROKER_LLM_PROTOCOL_ID,
    BROKER_LLM_PROTOCOL_VERSION,
    BrokerLLMMessageRole,
    BrokerLLMOperation,
    BrokerLLMProtocolError,
    cloneBrokerLLMJson,
    getBrokerLLMOperationDescriptor,
    isBrokerLLMPlainRecord
} from "./BrokerLLMProtocol.js";

const REQUEST_KEYS = Object.freeze([
    "requestId",
    "model",
    "input",
    "context",
    "conversation",
    "stream"
]);

export function createBrokerLLMRequest(
    operation,
    source = {}
) {
    const descriptor =
        getBrokerLLMOperationDescriptor(
            operation
        );

    requireExactKeys(source, REQUEST_KEYS);

    const input = cloneBrokerLLMJson(
        source.input ?? {},
        "input"
    );
    const context = cloneBrokerLLMJson(
        source.context ?? {},
        "context"
    );

    requireRecord(input, "input");
    requireRecord(context, "context");
    validateOperationInput(operation, input);

    const stream = source.stream ??
        descriptor.streamingByDefault;

    if (
        typeof stream !== "boolean" ||
        (
            stream &&
            !descriptor.supportsStreaming
        )
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("stream");
    }

    return Object.freeze({
        protocol: BROKER_LLM_PROTOCOL_ID,
        protocolVersion:
            BROKER_LLM_PROTOCOL_VERSION,
        requestId: requireIdentifier(
            source.requestId,
            "requestId"
        ),
        operation,
        model: requireModel(source.model),
        input,
        context,
        conversation:
            createConversation(
                source.conversation ?? []
            ),
        responseFormat:
            descriptor.responseFormat,
        responseSchema:
            descriptor.responseSchema,
        stream
    });
}

export function createGenerateContractRequest(
    source
) {
    return createBrokerLLMRequest(
        BrokerLLMOperation.GENERATE_CONTRACT,
        source
    );
}

export function createReviewSubmissionRequest(
    source
) {
    return createBrokerLLMRequest(
        BrokerLLMOperation.REVIEW_SUBMISSION,
        source
    );
}

export function createAskSubmissionRequest(source) {
    return createBrokerLLMRequest(
        BrokerLLMOperation.ASK_SUBMISSION,
        source
    );
}

export function createEvaluateSubmissionRequest(
    source
) {
    return createBrokerLLMRequest(
        BrokerLLMOperation
            .EVALUATE_SUBMISSION,
        source
    );
}

export function createChatRequest(source) {
    return createBrokerLLMRequest(
        BrokerLLMOperation.CHAT,
        source
    );
}

export function createTestConnectionRequest(
    source
) {
    return createBrokerLLMRequest(
        BrokerLLMOperation.TEST_CONNECTION,
        source
    );
}

function createConversation(messages) {
    if (
        !Array.isArray(messages) ||
        messages.length > 96
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("conversation");
    }

    return Object.freeze(
        messages.map((message, index) => {
            requireRecord(
                message,
                `conversation[${index}]`
            );
            requireExactKeys(
                message,
                ["role", "content"],
                `conversation[${index}]`
            );

            if (
                !Object.values(
                    BrokerLLMMessageRole
                ).includes(message.role)
            ) {
                throw BrokerLLMProtocolError
                    .invalidRequest(
                        `conversation[${index}].role`
                    );
            }

            return Object.freeze({
                role: message.role,
                content: requireText(
                    message.content,
                    `conversation[${index}].content`,
                    65_536
                )
            });
        })
    );
}

function validateOperationInput(
    operation,
    input
) {
    if (
        operation ===
            BrokerLLMOperation.CHAT
    ) {
        requireExactKeys(
            input,
            ["message"],
            "input"
        );
        requireText(
            input.message,
            "input.message",
            65_536
        );
    }

    if (
        operation ===
            BrokerLLMOperation.TEST_CONNECTION &&
        Object.keys(input).length !== 0
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("input");
    }
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
        throw BrokerLLMProtocolError
            .invalidRequest(field);
    }

    return selected;
}

function requireModel(value) {
    const selected = requireText(
        value,
        "model",
        256
    ).trim();

    if (
        selected.length === 0 ||
        /[\u0000-\u001F\u007F]/u
            .test(selected)
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("model");
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
        throw BrokerLLMProtocolError
            .invalidRequest(field);
    }

    return value;
}

function requireRecord(value, field) {
    if (!isBrokerLLMPlainRecord(value)) {
        throw BrokerLLMProtocolError
            .invalidRequest(field);
    }
}

function requireExactKeys(
    value,
    allowed,
    field = "request"
) {
    requireRecord(value, field);

    if (
        Object.keys(value).some(
            key => !allowed.includes(key)
        )
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest(field);
    }
}
