import {
    CostExpressionKind,
    requireCostExpression
} from "../algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    areCostExpressionsEquivalent,
    canonicalizeCostExpression
} from "../algebra/CostExpressionCanonicalizer.js";

export const AbstractSign =
    Object.freeze({
        NEGATIVE: "negative",
        NON_POSITIVE: "non-positive",
        ZERO: "zero",
        NON_NEGATIVE: "non-negative",
        POSITIVE: "positive",
        UNKNOWN: "unknown"
    });

export const AbstractIntegrality =
    Object.freeze({
        YES: "yes",
        NO: "no",
        UNKNOWN: "unknown"
    });

const UNKNOWN_INTERVAL =
    createAbstractInterval(
        -Infinity,
        Infinity
    );

/**
 * Valor abstracto compartido por iteraciones, recurrencias y futuros
 * resÃºmenes interprocedurales. Mantiene la expresiÃ³n simbÃ³lica histÃ³rica y
 * hechos seguros que no dependen de una ejecuciÃ³n concreta.
 */
export function createAbstractValue({
    expression,
    interval = null,
    integral = null,
    structuralSize = null,
    exact = false
}) {
    requireCostExpression(
        expression,
        "abstract value expression"
    );

    const canonical =
        canonicalizeCostExpression(
            expression
        );
    const normalizedInterval =
        interval == null
            ? inferInterval(canonical)
            : normalizeInterval(interval);
    const normalizedIntegrality =
        integral ??
        inferIntegrality(canonical);

    return Object.freeze({
        kind: "abstract-value",
        expression: canonical,
        interval: normalizedInterval,
        sign: signOfInterval(
            normalizedInterval
        ),
        integral: normalizedIntegrality,
        structuralSize:
            normalizeStructuralSize(
                structuralSize
            ),
        exact: Boolean(exact)
    });
}

export function constantAbstractValue(value) {
    const number = Number(value);

    return createAbstractValue({
        expression: Cost.constant(number),
        interval: createAbstractInterval(
            number,
            number
        ),
        integral:
            Number.isInteger(number)
                ? AbstractIntegrality.YES
                : AbstractIntegrality.NO,
        exact: true
    });
}

export function symbolicAbstractValue(
    name,
    options = {}
) {
    return createAbstractValue({
        expression:
            options.expression ??
            Cost.symbol(name),
        interval: options.interval,
        integral: options.integral,
        structuralSize:
            options.structuralSize,
        exact: options.exact ?? true
    });
}

export function unknownAbstractValue(
    expression = Cost.unknown()
) {
    return createAbstractValue({
        expression,
        exact: false
    });
}

export function withAbstractExpression(
    value,
    expression,
    options = {}
) {
    requireAbstractValue(value);

    return createAbstractValue({
        expression,
        interval:
            options.interval ??
            value.interval,
        integral:
            options.integral ??
            value.integral,
        structuralSize:
            options.structuralSize === undefined
                ? value.structuralSize
                : options.structuralSize,
        exact:
            options.exact ??
            value.exact
    });
}

export function unaryAbstractValue(
    operator,
    operand,
    expression
) {
    requireAbstractValue(operand);

    if (operator === "+") {
        return withAbstractExpression(
            operand,
            expression
        );
    }

    if (operator !== "-") {
        return unknownAbstractValue(expression);
    }

    return createAbstractValue({
        expression,
        interval: createAbstractInterval(
            negateBound(
                operand.interval.upper
            ),
            negateBound(
                operand.interval.lower
            )
        ),
        integral: operand.integral,
        exact: operand.exact
    });
}

export function binaryAbstractValue(
    operator,
    left,
    right,
    expression
) {
    requireAbstractValue(left);
    requireAbstractValue(right);

    switch (operator) {
        case "+":
            return createAbstractValue({
                expression,
                interval: addIntervals(
                    left.interval,
                    right.interval
                ),
                integral: combineAdditiveIntegrality(
                    left.integral,
                    right.integral
                ),
                exact:
                    left.exact &&
                    right.exact
            });
        case "-":
            return createAbstractValue({
                expression,
                interval: subtractIntervals(
                    left.interval,
                    right.interval
                ),
                integral: combineAdditiveIntegrality(
                    left.integral,
                    right.integral
                ),
                exact:
                    left.exact &&
                    right.exact
            });
        case "*":
            return createAbstractValue({
                expression,
                interval: multiplyIntervals(
                    left.interval,
                    right.interval
                ),
                integral: combineMultiplicativeIntegrality(
                    left,
                    right
                ),
                exact:
                    left.exact &&
                    right.exact
            });
        case "/":
            return createAbstractValue({
                expression,
                interval: divideIntervals(
                    left.interval,
                    right.interval
                ),
                exact:
                    left.exact &&
                    right.exact
            });
        case "^":
            return createAbstractValue({
                expression,
                interval: powerInterval(
                    left.interval,
                    right.interval
                ),
                integral: powerIntegrality(
                    left,
                    right
                ),
                exact:
                    left.exact &&
                    right.exact
            });
        default:
            return unknownAbstractValue(expression);
    }
}

/**
 * Aplica el contrato simbÃ³lico de la biblioteca sin acoplar el dominio a la
 * lista concreta de funciones estÃ¡ndar.
 */
export function applyAbstractFunctionEffect(
    effect,
    args,
    expression
) {
    const kind = effect?.kind ?? "opaque";
    const argument =
        args[effect?.argument ?? 0] ??
        null;

    if (kind === "rounding" && argument != null) {
        return createAbstractValue({
            expression,
            interval: roundInterval(
                argument.interval,
                effect.direction
            ),
            integral: AbstractIntegrality.YES,
            exact: argument.exact
        });
    }

    if (kind === "absolute" && argument != null) {
        return createAbstractValue({
            expression,
            interval: absoluteInterval(
                argument.interval
            ),
            integral: argument.integral,
            exact: argument.exact
        });
    }

    if (kind === "size" && argument != null) {
        return createAbstractValue({
            expression,
            interval: createAbstractInterval(
                0,
                Infinity
            ),
            integral: AbstractIntegrality.YES,
            structuralSize:
                argument.expression,
            exact: argument.exact
        });
    }

    if (kind === "extremum" && args.length > 0) {
        return createAbstractValue({
            expression,
            interval: extremumInterval(
                args.map(item =>
                    item.interval
                ),
                effect.operation
            ),
            integral: mergeIntegrality(
                args.map(item =>
                    item.integral
                )
            ),
            exact: args.every(item =>
                item.exact
            )
        });
    }

    if (kind === "logarithmic" && argument != null) {
        return createAbstractValue({
            expression,
            interval: logarithmicInterval(
                argument.interval,
                effect.base
            ),
            exact: argument.exact
        });
    }

    if (kind === "root" && argument != null) {
        return createAbstractValue({
            expression,
            interval: rootInterval(
                argument.interval,
                effect.exponent
            ),
            exact: argument.exact
        });
    }

    if (kind === "exponential" && argument != null) {
        return createAbstractValue({
            expression,
            interval: exponentialInterval(
                argument.interval,
                effect.base
            ),
            exact: argument.exact
        });
    }

    if (kind === "linear" && argument != null) {
        return withAbstractExpression(
            argument,
            expression
        );
    }

    if (kind === "bounded") {
        return createAbstractValue({
            expression,
            interval: createAbstractInterval(
                -1,
                1
            )
        });
    }

    return unknownAbstractValue(expression);
}

/**
 * Evalúa una expresión algebraica ya construida dentro del dominio
 * abstracto. Es el puente deliberadamente pequeño entre un resumen de
 * función y los argumentos concretos de una llamada: no interpreta AST ni
 * ejecuta código de usuario.
 *
 * `resolveCall` puede devolver un valor abstracto para una llamada conocida
 * (por ejemplo, una función propia resumida). Devolver `null` conserva un
 * resultado opaco y evita convertir una hipótesis en un hecho probado.
 */
export function evaluateAbstractCostExpression(
    expression,
    options = {}
) {
    requireCostExpression(
        expression,
        "abstract expression"
    );

    const symbols = normalizeAbstractSymbols(
        options.symbols
    );
    const resolveCall =
        typeof options.resolveCall === "function"
            ? options.resolveCall
            : null;

    const evaluate = current => {
        switch (current.kind) {
            case CostExpressionKind.CONSTANT:
                return constantAbstractValue(
                    current.value
                );
            case CostExpressionKind.SYMBOL:
                return symbols.get(current.name) ??
                    symbolicAbstractValue(
                        current.name
                    );
            case CostExpressionKind.GROUP: {
                const value = evaluate(
                    current.expression
                );

                return withAbstractExpression(
                    value,
                    Cost.group(value.expression)
                );
            }
            case CostExpressionKind.SUM:
                return current.terms.reduce(
                    (left, term) => {
                        const right = evaluate(term);

                        return binaryAbstractValue(
                            "+",
                            left,
                            right,
                            Cost.sum([
                                left.expression,
                                right.expression
                            ])
                        );
                    },
                    constantAbstractValue(0)
                );
            case CostExpressionKind.DIFFERENCE:
                return evaluateBinary(
                    "-",
                    current.left,
                    current.right
                );
            case CostExpressionKind.PRODUCT:
                return current.factors.reduce(
                    (left, factor) => {
                        const right = evaluate(factor);

                        return binaryAbstractValue(
                            "*",
                            left,
                            right,
                            Cost.product([
                                left.expression,
                                right.expression
                            ])
                        );
                    },
                    constantAbstractValue(1)
                );
            case CostExpressionKind.QUOTIENT:
                return evaluateBinary(
                    "/",
                    current.numerator,
                    current.denominator
                );
            case CostExpressionKind.POWER:
                return evaluateBinary(
                    "^",
                    current.base,
                    current.exponent
                );
            case CostExpressionKind.LOGARITHM: {
                const argument = evaluate(
                    current.argument
                );
                const base = current.base == null
                    ? null
                    : evaluate(current.base);

                return applyAbstractFunctionEffect(
                    {
                        kind: "logarithmic",
                        base: constantCostValue(
                            base?.expression,
                            Math.E
                        )
                    },
                    [argument],
                    Cost.logarithm(
                        argument.expression,
                        base == null
                            ? null
                            : base.expression
                    )
                );
            }
            case CostExpressionKind.MINIMUM:
            case CostExpressionKind.MAXIMUM: {
                const values = current.expressions.map(
                    evaluate
                );

                return applyAbstractFunctionEffect(
                    {
                        kind: "extremum",
                        operation:
                            current.kind ===
                            CostExpressionKind.MINIMUM
                                ? "minimum"
                                : "maximum"
                    },
                    values,
                    current.kind ===
                    CostExpressionKind.MINIMUM
                        ? Cost.minimum(
                            values.map(value =>
                                value.expression
                            )
                        )
                        : Cost.maximum(
                            values.map(value =>
                                value.expression
                            )
                        )
                );
            }
            case CostExpressionKind.CALL: {
                const args = current.args.map(evaluate);
                const instantiated = Cost.call(
                    current.name,
                    args.map(argument =>
                        argument.expression
                    )
                );
                const resolved = resolveCall?.(
                    current.name,
                    args,
                    instantiated
                );

                if (resolved != null) {
                    requireAbstractValue(resolved);
                    return resolved;
                }

                return unknownAbstractValue(instantiated);
            }
            default:
                return unknownAbstractValue(current);
        }
    };

    const evaluateBinary = (
        operator,
        leftExpression,
        rightExpression,
    ) => {
        const left = evaluate(leftExpression);
        const right = evaluate(rightExpression);

        return binaryAbstractValue(
            operator,
            left,
            right,
            abstractBinaryExpression(
                operator,
                left.expression,
                right.expression
            )
        );
    };

    return evaluate(expression);
}

export function joinAbstractValues(
    values,
    fallbackExpression = Cost.unknown()
) {
    if (!Array.isArray(values) || values.length === 0) {
        return unknownAbstractValue(
            fallbackExpression
        );
    }

    for (const value of values) {
        requireAbstractValue(value);
    }

    const first = values[0];
    const equivalent = values.every(value =>
        areCostExpressionsEquivalent(
            value.expression,
            first.expression
        )
    );
    const sharedSize = sharedStructuralSize(values);

    return createAbstractValue({
        expression: equivalent
            ? first.expression
            : fallbackExpression,
        interval: values
            .map(value => value.interval)
            .reduce(joinIntervals),
        integral: mergeIntegrality(
            values.map(value => value.integral)
        ),
        structuralSize: sharedSize,
        exact:
            equivalent &&
            values.every(value => value.exact)
    });
}

export function refineAbstractValue(
    value,
    interval
) {
    requireAbstractValue(value);

    const intersection = intersectIntervals(
        value.interval,
        interval
    );

    return intersection == null
        ? null
        : createAbstractValue({
            expression: value.expression,
            interval: intersection,
            integral: value.integral,
            structuralSize: value.structuralSize,
            exact: value.exact
        });
}

export function compareAbstractValues(
    left,
    right,
    operator
) {
    requireAbstractValue(left);
    requireAbstractValue(right);

    if (
        operator === "==" ||
        operator === "!="
    ) {
        const equal =
            areCostExpressionsEquivalent(
                left.expression,
                right.expression
            ) || singletonEqual(
                left.interval,
                right.interval
            );
        const disjoint =
            intersectIntervals(
                left.interval,
                right.interval
            ) == null;

        if (operator === "==") {
            return equal
                ? true
                : disjoint
                    ? false
                    : null;
        }

        return equal
            ? false
            : disjoint
                ? true
                : null;
    }

    switch (operator) {
        case "<":
            return left.interval.upper <
                right.interval.lower
                ? true
                : left.interval.lower >=
                    right.interval.upper
                    ? false
                    : null;
        case "<=":
            return left.interval.upper <=
                right.interval.lower
                ? true
                : left.interval.lower >
                    right.interval.upper
                    ? false
                    : null;
        case ">":
            return left.interval.lower >
                right.interval.upper
                ? true
                : left.interval.upper <=
                    right.interval.lower
                    ? false
                    : null;
        case ">=":
            return left.interval.lower >=
                right.interval.upper
                ? true
                : left.interval.upper <
                    right.interval.lower
                    ? false
                    : null;
        default:
            return null;
    }
}

export function createAbstractInterval(
    lower = -Infinity,
    upper = Infinity
) {
    const normalizedLower = Number(lower);
    const normalizedUpper = Number(upper);

    if (
        Number.isNaN(normalizedLower) ||
        Number.isNaN(normalizedUpper) ||
        normalizedLower > normalizedUpper
    ) {
        throw new TypeError(
            "An abstract interval requires lower <= upper numeric bounds."
        );
    }

    return Object.freeze({
        lower: normalizedLower,
        upper: normalizedUpper
    });
}

export function intersectIntervals(left, right) {
    const lower = Math.max(
        left.lower,
        right.lower
    );
    const upper = Math.min(
        left.upper,
        right.upper
    );

    return lower > upper
        ? null
        : createAbstractInterval(
            lower,
            upper
        );
}

export function signOfInterval(interval) {
    if (interval.lower === 0 && interval.upper === 0) {
        return AbstractSign.ZERO;
    }

    if (interval.lower > 0) {
        return AbstractSign.POSITIVE;
    }

    if (interval.lower >= 0) {
        return AbstractSign.NON_NEGATIVE;
    }

    if (interval.upper < 0) {
        return AbstractSign.NEGATIVE;
    }

    if (interval.upper <= 0) {
        return AbstractSign.NON_POSITIVE;
    }

    return AbstractSign.UNKNOWN;
}

export function requireAbstractValue(value) {
    if (value?.kind !== "abstract-value") {
        throw new TypeError(
            "A valid abstract value is required."
        );
    }
}

function normalizeAbstractSymbols(symbols) {
    if (symbols == null) {
        return new Map();
    }

    const entries = symbols instanceof Map
        ? [...symbols.entries()]
        : Array.isArray(symbols)
            ? symbols
            : Object.entries(symbols);
    const normalized = new Map();

    for (const [name, value] of entries) {
        requireAbstractValue(value);
        normalized.set(String(name), value);
    }

    return normalized;
}

function constantCostValue(expression, fallback) {
    return expression?.kind ===
        CostExpressionKind.CONSTANT
        ? expression.value
        : fallback;
}

function abstractBinaryExpression(
    operator,
    left,
    right
) {
    switch (operator) {
        case "+":
            return Cost.sum([left, right]);
        case "-":
            return Cost.difference(left, right);
        case "*":
            return Cost.product([left, right]);
        case "/":
            return Cost.quotient(left, right);
        case "^":
            return Cost.power(left, right);
        default:
            return Cost.unknown();
    }
}

function normalizeInterval(interval) {
    if (interval == null) {
        return UNKNOWN_INTERVAL;
    }

    return createAbstractInterval(
        interval.lower,
        interval.upper
    );
}

function inferInterval(expression) {
    return expression.kind ===
        CostExpressionKind.CONSTANT
        ? createAbstractInterval(
            expression.value,
            expression.value
        )
        : UNKNOWN_INTERVAL;
}

function inferIntegrality(expression) {
    return expression.kind ===
        CostExpressionKind.CONSTANT
        ? Number.isInteger(expression.value)
            ? AbstractIntegrality.YES
            : AbstractIntegrality.NO
        : AbstractIntegrality.UNKNOWN;
}

function normalizeStructuralSize(structuralSize) {
    if (structuralSize == null) {
        return null;
    }

    const expression =
        structuralSize.expression ??
        structuralSize;

    requireCostExpression(
        expression,
        "structural size expression"
    );

    return Object.freeze({
        kind: "structural-size",
        expression:
            canonicalizeCostExpression(
                expression
            )
    });
}

function addIntervals(left, right) {
    return createAbstractInterval(
        addBounds(left.lower, right.lower),
        addBounds(left.upper, right.upper)
    );
}

function subtractIntervals(left, right) {
    return createAbstractInterval(
        subtractBounds(left.lower, right.upper),
        subtractBounds(left.upper, right.lower)
    );
}

function multiplyIntervals(left, right) {
    if (
        !Number.isFinite(left.lower) ||
        !Number.isFinite(left.upper) ||
        !Number.isFinite(right.lower) ||
        !Number.isFinite(right.upper)
    ) {
        if (
            left.lower === 0 &&
            left.upper === 0 ||
            right.lower === 0 &&
            right.upper === 0
        ) {
            return createAbstractInterval(0, 0);
        }

        return UNKNOWN_INTERVAL;
    }

    const values = [
        left.lower * right.lower,
        left.lower * right.upper,
        left.upper * right.lower,
        left.upper * right.upper
    ];

    return createAbstractInterval(
        Math.min(...values),
        Math.max(...values)
    );
}

function divideIntervals(left, right) {
    if (
        right.lower <= 0 &&
        right.upper >= 0 ||
        !Number.isFinite(left.lower) ||
        !Number.isFinite(left.upper) ||
        !Number.isFinite(right.lower) ||
        !Number.isFinite(right.upper)
    ) {
        return UNKNOWN_INTERVAL;
    }

    return multiplyIntervals(
        left,
        createAbstractInterval(
            1 / right.upper,
            1 / right.lower
        )
    );
}

function powerInterval(left, right) {
    if (
        right.lower !== right.upper ||
        !Number.isFinite(right.lower) ||
        right.lower < 0 ||
        !Number.isFinite(left.lower) ||
        !Number.isFinite(left.upper)
    ) {
        return UNKNOWN_INTERVAL;
    }

    const exponent = right.lower;

    if (!Number.isInteger(exponent)) {
        return left.lower >= 0
            ? createAbstractInterval(
                Math.pow(left.lower, exponent),
                Math.pow(left.upper, exponent)
            )
            : UNKNOWN_INTERVAL;
    }

    const values = [
        Math.pow(left.lower, exponent),
        Math.pow(left.upper, exponent)
    ];

    if (
        exponent % 2 === 0 &&
        left.lower <= 0 &&
        left.upper >= 0
    ) {
        values.push(0);
    }

    return createAbstractInterval(
        Math.min(...values),
        Math.max(...values)
    );
}

function roundInterval(interval, direction) {
    const round = direction === "floor"
        ? Math.floor
        : Math.round;

    return createAbstractInterval(
        roundBound(interval.lower, round),
        roundBound(interval.upper, round)
    );
}

function absoluteInterval(interval) {
    if (interval.lower >= 0) {
        return interval;
    }

    if (interval.upper <= 0) {
        return createAbstractInterval(
            negateBound(interval.upper),
            negateBound(interval.lower)
        );
    }

    return createAbstractInterval(
        0,
        Math.max(
            Math.abs(interval.lower),
            Math.abs(interval.upper)
        )
    );
}

function extremumInterval(intervals, operation) {
    if (operation === "minimum") {
        return createAbstractInterval(
            Math.min(...intervals.map(item => item.lower)),
            Math.min(...intervals.map(item => item.upper))
        );
    }

    return createAbstractInterval(
        Math.max(...intervals.map(item => item.lower)),
        Math.max(...intervals.map(item => item.upper))
    );
}

function logarithmicInterval(interval, base = Math.E) {
    if (
        interval.lower < 1 ||
        base <= 0 ||
        base === 1
    ) {
        return UNKNOWN_INTERVAL;
    }

    return createAbstractInterval(
        Math.log(interval.lower) /
            Math.log(base),
        Number.isFinite(interval.upper)
            ? Math.log(interval.upper) /
                Math.log(base)
            : Infinity
    );
}

function rootInterval(interval, exponent = 1 / 2) {
    if (interval.lower < 0 || exponent <= 0) {
        return UNKNOWN_INTERVAL;
    }

    return createAbstractInterval(
        Math.pow(interval.lower, exponent),
        Number.isFinite(interval.upper)
            ? Math.pow(interval.upper, exponent)
            : Infinity
    );
}

function exponentialInterval(interval, base = Math.E) {
    if (base <= 0 || base === 1) {
        return UNKNOWN_INTERVAL;
    }

    return createAbstractInterval(
        Number.isFinite(interval.lower)
            ? Math.pow(base, interval.lower)
            : interval.lower === -Infinity
                ? 0
                : Infinity,
        Number.isFinite(interval.upper)
            ? Math.pow(base, interval.upper)
            : interval.upper === -Infinity
                ? 0
                : Infinity
    );
}

function joinIntervals(left, right) {
    return createAbstractInterval(
        Math.min(left.lower, right.lower),
        Math.max(left.upper, right.upper)
    );
}

function combineAdditiveIntegrality(left, right) {
    return left === AbstractIntegrality.YES &&
        right === AbstractIntegrality.YES
        ? AbstractIntegrality.YES
        : left === AbstractIntegrality.NO &&
            right === AbstractIntegrality.NO
            ? AbstractIntegrality.UNKNOWN
            : AbstractIntegrality.UNKNOWN;
}

function combineMultiplicativeIntegrality(left, right) {
    if (
        left.integral === AbstractIntegrality.YES &&
        right.integral === AbstractIntegrality.YES
    ) {
        return AbstractIntegrality.YES;
    }

    if (
        left.interval.lower === 0 &&
        left.interval.upper === 0 ||
        right.interval.lower === 0 &&
        right.interval.upper === 0
    ) {
        return AbstractIntegrality.YES;
    }

    return AbstractIntegrality.UNKNOWN;
}

function powerIntegrality(left, right) {
    return left.integral === AbstractIntegrality.YES &&
        right.interval.lower === right.interval.upper &&
        Number.isInteger(right.interval.lower) &&
        right.interval.lower >= 0
        ? AbstractIntegrality.YES
        : AbstractIntegrality.UNKNOWN;
}

function mergeIntegrality(values) {
    return values.length > 0 &&
        values.every(value =>
            value === AbstractIntegrality.YES
        )
        ? AbstractIntegrality.YES
        : values.length > 0 &&
            values.every(value =>
                value === AbstractIntegrality.NO
            )
            ? AbstractIntegrality.NO
            : AbstractIntegrality.UNKNOWN;
}

function sharedStructuralSize(values) {
    const first = values[0].structuralSize;

    if (first == null) {
        return null;
    }

    return values.every(value =>
        value.structuralSize != null &&
        areCostExpressionsEquivalent(
            value.structuralSize.expression,
            first.expression
        )
    )
        ? first
        : null;
}

function singletonEqual(left, right) {
    return left.lower === left.upper &&
        right.lower === right.upper &&
        left.lower === right.lower;
}

function addBounds(left, right) {
    if (
        left === -Infinity &&
        right === Infinity ||
        left === Infinity &&
        right === -Infinity
    ) {
        return left === -Infinity
            ? -Infinity
            : Infinity;
    }

    return left + right;
}

function subtractBounds(left, right) {
    return addBounds(
        left,
        negateBound(right)
    );
}

function negateBound(value) {
    return value === Infinity
        ? -Infinity
        : value === -Infinity
            ? Infinity
            : -value;
}

function roundBound(value, round) {
    return Number.isFinite(value)
        ? round(value)
        : value;
}
