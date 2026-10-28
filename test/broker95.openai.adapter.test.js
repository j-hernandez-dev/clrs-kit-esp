import assert from "node:assert/strict";
import test from "node:test";

import {
    OPENAI_MODELS_URL,
    OPENAI_RESPONSES_URL,
    OpenAIBroker95LLMAdapter,
    OpenAIBroker95LLMAdapterError,
    createOpenAIResponsePayload
} from "../extension/adapters/OpenAIBroker95LLMAdapter.js";
import {
    BrokerRisk,
    createBrokerLLMRequest,
    createBrokerContractGenerationRequest
} from "../src/broker95/index.js";

test("OpenAI permite texto natural para ai -ask", () => {
    const payload = createOpenAIResponsePayload(
        askRequest("openai-model"),
        "openai-model"
    );

    assert.deepEqual(payload.text.format, {
        type: "text"
    });
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
    "OpenAI usa Responses, Structured Outputs y transporte normalizado",
    async () => {
        const calls = [];
        const adapter = createAdapter({
            fetch: async (url, init) => {
                calls.push({ url, init });
                return createJsonResponse({
                    id: "resp_openai_1",
                    model: "gpt-5.6-luna",
                    status: "completed",
                    output: [{
                        type: "message",
                        content: [{
                            type: "output_text",
                            text: "{\"title\":\"Señal\"}"
                        }]
                    }],
                    usage: {
                        input_tokens: 15,
                        output_tokens: 7,
                        total_tokens: 22
                    }
                });
            }
        });
        const result = await adapter.generateContract(
            contractRequest()
        );
        const body = JSON.parse(calls[0].init.body);

        assert.equal(calls[0].url, OPENAI_RESPONSES_URL);
        assert.equal(
            calls[0].init.headers.Authorization,
            "Bearer openai-secret"
        );
        assert.equal(body.model, "gpt-5.6-luna");
        assert.equal(body.store, false);
        assert.equal(body.stream, false);
        assert.equal(body.text.format.type, "json_schema");
        assert.equal(body.text.format.strict, true);
        assert.equal(
            body.text.format.name,
            "broker95_contract_draft"
        );
        assert.match(body.instructions, /CIPHER/u);
        assert.deepEqual(result.output, { title: "Señal" });
        assert.equal(result.providerId, "openai");
        assert.equal(result.model, "gpt-5.6-luna");
        assert.equal(result.responseId, "resp_openai_1");
        assert.deepEqual(result.usage, {
            inputTokens: 15,
            outputTokens: 7,
            totalTokens: 22
        });
        assert.equal(
            JSON.stringify(result).includes("openai-secret"),
            false
        );
    }
);

test(
    "OpenAI consume deltas tipados de Responses SSE",
    async () => {
        const deltas = [];
        const adapter = createAdapter({
            fetch: async () => createStreamResponse([
                "event: response.output_text.delta\ndata: {\"type\":\"response.output_text.delta\",\"delta\":\"{\\\"summary\\\":\\\"ok\\\"\"}\n\n",
                "event: response.output_text.delta\ndata: {\"type\":\"response.output_text.delta\",\"delta\":\"}\"}\n\n",
                "event: response.completed\ndata: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_stream_1\",\"model\":\"gpt-5.6-luna\",\"status\":\"completed\",\"usage\":{\"input_tokens\":9,\"output_tokens\":4,\"total_tokens\":13}}}\n\n"
            ])
        });

        const result = await adapter.reviewSubmission({
            requestId: "openai:review:1",
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
        assert.equal(result.responseId, "resp_stream_1");
        assert.deepEqual(result.usage, {
            inputTokens: 9,
            outputTokens: 4,
            totalTokens: 13
        });
    }
);

test(
    "OpenAI comprueba el modelo configurado sin generar una respuesta",
    async () => {
        const calls = [];
        const adapter = createAdapter({
            fetch: async (url, init) => {
                calls.push({ url, init });
                return createJsonResponse({
                    id: "gpt-5.6-luna",
                    object: "model",
                    owned_by: "openai"
                });
            }
        });
        const result = await adapter.testConnection({
            requestId: "openai:test:1",
            model: "ignored"
        });

        assert.equal(
            calls[0].url,
            `${OPENAI_MODELS_URL}/gpt-5.6-luna`
        );
        assert.equal(calls[0].init.method, "GET");
        assert.deepEqual(result.output, {
            connected: true,
            message: "Modelo disponible."
        });
    }
);

test(
    "OpenAI clasifica credencial, cuota y modelo sin filtrar secretos",
    async () => {
        for (const [status, code, kind] of [
            [401, "BROKER95_OPENAI_AUTHENTICATION_FAILED", "authentication"],
            [429, "BROKER95_OPENAI_QUOTA_EXHAUSTED", "quota"],
            [404, "BROKER95_OPENAI_MODEL_UNAVAILABLE", "model-unavailable"]
        ]) {
            const adapter = createAdapter({
                fetch: async () => createErrorResponse(status)
            });

            await assert.rejects(
                () => adapter.generateContract(contractRequest(
                    `openai:error:${status}`
                )),
                error =>
                    error instanceof OpenAIBroker95LLMAdapterError &&
                    error.code === code &&
                    error.failureKind === kind &&
                    !JSON.stringify(error).includes("openai-secret")
            );
        }
    }
);

test(
    "OpenAI rechaza streams sin evento terminal",
    async () => {
        const adapter = createAdapter({
            fetch: async () => createStreamResponse([
                "data: {\"type\":\"response.output_text.delta\",\"delta\":\"{}\"}\n\n"
            ])
        });

        await assert.rejects(
            () => adapter.reviewSubmission({
                requestId: "openai:stream:invalid",
                model: "ignored",
                input: {},
                context: {}
            }),
            error =>
                error instanceof OpenAIBroker95LLMAdapterError &&
                error.code === "BROKER95_OPENAI_STREAM_INVALID" &&
                error.failureKind === "invalid-stream"
        );
    }
);

function createAdapter({ fetch }) {
    return new OpenAIBroker95LLMAdapter({
        configurationService: {
            async resolvePrivateLlmSettings(providerId) {
                assert.equal(providerId, "openai");
                return {
                    providerId: "openai",
                    model: "gpt-5.6-luna",
                    credential: {
                        providerId: "openai",
                        kind: "api-key",
                        value: "openai-secret"
                    }
                };
            }
        },
        fetch,
        developerLogger: { error() {} },
        timeoutMs: 5_000
    });
}

function contractRequest(requestId = "openai:contract:1") {
    return createBrokerContractGenerationRequest({
        requestId,
        model: "ignored",
        risk: BrokerRisk.LOW,
        category: brokerCategoryCatalog.requireCategory(
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
                    controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
            }
        })
    };
}
