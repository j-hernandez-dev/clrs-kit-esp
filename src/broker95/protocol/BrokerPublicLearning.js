import {
    createBrokerLearningRouteView
} from "../learning/BrokerLearningProgress.js";
import {
    brokerLearningCatalog
} from "../learning/BrokerLearningCatalog.js";
import {
    BROKER_LEARNING_ROUTE_IDS,
    BrokerLearningRouteId,
    createBrokerLearningRoutesProgress,
    getBrokerLearningRouteProgress,
    getBrokerLearningRouteTitle
} from "../learning/BrokerLearningRoutesProgress.js";
import {
    createBrokerLearningCatalogAdapterFromPublic,
    createBrokerPublicLearningCatalog
} from "./BrokerPublicLearningCatalog.js";

export const BROKER_PUBLIC_LEARNING_VERSION = 1;

export const BrokerPublicLearningRouteStatus =
    Object.freeze({
        LOCKED: "locked",
        AVAILABLE: "available",
        COMPLETED: "completed"
    });

/**
 * ProyecciÃ³n multirruta consumible por el Webview. `routes` sirve para el
 * selector; `catalogs` y `progress` contienen exclusivamente rutas que ya
 * poseen un catÃ¡logo real. El desbloqueo siempre se deriva en el Host.
 */
export function createBrokerPublicLearning(
    source,
    options = {}
) {
    const catalogs = normalizeCatalogs(
        options.catalogs
    );
    const normalized =
        createBrokerLearningRoutesProgress(
            source,
            { catalogs }
        );
    const publicCatalogs = {};
    const progress = {};
    const routes = BROKER_LEARNING_ROUTE_IDS.map(
        routeId => {
            const catalog = catalogs[routeId];
            const available =
                normalized.availableRouteIds
                    .includes(routeId);

            if (catalog == null) {
                return createRouteSummary({
                    routeId,
                    status:
                        BrokerPublicLearningRouteStatus
                            .LOCKED,
                    completedLessons: 0,
                    totalLessons: 0,
                    progressPercent: 0
                });
            }

            const routeProgress =
                createBrokerLearningRouteView(
                    getBrokerLearningRouteProgress(
                        normalized,
                        routeId,
                        { catalogs }
                    ),
                    { catalog }
                );
            const status = routeProgress.routeCompleted
                ? BrokerPublicLearningRouteStatus
                    .COMPLETED
                : available
                    ? BrokerPublicLearningRouteStatus
                        .AVAILABLE
                    : BrokerPublicLearningRouteStatus
                        .LOCKED;

            publicCatalogs[routeId] =
                createBrokerPublicLearningCatalog(
                    catalog
                );
            progress[routeId] = routeProgress;

            return createRouteSummary({
                routeId,
                status,
                completedLessons:
                    routeProgress.completedLessons,
                totalLessons:
                    routeProgress.totalLessons,
                progressPercent:
                    routeProgress.progressPercent
            });
        }
    );

    return Object.freeze({
        publicLearningVersion:
            BROKER_PUBLIC_LEARNING_VERSION,
        revision: normalized.revision,
        routes: Object.freeze(routes),
        catalogs: Object.freeze(publicCatalogs),
        progress: Object.freeze(progress)
    });
}

/**
 * Reconstruye exclusivamente la forma persistible necesaria para que el
 * codec vuelva a ejecutar las invariantes del dominio. La representaciÃ³n
 * privada no tiene que viajar duplicada al Webview.
 */
export function restoreBrokerLearningProgressFromPublic(
    source
) {
    if (
        source == null ||
        typeof source !== "object" ||
        !Number.isSafeInteger(source.revision) ||
        source.revision < 0 ||
        !Array.isArray(source.routes) ||
        source.progress == null ||
        typeof source.progress !== "object" ||
        Array.isArray(source.progress)
    ) {
        throw new TypeError(
            "Invalid BROKER.95 public learning projection."
        );
    }

    const routes = {};

    for (const routeId of
        BROKER_LEARNING_ROUTE_IDS) {
        const view = source.progress[routeId];
        routes[routeId] = view == null
            ? dormantRouteProgress()
            : restoreRouteProgress(view);
    }

    return Object.freeze({
        schemaVersion: 1,
        revision: source.revision,
        availableRouteIds: Object.freeze(
            source.routes
                .filter(route =>
                    route.status !==
                    BrokerPublicLearningRouteStatus
                        .LOCKED
                )
                .map(route => route.routeId)
        ),
        routes: Object.freeze(routes)
    });
}

/**
 * Recupera catÃ¡logos de lectura desde una proyecciÃ³n recibida. Esto permite
 * que el codec revalide estados con cualquier ruta catalogada sin importar
 * implementaciones privadas del Extension Host.
 */
export function createBrokerCatalogAdaptersFromPublicLearning(
    source
) {
    if (
        source == null ||
        typeof source !== "object" ||
        Array.isArray(source) ||
        source.publicLearningVersion !==
            BROKER_PUBLIC_LEARNING_VERSION ||
        source.catalogs == null ||
        typeof source.catalogs !== "object" ||
        Array.isArray(source.catalogs)
    ) {
        throw new TypeError(
            "Invalid BROKER.95 public learning projection."
        );
    }

    const catalogs = {};

    for (const [routeId, catalog] of
        Object.entries(source.catalogs)) {
        if (!BROKER_LEARNING_ROUTE_IDS.includes(routeId)) {
            throw new TypeError(
                "Invalid BROKER.95 public learning route."
            );
        }

        catalogs[routeId] =
            createBrokerLearningCatalogAdapterFromPublic(
                catalog
            );
    }

    return Object.freeze(catalogs);
}

export function assertBrokerPublicLearningMatches(
    source,
    expected
) {
    if (
        JSON.stringify(source) !==
        JSON.stringify(expected)
    ) {
        throw new TypeError(
            "Invalid BROKER.95 public learning projection."
        );
    }

    return expected;
}

function createRouteSummary({
    routeId,
    status,
    completedLessons,
    totalLessons,
    progressPercent
}) {
    return Object.freeze({
        routeId,
        title: getBrokerLearningRouteTitle(
            routeId
        ),
        status,
        completedLessons,
        totalLessons,
        progressPercent
    });
}

function restoreRouteProgress(view) {
    if (
        !Array.isArray(view.lessons) ||
        !Array.isArray(view.sections)
    ) {
        throw new TypeError(
            "Invalid BROKER.95 public learning progress."
        );
    }

    const completedLessonIds = view.lessons
        .filter(lesson => lesson.completed === true)
        .map(lesson => lesson.lessonId);
    const lessonAttempts = Object.fromEntries(
        view.lessons
            .filter(lesson => lesson.attempts > 0)
            .map(lesson => [
                lesson.lessonId,
                Object.freeze({
                    lessonId: lesson.lessonId,
                    attempts: lesson.attempts,
                    firstCompletionScore:
                        lesson.firstCompletionScore,
                    bestScore: lesson.bestScore,
                    completedAt: lesson.completedAt
                })
            ])
    );
    const lessonContractLinks =
        Object.fromEntries(
            view.lessons
                .filter(lesson =>
                    lesson.activeContractId != null
                )
                .map(lesson => [
                    lesson.lessonId,
                    Object.freeze({
                        lessonId: lesson.lessonId,
                        contractId:
                            lesson.activeContractId,
                        learningAttempt:
                            lesson.learningAttempt,
                        repetition:
                            lesson.repetition
                    })
                ])
        );

    return Object.freeze({
        schemaVersion: 1,
        revision: view.revision,
        currentLessonId: view.currentLessonId,
        completedLessonIds:
            Object.freeze(completedLessonIds),
        completedSectionIds: Object.freeze(
            view.sections
                .filter(section =>
                    section.status ===
                    BrokerPublicLearningRouteStatus
                        .COMPLETED
                )
                .map(section => section.sectionId)
        ),
        lessonAttempts:
            Object.freeze(lessonAttempts),
        lessonContractLinks:
            Object.freeze(lessonContractLinks),
        totalPayout: view.totalPayout,
        learningStartedAt:
            view.learningStartedAt,
        learningCompletedAt:
            view.learningCompletedAt
    });
}

function dormantRouteProgress() {
    return Object.freeze({
        schemaVersion: 1,
        revision: 0,
        currentLessonId: null,
        completedLessonIds: Object.freeze([]),
        completedSectionIds: Object.freeze([]),
        lessonAttempts: Object.freeze({}),
        lessonContractLinks: Object.freeze({}),
        totalPayout: 0,
        learningStartedAt: null,
        learningCompletedAt: null
    });
}

function normalizeCatalogs(source = null) {
    return Object.freeze({
        [BrokerLearningRouteId.PROGRAMMING]:
            source?.[
                BrokerLearningRouteId.PROGRAMMING
            ] ?? brokerLearningCatalog,
        [BrokerLearningRouteId.ALGORITHMS]:
            source?.[
                BrokerLearningRouteId.ALGORITHMS
            ] ?? null
    });
}
