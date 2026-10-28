import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER_LEARNING_GAME_POLICY,
    BrokerGameStatus,
    BrokerLearningProgressStatus,
    BrokerRisk,
    acceptBrokerContract,
    addBrokerContract,
    addBrokerLearningContract,
    createBrokerGameState,
    createBrokerLearningRouteView,
    createBrokerPublicGameState,
    createBrokerStatisticsView,
    requireBrokerLearningGamePolicy,
    resetBrokerGameProgress,
    settleBrokerContract,
    startBrokerNewRun
} from "../src/broker95/index.js";
import {
    activateAlgorithmsLesson,
    completeActiveAlgorithmsLesson,
    createAlgorithmsLearningCatalogsFixture,
    createUnlockedAlgorithmsGameState
} from "./fixtures/broker95-algorithms-learning-fixture.js";

test("formaliza aprendizaje como riesgo bajo, alerta cero y Funcionalidad exclusiva", () => {
    const policy =
        requireBrokerLearningGamePolicy();

    assert.equal(
        policy,
        BROKER_LEARNING_GAME_POLICY
    );
    assert.deepEqual(policy, {
        risk: BrokerRisk.LOW,
        alertDelta: 0,
        evaluatedCriteria: [
            "functionality"
        ],
        preserveProgressOnGameOver: true,
        resetProgressOnExplicitReset: true
    });
});

test("integra aprobaciones, fallos y repeticiones en las estadísticas generales", () => {
    let state = addLearningContract(
        createBrokerGameState({
            alertLevel: 10
        }),
        "first"
    );

    state = acceptBrokerContract(state, 1);

    assert.equal(state.alertLevel, 10);
    assert.equal(
        state.status,
        BrokerGameStatus.PLAYING
    );

    state = settleBrokerContract(state, {
        dimensionScores: {
            functionality: 80
        },
        submittedAt: "first-pass"
    });
    state = addLearningContract(
        state,
        "failed-repeat"
    );
    state = acceptBrokerContract(state, 2);
    state = settleBrokerContract(state, {
        dimensionScores: {
            functionality: 59
        },
        submittedAt: "failed-repeat"
    });
    state = addLearningContract(
        state,
        "improved-repeat"
    );
    state = acceptBrokerContract(state, 3);
    state = settleBrokerContract(state, {
        dimensionScores: {
            functionality: 90
        },
        submittedAt: "improved-repeat"
    });

    assert.equal(state.alertLevel, 10);
    assert.deepEqual(state.statistics.byRisk.low, {
        completed: 2,
        failed: 1
    });
    assert.equal(state.statistics.completed, 2);
    assert.equal(state.statistics.failed, 1);
    assert.equal(state.statistics.totalEarned, 10);
    assert.equal(
        state.statistics.familyCompleted.FND,
        2
    );
    assert.deepEqual(
        state.technicalProfile.functionality,
        {
            sum: 229,
            sampleCount: 3,
            score: 76
        }
    );
    assert.equal(
        state.technicalProfile.robustness
            .sampleCount,
        0
    );
    assert.equal(
        state.technicalProfile.design
            .sampleCount,
        0
    );
    assert.deepEqual(
        {
            completed:
                state.categoryHistory[
                    "FND-IO"
                ].completedCount,
            failed:
                state.categoryHistory[
                    "FND-IO"
                ].failedCount
        },
        {
            completed: 2,
            failed: 1
        }
    );

    const view = createBrokerStatisticsView(
        state
    );
    const fundamentals = view.families.find(
        family => family.familyId === "FND"
    );

    assert.equal(view.summary.totalEvaluated, 3);
    assert.equal(view.summary.totalEarned, 10);
    assert.equal(fundamentals.completed, 2);
    assert.equal(fundamentals.failed, 1);
    assert.deepEqual(
        view.technicalProfile.map(item => [
            item.criterion,
            item.sampleCount
        ]),
        [
            ["functionality", 3],
            ["robustness", 0],
            ["design", 0]
        ]
    );
});

test("game over cierra vínculos abiertos pero conserva logros, estadísticas y perfil educativo", () => {
    let state = settleFirstLesson();

    state = addLearningContract(
        state,
        "pending-repeat"
    );
    state = addBrokerContract(
        state,
        clientDraft()
    );
    state = createBrokerGameState({
        ...state,
        alertLevel: 10
    });

    const completedLessons =
        programming(state)
            .completedLessonIds;
    const lessonAttempts =
        programming(state)
            .lessonAttempts;
    const statistics = state.statistics;
    const technicalProfile =
        state.technicalProfile;
    const gameOver = acceptBrokerContract(
        state,
        3
    );

    assert.equal(
        gameOver.status,
        BrokerGameStatus.GAME_OVER
    );
    assert.deepEqual(gameOver.contracts, []);
    assert.deepEqual(
        programming(gameOver)
            .completedLessonIds,
        completedLessons
    );
    assert.deepEqual(
        programming(gameOver)
            .lessonAttempts,
        lessonAttempts
    );
    assert.deepEqual(
        programming(gameOver)
            .lessonContractLinks,
        {}
    );
    assert.equal(
        programming(gameOver)
            .currentLessonId,
        "lesson-002"
    );
    assert.deepEqual(
        gameOver.statistics,
        statistics
    );
    assert.deepEqual(
        gameOver.technicalProfile,
        technicalProfile
    );

    const restarted = startBrokerNewRun(
        gameOver
    );

    assert.equal(
        restarted.status,
        BrokerGameStatus.PLAYING
    );
    assert.equal(restarted.alertLevel, 0);
    assert.deepEqual(
        restarted.learningProgress,
        gameOver.learningProgress
    );
    assert.deepEqual(
        restarted.statistics,
        gameOver.statistics
    );
    assert.deepEqual(
        restarted.technicalProfile,
        gameOver.technicalProfile
    );
});

test("el reset explícito borra partida y aprendizaje pero conserva el historial adaptativo", () => {
    let state = settleFirstLesson();

    state = addLearningContract(
        state,
        "pending-repeat"
    );
    state = createBrokerGameState({
        ...state,
        alertLevel: 7
    });

    const categoryHistory =
        state.categoryHistory;
    const reset = resetBrokerGameProgress(
        state
    );
    const route = createBrokerLearningRouteView(
        programming(reset)
    );

    assert.equal(
        reset.status,
        BrokerGameStatus.PLAYING
    );
    assert.equal(reset.money, 0);
    assert.equal(reset.alertLevel, 0);
    assert.equal(reset.nextContractId, 1);
    assert.deepEqual(reset.contracts, []);
    assert.equal(reset.statistics.completed, 0);
    assert.equal(reset.statistics.failed, 0);
    assert.equal(reset.statistics.totalEarned, 0);
    assert.ok(
        Object.values(reset.technicalProfile)
            .every(bucket =>
                bucket.sampleCount === 0
            )
    );
    assert.deepEqual(
        reset.categoryHistory,
        categoryHistory
    );
    assert.deepEqual(
        programming(reset)
            .completedLessonIds,
        []
    );
    assert.deepEqual(
        programming(reset)
            .completedSectionIds,
        []
    );
    assert.deepEqual(
        programming(reset).lessonAttempts,
        {}
    );
    assert.deepEqual(
        programming(reset)
            .lessonContractLinks,
        {}
    );
    assert.equal(
        programming(reset)
            .learningStartedAt,
        null
    );
    assert.equal(
        programming(reset)
            .learningCompletedAt,
        null
    );
    assert.equal(route.completedLessons, 0);
    assert.equal(route.currentLessonId, "lesson-001");
    assert.equal(
        route.lessons[0].status,
        BrokerLearningProgressStatus.AVAILABLE
    );
    assert.ok(
        route.lessons.slice(1).every(
            lesson =>
                lesson.status ===
                    BrokerLearningProgressStatus.LOCKED
        )
    );
});

test("Algoritmia usa las estadísticas, el saldo y el perfil técnico generales", () => {
    const catalogs =
        createAlgorithmsLearningCatalogsFixture();
    const active = activateAlgorithmsLesson(
        createUnlockedAlgorithmsGameState(
            catalogs
        ),
        "algorithm-lesson-001",
        catalogs
    );
    const state =
        completeActiveAlgorithmsLesson(
            active,
            catalogs,
            { score: 80 }
        );
    const view = createBrokerStatisticsView(
        state,
        { catalogs }
    );
    const publicState = createBrokerPublicGameState(
        state,
        { catalogs }
    );
    const algorithms = view.learningRoutes.find(
        route => route.routeId === "algorithms"
    );

    assert.equal(state.money, 90);
    assert.equal(state.statistics.completed, 1);
    assert.equal(state.statistics.failed, 0);
    assert.equal(state.statistics.totalEarned, 90);
    assert.deepEqual(state.statistics.byRisk.low, {
        completed: 1,
        failed: 0
    });
    assert.equal(
        state.statistics.familyCompleted.FND,
        1
    );
    assert.deepEqual(
        {
            completed:
                state.categoryHistory["FND-ALG"]
                    .completedCount,
            failed:
                state.categoryHistory["FND-ALG"]
                    .failedCount
        },
        { completed: 1, failed: 0 }
    );
    assert.deepEqual(
        state.technicalProfile.functionality,
        {
            sum: 80,
            sampleCount: 1,
            score: 80
        }
    );
    assert.equal(
        state.technicalProfile.robustness
            .sampleCount,
        0
    );
    assert.equal(
        state.technicalProfile.design.sampleCount,
        0
    );
    assert.deepEqual(algorithms, {
        routeId: "algorithms",
        label: "Algoritmia",
        available: true,
        completed: false,
        completedLessons: 1,
        totalLessons: 2,
        progressPercent: 50,
        totalPayout: 90
    });
    assert.deepEqual(
        publicState.statisticsView.learningRoutes,
        view.learningRoutes
    );
});

test("el reset multirruta reinicia Programación y Algoritmia en una sola transición", () => {
    const catalogs =
        createAlgorithmsLearningCatalogsFixture();
    let state = activateAlgorithmsLesson(
        createUnlockedAlgorithmsGameState(
            catalogs
        ),
        "algorithm-lesson-001",
        catalogs
    );

    state = completeActiveAlgorithmsLesson(
        state,
        catalogs,
        { score: 100 }
    );
    state = addBrokerLearningContract(
        state,
        "algorithm-lesson-002",
        {
            title: "Subproblemas pendientes",
            description:
                "Implementar el algoritmo solicitado en CLRS.",
            requirements: [
                "Producir el resultado solicitado."
            ],
            testCases: []
        },
        {
            routeId: "algorithms",
            catalogs,
            createdAt: 40
        }
    );

    const categoryHistory = state.categoryHistory;
    const reset = resetBrokerGameProgress(
        state,
        { catalogs }
    );
    const programmingProgress =
        reset.learningProgress.routes.programming;
    const algorithmsProgress =
        reset.learningProgress.routes.algorithms;

    assert.equal(reset.revision, state.revision + 1);
    assert.equal(reset.money, 0);
    assert.equal(reset.alertLevel, 0);
    assert.deepEqual(reset.contracts, []);
    assert.equal(reset.statistics.completed, 0);
    assert.equal(reset.statistics.totalEarned, 0);
    assert.ok(Object.values(
        reset.technicalProfile
    ).every(bucket => bucket.sampleCount === 0));
    assert.deepEqual(
        reset.categoryHistory,
        categoryHistory
    );
    assert.deepEqual(
        reset.learningProgress.availableRouteIds,
        ["programming"]
    );
    assert.equal(
        programmingProgress.currentLessonId,
        "lesson-001"
    );
    assert.equal(
        algorithmsProgress.currentLessonId,
        "algorithm-lesson-001"
    );

    for (const route of [
        programmingProgress,
        algorithmsProgress
    ]) {
        assert.deepEqual(route.completedLessonIds, []);
        assert.deepEqual(route.lessonAttempts, {});
        assert.deepEqual(route.lessonContractLinks, {});
        assert.equal(route.totalPayout, 0);
        assert.equal(route.learningStartedAt, null);
        assert.equal(route.learningCompletedAt, null);
    }
});

test("game over y nueva partida conservan los logros alcanzados en Algoritmia", () => {
    const catalogs =
        createAlgorithmsLearningCatalogsFixture();
    let state = activateAlgorithmsLesson(
        createUnlockedAlgorithmsGameState(
            catalogs
        ),
        "algorithm-lesson-001",
        catalogs
    );

    state = completeActiveAlgorithmsLesson(
        state,
        catalogs,
        { score: 100 }
    );
    state = addBrokerLearningContract(
        state,
        "algorithm-lesson-002",
        {
            title: "Subproblemas pendientes",
            description:
                "Implementar el algoritmo solicitado en CLRS.",
            requirements: [
                "Producir el resultado solicitado."
            ],
            testCases: []
        },
        {
            routeId: "algorithms",
            catalogs,
            createdAt: 40
        }
    );
    state = addBrokerContract(
        state,
        clientDraft(),
        { catalogs }
    );
    state = createBrokerGameState(
        {
            ...state,
            alertLevel: 10
        },
        { catalogs }
    );

    const achieved =
        state.learningProgress.routes.algorithms;
    const statistics = state.statistics;
    const gameOver = acceptBrokerContract(
        state,
        state.nextContractId - 1,
        { catalogs }
    );

    assert.equal(
        gameOver.status,
        BrokerGameStatus.GAME_OVER
    );
    assert.deepEqual(gameOver.contracts, []);
    assert.deepEqual(
        gameOver.learningProgress.routes
            .algorithms.completedLessonIds,
        achieved.completedLessonIds
    );
    assert.deepEqual(
        gameOver.learningProgress.routes
            .algorithms.lessonAttempts,
        achieved.lessonAttempts
    );
    assert.deepEqual(
        gameOver.learningProgress.routes
            .algorithms.lessonContractLinks,
        {}
    );
    assert.deepEqual(gameOver.statistics, statistics);

    const restarted = startBrokerNewRun(
        gameOver,
        { catalogs }
    );

    assert.equal(
        restarted.status,
        BrokerGameStatus.PLAYING
    );
    assert.deepEqual(
        restarted.learningProgress,
        gameOver.learningProgress
    );
    assert.deepEqual(
        restarted.statistics,
        gameOver.statistics
    );
});

function settleFirstLesson() {
    const pending = addLearningContract(
        createBrokerGameState(),
        "completed"
    );
    const active = acceptBrokerContract(
        pending,
        1
    );

    return settleBrokerContract(active, {
        dimensionScores: {
            functionality: 90
        },
        submittedAt: "completed"
    });
}

function programming(state) {
    return state.learningProgress.routes.programming;
}

function addLearningContract(state, marker) {
    return addBrokerLearningContract(
        state,
        "lesson-001",
        {
            title: `Ejercicio ${marker}`,
            description:
                "Mostrar un mensaje sencillo.",
            requirements: [
                "Mostrar el texto indicado."
            ],
            testCases: []
        },
        { createdAt: marker }
    );
}

function clientDraft() {
    return {
        title: "Contrato de riesgo",
        categoryId: "NUM-ARITH",
        categoryName: "Aritmética",
        familyId: "NUM",
        familyName: "Procesamiento numérico",
        risk: BrokerRisk.MEDIUM,
        description:
            "Resolver una tarea aritmética.",
        requirements: [
            "Mostrar el resultado."
        ],
        client: "Northstar",
        payPotential: 400,
        testCases: []
    };
}
