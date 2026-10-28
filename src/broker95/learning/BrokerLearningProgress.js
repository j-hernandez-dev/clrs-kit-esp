import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    brokerLearningCatalog
} from "./BrokerLearningCatalog.js";
import {
    calculateBrokerPayout
} from "../core/BrokerPaymentRules.js";

export const BROKER_LEARNING_PROGRESS_SCHEMA_VERSION =
    1;

export const BrokerLearningProgressStatus =
    Object.freeze({
        LOCKED: "locked",
        AVAILABLE: "available",
        COMPLETED: "completed"
    });

export const BrokerLearningAction =
    Object.freeze({
        LOCKED: "locked",
        OBTAIN_CONTRACT: "obtain_contract",
        REPEAT_CONTRACT: "repeat_contract",
        CONTRACT_OBTAINED: "contract_obtained"
    });

export const BROKER_LEARNING_PASSING_SCORE = 60;

export function createBrokerLearningProgress(
    source = {},
    options = {}
) {
    if (!isRecord(source)) {
        invalidProgress(
            "BROKER95_LEARNING_PROGRESS_INVALID"
        );
    }

    const catalog = requireLearningCatalog(
        options.catalog ?? brokerLearningCatalog
    );
    const schemaVersion =
        source.schemaVersion ??
        BROKER_LEARNING_PROGRESS_SCHEMA_VERSION;

    if (
        schemaVersion !==
        BROKER_LEARNING_PROGRESS_SCHEMA_VERSION
    ) {
        invalidProgress(
            "BROKER95_LEARNING_PROGRESS_SCHEMA_UNSUPPORTED"
        );
    }

    const completedLessonIds =
        normalizeCompletedLessonIds(
            source.completedLessonIds,
            catalog
        );
    const completedSet = new Set(
        completedLessonIds
    );
    const lessonAttempts =
        normalizeLessonAttempts(
            source.lessonAttempts,
            catalog
        );
    const lessonContractLinks =
        normalizeContractLinks(
            source.lessonContractLinks,
            catalog
        );
    const derived = deriveRouteFacts(
        completedSet,
        catalog
    );
    const totalPayout =
        deriveTotalPayout(
            lessonAttempts,
            catalog
        );
    const learningStartedAt = marker(
        source.learningStartedAt,
        "BROKER95_LEARNING_STARTED_AT_INVALID"
    );
    const learningCompletedAt = marker(
        source.learningCompletedAt,
        "BROKER95_LEARNING_COMPLETED_AT_INVALID"
    );

    requireProgressConsistency({
        completedSet,
        lessonAttempts,
        lessonContractLinks,
        learningStartedAt,
        learningCompletedAt,
        routeCompleted: derived.routeCompleted,
        currentLessonId:
            derived.currentLessonId,
        catalog
    });

    return Object.freeze({
        schemaVersion,
        revision: nonNegativeInteger(
            source.revision ?? 0,
            "BROKER95_LEARNING_REVISION_INVALID"
        ),
        currentLessonId:
            derived.currentLessonId,
        completedLessonIds,
        completedSectionIds:
            derived.completedSectionIds,
        lessonAttempts,
        lessonContractLinks,
        totalPayout,
        learningStartedAt,
        learningCompletedAt
    });
}

export function createInitialBrokerLearningProgress(
    options = {}
) {
    return createBrokerLearningProgress(
        {},
        options
    );
}

export function assertBrokerLearningProgress(
    progress,
    options = {}
) {
    createBrokerLearningProgress(
        progress,
        options
    );

    return progress;
}

export function evolveBrokerLearningProgress(
    progress,
    changes,
    options = {}
) {
    assertBrokerLearningProgress(
        progress,
        options
    );

    return createBrokerLearningProgress(
        {
            ...progress,
            ...changes,
            revision: progress.revision + 1
        },
        options
    );
}

export function createBrokerLearningRouteView(
    progress,
    options = {}
) {
    const catalog = requireLearningCatalog(
        options.catalog ?? brokerLearningCatalog
    );
    const normalized =
        createBrokerLearningProgress(
            progress,
            { catalog }
        );
    const completedSet = new Set(
        normalized.completedLessonIds
    );
    const completedLessons =
        completedSet.size;
    const totalLessons = catalog.lessonCount;
    const lessons = Object.freeze(
        catalog.listLessons().map(lesson =>
            createLessonView({
                lesson,
                progress: normalized,
                completedSet
            })
        )
    );
    const lessonViewById = new Map(
        lessons.map(lesson => [
            lesson.lessonId,
            lesson
        ])
    );
    const sections = Object.freeze(
        catalog.listSections().map(section => {
            const sectionLessons =
                section.lessonIds.map(
                    lessonId =>
                        lessonViewById.get(
                            lessonId
                        )
                );
            const sectionCompleted =
                sectionLessons.every(
                    lesson =>
                        lesson.status ===
                        BrokerLearningProgressStatus
                            .COMPLETED
                );
            const sectionAvailable =
                sectionLessons.some(
                    lesson =>
                        lesson.status !==
                        BrokerLearningProgressStatus
                            .LOCKED
                );

            return Object.freeze({
                sectionId: section.id,
                order: section.order,
                status: sectionCompleted
                    ? BrokerLearningProgressStatus
                        .COMPLETED
                    : sectionAvailable
                        ? BrokerLearningProgressStatus
                            .AVAILABLE
                        : BrokerLearningProgressStatus
                            .LOCKED,
                completedLessons:
                    sectionLessons.filter(
                        lesson =>
                            lesson.completed
                    ).length,
                totalLessons:
                    sectionLessons.length
            });
        })
    );

    return Object.freeze({
        revision: normalized.revision,
        currentLessonId:
            normalized.currentLessonId,
        currentSectionId:
            catalog.requireLesson(
                normalized.currentLessonId
            ).sectionId,
        completedLessons,
        totalLessons,
        progressPercent: Math.round(
            completedLessons /
            totalLessons *
            100
        ),
        routeCompleted:
            completedLessons === totalLessons,
        totalPayout:
            normalized.totalPayout,
        learningStartedAt:
            normalized.learningStartedAt,
        learningCompletedAt:
            normalized.learningCompletedAt,
        sections,
        lessons
    });
}

export function getBrokerLearningAttemptContext(
    progress,
    lessonId,
    options = {}
) {
    const catalog = requireLearningCatalog(
        options.catalog ?? brokerLearningCatalog
    );
    const route = createBrokerLearningRouteView(
        progress,
        { catalog }
    );
    const lessonView = route.lessons.find(
        lesson => lesson.lessonId === lessonId
    );

    if (lessonView == null) {
        invalidProgress(
            "BROKER95_LEARNING_LESSON_NOT_FOUND",
            [{ lessonId }]
        );
    }

    if (
        lessonView.status ===
        BrokerLearningProgressStatus.LOCKED
    ) {
        invalidProgress(
            "BROKER95_LEARNING_LESSON_LOCKED",
            [{ lessonId }]
        );
    }

    if (lessonView.activeContractId != null) {
        invalidProgress(
            "BROKER95_LEARNING_CONTRACT_ALREADY_LINKED",
            [{
                lessonId,
                contractId:
                    lessonView.activeContractId
            }]
        );
    }

    const lesson = catalog.requireLesson(lessonId);
    const repetition = lessonView.completed;

    return Object.freeze({
        lessonId,
        sectionId: lesson.sectionId,
        learningAttempt:
            lessonView.attempts + 1,
        repetition,
        baseReward: lesson.baseReward,
        effectiveReward: lesson.baseReward,
        familyId: lesson.familyId,
        categoryId: lesson.categoryId,
        accumulatedKnowledge:
            catalog.getAccumulatedKnowledge(
                lessonId
            )
    });
}

function createLessonView({
    lesson,
    progress,
    completedSet
}) {
    const completed = completedSet.has(
        lesson.id
    );
    const status = completed
        ? BrokerLearningProgressStatus.COMPLETED
        : lesson.id === progress.currentLessonId
            ? BrokerLearningProgressStatus.AVAILABLE
            : BrokerLearningProgressStatus.LOCKED;
    const attempt =
        progress.lessonAttempts[lesson.id] ??
        emptyLessonAttempt(lesson.id);
    const link =
        progress.lessonContractLinks[lesson.id] ??
        null;
    const action = status ===
        BrokerLearningProgressStatus.LOCKED
        ? BrokerLearningAction.LOCKED
        : link != null
            ? BrokerLearningAction
                .CONTRACT_OBTAINED
            : completed
                ? BrokerLearningAction
                    .REPEAT_CONTRACT
                : BrokerLearningAction
                    .OBTAIN_CONTRACT;

    return Object.freeze({
        lessonId: lesson.id,
        sectionId: lesson.sectionId,
        order: lesson.order,
        status,
        completed,
        attempts: attempt.attempts,
        firstCompletionScore:
            attempt.firstCompletionScore,
        bestScore: attempt.bestScore,
        completedAt: attempt.completedAt,
        activeContractId:
            link?.contractId ?? null,
        learningAttempt:
            link?.learningAttempt ?? null,
        repetition:
            link?.repetition ?? false,
        canOpen:
            status !==
            BrokerLearningProgressStatus.LOCKED,
        canObtainContract:
            status !==
                BrokerLearningProgressStatus.LOCKED &&
            link == null,
        action,
        baseReward: lesson.baseReward,
        effectiveReward: lesson.baseReward
    });
}

function normalizeCompletedLessonIds(
    source = [],
    catalog
) {
    if (!Array.isArray(source)) {
        invalidProgress(
            "BROKER95_LEARNING_COMPLETED_LESSONS_INVALID"
        );
    }

    const orderById = new Map(
        catalog.listLessons().map(lesson => [
            lesson.id,
            lesson.order
        ])
    );
    const values = source.map(lessonId => {
        if (!orderById.has(lessonId)) {
            invalidProgress(
                "BROKER95_LEARNING_COMPLETED_LESSONS_INVALID",
                [{ lessonId }]
            );
        }

        return lessonId;
    });

    if (new Set(values).size !== values.length) {
        invalidProgress(
            "BROKER95_LEARNING_COMPLETED_LESSONS_INVALID"
        );
    }

    values.sort(
        (left, right) =>
            orderById.get(left) -
            orderById.get(right)
    );

    if (
        values.some(
            (lessonId, index) =>
                lessonId !==
                catalog.listLessons()[index].id
        )
    ) {
        invalidProgress(
            "BROKER95_LEARNING_COMPLETION_SEQUENCE_INVALID"
        );
    }

    return Object.freeze(values);
}

function normalizeLessonAttempts(
    source = {},
    catalog
) {
    if (!isRecord(source)) {
        invalidProgress(
            "BROKER95_LEARNING_ATTEMPTS_INVALID"
        );
    }

    const lessonIds = new Set(
        catalog.listLessons().map(
            lesson => lesson.id
        )
    );
    const entries = Object.entries(source)
        .map(([lessonId, value]) => {
            if (!lessonIds.has(lessonId)) {
                invalidProgress(
                    "BROKER95_LEARNING_ATTEMPTS_INVALID",
                    [{ lessonId }]
                );
            }

            const attempt = normalizeLessonAttempt(
                value,
                lessonId
            );

            if (attempt.attempts === 0) {
                invalidProgress(
                    "BROKER95_LEARNING_ATTEMPTS_INVALID",
                    [{ lessonId }]
                );
            }

            return [lessonId, attempt];
        });

    return Object.freeze(
        Object.fromEntries(entries)
    );
}

function normalizeLessonAttempt(
    source,
    expectedLessonId
) {
    if (
        !isRecord(source) ||
        source.lessonId !== expectedLessonId
    ) {
        invalidProgress(
            "BROKER95_LEARNING_ATTEMPT_INVALID"
        );
    }

    return Object.freeze({
        lessonId: expectedLessonId,
        attempts: nonNegativeInteger(
            source.attempts,
            "BROKER95_LEARNING_ATTEMPT_INVALID"
        ),
        firstCompletionScore: score(
            source.firstCompletionScore,
            true
        ),
        bestScore: score(
            source.bestScore,
            true
        ),
        completedAt: marker(
            source.completedAt,
            "BROKER95_LEARNING_ATTEMPT_COMPLETED_AT_INVALID"
        )
    });
}

function normalizeContractLinks(
    source = {},
    catalog
) {
    if (!isRecord(source)) {
        invalidProgress(
            "BROKER95_LEARNING_CONTRACT_LINKS_INVALID"
        );
    }

    const lessonIds = new Set(
        catalog.listLessons().map(
            lesson => lesson.id
        )
    );
    const contractIds = new Set();
    const entries = Object.entries(source)
        .map(([lessonId, value]) => {
            if (
                !lessonIds.has(lessonId) ||
                !isRecord(value) ||
                value.lessonId !== lessonId ||
                typeof value.repetition !==
                    "boolean"
            ) {
                invalidProgress(
                    "BROKER95_LEARNING_CONTRACT_LINK_INVALID"
                );
            }

            const contractId = positiveInteger(
                value.contractId,
                "BROKER95_LEARNING_CONTRACT_LINK_INVALID"
            );

            if (contractIds.has(contractId)) {
                invalidProgress(
                    "BROKER95_LEARNING_CONTRACT_LINK_DUPLICATED"
                );
            }

            contractIds.add(contractId);

            return [
                lessonId,
                Object.freeze({
                    lessonId,
                    contractId,
                    learningAttempt:
                        positiveInteger(
                            value.learningAttempt,
                            "BROKER95_LEARNING_CONTRACT_LINK_INVALID"
                        ),
                    repetition: value.repetition
                })
            ];
        });

    return Object.freeze(
        Object.fromEntries(entries)
    );
}

function requireProgressConsistency({
    completedSet,
    lessonAttempts,
    lessonContractLinks,
    learningStartedAt,
    learningCompletedAt,
    routeCompleted,
    currentLessonId,
    catalog
}) {
    const hasActivity =
        completedSet.size > 0 ||
        Object.keys(lessonAttempts).length > 0 ||
        Object.keys(lessonContractLinks).length > 0;

    if (
        (
            hasActivity &&
            learningStartedAt == null
        ) ||
        routeCompleted !==
            (learningCompletedAt != null)
    ) {
        invalidProgress(
            "BROKER95_LEARNING_TIMELINE_INVALID"
        );
    }

    for (const lesson of catalog.listLessons()) {
        const completed = completedSet.has(
            lesson.id
        );
        const attempt =
            lessonAttempts[lesson.id] ?? null;
        const link =
            lessonContractLinks[lesson.id] ?? null;

        if (
            completed !==
                (attempt?.completedAt != null) ||
            completed !==
                (attempt?.firstCompletionScore != null) ||
            completed !==
                (attempt?.bestScore != null) ||
            (
                completed &&
                (
                    attempt.attempts < 1 ||
                    attempt.firstCompletionScore <
                        BROKER_LEARNING_PASSING_SCORE ||
                    attempt.bestScore <
                        attempt.firstCompletionScore
                )
            ) ||
            (
                !completed &&
                attempt != null &&
                (
                    attempt.firstCompletionScore != null ||
                    attempt.bestScore != null ||
                    attempt.completedAt != null
                )
            )
        ) {
            invalidProgress(
                "BROKER95_LEARNING_ATTEMPT_STATE_INVALID",
                [{ lessonId: lesson.id }]
            );
        }

        if (
            link != null &&
            (
                link.learningAttempt !==
                    (attempt?.attempts ?? 0) + 1 ||
                link.repetition !== completed ||
                (
                    !completed &&
                    lesson.id !== currentLessonId
                )
            )
        ) {
            invalidProgress(
                "BROKER95_LEARNING_CONTRACT_LINK_STATE_INVALID",
                [{ lessonId: lesson.id }]
            );
        }
    }
}

function deriveRouteFacts(completedSet, catalog) {
    const lessons = catalog.listLessons();
    const firstPending = lessons.find(
        lesson => !completedSet.has(lesson.id)
    );
    const routeCompleted = firstPending == null;
    const currentLessonId = routeCompleted
        ? lessons.at(-1).id
        : firstPending.id;
    const completedSectionIds = Object.freeze(
        catalog.listSections()
            .filter(section =>
                section.lessonIds.every(
                    lessonId =>
                        completedSet.has(lessonId)
                )
            )
            .map(section => section.id)
    );

    return {
        routeCompleted,
        currentLessonId,
        completedSectionIds
    };
}

function deriveTotalPayout(
    lessonAttempts,
    catalog
) {
    return Object.values(lessonAttempts)
        .reduce((total, attempt) => {
            if (attempt.bestScore == null) {
                return total;
            }

            const lesson = catalog.requireLesson(
                attempt.lessonId
            );

            return total + calculateBrokerPayout(
                lesson.baseReward,
                attempt.bestScore
            );
        }, 0);
}

function emptyLessonAttempt(lessonId) {
    return {
        lessonId,
        attempts: 0,
        firstCompletionScore: null,
        bestScore: null,
        completedAt: null
    };
}

function requireLearningCatalog(catalog) {
    if (
        catalog == null ||
        typeof catalog.listLessons !== "function" ||
        typeof catalog.listSections !== "function" ||
        typeof catalog.requireLesson !== "function" ||
        typeof catalog.getAccumulatedKnowledge !==
            "function" ||
        !Number.isInteger(catalog.lessonCount) ||
        catalog.lessonCount <= 0
    ) {
        throw new TypeError(
            "Invalid BROKER.95 learning curriculum catalog."
        );
    }

    return catalog;
}

function score(value, nullable) {
    if (value == null && nullable) {
        return null;
    }

    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 100
    ) {
        invalidProgress(
            "BROKER95_LEARNING_SCORE_INVALID"
        );
    }

    return value;
}

function marker(value = null, code) {
    if (
        value == null ||
        (
            typeof value === "string" &&
            value.trim().length > 0
        ) ||
        (
            typeof value === "number" &&
            Number.isFinite(value)
        )
    ) {
        return typeof value === "string"
            ? value.trim()
            : value;
    }

    invalidProgress(code);
}

function positiveInteger(value, code) {
    if (
        !Number.isSafeInteger(value) ||
        value <= 0
    ) {
        invalidProgress(code);
    }

    return value;
}

function nonNegativeInteger(value, code) {
    if (
        !Number.isSafeInteger(value) ||
        value < 0
    ) {
        invalidProgress(code);
    }

    return value;
}

function isRecord(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) ===
            Object.prototype;
}

function invalidProgress(code, diagnostics = []) {
    throw BrokerGameError.invalidRule(
        code,
        "El progreso de aprendizaje de BROKER.95 no es válido.",
        diagnostics
    );
}
