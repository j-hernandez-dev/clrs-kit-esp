import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    BROKER_LEARNING_PASSING_SCORE,
    assertBrokerLearningProgress,
    createBrokerLearningProgress,
    evolveBrokerLearningProgress,
    getBrokerLearningAttemptContext
} from "./BrokerLearningProgress.js";
import {
    brokerLearningCatalog
} from "./BrokerLearningCatalog.js";

export function startBrokerLearningProgress(
    progress,
    startedAt,
    options = {}
) {
    assertBrokerLearningProgress(
        progress,
        options
    );

    if (progress.learningStartedAt != null) {
        return progress;
    }

    const selectedStartedAt =
        requireMarker(startedAt);

    return evolveBrokerLearningProgress(
        progress,
        {
            learningStartedAt:
                selectedStartedAt
        },
        options
    );
}

export function linkBrokerLearningContract(
    progress,
    {
        lessonId,
        contractId,
        createdAt
    },
    options = {}
) {
    const context =
        getBrokerLearningAttemptContext(
            progress,
            lessonId,
            options
        );
    const selectedContractId =
        requireContractId(contractId);
    const selectedCreatedAt =
        requireMarker(createdAt);

    if (
        Object.values(
            progress.lessonContractLinks
        ).some(
            link =>
                link.contractId ===
                selectedContractId
        )
    ) {
        invalidTransition(
            "BROKER95_LEARNING_CONTRACT_LINK_DUPLICATED",
            [{ contractId: selectedContractId }]
        );
    }

    return evolveBrokerLearningProgress(
        progress,
        {
            learningStartedAt:
                progress.learningStartedAt ??
                selectedCreatedAt,
            lessonContractLinks: {
                ...progress.lessonContractLinks,
                [lessonId]: {
                    lessonId,
                    contractId:
                        selectedContractId,
                    learningAttempt:
                        context.learningAttempt,
                    repetition:
                        context.repetition
                }
            }
        },
        options
    );
}

export function releaseBrokerLearningContract(
    progress,
    {
        lessonId,
        contractId
    },
    options = {}
) {
    assertBrokerLearningProgress(
        progress,
        options
    );
    const link =
        progress.lessonContractLinks[
            lessonId
        ];

    if (
        link == null ||
        link.contractId !==
            requireContractId(contractId)
    ) {
        invalidTransition(
            "BROKER95_LEARNING_CONTRACT_LINK_NOT_FOUND",
            [{ lessonId, contractId }]
        );
    }

    const links = {
        ...progress.lessonContractLinks
    };

    delete links[lessonId];

    return evolveBrokerLearningProgress(
        progress,
        { lessonContractLinks: links },
        options
    );
}

export function releaseBrokerLearningContracts(
    progress,
    contractIds,
    options = {}
) {
    assertBrokerLearningProgress(
        progress,
        options
    );

    if (!Array.isArray(contractIds)) {
        invalidTransition(
            "BROKER95_LEARNING_CONTRACT_IDS_INVALID"
        );
    }

    const selectedIds = new Set(
        contractIds.map(requireContractId)
    );
    const links = Object.fromEntries(
        Object.entries(
            progress.lessonContractLinks
        ).filter(
            ([, link]) =>
                !selectedIds.has(
                    link.contractId
                )
        )
    );

    if (
        Object.keys(links).length ===
        Object.keys(
            progress.lessonContractLinks
        ).length
    ) {
        return progress;
    }

    return evolveBrokerLearningProgress(
        progress,
        { lessonContractLinks: links },
        options
    );
}

export function resolveBrokerLearningAttempt(
    progress,
    {
        lessonId,
        contractId,
        score,
        resolvedAt
    },
    options = {}
) {
    assertBrokerLearningProgress(
        progress,
        options
    );
    const selectedScore = requireScore(score);
    const selectedResolvedAt =
        requireMarker(resolvedAt);
    const link =
        progress.lessonContractLinks[
            lessonId
        ];

    if (
        link == null ||
        link.contractId !==
            requireContractId(contractId)
    ) {
        invalidTransition(
            "BROKER95_LEARNING_CONTRACT_LINK_NOT_FOUND",
            [{ lessonId, contractId }]
        );
    }

    const passed =
        selectedScore >=
        BROKER_LEARNING_PASSING_SCORE;
    const wasCompleted =
        progress.completedLessonIds.includes(
            lessonId
        );
    const previous =
        progress.lessonAttempts[lessonId] ?? {
            lessonId,
            attempts: 0,
            firstCompletionScore: null,
            bestScore: null,
            completedAt: null
        };
    const firstCompletion =
        passed && !wasCompleted;
    const completedLessonIds = firstCompletion
        ? [
            ...progress.completedLessonIds,
            lessonId
        ]
        : progress.completedLessonIds;
    const attempts = {
        ...progress.lessonAttempts,
        [lessonId]: {
            lessonId,
            attempts: previous.attempts + 1,
            firstCompletionScore:
                firstCompletion
                    ? selectedScore
                    : previous
                        .firstCompletionScore,
            bestScore: passed
                ? Math.max(
                    previous.bestScore ??
                        selectedScore,
                    selectedScore
                )
                : previous.bestScore,
            completedAt: firstCompletion
                ? selectedResolvedAt
                : previous.completedAt
        }
    };
    const links = {
        ...progress.lessonContractLinks
    };

    delete links[lessonId];

    const catalog =
        options.catalog ?? brokerLearningCatalog;
    const routeCompleted =
        completedLessonIds.length ===
        catalog.lessonCount;

    return evolveBrokerLearningProgress(
        progress,
        {
            completedLessonIds,
            lessonAttempts: attempts,
            lessonContractLinks: links,
            learningCompletedAt:
                (
                    routeCompleted
                ) &&
                progress.learningCompletedAt == null
                    ? selectedResolvedAt
                    : progress.learningCompletedAt
        },
        options
    );
}

export function resetBrokerLearningProgress(
    progress,
    options = {}
) {
    assertBrokerLearningProgress(
        progress,
        options
    );

    return createBrokerLearningProgress(
        {
            revision: progress.revision + 1
        },
        options
    );
}

function requireScore(value) {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 100
    ) {
        invalidTransition(
            "BROKER95_LEARNING_SCORE_INVALID"
        );
    }

    return value;
}

function requireContractId(value) {
    if (
        !Number.isSafeInteger(value) ||
        value <= 0
    ) {
        invalidTransition(
            "BROKER95_LEARNING_CONTRACT_ID_INVALID",
            [{ contractId: value }]
        );
    }

    return value;
}

function requireMarker(value) {
    if (
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

    invalidTransition(
        "BROKER95_LEARNING_TRANSITION_MARKER_INVALID"
    );
}

function invalidTransition(
    code,
    diagnostics = []
) {
    throw BrokerGameError.invalidRule(
        code,
        "La transición de aprendizaje solicitada no es válida.",
        diagnostics
    );
}
