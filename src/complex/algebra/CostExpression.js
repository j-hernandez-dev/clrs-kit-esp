import {
    ComplexAnalysisError
} from "../../errors/ComplexAnalysisError.js";

export const CostExpressionKind =
    Object.freeze({
        CONSTANT: "constant",
        SYMBOL: "symbol",
        SUM: "sum",
        DIFFERENCE: "difference",
        PRODUCT: "product",
        QUOTIENT: "quotient",
        GROUP: "group",
        POWER: "power",
        LOGARITHM: "logarithm",
        FACTORIAL: "factorial",
        CALL: "call",
        MAXIMUM: "maximum",
        EQUATION: "equation",
        RECURRENCE: "recurrence",
        UNKNOWN: "unknown",
        RAW: "raw"
    });

const COST_EXPRESSION_KINDS =
    new Set(
        Object.values(
            CostExpressionKind
        )
    );

/**
 * Crea la representación interna e inmutable de una expresión de costo.
 *
 * @param {string} kind
 * @param {object} [properties]
 * @returns {Readonly<object>}
 */
export function createCostExpression(
    kind,
    properties = {}
) {
    if (!COST_EXPRESSION_KINDS.has(kind)) {
        throw invalidCostExpression(
            `Unknown cost expression kind: ${kind}.`
        );
    }

    const normalized = {};

    for (
        const [key, value]
        of Object.entries(properties)
    ) {
        normalized[key] =
            Array.isArray(value)
                ? Object.freeze([
                    ...value
                ])
                : value;
    }

    return Object.freeze({
        kind,
        ...normalized
    });
}

export function isCostExpression(value) {
    return (
        value != null &&
        typeof value === "object" &&
        COST_EXPRESSION_KINDS.has(
            value.kind
        )
    );
}

export function requireCostExpression(
    value,
    dependency = "costExpression"
) {
    if (!isCostExpression(value)) {
        throw invalidCostExpression(
            `${dependency} must be a valid cost expression.`
        );
    }

    return value;
}

export function costExpressionKey(
    expression
) {
    requireCostExpression(expression);

    return JSON.stringify(expression);
}

function invalidCostExpression(message) {
    return new ComplexAnalysisError(
        message,
        null,
        {
            code:
                "CLRS_INVALID_COST_EXPRESSION"
        }
    );
}
