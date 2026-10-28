import {
    CostExpressionKind
} from "../algebra/CostExpression.js";
import {
    createUnknownOrder,
    exponentialOrder,
    factorialOrder,
    logarithmOfOrder,
    logarithmicOrder,
    multiplyOrders,
    polylogarithmicOrder,
    powerOrder,
    quasiPolynomialOrder,
    sumOrders,
    variableOrder
} from "../asymptotic/AsymptoticOrder.js";

const EPSILON = 1e-8;

/**
 * Familias que requieren hipótesis o cierres más fuertes que los teoremas
 * clásicos del solucionador principal. Cada resultado declara si es una
 * equivalencia ajustada o solamente una cota superior conservadora.
 */
export class AdvancedRecurrenceSolver {

    solveMixed(
        terms,
        toll,
        solveDecrement
    ) {
        if (
            terms.some(term =>
                term.constant == null ||
                term.constant < 0
            )
        ) {
            return unsupported(
                "CLRS_RECURRENCE_MIXED_REDUCTION",
                "La reducción mixta contiene una ramificación variable que todavía no admite una cota segura."
            );
        }

        const upperTerms =
            terms.map(term => ({
                ...term,
                relation:
                    term.relation.kind ===
                    "division"
                        ? Object.freeze({
                            kind: "decrement",
                            amount: 1,
                            offset: -1,
                            advancedUpperBound:
                                true
                        })
                        : term.relation
            }));
        const upper =
            solveDecrement(upperTerms);

        if (!upper.order.known) {
            return upper;
        }

        return solution({
            order: upper.order,
            method:
                "mixed-reduction-upper-bound",
            boundKind: "upper",
            characteristic:
                upper.characteristic,
            evidence: [
                "Cada subproblema divisivo se acotó por un subproblema de tamaño n - 1.",
                "La recurrencia transformada conserva coeficientes no negativos y domina a la original."
            ]
        });
    }

    solveVariableDecrement(
        terms,
        toll,
        measureVariable = null
    ) {
        if (terms.length !== 1) {
            return unsupported(
                "CLRS_RECURRENCE_VARIABLE_BRANCHING",
                "La ramificación variable avanzada requiere una única transición recursiva por nivel."
            );
        }

        const [term] = terms;
        const profile =
            monomialCoefficientProfile(
                term.coefficient
            );
        const amount =
            term.relation.amount;

        if (
            profile == null ||
            profile.degree <= 0 ||
            profile.multiplier < 1 ||
            measureVariable == null ||
            profile.variable !==
                measureVariable ||
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return unsupported(
                "CLRS_RECURRENCE_VARIABLE_BRANCHING",
                "El coeficiente variable debe ser un monomio positivo de la medida y la reducción debe ser un decremento constante."
            );
        }

        const factorialExponent =
            profile.degree / amount;
        const polynomialExponent =
            profile.degree *
            (amount - 1) /
            (2 * amount);
        const exponentialBase =
            Math.pow(
                profile.multiplier,
                1 / amount
            );
        const factors = [
            factorialOrder(
                "n",
                normalized(
                    factorialExponent
                )
            )
        ];

        if (
            Math.abs(
                exponentialBase - 1
            ) > EPSILON
        ) {
            factors.push(
                exponentialOrder(
                    normalized(
                        exponentialBase
                    )
                )
            );
        }

        if (polynomialExponent > EPSILON) {
            factors.push(
                powerOrder(
                    variableOrder("n"),
                    normalized(
                        polynomialExponent
                    )
                )
            );
        }

        const homogeneous =
            multiplyOrders(factors);

        return solution({
            order:
                sumOrders([
                    homogeneous,
                    toll
                ]),
            method:
                amount === 1
                    ? "factorial-product"
                    : "generalized-factorial-product",
            characteristic:
                Object.freeze({
                    kind:
                        "factorial-product",
                    decrement: amount,
                    degree:
                        profile.degree,
                    multiplier:
                        profile.multiplier
                }),
            evidence: [
                `El coeficiente recursivo se redujo al monomio ${formatMonomial(profile)}.`,
                `El producto toma un factor cada ${amount} unidades de la medida.`
            ]
        });
    }

    solveVariableDivision(
        terms,
        toll,
        measureVariable = null
    ) {
        if (terms.length !== 1) {
            return unsupported(
                "CLRS_RECURRENCE_VARIABLE_BRANCHING",
                "La ramificación variable divisiva requiere una única transición recursiva por nivel."
            );
        }

        const [term] = terms;
        const profile =
            monomialCoefficientProfile(
                term.coefficient
            );
        const ratio =
            term.relation.ratio;

        if (
            profile == null ||
            profile.degree <= 0 ||
            profile.multiplier <= 0 ||
            measureVariable == null ||
            profile.variable !==
                measureVariable ||
            !Number.isFinite(ratio) ||
            ratio <= 0 ||
            ratio >= 1
        ) {
            return unsupported(
                "CLRS_RECURRENCE_VARIABLE_BRANCHING",
                "La recurrencia divisiva variable requiere un monomio positivo y una razón constante entre cero y uno."
            );
        }

        const divisor = 1 / ratio;
        const logarithmicCoefficient =
            profile.degree / 2;
        const polynomialExponent =
            profile.degree / 2 +
            Math.log(
                profile.multiplier
            ) /
            Math.log(divisor);
        const homogeneous =
            quasiPolynomialOrder(
                "n",
                {
                    logarithmicCoefficient:
                        normalized(
                            logarithmicCoefficient
                        ),
                    polynomialExponent:
                        normalized(
                            polynomialExponent
                        ),
                    logBase:
                        normalized(divisor)
                }
            );

        return solution({
            order:
                sumOrders([
                    homogeneous,
                    toll
                ]),
            method:
                "quasi-polynomial-product",
            characteristic:
                Object.freeze({
                    kind:
                        "quasi-polynomial",
                    ratio,
                    degree:
                        profile.degree,
                    multiplier:
                        profile.multiplier
                }),
            evidence: [
                `La profundidad recursiva es log_${normalized(divisor)} n.`,
                `Los coeficientes ${formatMonomial(profile)} de cada nivel forman un producto cuasipolinómico.`
            ]
        });
    }

    solvePowerReduction(
        terms,
        toll,
        measureVariable = null
    ) {
        if (!toll.known) {
            return solution({
                order: toll,
                method: null
            });
        }

        if (measureVariable == null) {
            return unsupported(
                "CLRS_RECURRENCE_ARGUMENT_UNSUPPORTED",
                "La reducción de potencia requiere una medida que sea un parámetro directo de la función."
            );
        }

        const exponent = commonPowerExponent(terms);
        const branches = constantBranches(terms);
        const profile = polylogTollProfile(toll);

        if (
            exponent == null ||
            branches == null ||
            profile == null
        ) {
            return unsupported(
                "CLRS_RECURRENCE_ARGUMENT_UNSUPPORTED",
                "La recurrencia de potencia requiere subproblemas n^r con una razón común, coeficientes constantes no negativos y un costo local polinómico o polilogarítmico."
            );
        }

        const characteristic = Object.freeze({
            kind: "power-reduction",
            exponent,
            branches,
            transformedExponent:
                branches > 1
                    ? normalized(
                        Math.log(branches) /
                        Math.log(1 / exponent)
                    )
                    : 0
        });
        const order = solvePowerToll({
            toll,
            profile,
            exponent,
            branches
        });

        return solution({
            order,
            method: "power-reduction",
            characteristic,
            evidence: [
                `La medida recursiva se transforma como n^${normalized(exponent)} en cada nivel.`,
                "El cambio de variable m = log n reduce la recurrencia a una división geométrica sobre m."
            ]
        });
    }
}

function solvePowerToll({
    toll,
    profile,
    exponent,
    branches
}) {
    if (profile.polynomial > EPSILON) {
        return toll;
    }

    if (profile.polynomial < -EPSILON) {
        return createUnknownOrder(
            "CLRS_RECURRENCE_ARGUMENT_UNSUPPORTED",
            "El costo local de una recurrencia de potencia no puede decrecer polinómicamente."
        );
    }

    if (branches < 1 - EPSILON) {
        return toll;
    }

    if (Math.abs(branches - 1) <= EPSILON) {
        return profile.logarithmic <= EPSILON
            ? logarithmOfOrder(
                logarithmicOrder("n")
            )
            : polylogarithmicOrder(
                "n",
                0,
                profile.logarithmic
            );
    }

    const transformedExponent = Math.log(branches) /
        Math.log(1 / exponent);

    if (
        profile.logarithmic >
        transformedExponent + EPSILON
    ) {
        return toll;
    }

    return polylogarithmicOrder(
        "n",
        0,
        normalized(
            Math.abs(
                profile.logarithmic -
                transformedExponent
            ) <= EPSILON
                ? transformedExponent + 1
                : transformedExponent
        )
    );
}

function commonPowerExponent(terms) {
    if (terms.length === 0) {
        return null;
    }

    const [first] = terms;
    const exponent = first.relation.exponent;

    return !Number.isFinite(exponent) ||
        exponent <= EPSILON ||
        exponent >= 1 - EPSILON ||
        terms.some(term =>
            Math.abs(
                term.relation.exponent - exponent
            ) > EPSILON
        )
        ? null
        : exponent;
}

function constantBranches(terms) {
    const values = terms.map(term =>
        numericCoefficient(term.coefficient)
    );

    return values.some(value =>
        value == null || value < 0
    )
        ? null
        : values.reduce(
            (total, value) => total + value,
            0
        );
}

function numericCoefficient(expression) {
    switch (expression.kind) {
        case CostExpressionKind.CONSTANT:
            return expression.value;
        case CostExpressionKind.SYMBOL:
            return expression.name === "c"
                ? 1
                : null;
        case CostExpressionKind.GROUP:
            return numericCoefficient(
                expression.expression
            );
        case CostExpressionKind.SUM: {
            const values = expression.terms.map(
                numericCoefficient
            );

            return values.some(value => value == null)
                ? null
                : values.reduce(
                    (total, value) => total + value,
                    0
                );
        }
        case CostExpressionKind.DIFFERENCE: {
            const left = numericCoefficient(
                expression.left
            );
            const right = numericCoefficient(
                expression.right
            );

            return left == null || right == null
                ? null
                : left - right;
        }
        case CostExpressionKind.PRODUCT: {
            const values = expression.factors.map(
                numericCoefficient
            );

            return values.some(value => value == null)
                ? null
                : values.reduce(
                    (total, value) => total * value,
                    1
                );
        }
        case CostExpressionKind.QUOTIENT: {
            const numerator = numericCoefficient(
                expression.numerator
            );
            const denominator = numericCoefficient(
                expression.denominator
            );

            return numerator == null ||
                denominator == null ||
                Math.abs(denominator) <= EPSILON
                ? null
                : numerator / denominator;
        }
        default:
            return null;
    }
}

function polylogTollProfile(order) {
    if (
        !order.known ||
        order.terms.length !== 1
    ) {
        return null;
    }

    const [term] = order.terms;
    const polynomialNames = Object.keys(
        term.polynomial
    );
    const logarithmicNames = Object.keys(
        term.logarithmic
    );

    if (
        term.specialFactors.length > 0 ||
        polynomialNames.some(name => name !== "n") ||
        logarithmicNames.some(name => name !== "n")
    ) {
        return null;
    }

    return {
        polynomial: term.polynomial.n ?? 0,
        logarithmic: term.logarithmic.n ?? 0
    };
}

function monomialCoefficientProfile(expression) {
    switch (expression.kind) {
        case CostExpressionKind.CONSTANT:
            return positiveConstantProfile(
                expression.value
            );
        case CostExpressionKind.SYMBOL:
            return expression.name === "c"
                ? positiveConstantProfile(1)
                : profile({
                    multiplier: 1,
                    degree: 1,
                    variable:
                        expression.name
                });
        case CostExpressionKind.GROUP:
            return monomialCoefficientProfile(
                expression.expression
            );
        case CostExpressionKind.PRODUCT:
            return combineProductProfiles(
                expression.factors.map(
                    monomialCoefficientProfile
                )
            );
        case CostExpressionKind.POWER:
            return powerProfile(expression);
        case CostExpressionKind.MAXIMUM:
            return maximumProfile(
                expression.expressions
            );
        case CostExpressionKind.CALL:
            return expression.name === "max"
                ? maximumProfile(
                    expression.args
                )
                : null;
        default:
            return null;
    }
}

function positiveConstantProfile(value) {
    return Number.isFinite(value) &&
        value > 0
        ? profile({
            multiplier: value,
            degree: 0,
            variable: null
        })
        : null;
}

function combineProductProfiles(profiles) {
    if (profiles.some(item => item == null)) {
        return null;
    }

    const variables =
        new Set(
            profiles
                .map(item => item.variable)
                .filter(Boolean)
        );

    if (variables.size > 1) {
        return null;
    }

    return profile({
        multiplier:
            profiles.reduce(
                (value, item) =>
                    value *
                    item.multiplier,
                1
            ),
        degree:
            profiles.reduce(
                (value, item) =>
                    value + item.degree,
                0
            ),
        variable:
            [...variables][0] ?? null
    });
}

function powerProfile(expression) {
    if (
        expression.exponent.kind !==
        CostExpressionKind.CONSTANT ||
        !Number.isFinite(
            expression.exponent.value
        ) ||
        expression.exponent.value <= 0
    ) {
        return null;
    }

    const base =
        monomialCoefficientProfile(
            expression.base
        );

    return base == null
        ? null
        : profile({
            multiplier:
                Math.pow(
                    base.multiplier,
                    expression.exponent
                        .value
                ),
            degree:
                base.degree *
                expression.exponent.value,
            variable: base.variable
        });
}

function maximumProfile(expressions) {
    const nonZero =
        expressions.filter(expression =>
            !(
                expression.kind ===
                    CostExpressionKind.CONSTANT &&
                expression.value === 0
            )
        );

    if (nonZero.length !== 1) {
        return null;
    }

    return monomialCoefficientProfile(
        nonZero[0]
    );
}

function profile({
    multiplier,
    degree,
    variable
}) {
    if (
        !Number.isFinite(multiplier) ||
        !Number.isFinite(degree)
    ) {
        return null;
    }

    return Object.freeze({
        multiplier,
        degree,
        variable
    });
}

function solution({
    order,
    method,
    boundKind = "tight",
    characteristic = null,
    evidence = []
}) {
    return {
        order,
        method,
        boundKind,
        characteristic,
        evidence
    };
}

function unsupported(code, message) {
    return solution({
        order:
            createUnknownOrder(
                code,
                message
            ),
        method: null
    });
}

function formatMonomial(value) {
    const coefficient =
        Math.abs(
            value.multiplier - 1
        ) < EPSILON
            ? ""
            : String(
                normalized(
                    value.multiplier
                )
            );
    const power = value.degree === 1
        ? "n"
        : `n^${normalized(value.degree)}`;

    return coefficient + power;
}

function normalized(value) {
    const nearest = Math.round(value);

    return Math.abs(value - nearest) < EPSILON
        ? nearest
        : Number(value.toFixed(6));
}
