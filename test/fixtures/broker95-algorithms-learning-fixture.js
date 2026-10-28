import {
    BrokerLearningRouteId,
    BrokerLearningToolId,
    BrokerTestComparison,
    acceptBrokerContract,
    addBrokerLearningContract,
    brokerLearningCatalog,
    createBrokerGameState,
    createBrokerLearningProgress,
    createInitialBrokerLearningRoutesProgress,
    replaceBrokerLearningRouteProgress,
    settleBrokerContract
} from "../../src/broker95/index.js";

const LESSONS = Object.freeze([
    Object.freeze({
        id: "algorithm-lesson-001",
        sectionId: "algorithm-section-001",
        order: 1,
        title: "Razonamiento verificable",
        objective:
            "Construir un algoritmo sencillo con condiciones verificables.",
        expectedContract:
            "Implementar una secuencia observable con fuerza bruta.",
        explanation: Object.freeze([
            Object.freeze({
                kind: "paragraph",
                text: "Un algoritmo verificable declara condiciones observables."
            })
        ]),
        examples: Object.freeze([
            Object.freeze({
                title: "Secuencia verificable",
                language: "clrs",
                content: "PRINCIPAL()\n    escribir 1",
                explanation: null
            })
        ]),
        comparativeNotes: Object.freeze([]),
        introducedKnowledge: Object.freeze([
            "identificar precondiciones sencillas",
            "verificar postcondiciones observables",
            "aplicar el paradigma de fuerza bruta"
        ]),
        recommendedTools: Object.freeze([
            BrokerLearningToolId.DEBUGGER
        ]),
        familyId: "FND",
        categoryId: "FND-ALG",
        baseReward: 100
    }),
    Object.freeze({
        id: "algorithm-lesson-002",
        sectionId: "algorithm-section-001",
        order: 2,
        title: "Dividir el problema",
        objective:
            "Reconocer una reducción recursiva sencilla.",
        expectedContract:
            "Resolver un caso guiado mediante subproblemas.",
        explanation: Object.freeze([
            Object.freeze({
                kind: "paragraph",
                text: "Dividir un problema produce subproblemas relacionados."
            })
        ]),
        examples: Object.freeze([
            Object.freeze({
                title: "Caso base",
                language: "clrs",
                content: "RESOLVER(n)\n    si n == 0\n        retornar 0",
                explanation: null
            })
        ]),
        comparativeNotes: Object.freeze([]),
        introducedKnowledge: Object.freeze([
            "aplicar divide y conquista",
            "analizar recurrencias"
        ]),
        recommendedTools: Object.freeze([
            BrokerLearningToolId.CALL_STACK
        ]),
        familyId: "FND",
        categoryId: "FND-ALG-RECUR",
        baseReward: 120
    })
]);

const SECTIONS = Object.freeze([
    Object.freeze({
        id: "algorithm-section-001",
        order: 1,
        title: "Fundamentos de algoritmia",
        description:
            "Razonamiento, verificaciÃ³n y descomposiciÃ³n de algoritmos.",
        lessonIds: Object.freeze(
            LESSONS.map(lesson => lesson.id)
        )
    })
]);

export const brokerAlgorithmsLearningCatalogFixture =
    Object.freeze({
        sectionCount: SECTIONS.length,
        lessonCount: LESSONS.length,
        requireLesson(lessonId) {
            const lesson = LESSONS.find(
                item => item.id === lessonId
            );

            if (lesson == null) {
                throw new Error(
                    "Unknown algorithms lesson."
                );
            }

            return lesson;
        },
        listLessons() {
            return LESSONS;
        },
        listSections() {
            return SECTIONS;
        },
        getAccumulatedKnowledge(lessonId) {
            const lesson = this.requireLesson(
                lessonId
            );

            return Object.freeze(
                LESSONS
                    .filter(item =>
                        item.order <= lesson.order
                    )
                    .flatMap(item =>
                        item.introducedKnowledge
                    )
            );
        }
    });

export function createAlgorithmsLearningCatalogsFixture() {
    return Object.freeze({
        [BrokerLearningRouteId.PROGRAMMING]:
            brokerLearningCatalog,
        [BrokerLearningRouteId.ALGORITHMS]:
            brokerAlgorithmsLearningCatalogFixture
    });
}

export function createUnlockedAlgorithmsGameState(
    catalogs =
        createAlgorithmsLearningCatalogsFixture()
) {
    const initial =
        createInitialBrokerLearningRoutesProgress({
            catalogs
        });
    const learningProgress =
        replaceBrokerLearningRouteProgress(
            initial,
            BrokerLearningRouteId.PROGRAMMING,
            completedProgrammingProgress(),
            { catalogs }
        );

    return createBrokerGameState(
        { learningProgress },
        { catalogs }
    );
}

export function activateAlgorithmsLesson(
    state,
    lessonId,
    catalogs =
        createAlgorithmsLearningCatalogsFixture(),
    options = {}
) {
    const pending = addBrokerLearningContract(
        state,
        lessonId,
        learningDraft(lessonId),
        {
            routeId:
                BrokerLearningRouteId.ALGORITHMS,
            catalogs,
            createdAt:
                options.createdAt ?? 10
        }
    );

    return acceptBrokerContract(
        pending,
        pending.nextContractId - 1,
        {
            acceptedAt:
                options.acceptedAt ?? 20,
            catalogs
        }
    );
}

export function completeActiveAlgorithmsLesson(
    state,
    catalogs =
        createAlgorithmsLearningCatalogsFixture(),
    options = {}
) {
    return settleBrokerContract(
        state,
        {
            dimensionScores: {
                functionality:
                    options.score ?? 100
            },
            submittedAt:
                options.submittedAt ?? 30
        },
        { catalogs }
    );
}

function completedProgrammingProgress() {
    const lessons =
        brokerLearningCatalog.listLessons();

    return createBrokerLearningProgress({
        revision: lessons.length,
        completedLessonIds:
            lessons.map(lesson => lesson.id),
        lessonAttempts: Object.fromEntries(
            lessons.map(lesson => [
                lesson.id,
                {
                    lessonId: lesson.id,
                    attempts: 1,
                    firstCompletionScore: 100,
                    bestScore: 100,
                    completedAt:
                        `completed-${lesson.id}`
                }
            ])
        ),
        learningStartedAt: "started",
        learningCompletedAt: "completed"
    });
}

function learningDraft(lessonId) {
    return {
        title: lessonId === "algorithm-lesson-001"
            ? "Pasos verificables"
            : "Subproblemas guiados",
        description:
            "Implementar el algoritmo solicitado en CLRS.",
        requirements: [
            "Producir el resultado solicitado."
        ],
        testCases: [{
            id: "TC-ALGORITHM",
            kind: "normal",
            requirementIds: ["REQ-1"],
            explanation:
                "Comprueba el resultado observable del algoritmo.",
            stdin: "3",
            expected: "6",
            comparison:
                BrokerTestComparison.EXACT,
            timeoutMs: 1_000
        }]
    };
}
