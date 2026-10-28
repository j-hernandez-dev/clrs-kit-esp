import assert from "node:assert/strict";
import test from "node:test";

import {
    BrokerLearningRouteId,
    acceptBrokerContract,
    addBrokerLearningContract,
    brokerLearningCatalog,
    createBrokerLearningProgress,
    createBrokerLearningRouteView,
    createBrokerLearningRoutesProgress,
    createBrokerGameState,
    createInitialBrokerLearningProgress,
    createInitialBrokerLearningRoutesProgress,
    getBrokerLearningRouteProgress,
    isBrokerLearningRouteAvailable,
    linkBrokerLearningContract,
    replaceBrokerLearningRouteProgress,
    resetBrokerLearningRoutesProgress,
    resolveBrokerLearningAttempt,
    settleBrokerContract
} from "../src/broker95/index.js";

test("crea progresos independientes para Programacion y Algoritmia", () => {
    const progress =
        createInitialBrokerLearningRoutesProgress();
    const programming = route(
        progress,
        BrokerLearningRouteId.PROGRAMMING
    );
    const algorithms = route(
        progress,
        BrokerLearningRouteId.ALGORITHMS
    );

    assert.equal(progress.revision, 0);
    assert.deepEqual(
        progress.availableRouteIds,
        [BrokerLearningRouteId.PROGRAMMING]
    );
    assert.equal(
        isBrokerLearningRouteAvailable(
            progress,
            BrokerLearningRouteId.PROGRAMMING
        ),
        true
    );
    assert.equal(
        isBrokerLearningRouteAvailable(
            progress,
            BrokerLearningRouteId.ALGORITHMS
        ),
        false
    );
    assert.equal(
        programming.currentLessonId,
        "lesson-001"
    );
    assert.equal(
        algorithms.currentLessonId,
        null
    );
    assert.deepEqual(
        algorithms.completedLessonIds,
        []
    );
    assert.deepEqual(
        algorithms.lessonAttempts,
        {}
    );
    assert.equal(programming.totalPayout, 0);
    assert.equal(algorithms.totalPayout, 0);
    assert.equal(Object.isFrozen(progress), true);
    assert.equal(Object.isFrozen(progress.routes), true);
    assert.equal(Object.isFrozen(programming), true);
    assert.equal(Object.isFrozen(algorithms), true);
});

test("actualiza Programacion sin alterar el progreso reservado de Algoritmia", () => {
    const initial =
        createInitialBrokerLearningRoutesProgress();
    const algorithmsBefore = route(
        initial,
        BrokerLearningRouteId.ALGORITHMS
    );
    let programming = route(
        initial,
        BrokerLearningRouteId.PROGRAMMING
    );

    programming = linkBrokerLearningContract(
        programming,
        {
            lessonId: "lesson-001",
            contractId: 7,
            createdAt: "created"
        }
    );
    programming = resolveBrokerLearningAttempt(
        programming,
        {
            lessonId: "lesson-001",
            contractId: 7,
            score: 80,
            resolvedAt: "completed"
        }
    );

    const updated =
        replaceBrokerLearningRouteProgress(
            initial,
            BrokerLearningRouteId.PROGRAMMING,
            programming
        );

    assert.equal(
        updated.revision,
        initial.revision + 1
    );
    assert.deepEqual(
        route(
            updated,
            BrokerLearningRouteId.PROGRAMMING
        ).completedLessonIds,
        ["lesson-001"]
    );
    assert.deepEqual(
        route(
            updated,
            BrokerLearningRouteId.PROGRAMMING
        ).lessonAttempts["lesson-001"],
        {
            lessonId: "lesson-001",
            attempts: 1,
            firstCompletionScore: 80,
            bestScore: 80,
            completedAt: "completed"
        }
    );
    assert.equal(
        route(
            updated,
            BrokerLearningRouteId.PROGRAMMING
        ).totalPayout,
        9
    );
    assert.deepEqual(
        route(
            updated,
            BrokerLearningRouteId.ALGORITHMS
        ),
        algorithmsBefore
    );
});

test("rechaza rutas desconocidas y actividad sin catalogo de Algoritmia", () => {
    const progress =
        createInitialBrokerLearningRoutesProgress();

    assert.throws(
        () => getBrokerLearningRouteProgress(
            createInitialBrokerLearningProgress(),
            BrokerLearningRouteId.PROGRAMMING
        ),
        error => error?.code ===
            "BROKER95_LEARNING_ROUTES_PROGRESS_FIELDS_INVALID"
    );
    assert.throws(
        () => getBrokerLearningRouteProgress(
            progress,
            "unknown"
        ),
        error => error?.code ===
            "BROKER95_LEARNING_ROUTE_ID_INVALID"
    );
    assert.throws(
        () => replaceBrokerLearningRouteProgress(
            progress,
            BrokerLearningRouteId.ALGORITHMS,
            {
                ...route(
                    progress,
                    BrokerLearningRouteId.ALGORITHMS
                ),
                currentLessonId: "algorithm-lesson-001"
            }
        ),
        error => error?.code ===
            "BROKER95_LEARNING_ROUTE_NOT_CATALOGED"
    );
});

test("reinicia ambas rutas conservando revisiones monotonicas", () => {
    const initial =
        createInitialBrokerLearningRoutesProgress();
    const reset =
        resetBrokerLearningRoutesProgress(initial);

    assert.equal(reset.revision, 1);
    assert.equal(
        route(
            reset,
            BrokerLearningRouteId.PROGRAMMING
        ).revision,
        route(
            initial,
            BrokerLearningRouteId.PROGRAMMING
        ).revision + 1
    );
    assert.equal(
        route(
            reset,
            BrokerLearningRouteId.ALGORITHMS
        ).revision,
        route(
            initial,
            BrokerLearningRouteId.ALGORITHMS
        ).revision + 1
    );
    assert.equal(
        route(
            reset,
            BrokerLearningRouteId.PROGRAMMING
        ).currentLessonId,
        "lesson-001"
    );
    assert.equal(
        route(
            reset,
            BrokerLearningRouteId.ALGORITHMS
        ).currentLessonId,
        null
    );
    assert.deepEqual(
        route(
            reset,
            BrokerLearningRouteId.PROGRAMMING
        ).completedLessonIds,
        []
    );
});

test("desbloquea Algoritmia si y solo si Programacion esta completa", () => {
    const initial =
        createInitialBrokerLearningRoutesProgress();
    const algorithmsBefore = route(
        initial,
        BrokerLearningRouteId.ALGORITHMS
    );
    const almostComplete =
        replaceBrokerLearningRouteProgress(
            initial,
            BrokerLearningRouteId.PROGRAMMING,
            completedProgrammingProgress(
                brokerLearningCatalog.lessonCount - 1
            )
        );

    assert.equal(
        isBrokerLearningRouteAvailable(
            almostComplete,
            BrokerLearningRouteId.ALGORITHMS
        ),
        false
    );

    const complete =
        replaceBrokerLearningRouteProgress(
            almostComplete,
            BrokerLearningRouteId.PROGRAMMING,
            completedProgrammingProgress(
                brokerLearningCatalog.lessonCount
            )
        );
    const programmingView =
        createBrokerLearningRouteView(
            route(
                complete,
                BrokerLearningRouteId.PROGRAMMING
            )
        );

    assert.deepEqual(
        complete.availableRouteIds,
        [
            BrokerLearningRouteId.PROGRAMMING,
            BrokerLearningRouteId.ALGORITHMS
        ]
    );
    assert.equal(
        isBrokerLearningRouteAvailable(
            complete,
            BrokerLearningRouteId.ALGORITHMS
        ),
        true
    );
    assert.equal(programmingView.routeCompleted, true);
    assert.equal(
        programmingView.lessons.every(
            lesson => lesson.canOpen
        ),
        true
    );
    assert.deepEqual(
        route(
            complete,
            BrokerLearningRouteId.ALGORITHMS
        ),
        algorithmsBefore
    );
});

test("recalcula el desbloqueo sin confiar en disponibilidad persistida", () => {
    const initial =
        createInitialBrokerLearningRoutesProgress();
    const forgedInitial =
        createBrokerLearningRoutesProgress({
            ...initial,
            availableRouteIds: [
                BrokerLearningRouteId.PROGRAMMING,
                BrokerLearningRouteId.ALGORITHMS
            ]
        });

    assert.deepEqual(
        forgedInitial.availableRouteIds,
        [BrokerLearningRouteId.PROGRAMMING]
    );

    const complete =
        replaceBrokerLearningRouteProgress(
            initial,
            BrokerLearningRouteId.PROGRAMMING,
            completedProgrammingProgress(
                brokerLearningCatalog.lessonCount
            )
        );
    const staleComplete =
        createBrokerLearningRoutesProgress({
            ...complete,
            availableRouteIds: [
                BrokerLearningRouteId.PROGRAMMING
            ]
        });

    assert.deepEqual(
        staleComplete.availableRouteIds,
        [
            BrokerLearningRouteId.PROGRAMMING,
            BrokerLearningRouteId.ALGORITHMS
        ]
    );
});

test("la ultima aprobacion desbloquea Algoritmia en la misma transicion", () => {
    const initialProgress =
        createInitialBrokerLearningRoutesProgress();
    const almostComplete =
        replaceBrokerLearningRouteProgress(
            initialProgress,
            BrokerLearningRouteId.PROGRAMMING,
            completedProgrammingProgress(
                brokerLearningCatalog.lessonCount - 1
            )
        );
    let state = createBrokerGameState({
        learningProgress: almostComplete
    });

    state = addBrokerLearningContract(
        state,
        "lesson-050",
        {
            title: "Practica final",
            description:
                "Integrar los fundamentos aprendidos.",
            requirements: [
                "Completar la practica final."
            ],
            testCases: []
        },
        { createdAt: "final-created" }
    );
    state = acceptBrokerContract(
        state,
        state.contracts[0].id,
        { acceptedAt: "final-accepted" }
    );

    const settled = settleBrokerContract(
        state,
        {
            dimensionScores: {
                functionality: 60
            },
            submittedAt: "final-completed"
        }
    );

    assert.equal(settled.activeContractId, null);
    assert.equal(
        route(
            settled.learningProgress,
            BrokerLearningRouteId.PROGRAMMING
        ).learningCompletedAt,
        "final-completed"
    );
    assert.equal(
        isBrokerLearningRouteAvailable(
            settled.learningProgress,
            BrokerLearningRouteId.ALGORITHMS
        ),
        true
    );
    assert.equal(
        route(
            settled.learningProgress,
            BrokerLearningRouteId.ALGORITHMS
        ).learningStartedAt,
        null
    );
    assert.deepEqual(
        route(
            settled.learningProgress,
            BrokerLearningRouteId.ALGORITHMS
        ).lessonContractLinks,
        {}
    );
});

function route(progress, routeId) {
    return getBrokerLearningRouteProgress(
        progress,
        routeId
    );
}

function completedProgrammingProgress(count) {
    const lessons = brokerLearningCatalog
        .listLessons()
        .slice(0, count);
    const routeCompleted =
        count === brokerLearningCatalog.lessonCount;

    return createBrokerLearningProgress({
        revision: count,
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
        learningStartedAt:
            count === 0 ? null : "started",
        learningCompletedAt:
            routeCompleted ? "completed" : null
    });
}
