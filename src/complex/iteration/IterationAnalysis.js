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
        AFFINE: "affine",
        EXPONENTIAL: "exponential",
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
    updates = [],
    boundKind = "tight",
    pathAnalysis = null,
    termination = null,
    transition = null,
    trajectory = null,
    invariants = null,
    relational = null,
    nonlinear = null,
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
        updates:
            Object.freeze(
                updates.map(update =>
                    Object.freeze({
                        ...update
                    })
                )
            ),
        boundKind,
        tight: boundKind === "tight",
        pathAnalysis,
        termination,
        transition,
        trajectory,
        invariants,
        relational,
        nonlinear,
        location:
            location == null
                ? null
                : Object.freeze({
                    ...location
                })
    });
}
