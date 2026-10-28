import assert from "node:assert/strict";
import test from "node:test";

import {
    OPENAI_COMPATIBLE_PROVIDER_PROFILES,
    OpenAICompatibleBroker95LLMAdapter,
    OpenAICompatibleBroker95LLMAdapterError,
    createOpenAICompatibleChatPayload,
    getOpenAICompatibleBroker95Profile
} from "../extension/adapters/OpenAICompatibleBroker95LLMAdapter.js";
import {
    BrokerLLMProviderId,
    BrokerRisk,
    brokerCategoryCatalog,
    createBrokerContractGenerationRequest,
    createBrokerLLMRequest
} from "../src/broker95/index.js";

const PROVIDERS = Object.freeze([
    {
        id: BrokerLLMProviderId.LM_STUDIO,
        baseUrl:
            "http://127.0.0.1:1234/v1",
        credentialKind: "optional-api-key"
    },
    {
        id: BrokerLLMProviderId.XAI,
        baseUrl: "https://api.x.ai/v1",
        credentialKind: "api-key"
    },
    {
        id: BrokerLLMProviderId.TOGETHER,
        baseUrl:
            "https://api.together.ai/v1",
        credentialKind: "api-key"
    },
    {
        id: BrokerLLMProviderId.ZAI,
        baseUrl:
            "https://api.z.ai/api/paas/v4",
        credentialKind: "api-key"
    },
    {
        id: BrokerLLMProviderId.HUGGING_FACE,
        baseUrl: "https://router.huggingface.co/v1",
        credentialKind: "api-key"
    },
    {
        id: BrokerLLMProviderId.OPENROUTER,
        baseUrl: "https://openrouter.ai/api/v1",
        credentialKind: "api-key"
    }
]);

test("define perfiles inmutables únicamente para los proveedores compatibles", () => {
    assert.deepEqual(
        Object.keys(
            OPENAI_COMPATIBLE_PROVIDER_PROFILES
        ),
        PROVIDERS.map(provider => provider.id)
    );
    assert.equal(
        getOpenAICompatibleBroker95Profile(
            "lm-studio"
        ).baseUrl,
        null
    );
    assert.equal(
        getOpenAICompatibleBroker95Profile(
            "xai"
        ).baseUrl,
        "https://api.x.ai/v1"
    );
    assert.equal(
        Object.isFrozen(
            OPENAI_COMPATIBLE_PROVIDER_PROFILES
        ),
        true
    );
    assert.throws(
        () => getOpenAICompatibleBroker95Profile(
            "unregistered-provider"
        ),
        error => error.code ===
            "BROKER95_LLM_REQUEST_INVALID"
    );
});

test("reutiliza Chat Completions, JSON Object y transporte normalizado", async () => {
    for (const provider of PROVIDERS) {
        const calls = [];
        const adapter = createAdapter({
            provider,
            fetch: async (url, init) => {
                calls.push({ url, init });
                return jsonResponse({
                    id: `${provider.id}-response-1`,
                    model: `${provider.id}-model`,
                    choices: [{
                        message: {
                            content:
                                "{\"title\":\"Señal compatible\"}",
                            reasoning_content:
                                "razonamiento privado"
                        },
                        finish_reason: "stop"
                    }],
                    usage: {
                        prompt_tokens: 14,
                        completion_tokens: 6,
                        total_tokens: 20
                    }
                });
            }
        });
        const result = await adapter
            .generateContract(
                contractRequest(provider.id)
            );
        const body = JSON.parse(
            calls[0].init.body
        );

        assert.equal(
            calls[0].url,
            `${provider.baseUrl}/chat/completions`
        );
        assert.equal(
            calls[0].init.redirect,
            "error"
        );
        assert.equal(
            calls[0].init.headers
                .Authorization,
            provider.id === "lm-studio"
                ? undefined
                : `Bearer ${provider.id}-secret`
        );
        assert.equal(
            calls[0].init.headers[
                "Content-Type"
            ],
            "application/json"
        );
        assert.equal(
            body.model,
            `${provider.id}-model`
        );
        assert.deepEqual(
            body.response_format,
            { type: "json_object" }
        );
        assert.equal(body.stream, false);
        assert.equal(
            Number.isSafeInteger(
                body.max_tokens
            ),
            true
        );
        assert.deepEqual(result.output, {
            title: "Señal compatible"
        });
        assert.equal(
            result.providerId,
            provider.id
        );
        assert.deepEqual(result.usage, {
            inputTokens: 14,
            outputTokens: 6,
            totalTokens: 20
        });
        assert.equal(
            JSON.stringify(result).includes(
                "razonamiento privado"
            ),
            false
        );
        assert.equal(
            JSON.stringify(result).includes(
                "-secret"
            ),
            false
        );
    }
});

test("LM Studio agrega el token sólo cuando fue configurado", async () => {
    const provider = PROVIDERS[0];
    const calls = [];
    const adapter = createAdapter({
        provider,
        credentialValue: "token-local",
        fetch: async (url, init) => {
            calls.push({ url, init });
            return jsonResponse({
                data: [{
                    id: "lm-studio-model"
                }]
            });
        }
    });

    const result = await adapter.testConnection({
        requestId: "lm-studio:test:token",
        model: "ignored"
    });

    assert.equal(
        calls[0].url,
        `${provider.baseUrl}/models`
    );
    assert.equal(
        calls[0].init.headers.Authorization,
        "Bearer token-local"
    );
    assert.deepEqual(result.output, {
        connected: true,
        message: "Modelo local disponible."
    });
});

test("consume SSE común, omite razonamiento y admite cierre por finish_reason", async () => {
    const provider = PROVIDERS[2];
    const deltas = [];
    const adapter = createAdapter({
        provider,
        fetch: async () => streamResponse([
            ": keep-alive\n\n",
            "data: {\"id\":\"together-stream\",\"model\":\"together-model\",\"choices\":[{\"delta\":{\"reasoning_content\":\"privado\",\"content\":\"{\\\"summary\\\":\\\"ok\\\"\"},\"finish_reason\":null}]}\n\n",
            "data: {\"id\":\"together-stream\",\"model\":\"together-model\",\"choices\":[{\"delta\":{\"content\":\"}\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":8,\"completion_tokens\":3,\"total_tokens\":11}}\n\n"
        ])
    });

    const result = await adapter.reviewSubmission({
        requestId: "together:stream:1",
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
        "together-stream"
    );
    assert.equal(
        JSON.stringify(result).includes(
            "privado"
        ),
        false
    );
});

test("comprueba el modelo configurado mediante el endpoint compatible", async () => {
    for (const provider of PROVIDERS) {
        const calls = [];
        const completionProbe = ["together", "zai", "hugging-face", "openrouter"]
            .includes(provider.id);
        const adapter = createAdapter({
            provider,
            fetch: async (url, init) => {
                calls.push({ url, init });
                return completionProbe
                    ? jsonResponse({
                        id: "zai-probe",
                        request_id:
                            "zai-request-probe",
                        model: `${provider.id}-model`,
                        choices: [{
                            message: {
                                content: "OK"
                            },
                            finish_reason: "stop"
                        }],
                        usage: {
                            prompt_tokens: 6,
                            completion_tokens: 1,
                            total_tokens: 7
                        }
                    })
                    : jsonResponse(provider.id === "xai"
                        ? {
                            models: [{
                                id: `${provider.id}-model`
                            }]
                        }
                        : {
                            object: "list",
                            data: [{
                                id: `${provider.id}-model`
                            }]
                        });
            }
        });
        const result = await adapter
            .testConnection({
                requestId:
                    `${provider.id}:test:model`,
                model: "ignored"
            });

        assert.equal(
            calls[0].url,
            completionProbe
                ? `${provider.baseUrl}/chat/completions`
                : `${provider.baseUrl}/${provider.id === "xai"
                    ? "language-models" : "models"}`
        );
        assert.equal(
            calls[0].init.method,
            completionProbe
                ? "POST"
                : "GET"
        );
        assert.equal(result.providerId, provider.id);
    }
});

test("clasifica fallos HTTP sin filtrar credenciales", async () => {
    const provider = PROVIDERS[1];

    for (const [status, kind] of [
        [401, "authentication"],
        [403, "authentication"],
        [402, "quota"],
        [429, "quota"],
        [404, "model-unavailable"],
        [503, "http"]
    ]) {
        const adapter = createAdapter({
            provider,
            fetch: async () => ({
                ok: false,
                status,
                headers: {
                    get() { return null; }
                }
            })
        });

        await assert.rejects(
            () => adapter.generateContract(
                contractRequest(
                    `xai:error:${status}`
                )
            ),
            error =>
                error instanceof
                    OpenAICompatibleBroker95LLMAdapterError &&
                error.providerId === "xai" &&
                error.failureKind === kind &&
                error.httpStatus === status &&
                !JSON.stringify(error).includes(
                    "xai-secret"
                )
        );
    }
});

test("rechaza endpoints no locales y respuestas o streams incompletos", async () => {
    const local = PROVIDERS[0];
    const remoteEndpoint = createAdapter({
        provider: {
            ...local,
            baseUrl:
                "http://192.168.1.20:1234/v1"
        },
        fetch: async () => {
            assert.fail(
                "No debía abrir una conexión remota."
            );
        }
    });

    await assert.rejects(
        () => remoteEndpoint.testConnection({
            requestId: "lm-studio:unsafe",
            model: "ignored"
        }),
        error => error.code ===
            "BROKER95_LLM_REQUEST_INVALID"
    );

    const empty = createAdapter({
        provider: PROVIDERS[3],
        fetch: async () => jsonResponse({
            choices: [{
                message: { content: "" },
                finish_reason: "stop"
            }]
        })
    });

    await assert.rejects(
        () => empty.generateContract(
            contractRequest("zai:empty")
        ),
        error => error.failureKind ===
            "invalid-response"
    );

    const incomplete = createAdapter({
        provider: PROVIDERS[2],
        fetch: async () => streamResponse([
            "data: {\"choices\":[{\"delta\":{\"content\":\"{}\"},\"finish_reason\":null}]}\n\n"
        ])
    });

    await assert.rejects(
        () => incomplete.reviewSubmission({
            requestId: "together:incomplete",
            model: "ignored",
            input: {},
            context: {}
        }),
        error => error.failureKind ===
            "invalid-stream"
    );
});

test("omite JSON Object en las conversaciones de texto natural", () => {
    const payload =
        createOpenAICompatibleChatPayload(
            createBrokerLLMRequest(
                "askSubmission",
                {
                    requestId: "compatible:ask",
                    model: "modelo",
                    input: {
                        question: "¿Me ayudas?"
                    },
                    stream: false
                }
            ),
            "modelo"
        );

    assert.equal(
        Object.hasOwn(
            payload,
            "response_format"
        ),
        false
    );
});

function createAdapter({
    provider,
    fetch,
    credentialValue = null
}) {
    return new OpenAICompatibleBroker95LLMAdapter({
        providerId: provider.id,
        configurationService: {
            async resolvePrivateLlmSettings(
                providerId
            ) {
                assert.equal(
                    providerId,
                    provider.id
                );
                const value = credentialValue ??
                    (provider.credentialKind ===
                        "api-key"
                        ? `${provider.id}-secret`
                        : null);

                return {
                    providerId: provider.id,
                    model:
                        `${provider.id}-model`,
                    credential: {
                        providerId: provider.id,
                        kind:
                            provider.credentialKind,
                        ...(value == null
                            ? {}
                            : { value })
                    },
                    ...(provider.id ===
                        "lm-studio"
                        ? {
                            baseUrl:
                                provider.baseUrl
                        }
                        : {})
                };
            }
        },
        fetch,
        timeoutMs: 5_000,
        developerLogger: { error() {} }
    });
}

function contractRequest(
    requestId = "compatible:contract:1"
) {
    return createBrokerContractGenerationRequest({
        requestId,
        model: "ignored",
        risk: BrokerRisk.LOW,
        category:
            brokerCategoryCatalog
                .requireCategory("NUM-ARITH")
    });
}

function jsonResponse(payload) {
    return {
        ok: true,
        status: 200,
        headers: {
            get() { return null; }
        },
        async text() {
            return JSON.stringify(payload);
        }
    };
}

function streamResponse(chunks) {
    const encoder = new TextEncoder();

    return {
        ok: true,
        status: 200,
        headers: {
            get() { return null; }
        },
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
