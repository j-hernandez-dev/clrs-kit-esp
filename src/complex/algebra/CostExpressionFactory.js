import {
    ComplexAnalysisError
} from "../../errors/ComplexAnalysisError.js";
import {
    CostExpressionKind,
    createCostExpression,
    requireCostExpression
} from "./CostExpression.js";

/**
 * Fábrica del álgebra de costos. No simplifica automáticamente para que el
 * árbol conserve la derivación producida por el análisis.
 */
export class CostExpressionFactory {

    static constant(value) {
        if (!Number.isFinite(value)) {
            throw invalidFactoryValue(
                "Cost constants must be finite numbers."
            );
        }

        return createCostExpression(
            CostExpressionKind.CONSTANT,
            { value }
        );
    }

    static symbol(name) {
        requireName(name, "Cost symbol");

        return createCostExpression(
            CostExpressionKind.SYMBOL,
            { name }
        );
    }

    static sum(terms = []) {
        return createCostExpression(
            CostExpressionKind.SUM,
            {
                terms:
                    requireExpressions(
                        terms,
                        "sum terms"
                    )
            }
        );
    }

    static difference(left, right) {
        return createCostExpression(
            CostExpressionKind.DIFFERENCE,
            {
                left:
                    requireCostExpression(
                        left,
                        "difference left side"
                    ),
                right:
                    requireCostExpression(
                        right,
                        "difference right side"
                    )
            }
        );
    }

    static product(factors = []) {
        return createCostExpression(
            CostExpressionKind.PRODUCT,
            {
                factors:
                    requireExpressions(
                        factors,
                        "product factors"
                    )
            }
        );
    }

    static quotient(
        numerator,
        denominator
    ) {
        return createCostExpression(
            CostExpressionKind.QUOTIENT,
            {
                numerator:
                    requireCostExpression(
                        numerator,
                        "quotient numerator"
                    ),
                denominator:
                    requireCostExpression(
                        denominator,
                        "quotient denominator"
                    )
            }
        );
    }

    static group(expression) {
        return createCostExpression(
            CostExpressionKind.GROUP,
            {
                expression:
                    requireCostExpression(
                        expression
                    )
            }
        );
    }

    static power(base, exponent) {
        return createCostExpression(
            CostExpressionKind.POWER,
            {
                base:
                    requireCostExpression(
                        base,
                        "power base"
                    ),
                exponent:
                    requireCostExpression(
                        exponent,
                        "power exponent"
                    )
            }
        );
    }

    static logarithm(
        argument,
        base = null
    ) {
        return createCostExpression(
            CostExpressionKind.LOGARITHM,
            {
                argument:
                    requireCostExpression(
                        argument,
                        "logarithm argument"
                    ),
                base:
                    base == null
                        ? null
                        : requireCostExpression(
                            base,
                            "logarithm base"
                        )
            }
        );
    }

    static factorial(argument) {
        return createCostExpression(
            CostExpressionKind.FACTORIAL,
            {
                argument:
                    requireCostExpression(
                        argument,
                        "factorial argument"
                    )
            }
        );
    }

    static call(name, args = []) {
        requireName(
            name,
            "Cost function name"
        );

        return createCostExpression(
            CostExpressionKind.CALL,
            {
                name,
                args:
                    requireExpressions(
                        args,
                        "cost function arguments"
                    )
            }
        );
    }

    static maximum(expressions = []) {
        const items =
            requireExpressions(
                expressions,
                "maximum expressions"
            );

        if (items.length === 0) {
            throw invalidFactoryValue(
                "A maximum requires at least one expression."
            );
        }

        return createCostExpression(
            CostExpressionKind.MAXIMUM,
            { expressions: items }
        );
    }

    static equation(left, right) {
        return createCostExpression(
            CostExpressionKind.EQUATION,
            {
                left:
                    requireCostExpression(
                        left,
                        "equation left side"
                    ),
                right:
                    requireCostExpression(
                        right,
                        "equation right side"
                    )
            }
        );
    }

    static recurrence(left, right) {
        return createCostExpression(
            CostExpressionKind.RECURRENCE,
            {
                left:
                    requireCostExpression(
                        left,
                        "recurrence left side"
                    ),
                right:
                    requireCostExpression(
                        right,
                        "recurrence right side"
                    )
            }
        );
    }

    static unknown(reason = null) {
        return createCostExpression(
            CostExpressionKind.UNKNOWN,
            { reason }
        );
    }

    static raw(value) {
        if (typeof value !== "string") {
            throw invalidFactoryValue(
                "A raw cost expression must be a string."
            );
        }

        return createCostExpression(
            CostExpressionKind.RAW,
            { value }
        );
    }
}

function requireExpressions(
    expressions,
    dependency
) {
    if (!Array.isArray(expressions)) {
        throw invalidFactoryValue(
            `${dependency} must be an array.`
        );
    }

    return expressions.map(
        (expression, index) =>
            requireCostExpression(
                expression,
                `${dependency}[${index}]`
            )
    );
}

function requireName(name, dependency) {
    if (
        typeof name !== "string" ||
        name.length === 0
    ) {
        throw invalidFactoryValue(
            `${dependency} must be a non-empty string.`
        );
    }
}

function invalidFactoryValue(message) {
    return new ComplexAnalysisError(
        message,
        null,
        {
            code:
                "CLRS_INVALID_COST_EXPRESSION"
        }
    );
}
