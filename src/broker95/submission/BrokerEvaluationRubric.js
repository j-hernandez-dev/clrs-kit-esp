import {
    calculateBrokerFinalScore
} from "../core/BrokerGameRules.js";
import {
    requireBrokerScore
} from "../core/BrokerPaymentRules.js";
import {
    getBrokerRiskRule
} from "../core/BrokerRiskRules.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";

export const BROKER_EVALUATION_RUBRIC_VERSION = 1;

export const BrokerEvaluationCriterion = Object.freeze({
    FUNCTIONALITY_FULFILLMENT: "F-CUM",
    FUNCTIONALITY_CORRECTNESS: "F-COR",
    FUNCTIONALITY_BOUNDARIES: "F-LIM",
    ROBUSTNESS_VALIDATION: "R-VAL",
    ROBUSTNESS_SAFETY: "R-SEG",
    ROBUSTNESS_HANDLING: "R-MAN",
    DESIGN_CLARITY: "D-CLA",
    DESIGN_SIMPLICITY: "D-SIM",
    DESIGN_MODULARITY: "D-MOD",
    DESIGN_COHESION: "D-COH",
    DESIGN_COUPLING: "D-ACO",
    DESIGN_ABSTRACTION: "D-ABS"
});

const DIMENSION_RUBRICS = Object.freeze({
    functionality: dimensionRubric(40, [
        criterion("F-CUM", "Cumplimiento", 20),
        criterion("F-COR", "Corrección", 15),
        criterion("F-LIM", "Casos límite", 5)
    ]),
    robustness: dimensionRubric(10, [
        criterion("R-VAL", "Validación", 4),
        criterion("R-SEG", "Operaciones seguras", 4),
        criterion("R-MAN", "Manejo controlado", 2)
    ]),
    design: dimensionRubric(30, [
        criterion("D-CLA", "Claridad", 5),
        criterion("D-SIM", "Simplicidad", 5),
        criterion("D-MOD", "Modularidad", 6),
        criterion("D-COH", "Cohesión", 5),
        criterion("D-ACO", "Acoplamiento", 4),
        criterion("D-ABS", "Abstracción y ocultamiento", 5)
    ])
});

export function getBrokerEvaluationRubric(risk) {
    const riskRule = getBrokerRiskRule(risk);

    return Object.freeze({
        rubricVersion:
            BROKER_EVALUATION_RUBRIC_VERSION,
        risk,
        dimensions: Object.freeze(
            riskRule.activeCriteria.map(dimension =>
                Object.freeze({
                    dimension,
                    finalWeight:
                        riskRule.weights[dimension],
                    basePoints:
                        DIMENSION_RUBRICS[dimension]
                            .basePoints,
                    criteria:
                        DIMENSION_RUBRICS[dimension]
                            .criteria
                })
            )
        )
    });
}

export function getBrokerActiveEvaluationCriteria(risk) {
    return Object.freeze(
        getBrokerEvaluationRubric(risk)
            .dimensions.flatMap(
                dimension =>
                    dimension.criteria.map(
                        item => item.criterion
                    )
            )
    );
}

export function calculateBrokerEvaluationScores(
    risk,
    criterionScores
) {
    const rubric = getBrokerEvaluationRubric(risk);
    const scores = requireCriterionScores(
        rubric,
        criterionScores
    );
    const dimensionScores = Object.freeze(
        Object.fromEntries(
            rubric.dimensions.map(dimension => {
                const weightedPoints =
                    dimension.criteria.reduce(
                        (total, item) =>
                            total +
                            scores[item.criterion] *
                                item.basePoints,
                        0
                    );

                return [
                    dimension.dimension,
                    Math.round(
                        weightedPoints /
                            dimension.basePoints
                    )
                ];
            })
        )
    );

    return Object.freeze({
        criterionScores: scores,
        dimensionScores,
        finalScore: calculateBrokerFinalScore(
            risk,
            dimensionScores
        )
    });
}

function requireCriterionScores(rubric, value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        invalid("BROKER95_EVALUATION_CRITERION_SCORES_INVALID");
    }

    const expected = rubric.dimensions.flatMap(
        dimension => dimension.criteria.map(
            item => item.criterion
        )
    );
    const provided = Object.keys(value);

    if (
        provided.length !== expected.length ||
        expected.some(
            criterion => !Object.hasOwn(value, criterion)
        ) ||
        provided.some(
            criterion => !expected.includes(criterion)
        )
    ) {
        invalid("BROKER95_EVALUATION_CRITERION_SCORES_INVALID");
    }

    return Object.freeze(
        Object.fromEntries(
            expected.map(criterion => [
                criterion,
                requireBrokerScore(value[criterion])
            ])
        )
    );
}

function dimensionRubric(basePoints, criteria) {
    if (
        criteria.reduce(
            (total, item) => total + item.basePoints,
            0
        ) !== basePoints
    ) {
        throw new Error(
            "BROKER.95 evaluation rubric has inconsistent base points."
        );
    }

    return Object.freeze({
        basePoints,
        criteria: Object.freeze(
            criteria.map(item =>
                Object.freeze({
                    ...item,
                    internalWeight:
                        item.basePoints /
                            basePoints
                })
            )
        )
    });
}

function criterion(criterionId, label, basePoints) {
    return Object.freeze({
        criterion: criterionId,
        label,
        basePoints
    });
}

function invalid(code) {
    throw BrokerGameError.invalidRule(
        code,
        "La evaluación contiene puntuaciones no válidas.",
        []
    );
}
