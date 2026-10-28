import {
    CostExpressionKind,
    requireCostExpression
} from "../algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    canonicalizeCostExpression
} from "../algebra/CostExpressionCanonicalizer.js";
import {
    instantiateCostParameters
} from "../algebra/CostExpressionSubstitution.js";

export const FunctionCostScenario =
    Object.freeze({
        BEST: "best",
        WORST: "worst"
    });

export function createFunctionCostSummary({
    name,
    parameters = [],
    best,
    worst,
    measure = null,
    location = null
}) {
    if (
        typeof name !== "string" ||
        name.length === 0
    ) {
        throw new TypeError(
            "A function cost summary requires a non-empty cost name."
        );
    }

    requireCostExpression(
        best,
        "best function cost"
    );
    requireCostExpression(
        worst,
        "worst function cost"
    );

    const normalizedParameters =
        parameters.map(String);
    const canonicalBest =
        canonicalizeCostExpression(
            best.kind ===
                CostExpressionKind.RECURRENCE
                ? Cost.equation(
                    best.left,
                    best.right
                )
                : best
        );
    const canonicalWorst =
        canonicalizeCostExpression(worst);

    return Object.freeze({
        kind: "function-cost-summary",
        name,
        parameters:
            Object.freeze([
                ...normalizedParameters
            ]),
        best: canonicalBest,
        worst: canonicalWorst,
        directRecursion:
            Object.freeze({
                best:
                    containsCostCall(
                        functionBody(
                            canonicalBest
                        ),
                        name
                    ),
                worst:
                    containsCostCall(
                        functionBody(
                            canonicalWorst
                        ),
                        name
                    )
            }),
        measure,
        location:
            location == null
                ? null
                : Object.freeze({
                    ...location
                })
    });
}

export function instantiateFunctionCostSummary(
    summary,
    args,
    scenario =
        FunctionCostScenario.WORST,
    options = {}
) {
    if (
        summary?.kind !==
        "function-cost-summary"
    ) {
        throw new TypeError(
            "A valid function cost summary is required."
        );
    }

    if (
        scenario !==
            FunctionCostScenario.BEST &&
        scenario !==
            FunctionCostScenario.WORST
    ) {
        throw new TypeError(
            `Unknown function cost scenario: ${scenario}.`
        );
    }

    const instantiation =
        instantiateCostParameters(
            summary[scenario],
            summary.parameters,
            args,
            options
        );

    return Object.freeze({
        ...instantiation,
        kind:
            "function-cost-instantiation",
        summary,
        scenario
    });
}

function functionBody(expression) {
    return (
        expression.kind ===
            CostExpressionKind.EQUATION ||
        expression.kind ===
            CostExpressionKind.RECURRENCE
    )
        ? expression.right
        : expression;
}

function containsCostCall(
    expression,
    name
) {
    if (
        expression?.kind === "call" &&
        expression.name === name
    ) {
        return true;
    }

    if (
        expression == null ||
        typeof expression !== "object"
    ) {
        return false;
    }

    return Object.values(expression)
        .some(value => {
            if (Array.isArray(value)) {
                return value.some(item =>
                    containsCostCall(
                        item,
                        name
                    )
                );
            }

            return containsCostCall(
                value,
                name
            );
        });
}
