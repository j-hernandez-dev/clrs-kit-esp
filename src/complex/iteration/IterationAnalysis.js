import {
    requireCostExpression
} from "../algebra/CostExpression.js";

export const IterationAnalysisKind =
    Object.freeze({
        CONSTANT: "constant",
        SYMBOLIC: "symbolic",
        LOGARITHMIC: "logarithmic",
        UNKNOWN: "unknown"
    });

export const IterationProgression =
    Object.freeze({
        ADDITIVE: "additive",
        MULTIPLICATIVE: "multiplicative",
        UNKNOWN: "unknown"
    });

export function createIterationAnalysis({
    kind,
    progression,
    iterations,
    variable = null,
    exact = false,
    code = null,
    message = null,
    assumptions = [],
    location = null
}) {
    requireCostExpression(
        iterations,
        "iteration count"
    );

    return Object.freeze({
        kind,
        progression,
        iterations,
        variable,
        exact,
        code,
        message,
        assumptions:
            Object.freeze([
                ...assumptions
            ]),
        location:
            location == null
                ? null
                : Object.freeze({
                    ...location
                })
    });
}
