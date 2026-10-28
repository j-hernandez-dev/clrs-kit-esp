import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    brokerLearningCatalog
} from "./BrokerLearningCatalog.js";
import {
    getBrokerLearningAttemptContext
} from "./BrokerLearningProgress.js";
import {
    linkBrokerLearningContract,
    releaseBrokerLearningContract,
    releaseBrokerLearningContracts,
    resolveBrokerLearningAttempt
} from "./BrokerLearningProgressTransition.js";
import {
    BrokerLearningRouteId,
    assertBrokerLearningRoutesProgress,
    getBrokerLearningRouteProgress,
    isBrokerLearningRouteAvailable,
    replaceBrokerLearningRouteProgress,
    requireBrokerLearningRouteId
} from "./BrokerLearningRoutesProgress.js";

export function getBrokerLearningRouteAttemptContext(
    progress,
    identity,
    options = {}
) {
    const routeContext = requireRouteLesson({
        progress,
        identity,
        options,
        requireSection: false
    });
    const attempt =
        getBrokerLearningAttemptContext(
            routeContext.progress,
            routeContext.lesson.id,
            { catalog: routeContext.catalog }
        );

    return Object.freeze({
        routeId: routeContext.routeId,
        ...attempt
    });
}

export function linkBrokerLearningRouteContract(
    progress,
    identity,
    options = {}
) {
    const routeContext = requireRouteLesson({
        progress,
        identity,
        options,
        requireSection: true
    });
    const nextRoute = linkBrokerLearningContract(
        routeContext.progress,
        {
            lessonId: routeContext.lesson.id,
            contractId: identity.contractId,
            createdAt: identity.createdAt
        },
        { catalog: routeContext.catalog }
    );

    return replaceRoute(
        progress,
        routeContext.routeId,
        nextRoute,
        options
    );
}

export function releaseBrokerLearningRouteContract(
    progress,
    identity,
    options = {}
) {
    const routeContext = requireRouteLesson({
        progress,
        identity,
        options,
        requireSection: true
    });
    requireMatchingLink(
        routeContext.progress,
        identity,
        routeContext.lesson.id
    );
    const nextRoute =
        releaseBrokerLearningContract(
            routeContext.progress,
            {
                lessonId:
                    routeContext.lesson.id,
                contractId:
                    identity.contractId
            },
            { catalog: routeContext.catalog }
        );

    return replaceRoute(
        progress,
        routeContext.routeId,
        nextRoute,
        options
    );
}

export function releaseBrokerLearningRouteContracts(
    progress,
    identities,
    options = {}
) {
    assertBrokerLearningRoutesProgress(
        progress,
        options
    );

    if (!Array.isArray(identities)) {
        invalid(
            "BROKER95_LEARNING_ROUTE_CONTRACTS_INVALID"
        );
    }

    if (identities.length === 0) {
        return progress;
    }

    const contractIds = new Set();
    const groups = new Map();

    for (const identity of identities) {
        const routeContext = requireRouteLesson({
            progress,
            identity,
            options,
            requireSection: true
        });

        requireMatchingLink(
            routeContext.progress,
            identity,
            routeContext.lesson.id
        );

        if (contractIds.has(identity.contractId)) {
            invalid(
                "BROKER95_LEARNING_ROUTE_CONTRACT_DUPLICATED",
                [{ contractId: identity.contractId }]
            );
        }

        contractIds.add(identity.contractId);

        const group = groups.get(
            routeContext.routeId
        ) ?? {
            routeContext,
            contractIds: []
        };

        group.contractIds.push(identity.contractId);
        groups.set(routeContext.routeId, group);
    }

    let next = progress;

    for (const [routeId, group] of groups) {
        const routeProgress =
            getBrokerLearningRouteProgress(
                next,
                routeId,
                options
            );
        const nextRoute =
            releaseBrokerLearningContracts(
                routeProgress,
                group.contractIds,
                {
                    catalog:
                        group.routeContext.catalog
                }
            );

        next = replaceRoute(
            next,
            routeId,
            nextRoute,
            options
        );
    }

    return next;
}

export function resolveBrokerLearningRouteAttempt(
    progress,
    identity,
    options = {}
) {
    const routeContext = requireRouteLesson({
        progress,
        identity,
        options,
        requireSection: true
    });
    requireMatchingLink(
        routeContext.progress,
        identity,
        routeContext.lesson.id
    );
    const nextRoute = resolveBrokerLearningAttempt(
        routeContext.progress,
        {
            lessonId: routeContext.lesson.id,
            contractId: identity.contractId,
            score: identity.score,
            resolvedAt: identity.resolvedAt
        },
        { catalog: routeContext.catalog }
    );

    return replaceRoute(
        progress,
        routeContext.routeId,
        nextRoute,
        options
    );
}

function requireRouteLesson({
    progress,
    identity,
    options,
    requireSection
}) {
    assertBrokerLearningRoutesProgress(
        progress,
        options
    );

    if (!isRecord(identity)) {
        invalid(
            "BROKER95_LEARNING_ROUTE_CONTEXT_INVALID"
        );
    }

    const routeId = requireBrokerLearningRouteId(
        identity.routeId
    );

    if (
        !isBrokerLearningRouteAvailable(
            progress,
            routeId,
            options
        )
    ) {
        invalid(
            "BROKER95_LEARNING_ROUTE_LOCKED",
            [{ routeId }]
        );
    }

    const catalog = requireRouteCatalog(
        routeId,
        options
    );
    const lesson = requireLesson(
        catalog,
        identity.lessonId,
        routeId
    );

    if (
        requireSection &&
        identity.sectionId !== lesson.sectionId
    ) {
        invalid(
            "BROKER95_LEARNING_ROUTE_CONTEXT_MISMATCH",
            [{
                routeId,
                sectionId: identity.sectionId,
                lessonId: identity.lessonId
            }]
        );
    }

    return Object.freeze({
        routeId,
        catalog,
        lesson,
        progress: getBrokerLearningRouteProgress(
            progress,
            routeId,
            options
        )
    });
}

function requireRouteCatalog(routeId, options) {
    const catalog =
        options.catalogs?.[routeId] ??
        (
            routeId ===
                BrokerLearningRouteId.PROGRAMMING
                ? brokerLearningCatalog
                : null
        );

    if (
        catalog == null ||
        typeof catalog.requireLesson !==
            "function"
    ) {
        invalid(
            "BROKER95_LEARNING_ROUTE_NOT_CATALOGED",
            [{ routeId }]
        );
    }

    return catalog;
}

function requireLesson(catalog, lessonId, routeId) {
    try {
        return catalog.requireLesson(lessonId);
    } catch (error) {
        invalid(
            "BROKER95_LEARNING_ROUTE_LESSON_INVALID",
            [{
                routeId,
                lessonId,
                causeCode: error?.code ?? null
            }]
        );
    }
}

function requireMatchingLink(
    progress,
    identity,
    lessonId
) {
    const link = progress
        .lessonContractLinks[lessonId];

    if (
        link == null ||
        link.contractId !== identity.contractId
    ) {
        invalid(
            "BROKER95_LEARNING_ROUTE_CONTRACT_MISMATCH",
            [{
                routeId: identity.routeId,
                sectionId: identity.sectionId,
                lessonId,
                contractId: identity.contractId
            }]
        );
    }
}

function replaceRoute(
    progress,
    routeId,
    routeProgress,
    options
) {
    return replaceBrokerLearningRouteProgress(
        progress,
        routeId,
        routeProgress,
        options
    );
}

function isRecord(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) ===
            Object.prototype;
}

function invalid(code, diagnostics = []) {
    throw BrokerGameError.invalidRule(
        code,
        "La transición multirruta de aprendizaje no es válida.",
        diagnostics
    );
}
