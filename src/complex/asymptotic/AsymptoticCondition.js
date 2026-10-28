import {
    CostExpressionKind,
    costExpressionKey,
    requireCostExpression
} from "../algebra/CostExpression.js";
import {
    canonicalizeCostExpression
} from "../algebra/CostExpressionCanonicalizer.js";
import {
    formatCostExpression
} from "../algebra/CostExpressionFormatter.js";
import {
    simplifyCostExpression
} from "../algebra/CostExpressionSimplifier.js";
import {
    StandardLibrarySymbolicEffect,
    getStandardLibraryDefinition
} from "../../standard-library/StandardLibraryCatalog.js";

/**
 * Hechos que una transformación asintótica necesita que sean verdaderos a
 * partir de algún tamaño de entrada. No son precondiciones de ejecución: son
 * el dominio en el que una igualdad u orden asintótico queda demostrado.
 */
export const AsymptoticConditionKind =
    Object.freeze({
        POSITIVE: "positive",
        NON_NEGATIVE: "non-negative",
        NON_ZERO: "non-zero",
        GREATER_THAN_ONE: "greater-than-one",
        INTEGRAL: "integral"
    });

const CONDITION_DETAILS =
    Object.freeze({
        [AsymptoticConditionKind.POSITIVE]: {
            operator: ">",
            value: 0
        },
        [AsymptoticConditionKind.NON_NEGATIVE]: {
            operator: ">=",
            value: 0
        },
        [AsymptoticConditionKind.NON_ZERO]: {
            operator: "!=",
            value: 0
        },
        [AsymptoticConditionKind.GREATER_THAN_ONE]: {
            operator: ">",
            value: 1
        },
        [AsymptoticConditionKind.INTEGRAL]: {
            operator: "integer",
            value: null
        }
    });

/**
 * Crea una condición inmutable con una clave canónica. La clave permite que
 * expresiones equivalentes no dupliquen el mismo supuesto en un informe.
 */
export function createAsymptoticCondition(
    kind,
    expression,
    reason = null
) {
    if (!Object.hasOwn(CONDITION_DETAILS, kind)) {
        throw new TypeError(
            "An asymptotic condition requires a supported kind."
        );
    }

    requireCostExpression(
        expression,
        "asymptotic condition expression"
    );

    const normalized =
        canonicalizeCostExpression(
            expression
        );
    const details =
        CONDITION_DETAILS[kind];

    return Object.freeze({
        kind: "asymptotic-condition",
        condition: kind,
        expression: normalized,
        operator: details.operator,
        value: details.value,
        reason,
        key: [
            kind,
            costExpressionKey(normalized)
        ].join(":"),
        text: formatConditionText(
            kind,
            normalized
        )
    });
}

/**
 * Recorre una expresión de costo y conserva solamente las condiciones que no
 * se pueden demostrar con hechos locales o con las hipótesis recibidas en el
 * contexto. El orden resultante sigue siendo útil; simplemente deja explícito
 * cuándo es condicional en lugar de reportarlo como O(?).
 */
export function analyzeAsymptoticConditions(
    expression,
    context = {}
) {
    requireCostExpression(
        expression,
        "asymptotic condition expression"
    );

    const collected = [];
    const conditionContext = {
        ...context,
        explicit:
            normalizeExplicitConditions(
                context.asymptoticConditions ??
                context.conditions ??
                []
            ),
        resolvingSymbols:
            new Set()
    };

    collectConditions(
        simplifyCostExpression(expression),
        collected,
        conditionContext
    );

    const unique =
        new Map();

    for (const item of collected) {
        unique.set(item.key, item);
    }

    const required =
        [...unique.values()]
            .filter(condition =>
                !isConditionProven(
                    condition,
                    conditionContext
                )
            )
            .sort((left, right) =>
                left.text.localeCompare(right.text)
            );

    return Object.freeze({
        kind: "asymptotic-condition-analysis",
        status:
            required.length === 0
                ? "proven"
                : "conditional",
        conditions: Object.freeze(required),
        assumptions: Object.freeze(
            required.map(condition =>
                condition.text
            )
        ),
        message:
            required.length === 0
                ? null
                : "El orden asintótico está demostrado bajo las condiciones indicadas."
    });
}

export function isConditionProven(
    condition,
    context = {}
) {
    requireAsymptoticCondition(condition);

    const explicit =
        context.explicit ??
        normalizeExplicitConditions(
            context.asymptoticConditions ??
            context.conditions ??
            []
        );

    if (explicit.has(condition.key)) {
        return true;
    }

    return proveCondition(
        condition.condition,
        condition.expression,
        {
            ...context,
            explicit,
            resolvingSymbols:
                context.resolvingSymbols ??
                new Set()
        }
    );
}

export function requireAsymptoticCondition(
    condition
) {
    if (condition?.kind !== "asymptotic-condition") {
        throw new TypeError(
            "A valid asymptotic condition is required."
        );
    }
}

function collectConditions(
    expression,
    conditions,
    context
) {
    switch (expression.kind) {
        case CostExpressionKind.SUM:
        case CostExpressionKind.PRODUCT:
        case CostExpressionKind.MINIMUM:
        case CostExpressionKind.MAXIMUM:
            for (const item of expression.terms ?? expression.factors ?? expression.expressions) {
                collectConditions(item, conditions, context);
            }
            return;
        case CostExpressionKind.SUMMATION:
            collectConditions(expression.lower, conditions, context);
            collectConditions(expression.upper, conditions, context);
            collectConditions(
                expression.term,
                conditions,
                summationConditionContext(
                    expression,
                    context
                )
            );
            return;
        case CostExpressionKind.DIFFERENCE:
            collectConditions(expression.left, conditions, context);
            collectConditions(expression.right, conditions, context);
            return;
        case CostExpressionKind.QUOTIENT:
            collectConditions(expression.numerator, conditions, context);
            collectConditions(expression.denominator, conditions, context);
            addCondition(
                conditions,
                AsymptoticConditionKind.NON_ZERO,
                expression.denominator,
                "El denominador de un cociente debe permanecer distinto de cero.",
                context
            );
            return;
        case CostExpressionKind.GROUP:
            collectConditions(expression.expression, conditions, context);
            return;
        case CostExpressionKind.POWER:
            collectConditions(expression.base, conditions, context);
            collectConditions(expression.exponent, conditions, context);
            collectPowerConditions(
                expression,
                conditions,
                context
            );
            return;
        case CostExpressionKind.LOGARITHM:
            collectConditions(expression.argument, conditions, context);
            if (expression.base != null) {
                collectConditions(expression.base, conditions, context);
                addCondition(
                    conditions,
                    AsymptoticConditionKind.GREATER_THAN_ONE,
                    expression.base,
                    "La base de un logaritmo asintótico debe ser mayor que uno.",
                    context
                );
            }
            addCondition(
                conditions,
                AsymptoticConditionKind.GREATER_THAN_ONE,
                expression.argument,
                "El argumento de un logaritmo debe crecer por encima de uno.",
                context
            );
            return;
        case CostExpressionKind.FACTORIAL:
            collectConditions(expression.argument, conditions, context);
            addCondition(
                conditions,
                AsymptoticConditionKind.NON_NEGATIVE,
                expression.argument,
                "El argumento de un factorial debe ser no negativo.",
                context
            );
            addCondition(
                conditions,
                AsymptoticConditionKind.INTEGRAL,
                expression.argument,
                "El argumento de un factorial debe ser entero.",
                context
            );
            return;
        case CostExpressionKind.CALL:
            for (const argument of expression.args) {
                collectConditions(argument, conditions, context);
            }
            collectCallConditions(
                expression,
                conditions,
                context
            );
            return;
        case CostExpressionKind.EQUATION:
        case CostExpressionKind.RECURRENCE:
            collectConditions(expression.left, conditions, context);
            collectConditions(expression.right, conditions, context);
            return;
        default:
            return;
    }
}

function collectPowerConditions(
    expression,
    conditions,
    context
) {
    const exponent =
        simplifyCostExpression(
            expression.exponent
        );

    if (
        exponent.kind !==
        CostExpressionKind.CONSTANT
    ) {
        addCondition(
            conditions,
            AsymptoticConditionKind.POSITIVE,
            expression.base,
            "Una potencia con exponente simbólico requiere una base positiva.",
            context
        );
        return;
    }

    if (exponent.value < 0) {
        addCondition(
            conditions,
            AsymptoticConditionKind.NON_ZERO,
            expression.base,
            "Una potencia con exponente negativo requiere una base distinta de cero.",
            context
        );
    }

    if (!Number.isInteger(exponent.value)) {
        addCondition(
            conditions,
            AsymptoticConditionKind.NON_NEGATIVE,
            expression.base,
            "Una potencia fraccionaria requiere una base no negativa.",
            context
        );
    }
}

function collectCallConditions(
    expression,
    conditions,
    context
) {
    const definition =
        getStandardLibraryDefinition(
            expression.name
        );
    const effect =
        definition?.symbolicEffect ??
        null;
    const argument =
        expression.args[
            effect?.argument ?? 0
        ] ?? null;

    if (argument == null) {
        return;
    }

    if (
        effect?.kind ===
        StandardLibrarySymbolicEffect.LOGARITHMIC
    ) {
        addCondition(
            conditions,
            AsymptoticConditionKind.GREATER_THAN_ONE,
            argument,
            "El argumento de un logaritmo debe crecer por encima de uno.",
            context
        );
    }

    if (
        effect?.kind ===
        StandardLibrarySymbolicEffect.ROOT
    ) {
        addCondition(
            conditions,
            AsymptoticConditionKind.NON_NEGATIVE,
            argument,
            "El argumento de una raíz debe ser no negativo.",
            context
        );
    }
}

function addCondition(
    conditions,
    kind,
    expression,
    reason,
    context = {}
) {
    if (isBoundIndexCondition(
        kind,
        expression,
        context
    )) {
        return;
    }

    conditions.push(
        createAsymptoticCondition(
            kind,
            expression,
            reason
        )
    );
}

function isBoundIndexCondition(kind, expression, context) {
    return expression?.kind ===
        CostExpressionKind.SYMBOL &&
        context.boundIndices?.has(
            expression.name
        ) &&
        [
            AsymptoticConditionKind.POSITIVE,
            AsymptoticConditionKind.NON_NEGATIVE,
            AsymptoticConditionKind.NON_ZERO,
            AsymptoticConditionKind.GREATER_THAN_ONE,
            AsymptoticConditionKind.INTEGRAL
        ].includes(kind);
}

function proveCondition(kind, expression, context) {
    const simplified =
        simplifyCostExpression(expression);

    if (
        simplified.kind ===
        CostExpressionKind.CONSTANT
    ) {
        return proveConstantCondition(
            kind,
            simplified.value
        );
    }

    if (
        simplified.kind ===
        CostExpressionKind.SYMBOL
    ) {
        return proveSymbolCondition(
            kind,
            simplified,
            context
        );
    }

    switch (simplified.kind) {
        case CostExpressionKind.GROUP:
            return proveCondition(
                kind,
                simplified.expression,
                context
            );
        case CostExpressionKind.SUM:
            return proveSumCondition(
                kind,
                simplified.terms,
                context
            );
        case CostExpressionKind.PRODUCT:
            return proveProductCondition(
                kind,
                simplified.factors,
                context
            );
        case CostExpressionKind.QUOTIENT:
            return proveQuotientCondition(
                kind,
                simplified,
                context
            );
        case CostExpressionKind.POWER:
            return provePowerCondition(
                kind,
                simplified,
                context
            );
        case CostExpressionKind.FACTORIAL:
            return kind ===
                AsymptoticConditionKind.NON_NEGATIVE;
        case CostExpressionKind.MAXIMUM:
            return proveMaximumCondition(
                kind,
                simplified.expressions,
                context
            );
        case CostExpressionKind.MINIMUM:
            return simplified.expressions.every(item =>
                proveCondition(kind, item, context)
            );
        case CostExpressionKind.CALL:
            return proveCallCondition(
                kind,
                simplified,
                context
            );
        default:
            return false;
    }
}

function proveConstantCondition(kind, value) {
    switch (kind) {
        case AsymptoticConditionKind.POSITIVE:
            return value > 0;
        case AsymptoticConditionKind.NON_NEGATIVE:
            return value >= 0;
        case AsymptoticConditionKind.NON_ZERO:
            return value !== 0;
        case AsymptoticConditionKind.GREATER_THAN_ONE:
            return value > 1;
        case AsymptoticConditionKind.INTEGRAL:
            return Number.isInteger(value);
        default:
            return false;
    }
}

function proveSymbolCondition(kind, expression, context) {
    if (
        context.boundIndices?.has(
            expression.name
        ) &&
        [
            AsymptoticConditionKind.POSITIVE,
            AsymptoticConditionKind.NON_NEGATIVE,
            AsymptoticConditionKind.NON_ZERO,
            AsymptoticConditionKind.GREATER_THAN_ONE,
            AsymptoticConditionKind.INTEGRAL
        ].includes(kind)
    ) {
        return true;
    }

    const own =
        createAsymptoticCondition(
            kind,
            expression
        );

    if (context.explicit.has(own.key)) {
        return true;
    }

    if (
        context.resolvingSymbols.has(
            expression.name
        )
    ) {
        return false;
    }

    const replacement =
        context.resolveSymbol?.(
            expression.name
        ) ?? null;

    if (replacement == null) {
        return false;
    }

    context.resolvingSymbols.add(expression.name);

    try {
        return proveCondition(
            kind,
            replacement,
            context
        );
    } finally {
        context.resolvingSymbols.delete(
            expression.name
        );
    }
}

function summationConditionContext(expression, context) {
    const lower = simplifyCostExpression(
        expression.lower
    );

    if (
        lower.kind !== CostExpressionKind.CONSTANT ||
        !Number.isInteger(lower.value) ||
        lower.value < 1 ||
        !Number.isInteger(expression.step)
    ) {
        return context;
    }

    return {
        ...context,
        boundIndices: new Set([
            ...(context.boundIndices ?? []),
            expression.index
        ])
    };
}

function proveSumCondition(kind, terms, context) {
    if (kind === AsymptoticConditionKind.NON_NEGATIVE) {
        return terms.every(term =>
            proveCondition(kind, term, context)
        );
    }

    if (kind === AsymptoticConditionKind.POSITIVE) {
        return terms.some(term =>
            proveCondition(kind, term, context)
        ) && terms.every(term =>
            proveCondition(
                AsymptoticConditionKind.NON_NEGATIVE,
                term,
                context
            )
        );
    }

    if (kind === AsymptoticConditionKind.GREATER_THAN_ONE) {
        return terms.some(term =>
            proveCondition(kind, term, context)
        ) && terms.every(term =>
            proveCondition(
                AsymptoticConditionKind.NON_NEGATIVE,
                term,
                context
            )
        );
    }

    return false;
}

function proveProductCondition(kind, factors, context) {
    if (kind === AsymptoticConditionKind.INTEGRAL) {
        return factors.every(factor =>
            proveCondition(kind, factor, context)
        );
    }

    if (kind === AsymptoticConditionKind.NON_NEGATIVE) {
        return factors.every(factor =>
            proveCondition(kind, factor, context)
        );
    }

    if (
        kind === AsymptoticConditionKind.POSITIVE ||
        kind === AsymptoticConditionKind.NON_ZERO
    ) {
        return factors.every(factor =>
            proveCondition(kind, factor, context)
        );
    }

    if (kind === AsymptoticConditionKind.GREATER_THAN_ONE) {
        return false;
    }

    return false;
}

function proveQuotientCondition(kind, expression, context) {
    if (kind === AsymptoticConditionKind.INTEGRAL) {
        return false;
    }

    if (kind === AsymptoticConditionKind.NON_ZERO) {
        return proveCondition(
            AsymptoticConditionKind.NON_ZERO,
            expression.numerator,
            context
        ) && proveCondition(
            AsymptoticConditionKind.NON_ZERO,
            expression.denominator,
            context
        );
    }

    if (kind === AsymptoticConditionKind.GREATER_THAN_ONE) {
        return false;
    }

    return proveCondition(
        kind,
        expression.numerator,
        context
    ) && proveCondition(
        AsymptoticConditionKind.POSITIVE,
        expression.denominator,
        context
    );
}

function provePowerCondition(kind, expression, context) {
    const exponent =
        simplifyCostExpression(
            expression.exponent
        );

    if (
        exponent.kind !==
        CostExpressionKind.CONSTANT
    ) {
        return kind === AsymptoticConditionKind.POSITIVE
            ? proveCondition(
                AsymptoticConditionKind.POSITIVE,
                expression.base,
                context
            )
            : false;
    }

    if (kind === AsymptoticConditionKind.NON_NEGATIVE) {
        return exponent.value % 2 === 0 ||
            proveCondition(
                AsymptoticConditionKind.NON_NEGATIVE,
                expression.base,
                context
            );
    }

    if (
        kind === AsymptoticConditionKind.POSITIVE ||
        kind === AsymptoticConditionKind.NON_ZERO
    ) {
        return proveCondition(
            AsymptoticConditionKind.POSITIVE,
            expression.base,
            context
        ) || (
            Number.isInteger(exponent.value) &&
            proveCondition(
                AsymptoticConditionKind.NON_ZERO,
                expression.base,
                context
            )
        );
    }

    return false;
}

function proveMaximumCondition(kind, expressions, context) {
    if (
        kind === AsymptoticConditionKind.NON_NEGATIVE ||
        kind === AsymptoticConditionKind.POSITIVE ||
        kind === AsymptoticConditionKind.GREATER_THAN_ONE
    ) {
        return expressions.some(expression =>
            proveCondition(kind, expression, context)
        );
    }

    return false;
}

function proveCallCondition(kind, expression, context) {
    const definition =
        getStandardLibraryDefinition(
            expression.name
        );
    const effect =
        definition?.symbolicEffect ??
        null;
    const argument =
        expression.args[
            effect?.argument ?? 0
        ] ?? null;

    if (effect?.kind === StandardLibrarySymbolicEffect.SIZE) {
        return (
            kind === AsymptoticConditionKind.NON_NEGATIVE ||
            kind === AsymptoticConditionKind.INTEGRAL
        );
    }

    if (effect?.kind === StandardLibrarySymbolicEffect.ABSOLUTE) {
        return kind ===
            AsymptoticConditionKind.NON_NEGATIVE;
    }

    if (
        effect?.kind === StandardLibrarySymbolicEffect.ROUNDING &&
        argument != null
    ) {
        if (kind === AsymptoticConditionKind.INTEGRAL) {
            return true;
        }

        return kind ===
            AsymptoticConditionKind.NON_NEGATIVE &&
            proveCondition(
                AsymptoticConditionKind.NON_NEGATIVE,
                argument,
                context
            );
    }

    if (
        effect?.kind === StandardLibrarySymbolicEffect.ROOT &&
        argument != null
    ) {
        return proveCondition(
            kind === AsymptoticConditionKind.GREATER_THAN_ONE
                ? AsymptoticConditionKind.GREATER_THAN_ONE
                : AsymptoticConditionKind.NON_NEGATIVE,
            argument,
            context
        );
    }

    if (
        effect?.kind === StandardLibrarySymbolicEffect.EXTREMUM &&
        expression.args.length > 0
    ) {
        return effect.operation === "maximum"
            ? proveMaximumCondition(
                kind,
                expression.args,
                context
            )
            : expression.args.every(item =>
                proveCondition(kind, item, context)
            );
    }

    return false;
}

function normalizeExplicitConditions(values) {
    const result = new Set();

    for (const value of values) {
        if (value?.kind === "asymptotic-condition") {
            result.add(value.key);
        }
    }

    return result;
}

function formatConditionText(kind, expression) {
    const text =
        formatCostExpression(expression);
    const details =
        CONDITION_DETAILS[kind];

    return kind === AsymptoticConditionKind.INTEGRAL
        ? `${text} es entero`
        : `${text} ${details.operator} ${details.value}`;
}
