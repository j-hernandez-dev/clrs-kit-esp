import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER_LEARNING_CONTRACT_GENERATION_MODE,
    BrokerContractType,
    BrokerLearningContractService,
    BrokerLlmAvailabilityError,
    BrokerLlmStatus,
    BrokerLlmStatusReason,
    BrokerLearningRouteId,
    BrokerRisk,
    brokerLearningCatalog,
    createBrokerGameState,
    createBrokerLearningProgress,
    createInitialBrokerLearningProgress,
    createInitialBrokerLearningRoutesProgress,
    linkBrokerLearningContract,
    replaceBrokerLearningRouteProgress,
    resolveBrokerLearningAttempt
} from "../src/broker95/index.js";

test("obtiene, valida y vincula un contrato educativo en una sola transacción", async () => {
    const session = createMemorySession();
    const llm = createLlm([validDraft()]);
    const service = createService({
        session,
        llm,
        now: () => "created-1"
    });
    const result = await service.obtain({
        lessonId: "lesson-001",
        requestId: "learning:obtain:1"
    });
    const contract = result.contract;

    assert.equal(session.transactions, 1);
    assert.equal(llm.requests.length, 1);
    assert.equal(
        llm.requests[0].input.generationMode,
        BROKER_LEARNING_CONTRACT_GENERATION_MODE
    );
    assert.equal(contract.id, 1);
    assert.equal(
        contract.contractType,
        BrokerContractType.LEARNING
    );
    assert.equal(
        contract.learningRouteId,
        "programming"
    );
    assert.equal(contract.lessonId, "lesson-001");
    assert.equal(contract.sectionId, "section-001");
    assert.equal(contract.learningAttempt, 1);
    assert.equal(contract.risk, BrokerRisk.LOW);
    assert.equal(contract.client, "CIPHER");
    assert.equal(contract.payPotential, 10);
    assert.equal(contract.baseReward, 10);
    assert.equal(contract.createdAt, "created-1");
    assert.deepEqual(
        contract.metadata.requirementIds,
        ["REQ-1"]
    );
    assert.deepEqual(
        contract.metadata.generation,
        {
            generationMode:
                BROKER_LEARNING_CONTRACT_GENERATION_MODE,
            responseId: "response:1",
            providerId: "test-provider",
            model: "modelo-local",
            attempts: 1,
            repaired: false
        }
    );
    assert.deepEqual(
        programming(session.getState())
            .lessonContractLinks["lesson-001"],
        {
            lessonId: "lesson-001",
            contractId: 1,
            learningAttempt: 1,
            repetition: false
        }
    );
    assert.deepEqual(result.lesson, {
        learningRouteId: "programming",
        routeTitle: "Programación",
        lessonId: "lesson-001",
        lessonOrder: 1,
        lessonTitle:
            "Código fuente y programa",
        sectionId: "section-001"
    });
});

test("obtiene un contrato de Algoritmia resolviendo primero su ruta", async () => {
    const catalogs = createRouteCatalogsFixture();
    const initial = createUnlockedAlgorithmsState(
        catalogs
    );
    const session = createMemorySession(initial);
    const llm = createLlm([
        validAlgorithmsDraft()
    ]);
    const service = createService({
        session,
        llm,
        catalogs,
        now: () => "algorithms-created"
    });
    const result = await service.obtain({
        learningRouteId:
            BrokerLearningRouteId.ALGORITHMS,
        lessonId: "algorithm-lesson-001",
        requestId: "learning:algorithms:1"
    });

    assert.equal(llm.requests.length, 1);
    assert.equal(
        llm.requests[0].input.learningRouteId,
        BrokerLearningRouteId.ALGORITHMS
    );
    assert.deepEqual(
        llm.requests[0].input
            .prerequisiteKnowledge,
        [{
            learningRouteId:
                BrokerLearningRouteId
                    .PROGRAMMING,
            knowledge:
                brokerLearningCatalog
                    .getAccumulatedKnowledge(
                        brokerLearningCatalog
                            .listLessons()
                            .at(-1).id
                    )
        }]
    );
    assert.equal(
        result.contract.learningRouteId,
        BrokerLearningRouteId.ALGORITHMS
    );
    assert.deepEqual(result.lesson, {
        learningRouteId: "algorithms",
        routeTitle: "Algoritmia",
        lessonId: "algorithm-lesson-001",
        lessonOrder: 1,
        lessonTitle: "Problema y algoritmo",
        sectionId: "algorithm-section-001"
    });
    assert.equal(
        result.contract.lessonId,
        "algorithm-lesson-001"
    );
    assert.equal(
        result.contract.createdAt,
        "algorithms-created"
    );
    assert.equal(
        session.getState()
            .learningProgress.routes.algorithms
            .lessonContractLinks[
                "algorithm-lesson-001"
            ]
            .contractId,
        result.contract.id
    );
    assert.deepEqual(
        session.getState()
            .learningProgress.routes.programming
            .lessonContractLinks,
        {}
    );
});

test("bloquea Algoritmia y rutas sin catálogo antes de invocar a CIPHER", async () => {
    const catalogs = createRouteCatalogsFixture();
    const blockedSession = createMemorySession(
        createBrokerGameState(
            {
                learningProgress:
                    createInitialBrokerLearningRoutesProgress({
                        catalogs
                    })
            },
            { catalogs }
        )
    );
    const blockedLlm = createLlm([
        validAlgorithmsDraft()
    ]);
    const blockedService = createService({
        session: blockedSession,
        llm: blockedLlm,
        catalogs
    });

    await assert.rejects(
        blockedService.obtain({
            learningRouteId:
                BrokerLearningRouteId.ALGORITHMS,
            lessonId: "algorithm-lesson-001"
        }),
        error => error.code ===
            "BROKER95_LEARNING_ROUTE_LOCKED"
    );
    assert.equal(blockedLlm.requests.length, 0);

    const uncatalogedLlm = createLlm([validDraft()]);
    const uncatalogedService = createService({
        session: createMemorySession(),
        llm: uncatalogedLlm
    });

    await assert.rejects(
        uncatalogedService.obtain({
            learningRouteId:
                BrokerLearningRouteId.ALGORITHMS,
            lessonId: "lesson-001"
        }),
        error => error.code ===
            "BROKER95_LEARNING_ROUTE_NOT_CATALOGED"
    );
    assert.equal(uncatalogedLlm.requests.length, 0);
});

test("repara una sola vez un borrador que exige conocimientos futuros", async () => {
    const session = createMemorySession();
    const invalidDraft = draftWithRequirement(
        "Crear un arreglo con tres valores."
    );
    const llm = createLlm([
        invalidDraft,
        validDraft()
    ]);
    const service = createService({
        session,
        llm
    });
    const result = await service.obtain({
        lessonId: "lesson-001",
        requestId: "learning:repair:1"
    });

    assert.equal(llm.requests.length, 2);
    assert.equal(
        llm.requests[1].requestId,
        "learning:repair:1:repair"
    );
    assert.equal(
        llm.requests[1].input.repair
            .validationCode,
        "BROKER95_LEARNING_CONTRACT_FUTURE_KNOWLEDGE"
    );
    assert.deepEqual(
        llm.requests[1].input.repair
            .previousDraft,
        invalidDraft
    );
    assert.equal(
        result.contract.metadata.generation
            .attempts,
        2
    );
    assert.equal(
        result.contract.metadata.generation
            .repaired,
        true
    );
    assert.equal(
        result.contract.metadata.generation
            .responseId,
        "response:2"
    );
    assert.equal(session.transactions, 1);
});

test("dos borradores inválidos no guardan ni vinculan un contrato", async () => {
    const session = createMemorySession();
    const llm = createLlm([
        draftWithRequirement(
            "Definir una clase para el ejercicio."
        ),
        draftWithRequirement(
            "Resolver el ejercicio mediante recursión."
        )
    ]);
    const service = createService({
        session,
        llm
    });

    await assert.rejects(
        service.obtain({
            lessonId: "lesson-001",
            requestId: "learning:invalid:1"
        }),
        error =>
            error.code ===
            "BROKER95_LEARNING_CONTRACT_FUTURE_KNOWLEDGE"
    );
    assert.equal(llm.requests.length, 2);
    assert.equal(session.transactions, 0);
    assert.equal(
        session.getState().contracts.length,
        0
    );
    assert.deepEqual(
        programming(session.getState())
            .lessonContractLinks,
        {}
    );
});

test("repara una sola vez un borrador teórico que no propone programar en CLRS", async () => {
    const session = createMemorySession();
    const invalidDraft = draftWithRequirement(
        "Explicar el concepto de instrucción."
    );
    const llm = createLlm([
        invalidDraft,
        validDraft()
    ]);
    const service = createService({
        session,
        llm
    });
    const result = await service.obtain({
        lessonId: "lesson-001",
        requestId: "learning:curriculum-repair:1"
    });

    assert.equal(llm.requests.length, 2);
    assert.equal(
        llm.requests[1].input.repair.validationCode,
        "BROKER95_LEARNING_CONTRACT_CURRICULUM_NOT_PROGRAMMABLE"
    );
    assert.deepEqual(
        llm.requests[1].input.repair.previousDraft,
        invalidDraft
    );
    assert.equal(
        result.contract.metadata.generation.attempts,
        2
    );
    assert.equal(
        result.contract.metadata.generation.repaired,
        true
    );
    assert.equal(session.transactions, 1);
});

test("CIPHER no disponible deja la lección habilitada y el estado intacto", async () => {
    const session = createMemorySession();
    const llm = createLlm([validDraft()]);
    const service = createService({
        session,
        llm,
        availability: unavailableAvailability()
    });

    await assert.rejects(
        service.obtain({
            lessonId: "lesson-001"
        }),
        error =>
            error instanceof
                BrokerLlmAvailabilityError &&
            error.code ===
                "BROKER95_LLM_MODEL_MISSING"
    );
    assert.equal(llm.requests.length, 0);
    assert.equal(session.transactions, 0);
    assert.deepEqual(
        programming(session.getState())
            .lessonContractLinks,
        {}
    );
});

test("rechaza lecciones bloqueadas o vinculadas antes de tocar CIPHER", async () => {
    const session = createMemorySession();
    const llm = createLlm([validDraft()]);
    const service = createService({
        session,
        llm
    });

    await assert.rejects(
        service.obtain({
            lessonId: "lesson-002"
        }),
        error =>
            error.code ===
            "BROKER95_LEARNING_LESSON_LOCKED"
    );

    await service.obtain({
        lessonId: "lesson-001",
        requestId: "learning:linked:1"
    });

    await assert.rejects(
        service.obtain({
            lessonId: "lesson-001",
            requestId: "learning:linked:2"
        }),
        error =>
            error.code ===
            "BROKER95_LEARNING_CONTRACT_ALREADY_LINKED"
    );
    assert.equal(llm.requests.length, 1);
    assert.equal(session.transactions, 1);
});

test("una repetición usa el intento siguiente y conserva la paga potencial completa", async () => {
    const progress = completeFirstLesson();
    const session = createMemorySession(
        createBrokerGameState({
            learningProgress:
                withProgrammingProgress(
                    progress
                )
        })
    );
    const llm = createLlm([
        draftWithRequirement(
            "Mostrar un segundo mensaje sencillo."
        )
    ]);
    const service = createService({
        session,
        llm
    });
    const result = await service.obtain({
        lessonId: "lesson-001"
    });

    assert.equal(
        result.contract.learningAttempt,
        2
    );
    assert.equal(result.contract.baseReward, 10);
    assert.equal(
        result.contract.effectiveReward,
        10
    );
    assert.equal(result.contract.payPotential, 10);
    assert.equal(
        programming(session.getState())
            .lessonContractLinks["lesson-001"]
            .repetition,
        true
    );
});

test("una solicitud correlacionada genera y persiste exactamente una vez", async () => {
    const session = createMemorySession();
    const llm = createLlm([validDraft()]);
    const service = createService({
        session,
        llm
    });
    const options = {
        lessonId: "lesson-001",
        requestId: "learning:idempotent:1"
    };
    const [first, duplicate] =
        await Promise.all([
            service.obtain(options),
            service.obtain(options)
        ]);

    assert.equal(first, duplicate);
    assert.equal(llm.requests.length, 1);
    assert.equal(session.transactions, 1);
    assert.equal(
        session.getState().contracts.length,
        1
    );
    assert.equal(
        await service.obtain(options),
        first
    );

    await assert.rejects(
        service.obtain({
            lessonId: "lesson-002",
            requestId: options.requestId
        }),
        error =>
            error.code ===
            "BROKER95_OPERATION_IDEMPOTENCY_CONFLICT"
    );
    await assert.rejects(
        service.obtain({
            learningRouteId:
                BrokerLearningRouteId.ALGORITHMS,
            lessonId: "lesson-001",
            requestId: options.requestId
        }),
        error =>
            error.code ===
            "BROKER95_OPERATION_IDEMPOTENCY_CONFLICT"
    );
});

function createService({
    session,
    llm,
    availability = readyAvailability(),
    now = () => 1_234,
    catalogs
}) {
    return new BrokerLearningContractService({
        gameSession: session,
        llm,
        availability,
        catalogs,
        now,
        createRequestId: () =>
            "learning:generated"
    });
}

function createRouteCatalogsFixture() {
    const algorithmsCatalog =
        createAlgorithmsCatalogFixture();

    return Object.freeze({
        [BrokerLearningRouteId.PROGRAMMING]:
            brokerLearningCatalog,
        [BrokerLearningRouteId.ALGORITHMS]:
            algorithmsCatalog
    });
}

function createAlgorithmsCatalogFixture() {
    const lesson = Object.freeze({
        id: "algorithm-lesson-001",
        sectionId: "algorithm-section-001",
        order: 1,
        title: "Problema y algoritmo",
        objective:
            "Distinguir un problema de un algoritmo mediante una solución ejecutable.",
        expectedContract:
            "Implementar una secuencia ordenada de pasos que produzca un resultado observable.",
        introducedKnowledge: Object.freeze([
            "distinguir problema y algoritmo",
            "representar una solución mediante pasos ordenados"
        ]),
        recommendedTools: Object.freeze([]),
        familyId: "FND",
        categoryId: "FND-ALG",
        baseReward: 100
    });
    const section = Object.freeze({
        id: "algorithm-section-001",
        order: 1,
        title: "Fundamentos de algoritmia",
        lessonIds: Object.freeze([lesson.id])
    });

    return Object.freeze({
        lessonCount: 1,
        requireLesson(lessonId) {
            if (lessonId !== lesson.id) {
                throw new Error(
                    "Unknown algorithms lesson."
                );
            }

            return lesson;
        },
        listLessons() {
            return Object.freeze([lesson]);
        },
        listSections() {
            return Object.freeze([section]);
        },
        getAccumulatedKnowledge(lessonId) {
            this.requireLesson(lessonId);

            return lesson.introducedKnowledge;
        }
    });
}

function createUnlockedAlgorithmsState(catalogs) {
    const lessons = brokerLearningCatalog
        .listLessons();
    const programming = createBrokerLearningProgress(
        {
            revision: lessons.length,
            completedLessonIds:
                lessons.map(lesson => lesson.id),
            lessonAttempts: Object.fromEntries(
                lessons.map(lesson => [
                    lesson.id,
                    {
                        lessonId: lesson.id,
                        attempts: 1,
                        firstCompletionScore: 90,
                        bestScore: 90,
                        completedAt:
                            `completed-${lesson.id}`
                    }
                ])
            ),
            learningStartedAt: "started",
            learningCompletedAt: "completed"
        },
        { catalog: brokerLearningCatalog }
    );
    const initial =
        createInitialBrokerLearningRoutesProgress({
            catalogs
        });
    const learningProgress =
        replaceBrokerLearningRouteProgress(
            initial,
            BrokerLearningRouteId.PROGRAMMING,
            programming,
            { catalogs }
        );

    return createBrokerGameState(
        { learningProgress },
        { catalogs }
    );
}

function createMemorySession(
    initial = createBrokerGameState()
) {
    let state = initial;

    return {
        transactions: 0,
        async initialize() {
            return Object.freeze({ state });
        },
        getState() {
            return state;
        },
        async transact(transition) {
            this.transactions += 1;
            state = transition(state);

            return state;
        }
    };
}

function programming(state) {
    return state.learningProgress.routes.programming;
}

function withProgrammingProgress(progress) {
    return replaceBrokerLearningRouteProgress(
        createInitialBrokerLearningRoutesProgress(),
        BrokerLearningRouteId.PROGRAMMING,
        progress
    );
}

function createLlm(outputs) {
    return {
        requests: [],
        async generateContract(request) {
            this.requests.push(request);
            const index = this.requests.length - 1;

            return Object.freeze({
                output: outputs[index],
                responseId: `response:${index + 1}`,
                providerId: "test-provider",
                model: "modelo-local"
            });
        }
    };
}

function readyAvailability() {
    return {
        getSnapshot() {
            return Object.freeze({
                settings: Object.freeze({
                    model: "modelo-local",
                    hasApiKey: true
                }),
                llmStatus: Object.freeze({
                    status: BrokerLlmStatus.READY,
                    reason:
                        BrokerLlmStatusReason.READY,
                    message:
                        "CIPHER está configurado."
                })
            });
        }
    };
}

function unavailableAvailability() {
    return {
        getSnapshot() {
            return Object.freeze({
                settings: Object.freeze({
                    model: "",
                    hasApiKey: false
                }),
                llmStatus: Object.freeze({
                    status:
                        BrokerLlmStatus
                            .UNCONFIGURED,
                    reason:
                        BrokerLlmStatusReason
                            .MODEL_MISSING,
                    message:
                        "CIPHER DESCONECTADO"
                })
            });
        }
    };
}

function completeFirstLesson() {
    let progress =
        createInitialBrokerLearningProgress();

    progress = linkBrokerLearningContract(
        progress,
        {
            lessonId: "lesson-001",
            contractId: 99,
            createdAt: "created-old"
        }
    );

    return resolveBrokerLearningAttempt(
        progress,
        {
            lessonId: "lesson-001",
            contractId: 99,
            score: 90,
            resolvedAt: "resolved-old"
        }
    );
}

function validDraft() {
    return {
        title: "Mensaje de bienvenida",
        description:
            "Produce una salida básica para comprobar la primera instrucción.",
        requirements: [
            "Mostrar el mensaje Hola."
        ],
        testCases: [{
            id: "TC-1",
            kind: "normal",
            requirementIds: ["REQ-1"],
            explanation:
                "Comprueba que el mensaje esperado se muestra.",
            stdin: "",
            expected: "Hola\n",
            comparison: "exact",
            timeoutMs: 1_000
        }]
    };
}

function validAlgorithmsDraft() {
    return {
        title: "Secuencia de pasos",
        description:
            "Implementa en CLRS una secuencia ordenada que produzca un resultado observable.",
        requirements: [
            "Mostrar los números 1, 2 y 3 en ese orden."
        ],
        testCases: [{
            id: "TC-ALG-1",
            kind: "normal",
            requirementIds: ["REQ-1"],
            explanation:
                "Comprueba el resultado de la secuencia.",
            stdin: "",
            expected: "1\n2\n3\n",
            comparison: "exact",
            timeoutMs: 1_000
        }]
    };
}

function draftWithRequirement(requirement) {
    return {
        ...validDraft(),
        requirements: [requirement]
    };
}
