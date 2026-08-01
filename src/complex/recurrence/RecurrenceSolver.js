import {
    CostExpressionKind
} from "../algebra/CostExpression.js";
import {
    createUnknownOrder,
    exponentialOrder,
    factorialOrder,
    multiplyOrders,
    polylogarithmicOrder,
    sumOrders,
    variableOrder
} from "../asymptotic/AsymptoticOrder.js";
import {
    createRecurrenceAnalysis,
    RecurrenceAnalysisStatus
} from "./RecurrenceAnalysis.js";
import {
    RecurrenceExtractor
} from "./RecurrenceExtractor.js";

const EPSILON = 1e-8;

export class RecurrenceSolver {

    constructor(options = {}) {
        this.extractor =
            options.extractor ??
            new RecurrenceExtractor();
    }

    solve(
        expression,
        {
            functionName,
            classify,
            measure = null,
            location = null
        }
    ) {
        const forms =
            this.extractor.extract(
                expression,
                functionName
            );
        const recursiveForms =
            forms.filter(
                form =>
                    form.recursive
            );

        if (
            recursiveForms.length === 0
        ) {
            return Object.freeze({
                applicable: false,
                order: null,
                analysis: null
            });
        }

        const solutions =
            forms.map(form =>
                this.solveForm(
                    form,
                    classify
                )
            );
        const order =
            sumOrders(
                solutions.map(
                    solution =>
                        solution.order
                )
            );
        const failed =
            solutions.find(
                solution =>
                    !solution.order.known
            );
        const methods =
            new Set(
                solutions
                    .map(
                        solution =>
                            solution.method
                    )
                    .filter(Boolean)
            );
        const method =
            methods.size === 1
                ? [...methods][0]
                : methods.size > 1
                    ? "branch-combination"
                    : null;
        const analysis =
            createRecurrenceAnalysis({
                status:
                    order.known
                        ? RecurrenceAnalysisStatus
                            .SOLVED
                        : RecurrenceAnalysisStatus
                            .UNSUPPORTED,
                order,
                method,
                code:
                    failed?.order.code ??
                    null,
                message:
                    failed?.order.message ??
                    null,
                measure,
                branches:
                    forms.length,
                location
            });

        return Object.freeze({
            applicable: true,
            order,
            analysis
        });
    }

    solveForm(form, classify) {
        if (form.code != null) {
            return solution(
                createUnknownOrder(
                    form.code,
                    form.message
                )
            );
        }

        const toll =
            classify(form.toll);
        const terms =
            form.terms
                .map(term => ({
                    ...term,
                    constant:
                        numericConstant(
                            term.coefficient
                        ),
                    coefficientOrder:
                        classify(
                            term.coefficient
                        )
                }))
                .filter(term =>
                    term.constant !== 0
                );

        if (terms.length === 0) {
            return solution(
                toll,
                "base-case"
            );
        }

        if (
            terms.every(term =>
                term.relation.kind ===
                "division"
            )
        ) {
            return this.solveDivision(
                terms,
                toll
            );
        }

        if (
            terms.every(term =>
                term.relation.kind ===
                "decrement"
            )
        ) {
            return this.solveDecrement(
                terms,
                toll
            );
        }

        return solution(
            createUnknownOrder(
                "CLRS_RECURRENCE_MIXED_REDUCTION",
                "La recurrencia mezcla reducciones aditivas y divisiones del tamaño del problema."
            )
        );
    }

    solveDivision(terms, toll) {
        if (!toll.known) {
            return solution(toll);
        }

        if (
            terms.some(term =>
                term.constant == null ||
                term.constant < 0
            )
        ) {
            return solution(
                createUnknownOrder(
                    "CLRS_RECURRENCE_VARIABLE_BRANCHING",
                    "El número de subproblemas de una recurrencia divide y vencerás debe ser constante."
                )
            );
        }

        const characteristic =
            solveDivisionExponent(
                terms
            );

        if (characteristic == null) {
            return solution(
                createUnknownOrder(
                    "CLRS_RECURRENCE_DIVISION_UNSUPPORTED",
                    "No se pudo calcular el exponente característico de la recurrencia."
                )
            );
        }

        const order =
            solvePolynomialToll(
                toll,
                characteristic
            );
        const ratios =
            new Set(
                terms.map(term =>
                    rounded(
                        term.relation
                            .ratio
                    )
                )
            );

        return solution(
            order,
            ratios.size === 1
                ? "master-theorem"
                : "akra-bazzi"
        );
    }

    solveDecrement(terms, toll) {
        if (!toll.known) {
            return solution(toll);
        }

        const variableTerms =
            terms.filter(term =>
                term.constant == null
            );

        if (variableTerms.length > 0) {
            return this.solveVariableBranching(
                terms,
                toll
            );
        }

        const total =
            terms.reduce(
                (sum, term) =>
                    sum +
                    term.constant,
                0
            );

        if (
            approximatelyEqual(
                total,
                1
            )
        ) {
            return solution(
                accumulateToll(toll),
                "substitution"
            );
        }

        if (total < 1) {
            return solution(
                toll,
                "substitution"
            );
        }

        const base =
            solveCharacteristicBase(
                terms
            );

        if (base == null) {
            return solution(
                createUnknownOrder(
                    "CLRS_RECURRENCE_CHARACTERISTIC_UNSUPPORTED",
                    "No se pudo calcular la raíz dominante de la recurrencia aditiva."
                )
            );
        }

        const homogeneous =
            exponentialOrder(
                rounded(base)
            );

        return solution(
            combineCharacteristicAndToll(
                homogeneous,
                toll,
                base
            ),
            "characteristic-root"
        );
    }

    solveVariableBranching(
        terms,
        toll
    ) {
        if (terms.length !== 1) {
            return solution(
                createUnknownOrder(
                    "CLRS_RECURRENCE_VARIABLE_BRANCHING",
                    "La ramificación variable sólo se resuelve cuando existe una llamada recursiva por nivel."
                )
            );
        }

        const [term] =
            terms;

        if (
            !approximatelyEqual(
                term.relation.amount,
                1
            )
        ) {
            return solution(
                createUnknownOrder(
                    "CLRS_RECURRENCE_VARIABLE_BRANCHING",
                    "La ramificación variable sólo se resuelve para reducciones unitarias del tamaño del problema."
                )
            );
        }

        const growth =
            polynomialExponent(
                term.coefficientOrder
            );

        if (
            growth == null ||
            growth <= 0
        ) {
            return solution(
                createUnknownOrder(
                    "CLRS_RECURRENCE_VARIABLE_BRANCHING",
                    "No se pudo reducir el coeficiente variable a una potencia del tamaño del problema."
                )
            );
        }

        const factorial =
            factorialOrder(
                "n",
                rounded(growth)
            );

        return solution(
            sumOrders([
                factorial,
                toll
            ]),
            "factorial-product"
        );
    }
}

function solution(
    order,
    method = null
) {
    return {
        order,
        method
    };
}

function numericConstant(expression) {
    switch (expression.kind) {
        case CostExpressionKind.CONSTANT:
            return expression.value;
        case CostExpressionKind.SYMBOL:
            return expression.name === "c"
                ? 1
                : null;
        case CostExpressionKind.GROUP:
            return numericConstant(
                expression.expression
            );
        case CostExpressionKind.SUM: {
            const values =
                expression.terms.map(
                    numericConstant
                );

            return values.some(
                value =>
                    value == null
            )
                ? null
                : values.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                );
        }
        case CostExpressionKind.DIFFERENCE: {
            const left =
                numericConstant(
                    expression.left
                );
            const right =
                numericConstant(
                    expression.right
                );

            return (
                left == null ||
                right == null
            )
                ? null
                : left - right;
        }
        case CostExpressionKind.PRODUCT: {
            const values =
                expression.factors.map(
                    numericConstant
                );

            return values.some(
                value =>
                    value == null
            )
                ? null
                : values.reduce(
                    (product, value) =>
                        product * value,
                    1
                );
        }
        case CostExpressionKind.QUOTIENT: {
            const numerator =
                numericConstant(
                    expression.numerator
                );
            const denominator =
                numericConstant(
                    expression.denominator
                );

            return (
                numerator == null ||
                denominator == null ||
                denominator === 0
            )
                ? null
                : numerator /
                    denominator;
        }
        default:
            return null;
    }
}

function solveDivisionExponent(terms) {
    const equation =
        exponent =>
            terms.reduce(
                (sum, term) =>
                    sum +
                    term.constant *
                    Math.pow(
                        term.relation.ratio,
                        exponent
                    ),
                0
            );

    if (equation(0) <= 1) {
        return 0;
    }

    let lower = 0;
    let upper = 1;

    while (
        equation(upper) > 1 &&
        upper < 1024
    ) {
        upper *= 2;
    }

    if (upper >= 1024) {
        return null;
    }

    for (
        let iteration = 0;
        iteration < 100;
        iteration++
    ) {
        const middle =
            (lower + upper) / 2;

        if (equation(middle) > 1) {
            lower = middle;
        } else {
            upper = middle;
        }
    }

    return rounded(
        (lower + upper) / 2
    );
}

function solvePolynomialToll(
    toll,
    characteristic
) {
    const comparable =
        polynomialLogProfile(
            toll
        );
    const critical =
        polylogarithmicOrder(
            "n",
            characteristic,
            0
        );

    if (comparable == null) {
        return sumOrders([
            critical,
            toll
        ]);
    }

    if (
        comparable.polynomial <
        characteristic - EPSILON
    ) {
        return critical;
    }

    if (
        comparable.polynomial >
        characteristic + EPSILON
    ) {
        return toll;
    }

    return polylogarithmicOrder(
        "n",
        characteristic,
        comparable.logarithmic + 1
    );
}

function polynomialLogProfile(order) {
    if (
        !order.known ||
        order.terms.length !== 1
    ) {
        return null;
    }

    const [term] =
        order.terms;
    const polynomialNames =
        Object.keys(
            term.polynomial
        );
    const logarithmicNames =
        Object.keys(
            term.logarithmic
        );

    if (
        term.specialFactors.length > 0 ||
        polynomialNames.some(
            name =>
                name !== "n"
        ) ||
        logarithmicNames.some(
            name =>
                name !== "n"
        )
    ) {
        return null;
    }

    return {
        polynomial:
            term.polynomial.n ?? 0,
        logarithmic:
            term.logarithmic.n ?? 0
    };
}

function polynomialExponent(order) {
    const profile =
        polynomialLogProfile(order);

    if (
        profile == null ||
        profile.logarithmic !== 0
    ) {
        return null;
    }

    return profile.polynomial;
}

function accumulateToll(toll) {
    if (
        toll.terms.some(term =>
            term.specialFactors
                .length > 0
        )
    ) {
        return toll;
    }

    return multiplyOrders([
        variableOrder("n"),
        toll
    ]);
}

function solveCharacteristicBase(terms) {
    const equation =
        base =>
            terms.reduce(
                (sum, term) =>
                    sum +
                    term.constant /
                    Math.pow(
                        base,
                        term.relation.amount
                    ),
                0
            );
    let lower = 1;
    let upper = 2;

    while (
        equation(upper) > 1 &&
        upper < 1e12
    ) {
        upper *= 2;
    }

    if (upper >= 1e12) {
        return null;
    }

    for (
        let iteration = 0;
        iteration < 100;
        iteration++
    ) {
        const middle =
            (lower + upper) / 2;

        if (equation(middle) > 1) {
            lower = middle;
        } else {
            upper = middle;
        }
    }

    return (lower + upper) / 2;
}

function combineCharacteristicAndToll(
    homogeneous,
    toll,
    base
) {
    const tollBase =
        exponentialBase(toll);

    if (
        tollBase != null &&
        approximatelyEqual(
            tollBase,
            base
        )
    ) {
        return multiplyOrders([
            variableOrder("n"),
            toll
        ]);
    }

    return sumOrders([
        homogeneous,
        toll
    ]);
}

function exponentialBase(order) {
    if (
        !order.known ||
        order.terms.length !== 1 ||
        order.terms[0]
            .specialFactors
            .length !== 1
    ) {
        return null;
    }

    const [factor] =
        order.terms[0]
            .specialFactors;

    return (
        factor.type ===
            "exponential" &&
        Number.isFinite(factor.base)
    )
        ? factor.base
        : null;
}

function rounded(value) {
    const nearestInteger =
        Math.round(value);

    if (
        approximatelyEqual(
            value,
            nearestInteger
        )
    ) {
        return nearestInteger;
    }

    return Number(
        value.toFixed(6)
    );
}

function approximatelyEqual(
    left,
    right
) {
    return Math.abs(
        left - right
    ) < EPSILON;
}
