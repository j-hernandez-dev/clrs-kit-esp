import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER_LLM_PROTOCOL_ID,
    BROKER_LLM_PROTOCOL_VERSION,
    BrokerLLMFinishReason,
    BrokerLLMMessageRole,
    BrokerLLMOperation,
    BrokerLLMPort,
    BrokerLLMProtocolError,
    BrokerLLMResponseFormat,
    BrokerLLMResponseSchema,
    BrokerLLMResponseValidator,
    createBrokerLLMRequest,
    createChatRequest,
    createGenerateContractRequest,
    getBrokerLLMOperationDescriptor,
    isBrokerLLMPort
} from "../src/broker95/llm/index.js";

test(
    "define las seis operaciones sin conceptos de un proveedor",
    () => {
        assert.deepEqual(
            Object.values(BrokerLLMOperation),
            [
                "generateContract",
                "reviewSubmission",
                "askSubmission",
                "evaluateSubmission",
                "chat",
                "testConnection"
            ]
        );

        assert.equal(
            getBrokerLLMOperationDescriptor(
                BrokerLLMOperation.CHAT
            ).supportsStreaming,
            true
        );
        assert.equal(
            getBrokerLLMOperationDescriptor(
                BrokerLLMOperation.ASK_SUBMISSION
            ).responseFormat,
            BrokerLLMResponseFormat.TEXT
        );
        assert.equal(
            getBrokerLLMOperationDescriptor(
                BrokerLLMOperation
                    .GENERATE_CONTRACT
            ).responseSchema,
            BrokerLLMResponseSchema
                .CONTRACT_DRAFT
        );
    }
);

test(
    "crea solicitudes versionadas, inmutables y sin credenciales",
    () => {
        const sourceContext = {
            risk: "high",
            evidence: {
                testsPassed: 4
            }
        };
        const request =
            createGenerateContractRequest({
                requestId: "contract:17",
                model: "  model/example  ",
                input: {
                    categoryId: "sorting"
                },
                context: sourceContext,
                conversation: [{
                    role:
                        BrokerLLMMessageRole.USER,
                    content: "Necesito un contrato."
                }]
            });

        sourceContext.evidence.testsPassed = 0;

        assert.equal(
            request.protocol,
            BROKER_LLM_PROTOCOL_ID
        );
        assert.equal(
            request.protocolVersion,
            BROKER_LLM_PROTOCOL_VERSION
        );
        assert.equal(
            request.model,
            "model/example"
        );
        assert.equal(request.stream, false);
        assert.equal(
            request.context.evidence.testsPassed,
            4
        );
        assert.equal(Object.isFrozen(request), true);
        assert.equal(
            Object.isFrozen(request.context.evidence),
            true
        );
        assert.equal(
            Object.hasOwn(request, "apiKey"),
            false
        );
    }
);

test(
    "valida el input propio de chat y las restricciones de streaming",
    () => {
        const chat = createChatRequest({
            requestId: "chat:1",
            model: "model",
            input: { message: "Hola" }
        });

        assert.equal(chat.stream, true);

        assert.throws(
            () => createChatRequest({
                requestId: "chat:2",
                model: "model",
                input: {
                    message: "Hola",
                    apiKey: "secret"
                }
            }),
            errorCode(
                "BROKER95_LLM_REQUEST_INVALID"
            )
        );
        assert.throws(
            () => createGenerateContractRequest({
                requestId: "contract:2",
                model: "model",
                stream: true
            }),
            errorCode(
                "BROKER95_LLM_REQUEST_INVALID"
            )
        );
        assert.throws(
            () => createGenerateContractRequest({
                requestId: "contract:3",
                model: "model",
                apiKey: "must-not-cross-port"
            }),
            errorCode(
                "BROKER95_LLM_REQUEST_INVALID"
            )
        );
    }
);

test(
    "rechaza valores no JSON, ciclos y roles privilegiados",
    () => {
        const cyclic = {};
        cyclic.self = cyclic;

        for (const source of [
            {
                requestId: "invalid:1",
                model: "model",
                input: cyclic
            },
            {
                requestId: "invalid:2",
                model: "model",
                input: { value: Number.NaN }
            },
            {
                requestId: "invalid:3",
                model: "model",
                conversation: [{
                    role: "system",
                    content: "No debe persistirse."
                }]
            }
        ]) {
            assert.throws(
                () => createBrokerLLMRequest(
                    BrokerLLMOperation
                        .GENERATE_CONTRACT,
                    source
                ),
                errorCode(
                    "BROKER95_LLM_REQUEST_INVALID"
                )
            );
        }
    }
);

test(
    "acepta JSON estricto y rechaza markdown o estructuras inseguras",
    () => {
        const validator =
            new BrokerLLMResponseValidator();
        const request = createChatRequest({
            requestId: "chat:response",
            model: "model",
            input: { message: "Hola" }
        });
        const output = validator.validate(
            request,
            '{"message":"Enlace establecido."}'
        );

        assert.deepEqual(output, {
            message: "Enlace establecido."
        });
        assert.equal(Object.isFrozen(output), true);

        assert.throws(
            () => validator.validate(
                request,
                "```json\n{\"message\":\"Hola\"}\n```"
            ),
            errorCode(
                "BROKER95_LLM_RESPONSE_INVALID"
            )
        );
        assert.throws(
            () => validator.validate(
                request,
                '{"message":"Hola","__proto__":{}}'
            ),
            errorCode(
                "BROKER95_LLM_RESPONSE_INVALID"
            )
        );
    }
);

test(
    "normaliza resultados de todas las operaciones mediante un solo puerto",
    async () => {
        const port = new RecordingLLMPort();
        const common = {
            model: "provider-neutral-model",
            context: {
                gameRevision: 7
            }
        };
        const calls = [
            port.generateContract({
                ...common,
                requestId: "request:1",
                input: { risk: "low" }
            }),
            port.reviewSubmission({
                ...common,
                requestId: "request:2",
                input: { source: "PRINCIPAL()" }
            }),
            port.askSubmission({
                ...common,
                requestId: "request:3",
                input: {
                    question: "¿Qué está ocurriendo?"
                },
                stream: false
            }),
            port.evaluateSubmission({
                ...common,
                requestId: "request:4",
                input: { source: "PRINCIPAL()" }
            }),
            port.chat({
                ...common,
                requestId: "request:5",
                input: { message: "Hola" }
            }),
            port.testConnection({
                ...common,
                requestId: "request:6"
            })
        ];
        const results = await Promise.all(calls);

        assert.equal(port.requests.length, 6);
        assert.deepEqual(
            results.map(
                result => result.operation
            ),
            Object.values(BrokerLLMOperation)
        );
        assert.equal(
            results[0].output.title,
            "Contrato"
        );
        assert.equal(
            results[2].output,
            "Puedo ayudarte con ese ciclo."
        );
        assert.equal(
            results[4].output.message,
            "Respuesta de CIPHER"
        );
        assert.equal(
            results[5].output.connected,
            true
        );
        assert.deepEqual(results[0].usage, {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14
        });
        assert.equal(
            results[0].finishReason,
            BrokerLLMFinishReason.STOP
        );
        assert.equal(
            Object.hasOwn(results[0], "raw"),
            false
        );
    }
);

test(
    "emite deltas ordenados sin exponer el transporte",
    async () => {
        const port = new StreamingLLMPort();
        const deltas = [];
        const result = await port.chat({
            requestId: "stream:1",
            model: "model",
            input: { message: "Hola" }
        }, {
            onDelta(delta) {
                deltas.push(delta);
            }
        });

        assert.deepEqual(
            deltas.map(delta => ({
                sequence: delta.sequence,
                text: delta.text
            })),
            [
                { sequence: 0, text: "Hola," },
                { sequence: 1, text: " " },
                { sequence: 2, text: "operador." }
            ]
        );
        assert.equal(
            result.output.message,
            "Hola, operador."
        );
        assert.equal(
            deltas.map(delta => delta.text)
                .join(""),
            result.output.message
        );
    }
);

test(
    "cancela antes de tocar el adaptador",
    async () => {
        const port = new RecordingLLMPort();
        const controller =
            new AbortController();
        controller.abort();

        await assert.rejects(
            port.chat({
                requestId: "abort:1",
                model: "model",
                input: { message: "Hola" }
            }, {
                signal: controller.signal
            }),
            errorCode(
                "BROKER95_LLM_REQUEST_ABORTED"
            )
        );
        assert.equal(port.requests.length, 0);
    }
);

test(
    "el puerto base y los metadatos inválidos fallan de forma estructurada",
    async () => {
        const base = new BrokerLLMPort();

        await assert.rejects(
            base.testConnection({
                requestId: "base:1",
                model: "model"
            }),
            errorCode(
                "BROKER95_LLM_PORT_NOT_IMPLEMENTED"
            )
        );

        const invalid =
            new InvalidUsageLLMPort();

        await assert.rejects(
            invalid.testConnection({
                requestId: "usage:1",
                model: "model"
            }),
            errorCode(
                "BROKER95_LLM_RESPONSE_INVALID"
            )
        );
    }
);

test(
    "identifica implementaciones compatibles por capacidad",
    () => {
        assert.equal(
            isBrokerLLMPort(
                new RecordingLLMPort()
            ),
            true
        );
        assert.equal(
            isBrokerLLMPort({ chat() {} }),
            false
        );
    }
);

class RecordingLLMPort extends BrokerLLMPort {

    constructor() {
        super();
        this.requests = [];
    }

    async performRequest(request) {
        this.requests.push(request);

        const output = {
            [BrokerLLMOperation
                .GENERATE_CONTRACT]: {
                title: "Contrato"
            },
            [BrokerLLMOperation
                .REVIEW_SUBMISSION]: {
                summary: "Revisión"
            },
            [BrokerLLMOperation
                .ASK_SUBMISSION]:
                "Puedo ayudarte con ese ciclo.",
            [BrokerLLMOperation
                .EVALUATE_SUBMISSION]: {
                dimensions: {}
            },
            [BrokerLLMOperation.CHAT]: {
                message: "Respuesta de CIPHER"
            },
            [BrokerLLMOperation
                .TEST_CONNECTION]: {
                connected: true
            }
        }[request.operation];

        return {
            output,
            model: request.model,
            finishReason:
                BrokerLLMFinishReason.STOP,
            usage: {
                inputTokens: 10,
                outputTokens: 4,
                totalTokens: 14
            },
            responseId:
                `response:${request.requestId}`
        };
    }
}

class StreamingLLMPort extends BrokerLLMPort {

    async performRequest(request, execution) {
        await execution.emitDelta("Hola,");
        await execution.emitDelta(" ");
        await execution.emitDelta("operador.");

        return {
            output: {
                message: "Hola, operador."
            }
        };
    }
}

class InvalidUsageLLMPort
    extends BrokerLLMPort {

    async performRequest() {
        return {
            output: { connected: true },
            usage: {
                inputTokens: 1,
                outputTokens: 1,
                totalTokens: 1
            }
        };
    }
}

function errorCode(code) {
    return error =>
        error instanceof
            BrokerLLMProtocolError &&
        error.code === code;
}
