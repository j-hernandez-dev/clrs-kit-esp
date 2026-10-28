import assert from "node:assert/strict";
import test from "node:test";

import {
    BrokerNdjsonReader,
    BrokerNdjsonReaderError
} from "../extension/adapters/BrokerNdjsonReader.js";
import {
    OLLAMA_LOCAL_API_BASE_URL,
    OllamaBroker95LLMAdapter,
    OllamaBroker95LLMAdapterError,
    createOllamaChatPayload
} from "../extension/adapters/OllamaBroker95LLMAdapter.js";
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

test("Ollama permite texto natural para ai -ask sin forzar JSON", () => {
    const payload = createOllamaChatPayload(
        askRequest("qwen-local"),
        "qwen-local"
    );

    assert.equal(Object.hasOwn(payload, "format"), false);
});

test(
    "Ollama usa sólo el servidor local, no pide API key y normaliza una respuesta chat",
    async () => {
        const calls = [];
        const adapter = createAdapter({
            fetch: async (url, init) => {
                calls.push({ url, init });
                return createJsonResponse({
                    model: "qwen2.5-coder:7b",
                    created_at: "2026-08-09T11:45:00Z",
                    message: { content: "{\"title\":\"Señal local\"}" },
                    done: true,
                    done_reason: "stop",
                    prompt_eval_count: 15,
                    eval_count: 9
                });
            }
        });

        const result = await adapter.generateContract({
            requestId: "ollama:contract:1",
            model: "no-autorizado",
            input: { categoryId: "sorting" },
            context: { risk: "low" }
        });
        const body = JSON.parse(calls[0].init.body);

        assert.equal(calls[0].url, `${OLLAMA_LOCAL_API_BASE_URL}/chat`);
        assert.deepEqual(calls[0].init.headers, {
            "Content-Type": "application/json"
        });
        assert.equal(
            calls[0].init.redirect,
            "error"
        );
        assert.equal(body.model, "qwen2.5-coder:7b");
        assert.equal(body.stream, false);
        assert.equal(body.format, "json");
        assert.equal(body.messages[0].role, "system");
        assert.equal(body.messages.at(-1).role, "user");
        assert.deepEqual(result.output, { title: "Señal local" });
        assert.equal(result.providerId, "ollama");
        assert.deepEqual(result.usage, {
            inputTokens: 15,
            outputTokens: 9,
            totalTokens: 24
        });
        assert.equal(JSON.stringify(result).includes("api-key"), false);
    }
);

test(
    "Ollama usa el endpoint local persistido sin permitir redirecciones",
    async () => {
        const calls = [];
        const adapter = createAdapter({
            settingsBaseUrl:
                "http://localhost:22434/api",
            fetch: async (url, init) => {
                calls.push({ url, init });
                return createJsonResponse({
                    models: [{
                        name: "qwen2.5-coder:7b"
                    }]
                });
            }
        });

        await adapter.testConnection({
            requestId: "ollama:test:custom-url",
            model: "ignored"
        });

        assert.equal(
            calls[0].url,
            "http://localhost:22434/api/tags"
        );
        assert.equal(
            calls[0].init.redirect,
            "error"
        );
    }
);

test(
    "Ollama consume NDJSON, publica deltas ordenados y exige un cierre done",
    async () => {
        const deltas = [];
        const adapter = createAdapter({
            fetch: async () => createNdjsonResponse([
                "{\"model\":\"qwen2.5-coder:7b\",\"message\":{\"content\":\"{\\\"summary\\\":\\\"local\\\"\"},\"done\":false}\n",
                "{\"model\":\"qwen2.5-coder:7b\",\"message\":{\"content\":\"}\"},\"done\":true,\"done_reason\":\"stop\",\"prompt_eval_count\":10,\"eval_count\":5}\n"
            ])
        });

        const result = await adapter.reviewSubmission({
            requestId: "ollama:review:1",
            model: "ignored",
            input: { source: "PRINCIPAL()" },
            context: {}
        }, {
            onDelta(delta) {
                deltas.push(delta.text);
            }
        });

        assert.deepEqual(deltas, ["{\"summary\":\"local\"", "}"]);
        assert.deepEqual(result.output, { summary: "local" });
        assert.equal(result.finishReason, "stop");
        assert.deepEqual(result.usage, {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15
        });
    }
);

test(
    "Ollama comprueba que el modelo local esté instalado mediante tags",
    async () => {
        const calls = [];
        const adapter = createAdapter({
            fetch: async (url, init) => {
                calls.push({ url, init });
                return createJsonResponse({
                    models: [{ name: "qwen2.5-coder:7b" }]
                });
            }
        });
        const result = await adapter.testConnection({
            requestId: "ollama:test:1",
            model: "ignored"
        });

        assert.equal(calls[0].url, `${OLLAMA_LOCAL_API_BASE_URL}/tags`);
        assert.equal(calls[0].init.method, "GET");
        assert.deepEqual(result.output, {
            connected: true,
            message: "Modelo local disponible."
        });
    }
);

test(
    "Ollama informa modelo ausente y rechaza endpoints no locales",
    async () => {
        const adapter = createAdapter({
            fetch: async () => createJsonResponse({ models: [] })
        });

        await assert.rejects(
            () => adapter.testConnection({
                requestId: "ollama:test:missing",
                model: "ignored"
            }),
            error => error instanceof OllamaBroker95LLMAdapterError &&
                error.code === "BROKER95_OLLAMA_MODEL_UNAVAILABLE" &&
                error.failureKind === "model-unavailable"
        );
        assert.throws(
            () => new OllamaBroker95LLMAdapter({
                configurationService: { async resolvePrivateLlmSettings() {} },
                apiBaseUrl: "https://example.com/api"
            }),
            error => error.code === "BROKER95_LLM_REQUEST_INVALID"
        );
    }
);

test(
    "el lector NDJSON conserva líneas fragmentadas y rechaza una línea excesiva",
    async () => {
        const reader = new BrokerNdjsonReader();
        const lines = [];

        for await (const line of reader.read(createBody([
            "{\"a\":",
            "1}\n{\"b\":2}\n"
        ]))) {
            lines.push(line);
        }

        assert.deepEqual(lines, ["{\"a\":1}", "{\"b\":2}"]);
        const bounded = new BrokerNdjsonReader({
            maximumLineCharacters: 3
        });

        await assert.rejects(
            async () => {
                for await (const line of bounded.read(createBody([
                    "{\"a\":1}\n"
                ]))) {
                    void line;
                    assert.fail("No debía entregar una línea inválida.");
                }
            },
            error => error instanceof BrokerNdjsonReaderError &&
                error.code === "BROKER95_NDJSON_LINE_INVALID"
        );
    }
);

test(
    "la forma Ollama preserva el contrato lógico y no admite modelos vacíos",
    () => {
        const payload = createOllamaChatPayload({
            operation: "generateContract",
            responseSchema: "broker95.contract-draft/1",
            input: { categoryId: "sorting" },
            context: {},
            conversation: [],
            stream: false
        }, "qwen2.5-coder:7b");

        assert.equal(payload.format, "json");
        assert.throws(
            () => createOllamaChatPayload({
                operation: "generateContract",
                responseSchema: "broker95.contract-draft/1",
                input: {},
                context: {},
                conversation: [],
                stream: false
            }, " "),
            error => error.code === "BROKER95_LLM_REQUEST_INVALID"
        );
    }
);

function createAdapter({
    fetch,
    settingsBaseUrl = null
}) {
    return new OllamaBroker95LLMAdapter({
        configurationService: {
            async resolvePrivateLlmSettings(providerId) {
                assert.equal(providerId, "ollama");
                return {
                    providerId: "ollama",
                    model: "qwen2.5-coder:7b",
                    ...(settingsBaseUrl == null
                        ? {}
                        : {
                            baseUrl:
                                settingsBaseUrl
                        }),
                    credential: {
                        providerId: "ollama",
                        kind: "none"
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

function createNdjsonResponse(chunks) {
    return {
        ok: true,
        status: 200,
        headers: { get() { return null; } },
        body: createBody(chunks)
    };
}

function createBody(chunks) {
    const encoder = new TextEncoder();
    return new ReadableStream({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        }
    });
}
