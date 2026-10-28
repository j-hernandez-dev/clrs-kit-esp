import assert from "node:assert/strict";
import test from "node:test";

import {
    GEMINI_API_BASE_URL,
    GeminiBroker95LLMAdapter,
    GeminiBroker95LLMAdapterError,
    createGeminiCompletionPayload,
    createGeminiGenerateUrl
} from "../extension/adapters/GeminiBroker95LLMAdapter.js";
import {
    createBrokerLLMRequest
} from "../src/broker95/llm/index.js";

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

test("Gemini permite texto natural para ai -ask", () => {
    const payload = createGeminiCompletionPayload(
        askRequest("gemini-model")
    );

    assert.equal(
        payload.generationConfig.responseMimeType,
        "text/plain"
    );
});

test(
    "Gemini usa configuración privada, generateContent y el transporte normalizado",
    async () => {
        const calls = [];
        const adapter = createAdapter({
            fetch: async (url, init) => {
                calls.push({ url, init });
                return createJsonResponse({
                    responseId: "gemini-response-1",
                    modelVersion: "gemini-2.5-flash",
                    candidates: [{
                        content: {
                            parts: [{ text: "{\"title\":\"Señal\"}" }]
                        },
                        finishReason: "STOP"
                    }],
                    usageMetadata: {
                        promptTokenCount: 13,
                        candidatesTokenCount: 8,
                        thoughtsTokenCount: 3,
                        totalTokenCount: 24
                    }
                });
            }
        });

        const result = await adapter.generateContract({
            requestId: "gemini:contract:1",
            model: "modelo-no-autorizado",
            input: { categoryId: "sorting" },
            context: { risk: "high" }
        });
        const body = JSON.parse(calls[0].init.body);

        assert.equal(
            calls[0].url,
            `${GEMINI_API_BASE_URL}/models/gemini-2.5-flash:generateContent`
        );
        assert.equal(
            calls[0].init.headers["x-goog-api-key"],
            "gemini-secret"
        );
        assert.equal(
            calls[0].init.headers.Authorization,
            undefined
        );
        assert.equal(
            body.generationConfig.responseMimeType,
            "application/json"
        );
        assert.equal(body.contents.at(-1).role, "user");
        assert.match(
            body.systemInstruction.parts[0].text,
            /CIPHER/u
        );
        assert.deepEqual(result.output, { title: "Señal" });
        assert.equal(result.providerId, "gemini");
        assert.equal(result.model, "gemini-2.5-flash");
        assert.equal(result.responseId, "gemini-response-1");
        assert.deepEqual(result.usage, {
            inputTokens: 13,
            outputTokens: 11,
            totalTokens: 24
        });
        assert.equal(
            JSON.stringify(result).includes("gemini-secret"),
            false
        );
    }
);

test(
    "Gemini transmite respuestas SSE conservando deltas y resultado final",
    async () => {
        const deltas = [];
        const adapter = createAdapter({
            fetch: async (url) => {
                assert.equal(
                    url,
                    `${GEMINI_API_BASE_URL}/models/gemini-2.5-flash:streamGenerateContent?alt=sse`
                );
                return createStreamResponse([
                    "data: {\"responseId\":\"gemini-stream-1\",\"modelVersion\":\"gemini-2.5-flash\",\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"{\\\"summary\\\":\\\"ok\\\"\"}]}}]}\n\n",
                    "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"}\"}]},\"finishReason\":\"STOP\"}],\"usageMetadata\":{\"promptTokenCount\":9,\"candidatesTokenCount\":4,\"totalTokenCount\":13}}\n\n"
                ]);
            }
        });

        const result = await adapter.reviewSubmission({
            requestId: "gemini:review:1",
            model: "ignored",
            input: { source: "PRINCIPAL()" },
            context: {}
        }, {
            onDelta(delta) {
                deltas.push(delta.text);
            }
        });

        assert.deepEqual(deltas, ["{\"summary\":\"ok\"", "}"]);
        assert.deepEqual(result.output, { summary: "ok" });
        assert.equal(result.finishReason, "stop");
        assert.equal(result.responseId, "gemini-stream-1");
        assert.deepEqual(result.usage, {
            inputTokens: 9,
            outputTokens: 4,
            totalTokens: 13
        });
    }
);

test(
    "Gemini comprueba el modelo configurado sin generar contenido",
    async () => {
        const calls = [];
        const adapter = createAdapter({
            fetch: async (url, init) => {
                calls.push({ url, init });
                return createJsonResponse({
                    name: "models/gemini-2.5-flash",
                    baseModelId: "gemini-2.5-flash",
                    supportedGenerationMethods: [
                        "generateContent",
                        "countTokens"
                    ]
                });
            }
        });
        const result = await adapter.testConnection({
            requestId: "gemini:test:1",
            model: "ignored"
        });

        assert.equal(
            calls[0].url,
            `${GEMINI_API_BASE_URL}/models/gemini-2.5-flash`
        );
        assert.equal(calls[0].init.method, "GET");
        assert.deepEqual(result.output, {
            connected: true,
            message: "Modelo disponible."
        });
    }
);

test(
    "Gemini no confirma como utilizable un modelo ajeno a generateContent",
    async () => {
        const adapter = createAdapter({
            fetch: async () => createJsonResponse({
                name: "models/gemini-embedding",
                baseModelId: "gemini-embedding",
                supportedGenerationMethods: [
                    "embedContent"
                ]
            })
        });

        await assert.rejects(
            adapter.testConnection({
                requestId: "gemini:test:unsupported",
                model: "ignored"
            }),
            error =>
                error.code ===
                    "BROKER95_GEMINI_MODEL_UNAVAILABLE" &&
                error.failureKind ===
                    "model-unavailable"
        );
    }
);

test(
    "Gemini clasifica credencial, cuota y modelo no disponibles sin filtrar la clave",
    async () => {
        for (const [status, code, kind] of [
            [401, "BROKER95_GEMINI_AUTHENTICATION_FAILED", "authentication"],
            [429, "BROKER95_GEMINI_QUOTA_EXHAUSTED", "quota"],
            [404, "BROKER95_GEMINI_MODEL_UNAVAILABLE", "model-unavailable"]
        ]) {
            const adapter = createAdapter({
                fetch: async () => createErrorResponse(status)
            });

            await assert.rejects(
                () => adapter.generateContract({
                    requestId: `gemini:error:${status}`,
                    model: "ignored",
                    input: {},
                    context: {}
                }),
                error => error instanceof GeminiBroker95LLMAdapterError &&
                    error.code === code &&
                    error.failureKind === kind &&
                    !JSON.stringify(error).includes("gemini-secret")
            );
        }
    }
);

test(
    "Gemini reconoce una API key inválida aunque Google responda HTTP 400",
    async () => {
        const adapter = createAdapter({
            fetch: async () => createErrorResponse(
                400,
                {
                    error: {
                        code: 400,
                        message: "gemini-secret",
                        details: [{
                            reason:
                                "API_KEY_INVALID"
                        }]
                    }
                }
            )
        });

        await assert.rejects(
            adapter.testConnection({
                requestId: "gemini:test:bad-key",
                model: "ignored"
            }),
            error =>
                error.code ===
                    "BROKER95_GEMINI_AUTHENTICATION_FAILED" &&
                error.failureKind ===
                    "authentication" &&
                !JSON.stringify(error)
                    .includes("gemini-secret")
        );
    }
);

test(
    "Gemini normaliza nombres de modelo y rechaza rutas inseguras",
    () => {
        assert.equal(
            createGeminiGenerateUrl(
                GEMINI_API_BASE_URL,
                "models/gemini-2.5-flash",
                true
            ),
            `${GEMINI_API_BASE_URL}/models/gemini-2.5-flash:streamGenerateContent?alt=sse`
        );
        assert.throws(
            () => createGeminiGenerateUrl(
                GEMINI_API_BASE_URL,
                "../../otro-modelo",
                false
            ),
            error => error.code === "BROKER95_LLM_REQUEST_INVALID"
        );
    }
);

function createAdapter({ fetch }) {
    return new GeminiBroker95LLMAdapter({
        configurationService: {
            async resolvePrivateLlmSettings(providerId) {
                assert.equal(providerId, "gemini");
                return {
                    providerId: "gemini",
                    model: "gemini-2.5-flash",
                    credential: {
                        providerId: "gemini",
                        kind: "api-key",
                        value: "gemini-secret"
                    }
                };
            }
        },
        fetch,
        developerLogger: { error() {} }
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

function createErrorResponse(status, payload = null) {
    return {
        ok: false,
        status,
        headers: { get() { return null; } },
        ...(payload == null
            ? {}
            : {
                async text() {
                    return JSON.stringify(payload);
                }
            })
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
                    controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
            }
        })
    };
}
