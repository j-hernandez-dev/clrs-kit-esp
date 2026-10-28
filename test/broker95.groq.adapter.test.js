import assert from "node:assert/strict";
import test from "node:test";

import {
    BrokerSSEReader,
    BrokerSSEReaderError
} from "../extension/adapters/BrokerSSEReader.js";
import {
    GROQ_CHAT_COMPLETIONS_URL,
    GROQ_STRICT_STRUCTURED_OUTPUT_MODELS,
    GroqBroker95LLMAdapter,
    GroqBroker95LLMAdapterError,
    createGroqConnectionProbePayload,
    createGroqCompletionPayload
} from "../extension/adapters/GroqBroker95LLMAdapter.js";
import {
    BrokerLLMProtocolError,
    createBrokerLLMRequest
} from "../src/broker95/llm/index.js";

test("Groq permite texto natural para ai -ask sin forzar JSON", () => {
    const payload = createGroqCompletionPayload(
        askRequest("groq-model"),
        "groq-model"
    );

    assert.equal(
        Object.hasOwn(payload, "response_format"),
        false
    );
});
import {
    BrokerLlmAvailabilityError,
    createBrokerLlmAvailability
} from "../src/broker95/llm/BrokerLlmAvailability.js";
import {
    BrokerRisk,
    createBrokerContractGenerationRequest
} from "../src/broker95/index.js";
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
    "el lector SSE conserva eventos multilinea entre fragmentos arbitrarios",
    async () => {
        const reader = new BrokerSSEReader();
        const events = [];

        for await (const event of reader.read(
            createSseBody([
                ": keep-alive\n",
                "event: completion\nid: evt-1\ndata: primera\n",
                "data: segunda\n\n",
                "data: [DONE]\n\n"
            ])
        )) {
            events.push(event);
        }

        assert.deepEqual(events, [{
            event: "completion",
            id: "evt-1",
            data: "primera\nsegunda"
        }, {
            event: "message",
            id: null,
            data: "[DONE]"
        }]);
    }
);

test(
    "el lector SSE rechaza cuerpos no legibles y eventos excesivos",
    async () => {
        const reader = new BrokerSSEReader({
            maximumEventCharacters: 4
        });

        await assert.rejects(
            async () => {
                for await (const event of reader.read(
                    createSseBody([
                        "data: demasiado\n\n"
                    ])
                )) {
                    assert.fail(
                        `Evento inesperado: ${event.data}`
                    );
                }
            },
            errorCode(
                BrokerSSEReaderError,
                "BROKER95_SSE_EVENT_TOO_LARGE"
            )
        );
        await assert.rejects(
            async () => {
                for await (const event of reader.read(
                    {}
                )) {
                    assert.fail(
                        `Evento inesperado: ${event.data}`
                    );
                }
            },
            errorCode(
                BrokerSSEReaderError,
                "BROKER95_SSE_BODY_INVALID"
            )
        );
    }
);

test(
    "Groq usa la configuracion privada, JSON estructurado y no filtra secretos",
    async () => {
        const calls = [];
        const resolvedProviderIds = [];
        const logger = createLogger();
        const adapter = createAdapter({
            logger,
            resolvedProviderIds,
            fetch: async (url, init) => {
                calls.push({ url, init });

                return createJsonResponse({
                    id: "chatcmpl-1",
                    model: "modelo-configurado",
                    choices: [{
                        message: {
                            content:
                                '{"title":"Señal"}'
                        },
                        finish_reason: "stop"
                    }],
                    usage: {
                        prompt_tokens: 12,
                        completion_tokens: 7,
                        total_tokens: 19
                    }
                });
            }
        });
        const result = await adapter.generateContract({
            requestId: "contract:1",
            model: "modelo-no-autorizado",
            input: { categoryId: "sorting" },
            context: { risk: "high" }
        });
        const body = JSON.parse(calls[0].init.body);

        assert.equal(calls[0].url, GROQ_CHAT_COMPLETIONS_URL);
        assert.deepEqual(
            resolvedProviderIds,
            ["groq"]
        );
        assert.equal(body.model, "modelo-configurado");
        assert.deepEqual(body.response_format, {
            type: "json_object"
        });
        assert.equal(body.stream, false);
        assert.equal(
            calls[0].init.headers.Authorization,
            "Bearer broker95-secret"
        );
        assert.deepEqual(result.output, {
            title: "Señal"
        });
        assert.equal(result.providerId, "groq");
        assert.deepEqual(result.usage, {
            inputTokens: 12,
            outputTokens: 7,
            totalTokens: 19
        });
        assert.equal(
            JSON.stringify(result)
                .includes("broker95-secret"),
            false
        );
        assert.equal(logger.entries.length, 0);
    }
);

test(
    "Groq exige el esquema exacto del contrato en GPT OSS compatible",
    async () => {
        const calls = [];
        const model = "openai/gpt-oss-120b";
        const adapter = createAdapter({
            model,
            fetch: async (_url, init) => {
                calls.push(init);

                return createJsonResponse({
                    id: "chatcmpl-structured",
                    model,
                    choices: [{
                        message: {
                            content: JSON.stringify(
                                anonymousContractDraft()
                            )
                        },
                        finish_reason: "stop"
                    }]
                });
            }
        });
        const request = contractGenerationRequest({
            model,
            risk: BrokerRisk.HIGH
        });

        await adapter.generateContract(request);

        const body = JSON.parse(calls[0].body);
        const responseFormat = body.response_format;
        const schema = responseFormat.json_schema.schema;
        const system = body.messages[0].content;

        assert.equal(
            GROQ_STRICT_STRUCTURED_OUTPUT_MODELS
                .includes(model),
            true
        );
        assert.equal(responseFormat.type, "json_schema");
        assert.equal(responseFormat.json_schema.strict, true);
        assert.equal(
            responseFormat.json_schema.name,
            "broker95_contract_draft"
        );
        assert.equal(schema.additionalProperties, false);
        assert.equal(
            Object.hasOwn(schema.properties, "client"),
            false
        );
        assert.equal(
            JSON.stringify(schema).includes("maxLength"),
            false
        );
        assert.equal(body.stream, false);
        assert.equal(body.temperature, 0.2);
        assert.match(
            system,
            /Return exactly these top-level properties/u
        );
        assert.match(system, /omit the client property/u);
        assert.match(system, /REQ-1 through REQ-8/u);
        assert.match(system, /Valid shape example/u);
    }
);

test(
    "Groq guia y repara contratos aun cuando el modelo solo admite JSON",
    async () => {
        const calls = [];
        const model = "tiny/model-0.5b";
        const adapter = createAdapter({
            model,
            fetch: async (_url, init) => {
                calls.push(init);

                return createJsonResponse({
                    id: "chatcmpl-small",
                    model,
                    choices: [{
                        message: {
                            content: JSON.stringify(
                                namedContractDraft()
                            )
                        },
                        finish_reason: "stop"
                    }]
                });
            }
        });
        const original = contractGenerationRequest({
            model,
            risk: BrokerRisk.LOW
        });
        const request = createBrokerContractGenerationRequest({
            requestId: "contract:groq:repair",
            model,
            risk: BrokerRisk.LOW,
            category: brokerCategoryCatalog.requireCategory(
                "NUM-ARITH"
            ),
            repair: {
                attempt: 2,
                validationCode:
                    "BROKER95_CONTRACT_DRAFT_FIELDS_INVALID",
                previousDraft: {
                    ...namedContractDraft(),
                    payPotential: 500
                }
            }
        });

        await adapter.generateContract(request);

        const body = JSON.parse(calls[0].body);
        const system = body.messages[0].content;
        const operation = JSON.parse(
            body.messages.at(-1).content
        );

        assert.equal(original.input.repair, undefined);
        assert.deepEqual(body.response_format, {
            type: "json_object"
        });
        assert.match(system, /only repair attempt/u);
        assert.match(
            system,
            /BROKER95_CONTRACT_DRAFT_FIELDS_INVALID/u
        );
        assert.equal(
            operation.input.repair.attempt,
            2
        );
        assert.equal(
            operation.input.repair.previousDraft
                .payPotential,
            500
        );
    }
);

test(
    "Groq aplica esquemas estrictos y presupuestos suficientes a review y push",
    async () => {
        const calls = [];
        const model = "openai/gpt-oss-120b";
        const adapter = createAdapter({
            model,
            fetch: async (_url, init) => {
                calls.push(JSON.parse(init.body));

                return createJsonResponse({
                    id: `chatcmpl-submission-${calls.length}`,
                    model,
                    choices: [{
                        message: {
                            content: '{"summary":"ok"}'
                        },
                        finish_reason: "stop"
                    }]
                });
            }
        });

        await adapter.reviewSubmission({
            requestId: "review:structured:1",
            model,
            input: {
                responseShape: {
                    findings: {
                        criteria: [
                            "F-CUM",
                            "F-COR",
                            "F-LIM"
                        ]
                    }
                }
            },
            stream: false
        });
        await adapter.evaluateSubmission({
            requestId: "evaluation:structured:1",
            model,
            input: {
                responseShape: {
                    criteria: {
                        requiredIds: [
                            "F-CUM",
                            "F-COR",
                            "F-LIM"
                        ]
                    }
                }
            },
            stream: false
        });

        const [review, evaluation] = calls;

        assert.equal(
            review.response_format.json_schema.name,
            "broker95_submission_review"
        );
        assert.equal(
            evaluation.response_format.json_schema.name,
            "broker95_submission_evaluation"
        );
        assert.equal(
            review.response_format.json_schema.strict,
            true
        );
        assert.equal(
            evaluation.response_format.json_schema.strict,
            true
        );
        assert.equal(review.stream, false);
        assert.equal(evaluation.stream, false);
        assert.equal(review.max_completion_tokens, 4_096);
        assert.equal(
            evaluation.max_completion_tokens,
            8_192
        );
        assert.match(
            review.messages[0].content,
            /Authoritative JSON Schema/u
        );
        assert.match(
            evaluation.messages[0].content,
            /Valid shape example/u
        );
        assert.equal(
            review.response_format.json_schema.schema
                .additionalProperties,
            false
        );
        assert.equal(
            evaluation.response_format.json_schema.schema
                .additionalProperties,
            false
        );
    }
);

test(
    "Groq transmite review ordenado y valida el JSON final",
    async () => {
        const adapter = createAdapter({
            fetch: async () => createSseResponse([
                sse({
                    id: "chatcmpl-stream",
                    model: "modelo-configurado",
                    choices: [{
                        delta: {
                            content: "{\"summary\":"
                        },
                        finish_reason: null
                    }]
                }),
                sse({
                    choices: [{
                        delta: {
                            content: "\"Listo\"}"
                        },
                        finish_reason: "stop"
                    }]
                }),
                "data: [DONE]\n\n"
            ])
        });
        const deltas = [];
        const result = await adapter.reviewSubmission({
            requestId: "review:1",
            model: "modelo-configurado",
            input: { source: "PRINCIPAL()" }
        }, {
            onDelta(delta) {
                deltas.push(delta.text);
            }
        });

        assert.deepEqual(deltas, [
            "{\"summary\":",
            "\"Listo\"}"
        ]);
        assert.deepEqual(result.output, {
            summary: "Listo"
        });
        assert.equal(result.responseId, "chatcmpl-stream");
    }
);

test(
    "testConnection comprueba credencial y acceso con una inferencia mínima",
    async () => {
        for (const model of [
            "llama-3.3-70b-versatile",
            "qwen/qwen3.6-27b",
            "openai/gpt-oss-120b"
        ]) {
        const calls = [];
        const adapter = createAdapter({
            model,
            fetch: async (url, init) => {
                calls.push({ url, init });
                return createJsonResponse({
                    id: "chatcmpl-probe",
                    object: "chat.completion",
                    model,
                    choices: [{
                        message: {
                            role: "assistant",
                            content: "OK"
                        },
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
            requestId: "connection:1",
            model: "ignorado-por-el-host"
        });

        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, GROQ_CHAT_COMPLETIONS_URL);
        assert.equal(calls[0].init.method, "POST");
        assert.equal(calls[0].init.headers.Authorization, "Bearer broker95-secret");
        assert.equal(
            calls[0].init.headers["Content-Type"],
            "application/json"
        );
        assert.deepEqual(
            JSON.parse(calls[0].init.body),
            createGroqConnectionProbePayload(model)
        );
        assert.equal(result.model, model);
        assert.deepEqual(result.output, {
            connected: true,
            message: "Modelo disponible."
        });
        }
    }
);

test("Groq sólo confirma una respuesta válida de la inferencia mínima", async () => {
    for (const payload of [
        {},
        { error: { message: "broker95-secret" } },
        { choices: [] },
        {
            choices: [{
                message: {
                    role: "assistant",
                    content: ""
                },
                finish_reason: "stop"
            }]
        },
        {
            choices: Array(9).fill({
                message: { content: "OK" }
            })
        }
    ]) {
        const logger = createLogger();
        const adapter = createAdapter({ logger, fetch: async () => createJsonResponse(payload) });
        await assert.rejects(adapter.testConnection({
            requestId: "probe:invalid", model: "modelo-configurado"
        }), error => {
            assert.equal(error.code, "BROKER95_GROQ_RESPONSE_INVALID");
            assert.equal(error.failureKind, "invalid-response");
            assert.equal(JSON.stringify(error).includes("broker95-secret"), false);
            return true;
        });
        assert.equal(JSON.stringify(logger.entries).includes("broker95-secret"), false);
    }
});

test("Groq acepta una sonda agotada durante el razonamiento sin exponerlo", async () => {
    const adapter = createAdapter({
        fetch: async () => createJsonResponse({
            model: "openai/gpt-oss-120b",
            choices: [{
                message: {
                    role: "assistant",
                    content: null,
                    reasoning: "contenido privado"
                },
                finish_reason: "length"
            }],
            usage: {
                prompt_tokens: 8,
                completion_tokens: 64,
                total_tokens: 72
            }
        })
    });

    const result = await adapter.testConnection({
        requestId: "probe:reasoning",
        model: "ignored"
    });

    assert.equal(result.output.connected, true);
    assert.equal(
        JSON.stringify(result).includes("contenido privado"),
        false
    );
});

test("Groq distingue credencial, límite y modelo en respuestas HTTP", async () => {
    for (const [status, code, failureKind] of [
        [401, "BROKER95_GROQ_AUTHENTICATION_FAILED", "authentication"],
        [403, "BROKER95_GROQ_AUTHENTICATION_FAILED", "authentication"],
        [429, "BROKER95_GROQ_QUOTA_EXHAUSTED", "quota"],
        [404, "BROKER95_GROQ_MODEL_UNAVAILABLE", "model-unavailable"],
        [400, "BROKER95_GROQ_HTTP_FAILED", "http"]
    ]) {
        const adapter = createAdapter({
            fetch: async () => ({
                ok: false,
                status,
                headers: createHeaders()
            })
        });

        await assert.rejects(
            adapter.testConnection({
                requestId: `probe:http:${status}`,
                model: "ignored"
            }),
            error =>
                error.code === code &&
                error.failureKind === failureKind &&
                error.httpStatus === status
        );
    }
});

test(
    "Groq informa límites de uso sin revelar el secreto en logs ni diagnósticos",
    async () => {
        const logger = createLogger();
        const adapter = createAdapter({
            logger,
            fetch: async () => ({
                ok: false,
                status: 429,
                headers: createHeaders()
            })
        });

        await assert.rejects(
            adapter.chat({
                requestId: "error:1",
                model: "modelo-configurado",
                input: { message: "Hola" }
            }),
            error =>
                error instanceof
                    GroqBroker95LLMAdapterError &&
                error.code ===
                    "BROKER95_GROQ_QUOTA_EXHAUSTED" &&
                error.publicMessage ===
                    "El proveedor alcanzó un límite de uso para CIPHER."
        );
        assert.equal(
            JSON.stringify(logger.entries)
                .includes("broker95-secret"),
            false
        );
    }
);

test(
    "Groq traduce un fallo del proveedor al estado público compuesto por el Host",
    async () => {
        const availability = {
            failures: [],
            recordFailure(error) {
                this.failures.push(error.code);
                return createBrokerLlmAvailability(
                    "quota_exhausted"
                );
            },
            recordSuccess() {}
        };
        const adapter = new GroqBroker95LLMAdapter({
            configurationService: {
                async resolvePrivateLlmSettings() {
                    return Object.freeze({
                        providerId: "groq",
                        model: "modelo-configurado",
                        credential: Object.freeze({
                            providerId: "groq",
                            kind: "api-key",
                            value: "broker95-secret"
                        })
                    });
                }
            },
            availability,
            fetch: async () => ({
                ok: false,
                status: 429,
                headers: createHeaders()
            }),
            developerLogger: createLogger(),
            timeoutMs: 5_000
        });

        await assert.rejects(
            adapter.chat({
                requestId: "availability:1",
                model: "modelo-configurado",
                input: { message: "Hola" }
            }),
            error =>
                error instanceof
                    BrokerLlmAvailabilityError &&
                error.code ===
                    "BROKER95_LLM_QUOTA_EXHAUSTED" &&
                error.publicMessage.includes("cuota") &&
                !JSON.stringify(error).includes(
                    "broker95-secret"
                )
        );
        assert.deepEqual(availability.failures, [
            "BROKER95_GROQ_QUOTA_EXHAUSTED"
        ]);
    }
);

test(
    "Groq corta una solicitud que supera el timeout del Host",
    async () => {
        const adapter = createAdapter({
            timeoutMs: 1_000,
            fetch: async (_url, init) =>
                new Promise((resolve, reject) => {
                    init.signal.addEventListener(
                        "abort",
                        () => reject(
                            new Error("aborted")
                        ),
                        { once: true }
                    );
                })
        });

        await assert.rejects(
            adapter.chat({
                requestId: "timeout:1",
                model: "modelo-configurado",
                input: { message: "Hola" }
            }),
            errorCode(
                GroqBroker95LLMAdapterError,
                "BROKER95_GROQ_TIMEOUT"
            )
        );
    }
);

test(
    "Groq mantiene la cancelacion externa fuera del proveedor",
    async () => {
        let fetchCalls = 0;
        const adapter = createAdapter({
            fetch: async () => {
                fetchCalls += 1;
                throw new Error("should not run");
            }
        });
        const controller = new AbortController();
        controller.abort();

        await assert.rejects(
            adapter.chat({
                requestId: "abort:1",
                model: "modelo-configurado",
                input: { message: "Hola" }
            }, {
                signal: controller.signal
            }),
            errorCode(
                BrokerLLMProtocolError,
                "BROKER95_LLM_REQUEST_ABORTED"
            )
        );
        assert.equal(fetchCalls, 0);
    }
);

function createAdapter(options = {}) {
    return new GroqBroker95LLMAdapter({
        configurationService: {
            async resolvePrivateLlmSettings(
                providerId
            ) {
                options.resolvedProviderIds
                    ?.push(providerId);
                return Object.freeze({
                    providerId: "groq",
                    model: options.model ??
                        "modelo-configurado",
                    credential: Object.freeze({
                        providerId: "groq",
                        kind: "api-key",
                        value: "broker95-secret"
                    })
                });
            }
        },
        fetch: options.fetch,
        developerLogger: options.logger ??
            createLogger(),
        timeoutMs: options.timeoutMs ?? 5_000
    });
}

function contractGenerationRequest({ model, risk }) {
    return createBrokerContractGenerationRequest({
        requestId: "contract:groq:1",
        model,
        risk,
        category: brokerCategoryCatalog.requireCategory(
            "NUM-ARITH"
        )
    });
}

function namedContractDraft() {
    return {
        ...anonymousContractDraft(),
        client: "Laboratorio Aurora"
    };
}

function anonymousContractDraft() {
    return {
        title: "Suma controlada",
        description: "Suma los valores recibidos.",
        requirements: [
            "Leer dos numeros.",
            "Mostrar la suma."
        ],
        testCases: [{
            id: "TC-1",
            kind: "normal",
            requirementIds: [
                "REQ-1",
                "REQ-2"
            ],
            stdin: "2\n3\n",
            expected: "5\n",
            comparison: "exact",
            timeoutMs: 1_000
        }]
    };
}

function createJsonResponse(payload) {
    return {
        ok: true,
        status: 200,
        headers: createHeaders(),
        async text() {
            return JSON.stringify(payload);
        }
    };
}

function createSseResponse(parts) {
    return {
        ok: true,
        status: 200,
        headers: createHeaders(),
        body: createSseBody(parts)
    };
}

function createSseBody(parts) {
    const encoder = new TextEncoder();

    return new ReadableStream({
        start(controller) {
            for (const part of parts) {
                controller.enqueue(
                    encoder.encode(part)
                );
            }

            controller.close();
        }
    });
}

function createHeaders() {
    return {
        get() {
            return null;
        }
    };
}

function sse(payload) {
    return `data: ${JSON.stringify(payload)}\n\n`;
}

function createLogger() {
    return {
        entries: [],
        error(...args) {
            this.entries.push(args);
        }
    };
}

function errorCode(Type, code) {
    return error =>
        error instanceof Type &&
        error.code === code;
}
