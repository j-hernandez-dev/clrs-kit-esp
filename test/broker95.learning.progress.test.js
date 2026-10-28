import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER_LEARNING_PASSING_SCORE,
    BROKER_LEARNING_PROGRESS_SCHEMA_VERSION,
    BrokerGameError,
    BrokerLearningAction,
    BrokerLearningProgressStatus,
    assertBrokerLearningProgress,
    createBrokerLearningProgress,
    createBrokerLearningRouteView,
    createInitialBrokerLearningProgress,
    getBrokerLearningAttemptContext,
    linkBrokerLearningContract,
    releaseBrokerLearningContract,
    releaseBrokerLearningContracts,
    resetBrokerLearningProgress,
    resolveBrokerLearningAttempt,
    startBrokerLearningProgress
} from "../src/broker95/index.js";

test("crea la ruta inicial con una sola lección disponible", () => {
    const progress =
        createInitialBrokerLearningProgress();
    const view = createBrokerLearningRouteView(
        progress
    );

    assert.equal(
        progress.schemaVersion,
        BROKER_LEARNING_PROGRESS_SCHEMA_VERSION
    );
    assert.equal(
        progress.currentLessonId,
        "lesson-001"
    );
    assert.deepEqual(
        progress.completedLessonIds,
        []
    );
    assert.deepEqual(
        progress.completedSectionIds,
        []
    );
    assert.equal(view.completedLessons, 0);
    assert.equal(view.totalLessons, 50);
    assert.equal(view.progressPercent, 0);
    assert.equal(view.routeCompleted, false);
    assert.equal(
        view.lessons[0].status,
        BrokerLearningProgressStatus.AVAILABLE
    );
    assert.equal(
        view.lessons[0].action,
        BrokerLearningAction.OBTAIN_CONTRACT
    );
    assert.equal(
        view.lessons.slice(1).every(
            lesson =>
                lesson.status ===
                BrokerLearningProgressStatus.LOCKED
        ),
        true
    );
    assert.equal(
        view.sections[0].status,
        BrokerLearningProgressStatus.AVAILABLE
    );
    assert.equal(
        view.sections.slice(1).every(
            section =>
                section.status ===
                BrokerLearningProgressStatus.LOCKED
        ),
        true
    );
});

test("inicia la ruta una sola vez con un marcador determinista", () => {
    const initial =
        createInitialBrokerLearningProgress();
    const started = startBrokerLearningProgress(
        initial,
        "2026-08-11T10:00:00.000Z"
    );
    const repeated = startBrokerLearningProgress(
        started,
        "2026-08-12T10:00:00.000Z"
    );

    assert.equal(started.revision, 1);
    assert.equal(
        started.learningStartedAt,
        "2026-08-11T10:00:00.000Z"
    );
    assert.equal(repeated, started);
});

test("prepara y vincula el primer intento sin autoridad del Webview", () => {
    const initial =
        createInitialBrokerLearningProgress();
    const context =
        getBrokerLearningAttemptContext(
            initial,
            "lesson-001"
        );
    const linked = linkBrokerLearningContract(
        initial,
        {
            lessonId: "lesson-001",
            contractId: 7,
            createdAt: "2026-08-11T10:00:00.000Z"
        }
    );
    const view = createBrokerLearningRouteView(
        linked
    );

    assert.deepEqual(
        {
            lessonId: context.lessonId,
            sectionId: context.sectionId,
            learningAttempt:
                context.learningAttempt,
            repetition: context.repetition,
            baseReward: context.baseReward,
            effectiveReward:
                context.effectiveReward
        },
        {
            lessonId: "lesson-001",
            sectionId: "section-001",
            learningAttempt: 1,
            repetition: false,
            baseReward: 10,
            effectiveReward: 10
        }
    );
    assert.equal(
        context.accumulatedKnowledge.length,
        8
    );
    assert.deepEqual(
        linked.lessonContractLinks[
            "lesson-001"
        ],
        {
            lessonId: "lesson-001",
            contractId: 7,
            learningAttempt: 1,
            repetition: false
        }
    );
    assert.equal(
        view.lessons[0].action,
        BrokerLearningAction.CONTRACT_OBTAINED
    );
    assert.equal(
        view.lessons[0].canObtainContract,
        false
    );
    assert.equal(
        linked.learningStartedAt,
        "2026-08-11T10:00:00.000Z"
    );
});

test("rechaza saltar lecciones o crear dos contratos para el mismo intento", () => {
    const initial =
        createInitialBrokerLearningProgress();

    assertLearningError(
        () => getBrokerLearningAttemptContext(
            initial,
            "lesson-002"
        ),
        "BROKER95_LEARNING_LESSON_LOCKED"
    );

    const linked = linkAttempt(
        initial,
        "lesson-001",
        1
    );

    assertLearningError(
        () => getBrokerLearningAttemptContext(
            linked,
            "lesson-001"
        ),
        "BROKER95_LEARNING_CONTRACT_ALREADY_LINKED"
    );
});

test("una aprobación completa la lección y desbloquea únicamente la siguiente", () => {
    const linked = linkAttempt(
        createInitialBrokerLearningProgress(),
        "lesson-001",
        1
    );
    const completed =
        resolveBrokerLearningAttempt(
            linked,
            {
                lessonId: "lesson-001",
                contractId: 1,
                score: 75,
                resolvedAt:
                    "2026-08-11T11:00:00.000Z"
            }
        );
    const view = createBrokerLearningRouteView(
        completed
    );

    assert.equal(
        BROKER_LEARNING_PASSING_SCORE,
        60
    );
    assert.deepEqual(
        completed.completedLessonIds,
        ["lesson-001"]
    );
    assert.equal(
        completed.currentLessonId,
        "lesson-002"
    );
    assert.deepEqual(
        completed.lessonAttempts[
            "lesson-001"
        ],
        {
            lessonId: "lesson-001",
            attempts: 1,
            firstCompletionScore: 75,
            bestScore: 75,
            completedAt:
                "2026-08-11T11:00:00.000Z"
        }
    );
    assert.equal(
        completed.lessonContractLinks[
            "lesson-001"
        ],
        undefined
    );
    assert.equal(view.completedLessons, 1);
    assert.equal(view.progressPercent, 2);
    assert.equal(
        view.lessons[0].status,
        BrokerLearningProgressStatus.COMPLETED
    );
    assert.equal(
        view.lessons[1].status,
        BrokerLearningProgressStatus.AVAILABLE
    );
    assert.equal(
        view.lessons[2].status,
        BrokerLearningProgressStatus.LOCKED
    );
});

test("un intento fallido incrementa intentos sin avanzar la ruta", () => {
    const linked = linkAttempt(
        createInitialBrokerLearningProgress(),
        "lesson-001",
        1
    );
    const failed = resolveBrokerLearningAttempt(
        linked,
        {
            lessonId: "lesson-001",
            contractId: 1,
            score: 52,
            resolvedAt:
                "2026-08-11T11:00:00.000Z"
        }
    );
    const view = createBrokerLearningRouteView(
        failed
    );

    assert.deepEqual(
        failed.completedLessonIds,
        []
    );
    assert.equal(
        failed.currentLessonId,
        "lesson-001"
    );
    assert.deepEqual(
        failed.lessonAttempts[
            "lesson-001"
        ],
        {
            lessonId: "lesson-001",
            attempts: 1,
            firstCompletionScore: null,
            bestScore: null,
            completedAt: null
        }
    );
    assert.equal(
        view.lessons[0].action,
        BrokerLearningAction.OBTAIN_CONTRACT
    );
    assert.equal(
        getBrokerLearningAttemptContext(
            failed,
            "lesson-001"
        ).learningAttempt,
        2
    );
});

test("desbloquea una sección únicamente al completar la anterior", () => {
    let progress =
        createInitialBrokerLearningProgress();

    for (let order = 1; order <= 4; order += 1) {
        const lessonId = canonicalLessonId(order);

        progress = linkAttempt(
            progress,
            lessonId,
            order
        );
        progress = resolveAttempt(
            progress,
            lessonId,
            order,
            80
        );
    }

    const view = createBrokerLearningRouteView(
        progress
    );

    assert.deepEqual(
        progress.completedSectionIds,
        ["section-001"]
    );
    assert.equal(
        progress.currentLessonId,
        "lesson-005"
    );
    assert.equal(
        view.sections[0].status,
        BrokerLearningProgressStatus.COMPLETED
    );
    assert.equal(
        view.sections[1].status,
        BrokerLearningProgressStatus.AVAILABLE
    );
    assert.equal(
        view.sections[2].status,
        BrokerLearningProgressStatus.LOCKED
    );
});

test("la repetición conserva la paga potencial y no incrementa el progreso", () => {
    const firstCompletion = completeFirstLesson(
        75
    );
    const context =
        getBrokerLearningAttemptContext(
            firstCompletion,
            "lesson-001"
        );
    const linked = linkAttempt(
        firstCompletion,
        "lesson-001",
        2
    );
    const repeated = resolveAttempt(
        linked,
        "lesson-001",
        2,
        90
    );
    const view = createBrokerLearningRouteView(
        repeated
    );

    assert.equal(context.repetition, true);
    assert.equal(context.baseReward, 10);
    assert.equal(context.effectiveReward, 10);
    assert.deepEqual(
        repeated.completedLessonIds,
        ["lesson-001"]
    );
    assert.equal(
        repeated.currentLessonId,
        "lesson-002"
    );
    assert.deepEqual(
        repeated.lessonAttempts[
            "lesson-001"
        ],
        {
            lessonId: "lesson-001",
            attempts: 2,
            firstCompletionScore: 75,
            bestScore: 90,
            completedAt:
                "event-1-resolved"
        }
    );
    assert.equal(view.completedLessons, 1);
    assert.equal(
        view.lessons[0].action,
        BrokerLearningAction.REPEAT_CONTRACT
    );
});

test("una repetición fallida conserva completado, puntuaciones y desbloqueos", () => {
    const firstCompletion = completeFirstLesson(
        82
    );
    const linked = linkAttempt(
        firstCompletion,
        "lesson-001",
        2
    );
    const repeated = resolveAttempt(
        linked,
        "lesson-001",
        2,
        25
    );

    assert.deepEqual(
        repeated.completedLessonIds,
        ["lesson-001"]
    );
    assert.equal(
        repeated.lessonAttempts[
            "lesson-001"
        ].attempts,
        2
    );
    assert.equal(
        repeated.lessonAttempts[
            "lesson-001"
        ].firstCompletionScore,
        82
    );
    assert.equal(
        repeated.lessonAttempts[
            "lesson-001"
        ].bestScore,
        82
    );
    assert.equal(
        repeated.currentLessonId,
        "lesson-002"
    );
});

test("delete y purge liberan vínculos sin borrar progreso o intentos", () => {
    let progress = completeFirstLesson(75);

    progress = linkAttempt(
        progress,
        "lesson-001",
        10
    );
    progress = linkAttempt(
        progress,
        "lesson-002",
        11
    );

    const afterDelete =
        releaseBrokerLearningContract(
            progress,
            {
                lessonId: "lesson-001",
                contractId: 10
            }
        );
    const afterPurge =
        releaseBrokerLearningContracts(
            afterDelete,
            [11]
        );

    assert.equal(
        afterDelete.lessonContractLinks[
            "lesson-001"
        ],
        undefined
    );
    assert.equal(
        afterDelete.lessonContractLinks[
            "lesson-002"
        ].contractId,
        11
    );
    assert.deepEqual(
        afterPurge.lessonContractLinks,
        {}
    );
    assert.deepEqual(
        afterPurge.completedLessonIds,
        ["lesson-001"]
    );
    assert.equal(
        afterPurge.lessonAttempts[
            "lesson-001"
        ].attempts,
        1
    );
});

test("completar las 50 lecciones cierra la ruta sin crear otra", () => {
    let progress =
        createInitialBrokerLearningProgress();

    for (let order = 1; order <= 50; order += 1) {
        const lessonId = canonicalLessonId(order);

        progress = linkAttempt(
            progress,
            lessonId,
            order
        );
        progress = resolveAttempt(
            progress,
            lessonId,
            order,
            60
        );
    }

    const view = createBrokerLearningRouteView(
        progress
    );

    assert.equal(view.routeCompleted, true);
    assert.equal(view.completedLessons, 50);
    assert.equal(view.progressPercent, 100);
    assert.equal(
        progress.currentLessonId,
        "lesson-050"
    );
    assert.equal(
        progress.learningCompletedAt,
        "event-50-resolved"
    );
    assert.equal(
        progress.completedSectionIds.length,
        8
    );
    assert.equal(
        view.lessons.every(
            lesson =>
                lesson.status ===
                BrokerLearningProgressStatus
                    .COMPLETED &&
                lesson.canOpen
        ),
        true
    );
    assert.equal(
        getBrokerLearningAttemptContext(
            progress,
            "lesson-050"
        ).repetition,
        true
    );
});

test("recalcula campos derivados en lugar de confiar en el estado visual guardado", () => {
    const progress = createBrokerLearningProgress({
        currentLessonId: "lesson-040",
        completedLessonIds: ["lesson-001"],
        completedSectionIds: ["section-008"],
        lessonAttempts: {
            "lesson-001": {
                lessonId: "lesson-001",
                attempts: 1,
                firstCompletionScore: 75,
                bestScore: 75,
                completedAt: "completion"
            }
        },
        learningStartedAt: "start"
    });

    assert.equal(
        progress.currentLessonId,
        "lesson-002"
    );
    assert.deepEqual(
        progress.completedSectionIds,
        []
    );
});

test("rechaza huecos, intentos contradictorios y vínculos sobre lecciones bloqueadas", () => {
    assertLearningError(
        () => createBrokerLearningProgress({
            completedLessonIds: [
                "lesson-002"
            ],
            learningStartedAt: "start"
        }),
        "BROKER95_LEARNING_COMPLETION_SEQUENCE_INVALID"
    );
    assertLearningError(
        () => createBrokerLearningProgress({
            completedLessonIds: [
                "lesson-001"
            ],
            learningStartedAt: "start"
        }),
        "BROKER95_LEARNING_ATTEMPT_STATE_INVALID"
    );
    assertLearningError(
        () => createBrokerLearningProgress({
            lessonContractLinks: {
                "lesson-002": {
                    lessonId: "lesson-002",
                    contractId: 2,
                    learningAttempt: 1,
                    repetition: false
                }
            },
            learningStartedAt: "start"
        }),
        "BROKER95_LEARNING_CONTRACT_LINK_STATE_INVALID"
    );
});

test("rechaza contratos duplicados, puntuaciones y marcadores inválidos", () => {
    assertLearningError(
        () => createBrokerLearningProgress({
            lessonContractLinks: {
                "lesson-001": {
                    lessonId: "lesson-001",
                    contractId: 1,
                    learningAttempt: 1,
                    repetition: false
                },
                "lesson-002": {
                    lessonId: "lesson-002",
                    contractId: 1,
                    learningAttempt: 1,
                    repetition: false
                }
            },
            learningStartedAt: "start"
        }),
        "BROKER95_LEARNING_CONTRACT_LINK_DUPLICATED"
    );

    const linked = linkAttempt(
        createInitialBrokerLearningProgress(),
        "lesson-001",
        1
    );

    assertLearningError(
        () => resolveBrokerLearningAttempt(
            linked,
            {
                lessonId: "lesson-001",
                contractId: 1,
                score: 101,
                resolvedAt: "resolved"
            }
        ),
        "BROKER95_LEARNING_SCORE_INVALID"
    );
    assertLearningError(
        () => startBrokerLearningProgress(
            createInitialBrokerLearningProgress(),
            ""
        ),
        "BROKER95_LEARNING_TRANSITION_MARKER_INVALID"
    );
});

test("reinicia únicamente el dominio educativo y conserva una revisión monotónica", () => {
    const completed = completeFirstLesson(75);
    const reset = resetBrokerLearningProgress(
        completed
    );

    assert.equal(
        reset.revision,
        completed.revision + 1
    );
    assert.equal(
        reset.currentLessonId,
        "lesson-001"
    );
    assert.deepEqual(
        reset.completedLessonIds,
        []
    );
    assert.deepEqual(reset.lessonAttempts, {});
    assert.deepEqual(
        reset.lessonContractLinks,
        {}
    );
    assert.equal(reset.learningStartedAt, null);
    assert.equal(reset.learningCompletedAt, null);
});

test("el estado y todas sus proyecciones permanecen inmutables", () => {
    const progress = completeFirstLesson(75);
    const view = createBrokerLearningRouteView(
        progress
    );

    assert.equal(Object.isFrozen(progress), true);
    assert.equal(
        Object.isFrozen(
            progress.completedLessonIds
        ),
        true
    );
    assert.equal(
        Object.isFrozen(
            progress.lessonAttempts
        ),
        true
    );
    assert.equal(
        Object.isFrozen(
            progress.lessonAttempts[
                "lesson-001"
            ]
        ),
        true
    );
    assert.equal(Object.isFrozen(view), true);
    assert.equal(Object.isFrozen(view.lessons), true);
    assert.equal(Object.isFrozen(view.sections), true);
    assert.throws(
        () => view.lessons.push({}),
        TypeError
    );
    assert.equal(
        assertBrokerLearningProgress(progress),
        progress
    );
});

function completeFirstLesson(score) {
    const linked = linkAttempt(
        createInitialBrokerLearningProgress(),
        "lesson-001",
        1
    );

    return resolveAttempt(
        linked,
        "lesson-001",
        1,
        score
    );
}

function linkAttempt(
    progress,
    lessonId,
    contractId
) {
    return linkBrokerLearningContract(
        progress,
        {
            lessonId,
            contractId,
            createdAt:
                `event-${contractId}-created`
        }
    );
}

function resolveAttempt(
    progress,
    lessonId,
    contractId,
    score
) {
    return resolveBrokerLearningAttempt(
        progress,
        {
            lessonId,
            contractId,
            score,
            resolvedAt:
                `event-${contractId}-resolved`
        }
    );
}

function canonicalLessonId(order) {
    return `lesson-${String(order).padStart(
        3,
        "0"
    )}`;
}

function assertLearningError(operation, code) {
    assert.throws(
        operation,
        error =>
            error instanceof BrokerGameError &&
            error.code === code
    );
}
