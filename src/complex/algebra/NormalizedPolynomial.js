import {
    CostExpressionKind,
    costExpressionKey,
    requireCostExpression
} from "./CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "./CostExpressionFactory.js";

const DEFAULT_MAX_TERMS = 256;
const DEFAULT_MAX_DEGREE = 32;
const EPSILON = 1e-10;

/**
 * Polinomio disperso sobre átomos de costo. Un átomo puede ser un símbolo,
 * un logaritmo o una llamada: la normalización sólo aplica leyes de anillo y
 * no presupone la semántica del átomo.
 */
export class NormalizedPolynomial {

    constructor(terms = []) {
        const combined = combineTerms(terms);

        this.kind = "normalized-polynomial";
        this.terms = Object.freeze(
            [...combined.values()]
                .filter(term =>
                    !nearZero(term.coefficient)
                )
                .sort((left, right) =>
                    left.key.localeCompare(
                        right.key
                    )
                )
                .map(freezeTerm)
        );
        this.degree = Math.max(
            0,
            ...this.terms.map(term =>
                term.degree
            )
        );

        Object.freeze(this);
    }

    isZero() {
        return this.terms.length === 0;
    }
}

export function normalizePolynomialExpression(
    expression,
    options = {}
) {
    requireCostExpression(
        expression,
        "normalized polynomial expression"
    );

    return normalize(
        expression,
        {
            maxTerms:
                options.maxTerms ??
                DEFAULT_MAX_TERMS,
            maxDegree:
                options.maxDegree ??
                DEFAULT_MAX_DEGREE,
            preserveAtom:
                options.preserveAtom ??
                null
        }
    );
}

export function polynomialToCostExpression(
    polynomial
) {
    requirePolynomial(polynomial);

    if (polynomial.isZero()) {
        return Cost.constant(0);
    }

    const positive = [];
    const negative = [];

    for (const term of polynomial.terms) {
        const target = term.coefficient > 0
            ? positive
            : negative;

        target.push(
            termToExpression(
                term,
                Math.abs(
                    term.coefficient
                )
            )
        );
    }

    const positiveExpression =
        sumExpression(positive);
    const negativeExpression =
        sumExpression(negative);

    if (positiveExpression == null) {
        return Cost.product([
            Cost.constant(-1),
            negativeExpression
        ]);
    }

    if (negativeExpression == null) {
        return positiveExpression;
    }

    return Cost.difference(
        positiveExpression,
        negativeExpression
    );
}

export function polynomialMagnitudeExpression(
    polynomial
) {
    requirePolynomial(polynomial);

    if (polynomial.isZero()) {
        return Cost.constant(0);
    }

    return sumExpression(
        polynomial.terms.map(term =>
            termToExpression(
                term,
                Math.abs(
                    term.coefficient
                )
            )
        )
    );
}

export function normalizedPolynomialKey(
    polynomial
) {
    requirePolynomial(polynomial);

    return JSON.stringify(
        polynomial.terms.map(term => ({
            coefficient:
                term.coefficient,
            factors:
                term.factors.map(factor => ({
                    key: factor.key,
                    exponent:
                        factor.exponent
                }))
        }))
    );
}

export function requirePolynomial(value) {
    if (
        value?.kind !==
        "normalized-polynomial"
    ) {
        throw new TypeError(
            "A normalized polynomial is required."
        );
    }
}

function normalize(expression, limits) {
    if (
        limits.preserveAtom?.(
            expression
        ) === true
    ) {
        return atomPolynomial(expression);
    }

    switch (expression.kind) {
        case CostExpressionKind.CONSTANT:
            return constantPolynomial(
                expression.value
            );
        case CostExpressionKind.GROUP:
            return normalize(
                expression.expression,
                limits
            );
        case CostExpressionKind.SUM:
            return combineMany(
                expression.terms,
                limits,
                addPolynomials
            );
        case CostExpressionKind.DIFFERENCE: {
            const left = normalize(
                expression.left,
                limits
            );
            const right = normalize(
                expression.right,
                limits
            );

            return left == null || right == null
                ? null
                : addPolynomials(
                    left,
                    scalePolynomial(
                        right,
                        -1
                    ),
                    limits
                );
        }
        case CostExpressionKind.PRODUCT:
            return combineMany(
                expression.factors,
                limits,
                multiplyPolynomials,
                constantPolynomial(1)
            );
        case CostExpressionKind.QUOTIENT:
            return normalizeQuotient(
                expression,
                limits
            );
        case CostExpressionKind.POWER:
            return normalizePower(
                expression,
                limits
            );
        case CostExpressionKind.UNKNOWN:
        case CostExpressionKind.RAW:
        case CostExpressionKind.EQUATION:
        case CostExpressionKind.RECURRENCE:
        case CostExpressionKind.SUMMATION:
        case CostExpressionKind.MAXIMUM:
        case CostExpressionKind.MINIMUM:
            return null;
        default:
            return atomPolynomial(
                expression
            );
    }
}

function normalizeQuotient(
    expression,
    limits
) {
    const denominator = normalize(
        expression.denominator,
        limits
    );

    if (
        denominator == null ||
        denominator.terms.length !== 1 ||
        denominator.terms[0]
            .factors.length !== 0 ||
        nearZero(
            denominator.terms[0]
                .coefficient
        )
    ) {
        return atomPolynomial(expression);
    }

    const numerator = normalize(
        expression.numerator,
        limits
    );

    return numerator == null
        ? null
        : scalePolynomial(
            numerator,
            1 /
                denominator.terms[0]
                    .coefficient
        );
}

function normalizePower(expression, limits) {
    const exponent = expression.exponent;

    if (
        exponent.kind !==
            CostExpressionKind.CONSTANT ||
        !Number.isInteger(exponent.value) ||
        exponent.value < 0 ||
        exponent.value > limits.maxDegree
    ) {
        return atomPolynomial(expression);
    }

    const base = normalize(
        expression.base,
        limits
    );

    if (base == null) {
        return null;
    }

    let result = constantPolynomial(1);

    for (
        let index = 0;
        index < exponent.value;
        index++
    ) {
        result = multiplyPolynomials(
            result,
            base,
            limits
        );

        if (result == null) {
            return null;
        }
    }

    return result;
}

function combineMany(
    expressions,
    limits,
    operation,
    initial = constantPolynomial(0)
) {
    let result = initial;

    for (const expression of expressions) {
        const item = normalize(
            expression,
            limits
        );

        if (item == null) {
            return null;
        }

        result = operation(
            result,
            item,
            limits
        );

        if (result == null) {
            return null;
        }
    }

    return result;
}

function addPolynomials(
    left,
    right,
    limits
) {
    const result = new NormalizedPolynomial([
        ...left.terms,
        ...right.terms
    ]);

    return withinLimits(result, limits)
        ? result
        : null;
}

function multiplyPolynomials(
    left,
    right,
    limits
) {
    const terms = [];

    for (const leftTerm of left.terms) {
        for (const rightTerm of right.terms) {
            terms.push(
                multiplyTerms(
                    leftTerm,
                    rightTerm
                )
            );

            if (terms.length > limits.maxTerms) {
                return null;
            }
        }
    }

    const result =
        new NormalizedPolynomial(terms);

    return withinLimits(result, limits)
        ? result
        : null;
}

function scalePolynomial(polynomial, scale) {
    return new NormalizedPolynomial(
        polynomial.terms.map(term => ({
            ...term,
            coefficient:
                term.coefficient * scale
        }))
    );
}

function constantPolynomial(value) {
    return nearZero(value)
        ? new NormalizedPolynomial()
        : new NormalizedPolynomial([
            createTerm(value, [])
        ]);
}

function atomPolynomial(expression) {
    return new NormalizedPolynomial([
        createTerm(
            1,
            [{
                key:
                    costExpressionKey(
                        expression
                    ),
                expression,
                exponent: 1
            }]
        )
    ]);
}

function multiplyTerms(left, right) {
    const factors = new Map();

    for (const factor of [
        ...left.factors,
        ...right.factors
    ]) {
        const existing = factors.get(
            factor.key
        );

        factors.set(
            factor.key,
            existing == null
                ? factor
                : {
                    ...existing,
                    exponent:
                        existing.exponent +
                        factor.exponent
                }
        );
    }

    return createTerm(
        left.coefficient *
            right.coefficient,
        [...factors.values()]
    );
}

function createTerm(coefficient, factors) {
    const normalizedFactors = factors
        .filter(factor =>
            factor.exponent !== 0
        )
        .sort((left, right) =>
            left.key.localeCompare(
                right.key
            )
        );
    const key = normalizedFactors
        .map(factor =>
            `${factor.key}^${factor.exponent}`
        )
        .join("*");

    return {
        key,
        coefficient:
            normalizeNumber(coefficient),
        factors: normalizedFactors,
        degree:
            normalizedFactors.reduce(
                (sum, factor) =>
                    sum + factor.exponent,
                0
            )
    };
}

function combineTerms(terms) {
    const combined = new Map();

    for (const term of terms) {
        const normalized = createTerm(
            term.coefficient,
            term.factors
        );
        const existing = combined.get(
            normalized.key
        );

        combined.set(
            normalized.key,
            existing == null
                ? normalized
                : createTerm(
                    existing.coefficient +
                        normalized.coefficient,
                    existing.factors
                )
        );
    }

    return combined;
}

function freezeTerm(term) {
    return Object.freeze({
        key: term.key,
        coefficient: term.coefficient,
        degree: term.degree,
        factors:
            Object.freeze(
                term.factors.map(factor =>
                    Object.freeze({
                        ...factor
                    })
                )
            )
    });
}

function termToExpression(term, coefficient) {
    const factors = term.factors.map(factor =>
        factor.exponent === 1
            ? factor.expression
            : Cost.power(
                factor.expression,
                Cost.constant(
                    factor.exponent
                )
            )
    );

    if (
        coefficient !== 1 ||
        factors.length === 0
    ) {
        factors.unshift(
            Cost.constant(
                normalizeNumber(
                    coefficient
                )
            )
        );
    }

    return factors.length === 1
        ? factors[0]
        : Cost.product(factors);
}

function sumExpression(terms) {
    if (terms.length === 0) {
        return null;
    }

    return terms.length === 1
        ? terms[0]
        : Cost.sum(terms);
}

function withinLimits(polynomial, limits) {
    return (
        polynomial.terms.length <=
            limits.maxTerms &&
        polynomial.degree <=
            limits.maxDegree
    );
}

function normalizeNumber(value) {
    if (nearZero(value)) {
        return 0;
    }

    const nearest = Math.round(value);

    return Math.abs(value - nearest) <
        EPSILON
        ? nearest
        : Number(value.toPrecision(12));
}

function nearZero(value) {
    return Math.abs(value) < EPSILON;
}
