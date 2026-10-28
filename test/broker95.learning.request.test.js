import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER_LEARNING_CONTRACT_GENERATION_MODE,
    BrokerLLMOperation,
    BrokerLearningContractSimplicity,
    BrokerLearningRouteId,
    BrokerLearningToolId,
    brokerLearningCatalog,
    createBrokerLLMStructuredResponseDefinition,
    createBrokerLLMSystemInstruction,
    createBrokerLearningCurricularContext,
    createBrokerLearningContractGenerationRequest,
    createGenerateContractRequest,
    createInitialBrokerLearningProgress,
    createInitialBrokerLearningRoutesProgress,
    linkBrokerLearningContract,
    replaceBrokerLearningRouteProgress,
    resolveBrokerLearningAttempt
} from "../src/broker95/index.js";

test("prepara la solicitud curricular compacta sin filtrar estado ni recompensa", () => {
    const progress =
        createInitialBrokerLearningProgress();
    const lesson = brokerLearningCatalog
        .requireLesson("lesson-001");
    const request = learningRequest(
        progress,
        lesson.id
    );

    assert.deepEqual(
        Object.keys(request.input),
        [
            "generationMode",
            "learningRouteId",
            "difficulty",
            "category",
            "lessonObjective",
            "expectedPractice",
            "prerequisiteKnowledge",
            "accumulatedRouteKnowledge",
            "forbiddenFutureKnowledge",
            "pedagogicalDifficulty",
            "optionalTools",
            "simplicity",
            "clientPolicy",
            "responseShape"
        ]
    );
    assert.equal(
        request.input.generationMode,
        BROKER_LEARNING_CONTRACT_GENERATION_MODE
    );
    assert.equal(request.input.difficulty, "easy");
    assert.equal(
        request.input.learningRouteId,
        BrokerLearningRouteId.PROGRAMMING
    );
    assert.equal(
        request.input.category.familyId,
        "FND"
    );
    assert.equal(
        request.input.category.categoryId,
        lesson.categoryId
    );
    assert.equal(
        request.input.lessonObjective,
        lesson.objective
    );
    assert.deepEqual(
        request.input.accumulatedRouteKnowledge,
        brokerLearningCatalog
            .getAccumulatedKnowledge(lesson.id)
    );
    assert.equal(
        request.input.expectedPractice,
        lesson.expectedContract
    );
    assert.notEqual(
        request.input.expectedPractice,
        request.input.lessonObjective
    );
    assert.deepEqual(
        request.input.prerequisiteKnowledge,
        []
    );
    assert.equal(
        request.input.forbiddenFutureKnowledge
            .length > 0,
        true
    );
    assert.deepEqual(
        request.input.optionalTools,
        []
    );
    assert.equal(
        request.input.simplicity,
        BrokerLearningContractSimplicity
            .VERY_HIGH
    );
    assert.equal(
        request.input.clientPolicy,
        "anonymous"
    );
    assert.deepEqual(
        request.input.responseShape.required,
        [
            "title",
            "description",
            "requirements",
            "testCases"
        ]
    );
    assert.deepEqual(request.conversation, []);
    assert.equal(request.stream, false);
    assert.deepEqual(
        request.context.risk.activeCriteria,
        ["functionality"]
    );
    assert.equal(
        request.context.pedagogy
            .exerciseHistoryIncluded,
        false
    );
    assert.deepEqual(
        request.context.pedagogy.toolPolicy,
        {
            recommendationOnly: true,
            contractRequirementForbidden: true,
            testRequirementForbidden: true,
            evaluationImpact: "none"
        }
    );
    assert.equal(
        request.context.constraints
            .noFutureKnowledge,
        true
    );
    assert.equal(
        request.context.constraints
            .noPaymentAuthority,
        true
    );

    for (const forbidden of [
        "baseReward",
        "effectiveReward",
        "payPotential",
        "learningAttempt",
        "repetition",
        "contracts",
        "history",
        "balance",
        "alert"
    ]) {
        assert.equal(
            containsKey(request, forbidden),
            false,
            `La solicitud no debe contener ${forbidden}.`
        );
    }

    assert.equal(Object.isFrozen(request), true);
    assert.equal(
        Object.isFrozen(
            request.input
                .accumulatedRouteKnowledge
        ),
        true
    );
});

test("calcula los conocimientos desde la ruta en lugar de recibirlos del consumidor", () => {
    let progress =
        createInitialBrokerLearningProgress();

    progress = completeLesson(
        progress,
        "lesson-001",
        1
    );

    const request = learningRequest(
        progress,
        "lesson-002"
    );

    assert.deepEqual(
        request.input.accumulatedRouteKnowledge,
        brokerLearningCatalog
            .getAccumulatedKnowledge("lesson-002")
    );
    assert.equal(
        request.input
            .accumulatedRouteKnowledge.length >
            brokerLearningCatalog
                .getAccumulatedKnowledge("lesson-001")
                .length,
        true
    );
});

test("la solicitud atraviesa el puerto neutral con esquema estructurado compartido", () => {
    const source = learningRequest(
        createInitialBrokerLearningProgress(),
        "lesson-001"
    );
    const request = createGenerateContractRequest(
        source
    );
    const structured =
        createBrokerLLMStructuredResponseDefinition(
            request
        );
    const instruction =
        createBrokerLLMSystemInstruction(
            request
        );

    assert.equal(
        request.operation,
        BrokerLLMOperation.GENERATE_CONTRACT
    );
    assert.equal(
        request.input.generationMode,
        BROKER_LEARNING_CONTRACT_GENERATION_MODE
    );
    assert.equal(
        structured.name,
        "broker95_contract_draft"
    );
    assert.equal(
        Object.hasOwn(
            structured.schema.properties,
            "client"
        ),
        false
    );
    assert.match(
        instruction,
        /complete authoritative list of concepts/u
    );
    assert.match(
        instruction,
        /union of input\.prerequisiteKnowledge/u
    );
    assert.match(
        instruction,
        /Never require opening or using a tool/u
    );
    assert.match(
        instruction,
        /Equivalent or nearly identical variants are welcome/u
    );
    assert.match(
        instruction,
        /assignment uses = and equality comparison uses ==/u
    );
});

test("rechaza preparar contratos para lecciones bloqueadas o ya vinculadas", () => {
    const initial =
        createInitialBrokerLearningProgress();

    assert.throws(
        () => learningRequest(
            initial,
            "lesson-002"
        ),
        error =>
            error.code ===
            "BROKER95_LEARNING_LESSON_LOCKED"
    );

    const linked = linkBrokerLearningContract(
        initial,
        {
            lessonId: "lesson-001",
            contractId: 1,
            createdAt: "created-1"
        }
    );

    assert.throws(
        () => learningRequest(
            linked,
            "lesson-001"
        ),
        error =>
            error.code ===
            "BROKER95_LEARNING_CONTRACT_ALREADY_LINKED"
    );
});

test("la reparación conserva las mismas fronteras pedagógicas", () => {
    const request =
        createBrokerLearningContractGenerationRequest({
            requestId: "learning:lesson-001:repair",
            model: "modelo-local",
            learningProgress:
                toRoutesProgress(
                    createInitialBrokerLearningProgress()
                ),
            learningRouteId:
                BrokerLearningRouteId.PROGRAMMING,
            lessonId: "lesson-001",
            repair: {
                attempt: 2,
                validationCode:
                    "BROKER95_CONTRACT_DRAFT_FIELDS_INVALID",
                previousDraft: {
                    title: "Borrador",
                    risk: "extreme",
                    payPotential: 9_999
                }
            }
        });

    assert.equal(
        request.input.repair.attempt,
        2
    );
    assert.equal(
        request.input.difficulty,
        "easy"
    );
    assert.deepEqual(
        request.context.risk.activeCriteria,
        ["functionality"]
    );
    assert.equal(
        Object.hasOwn(
            request.context,
            "previousDraft"
        ),
        false
    );
});

test("comparte la frontera curricular con Algoritmia y conserva las herramientas opcionales", () => {
    const algorithmsCatalog =
        createAlgorithmsCatalogFixture();
    const context =
        createBrokerLearningCurricularContext(
            {
                learningRouteId:
                    BrokerLearningRouteId
                        .ALGORITHMS,
                lessonId: "lesson-001"
            },
            {
                catalogs: {
                    [BrokerLearningRouteId
                        .PROGRAMMING]:
                        brokerLearningCatalog,
                    [BrokerLearningRouteId
                        .ALGORITHMS]:
                        algorithmsCatalog
                }
            }
        );

    assert.equal(
        context.lesson.expectedPractice,
        "Representar una decision sencilla como un algoritmo ejecutable."
    );
    assert.equal(
        context.prerequisiteKnowledge[0]
            .learningRouteId,
        BrokerLearningRouteId.PROGRAMMING
    );
    assert.deepEqual(
        context.accumulatedRouteKnowledge,
        ["distinguir problema y algoritmo"]
    );
    assert.deepEqual(
        context.forbiddenFutureKnowledge,
        ["analizar el costo de un algoritmo"]
    );
    assert.deepEqual(
        context.optionalTools.map(tool =>
            tool.id
        ),
        [BrokerLearningToolId.FLOWCHART]
    );
    assert.equal(
        context.toolPolicy
            .contractRequirementForbidden,
        true
    );
});

test("Programacion usa la frontera comun y respeta sus recomendaciones curriculares", () => {
    assert.deepEqual(
        brokerLearningCatalog.requireLesson(
            "lesson-001"
        ).recommendedTools,
        []
    );
    assert.deepEqual(
        brokerLearningCatalog.requireLesson(
            "lesson-003"
        ).recommendedTools,
        [BrokerLearningToolId.EXECUTION_TRACE]
    );

    const request = learningRequest(
        createInitialBrokerLearningProgress(),
        "lesson-001"
    );

    assert.deepEqual(
        request.input.optionalTools,
        []
    );
    assert.deepEqual(
        request.input.prerequisiteKnowledge,
        []
    );
});

function learningRequest(progress, lessonId) {
    return createBrokerLearningContractGenerationRequest({
        requestId: `learning:${lessonId}`,
        model: "modelo-local",
        learningProgress:
            toRoutesProgress(progress),
        learningRouteId:
            BrokerLearningRouteId.PROGRAMMING,
        lessonId
    });
}

function toRoutesProgress(programmingProgress) {
    return replaceBrokerLearningRouteProgress(
        createInitialBrokerLearningRoutesProgress(),
        BrokerLearningRouteId.PROGRAMMING,
        programmingProgress
    );
}

function completeLesson(
    progress,
    lessonId,
    contractId
) {
    const linked = linkBrokerLearningContract(
        progress,
        {
            lessonId,
            contractId,
            createdAt: `created-${contractId}`
        }
    );

    return resolveBrokerLearningAttempt(
        linked,
        {
            lessonId,
            contractId,
            score: 90,
            resolvedAt: `resolved-${contractId}`
        }
    );
}

function containsKey(value, expected) {
    if (
        value == null ||
        typeof value !== "object"
    ) {
        return false;
    }

    return Object.entries(value).some(
        ([key, child]) =>
            key === expected ||
            containsKey(child, expected)
    );
}

function createAlgorithmsCatalogFixture() {
    const lessons = Object.freeze([
        Object.freeze({
            id: "lesson-001",
            sectionId: "section-001",
            order: 1,
            title: "Problema y algoritmo",
            objective:
                "Distinguir un problema de su procedimiento de solucion.",
            expectedContract:
                "Representar una decision sencilla como un algoritmo ejecutable.",
            introducedKnowledge: Object.freeze([
                "distinguir problema y algoritmo"
            ]),
            recommendedTools: Object.freeze([
                BrokerLearningToolId.FLOWCHART
            ]),
            familyId: "FND",
            categoryId: "FND-ALG"
        }),
        Object.freeze({
            id: "lesson-002",
            sectionId: "section-001",
            order: 2,
            title: "Costo",
            objective:
                "Reconocer el costo de un algoritmo.",
            expectedContract:
                "Comparar dos recorridos.",
            introducedKnowledge: Object.freeze([
                "analizar el costo de un algoritmo"
            ]),
            recommendedTools: Object.freeze([]),
            familyId: "FND",
            categoryId: "FND-ALG-ANALY"
        })
    ]);
    const accumulated = new Map([
        ["lesson-001", Object.freeze([
            "distinguir problema y algoritmo"
        ])],
        ["lesson-002", Object.freeze([
            "distinguir problema y algoritmo",
            "analizar el costo de un algoritmo"
        ])]
    ]);

    return Object.freeze({
        requireLesson(lessonId) {
            const lesson = lessons.find(
                candidate =>
                    candidate.id === lessonId
            );

            if (lesson == null) {
                throw new Error("Unknown lesson.");
            }

            return lesson;
        },
        listLessons() {
            return lessons;
        },
        getAccumulatedKnowledge(lessonId) {
            return accumulated.get(lessonId);
        }
    });
}
