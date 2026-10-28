import {
    CostExpressionKind,
    requireCostExpression
} from "../algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    simplifyCostExpression
} from "../algebra/CostExpressionSimplifier.js";
import {
    canonicalizeCostExpression
} from "../algebra/CostExpressionCanonicalizer.js";

export const ScenarioCostConfidence =
    Object.freeze({
        EXACT: "exact",
        LOWER_BOUND: "lower-bound",
        UPPER_BOUND: "upper-bound",
        SYNTACTIC_BOUND: "syntactic-bound",
        UNKNOWN: "unknown"
    });

const CONFIDENCE_VALUES =
    new Set(
        Object.values(
            ScenarioCostConfidence
        )
    );

export function createScenarioCost({
    best,
    worst,
    assumptions = [],
    evidence = [],
    confidence = {}
}) {
    requireCostExpression(
        best,
        "best-case cost"
    );
    requireCostExpression(
        worst,
        "worst-case cost"
    );

    const bestConfidence =
        normalizeConfidence(
            confidence.best,
            best
        );
    const worstConfidence =
        normalizeConfidence(
            confidence.worst,
            worst
        );
    const simplifiedBest =
        simplifyCostExpression(best);
    const simplifiedWorst =
        simplifyCostExpression(worst);

    return Object.freeze({
        kind: "scenario-cost",
        best,
        worst,
        simplifiedBest,
        simplifiedWorst,
        canonicalBest:
            canonicalizeCostExpression(
                simplifiedBest
            ),
        canonicalWorst:
            canonicalizeCostExpression(
                simplifiedWorst
            ),
        assumptions:
            freezeStrings(assumptions),
        evidence:
            freezeStrings(evidence),
        confidence:
            Object.freeze({
                best: bestConfidence,
                worst: worstConfidence
            })
    });
}

export function createUniformScenarioCost(
    expression,
    options = {}
) {
    return createScenarioCost({
        best: expression,
        worst: expression,
        ...options
    });
}

export function isScenarioCost(value) {
    return (
        value?.kind === "scenario-cost" &&
        value.best != null &&
        value.worst != null
    );
}

export function requireScenarioCost(
    value,
    dependency = "scenarioCost"
) {
    if (!isScenarioCost(value)) {
        throw new TypeError(
            `${dependency} must be a valid ScenarioCost.`
        );
    }

    return value;
}

export function sumScenarioCosts(
    scenarios
) {
    if (!Array.isArray(scenarios)) {
        throw new TypeError(
            "Scenario costs must be an array."
        );
    }

    if (scenarios.length === 0) {
        return createUniformScenarioCost(
            Cost.constant(0)
        );
    }

    scenarios.forEach(
        scenario =>
            requireScenarioCost(scenario)
    );

    return createScenarioCost({
        best:
            Cost.sum(
                scenarios.map(
                    scenario =>
                        scenario.best
                )
            ),
        worst:
            Cost.sum(
                scenarios.map(
                    scenario =>
                        scenario.worst
                )
            ),
        assumptions:
            mergeStrings(
                scenarios,
                "assumptions"
            ),
        evidence:
            mergeStrings(
                scenarios,
                "evidence"
            ),
        confidence: {
            best:
                combineConfidence(
                    scenarios.map(
                        scenario =>
                            scenario.confidence.best
                    )
                ),
            worst:
                combineConfidence(
                    scenarios.map(
                        scenario =>
                            scenario.confidence.worst
                    )
                )
        }
    });
}

function normalizeConfidence(
    value,
    expression
) {
    if (containsUnknown(expression)) {
        return ScenarioCostConfidence.UNKNOWN;
    }

    if (value == null) {
        return ScenarioCostConfidence.EXACT;
    }

    if (!CONFIDENCE_VALUES.has(value)) {
        throw new TypeError(
            `Unknown scenario confidence: ${value}.`
        );
    }

    return value;
}

function combineConfidence(values) {
    const unique = new Set(values);

    if (
        unique.has(
            ScenarioCostConfidence.UNKNOWN
        )
    ) {
        return ScenarioCostConfidence.UNKNOWN;
    }

    if (unique.size === 1) {
        return values[0] ??
            ScenarioCostConfidence.EXACT;
    }

    unique.delete(
        ScenarioCostConfidence.EXACT
    );

    return unique.size === 1
        ? [...unique][0]
        : ScenarioCostConfidence.UNKNOWN;
}

function containsUnknown(expression) {
    if (
        expression.kind ===
        CostExpressionKind.UNKNOWN
    ) {
        return true;
    }

    return Object.values(expression)
        .some(value => {
            if (Array.isArray(value)) {
                return value.some(item =>
                    item != null &&
                    typeof item === "object" &&
                    containsUnknown(item)
                );
            }

            return (
                value != null &&
                typeof value === "object" &&
                typeof value.kind === "string" &&
                containsUnknown(value)
            );
        });
}

function freezeStrings(values) {
    return Object.freeze(
        [...new Set(
            values.map(String)
        )]
    );
}

function mergeStrings(
    scenarios,
    property
) {
    return [
        ...new Set(
            scenarios.flatMap(
                scenario =>
                    scenario[property]
            )
        )
    ];
}
