import assert from "node:assert/strict";
import test from "node:test";

import {
    BrokerLearningRouteId,
    brokerLearningCatalog,
    createBrokerLearningProgress,
    createInitialBrokerLearningRoutesProgress,
    getBrokerLearningRouteProgress,
    linkBrokerLearningRouteContract,
    releaseBrokerLearningRouteContract,
    releaseBrokerLearningRouteContracts,
    replaceBrokerLearningRouteProgress,
    resolveBrokerLearningRouteAttempt
} from "../src/broker95/index.js";

test("vincula y libera usando una identidad atomica de ruta, seccion, leccion y contrato", () => {
    const initial =
        createInitialBrokerLearningRoutesProgress();

    assert.throws(
        () => linkBrokerLearningRouteContract(
            initial,
            {
                routeId:
                    BrokerLearningRouteId.PROGRAMMING,
                sectionId: "section-002",
                lessonId: "lesson-001",
                contractId: 1,
                createdAt: "created"
            }
        ),
        error => error?.code ===
            "BROKER95_LEARNING_ROUTE_CONTEXT_MISMATCH"
    );
    assert.deepEqual(
        programming(initial).lessonContractLinks,
        {}
    );

    const linked = linkBrokerLearningRouteContract(
        initial,
        identity({ createdAt: "created" })
    );

    assert.equal(linked.revision, initial.revision + 1);
    assert.equal(
        programming(linked)
            .lessonContractLinks["lesson-001"]
            .contractId,
        1
    );
    assert.throws(
        () => releaseBrokerLearningRouteContract(
            linked,
            identity({
                lessonId: "lesson-002"
            })
        ),
        error => error?.code ===
            "BROKER95_LEARNING_ROUTE_CONTRACT_MISMATCH"
    );

    const released =
        releaseBrokerLearningRouteContract(
            linked,
            identity()
        );

    assert.deepEqual(
        programming(released).lessonContractLinks,
        {}
    );
});

test("rechaza transiciones de Algoritmia mientras la ruta esta bloqueada", () => {
    const initial =
        createInitialBrokerLearningRoutesProgress();

    assert.throws(
        () => linkBrokerLearningRouteContract(
            initial,
            {
                routeId:
                    BrokerLearningRouteId.ALGORITHMS,
                sectionId:
                    "algorithm-section-001",
                lessonId:
                    "algorithm-lesson-001",
                contractId: 1,
                createdAt: "created"
            }
        ),
        error => error?.code ===
            "BROKER95_LEARNING_ROUTE_LOCKED"
    );
    assert.deepEqual(
        initial.routes.algorithms
            .lessonContractLinks,
        {}
    );
});

test("resolver un intento valida toda la identidad antes de avanzar", () => {
    const initial =
        createInitialBrokerLearningRoutesProgress();
    const linked = linkBrokerLearningRouteContract(
        initial,
        identity({ createdAt: "created" })
    );

    assert.throws(
        () => resolveBrokerLearningRouteAttempt(
            linked,
            {
                ...identity(),
                sectionId: "section-002",
                score: 80,
                resolvedAt: "resolved"
            }
        ),
        error => error?.code ===
            "BROKER95_LEARNING_ROUTE_CONTEXT_MISMATCH"
    );
    assert.equal(
        programming(linked)
            .lessonContractLinks["lesson-001"]
            .contractId,
        1
    );

    const resolved =
        resolveBrokerLearningRouteAttempt(
            linked,
            {
                ...identity(),
                score: 80,
                resolvedAt: "resolved"
            }
        );

    assert.deepEqual(
        programming(resolved).completedLessonIds,
        ["lesson-001"]
    );
    assert.deepEqual(
        programming(resolved).lessonContractLinks,
        {}
    );
    assert.equal(
        programming(resolved)
            .lessonAttempts["lesson-001"]
            .bestScore,
        80
    );
    assert.deepEqual(
        resolved.routes.algorithms,
        initial.routes.algorithms
    );
});

test("una liberacion por lote no aplica cambios parciales entre rutas", () => {
    const options = {
        catalogs: {
            [BrokerLearningRouteId.ALGORITHMS]:
                brokerLearningCatalog
        }
    };
    const initial =
        createInitialBrokerLearningRoutesProgress(
            options
        );
    const unlocked =
        replaceBrokerLearningRouteProgress(
            initial,
            BrokerLearningRouteId.PROGRAMMING,
            completedProgrammingProgress(),
            options
        );
    const programmingLinked =
        linkBrokerLearningRouteContract(
            unlocked,
            identity({
                contractId: 10,
                createdAt: "programming-created"
            }),
            options
        );
    const bothLinked =
        linkBrokerLearningRouteContract(
            programmingLinked,
            identity({
                routeId:
                    BrokerLearningRouteId.ALGORITHMS,
                contractId: 20,
                createdAt: "algorithms-created"
            }),
            options
        );

    assert.throws(
        () => releaseBrokerLearningRouteContracts(
            bothLinked,
            [
                identity({ contractId: 10 }),
                identity({
                    routeId:
                        BrokerLearningRouteId.ALGORITHMS,
                    contractId: 99
                })
            ],
            options
        ),
        error => error?.code ===
            "BROKER95_LEARNING_ROUTE_CONTRACT_MISMATCH"
    );
    assert.equal(
        programming(bothLinked, options)
            .lessonContractLinks["lesson-001"]
            .contractId,
        10
    );
    assert.equal(
        algorithms(bothLinked, options)
            .lessonContractLinks["lesson-001"]
            .contractId,
        20
    );

    const released =
        releaseBrokerLearningRouteContracts(
            bothLinked,
            [
                identity({ contractId: 10 }),
                identity({
                    routeId:
                        BrokerLearningRouteId.ALGORITHMS,
                    contractId: 20
                })
            ],
            options
        );

    assert.deepEqual(
        programming(released, options)
            .lessonContractLinks,
        {}
    );
    assert.deepEqual(
        algorithms(released, options)
            .lessonContractLinks,
        {}
    );
});

function identity(overrides = {}) {
    return {
        routeId:
            BrokerLearningRouteId.PROGRAMMING,
        sectionId: "section-001",
        lessonId: "lesson-001",
        contractId: 1,
        ...overrides
    };
}

function programming(progress, options = {}) {
    return getBrokerLearningRouteProgress(
        progress,
        BrokerLearningRouteId.PROGRAMMING,
        options
    );
}

function algorithms(progress, options) {
    return getBrokerLearningRouteProgress(
        progress,
        BrokerLearningRouteId.ALGORITHMS,
        options
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
                    firstCompletionScore: 90,
                    bestScore: 90,
                    completedAt:
                        `completed-${lesson.id}`
                }
            ])
        ),
        learningStartedAt: "started",
        learningCompletedAt: "completed"
    });
}
