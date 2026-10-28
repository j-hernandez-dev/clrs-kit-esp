import test from "node:test";
import assert from "node:assert/strict";

import {
    BrokerLLMFinishReason,
    BrokerLLMProviderError,
    BrokerLLMProviderFailureKind,
    createBrokerLLMProviderError,
    createBrokerLLMTransportResult,
    normalizeBrokerLLMFinishReason,
    normalizeBrokerLLMModel,
    normalizeBrokerLLMResponseId,
    normalizeBrokerLLMUsage,
    parseBrokerLLMProviderJson
} from "../src/broker95/llm/index.js";
import {
    BrokerLlmAvailabilityReason,
    classifyBrokerLlmFailure
} from "../src/broker95/llm/BrokerLlmAvailability.js";

test("normaliza causas de finalización de proveedores distintos", () => {
    assert.deepEqual(
        [
            "stop",
            "END_TURN",
            "max_tokens",
            "MAX_OUTPUT_TOKENS",
            "SAFETY",
            "recitation",
            "tool_calls",
            "function_call",
            "razón-desconocida",
            null
        ].map(normalizeBrokerLLMFinishReason),
        [
            BrokerLLMFinishReason.STOP,
            BrokerLLMFinishReason.STOP,
            BrokerLLMFinishReason.LENGTH,
            BrokerLLMFinishReason.LENGTH,
            BrokerLLMFinishReason.CONTENT_FILTER,
            BrokerLLMFinishReason.CONTENT_FILTER,
            BrokerLLMFinishReason.TOOL_CALL,
            BrokerLLMFinishReason.TOOL_CALL,
            BrokerLLMFinishReason.UNKNOWN,
            BrokerLLMFinishReason.UNKNOWN
        ]
    );
});

test("normaliza uso canónico, OpenAI, Gemini y Ollama", () => {
    const expected = {
        inputTokens: 7,
        outputTokens: 5,
        totalTokens: 12
    };
    const variants = [
        {
            inputTokens: 7,
            outputTokens: 5,
            totalTokens: 12
        },
        {
            prompt_tokens: 7,
            completion_tokens: 5,
            total_tokens: 12
        },
        {
            promptTokenCount: 7,
            candidatesTokenCount: 5,
            totalTokenCount: 12
        },
        {
            prompt_eval_count: 7,
            eval_count: 5
        }
    ];

    for (const variant of variants) {
        assert.deepEqual(
            normalizeBrokerLLMUsage(variant),
            expected
        );
    }

    assert.equal(
        normalizeBrokerLLMUsage({
            prompt_tokens: 7,
            completion_tokens: 5,
            total_tokens: 99
        }),
        null
    );
    assert.equal(
        normalizeBrokerLLMUsage({}),
        null
    );
});

test("construye un único resultado de transporte seguro", () => {
    const result =
        createBrokerLLMTransportResult({
            output: "{\"message\":\"Listo\"}",
            model: "  modelo-devuelto  ",
            fallbackModel:
                "modelo-configurado",
            finishReason: "END_TURN",
            usage: {
                promptTokenCount: 3,
                candidatesTokenCount: 2,
                totalTokenCount: 5
            },
            responseIds: [
                "id inválido",
                "response:ok-1"
            ]
        });

    assert.deepEqual(result, {
        output: "{\"message\":\"Listo\"}",
        model: "modelo-devuelto",
        finishReason:
            BrokerLLMFinishReason.STOP,
        usage: {
            inputTokens: 3,
            outputTokens: 2,
            totalTokens: 5
        },
        responseId: "response:ok-1"
    });
    assert.equal(Object.isFrozen(result), true);
    assert.equal(
        normalizeBrokerLLMModel(
            null,
            "modelo-respaldo"
        ),
        "modelo-respaldo"
    );
    assert.equal(
        normalizeBrokerLLMResponseId(
            "id inválido"
        ),
        null
    );
});

test("produce errores neutrales y los clasifica sin conocer al proveedor", () => {
    const cases = [
        [
            BrokerLLMProviderFailureKind.NETWORK,
            null,
            BrokerLlmAvailabilityReason.OFFLINE
        ],
        [
            BrokerLLMProviderFailureKind.TIMEOUT,
            null,
            BrokerLlmAvailabilityReason.TIMEOUT
        ],
        [
            BrokerLLMProviderFailureKind.HTTP,
            429,
            BrokerLlmAvailabilityReason
                .QUOTA_EXHAUSTED
        ],
        [
            BrokerLLMProviderFailureKind.AUTHENTICATION,
            null,
            BrokerLlmAvailabilityReason
                .AUTHENTICATION_FAILED
        ],
        [
            BrokerLLMProviderFailureKind.MODEL_UNAVAILABLE,
            null,
            BrokerLlmAvailabilityReason
                .MODEL_UNAVAILABLE
        ],
        [
            BrokerLLMProviderFailureKind.INVALID_RESPONSE,
            null,
            BrokerLlmAvailabilityReason
                .INVALID_RESPONSE
        ]
    ];

    for (const [failureKind, status, reason]
        of cases) {
        const error = createBrokerLLMProviderError({
            providerId: "provider-test",
            operation: "chat",
            failureKind,
            status
        });

        assert.equal(
            error instanceof
                BrokerLLMProviderError,
            true
        );
        assert.equal(
            classifyBrokerLlmFailure(error)
                .reason,
            reason
        );
        assert.deepEqual(
            error.diagnostics,
            [{
                providerId: "provider-test",
                operation: "chat",
                ...(status == null
                    ? {}
                    : { status })
            }]
        );
    }
});

test("normaliza JSON inválido como fallo seguro de respuesta o streaming", () => {
    assert.throws(
        () => parseBrokerLLMProviderJson(
            "```json",
            {
                providerId: "provider-test",
                operation: "review_submission"
            }
        ),
        error =>
            error instanceof
                BrokerLLMProviderError &&
            error.failureKind ===
                BrokerLLMProviderFailureKind
                    .INVALID_RESPONSE
    );
    assert.throws(
        () => parseBrokerLLMProviderJson(
            "{",
            {
                providerId: "provider-test",
                operation: "review_submission",
                streaming: true
            }
        ),
        error =>
            error.failureKind ===
                BrokerLLMProviderFailureKind
                    .INVALID_STREAM
    );
    assert.deepEqual(
        parseBrokerLLMProviderJson(
            "{\"ok\":true}",
            {
                providerId: "provider-test",
                operation: "test_connection"
            }
        ),
        { ok: true }
    );
});
