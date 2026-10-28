import {
    CostExpressionKind,
    requireCostExpression
} from "./CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "./CostExpressionFactory.js";
import {
    canonicalizeCostExpression
} from "./CostExpressionCanonicalizer.js";
import {
    attachRecurrenceCallMetadata,
    getRecurrenceCallMetadata
} from "../recurrence/RecurrenceCallMetadata.js";

export const CostParameterSubstitutionCode =
    Object.freeze({
        ARGUMENT_MISSING:
            "CLRS_ASYMPTOTIC_CALL_ARGUMENT_MISSING",
        PARAMETERS_INVALID:
            "CLRS_ASYMPTOTIC_CALL_PARAMETERS_INVALID"
    });

/**
 * Construye un enlace simultáneo entre parámetros y argumentos. Los
 * argumentos adicionales se conservan como evidencia, pero no participan en
 * el cuerpo de la función, de acuerdo con la semántica flexible de llamadas.
 */
export function createCostParameterSubstitution(
    parameters,
    args,
    options = {}
) {
    if (
        !Array.isArray(parameters) ||
        !Array.isArray(args)
    ) {
        throw new TypeError(
            "Cost parameter substitution requires parameter and argument arrays."
        );
    }

    args.forEach((argument, index) =>
        requireCostExpression(
            argument,
            `call arguments[${index}]`
        )
    );

    const normalizedParameters =
        parameters.map(String);
    const invalid =
        normalizedParameters.filter(
            parameter =>
                parameter.length === 0
        );
    const duplicates =
        repeatedNames(
            normalizedParameters
        );
    const missing =
        normalizedParameters.slice(
            args.length
        );
    const bindingCount =
        Math.min(
            normalizedParameters.length,
            args.length
        );
    const bindings =
        normalizedParameters
            .slice(0, bindingCount)
            .map((name, index) =>
                Object.freeze({
                    name,
                    expression:
                        args[index]
                })
            );
    const parametersValid =
        invalid.length === 0 &&
        duplicates.length === 0;
    const allowMissing =
        options.allowMissing === true;
    const complete =
        parametersValid &&
        (
            missing.length === 0 ||
            allowMissing
        );
    const code =
        !parametersValid
            ? CostParameterSubstitutionCode
                .PARAMETERS_INVALID
            : missing.length > 0 &&
                !allowMissing
                ? CostParameterSubstitutionCode
                    .ARGUMENT_MISSING
                : null;
    const message =
        code ===
            CostParameterSubstitutionCode
                .PARAMETERS_INVALID
            ? "La función contiene parámetros vacíos o duplicados y no puede instanciarse de forma segura."
            : code ===
                CostParameterSubstitutionCode
                    .ARGUMENT_MISSING
                ? `Faltan argumentos para los parámetros: ${missing.join(", ")}.`
                : null;

    return Object.freeze({
        kind: "cost-parameter-substitution",
        complete,
        partial:
            complete && missing.length > 0,
        code,
        message,
        parameters:
            Object.freeze([
                ...normalizedParameters
            ]),
        arguments:
            Object.freeze([
                ...args
            ]),
        bindings:
            Object.freeze(bindings),
        missing:
            Object.freeze(missing),
        duplicates:
            Object.freeze(duplicates),
        extraArguments:
            Object.freeze(
                args.slice(
                    normalizedParameters.length
                )
            )
    });
}

export function instantiateCostParameters(
    expression,
    parameters,
    args,
    options = {}
) {
    requireCostExpression(expression);

    const substitution =
        createCostParameterSubstitution(
            parameters,
            args,
            options
        );

    return Object.freeze({
        ...substitution,
        kind:
            "cost-parameter-instantiation",
        expression:
            substitution.complete
                ? substituteCostExpression(
                    expression,
                    substitution.bindings
                )
                : null
    });
}

/**
 * Sustitución simultánea: una expresión insertada nunca vuelve a recorrerse.
 * Esto evita capturas como `{a -> b, b -> n}` convirtiendo por accidente el
 * argumento de `a` en `n`.
 */
export function substituteCostExpression(
    expression,
    bindings,
    options = {}
) {
    requireCostExpression(expression);

    const replacements =
        normalizeBindings(bindings);
    const substituted =
        substituteExpression(
            expression,
            replacements
        );

    return options.canonical === false
        ? substituted
        : canonicalizeCostExpression(
            substituted
        );
}

function substituteExpression(
    expression,
    replacements
) {
    if (
        expression.kind ===
            CostExpressionKind.SYMBOL &&
        replacements.has(
            expression.name
        )
    ) {
        return replacements.get(
            expression.name
        );
    }

    switch (expression.kind) {
        case CostExpressionKind.SUM:
            return Cost.sum(
                substituteMany(
                    expression.terms,
                    replacements
                )
            );
        case CostExpressionKind.SUMMATION:
            return substituteSummation(
                expression,
                replacements
            );
        case CostExpressionKind.DIFFERENCE:
            return Cost.difference(
                substituteExpression(
                    expression.left,
                    replacements
                ),
                substituteExpression(
                    expression.right,
                    replacements
                )
            );
        case CostExpressionKind.PRODUCT:
            return Cost.product(
                substituteMany(
                    expression.factors,
                    replacements
                )
            );
        case CostExpressionKind.QUOTIENT:
            return Cost.quotient(
                substituteExpression(
                    expression.numerator,
                    replacements
                ),
                substituteExpression(
                    expression.denominator,
                    replacements
                )
            );
        case CostExpressionKind.GROUP:
            return Cost.group(
                substituteExpression(
                    expression.expression,
                    replacements
                )
            );
        case CostExpressionKind.POWER:
            return Cost.power(
                substituteExpression(
                    expression.base,
                    replacements
                ),
                substituteExpression(
                    expression.exponent,
                    replacements
                )
            );
        case CostExpressionKind.LOGARITHM:
            return Cost.logarithm(
                substituteExpression(
                    expression.argument,
                    replacements
                ),
                expression.base == null
                    ? null
                    : substituteExpression(
                        expression.base,
                        replacements
                    )
            );
        case CostExpressionKind.FACTORIAL:
            return Cost.factorial(
                substituteExpression(
                    expression.argument,
                    replacements
                )
            );
        case CostExpressionKind.CALL:
            return substituteCall(
                expression,
                replacements
            );
        case CostExpressionKind.MINIMUM:
            return Cost.minimum(
                substituteMany(
                    expression.expressions,
                    replacements
                )
            );
        case CostExpressionKind.MAXIMUM:
            return Cost.maximum(
                substituteMany(
                    expression.expressions,
                    replacements
                )
            );
        case CostExpressionKind.EQUATION:
            return Cost.equation(
                substituteExpression(
                    expression.left,
                    replacements
                ),
                substituteExpression(
                    expression.right,
                    replacements
                )
            );
        case CostExpressionKind.RECURRENCE:
            return Cost.recurrence(
                substituteExpression(
                    expression.left,
                    replacements
                ),
                substituteExpression(
                    expression.right,
                    replacements
                )
            );
        default:
            return expression;
    }
}

function substituteCall(
    expression,
    replacements
) {
    const call =
        Cost.call(
            expression.name,
            substituteMany(
                expression.args,
                replacements
            )
        );
    const recurrenceMetadata =
        getRecurrenceCallMetadata(
            expression
        );

    if (recurrenceMetadata != null) {
        attachRecurrenceCallMetadata(
            call,
            recurrenceMetadata
        );
    }

    return call;
}

function substituteSummation(
    expression,
    replacements
) {
    const termReplacements = new Map(replacements);

    termReplacements.delete(expression.index);

    return Cost.summation(
        expression.index,
        substituteExpression(
            expression.lower,
            replacements
        ),
        substituteExpression(
            expression.upper,
            replacements
        ),
        substituteExpression(
            expression.term,
            termReplacements
        ),
        expression.step
    );
}

function substituteMany(
    expressions,
    replacements
) {
    return expressions.map(expression =>
        substituteExpression(
            expression,
            replacements
        )
    );
}

function normalizeBindings(bindings) {
    const entries =
        bindings instanceof Map
            ? [...bindings.entries()]
            : Array.isArray(bindings)
                ? bindings.map(binding => [
                    binding.name,
                    binding.expression
                ])
                : bindings != null &&
                    typeof bindings === "object"
                    ? Object.entries(bindings)
                    : null;

    if (entries == null) {
        throw new TypeError(
            "Cost substitutions require a map, object, or binding array."
        );
    }

    const replacements = new Map();

    for (
        const [rawName, replacement]
        of entries
    ) {
        const name = String(rawName);

        if (
            name.length === 0 ||
            replacements.has(name)
        ) {
            throw new TypeError(
                "Cost substitution names must be unique and non-empty."
            );
        }

        replacements.set(
            name,
            requireCostExpression(
                replacement,
                `substitution for ${name}`
            )
        );
    }

    return replacements;
}

function repeatedNames(names) {
    const seen = new Set();
    const duplicates = new Set();

    for (const name of names) {
        if (seen.has(name)) {
            duplicates.add(name);
        }

        seen.add(name);
    }

    return [...duplicates];
}
