import {
    brokerCategoryCatalog
} from "../catalog/BrokerCategoryCatalog.js";
import {
    requireBrokerLearningCategory
} from "../catalog/BrokerLearningCategoryTaxonomy.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    brokerLearningCatalog
} from "./BrokerLearningCatalog.js";
import {
    BrokerLearningRouteId,
    requireBrokerLearningRouteId
} from "./BrokerLearningRoutesProgress.js";
import {
    getBrokerLearningToolRecommendations
} from "./BrokerLearningToolRecommendation.js";

export const BROKER_LEARNING_TOOL_POLICY =
    Object.freeze({
        recommendationOnly: true,
        contractRequirementForbidden: true,
        testRequirementForbidden: true,
        evaluationImpact: "none"
    });

/**
 * Proyección curricular autoritativa y neutral respecto de la ruta. No
 * contiene progreso, recompensas, contratos anteriores ni estado de la
 * partida, por lo que puede compartirse con CIPHER sin ceder autoridad.
 */
export function createBrokerLearningCurricularContext(
    identity,
    options = {}
) {
    if (
        identity == null ||
        typeof identity !== "object" ||
        Array.isArray(identity)
    ) {
        invalid(
            "BROKER95_LEARNING_CURRICULAR_CONTEXT_INVALID"
        );
    }

    const learningRouteId =
        requireBrokerLearningRouteId(
            identity.learningRouteId
        );
    const catalogs = resolveCatalogs(
        options.catalogs
    );
    const catalog = catalogs[learningRouteId];

    requireCatalog(catalog, learningRouteId);

    const lesson = catalog.requireLesson(
        identity.lessonId
    );
    const lessons = catalog.listLessons();
    const category =
        requireBrokerLearningCategory(
            lesson.categoryId,
            options.categoryCatalog ??
                brokerCategoryCatalog
        );

    if (category.familyId !== lesson.familyId) {
        invalid(
            "BROKER95_LEARNING_CURRICULAR_CATEGORY_INVALID",
            [{
                learningRouteId,
                lessonId: lesson.id
            }]
        );
    }

    return Object.freeze({
        learningRouteId,
        lesson: Object.freeze({
            lessonId: lesson.id,
            sectionId: lesson.sectionId,
            order: lesson.order,
            title: lesson.title,
            objective: lesson.objective,
            expectedPractice:
                lesson.expectedContract ??
                lesson.objective
        }),
        prerequisiteKnowledge:
            createPrerequisiteKnowledge(
                learningRouteId,
                catalogs
            ),
        accumulatedRouteKnowledge:
            Object.freeze([
                ...catalog
                    .getAccumulatedKnowledge(
                        lesson.id
                    )
            ]),
        forbiddenFutureKnowledge:
            collectUniqueKnowledge(
                lessons
                    .filter(candidate =>
                        candidate.order >
                            lesson.order
                    )
                    .flatMap(candidate =>
                        candidate
                            .introducedKnowledge
                    )
            ),
        category: Object.freeze({
            categoryId: category.categoryId,
            categoryName:
                category.categoryName,
            familyId: category.familyId,
            familyName: category.familyName,
            scope: category.scope
        }),
        pedagogicalDifficulty: Object.freeze({
            level: "beginner",
            stage:
                pedagogicalStage(
                    lesson.order,
                    lessons.length
                ),
            lessonOrder: lesson.order,
            lessonCount: lessons.length,
            maximumRequirements:
                pedagogicalLimit(
                    lesson.order,
                    lessons.length,
                    [3, 4, 5, 6]
                ),
            maximumTestCases:
                pedagogicalLimit(
                    lesson.order,
                    lessons.length,
                    [6, 8, 12, 16]
                )
        }),
        optionalTools:
            getBrokerLearningToolRecommendations(
                lesson.recommendedTools ?? []
            ),
        toolPolicy:
            BROKER_LEARNING_TOOL_POLICY
    });
}

export function getBrokerLearningAllowedKnowledge(
    context
) {
    if (
        context == null ||
        !Array.isArray(
            context.prerequisiteKnowledge
        ) ||
        !Array.isArray(
            context.accumulatedRouteKnowledge
        )
    ) {
        throw new TypeError(
            "Invalid BROKER.95 curricular context."
        );
    }

    return collectUniqueKnowledge([
        ...context.prerequisiteKnowledge
            .flatMap(route => route.knowledge),
        ...context.accumulatedRouteKnowledge
    ]);
}

function createPrerequisiteKnowledge(
    learningRouteId,
    catalogs
) {
    if (
        learningRouteId ===
            BrokerLearningRouteId.PROGRAMMING
    ) {
        return Object.freeze([]);
    }

    const programmingCatalog = catalogs[
        BrokerLearningRouteId.PROGRAMMING
    ];

    requireCatalog(
        programmingCatalog,
        BrokerLearningRouteId.PROGRAMMING
    );

    const lessons =
        programmingCatalog.listLessons();
    const lastLesson = lessons.at(-1);

    if (lastLesson == null) {
        invalid(
            "BROKER95_LEARNING_PREREQUISITE_CATALOG_INVALID"
        );
    }

    return Object.freeze([
        Object.freeze({
            learningRouteId:
                BrokerLearningRouteId.PROGRAMMING,
            knowledge: Object.freeze([
                ...programmingCatalog
                    .getAccumulatedKnowledge(
                        lastLesson.id
                    )
            ])
        })
    ]);
}

function resolveCatalogs(source) {
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

function requireCatalog(catalog, learningRouteId) {
    if (
        catalog == null ||
        typeof catalog.requireLesson !==
            "function" ||
        typeof catalog.listLessons !==
            "function" ||
        typeof catalog
            .getAccumulatedKnowledge !==
            "function"
    ) {
        invalid(
            "BROKER95_LEARNING_ROUTE_NOT_CATALOGED",
            [{ learningRouteId }]
        );
    }
}

function collectUniqueKnowledge(source) {
    const result = [];
    const normalized = new Set();

    for (const item of source) {
        if (
            typeof item !== "string" ||
            item.trim().length === 0
        ) {
            invalid(
                "BROKER95_LEARNING_KNOWLEDGE_INVALID"
            );
        }

        const value = item.trim();
        const key = value
            .normalize("NFKC")
            .toLocaleLowerCase("es-MX");

        if (!normalized.has(key)) {
            normalized.add(key);
            result.push(value);
        }
    }

    return Object.freeze(result);
}

function pedagogicalStage(order, total) {
    const quartile = pedagogicalQuartile(
        order,
        total
    );

    return [
        "introductory",
        "guided",
        "applied",
        "integrative"
    ][quartile];
}

function pedagogicalLimit(order, total, limits) {
    return limits[
        pedagogicalQuartile(order, total)
    ];
}

function pedagogicalQuartile(order, total) {
    return Math.min(
        3,
        Math.floor((order - 1) / total * 4)
    );
}

function invalid(code, details = []) {
    throw BrokerGameError.invalidRule(
        code,
        "No fue posible construir el contexto curricular de BROKER.95.",
        details
    );
}
