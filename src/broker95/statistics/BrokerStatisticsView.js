import {
    brokerCategoryCatalog
} from "../catalog/BrokerCategoryCatalog.js";
import {
    createBrokerGameState
} from "../core/BrokerGameState.js";
import {
    BROKER_ALERT_LIMIT,
    BrokerGameStatus
} from "../core/BrokerGameRules.js";
import {
    BROKER_CRITERIA,
    BROKER_RISKS,
    getBrokerRiskRule
} from "../core/BrokerRiskRules.js";
import {
    brokerLearningCatalog
} from "../learning/BrokerLearningCatalog.js";
import {
    BROKER_LEARNING_ROUTE_IDS,
    BrokerLearningRouteId,
    getBrokerLearningRouteProgress
} from "../learning/BrokerLearningRoutesProgress.js";

export const BROKER_STATISTICS_VIEW_VERSION = 1;

const CRITERION_LABELS = Object.freeze({
    functionality: "Funcionalidad",
    robustness: "Robustez",
    design: "Diseño"
});

/**
 * Vista acumulativa y de sólo lectura. Todos sus valores se derivan del estado
 * validado; no añade contadores persistentes ni autoridad al Webview.
 */
export function createBrokerStatisticsView(
    source,
    options = {}
) {
    const state = createBrokerGameState(
        source,
        { catalogs: options.catalogs }
    );
    const totalEvaluated =
        state.statistics.completed +
        state.statistics.failed;

    return Object.freeze({
        schemaVersion:
            BROKER_STATISTICS_VIEW_VERSION,
        summary: Object.freeze({
            completed:
                state.statistics.completed,
            failed: state.statistics.failed,
            totalEvaluated,
            successRate: percentage(
                state.statistics.completed,
                totalEvaluated
            ),
            totalEarned:
                state.statistics.totalEarned,
            currentMoney: state.money,
            alertLevel: state.alertLevel,
            alertLimit: BROKER_ALERT_LIMIT,
            gameOver:
                state.status ===
                    BrokerGameStatus.GAME_OVER
        }),
        risks: createRiskStatistics(
            state,
            totalEvaluated
        ),
        families:
            createFamilyStatistics(state),
        learningRoutes:
            createLearningRouteStatistics(
                state,
                options.catalogs
            ),
        technicalProfile:
            createTechnicalProfile(
                state
            )
    });
}

function createLearningRouteStatistics(
    state,
    catalogs = null
) {
    return Object.freeze(
        BROKER_LEARNING_ROUTE_IDS.flatMap(
            routeId => {
                const catalog = routeId ===
                    BrokerLearningRouteId.PROGRAMMING
                    ? catalogs?.[routeId] ??
                        brokerLearningCatalog
                    : catalogs?.[routeId] ?? null;

                if (catalog == null) {
                    return [];
                }

                const progress =
                    getBrokerLearningRouteProgress(
                        state.learningProgress,
                        routeId,
                        { catalogs }
                    );
                const completedLessons =
                    progress.completedLessonIds.length;
                const totalLessons =
                    catalog.lessonCount;

                return [Object.freeze({
                    routeId,
                    label: routeId ===
                        BrokerLearningRouteId.PROGRAMMING
                        ? "Programación"
                        : "Algoritmia",
                    available:
                        state.learningProgress
                            .availableRouteIds
                            .includes(routeId),
                    completed:
                        progress.learningCompletedAt != null,
                    completedLessons,
                    totalLessons,
                    progressPercent: percentage(
                        completedLessons,
                        totalLessons
                    ),
                    totalPayout: progress.totalPayout
                })];
            }
        )
    );
}

function createRiskStatistics(
    state,
    totalEvaluated
) {
    return Object.freeze(
        BROKER_RISKS.map(risk => {
            const bucket =
                state.statistics.byRisk[risk];
            const total =
                bucket.completed +
                bucket.failed;

            return Object.freeze({
                risk,
                label:
                    getBrokerRiskRule(risk)
                        .label,
                completed: bucket.completed,
                failed: bucket.failed,
                total,
                distributionPercent:
                    percentage(
                        total,
                        totalEvaluated
                    ),
                successRate: percentage(
                    bucket.completed,
                    total
                )
            });
        })
    );
}

function createFamilyStatistics(state) {
    return Object.freeze(
        brokerCategoryCatalog.families
            .map(family => {
                const history = family.categories
                    .map(category =>
                        state.categoryHistory[
                            category.categoryId
                        ] ?? null
                    );
                const generated = sumHistory(
                    history,
                    "generatedCount"
                );
                const accepted = sumHistory(
                    history,
                    "acceptedCount"
                );
                const completed =
                    state.statistics
                        .familyCompleted[
                            family.familyId
                        ] ?? 0;
                const failed = sumHistory(
                    history,
                    "failedCount"
                );
                const completedCategories =
                    history.filter(entry =>
                        (entry?.completedCount ?? 0) > 0
                    ).length;

                return Object.freeze({
                    familyId: family.familyId,
                    familyName:
                        family.familyName,
                    categoryCount:
                        family.categoryCount,
                    generated,
                    accepted,
                    completed,
                    failed,
                    completedCategories,
                    coveragePercent: percentage(
                        completedCategories,
                        family.categoryCount
                    )
                });
            })
    );
}

function createTechnicalProfile(state) {
    return Object.freeze(
        BROKER_CRITERIA.map(criterion => {
            const bucket =
                state.technicalProfile[
                    criterion
                ];

            return Object.freeze({
                criterion,
                label:
                    CRITERION_LABELS[
                        criterion
                    ],
                score: bucket.score,
                sampleCount:
                    bucket.sampleCount
            });
        })
    );
}

function sumHistory(history, field) {
    return history.reduce(
        (total, entry) =>
            total + (entry?.[field] ?? 0),
        0
    );
}

function percentage(value, total) {
    return total === 0
        ? 0
        : Math.round(value / total * 100);
}
