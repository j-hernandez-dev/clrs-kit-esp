import {
    requireCostExpression,
    costExpressionKey
} from "../algebra/CostExpression.js";
import {
    canonicalizeCostExpression
} from "../algebra/CostExpressionCanonicalizer.js";

const COMPARISON_OPERATORS =
    new Set([
        "<",
        "<=",
        ">",
        ">=",
        "==",
        "!="
    ]);

const INVERSE_OPERATORS =
    Object.freeze({
        "<": ">=",
        "<=": ">",
        ">": "<=",
        ">=": "<",
        "=": "!=",
        "!=": "="
    });

/**
 * RestricciÃ³n de camino inmutable. No pretende resolver toda la lÃ³gica del
 * programa: conserva hechos comparativos que pueden ser compartidos por los
 * analizadores sin inventar relaciones no demostradas.
 */
export function createAbstractConstraint({
    left,
    operator,
    right
}) {
    requireCostExpression(
        left,
        "abstract constraint left expression"
    );
    requireCostExpression(
        right,
        "abstract constraint right expression"
    );

    if (!COMPARISON_OPERATORS.has(operator)) {
        throw new TypeError(
            "An abstract constraint requires a comparison operator."
        );
    }

    const normalizedLeft =
        canonicalizeCostExpression(left);
    const normalizedRight =
        canonicalizeCostExpression(right);

    return Object.freeze({
        kind: "abstract-constraint",
        left: normalizedLeft,
        operator,
        right: normalizedRight,
        key: constraintKey({
            left: normalizedLeft,
            operator,
            right: normalizedRight
        })
    });
}

export function invertAbstractConstraint(
    constraint
) {
    requireAbstractConstraint(constraint);

    return createAbstractConstraint({
        left: constraint.left,
        operator:
            INVERSE_OPERATORS[
                constraint.operator
            ],
        right: constraint.right
    });
}

export function constraintsEquivalent(
    left,
    right
) {
    requireAbstractConstraint(left);
    requireAbstractConstraint(right);

    return left.key === right.key;
}

export function requireAbstractConstraint(
    constraint
) {
    if (constraint?.kind !== "abstract-constraint") {
        throw new TypeError(
            "A valid abstract constraint is required."
        );
    }
}

function constraintKey({
    left,
    operator,
    right
}) {
    return [
        costExpressionKey(left),
        operator,
        costExpressionKey(right)
    ].join(":");
}
