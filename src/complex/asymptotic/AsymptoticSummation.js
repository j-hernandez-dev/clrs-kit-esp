import {
    CostExpressionKind,
    costExpressionKey
} from "../algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    simplifyCostExpression
} from "../algebra/CostExpressionSimplifier.js";
import {
    createGrowthTerm,
    multiplyGrowthTerms
} from "./GrowthTerm.js";
import {
    createKnownOrder
} from "./AsymptoticOrder.js";

const EPSILON = 1e-10;

/**
 * Clasifica sumatorias de paso unitario cuyo intervalo crece linealmente con
 * una medida conocida. Opera sobre los monomios ya clasificados para poder
 * cerrar de manera uniforme familias polinómicas, armónicas y logarítmicas.
 * Las formas con factores especiales se conservan salvo la progresión
 * geométrica explícita b^i, cuya razón debe ser una constante positiva.
 */
export function classifyAsymptoticSummation(
    expression,
    {
        classifyExpression,
        context = {}
    }
) {
    const lower = simplifyCostExpression(
        expression.lower
    );

    if (
        expression.step !== 1 ||
        lower.kind !==
            CostExpressionKind.CONSTANT ||
        !Number.isInteger(lower.value) ||
        containsSymbol(
            expression.upper,
            expression.index
        )
    ) {
        return null;
    }

    const upperOrder = classifyExpression(
        expression.upper,
        context
    );

    if (!upperOrder.known) {
        return upperOrder;
    }

    const boundName = linearBoundName(
        upperOrder
    );

    if (boundName == null) {
        return null;
    }

    const scopedContext = boundIndexContext(
        context,
        expression.index
    );
    const termOrder = classifyExpression(
        expression.term,
        scopedContext
    );

    if (!termOrder.known) {
        return termOrder;
    }

    const terms = [];

    for (const term of termOrder.terms) {
        const classified = classifySummationTerm({
            term,
            index: expression.index,
            lower: lower.value,
            boundName,
            classifyExpression,
            context: scopedContext
        });

        if (classified == null) {
            return null;
        }

        terms.push(classified);
    }

    return createKnownOrder(terms);
}

function classifySummationTerm({
    term,
    index,
    lower,
    boundName,
    classifyExpression,
    context
}) {
    const geometric = classifyGeometricTerm({
        term,
        index,
        lower,
        boundName,
        classifyExpression,
        context
    });

    if (geometric !== undefined) {
        return geometric;
    }

    if (term.specialFactors.length > 0) {
        return null;
    }

    const polynomialExponent =
        term.polynomial[index] ?? 0;
    const logarithmicExponent =
        term.logarithmic[index] ?? 0;

    if (
        !Number.isFinite(polynomialExponent) ||
        !Number.isFinite(logarithmicExponent) ||
        logarithmicExponent < 0 ||
        (
            (polynomialExponent < 0 ||
                logarithmicExponent > 0) &&
            lower < 1
        )
    ) {
        return null;
    }

    const polynomial = withoutPower(
        term.polynomial,
        index
    );
    const logarithmic = withoutPower(
        term.logarithmic,
        index
    );

    if (polynomialExponent > -1 + EPSILON) {
        addPower(
            polynomial,
            boundName,
            polynomialExponent + 1
        );
        addPower(
            logarithmic,
            boundName,
            logarithmicExponent
        );

        return createGrowthTerm({
            polynomial,
            logarithmic
        });
    }

    if (
        Math.abs(
            polynomialExponent + 1
        ) <= EPSILON
    ) {
        addPower(
            logarithmic,
            boundName,
            logarithmicExponent + 1
        );

        return createGrowthTerm({
            polynomial,
            logarithmic
        });
    }

    return createGrowthTerm({
        polynomial,
        logarithmic
    });
}

function classifyGeometricTerm({
    term,
    index,
    lower,
    boundName,
    classifyExpression,
    context
}) {
    if (term.specialFactors.length === 0) {
        return undefined;
    }

    if (
        term.specialFactors.length !== 1 ||
        hasIndexPower(term.polynomial, index) ||
        hasIndexPower(term.logarithmic, index)
    ) {
        return null;
    }

    const [factor] = term.specialFactors;
    const expectedExponent = costExpressionKey(
        Cost.symbol(index)
    );

    if (
        factor.type !== "exponential" ||
        factor.count !== 1 ||
        factor.exponentKey !== expectedExponent ||
        !Number.isFinite(factor.base) ||
        factor.base <= 1 ||
        lower < 0
    ) {
        return null;
    }

    const outside = createGrowthTerm({
        polynomial: term.polynomial,
        logarithmic: term.logarithmic
    });

    const tailOrder = classifyExpression(
        Cost.power(
            Cost.constant(factor.base),
            Cost.symbol(boundName)
        ),
        context
    );

    return !tailOrder.known ||
        tailOrder.terms.length !== 1
        ? null
        : multiplyGrowthTerms(
            outside,
            tailOrder.terms[0]
        );
}

function linearBoundName(order) {
    if (
        order.terms.length !== 1 ||
        order.terms[0].specialFactors.length > 0 ||
        Object.keys(
            order.terms[0].logarithmic
        ).length > 0
    ) {
        return null;
    }

    const powers = Object.entries(
        order.terms[0].polynomial
    );

    return powers.length === 1 &&
        Math.abs(powers[0][1] - 1) <= EPSILON
        ? powers[0][0]
        : null;
}

function boundIndexContext(context, index) {
    return {
        ...context,
        resolveExpression: expression =>
            isIndexSymbol(expression, index)
                ? null
                : context.resolveExpression?.(
                    expression
                ) ?? null,
        resolveSymbol: name =>
            name === index
                ? null
                : context.resolveSymbol?.(name) ??
                    null
    };
}

function withoutPower(powers, name) {
    return Object.fromEntries(
        Object.entries(powers)
            .filter(([key]) => key !== name)
    );
}

function addPower(powers, name, exponent) {
    const next = (powers[name] ?? 0) + exponent;

    if (Math.abs(next) <= EPSILON) {
        delete powers[name];
        return;
    }

    powers[name] = next;
}

function hasIndexPower(powers, index) {
    return Math.abs(
        powers[index] ?? 0
    ) > EPSILON;
}

function containsSymbol(expression, name) {
    if (isIndexSymbol(expression, name)) {
        return true;
    }

    if (expression == null || typeof expression !== "object") {
        return false;
    }

    return Object.entries(expression)
        .some(([key, value]) => {
            if (key === "kind" || key === "index") {
                return false;
            }

            return Array.isArray(value)
                ? value.some(item =>
                    containsSymbol(item, name)
                )
                : containsSymbol(value, name);
        });
}

function isIndexSymbol(expression, index) {
    return expression?.kind ===
        CostExpressionKind.SYMBOL &&
        expression.name === index;
}
