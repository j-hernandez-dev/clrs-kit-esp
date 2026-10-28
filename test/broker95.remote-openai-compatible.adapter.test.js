import assert from "node:assert/strict";
import test from "node:test";

import {
    MAX_OPENAI_COMPATIBLE_JSON_CHARACTERS,
    OpenAICompatibleBroker95LLMAdapter,
    OpenAICompatibleConnectionProbe,
    createOpenAICompatibleConnectionProbePayload,
    getOpenAICompatibleBroker95Profile
} from "../extension/adapters/OpenAICompatibleBroker95LLMAdapter.js";
import {
    BrokerLLMProviderId,
    BrokerRisk,
    brokerCategoryCatalog,
    createBrokerContractGenerationRequest
} from "../src/broker95/index.js";

const REMOTE_PROVIDERS = Object.freeze([
    Object.freeze({
        id: BrokerLLMProviderId.XAI,
        baseUrl: "https://api.x.ai/v1",
        model: "grok-4.6",
        connectionProbe:
            OpenAICompatibleConnectionProbe.MODELS
    }),
    Object.freeze({
        id: BrokerLLMProviderId.TOGETHER,
        baseUrl: "https://api.together.ai/v1",
        model: "organizacion/modelo",
        connectionProbe:
            OpenAICompatibleConnectionProbe
                .CHAT_COMPLETION
    }),
    Object.freeze({
        id: BrokerLLMProviderId.ZAI,
        baseUrl:
            "https://api.z.ai/api/paas/v4",
        model: "glm-5.1",
        connectionProbe:
            OpenAICompatibleConnectionProbe
                .CHAT_COMPLETION
    }),
    Object.freeze({
        id: BrokerLLMProviderId.HUGGING_FACE,
        baseUrl: "https://router.huggingface.co/v1",
        model: "organizacion/modelo:fastest",
        connectionProbe:
            OpenAICompatibleConnectionProbe.CHAT_COMPLETION
    }),
    Object.freeze({
        id: BrokerLLMProviderId.OPENROUTER,
        baseUrl: "https://openrouter.ai/api/v1",
        model: "organizacion/modelo:free",
        connectionProbe:
            OpenAICompatibleConnectionProbe.CHAT_COMPLETION
    })
]);

test("fija los perfiles remotos verificados sin permitir URL del usuario", () => {
    for (const expected of REMOTE_PROVIDERS) {
        const profile =
            getOpenAICompatibleBroker95Profile(
                expected.id
            );

        assert.deepEqual(profile, {
            providerId: expected.id,
            credentialKind: "api-key",
            endpointKind: "remote",
            baseUrl: expected.baseUrl,
            connectionProbe:
                expected.connectionProbe
        });
        assert.equal(Object.isFrozen(profile), true);
    }
});

test("envía cada solicitud sólo a su origen fijo y aísla su API key", async () => {
    for (const provider of REMOTE_PROVIDERS) {
        const calls = [];
        const secret = `${provider.id}-secret`;
        const adapter = createAdapter({
            provider,
            secret,
            configuredBaseUrl:
                "https://untrusted.example/v1",
            fetch: async (url, init) => {
                calls.push({ url, init });

                return jsonResponse({
                    id: `${provider.id}-response`,
                    model: provider.model,
                    choices: [{
                        message: {
                            content:
                                "{\"title\":\"Contrato remoto\"}"
                        },
                        finish_reason: "stop"
                    }],
                    usage: {
                        prompt_tokens: 10,
                        completion_tokens: 5,
                        total_tokens: 15
                    }
                });
            }
        });

        const result = await adapter
            .generateContract(
                contractRequest(
                    `${provider.id}:fixed-origin`
                )
            );

        assert.equal(
            calls[0].url,
            `${provider.baseUrl}/chat/completions`
        );
        assert.equal(
            calls[0].init.headers.Authorization,
            `Bearer ${secret}`
        );
        assert.equal(
            calls[0].init.redirect,
            "error"
        );
        const body = JSON.parse(calls[0].init.body);
        assert.equal(body.model, provider.model);
        assert.deepEqual(body.response_format, { type: "json_object" });
        assert.deepEqual(body.provider, provider.id === "openrouter"
            ? { require_parameters: true }
            : undefined);
        assert.deepEqual(result.output, {
            title: "Contrato remoto"
        });
        assert.equal(result.providerId, provider.id);
        assert.equal(
            JSON.stringify(result).includes(secret),
            false
        );
    }
});

test("xAI valida sus identificadores y alias mediante el catálogo de lenguaje", async () => {
    for (const provider of REMOTE_PROVIDERS
        .filter(item =>
            item.connectionProbe ===
                OpenAICompatibleConnectionProbe.MODELS &&
            item.id === BrokerLLMProviderId.XAI
        )) {
        const calls = [];
        const adapter = createAdapter({
            provider,
            fetch: async (url, init) => {
                calls.push({ url, init });

                return jsonResponse({
                    models: [{
                        id: "grok-4.6-versioned",
                        aliases: [provider.model]
                    }]
                });
            }
        });

        const result = await adapter.testConnection({
            requestId:
                `${provider.id}:connection-test`,
            model: "ignored"
        });

        assert.equal(
            calls[0].url,
            `${provider.baseUrl}/language-models`
        );
        assert.equal(calls[0].init.method, "GET");
        assert.deepEqual(result.output, {
            connected: true,
            message: "Modelo disponible."
        });
    }
});

test("Z.AI comprueba credencial y modelo con una inferencia mínima compatible", async () => {
    const provider = REMOTE_PROVIDERS[2];
    const calls = [];
    const adapter = createAdapter({
        provider,
        fetch: async (url, init) => {
            calls.push({ url, init });

            return jsonResponse({
                id: "zai-probe-response",
                request_id: "zai-probe-request",
                model: provider.model,
                choices: [{
                    message: { content: "OK" },
                    finish_reason: "stop"
                }],
                usage: {
                    prompt_tokens: 6,
                    completion_tokens: 1,
                    total_tokens: 7
                }
            });
        }
    });

    const result = await adapter.testConnection({
        requestId: "zai:connection-test",
        model: "ignored"
    });
    const body = JSON.parse(calls[0].init.body);

    assert.equal(
        calls[0].url,
        `${provider.baseUrl}/chat/completions`
    );
    assert.equal(calls[0].init.method, "POST");
    assert.deepEqual(
        body,
        createOpenAICompatibleConnectionProbePayload(
            provider.model
        )
    );
    assert.equal(
        Object.hasOwn(body, "response_format"),
        false
    );
    assert.deepEqual(result.output, {
        connected: true,
        message: "Modelo disponible."
    });
    assert.deepEqual(result.usage, {
        inputTokens: 6,
        outputTokens: 1,
        totalTokens: 7
    });
    assert.equal(
        result.responseId,
        "zai-probe-request"
    );
});

test("clasifica autenticación, límites y modelo según cada API remota", async () => {
    for (const provider of REMOTE_PROVIDERS) {
        for (const [status, defaultFailureKind] of [
            [401, "authentication"],
            [403, "authentication"],
            [402, "quota"],
            [429, "quota"],
            [404, "model-unavailable"]
        ]) {
            const secret = `${provider.id}-private`;
            const adapter = createAdapter({
                provider,
                secret,
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
                        `${provider.id}:error:${status}`
                    )
                ),
                error =>
                    error.providerId ===
                        provider.id &&
                    error.failureKind ===
                        (status === 403 && [
                            BrokerLLMProviderId.TOGETHER,
                            BrokerLLMProviderId.OPENROUTER
                        ].includes(provider.id)
                            ? "provider"
                            : defaultFailureKind) &&
                    error.httpStatus === status &&
                    !JSON.stringify(error)
                        .includes(secret)
            );
        }
    }
});

test("los routers comprueban la credencial y conservan los sufijos del modelo", async () => {
    for (const provider of REMOTE_PROVIDERS.slice(3)) {
        for (const status of [200, 401, 402]) {
            const calls = [];
            const adapter = createAdapter({
                provider,
                fetch: async (url, init) => {
                    calls.push({ url, init });
                    return {
                        ...jsonResponse({
                            choices: [{ message: { content: "OK" }, finish_reason: "stop" }]
                        }),
                        ok: status === 200,
                        status
                    };
                }
            });
            const result = adapter.testConnection({ requestId: `${provider.id}:${status}`, model: "ignored" });
            if (status === 200) {
                assert.equal((await result).output.connected, true);
            } else {
                await assert.rejects(result, error => error.failureKind ===
                    (status === 401 ? "authentication" : "quota"));
            }
            assert.equal(calls.length, 1);
            assert.equal(calls[0].url, `${provider.baseUrl}/chat/completions`);
            assert.equal(calls[0].init.method, "POST");
            assert.equal(calls[0].init.headers.Authorization, `Bearer ${provider.id}-secret`);
            const body = JSON.parse(calls[0].init.body);
            assert.equal(body.model, provider.model);
            assert.ok(body.max_tokens >= 16 && body.max_tokens <= 64);
            assert.equal(body.response_format, undefined);
            assert.equal(body.stream, false);
        }
    }
});

test("OpenRouter puede comprobar destinos que exigen al menos 16 tokens", async () => {
    const provider = REMOTE_PROVIDERS.find(item => item.id === "openrouter");
    let requests = 0;
    const adapter = createAdapter({
        provider,
        fetch: async (_url, init) => {
            requests += 1;
            const body = JSON.parse(init.body);
            // Restricción del destino, documentada por OpenRouter. Con ocho
            // tokens falla incluso con una credencial y un modelo correctos.
            if (body.max_tokens < 16) {
                return { ...jsonResponse({ error: { message: "max_tokens must be at least 16" } }), ok: false, status: 400 };
            }
            assert.equal(body.stream, false);
            assert.equal(body.response_format, undefined);
            return jsonResponse({ choices: [{ message: { content: "OK" }, finish_reason: "stop" }] });
        }
    });
    const result = await adapter.testConnection({ requestId: "openrouter:minimum-tokens", model: "ignored" });
    assert.equal(result.output.connected, true);
    assert.equal(requests, 1);
});

test("Together comprueba que el modelo realmente admite Chat Completions", async () => {
    const provider = REMOTE_PROVIDERS.find(item => item.id === "together");
    const calls = [];
    const adapter = createAdapter({
        provider,
        fetch: async (url, init) => {
            calls.push({ url, init });
            return jsonResponse({
                model: provider.model,
                choices: [{
                    message: {
                        role: "assistant",
                        content: "OK"
                    },
                    finish_reason: "stop"
                }]
            });
        }
    });

    const result = await adapter.testConnection({
        requestId: "together:chat-probe",
        model: "ignored"
    });

    assert.equal(result.output.connected, true);
    assert.equal(
        calls[0].url,
        `${provider.baseUrl}/chat/completions`
    );
    assert.equal(
        JSON.parse(calls[0].init.body).model,
        provider.model
    );
});

test("OpenRouter no presenta contenido parcial acompañado de un error como éxito", async () => {
    const provider = REMOTE_PROVIDERS.find(
        item => item.id === BrokerLLMProviderId.OPENROUTER
    );
    const adapter = createAdapter({
        provider,
        fetch: async () => jsonResponse({
            choices: [{
                message: {
                    content: "respuesta parcial"
                },
                error: {
                    code: 502,
                    message: "detalle privado"
                },
                finish_reason: "error"
            }]
        })
    });

    await assert.rejects(
        adapter.askSubmission({
            requestId: "openrouter:partial-error",
            model: "ignored",
            input: { question: "Hola" },
            stream: false
        }),
        error =>
            error.failureKind === "http" &&
            error.httpStatus === 502 &&
            !JSON.stringify(error)
                .includes("detalle privado")
    );
});

test("Z.AI respeta sus códigos de negocio y terminaciones anormales", async () => {
    const provider = REMOTE_PROVIDERS.find(
        item => item.id === BrokerLLMProviderId.ZAI
    );
    const unknownModel = createAdapter({
        provider,
        fetch: async () => ({
            ...jsonResponse({
                error: {
                    code: 1211,
                    message: "detalle privado"
                }
            }),
            ok: false,
            status: 400
        })
    });

    await assert.rejects(
        unknownModel.testConnection({
            requestId: "zai:unknown-model",
            model: "ignored"
        }),
        error =>
            error.failureKind === "model-unavailable" &&
            error.httpStatus === 400 &&
            !JSON.stringify(error)
                .includes("detalle privado")
    );

    for (const finishReason of [
        "sensitive",
        "model_context_window_exceeded",
        "network_error"
    ]) {
        const adapter = createAdapter({
            provider,
            fetch: async () => jsonResponse({
                choices: [{
                    message: {
                        content: "respuesta parcial"
                    },
                    finish_reason: finishReason
                }]
            })
        });

        await assert.rejects(
            adapter.askSubmission({
                requestId: `zai:finish:${finishReason}`,
                model: "ignored",
                input: { question: "Hola" },
                stream: false
            }),
            error => error.failureKind ===
                (finishReason === "network_error"
                    ? "network"
                    : "provider")
        );
    }
});

test("una sonda truncada durante el razonamiento confirma acceso sin exponerlo", async () => {
    for (const provider of REMOTE_PROVIDERS.slice(3)) {
        const adapter = createAdapter({
            provider,
            fetch: async () => jsonResponse({
                choices: [{
                    message: { role: "assistant", content: null, reasoning: "razonamiento privado" },
                    finish_reason: "length"
                }],
                usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 }
            })
        });
        const result = await adapter.testConnection({ requestId: `${provider.id}:reasoning-probe`, model: "ignored" });
        assert.equal(result.output.connected, true);
        assert.equal(JSON.stringify(result).includes("razonamiento privado"), false);

        for (const payload of [{}, { choices: [{ message: { role: "assistant", content: "" }, finish_reason: "stop" }] }]) {
            const invalid = createAdapter({ provider, fetch: async () => jsonResponse(payload) });
            await assert.rejects(
                invalid.testConnection({ requestId: `${provider.id}:empty-probe`, model: "ignored" }),
                error => error.failureKind === "invalid-response"
            );
        }
    }
});

test("Hugging Face y OpenRouter entregan streaming de texto y JSON con uso final", async () => {
    for (const provider of REMOTE_PROVIDERS.slice(3)) {
        for (const operation of ["askSubmission", "reviewSubmission"]) {
            const textMode = operation === "askSubmission";
            const text = textMode ? "Hola desde CIPHER" : '{"title":"Contrato"}';
            const deltas = [];
            let body;
            const adapter = createAdapter({
                provider,
                fetch: async (url, init) => {
                    assert.equal(url, `${provider.baseUrl}/chat/completions`);
                    body = JSON.parse(init.body);
                    return streamResponse([
                        ": OPENROUTER PROCESSING\n\n",
                        `data: ${JSON.stringify({ id: "stream-router", choices: [{ delta: { content: text, reasoning_content: "privado" }, finish_reason: null }] })}\n\n`,
                        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
                        'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":7,"total_tokens":17}}\n\n',
                        "data: [DONE]\n\n"
                    ]);
                }
            });
            const request = {
                requestId: `${provider.id}:${operation}:stream`,
                model: "ignored",
                input: textMode ? { question: "Hola" } : { source: "PRINCIPAL()" },
                stream: true
            };
            const result = await adapter[operation](request, { onDelta: delta => deltas.push(delta.text) });
            assert.equal(body.model, provider.model);
            assert.deepEqual(body.stream_options, { include_usage: true });
            assert.deepEqual(body.response_format, textMode ? undefined : { type: "json_object" });
            assert.deepEqual(body.provider, !textMode && provider.id === "openrouter"
                ? { require_parameters: true } : undefined);
            assert.equal(deltas.join(""), text);
            assert.equal(JSON.stringify(result).includes("privado"), false);
            assert.deepEqual(result.usage, { inputTokens: 10, outputTokens: 7, totalTokens: 17 });
            assert.equal(result.providerId, provider.id);
            assert.equal(result.responseId, "stream-router");
            assert.deepEqual(result.output, textMode ? text : { title: "Contrato" });
        }
    }
});

test("los errores dentro de un stream del router no se presentan como respuesta completa", async () => {
    for (const provider of REMOTE_PROVIDERS.slice(3)) {
        const adapter = createAdapter({
            provider,
            fetch: async () => streamResponse([
                ': keepalive\n\n',
                'data: {"error":{"code":502,"message":"private-provider-error"}}\n\n',
                'data: [DONE]\n\n'
            ])
        });
        await assert.rejects(
            adapter.reviewSubmission({
                requestId: `${provider.id}:stream-error`,
                model: "ignored",
                input: { source: "PRINCIPAL()" }
            }),
            error => error.failureKind === "stream-failed" &&
                !JSON.stringify(error).includes("private-provider-error")
        );
    }
});

test("acota respuestas remotas y traduce red, timeout y cancelación", async () => {
    const provider = REMOTE_PROVIDERS[0];
    const oversized = createAdapter({
        provider,
        fetch: async () => ({
            ...jsonResponse({}),
            async text() {
                return "x".repeat(
                    MAX_OPENAI_COMPATIBLE_JSON_CHARACTERS +
                        1
                );
            }
        })
    });

    await assert.rejects(
        () => oversized.generateContract(
            contractRequest("xai:oversized")
        ),
        error => error.failureKind ===
            "invalid-response"
    );

    const offline = createAdapter({
        provider,
        fetch: async () => {
            throw new Error("ECONNRESET private");
        }
    });

    await assert.rejects(
        () => offline.generateContract(
            contractRequest("xai:offline")
        ),
        error => error.failureKind === "network"
    );

    const timeout = createAdapter({
        provider,
        timeoutMs: 5,
        fetch: async (...args) => {
            const signal = args[1].signal;

            return new Promise((resolve, reject) => {
                void resolve;
                signal.addEventListener(
                    "abort",
                    () => reject(new Error("aborted")),
                    { once: true }
                );
            });
        }
    });

    await assert.rejects(
        () => timeout.generateContract(
            contractRequest("xai:timeout")
        ),
        error => error.failureKind === "timeout"
    );

    const controller = new AbortController();
    controller.abort();
    const cancelled = createAdapter({
        provider,
        fetch: async (...args) => {
            assert.equal(args[1].signal.aborted, true);
            throw new Error("cancelled");
        }
    });

    await assert.rejects(
        () => cancelled.generateContract(
            contractRequest("xai:cancelled"),
            { signal: controller.signal }
        ),
        error => error.code ===
            "BROKER95_LLM_REQUEST_ABORTED"
    );
});

function createAdapter({
    provider,
    fetch,
    secret = `${provider.id}-secret`,
    configuredBaseUrl = null,
    timeoutMs = 5_000
}) {
    return new OpenAICompatibleBroker95LLMAdapter({
        providerId: provider.id,
        configurationService: {
            async resolvePrivateLlmSettings(
                providerId
            ) {
                assert.equal(providerId, provider.id);

                return {
                    providerId,
                    model: provider.model,
                    credential: {
                        providerId,
                        kind: "api-key",
                        value: secret
                    },
                    ...(configuredBaseUrl == null
                        ? {}
                        : {
                            baseUrl:
                                configuredBaseUrl
                        })
                };
            }
        },
        fetch,
        timeoutMs,
        developerLogger: { error() {} }
    });
}

function contractRequest(requestId) {
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
        ...jsonResponse({}),
        body: new ReadableStream({
            start(controller) {
                for (const chunk of chunks) {
                    controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
            }
        })
    };
}
