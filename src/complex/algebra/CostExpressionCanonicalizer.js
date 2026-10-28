import {
    CostExpressionKind,
    costExpressionKey,
    requireCostExpression
} from "./CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "./CostExpressionFactory.js";
import {
    simplifyCostExpression
} from "./CostExpressionSimplifier.js";
import {
    attachRecurrenceCallMetadata,
    getRecurrenceCallMetadata
} from "../recurrence/RecurrenceCallMetadata.js";

/**
 * Produce una forma estructural determinista sin reemplazar la expresión
 * histórica. Normaliza operadores conmutativos y asociativos, pero evita
 * distribuir productos sobre sumas para no provocar crecimiento exponencial.
 */
export class CostExpressionCanonicalizer {

    canonicalize(expression) {
        requireCostExpression(expression);

        return this.canonicalizeExpression(
            simplifyCostExpression(
                expression
            )
        );
    }

    canonicalizeExpression(expression) {
        switch (expression.kind) {
            case CostExpressionKind.SUM:
                return this.canonicalizeSum(
                    expression.terms
                );
            case CostExpressionKind.SUMMATION:
                return Cost.summation(
                    expression.index,
                    this.canonicalizeExpression(
                        expression.lower
                    ),
                    this.canonicalizeExpression(
                        expression.upper
                    ),
                    this.canonicalizeExpression(
                        expression.term
                    ),
                    expression.step
                );
            case CostExpressionKind.DIFFERENCE:
                return simplifyCostExpression(
                    Cost.difference(
                        this.canonicalizeExpression(
                            expression.left
                        ),
                        this.canonicalizeExpression(
                            expression.right
                        )
                    )
                );
            case CostExpressionKind.PRODUCT:
                return this.canonicalizeProduct(
                    expression.factors
                );
            case CostExpressionKind.QUOTIENT:
                return simplifyCostExpression(
                    Cost.quotient(
                        this.canonicalizeExpression(
                            expression.numerator
                        ),
                        this.canonicalizeExpression(
                            expression.denominator
                        )
                    )
                );
            case CostExpressionKind.GROUP:
                return this.canonicalizeExpression(
                    expression.expression
                );
            case CostExpressionKind.POWER:
                return this.canonicalizePower(
                    expression
                );
            case CostExpressionKind.LOGARITHM:
                return Cost.logarithm(
                    this.canonicalizeExpression(
                        expression.argument
                    ),
                    expression.base == null
                        ? null
                        : this.canonicalizeExpression(
                            expression.base
                        )
                );
            case CostExpressionKind.FACTORIAL:
                return Cost.factorial(
                    this.canonicalizeExpression(
                        expression.argument
                    )
                );
            case CostExpressionKind.CALL:
                return canonicalizeCall(
                    expression,
                    argument =>
                        this.canonicalizeExpression(
                            argument
                        )
                );
            case CostExpressionKind.MINIMUM:
            case CostExpressionKind.MAXIMUM:
                return this.canonicalizeExtremum(
                    expression
                );
            case CostExpressionKind.EQUATION:
                return Cost.equation(
                    this.canonicalizeExpression(
                        expression.left
                    ),
                    this.canonicalizeExpression(
                        expression.right
                    )
                );
            case CostExpressionKind.RECURRENCE:
                return Cost.recurrence(
                    this.canonicalizeExpression(
                        expression.left
                    ),
                    this.canonicalizeExpression(
                        expression.right
                    )
                );
            default:
                return expression;
        }
    }

    canonicalizeSum(terms) {
        const flattened = [];

        for (const term of terms) {
            const canonical =
                this.canonicalizeExpression(
                    term
                );

            if (
                canonical.kind ===
                CostExpressionKind.SUM
            ) {
                flattened.push(
                    ...canonical.terms
                );
            } else {
                flattened.push(canonical);
            }
        }

        const simplified =
            simplifyCostExpression(
                Cost.sum(flattened)
            );

        if (
            simplified.kind !==
            CostExpressionKind.SUM
        ) {
            return simplified;
        }

        return Cost.sum(
            [...simplified.terms]
                .sort(compareSumTerms)
        );
    }

    canonicalizeProduct(factors) {
        const flattened = [];

        for (const factor of factors) {
            const canonical =
                this.canonicalizeExpression(
                    factor
                );

            if (
                canonical.kind ===
                CostExpressionKind.PRODUCT
            ) {
                flattened.push(
                    ...canonical.factors
                );
            } else {
                flattened.push(canonical);
            }
        }

        let coefficient = 1;
        const exponentsByBase =
            new Map();

        for (const factor of flattened) {
            if (
                factor.kind ===
                CostExpressionKind.CONSTANT
            ) {
                coefficient *= factor.value;
                continue;
            }

            const base =
                factor.kind ===
                    CostExpressionKind.POWER
                    ? factor.base
                    : factor;
            const exponent =
                factor.kind ===
                    CostExpressionKind.POWER
                    ? factor.exponent
                    : Cost.constant(1);
            const key =
                costExpressionKey(base);
            const entry =
                exponentsByBase.get(key) ??
                {
                    base,
                    exponents: []
                };

            entry.exponents.push(exponent);
            exponentsByBase.set(
                key,
                entry
            );
        }

        if (coefficient === 0) {
            return Cost.constant(0);
        }

        const canonicalFactors = [];

        for (
            const entry
            of [...exponentsByBase.values()]
                .sort((left, right) =>
                    compareExpressions(
                        left.base,
                        right.base
                    )
                )
        ) {
            const exponent =
                this.canonicalizeSum(
                    entry.exponents
                );

            if (
                exponent.kind ===
                    CostExpressionKind.CONSTANT &&
                exponent.value === 0
            ) {
                continue;
            }

            canonicalFactors.push(
                exponent.kind ===
                        CostExpressionKind.CONSTANT &&
                    exponent.value === 1
                    ? entry.base
                    : Cost.power(
                        entry.base,
                        exponent
                    )
            );
        }

        if (
            coefficient !== 1 ||
            canonicalFactors.length === 0
        ) {
            canonicalFactors.unshift(
                Cost.constant(
                    normalizeNumber(
                        coefficient
                    )
                )
            );
        }

        if (canonicalFactors.length === 1) {
            return canonicalFactors[0];
        }

        return Cost.product(
            canonicalFactors
        );
    }

    canonicalizePower(expression) {
        let base =
            this.canonicalizeExpression(
                expression.base
            );
        let exponent =
            this.canonicalizeExpression(
                expression.exponent
            );

        if (
            base.kind ===
            CostExpressionKind.POWER
        ) {
            exponent =
                this.canonicalizeProduct([
                    base.exponent,
                    exponent
                ]);
            base = base.base;
        }

        return simplifyCostExpression(
            Cost.power(
                base,
                exponent
            )
        );
    }

    canonicalizeExtremum(expression) {
        const items = [];

        for (
            const candidate
            of expression.expressions
        ) {
            const canonical =
                this.canonicalizeExpression(
                    candidate
                );

            if (
                canonical.kind ===
                expression.kind
            ) {
                items.push(
                    ...canonical.expressions
                );
            } else {
                items.push(canonical);
            }
        }

        const unique =
            new Map(
                items.map(item => [
                    costExpressionKey(item),
                    item
                ])
            );
        const sorted =
            [...unique.values()]
                .sort(compareExpressions);
        const extremum =
            expression.kind ===
                CostExpressionKind.MINIMUM
                ? Cost.minimum(sorted)
                : Cost.maximum(sorted);

        return simplifyCostExpression(
            extremum
        );
    }
}

export const costExpressionCanonicalizer =
    new CostExpressionCanonicalizer();

export function canonicalizeCostExpression(
    expression
) {
    return costExpressionCanonicalizer
        .canonicalize(expression);
}

export function canonicalCostExpressionKey(
    expression
) {
    return costExpressionKey(
        canonicalizeCostExpression(
            expression
        )
    );
}

export function areCostExpressionsEquivalent(
    left,
    right
) {
    return (
        canonicalCostExpressionKey(left) ===
        canonicalCostExpressionKey(right)
    );
}

function compareSumTerms(left, right) {
    const leftConstant =
        left.kind ===
        CostExpressionKind.CONSTANT;
    const rightConstant =
        right.kind ===
        CostExpressionKind.CONSTANT;

    if (leftConstant !== rightConstant) {
        return leftConstant ? 1 : -1;
    }

    return compareExpressions(
        left,
        right
    );
}

function compareExpressions(left, right) {
    const leftKey =
        costExpressionKey(left);
    const rightKey =
        costExpressionKey(right);

    return leftKey < rightKey
        ? -1
        : leftKey > rightKey
            ? 1
            : 0;
}

function normalizeNumber(value) {
    return Object.is(value, -0)
        ? 0
        : value;
}

function canonicalizeCall(
    expression,
    canonicalize
) {
    const call =
        Cost.call(
            expression.name,
            expression.args.map(
                canonicalize
            )
        );
    const recurrenceMetadata =
        getRecurrenceCallMetadata(
            expression
        );

    if (recurrenceMetadata != null) {
        attachRecurrenceCallMetadata(
            call,
            recurrenceMetadata
        );
    }

    return call;
}
