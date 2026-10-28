import assert from "node:assert/strict";
import test from "node:test";

import {
    DEEPSEEK_CHAT_COMPLETIONS_URL,
    DEEPSEEK_MODELS_URL,
    DeepSeekBroker95LLMAdapter,
    DeepSeekBroker95LLMAdapterError,
    createDeepSeekChatPayload
} from "../extension/adapters/DeepSeekBroker95LLMAdapter.js";
import {
    BrokerRisk,
    createBrokerLLMRequest,
    createBrokerContractGenerationRequest
} from "../src/broker95/index.js";

test("DeepSeek permite texto natural para ai -ask sin forzar JSON", () => {
    const payload = createDeepSeekChatPayload(
        askRequest("deepseek-model"),
        "deepseek-model"
    );

    assert.equal(
        Object.hasOwn(payload, "response_format"),
        false
    );
});
import {
    brokerCategoryCatalog
} from "../src/broker95/catalog/BrokerCategoryCatalog.js";

function askRequest(model) {
    return createBrokerLLMRequest(
        "askSubmission",
        {
            requestId: "ask:payload",
            model,
            input: { question: "¿Me ayudas?" },
            stream: false
        }
    );
}

test(
    "DeepSeek usa Chat Completions, JSON Object y transporte normalizado",
    async () => {
        const calls = [];
        const adapter = createAdapter({
            fetch: async (url, init) => {
                calls.push({ url, init });
                return createJsonResponse({
                    id: "deepseek-response-1",
                    model: "deepseek-v4-pro",
                    choices: [{
                        message: {
                            content:
                                "{\"title\":\"Señal\"}",
                            reasoning_content:
                                "razonamiento privado"
                        },
                        finish_reason: "stop"
                    }],
                    usage: {
                        prompt_tokens: 15,
                        completion_tokens: 7,
                        total_tokens: 22
                    }
                });
            }
        });

        const result = await adapter.generateContract(
            contractRequest()
        );
        const body = JSON.parse(
            calls[0].init.body
        );

        assert.equal(
            calls[0].url,
            DEEPSEEK_CHAT_COMPLETIONS_URL
        );
        assert.equal(
            calls[0].init.headers.Authorization,
            "Bearer deepseek-secret"
        );
        assert.equal(body.model, "deepseek-v4-pro");
        assert.deepEqual(body.response_format, {
            type: "json_object"
        });
        assert.equal(body.stream, false);
        assert.equal(
            Number.isSafeInteger(body.max_tokens),
            true
        );
        assert.match(
            body.messages[0].content,
            /json/iu
        );
        assert.deepEqual(result.output, {
            title: "Señal"
        });
        assert.equal(result.providerId, "deepseek");
        assert.equal(result.model, "deepseek-v4-pro");
        assert.equal(
            result.responseId,
            "deepseek-response-1"
        );
        assert.deepEqual(result.usage, {
            inputTokens: 15,
            outputTokens: 7,
            totalTokens: 22
        });
        assert.equal(
            JSON.stringify(result).includes(
                "razonamiento privado"
            ),
            false
        );
        assert.equal(
            JSON.stringify(result).includes(
                "deepseek-secret"
            ),
            false
        );
    }
);

test(
    "DeepSeek consume SSE, ignora reasoning_content y publica sólo la respuesta final",
    async () => {
        const deltas = [];
        const adapter = createAdapter({
            fetch: async () => createStreamResponse([
                ": keep-alive\n\n",
                "data: {\"id\":\"deepseek-stream-1\",\"model\":\"deepseek-v4-pro\",\"choices\":[{\"delta\":{\"reasoning_content\":\"interno\",\"content\":\"\"},\"finish_reason\":null}]}\n\n",
                "data: {\"id\":\"deepseek-stream-1\",\"model\":\"deepseek-v4-pro\",\"choices\":[{\"delta\":{\"content\":\"{\\\"summary\\\":\\\"ok\\\"\"},\"finish_reason\":null}]}\n\n",
                "data: {\"id\":\"deepseek-stream-1\",\"model\":\"deepseek-v4-pro\",\"choices\":[{\"delta\":{\"content\":\"}\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":9,\"completion_tokens\":4,\"total_tokens\":13}}\n\n",
                "data: [DONE]\n\n"
            ])
        });

        const result = await adapter.reviewSubmission({
            requestId: "deepseek:review:1",
            model: "ignored",
            input: { source: "PRINCIPAL()" },
            context: {}
        }, {
            onDelta(delta) {
                deltas.push(delta.text);
            }
        });

        assert.deepEqual(deltas, [
            "{\"summary\":\"ok\"",
            "}"
        ]);
        assert.deepEqual(result.output, {
            summary: "ok"
        });
        assert.equal(result.finishReason, "stop");
        assert.equal(
            result.responseId,
            "deepseek-stream-1"
        );
        assert.deepEqual(result.usage, {
            inputTokens: 9,
            outputTokens: 4,
            totalTokens: 13
        });
        assert.equal(
            JSON.stringify(result).includes("interno"),
            false
        );
    }
);

test(
    "DeepSeek comprueba el modelo configurado mediante la lista oficial",
    async () => {
        const calls = [];
        const adapter = createAdapter({
            fetch: async (url, init) => {
                calls.push({ url, init });
                return createJsonResponse({
                    object: "list",
                    data: [{
                        id: "deepseek-v4-flash",
                        object: "model",
                        owned_by: "deepseek"
                    }, {
                        id: "deepseek-v4-pro",
                        object: "model",
                        owned_by: "deepseek"
                    }]
                });
            }
        });

        const result = await adapter.testConnection({
            requestId: "deepseek:test:1",
            model: "ignored"
        });

        assert.equal(calls[0].url, DEEPSEEK_MODELS_URL);
        assert.equal(calls[0].init.method, "GET");
        assert.deepEqual(result.output, {
            connected: true,
            message: "Modelo disponible."
        });
    }
);

test(
    "DeepSeek informa un modelo ausente sin realizar una completion",
    async () => {
        const adapter = createAdapter({
            fetch: async () => createJsonResponse({
                object: "list",
                data: [{ id: "deepseek-v4-flash" }]
            })
        });

        await assert.rejects(
            () => adapter.testConnection({
                requestId: "deepseek:test:missing",
                model: "ignored"
            }),
            error =>
                error instanceof
                    DeepSeekBroker95LLMAdapterError &&
                error.code ===
                    "BROKER95_DEEPSEEK_MODEL_UNAVAILABLE" &&
                error.failureKind ===
                    "model-unavailable"
        );
    }
);

test(
    "DeepSeek clasifica autenticación, saldo, límite y modelo sin filtrar secretos",
    async () => {
        for (const [status, code, kind] of [
            [401, "BROKER95_DEEPSEEK_AUTHENTICATION_FAILED", "authentication"],
            [402, "BROKER95_DEEPSEEK_QUOTA_EXHAUSTED", "quota"],
            [429, "BROKER95_DEEPSEEK_QUOTA_EXHAUSTED", "quota"],
            [404, "BROKER95_DEEPSEEK_MODEL_UNAVAILABLE", "model-unavailable"],
            [503, "BROKER95_DEEPSEEK_HTTP_FAILED", "http"]
        ]) {
            const adapter = createAdapter({
                fetch: async () =>
                    createErrorResponse(status)
            });

            await assert.rejects(
                () => adapter.generateContract(
                    contractRequest(
                        `deepseek:error:${status}`
                    )
                ),
                error =>
                    error instanceof
                        DeepSeekBroker95LLMAdapterError &&
                    error.code === code &&
                    error.failureKind === kind &&
                    error.httpStatus === status &&
                    !JSON.stringify(error).includes(
                        "deepseek-secret"
                    )
            );
        }
    }
);

test(
    "DeepSeek rechaza respuestas vacías y streams sin cierre terminal",
    async () => {
        const empty = createAdapter({
            fetch: async () => createJsonResponse({
                id: "empty",
                model: "deepseek-v4-pro",
                choices: [{
                    message: { content: "" },
                    finish_reason: "stop"
                }]
            })
        });

        await assert.rejects(
            () => empty.generateContract(
                contractRequest("deepseek:empty")
            ),
            error =>
                error instanceof
                    DeepSeekBroker95LLMAdapterError &&
                error.code ===
                    "BROKER95_DEEPSEEK_RESPONSE_INVALID"
        );

        const incomplete = createAdapter({
            fetch: async () => createStreamResponse([
                "data: {\"choices\":[{\"delta\":{\"content\":\"{}\"},\"finish_reason\":\"stop\"}]}\n\n"
            ])
        });

        await assert.rejects(
            () => incomplete.reviewSubmission({
                requestId: "deepseek:stream:invalid",
                model: "ignored",
                input: {},
                context: {}
            }),
            error =>
                error instanceof
                    DeepSeekBroker95LLMAdapterError &&
                error.code ===
                    "BROKER95_DEEPSEEK_STREAM_INVALID" &&
                error.failureKind === "invalid-stream"
        );
    }
);

function createAdapter({ fetch }) {
    return new DeepSeekBroker95LLMAdapter({
        configurationService: {
            async resolvePrivateLlmSettings(providerId) {
                assert.equal(providerId, "deepseek");
                return {
                    providerId: "deepseek",
                    model: "deepseek-v4-pro",
                    credential: {
                        providerId: "deepseek",
                        kind: "api-key",
                        value: "deepseek-secret"
                    }
                };
            }
        },
        fetch,
        developerLogger: { error() {} },
        timeoutMs: 5_000
    });
}

function contractRequest(
    requestId = "deepseek:contract:1"
) {
    return createBrokerContractGenerationRequest({
        requestId,
        model: "ignored",
        risk: BrokerRisk.LOW,
        category:
            brokerCategoryCatalog.requireCategory(
                "NUM-ARITH"
            )
    });
}

function createJsonResponse(payload) {
    return {
        ok: true,
        status: 200,
        headers: { get() { return null; } },
        async text() {
            return JSON.stringify(payload);
        }
    };
}

function createErrorResponse(status) {
    return {
        ok: false,
        status,
        headers: { get() { return null; } }
    };
}

function createStreamResponse(chunks) {
    const encoder = new TextEncoder();

    return {
        ok: true,
        status: 200,
        headers: { get() { return null; } },
        body: new ReadableStream({
            start(controller) {
                for (const chunk of chunks) {
                    controller.enqueue(
                        encoder.encode(chunk)
                    );
                }
                controller.close();
            }
        })
    };
}
