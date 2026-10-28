import {
    CostExpressionKind
} from "../algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";

const MAX_POLYNOMIAL_DEGREE = 2;

/**
 * Reduce una sumatoria inclusiva de índice unitario cuando su sumando es un
 * polinomio de grado <= 2 en el índice. Las fórmulas se expresan mediante el
 * tamaño efectivo del intervalo, por lo que también son válidas cuando el
 * límite simbólico deja el ciclo vacío.
 */
export function simplifySymbolicSummation(
    expression,
    simplify
) {
    const lower = simplify(expression.lower);
    const upper = simplify(expression.upper);
    const term = normalizeSummand(
        simplify(expression.term),
        expression.index
    );
    const normalized = Cost.summation(
        expression.index,
        lower,
        upper,
        term,
        expression.step
    );

    if (
        expression.step !== 1 ||
        lower.kind !==
            CostExpressionKind.CONSTANT
    ) {
        return normalized;
    }

    const polynomial = polynomialOf(
        term,
        expression.index
    );

    if (polynomial == null) {
        return normalized;
    }

    const translated =
        translatePolynomialToZero(
            polynomial,
            lower
        );
    const count = inclusiveCount(
        lower,
        upper
    );
    const powers = powerSums(count);
    const terms = [];

    for (
        const [degree, coefficient]
        of translated.entries()
    ) {
        const powerSum = powers.get(degree);

        if (powerSum == null) {
            return normalized;
        }

        terms.push(
            degree === 0
                ? Cost.product([
                    coefficient,
                    powerSum
                ])
                : Cost.product([
                    coefficient,
                    powerSum
                ])
        );
    }

    return simplify(
        Cost.sum(terms)
    );
}

function inclusiveCount(lower, upper) {
    const base = isZero(lower) &&
        upper.kind ===
        CostExpressionKind.DIFFERENCE &&
        upper.right.kind ===
            CostExpressionKind.CONSTANT &&
        upper.right.value === 1
        ? upper.left
        : Cost.sum([
            Cost.difference(
                upper,
                lower
            ),
            Cost.constant(1)
        ]);

    return Cost.maximum([
        Cost.constant(0),
        base
    ]);
}

function translatePolynomialToZero(
    polynomial,
    lower
) {
    const translated = new Map();

    for (const [degree, coefficient] of polynomial) {
        for (
            let translatedDegree = 0;
            translatedDegree <= degree;
            translatedDegree++
        ) {
            const multiplier =
                binomialCoefficient(
                    degree,
                    translatedDegree
                );
            const lowerPower =
                degree - translatedDegree;
            const shift = lowerPower === 0
                ? Cost.constant(multiplier)
                : Cost.product([
                    Cost.constant(multiplier),
                    Cost.power(
                        lower,
                        Cost.constant(lowerPower)
                    )
                ]);
            const translatedCoefficient =
                Cost.product([
                    coefficient,
                    shift
                ]);
            const previous = translated.get(
                translatedDegree
            );

            translated.set(
                translatedDegree,
                previous == null
                    ? translatedCoefficient
                    : Cost.sum([
                        previous,
                        translatedCoefficient
                    ])
            );
        }
    }

    return translated;
}

function binomialCoefficient(n, k) {
    if (k === 0 || k === n) {
        return 1;
    }

    return n === 2 && k === 1
        ? 2
        : 1;
}

function powerSums(count) {
    const previous = Cost.difference(
        count,
        Cost.constant(1)
    );

    return new Map([
        [0, count],
        [1, Cost.quotient(
            Cost.product([
                count,
                previous
            ]),
            Cost.constant(2)
        )],
        [2, Cost.quotient(
            Cost.product([
                count,
                previous,
                Cost.difference(
                    Cost.product([
                        Cost.constant(2),
                        count
                    ]),
                    Cost.constant(1)
                )
            ]),
            Cost.constant(6)
        )]
    ]);
}

function polynomialOf(expression, index) {
    if (!containsIndex(expression, index)) {
        return new Map([[0, expression]]);
    }

    if (
        expression.kind ===
        CostExpressionKind.SYMBOL
    ) {
        return expression.name === index
            ? new Map([[1, Cost.constant(1)]])
            : new Map([[0, expression]]);
    }

    switch (expression.kind) {
        case CostExpressionKind.GROUP:
            return polynomialOf(
                expression.expression,
                index
            );
        case CostExpressionKind.SUM:
            return expression.terms.reduce(
                (result, term) => addPolynomials(
                    result,
                    polynomialOf(term, index)
                ),
                new Map()
            );
        case CostExpressionKind.DIFFERENCE:
            return addPolynomials(
                polynomialOf(expression.left, index),
                scalePolynomial(
                    polynomialOf(
                        expression.right,
                        index
                    ),
                    Cost.constant(-1)
                )
            );
        case CostExpressionKind.PRODUCT:
            return expression.factors.reduce(
                (result, factor) => multiplyPolynomials(
                    result,
                    polynomialOf(factor, index)
                ),
                new Map([[0, Cost.constant(1)]])
            );
        case CostExpressionKind.QUOTIENT:
            return containsIndex(
                expression.denominator,
                index
            )
                ? null
                : scalePolynomial(
                    polynomialOf(
                        expression.numerator,
                        index
                    ),
                    Cost.quotient(
                        Cost.constant(1),
                        expression.denominator
                    )
                );
        case CostExpressionKind.POWER:
            return powerPolynomial(
                expression,
                index
            );
        default:
            return null;
    }
}

function powerPolynomial(expression, index) {
    if (
        expression.exponent.kind !==
            CostExpressionKind.CONSTANT ||
        !Number.isInteger(
            expression.exponent.value
        ) ||
        expression.exponent.value < 0 ||
        expression.exponent.value >
            MAX_POLYNOMIAL_DEGREE
    ) {
        return null;
    }

    let result = new Map([
        [0, Cost.constant(1)]
    ]);
    const base = polynomialOf(
        expression.base,
        index
    );

    for (
        let power = 0;
        power < expression.exponent.value;
        power++
    ) {
        result = multiplyPolynomials(
            result,
            base
        );
    }

    return result;
}

function addPolynomials(left, right) {
    if (left == null || right == null) {
        return null;
    }

    const result = new Map(left);

    for (const [degree, coefficient] of right) {
        result.set(
            degree,
            result.has(degree)
                ? Cost.sum([
                    result.get(degree),
                    coefficient
                ])
                : coefficient
        );
    }

    return result;
}

function scalePolynomial(polynomial, scalar) {
    if (polynomial == null) {
        return null;
    }

    return new Map(
        [...polynomial.entries()].map(
            ([degree, coefficient]) => [
                degree,
                Cost.product([
                    scalar,
                    coefficient
                ])
            ]
        )
    );
}

function multiplyPolynomials(left, right) {
    if (left == null || right == null) {
        return null;
    }

    const result = new Map();

    for (const [leftDegree, leftCoefficient] of left) {
        for (const [rightDegree, rightCoefficient] of right) {
            const degree = leftDegree + rightDegree;

            if (degree > MAX_POLYNOMIAL_DEGREE) {
                return null;
            }

            const coefficient = Cost.product([
                leftCoefficient,
                rightCoefficient
            ]);

            result.set(
                degree,
                result.has(degree)
                    ? Cost.sum([
                        result.get(degree),
                        coefficient
                    ])
                    : coefficient
            );
        }
    }

    return result;
}

function normalizeSummand(expression, index) {
    if (
        expression.kind ===
        CostExpressionKind.MAXIMUM
    ) {
        const values = expression.expressions.map(value =>
            normalizeSummand(value, index)
        );
        const zero = values.find(value => isZero(value));
        const nonNegative = values.find(value =>
            value !== zero &&
            isNonNegativeIndexExpression(value, index)
        );

        return zero != null &&
            nonNegative != null &&
            values.length === 2
            ? nonNegative
            : Cost.maximum(values);
    }

    switch (expression.kind) {
        case CostExpressionKind.SUM:
            return Cost.sum(
                expression.terms.map(value =>
                    normalizeSummand(value, index)
                )
            );
        case CostExpressionKind.DIFFERENCE:
            return Cost.difference(
                normalizeSummand(
                    expression.left,
                    index
                ),
                normalizeSummand(
                    expression.right,
                    index
                )
            );
        case CostExpressionKind.PRODUCT:
            return Cost.product(
                expression.factors.map(value =>
                    normalizeSummand(value, index)
                )
            );
        case CostExpressionKind.QUOTIENT:
            return Cost.quotient(
                normalizeSummand(
                    expression.numerator,
                    index
                ),
                normalizeSummand(
                    expression.denominator,
                    index
                )
            );
        case CostExpressionKind.GROUP:
            return Cost.group(
                normalizeSummand(
                    expression.expression,
                    index
                )
            );
        case CostExpressionKind.POWER:
            return Cost.power(
                normalizeSummand(
                    expression.base,
                    index
                ),
                normalizeSummand(
                    expression.exponent,
                    index
                )
            );
        default:
            return expression;
    }
}

function isNonNegativeIndexExpression(expression, index) {
    const polynomial = polynomialOf(expression, index);

    if (
        polynomial == null ||
        polynomial.size > 2 ||
        polynomial.has(2)
    ) {
        return false;
    }

    const indexCoefficient = polynomial.get(1);
    const constant = polynomial.get(0) ??
        Cost.constant(0);

    return indexCoefficient?.kind ===
        CostExpressionKind.CONSTANT &&
        indexCoefficient.value === 1 &&
        constant.kind ===
            CostExpressionKind.CONSTANT &&
        constant.value >= 0;
}

function containsIndex(expression, index) {
    if (
        expression.kind ===
        CostExpressionKind.SYMBOL
    ) {
        return expression.name === index;
    }

    if (
        expression == null ||
        typeof expression !== "object"
    ) {
        return false;
    }

    return Object.entries(expression)
        .some(([key, value]) => {
            if (key === "kind" || key === "index") {
                return false;
            }

            return Array.isArray(value)
                ? value.some(item =>
                    containsIndex(item, index)
                )
                : value != null &&
                    typeof value === "object" &&
                    containsIndex(value, index);
        });
}

function isZero(expression) {
    return expression.kind ===
        CostExpressionKind.CONSTANT &&
        expression.value === 0;
}
