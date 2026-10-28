import {
    CostExpressionKind,
    costExpressionKey,
    requireCostExpression
} from "../algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    simplifyCostExpression
} from "../algebra/CostExpressionSimplifier.js";
import {
    substituteCostExpression
} from "../algebra/CostExpressionSubstitution.js";
import {
    normalizePolynomialExpression
} from "../algebra/NormalizedPolynomial.js";
import {
    isGrowingTrajectory,
    isShrinkingTrajectory,
    trajectoryValueAt
} from "../iteration/LoopTrajectory.js";

/**
 * Suma el trabajo sobre los estados reales de una trayectoria. La variable
 * de control se sustituye por x(k), nunca por la cantidad K de iteraciones.
 */
export function sumCostAlongTrajectory({
    trajectory,
    term
}) {
    if (
        trajectory?.kind !==
            "loop-trajectory"
    ) {
        return null;
    }

    requireCostExpression(
        term,
        "trajectory summand"
    );

    const value = trajectoryValueAt(
        trajectory,
        Cost.symbol(trajectory.index)
    );

    if (value == null) {
        return null;
    }

    const normalizedTerm =
        normalizeTrajectoryGuards(
            term,
            trajectory
        );
    const direct =
        directAdditiveSummation(
            normalizedTerm,
            trajectory
        );

    if (direct != null) {
        return direct;
    }

    const substituted =
        substituteCostExpression(
            normalizedTerm,
            new Map([[
                trajectory.variable,
                value
            ]]),
            { canonical: false }
        );
    const summation = Cost.summation(
        trajectory.index,
        Cost.constant(0),
        Cost.difference(
            trajectory.length,
            Cost.constant(1)
        ),
        substituted
    );
    const closed = simplifyCostExpression(
        summation
    );

    if (
        closed.kind !==
            CostExpressionKind.SUMMATION
    ) {
        return Object.freeze({
            expression: closed,
            method:
                "closed-trajectory-summation",
            boundKind:
                trajectory.boundKind,
            evidence: Object.freeze([
                "La suma se cerró después de sustituir la forma x(k) de la variable de control."
            ])
        });
    }

    const geometric =
        closeDominatedTrajectory(
            normalizedTerm,
            trajectory
        );

    if (geometric != null) {
        return Object.freeze({
            expression: geometric,
            method:
                "dominant-trajectory-endpoint",
            boundKind:
                trajectory.boundKind,
            evidence: Object.freeze([
                "La trayectoria geométrica o acelerada queda dominada por sus términos finales para cada potencia positiva del control."
            ])
        });
    }

    return Object.freeze({
        expression: closed,
        method: "symbolic-trajectory-summation",
        boundKind:
            trajectory.boundKind,
        evidence: Object.freeze([
            "La suma conserva explícitamente el estado x(k) porque no existe un cierre algebraico demostrado para el sumando."
        ])
    });
}

function directAdditiveSummation(
    term,
    trajectory
) {
    if (
        trajectory.update?.progression !==
            "additive" ||
        trajectory.update.amount !== 1 ||
        trajectory.start.kind !==
            CostExpressionKind.CONSTANT ||
        ![
            "<",
            "<="
        ].includes(
            trajectory.condition.operator
        )
    ) {
        return null;
    }

    const upper =
        trajectory.condition.operator === "<"
            ? Cost.difference(
                trajectory.bound,
                Cost.constant(1)
            )
            : trajectory.bound;
    const summation = Cost.summation(
        trajectory.variable,
        trajectory.start,
        upper,
        term
    );

    return Object.freeze({
        expression:
            simplifyCostExpression(
                summation
            ),
        method:
            "direct-additive-trajectory",
        boundKind:
            trajectory.boundKind,
        evidence: Object.freeze([
            "La variable de control coincide con el índice ligado de una trayectoria aditiva unitaria."
        ])
    });
}

function closeDominatedTrajectory(
    expression,
    trajectory
) {
    if (
        !isGrowingTrajectory(trajectory) &&
        !isShrinkingTrajectory(trajectory)
    ) {
        return null;
    }

    const polynomial =
        normalizePolynomialExpression(
            expression
        );

    if (polynomial == null) {
        return null;
    }

    const variableKey = costExpressionKey(
        Cost.symbol(trajectory.variable)
    );
    const endpoint =
        isGrowingTrajectory(trajectory)
            ? trajectory.bound
            : trajectory.start;
    const terms = [];

    for (const term of polynomial.terms) {
        if (term.coefficient < 0) {
            return null;
        }

        const control = term.factors.find(
            factor =>
                factor.key === variableKey
        );
        const dependentAtom = term.factors
            .filter(factor =>
                factor !== control
            )
            .some(factor =>
                containsSymbol(
                    factor.expression,
                    trajectory.variable
                )
            );

        if (dependentAtom) {
            return null;
        }

        const factors = term.factors
            .filter(factor =>
                factor !== control
            )
            .map(factor =>
                factor.exponent === 1
                    ? factor.expression
                    : Cost.power(
                        factor.expression,
                        Cost.constant(
                            factor.exponent
                        )
                    )
            );

        if (term.coefficient !== 1) {
            factors.unshift(
                Cost.constant(
                    term.coefficient
                )
            );
        }

        if (control == null) {
            factors.push(
                trajectory.length
            );
        } else {
            factors.push(
                control.exponent === 1
                    ? endpoint
                    : Cost.power(
                        endpoint,
                        Cost.constant(
                            control.exponent
                        )
                    )
            );
        }

        terms.push(
            factors.length === 1
                ? factors[0]
                : Cost.product(factors)
        );
    }

    return simplifyCostExpression(
        Cost.sum(terms)
    );
}

function normalizeTrajectoryGuards(
    expression,
    trajectory
) {
    if (
        expression.kind ===
            CostExpressionKind.MAXIMUM &&
        expression.expressions.length === 2
    ) {
        const zero = expression.expressions
            .find(isZero);
        const other = expression.expressions
            .find(item => item !== zero);

        if (
            zero != null &&
            other != null &&
            trajectoryIsNonNegative(
                trajectory
            ) &&
            nonNegativeControlPolynomial(
                other,
                trajectory.variable
            )
        ) {
            return normalizeTrajectoryGuards(
                other,
                trajectory
            );
        }
    }

    switch (expression.kind) {
        case CostExpressionKind.SUM:
            return Cost.sum(
                expression.terms.map(term =>
                    normalizeTrajectoryGuards(
                        term,
                        trajectory
                    )
                )
            );
        case CostExpressionKind.DIFFERENCE:
            return Cost.difference(
                normalizeTrajectoryGuards(
                    expression.left,
                    trajectory
                ),
                normalizeTrajectoryGuards(
                    expression.right,
                    trajectory
                )
            );
        case CostExpressionKind.PRODUCT:
            return Cost.product(
                expression.factors.map(factor =>
                    normalizeTrajectoryGuards(
                        factor,
                        trajectory
                    )
                )
            );
        case CostExpressionKind.QUOTIENT:
            return Cost.quotient(
                normalizeTrajectoryGuards(
                    expression.numerator,
                    trajectory
                ),
                normalizeTrajectoryGuards(
                    expression.denominator,
                    trajectory
                )
            );
        case CostExpressionKind.GROUP:
            return Cost.group(
                normalizeTrajectoryGuards(
                    expression.expression,
                    trajectory
                )
            );
        case CostExpressionKind.POWER:
            return Cost.power(
                normalizeTrajectoryGuards(
                    expression.base,
                    trajectory
                ),
                normalizeTrajectoryGuards(
                    expression.exponent,
                    trajectory
                )
            );
        default:
            return expression;
    }
}

function trajectoryIsNonNegative(trajectory) {
    const start = trajectory.start;
    const condition = trajectory.condition;

    if (
        start.kind ===
            CostExpressionKind.CONSTANT &&
        start.value >= 0 &&
        isGrowingTrajectory(trajectory)
    ) {
        return true;
    }

    return (
        condition.operator === ">" ||
        condition.operator === ">="
    ) &&
        condition.bound.kind ===
            CostExpressionKind.CONSTANT &&
        condition.bound.value >= 0;
}

function nonNegativeControlPolynomial(
    expression,
    variable
) {
    const polynomial =
        normalizePolynomialExpression(
            expression
        );

    if (polynomial == null) {
        return false;
    }

    const variableKey = costExpressionKey(
        Cost.symbol(variable)
    );

    return polynomial.terms.every(term =>
        term.coefficient >= 0 &&
        term.factors.every(factor =>
            factor.key === variableKey ||
            !containsSymbol(
                factor.expression,
                variable
            )
        )
    );
}

function containsSymbol(expression, name) {
    if (
        expression?.kind ===
            CostExpressionKind.SYMBOL
    ) {
        return expression.name === name;
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
                    containsSymbol(item, name)
                )
                : containsSymbol(value, name);
        });
}

function isZero(expression) {
    return expression.kind ===
        CostExpressionKind.CONSTANT &&
        expression.value === 0;
}
