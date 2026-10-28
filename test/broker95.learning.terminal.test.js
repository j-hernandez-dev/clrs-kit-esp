import test from "node:test";
import assert from "node:assert/strict";

import {
    BrokerContractCycleService,
    BrokerContractState,
    BrokerContractType,
    addBrokerContract,
    addBrokerLearningContract,
    brokerCategoryCatalog,
    createBrokerGameState,
    createBrokerLearningRouteView,
    formatBrokerLearningContractCreated,
    parseBrokerTerminalInput
} from "../src/broker95/index.js";

test("ai -get, -read, -set e -info usan el ciclo normal para un contrato educativo", async () => {
    const session = createMemorySession(
        addBrokerLearningContract(
            createBrokerGameState(),
            "lesson-001",
            learningNarrative()
        )
    );
    const service = createCycle(session);
    const listed = await service.execute(
        parseBrokerTerminalInput("ai -get")
    );
    const inspected = await service.execute(
        parseBrokerTerminalInput("ai -read 1")
    );
    const accepted = await service.execute(
        parseBrokerTerminalInput("ai -set 1")
    );
    const information = await service.execute(
        parseBrokerTerminalInput("ai -info")
    );

    assert.match(
        listed.messages[0].text,
        /#1 \[BAJO\] \[PENDIENTE\] Primer mensaje \/\/ USD 10/u
    );
    assert.doesNotMatch(
        listed.messages[0].text,
        /\b(?:learning|client)\b/iu
    );
    assert.match(
        inspected.messages[0].text,
        /Cliente\s+: CIPHER/u
    );
    assert.match(
        inspected.messages[0].text,
        /Paga potencial\s+: USD 10/u
    );
    assert.match(
        inspected.messages[0].text,
        /TC-LEARNING/u
    );
    assert.match(
        inspected.messages[0].text,
        /Debe mostrar exactamente el mensaje solicitado/u
    );
    assert.match(
        accepted.messages[0].text,
        /Contrato #1 aceptado: Primer mensaje/u
    );

    const state = session.getState();

    assert.equal(state.activeContractId, 1);
    assert.equal(
        state.contracts[0].state,
        BrokerContractState.ACTIVE
    );
    assert.equal(state.alertLevel, 0);
    assert.equal(
        programming(state)
            .lessonContractLinks["lesson-001"]
            .contractId,
        1
    );
    assert.match(
        information.messages[0].text,
        /Contrato activo:\s+#1 Primer mensaje/u
    );
    assert.doesNotMatch(
        information.messages[0].text,
        /PONDERACIÓN POR RIESGO|CATÁLOGO DE CRITERIOS/u
    );
});

test("ai -delete libera la lección y permite obtener otro intento", async () => {
    const session = createMemorySession(
        addBrokerLearningContract(
            createBrokerGameState(),
            "lesson-001",
            learningNarrative()
        )
    );
    const result = await createCycle(session)
        .execute(
            parseBrokerTerminalInput(
                "ai -delete 1"
            )
        );
    const state = session.getState();
    const route = createBrokerLearningRouteView(
        programming(state)
    );
    const lesson = route.lessons[0];

    assert.match(
        result.messages[0].text,
        /Contrato #1 eliminado/u
    );
    assert.equal(
        state.contracts[0].state,
        BrokerContractState.DELETED
    );
    assert.equal(
        programming(state)
            .lessonContractLinks["lesson-001"],
        undefined
    );
    assert.equal(
        lesson.canObtainContract,
        true
    );
    assert.equal(lesson.completed, false);
});

test("ai -purge elimina juntos pendientes normales y educativos sin borrar progreso", async () => {
    let state = addBrokerLearningContract(
        createBrokerGameState(),
        "lesson-001",
        learningNarrative()
    );

    state = addBrokerContract(
        state,
        clientDraft()
    );

    const session = createMemorySession(state);
    const result = await createCycle(session)
        .execute(
            parseBrokerTerminalInput("ai -purge")
        );
    const current = session.getState();

    assert.match(
        result.messages[0].text,
        /2 contratos pendientes eliminados/u
    );
    assert.equal(
        current.contracts.every(
            contract =>
                contract.state ===
                    BrokerContractState.DELETED
        ),
        true
    );
    assert.deepEqual(
        programming(current)
            .completedLessonIds,
        []
    );
    assert.equal(
        programming(current)
            .lessonContractLinks["lesson-001"],
        undefined
    );
});

test("la notificación hacker conserva los comandos normales del contrato", () => {
    const state = addBrokerLearningContract(
        createBrokerGameState(),
        "lesson-001",
        learningNarrative()
    );
    const contract = state.contracts[0];
    const text =
        formatBrokerLearningContractCreated({
            contract,
            lesson: {
                learningRouteId: "programming",
                routeTitle: "Programación",
                lessonId: "lesson-001",
                lessonOrder: 1,
                lessonTitle:
                    "Código fuente y programa",
                sectionId: "section-001"
            }
        });

    assert.match(
        text,
        /BROKER\.95:\/\/NUEVO-CONTRATO/u
    );
    assert.match(text, /#1 · Primer mensaje/u);
    assert.match(text, /Ruta: Programación/u);
    assert.match(
        text,
        /Lección 1 · Código fuente y programa/u
    );
    assert.match(text, /ai -set 1/u);
    assert.match(text, /ai -read 1/u);
    assert.throws(
        () => formatBrokerLearningContractCreated({
            contract: {
                ...contract,
                contractType:
                    BrokerContractType.CLIENT
            },
            lesson: {
                learningRouteId: "programming",
                routeTitle: "Programación",
                lessonId: "lesson-001",
                lessonOrder: 1,
                lessonTitle:
                    "Código fuente y programa",
                sectionId: "section-001"
            }
        }),
        error =>
            error.code ===
                "BROKER95_LEARNING_TERMINAL_CONTRACT_INVALID"
    );
});

function createCycle(session) {
    return new BrokerContractCycleService({
        gameSession: session,
        contractService: {
            async generate() {
                throw new Error(
                    "Generation is not expected."
                );
            }
        },
        now: () => "accepted-from-terminal"
    });
}

function programming(state) {
    return state.learningProgress.routes.programming;
}

function createMemorySession(initial) {
    let state = initial;

    return {
        async initialize() {
            return Object.freeze({ state });
        },
        getState() {
            return state;
        },
        async transact(transition) {
            state = transition(state);
            return state;
        }
    };
}

function learningNarrative() {
    return {
        title: "Primer mensaje",
        description:
            "Mostrar un mensaje sencillo.",
        requirements: [
            "Mostrar el texto indicado."
        ],
        testCases: [{
            id: "TC-LEARNING",
            kind: "normal",
            requirementIds: ["REQ-1"],
            explanation:
                "Debe mostrar exactamente el mensaje solicitado.",
            stdin: "",
            expected: "HOLA",
            comparison: "exact",
            timeoutMs: 1_000
        }],
        metadata: {
            requirementIds: ["REQ-1"]
        }
    };
}

function clientDraft() {
    const category =
        brokerCategoryCatalog.requireCategory(
            "NUM-ARITH"
        );

    return {
        title: "Suma sencilla",
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        familyId: category.familyId,
        familyName: category.familyName,
        risk: "low",
        description: "Sumar dos valores.",
        requirements: ["Mostrar la suma."],
        testCases: [],
        client: "Cliente local",
        payPotential: 200
    };
}
