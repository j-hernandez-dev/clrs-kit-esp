import {
    CostExpressionKind
} from "../algebra/CostExpression.js";
import {
    StandardLibrarySymbolicEffect,
    getStandardLibraryDefinition
} from "../../standard-library/StandardLibraryCatalog.js";

const EPSILON = 1e-10;

/**
 * Reconoce una reducción de medida no afín de la forma n -> n^r, con
 * 0 < r < 1. Sólo se admite una medida que sea un parámetro directo: las
 * medidas de intervalo y las expresiones mezcladas permanecen en el dominio
 * afín hasta contar con una demostración relacional equivalente.
 */
export function generalizedReductionForCall(
    measure,
    parameters,
    argumentsList
) {
    if (
        measure?.kind !== "parameter" ||
        !Array.isArray(parameters) ||
        !Array.isArray(argumentsList)
    ) {
        return null;
    }

    const index = parameters.indexOf(
        measure.parameter
    );

    if (index < 0) {
        return null;
    }

    const exponent = powerExponent(
        argumentsList[index],
        measure.parameter
    );

    return exponent == null ||
        exponent <= EPSILON ||
        exponent >= 1 - EPSILON
        ? null
        : Object.freeze({
            kind: "power",
            exponent: normalized(exponent)
        });
}

function powerExponent(expression, parameter) {
    const value = unwrapGroup(expression);

    if (
        value?.kind === CostExpressionKind.SYMBOL &&
        value.name === parameter
    ) {
        return 1;
    }

    if (value?.kind === CostExpressionKind.POWER) {
        const exponent = numericConstant(
            value.exponent
        );
        const base = powerExponent(
            value.base,
            parameter
        );

        return exponent == null || base == null
            ? null
            : exponent * base;
    }

    if (value?.kind !== CostExpressionKind.CALL) {
        return null;
    }

    const definition = getStandardLibraryDefinition(
        value.name
    );
    const effect = definition?.symbolicEffect ?? null;

    if (
        effect?.kind ===
        StandardLibrarySymbolicEffect.ROUNDING &&
        value.args.length === 1
    ) {
        return powerExponent(
            value.args[0],
            parameter
        );
    }

    if (
        effect?.kind !==
            StandardLibrarySymbolicEffect.ROOT ||
        !Number.isFinite(effect.exponent) ||
        effect.exponent <= 0 ||
        effect.exponent >= 1
    ) {
        return null;
    }

    const argument = value.args[
        effect.argument ?? 0
    ];
    const nested = powerExponent(
        argument,
        parameter
    );

    return nested == null
        ? null
        : effect.exponent * nested;
}

function numericConstant(expression) {
    const value = unwrapGroup(expression);

    return value?.kind ===
        CostExpressionKind.CONSTANT &&
        Number.isFinite(value.value)
        ? value.value
        : null;
}

function unwrapGroup(expression) {
    let current = expression;

    while (
        current?.kind === CostExpressionKind.GROUP
    ) {
        current = current.expression;
    }

    return current;
}

function normalized(value) {
    const nearest = Math.round(value);

    return Math.abs(value - nearest) < EPSILON
        ? nearest
        : Number(value.toPrecision(12));
}
