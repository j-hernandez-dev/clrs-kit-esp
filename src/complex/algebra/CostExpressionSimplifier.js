import {
    CostExpressionKind,
    costExpressionKey,
    requireCostExpression
} from "./CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "./CostExpressionFactory.js";
import {
    attachRecurrenceCallMetadata,
    getRecurrenceCallMetadata
} from "../recurrence/RecurrenceCallMetadata.js";
import {
    simplifySymbolicSummation
} from "../summation/SymbolicSummation.js";
import {
    normalizePolynomialExpression,
    polynomialToCostExpression
} from "./NormalizedPolynomial.js";
import { guiDataMeasureReplacement } from "../gui/GuiCostMeasures.js";

/**
 * Simplificador deliberadamente conservador. Sólo aplica identidades
 * algebraicas válidas sin inferir todavía crecimiento asintótico.
 */
export class CostExpressionSimplifier {

    simplify(expression) {
        requireCostExpression(expression);

        switch (expression.kind) {
            case CostExpressionKind.SUM:
                return this.simplifySum(
                    expression.terms
                );
            case CostExpressionKind.SUMMATION:
                return simplifySymbolicSummation(
                    expression,
                    item => this.simplify(item)
                );
            case CostExpressionKind.DIFFERENCE:
                return this.simplifyDifference(
                    expression
                );
            case CostExpressionKind.PRODUCT:
                return this.simplifyProduct(
                    expression.factors
                );
            case CostExpressionKind.QUOTIENT:
                return this.simplifyQuotient(
                    expression
                );
            case CostExpressionKind.GROUP:
                return this.simplify(
                    expression.expression
                );
            case CostExpressionKind.POWER:
                return this.simplifyPower(
                    expression
                );
            case CostExpressionKind.LOGARITHM:
                return Cost.logarithm(
                    this.simplify(
                        expression.argument
                    ),
                    expression.base == null
                        ? null
                        : this.simplify(
                            expression.base
                        )
                );
            case CostExpressionKind.FACTORIAL:
                return Cost.factorial(
                    this.simplify(
                        expression.argument
                    )
                );
            case CostExpressionKind.CALL:
                return simplifyCall(
                    expression,
                    argument =>
                        this.simplify(
                            argument
                        )
                );
            case CostExpressionKind.MAXIMUM:
                return this.simplifyExtremum(
                    expression.expressions,
                    "maximum"
                );
            case CostExpressionKind.MINIMUM:
                return this.simplifyExtremum(
                    expression.expressions,
                    "minimum"
                );
            case CostExpressionKind.EQUATION:
                return Cost.equation(
                    this.simplify(
                        expression.left
                    ),
                    this.simplify(
                        expression.right
                    )
                );
            case CostExpressionKind.RECURRENCE:
                return Cost.recurrence(
                    this.simplify(
                        expression.left
                    ),
                    this.simplify(
                        expression.right
                    )
                );
            default:
                return expression;
        }
    }

    simplifySum(terms) {
        const flattened = [];

        for (const term of terms) {
            const simplified =
                this.simplify(term);

            if (
                simplified.kind ===
                CostExpressionKind.SUM
            ) {
                flattened.push(
                    ...simplified.terms
                );
            } else {
                flattened.push(simplified);
            }
        }

        const coefficients = new Map();
        let numericConstant = 0;

        for (const term of flattened) {
            const {
                coefficient,
                base
            } = this.extractCoefficient(
                term
            );

            if (base == null) {
                numericConstant +=
                    coefficient;
                continue;
            }

            const key =
                costExpressionKey(base);
            const existing =
                coefficients.get(key);

            if (existing == null) {
                coefficients.set(
                    key,
                    {
                        base,
                        coefficient
                    }
                );
            } else {
                existing.coefficient +=
                    coefficient;
            }
        }

        if (
            flattened.some(term =>
                term.kind ===
                CostExpressionKind.DIFFERENCE
            )
        ) {
            const polynomial =
                normalizePolynomialExpression(
                    Cost.sum(flattened)
                );

            if (polynomial != null) {
                return polynomialToCostExpression(
                    polynomial
                );
            }
        }

        const simplifiedTerms = [];

        for (
            const {
                base,
                coefficient
            }
            of coefficients.values()
        ) {
            if (coefficient === 0) {
                continue;
            }

            simplifiedTerms.push(
                coefficient === 1
                    ? base
                    : this.simplifyProduct([
                        Cost.constant(
                            coefficient
                        ),
                        base
                    ])
            );
        }

        if (numericConstant !== 0) {
            simplifiedTerms.push(
                Cost.constant(
                    numericConstant
                )
            );
        }

        if (simplifiedTerms.length === 0) {
            return Cost.constant(0);
        }

        if (simplifiedTerms.length === 1) {
            return simplifiedTerms[0];
        }

        return Cost.sum(simplifiedTerms);
    }

    simplifyDifference(expression) {
        const left =
            this.simplify(
                expression.left
            );
        const right =
            this.simplify(
                expression.right
            );

        if (
            left.kind ===
                CostExpressionKind.CONSTANT &&
            right.kind ===
                CostExpressionKind.CONSTANT
        ) {
            return Cost.constant(
                left.value -
                right.value
            );
        }

        if (
            right.kind ===
                CostExpressionKind.CONSTANT &&
            right.value === 0
        ) {
            return left;
        }

        if (
            costExpressionKey(left) ===
            costExpressionKey(right)
        ) {
            return Cost.constant(0);
        }

        const polynomial =
            normalizePolynomialExpression(
                Cost.difference(
                    left,
                    right
                )
            );

        if (polynomial != null) {
            return polynomialToCostExpression(
                polynomial
            );
        }

        const affineConstant =
            constantAffineDifference(
                left,
                right
            );

        if (affineConstant != null) {
            return Cost.constant(
                affineConstant
            );
        }

        return Cost.difference(
            left,
            right
        );
    }

    simplifyProduct(factors) {
        const flattened = [];
        let numericConstant = 1;

        for (const factor of factors) {
            const simplified =
                this.simplify(factor);

            if (
                simplified.kind ===
                CostExpressionKind.CONSTANT
            ) {
                numericConstant *=
                    simplified.value;
                continue;
            }

            if (
                simplified.kind ===
                CostExpressionKind.PRODUCT
            ) {
                flattened.push(
                    ...simplified.factors
                );
            } else {
                flattened.push(simplified);
            }
        }

        if (numericConstant === 0) {
            return Cost.constant(0);
        }

        const powers = new Map();

        for (const factor of flattened) {
            const key =
                costExpressionKey(factor);
            const existing =
                powers.get(key);

            if (existing == null) {
                powers.set(
                    key,
                    {
                        factor,
                        exponent: 1
                    }
                );
            } else {
                existing.exponent += 1;
            }
        }

        const simplifiedFactors = [];

        if (numericConstant !== 1) {
            simplifiedFactors.push(
                Cost.constant(
                    numericConstant
                )
            );
        }

        for (
            const {
                factor,
                exponent
            }
            of powers.values()
        ) {
            simplifiedFactors.push(
                exponent === 1
                    ? factor
                    : Cost.power(
                        factor,
                        Cost.constant(
                            exponent
                        )
                    )
            );
        }

        if (simplifiedFactors.length === 0) {
            return Cost.constant(1);
        }

        if (simplifiedFactors.length === 1) {
            return simplifiedFactors[0];
        }

        return Cost.product(
            simplifiedFactors
        );
    }

    simplifyQuotient(expression) {
        const numerator =
            this.simplify(
                expression.numerator
            );
        const denominator =
            this.simplify(
                expression.denominator
            );

        if (
            numerator.kind ===
                CostExpressionKind.CONSTANT &&
            numerator.value === 0
        ) {
            return Cost.constant(0);
        }

        if (
            denominator.kind ===
                CostExpressionKind.CONSTANT &&
            denominator.value === 1
        ) {
            return numerator;
        }

        if (
            numerator.kind ===
                CostExpressionKind.CONSTANT &&
            denominator.kind ===
                CostExpressionKind.CONSTANT &&
            denominator.value !== 0
        ) {
            return Cost.constant(
                numerator.value /
                denominator.value
            );
        }

        if (
            costExpressionKey(numerator) ===
            costExpressionKey(denominator)
        ) {
            return Cost.constant(1);
        }

        return Cost.quotient(
            numerator,
            denominator
        );
    }

    simplifyPower(expression) {
        const base =
            this.simplify(
                expression.base
            );
        const exponent =
            this.simplify(
                expression.exponent
            );

        if (
            exponent.kind ===
            CostExpressionKind.CONSTANT
        ) {
            if (exponent.value === 0) {
                return Cost.constant(1);
            }

            if (exponent.value === 1) {
                return base;
            }

            if (
                base.kind ===
                CostExpressionKind.CONSTANT
            ) {
                return Cost.constant(
                    base.value **
                    exponent.value
                );
            }
        }

        return Cost.power(
            base,
            exponent
        );
    }

    simplifyExtremum(
        expressions,
        operation
    ) {
        const unique = new Map();

        for (const expression of expressions) {
            const simplified =
                this.simplify(expression);

            unique.set(
                costExpressionKey(
                    simplified
                ),
                simplified
            );
        }

        const items = [
            ...unique.values()
        ];

        if (
            items.every(item =>
                item.kind ===
                CostExpressionKind.CONSTANT
            )
        ) {
            return Cost.constant(
                Math[
                    operation === "minimum"
                        ? "min"
                        : "max"
                ](
                    ...items.map(
                        item =>
                            item.value
                    )
                )
            );
        }

        return items.length === 1
            ? items[0]
            : operation === "minimum"
                ? Cost.minimum(items)
                : Cost.maximum(items);
    }

    extractCoefficient(expression) {
        if (
            expression.kind ===
            CostExpressionKind.CONSTANT
        ) {
            return {
                coefficient:
                    expression.value,
                base: null
            };
        }

        if (
            expression.kind !==
                CostExpressionKind.PRODUCT
        ) {
            return {
                coefficient: 1,
                base: expression
            };
        }

        let coefficient = 1;
        const factors = [];

        for (
            const factor
            of expression.factors
        ) {
            if (
                factor.kind ===
                CostExpressionKind.CONSTANT
            ) {
                coefficient *=
                    factor.value;
            } else {
                factors.push(factor);
            }
        }

        if (factors.length === 0) {
            return {
                coefficient,
                base: null
            };
        }

        return {
            coefficient,
            base:
                factors.length === 1
                    ? factors[0]
                    : Cost.product(
                        factors
                    )
        };
    }
}

function constantAffineDifference(left, right) {
    const leftAffine = affineForm(left);
    const rightAffine = affineForm(right);

    if (
        leftAffine == null ||
        rightAffine == null
    ) {
        return null;
    }

    const names = new Set([
        ...leftAffine.coefficients.keys(),
        ...rightAffine.coefficients.keys()
    ]);

    for (const name of names) {
        if (
            (leftAffine.coefficients.get(name) ?? 0) !==
            (rightAffine.coefficients.get(name) ?? 0)
        ) {
            return null;
        }
    }

    return leftAffine.constant -
        rightAffine.constant;
}

function affineForm(expression) {
    switch (expression.kind) {
        case CostExpressionKind.CONSTANT:
            return {
                constant: expression.value,
                coefficients: new Map()
            };
        case CostExpressionKind.SYMBOL:
            return {
                constant: 0,
                coefficients:
                    new Map([[
                        expression.name,
                        1
                    ]])
            };
        case CostExpressionKind.GROUP:
            return affineForm(
                expression.expression
            );
        case CostExpressionKind.SUM:
            return combineAffine(
                expression.terms
            );
        case CostExpressionKind.DIFFERENCE: {
            const left = affineForm(
                expression.left
            );
            const right = affineForm(
                expression.right
            );

            return left == null || right == null
                ? null
                : mergeAffine(left, right, -1);
        }
        case CostExpressionKind.PRODUCT: {
            let scalar = 1;
            let affine = null;

            for (const factor of expression.factors) {
                if (
                    factor.kind ===
                    CostExpressionKind.CONSTANT
                ) {
                    scalar *= factor.value;
                    continue;
                }

                if (affine != null) {
                    return null;
                }

                affine = affineForm(factor);
            }

            if (affine == null) {
                return {
                    constant: scalar,
                    coefficients: new Map()
                };
            }

            return scaleAffine(
                affine,
                scalar
            );
        }
        default:
            return null;
    }
}

function combineAffine(expressions) {
    let result = {
        constant: 0,
        coefficients: new Map()
    };

    for (const expression of expressions) {
        const affine = affineForm(expression);

        if (affine == null) {
            return null;
        }

        result = mergeAffine(
            result,
            affine,
            1
        );
    }

    return result;
}

function mergeAffine(left, right, sign) {
    const coefficients = new Map(
        left.coefficients
    );

    for (const [name, value] of right.coefficients) {
        const combined =
            (coefficients.get(name) ?? 0) +
            sign * value;

        if (combined === 0) {
            coefficients.delete(name);
        } else {
            coefficients.set(name, combined);
        }
    }

    return {
        constant:
            left.constant +
            sign * right.constant,
        coefficients
    };
}

function scaleAffine(affine, scalar) {
    return {
        constant: affine.constant * scalar,
        coefficients: new Map(
            [...affine.coefficients]
                .map(([name, value]) => [
                    name,
                    value * scalar
                ])
        )
    };
}

export const costExpressionSimplifier =
    new CostExpressionSimplifier();

export function simplifyCostExpression(
    expression
) {
    return costExpressionSimplifier
        .simplify(expression);
}

function simplifyCall(
    expression,
    simplify
) {
    const call =
        Cost.call(
            expression.name,
            expression.args.map(
                simplify
            )
        );
    const guiMeasure = guiDataMeasureReplacement(call);
    if (guiMeasure) { return guiMeasure; }
    const metadata =
        getRecurrenceCallMetadata(
            expression
        );

    if (metadata != null) {
        attachRecurrenceCallMetadata(
            call,
            metadata
        );
    }

    return call;
}
