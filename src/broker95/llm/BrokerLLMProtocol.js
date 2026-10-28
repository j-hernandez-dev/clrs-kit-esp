import {
    ApplicationError
} from "../../errors/ApplicationError.js";

export const BROKER_LLM_PROTOCOL_ID =
    "broker95-llm";
export const BROKER_LLM_PROTOCOL_VERSION = 1;
export const BROKER_LLM_MAX_JSON_CHARACTERS =
    1_048_576;

export const BrokerLLMOperation = Object.freeze({
    GENERATE_CONTRACT: "generateContract",
    REVIEW_SUBMISSION: "reviewSubmission",
    ASK_SUBMISSION: "askSubmission",
    EVALUATE_SUBMISSION:
        "evaluateSubmission",
    CHAT: "chat",
    TEST_CONNECTION: "testConnection"
});

export const BrokerLLMResponseFormat =
    Object.freeze({
        JSON: "json",
        TEXT: "text"
    });

export const BrokerLLMResponseSchema =
    Object.freeze({
        CONTRACT_DRAFT:
            "broker95.contract-draft/1",
        SUBMISSION_REVIEW:
            "broker95.submission-review/1",
        SUBMISSION_ANSWER:
            "broker95.submission-answer/1",
        SUBMISSION_EVALUATION:
            "broker95.submission-evaluation/1",
        CHAT_MESSAGE:
            "broker95.chat-message/1",
        CONNECTION_TEST:
            "broker95.connection-test/1"
    });

export const BrokerLLMMessageRole =
    Object.freeze({
        USER: "user",
        ASSISTANT: "assistant"
    });

const OPERATION_DESCRIPTORS =
    Object.freeze({
        [BrokerLLMOperation
            .GENERATE_CONTRACT]: descriptor(
            BrokerLLMResponseSchema
                .CONTRACT_DRAFT,
            false
        ),
        [BrokerLLMOperation
            .REVIEW_SUBMISSION]: descriptor(
            BrokerLLMResponseSchema
                .SUBMISSION_REVIEW,
            true
        ),
        [BrokerLLMOperation
            .ASK_SUBMISSION]: descriptor(
            BrokerLLMResponseSchema
                .SUBMISSION_ANSWER,
            true,
            BrokerLLMResponseFormat.TEXT
        ),
        [BrokerLLMOperation
            .EVALUATE_SUBMISSION]: descriptor(
            BrokerLLMResponseSchema
                .SUBMISSION_EVALUATION,
            false
        ),
        [BrokerLLMOperation.CHAT]: descriptor(
            BrokerLLMResponseSchema
                .CHAT_MESSAGE,
            true
        ),
        [BrokerLLMOperation
            .TEST_CONNECTION]: descriptor(
            BrokerLLMResponseSchema
                .CONNECTION_TEST,
            false
        )
    });

export class BrokerLLMProtocolError
    extends ApplicationError {

    constructor(
        technicalMessage,
        publicMessage,
        code,
        options = {}
    ) {
        super(technicalMessage, {
            code,
            publicMessage,
            diagnostics:
                options.diagnostics ?? [],
            cause: options.cause,
            audience: options.audience
        });

        this.name = "BrokerLLMProtocolError";
    }

    static unknownOperation(operation) {
        return new BrokerLLMProtocolError(
            `Unknown BROKER.95 LLM operation: ${String(operation)}.`,
            "La operación solicitada a CIPHER no es válida.",
            "BROKER95_LLM_OPERATION_UNKNOWN"
        );
    }

    static invalidRequest(field) {
        return new BrokerLLMProtocolError(
            `Invalid BROKER.95 LLM request field: ${field}.`,
            "La solicitud enviada a CIPHER no es válida.",
            "BROKER95_LLM_REQUEST_INVALID",
            { diagnostics: [{ field }] }
        );
    }

    static invalidResponse(field, cause) {
        return new BrokerLLMProtocolError(
            `Invalid BROKER.95 LLM response field: ${field}.`,
            "CIPHER devolvió una respuesta que no pudo validarse.",
            "BROKER95_LLM_RESPONSE_INVALID",
            {
                diagnostics: [{ field }],
                cause
            }
        );
    }

    static invalidPort() {
        return new BrokerLLMProtocolError(
            "Invalid BROKER.95 LLM response validator configuration.",
            "Ocurrió un error interno al configurar CIPHER.",
            "BROKER95_LLM_PORT_CONFIGURATION_INVALID",
            { audience: "developer" }
        );
    }

    static notImplemented(operation) {
        return new BrokerLLMProtocolError(
            `BROKER.95 LLM adapter does not implement ${operation}.`,
            "CIPHER no dispone todavía de un proveedor configurado.",
            "BROKER95_LLM_PORT_NOT_IMPLEMENTED",
            {
                audience: "developer",
                diagnostics: [{ operation }]
            }
        );
    }

    static aborted(operation) {
        return new BrokerLLMProtocolError(
            `BROKER.95 LLM operation ${operation} was aborted.`,
            "La operación con CIPHER fue cancelada.",
            "BROKER95_LLM_REQUEST_ABORTED",
            { diagnostics: [{ operation }] }
        );
    }
}

export function getBrokerLLMOperationDescriptor(
    operation
) {
    const selected =
        OPERATION_DESCRIPTORS[operation];

    if (!selected) {
        throw BrokerLLMProtocolError
            .unknownOperation(operation);
    }

    return selected;
}

export function cloneBrokerLLMJson(
    value,
    field = "value"
) {
    const state = {
        nodes: 0,
        characters: 0,
        ancestors: new WeakSet()
    };

    return cloneJsonValue(
        value,
        field,
        0,
        state
    );
}

export function isBrokerLLMPlainRecord(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        return false;
    }

    const prototype =
        Object.getPrototypeOf(value);

    return prototype === Object.prototype ||
        prototype === null;
}

function descriptor(
    schema,
    supportsStreaming,
    responseFormat = BrokerLLMResponseFormat.JSON
) {
    return Object.freeze({
        responseFormat,
        responseSchema: schema,
        supportsStreaming,
        streamingByDefault:
            supportsStreaming
    });
}

function cloneJsonValue(
    value,
    field,
    depth,
    state
) {
    state.nodes += 1;

    if (state.nodes > 50_000 || depth > 32) {
        throw BrokerLLMProtocolError
            .invalidRequest(field);
    }

    if (value === null) {
        return null;
    }

    if (typeof value === "string") {
        state.characters += value.length;

        if (
            value.length > 262_144 ||
            state.characters >
                BROKER_LLM_MAX_JSON_CHARACTERS ||
            value.includes("\u0000")
        ) {
            throw BrokerLLMProtocolError
                .invalidRequest(field);
        }

        return value;
    }

    if (
        typeof value === "boolean" ||
        (
            typeof value === "number" &&
            Number.isFinite(value)
        )
    ) {
        return value;
    }

    if (
        typeof value !== "object" ||
        state.ancestors.has(value)
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest(field);
    }

    state.ancestors.add(value);

    try {
        if (Array.isArray(value)) {
            if (value.length > 10_000) {
                throw BrokerLLMProtocolError
                    .invalidRequest(field);
            }

            return Object.freeze(
                value.map((item, index) =>
                    cloneJsonValue(
                        item,
                        `${field}[${index}]`,
                        depth + 1,
                        state
                    )
                )
            );
        }

        if (!isBrokerLLMPlainRecord(value)) {
            throw BrokerLLMProtocolError
                .invalidRequest(field);
        }

        const keys = Object.keys(value);

        if (keys.length > 1_000) {
            throw BrokerLLMProtocolError
                .invalidRequest(field);
        }

        const clone = {};

        for (const key of keys) {
            if (
                key === "__proto__" ||
                key === "prototype" ||
                key === "constructor"
            ) {
                throw BrokerLLMProtocolError
                    .invalidRequest(
                        `${field}.${key}`
                    );
            }

            clone[key] = cloneJsonValue(
                value[key],
                `${field}.${key}`,
                depth + 1,
                state
            );
        }

        return Object.freeze(clone);
    } finally {
        state.ancestors.delete(value);
    }
}
