import test from "node:test";
import assert from "node:assert/strict";

import {
    BrokerConversationError
} from "../src/broker95/conversation/BrokerConversationError.js";
import {
    BrokerConversationLoadSource,
    BrokerConversationSession,
    createBrokerConversationSummaryView
} from "../src/broker95/conversation/BrokerConversationSession.js";
import {
    BROKER_CONVERSATION_MAX_CHARACTERS,
    BROKER_CONVERSATION_MAX_MESSAGE_CHARACTERS,
    BROKER_CONVERSATION_MAX_TURNS,
    BrokerConversationRole,
    appendBrokerConversationTurn,
    clearBrokerConversation,
    createBrokerConversationState,
    createBrokerConversationSummary,
    createBrokerLlmConversationMessages
} from "../src/broker95/conversation/BrokerConversationState.js";
import {
    BROKER_CONVERSATION_SNAPSHOT_FORMAT,
    BROKER_CONVERSATION_SNAPSHOT_VERSION,
    brokerConversationSerializer
} from "../src/broker95/conversation/BrokerConversationSerializer.js";
import {
    BROKER95_CORRUPT_CONVERSATION_KEY,
    BROKER95_GLOBAL_CONVERSATION_KEY,
    VSCodeGlobalStateBrokerConversationRepository
} from "../extension/adapters/VSCodeGlobalStateBrokerConversationRepository.js";

test("crea un historial vacío, acotado e inmutable", () => {
    const state =
        createBrokerConversationState();
    const summary =
        createBrokerConversationSummary(
            state
        );

    assert.deepEqual(state, {
        schemaVersion: 1,
        revision: 0,
        nextTurnId: 1,
        turns: []
    });
    assert.deepEqual(summary, {
        revision: 0,
        turnCount: 0,
        messageCount: 0,
        totalCharacters: 0,
        limits: {
            maximumTurns:
                BROKER_CONVERSATION_MAX_TURNS,
            maximumCharacters:
                BROKER_CONVERSATION_MAX_CHARACTERS,
            maximumMessageCharacters:
                BROKER_CONVERSATION_MAX_MESSAGE_CHARACTERS
        }
    });
    assert.equal(Object.isFrozen(state), true);
    assert.equal(
        Object.isFrozen(summary.limits),
        true
    );
});

test("persiste únicamente intercambios completos entre usuario y CIPHER", () => {
    const state = append(
        createBrokerConversationState(),
        "¿Qué hace una cola?",
        "Procesa elementos en orden FIFO."
    );
    const turn = state.turns[0];

    assert.deepEqual(turn, {
        id: 1,
        userContent: "¿Qué hace una cola?",
        assistantContent:
            "Procesa elementos en orden FIFO."
    });
    assert.equal(state.revision, 1);
    assert.equal(state.nextTurnId, 2);
    assert.throws(
        () => appendBrokerConversationTurn(
            state,
            { userContent: "Mensaje incompleto" }
        ),
        error =>
            error.code ===
                "BROKER95_CONVERSATION_MESSAGE_INVALID"
    );
});

test("construye contexto LLM sólo con roles user y assistant", () => {
    let state = createBrokerConversationState();

    state = append(
        state,
        "Primero",
        "Respuesta uno"
    );
    state = append(
        state,
        "Segundo",
        "Respuesta dos"
    );

    const messages =
        createBrokerLlmConversationMessages(
            state
        );

    assert.deepEqual(messages, [
        {
            role: BrokerConversationRole.USER,
            content: "Primero"
        },
        {
            role:
                BrokerConversationRole
                    .ASSISTANT,
            content: "Respuesta uno"
        },
        {
            role: BrokerConversationRole.USER,
            content: "Segundo"
        },
        {
            role:
                BrokerConversationRole
                    .ASSISTANT,
            content: "Respuesta dos"
        }
    ]);
    assert.equal(
        messages.some(message =>
            message.role === "system"
        ),
        false
    );
});

test("recorta turnos antiguos sin separar pregunta y respuesta", () => {
    let state = createBrokerConversationState();

    for (
        let index = 1;
        index <=
            BROKER_CONVERSATION_MAX_TURNS + 1;
        index += 1
    ) {
        state = append(
            state,
            `usuario-${index}`,
            `cipher-${index}`
        );
    }

    assert.equal(
        state.turns.length,
        BROKER_CONVERSATION_MAX_TURNS
    );
    assert.equal(state.turns[0].id, 2);
    assert.equal(
        state.turns.at(-1).id,
        BROKER_CONVERSATION_MAX_TURNS + 1
    );
    assert.equal(
        createBrokerLlmConversationMessages(
            state
        ).length,
        BROKER_CONVERSATION_MAX_TURNS * 2
    );
});

test("aplica además un presupuesto total de caracteres", () => {
    const longUser = "u".repeat(
        BROKER_CONVERSATION_MAX_MESSAGE_CHARACTERS
    );
    const longAssistant =
        "a".repeat(
            BROKER_CONVERSATION_MAX_MESSAGE_CHARACTERS
        );
    let state = append(
        createBrokerConversationState(),
        longUser,
        longAssistant
    );

    state = append(
        state,
        "pregunta reciente",
        "respuesta reciente"
    );

    assert.equal(state.turns.length, 1);
    assert.equal(
        state.turns[0].userContent,
        "pregunta reciente"
    );
    assert.ok(
        createBrokerConversationSummary(
            state
        ).totalCharacters <=
            BROKER_CONVERSATION_MAX_CHARACTERS
    );
});

test("rechaza mensajes vacíos, nulos o demasiado grandes", () => {
    const state =
        createBrokerConversationState();
    const invalidValues = [
        "",
        "   ",
        "contenido\u0000oculto",
        "x".repeat(
            BROKER_CONVERSATION_MAX_MESSAGE_CHARACTERS +
            1
        )
    ];

    for (const value of invalidValues) {
        assert.throws(
            () => appendBrokerConversationTurn(
                state,
                {
                    userContent: value,
                    assistantContent: "respuesta"
                }
            ),
            error =>
                error instanceof
                    BrokerConversationError &&
                error.code ===
                    "BROKER95_CONVERSATION_MESSAGE_INVALID"
        );
    }
});

test("limpiar el historial conserva IDs monotónicos", () => {
    let state = append(
        createBrokerConversationState(),
        "uno",
        "dos"
    );

    state = clearBrokerConversation(state);

    assert.equal(state.turns.length, 0);
    assert.equal(state.nextTurnId, 2);
    assert.equal(state.revision, 2);

    state = append(state, "tres", "cuatro");

    assert.equal(state.turns[0].id, 2);
});

test("serializa el formato actual y rechaza historiales sin envoltura", () => {
    const state = append(
        createBrokerConversationState(),
        "hola",
        "operador disponible"
    );
    const snapshot =
        brokerConversationSerializer.encode(
            state
        );
    const decoded =
        brokerConversationSerializer.decode(
            snapshot
        );

    assert.equal(
        snapshot.format,
        BROKER_CONVERSATION_SNAPSHOT_FORMAT
    );
    assert.equal(
        snapshot.formatVersion,
        BROKER_CONVERSATION_SNAPSHOT_VERSION
    );
    assert.deepEqual(decoded.state, state);
    assert.throws(
        () => brokerConversationSerializer
            .decode(structuredClone(state)),
        error => error.code ===
            "BROKER95_CONVERSATION_STATE_INVALID"
    );
    assert.throws(
        () => brokerConversationSerializer
            .decode({
                ...structuredClone(state),
                systemPrompt: "no persistir"
            }),
        error =>
            error.code ===
                "BROKER95_CONVERSATION_STATE_INVALID"
    );
});

test("aplica retención acotada a un snapshot actual", () => {
    const turns = Array.from(
        {
            length:
                BROKER_CONVERSATION_MAX_TURNS +
                2
        },
        (_, index) => ({
            id: index + 1,
            userContent: `u-${index + 1}`,
            assistantContent:
                `a-${index + 1}`
        })
    );
    const decoded =
        brokerConversationSerializer.decode({
            format:
                BROKER_CONVERSATION_SNAPSHOT_FORMAT,
            formatVersion: 1,
            state: {
                schemaVersion: 1,
                revision: 50,
                nextTurnId: 51,
                turns
            }
        });

    assert.equal(
        decoded.state.turns.length,
        BROKER_CONVERSATION_MAX_TURNS
    );
    assert.equal(
        decoded.state.turns[0].id,
        3
    );
    assert.equal(decoded.retentionApplied, true);
});

test("crea y restaura el historial global del perfil", async () => {
    const globalState = new FakeMemento();
    const first = createSession(globalState);
    const created = await first.initialize();

    assert.equal(
        created.source,
        BrokerConversationLoadSource.CREATED
    );
    await first.appendTurn({
        userContent: "¿Estado?",
        assistantContent: "Operativo."
    });

    const second = createSession(globalState);
    const restored =
        await second.initialize();

    assert.equal(
        restored.source,
        BrokerConversationLoadSource.RESTORED
    );
    assert.equal(restored.state.turns.length, 1);
    assert.deepEqual(
        second.getLlmMessages(),
        [
            {
                role: "user",
                content: "¿Estado?"
            },
            {
                role: "assistant",
                content: "Operativo."
            }
        ]
    );
});

test("serializa escrituras concurrentes sin perder turnos", async () => {
    const session = createSession(
        new FakeMemento()
    );

    await session.initialize();
    await Promise.all([
        session.appendTurn({
            userContent: "uno",
            assistantContent: "respuesta uno"
        }),
        session.appendTurn({
            userContent: "dos",
            assistantContent: "respuesta dos"
        })
    ]);

    assert.deepEqual(
        session.getTurns().map(
            turn => turn.id
        ),
        [1, 2]
    );
    assert.equal(session.getState().revision, 2);
});

test("rechaza revisiones obsoletas sin escribir", async () => {
    const globalState = new FakeMemento();
    const session = createSession(globalState);

    await session.initialize();
    const writesBefore =
        globalState.updates.length;

    await assert.rejects(
        session.appendTurn(
            {
                userContent: "mensaje",
                assistantContent: "respuesta"
            },
            { expectedRevision: 9 }
        ),
        error =>
            error.code ===
                "BROKER95_CONVERSATION_REVISION_CONFLICT"
    );
    assert.equal(
        globalState.updates.length,
        writesBefore
    );
});

test("una escritura fallida no publica ni cambia el historial", async () => {
    const globalState = new FakeMemento();
    const session = createSession(globalState);
    const events = [];

    session.subscribe(event => {
        events.push(event.reason);
    });
    await session.initialize();
    globalState.failOnKey =
        BROKER95_GLOBAL_CONVERSATION_KEY;

    await assert.rejects(
        session.appendTurn({
            userContent: "no persistido",
            assistantContent: "tampoco"
        }),
        error =>
            error.code ===
                "BROKER95_CONVERSATION_STORAGE_ERROR"
    );
    assert.equal(session.getTurns().length, 0);
    assert.deepEqual(events, [
        "conversation/initialized"
    ]);
});

test("la cuarentena conserva sólo metadatos, no contenido conversacional", async () => {
    const privateText =
        "CODIGO-PRIVADO-NO-COPIABLE";
    const corrupt = {
        format:
            BROKER_CONVERSATION_SNAPSHOT_FORMAT,
        formatVersion: 1,
        state: {
            schemaVersion: 1,
            revision: -1,
            nextTurnId: 2,
            turns: [{
                id: 1,
                userContent: privateText,
                assistantContent: "respuesta"
            }]
        }
    };
    const globalState = new FakeMemento({
        [BROKER95_GLOBAL_CONVERSATION_KEY]:
            corrupt
    });
    const session = createSession(globalState);
    const loaded = await session.initialize();
    const quarantine = globalState.get(
        BROKER95_CORRUPT_CONVERSATION_KEY
    );

    assert.equal(
        loaded.source,
        BrokerConversationLoadSource.RECOVERED
    );
    assert.deepEqual(
        quarantine.snapshotMetadata,
        {
            valueType: "object",
            recognizedFormat: true,
            formatVersion: 1,
            declaredTurnCount: 1
        }
    );
    assert.equal(
        JSON.stringify(quarantine)
            .includes(privateText),
        false
    );
});

test("preserva una versión futura en lugar de borrar conversaciones", async () => {
    const future = {
        format:
            BROKER_CONVERSATION_SNAPSHOT_FORMAT,
        formatVersion: 2,
        state: structuredClone(
            createBrokerConversationState()
        )
    };
    const globalState = new FakeMemento({
        [BROKER95_GLOBAL_CONVERSATION_KEY]:
            future
    });
    const session = createSession(globalState);

    await assert.rejects(
        session.initialize(),
        error =>
            error.code ===
                "BROKER95_CONVERSATION_VERSION_UNSUPPORTED"
    );
    assert.deepEqual(
        globalState.get(
            BROKER95_GLOBAL_CONVERSATION_KEY
        ),
        future
    );
    assert.equal(globalState.updates.length, 0);
});

test("la vista pública emite únicamente resúmenes sin texto", async () => {
    const session = createSession(
        new FakeMemento()
    );
    const view =
        createBrokerConversationSummaryView(
            session
        );
    const events = [];

    view.subscribe(event => {
        events.push(event);
    });
    await session.initialize();
    await session.appendTurn({
        userContent: "texto no público",
        assistantContent:
            "respuesta no pública"
    });

    assert.equal(events.length, 2);
    assert.equal(
        events[1].summary.turnCount,
        1
    );
    assert.equal(
        JSON.stringify(events)
            .includes("texto no público"),
        false
    );
    assert.equal(view.getTurns, undefined);
    assert.equal(view.getLlmMessages, undefined);
});

test("limpia el historial persistido sin reutilizar identificadores", async () => {
    const globalState = new FakeMemento();
    const session = createSession(globalState);

    await session.initialize();
    await session.appendTurn({
        userContent: "uno",
        assistantContent: "dos"
    });
    const cleared = await session.clear({
        expectedRevision: 1
    });

    assert.equal(cleared.clearedTurnCount, 1);
    assert.equal(cleared.state.nextTurnId, 2);
    assert.equal(
        globalState.get(
            BROKER95_GLOBAL_CONVERSATION_KEY
        ).state.turns.length,
        0
    );
});

function append(
    state,
    userContent,
    assistantContent
) {
    return appendBrokerConversationTurn(
        state,
        { userContent, assistantContent }
    );
}

function createSession(globalState) {
    return new BrokerConversationSession({
        repository:
            new VSCodeGlobalStateBrokerConversationRepository(
                globalState
            ),
        developerLogger: {
            error() {}
        }
    });
}

class FakeMemento {

    constructor(initial = {}) {
        this.values = new Map(
            Object.entries(initial).map(
                ([key, value]) => [
                    key,
                    structuredClone(value)
                ]
            )
        );
        this.updates = [];
        this.failOnKey = null;
    }

    get(key) {
        const value = this.values.get(key);

        return value === undefined
            ? undefined
            : structuredClone(value);
    }

    async update(key, value) {
        if (key === this.failOnKey) {
            throw new Error(
                "simulated conversation storage failure"
            );
        }

        const stored = value === undefined
            ? undefined
            : structuredClone(value);

        this.updates.push({ key, value: stored });

        if (stored === undefined) {
            this.values.delete(key);
        } else {
            this.values.set(key, stored);
        }
    }
}
