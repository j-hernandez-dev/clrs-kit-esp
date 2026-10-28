import {
    requireCostExpression
} from "../algebra/CostExpression.js";

export const FunctionSemanticSummaryStatus =
    Object.freeze({
        TRANSPARENT: "transparent",
        OPAQUE: "opaque"
    });

/**
 * Contrato semántico conservador de una función CLRS propia.
 *
 * No intenta reemplazar su costo: describe sólo el valor que devuelve cuando
 * todas las rutas terminan en `retornar` y no hay efectos que puedan modificar
 * el estado observable. Las rutas de retorno se conservan por separado para
 * que las uniones posteriores no inventen una expresión única.
 */
export function createFunctionSemanticSummary({
    name,
    parameters = [],
    returns = [],
    effectKinds = [],
    complete = false,
    location = null
}) {
    if (
        typeof name !== "string" ||
        name.length === 0
    ) {
        throw new TypeError(
            "A function semantic summary requires a non-empty name."
        );
    }

    const normalizedParameters =
        parameters.map(String);
    const normalizedReturns = returns.map(
        item => normalizeReturn(item)
    );
    const normalizedEffects =
        [...new Set(effectKinds.map(String))]
            .sort();
    const dependencies =
        [...new Set(
            normalizedReturns.flatMap(item =>
                collectCallNames(item.expression)
            )
        )].sort();
    const transparent =
        Boolean(complete) &&
        normalizedReturns.length > 0 &&
        normalizedEffects.length === 0;

    return Object.freeze({
        kind: "function-semantic-summary",
        name,
        parameters: Object.freeze([
            ...normalizedParameters
        ]),
        status: transparent
            ? FunctionSemanticSummaryStatus
                .TRANSPARENT
            : FunctionSemanticSummaryStatus.OPAQUE,
        transparent,
        complete: Boolean(complete),
        returns: Object.freeze(normalizedReturns),
        dependencies: Object.freeze(dependencies),
        effectKinds: Object.freeze(normalizedEffects),
        location: location == null
            ? null
            : Object.freeze({ ...location })
    });
}

function normalizeReturn(item) {
    requireCostExpression(
        item?.expression,
        "semantic return expression"
    );

    return Object.freeze({
        expression: item.expression,
        constraints: Object.freeze([
            ...(item.constraints ?? [])
        ]),
        location: item.location == null
            ? null
            : Object.freeze({
                ...item.location
            })
    });
}

function collectCallNames(expression) {
    if (expression?.kind === "call") {
        return [
            expression.name,
            ...expression.args.flatMap(
                collectCallNames
            )
        ];
    }

    if (
        expression == null ||
        typeof expression !== "object"
    ) {
        return [];
    }

    return Object.values(expression)
        .flatMap(value =>
            Array.isArray(value)
                ? value.flatMap(collectCallNames)
                : collectCallNames(value)
        );
}
