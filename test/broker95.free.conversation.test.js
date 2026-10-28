import test from "node:test";
import assert from "node:assert/strict";

import {
    BrokerCipherTone,
    BrokerConversationService,
    BrokerConversationSession,
    BrokerGameStatus,
    BrokerHostMessageType,
    BrokerLLMFinishReason,
    BrokerLLMPort,
    BrokerLlmStatus,
    BrokerLlmStatusReason,
    BrokerRisk,
    BrokerWebviewMessageType,
    acceptBrokerContract,
    addBrokerContract,
    brokerCategoryCatalog,
    createBrokerConversationContext,
    createBrokerGameState,
    createBrokerWebviewMessage,
    settleBrokerContract
} from "../src/broker95/index.js";
import {
    BrokerCommandController
} from "../extension/controllers/BrokerCommandController.js";

test("conversa con contexto seguro, decodifica el stream y persiste un turno completo", async () => {
    const conversation = createConversationSession();

    await conversation.initialize();
    await conversation.appendTurn({
        userContent: "Mensaje anterior",
        assistantContent: "Respuesta anterior"
    });

    const game = activeGameState();
    const llm = new StreamingChatLlm([
        '{"mes',
        'sage":"L\\u00',
        'ednea uno\\',
        'nSegunda: \\"lis',
        'ta\\"."}'
    ], () => {
        assert.equal(
            conversation.getTurns().length,
            1
        );
    });
    const service = createService({
        conversation,
        game,
        llm
    });
    const deltas = [];
    const result = await service.chat({
        message: "Necesito orientaci\u00f3n",
        requestId: "chat:test:1",
        onDelta(delta) {
            deltas.push(delta);
        }
    });

    assert.equal(
        deltas.map(delta => delta.text)
            .join(""),
        'L\u00ednea uno\nSegunda: "lista".'
    );
    assert.deepEqual(
        deltas.map(delta => delta.sequence),
        deltas.map((_, index) => index)
    );
    assert.equal(
        result.message,
        'L\u00ednea uno\nSegunda: "lista".'
    );
    assert.equal(result.turnId, 2);
    assert.equal(result.conversationRevision, 2);
    assert.deepEqual(
        conversation.getTurns().at(-1),
        {
            id: 2,
            userContent:
                "Necesito orientaci\u00f3n",
            assistantContent:
                'L\u00ednea uno\nSegunda: "lista".'
        }
    );

    const request = llm.requests[0];

    assert.equal(
        request.input.message,
        "Necesito orientaci\u00f3n"
    );
    assert.deepEqual(request.conversation, [
        {
            role: "user",
            content: "Mensaje anterior"
        },
        {
            role: "assistant",
            content: "Respuesta anterior"
        }
    ]);
    assert.equal(
        request.context.game
            .activeContract.title,
        "Contrato contextual"
    );
    assert.equal(
        request.context.cipher.tone,
        BrokerCipherTone.DRY
    );
    assert.deepEqual(
        request.context.boundaries
            .academicCriteria,
        [
            "functionality",
            "robustness",
            "design"
        ]
    );
    assert.equal(
        JSON.stringify(request.context)
            .includes("METADATA-PRIVADA"),
        false
    );
    assert.equal(
        JSON.stringify(request.context)
            .includes("testCases"),
        false
    );
});

test("un fallo o una respuesta inv\u00e1lida de CIPHER no deja mensajes hu\u00e9rfanos", async () => {
    for (const llm of [
        {
            async chat() {
                throw Object.assign(
                    new Error("provider failed"),
                    {
                        code:
                            "BROKER95_LLM_PROVIDER_ERROR",
                        publicMessage:
                            "CIPHER no est\u00e1 disponible."
                    }
                );
            }
        },
        {
            async chat() {
                return {
                    output: { message: "" }
                };
            }
        }
    ]) {
        const conversation =
            createConversationSession();
        const service = createService({
            conversation,
            game: createBrokerGameState(),
            llm
        });

        await assert.rejects(
            service.chat({
                message: "No persistir"
            })
        );
        assert.equal(
            conversation.getTurns().length,
            0
        );
    }
});

test("una conversación correlacionada produce una sola respuesta y un solo turno", async () => {
    const conversation =
        createConversationSession();

    await conversation.initialize();

    const llm = new StreamingChatLlm([
        '{"message":"Respuesta única."}'
    ]);
    const service = createService({
        conversation,
        game: activeGameState(),
        llm
    });
    const input = {
        message: "Misma consulta",
        requestId: "chat:idempotent:1"
    };
    const [first, duplicate] =
        await Promise.all([
            service.chat(input),
            service.chat(input)
        ]);

    assert.equal(first, duplicate);
    assert.equal(llm.requests.length, 1);
    assert.equal(
        conversation.getTurns().length,
        1
    );
    assert.equal(
        await service.chat(input),
        first
    );
    assert.equal(llm.requests.length, 1);
    assert.equal(
        conversation.getTurns().length,
        1
    );

    await assert.rejects(
        service.chat({
            ...input,
            message: "Consulta distinta"
        }),
        error => error.code ===
            "BROKER95_OPERATION_IDEMPOTENCY_CONFLICT"
    );
});

test("selecciona el tono de CIPHER a partir del estado determinista", () => {
    const urgent = createBrokerConversationContext(
        createBrokerGameState({
            alertLevel: 8
        })
    );
    const failed = createBrokerConversationContext(
        settledGameState(0)
    );
    const respected =
        createBrokerConversationContext(
            settledGameState(95)
        );
    const gameOver =
        createBrokerConversationContext(
            createBrokerGameState({
                status:
                    BrokerGameStatus.GAME_OVER,
                alertLevel: 11
            })
        );

    assert.equal(
        urgent.cipher.tone,
        BrokerCipherTone.URGENT
    );
    assert.equal(
        failed.cipher.tone,
        BrokerCipherTone.CRITICAL
    );
    assert.equal(
        respected.cipher.tone,
        BrokerCipherTone.RESPECTFUL
    );
    assert.equal(
        gameOver.cipher.tone,
        BrokerCipherTone.CRITICAL
    );
});

test("la terminal rechaza mensajes libres sin invocar conversación ni abrir un stream", async () => {
    const panel = createPanel();
    let calls = 0;
    const controller = new BrokerCommandController({
        host: {
            createPanel() {
                return panel;
            }
        },
        presenter: { present() {} },
        gameSession: {
            getState() {
                return createBrokerGameState();
            },
            subscribe() {
                return disposable();
            }
        },
        configuration: {
            getSnapshot() {
                return readyConfiguration();
            },
            subscribe() {
                return disposable();
            }
        },
        conversation: {
            async chat() {
                calls += 1;
                throw new Error(
                    "The disabled chat route must not be called."
                );
            }
        },
        async initialize() {},
        createSessionId() {
            return "broker95:chat-test";
        },
        developerLogger: { error() {} }
    });

    controller.open({});
    const result = await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .SUBMIT_TERMINAL,
            requestId: "request:chat",
            payload: {
                input: "ai Estado del enlace"
            }
        })
    );
    const stream = panel.messages.filter(message =>
        message.type ===
            BrokerHostMessageType.CIPHER_STREAM
    );
    const statuses = panel.messages.filter(message =>
        message.type ===
            BrokerHostMessageType.OPERATION_STATUS
    );

    assert.equal(result.ok, false);
    assert.equal(calls, 0);
    assert.deepEqual(stream, []);
    assert.deepEqual(statuses, []);
    assert.equal(
        panel.messages.at(-1).type,
        BrokerHostMessageType.ERROR
    );
    assert.equal(
        panel.messages.at(-1).payload.code,
        "BROKER95_TERMINAL_FREE_MESSAGE_DISABLED"
    );

    controller.dispose();
});

class StreamingChatLlm extends BrokerLLMPort {

    constructor(chunks, beforeResponse) {
        super();
        this.chunks = chunks;
        this.beforeResponse = beforeResponse;
        this.requests = [];
    }

    async performRequest(request, execution) {
        this.requests.push(request);
        this.beforeResponse?.();

        for (const chunk of this.chunks) {
            await execution.emitDelta(chunk);
        }

        return Object.freeze({
            output: this.chunks.join(""),
            model: request.model,
            finishReason:
                BrokerLLMFinishReason.STOP,
            responseId: "groq:chat:test"
        });
    }
}

function createService({
    conversation,
    game,
    llm
}) {
    return new BrokerConversationService({
        gameSession: {
            async initialize() {},
            getState() {
                return game;
            }
        },
        conversationSession: conversation,
        llm,
        availability: {
            getSnapshot() {
                return readyConfiguration();
            }
        },
        createRequestId() {
            return "chat:generated";
        }
    });
}

function createConversationSession() {
    let snapshot;

    return new BrokerConversationSession({
        repository: {
            async read() {
                return snapshot == null
                    ? undefined
                    : structuredClone(snapshot);
            },
            async write(value) {
                snapshot = structuredClone(value);
            },
            async quarantine() {}
        },
        developerLogger: { error() {} }
    });
}

function activeGameState() {
    let state = addBrokerContract(
        createBrokerGameState(),
        contractDraft()
    );

    state = acceptBrokerContract(
        state,
        1,
        { acceptedAt: 2 }
    );

    return state;
}

function settledGameState(score) {
    return settleBrokerContract(
        activeGameState(),
        {
            dimensionScores: {
                functionality: score
            },
            submittedAt: 3
        }
    );
}

function contractDraft() {
    const category = brokerCategoryCatalog
        .requireCategory("NUM-ARITH");

    return {
        title: "Contrato contextual",
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        familyId: category.familyId,
        familyName: category.familyName,
        risk: BrokerRisk.LOW,
        description:
            "Resolver una operaci\u00f3n.",
        requirements: [
            "Leer dos valores.",
            "Mostrar el resultado."
        ],
        client: "Northstar",
        payPotential: 200,
        createdAt: 1,
        metadata: {
            source: "METADATA-PRIVADA"
        }
    };
}

function readyConfiguration() {
    return Object.freeze({
        settings: Object.freeze({
            model: "modelo-chat",
            hasApiKey: true
        }),
        llmStatus: Object.freeze({
            status: BrokerLlmStatus.READY,
            reason: BrokerLlmStatusReason.READY,
            message: "CIPHER disponible."
        })
    });
}

function createPanel() {
    const disposeListeners = [];
    const panel = {
        messages: [],
        async postMessage(message) {
            panel.messages.push(message);
            return true;
        },
        onMessage() {
            return disposable();
        },
        onDispose(listener) {
            disposeListeners.push(listener);
            return disposable();
        },
        reveal() {},
        dispose() {
            for (const listener of disposeListeners) {
                listener();
            }
        }
    };

    return panel;
}

function disposable() {
    return Object.freeze({
        dispose() {}
    });
}
