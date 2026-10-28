import {
    createSpecialFactor
} from "./GrowthTerm.js";
import {
    constantOrder,
    createUnknownOrder,
    formatOrder,
    logarithmOfOrder,
    multiplyOrders,
    orderKey,
    powerOrder,
    quasiPolynomialOrder,
    specialOrder,
    sumOrders,
    variableOrder,
    withOrderMetadata
} from "./AsymptoticOrder.js";

const COMPOSITION_UNSUPPORTED =
    "CLRS_ASYMPTOTIC_CALL_COMPOSITION_UNSUPPORTED";

/**
 * Compone un orden abstracto con los órdenes de las medidas reales. Así,
 * `O(n²)` aplicado a un argumento de orden `m²` se convierte en `O(m⁴)`.
 */
export function composeAsymptoticOrder(
    order,
    replacements = new Map()
) {
    if (!order?.known) {
        return order;
    }

    const normalized =
        replacements instanceof Map
            ? replacements
            : new Map(
                Object.entries(
                    replacements
                )
            );
    const terms = [];

    for (const term of order.terms) {
        const composed =
            composeTerm(
                term,
                normalized
            );

        if (!composed.known) {
            return composed;
        }

        terms.push(composed);
    }

    const composed = sumOrders(terms);

    return withOrderMetadata(
        composed,
        {
            boundKind:
                composeBoundKind(
                    order.boundKind,
                    composed.boundKind
                ),
            conditions:
                order.conditions ?? [],
            evidence:
                order.evidence ?? []
        }
    );
}

export function asymptoticOrderVariables(order) {
    if (!order?.known) {
        return Object.freeze([]);
    }

    const variables = new Set();

    for (const term of order.terms) {
        Object.keys(term.polynomial)
            .forEach(name => variables.add(name));
        Object.keys(term.logarithmic)
            .forEach(name => variables.add(name));

        for (const factor of term.specialFactors) {
            if (factor.variable != null) {
                variables.add(factor.variable);
            }

            for (
                const name
                of asymptoticOrderVariables(
                    factor.logOrder
                )
            ) {
                variables.add(name);
            }

            for (
                const name
                of asymptoticOrderVariables(
                    factor.argumentOrder
                )
            ) {
                variables.add(name);
            }
        }
    }

    return Object.freeze(
        [...variables].sort()
    );
}

function composeTerm(term, replacements) {
    const factors = [];

    for (
        const [name, exponent]
        of Object.entries(
            term.polynomial
        )
    ) {
        factors.push(
            powerOrder(
                replacements.get(name) ??
                    variableOrder(name),
                exponent
            )
        );
    }

    for (
        const [name, exponent]
        of Object.entries(
            term.logarithmic
        )
    ) {
        factors.push(
            powerOrder(
                logarithmOfOrder(
                    replacements.get(name) ??
                        variableOrder(name)
                ),
                exponent
            )
        );
    }

    for (
        const factor
        of term.specialFactors
    ) {
        const composed =
            composeSpecialFactor(
                factor,
                replacements
            );

        if (!composed.known) {
            return composed;
        }

        factors.push(composed);
    }

    return factors.length === 0
        ? constantOrder()
        : multiplyOrders(factors);
}

function composeSpecialFactor(
    factor,
    replacements
) {
    if (
        factor.type === "iterated-log" &&
        factor.variable != null &&
        replacements.has(factor.variable)
    ) {
        const replacement = replacements.get(
            factor.variable
        );

        if (!replacement.known) {
            return replacement;
        }

        let composed = replacement;

        for (
            let index = 0;
            index < (factor.iterations ?? 2);
            index++
        ) {
            composed = logarithmOfOrder(composed);

            if (!composed.known) {
                return createUnknownOrder(
                    COMPOSITION_UNSUPPORTED,
                    `No se pudo componer el factor iterado ${factor.label} con la medida real de la llamada.`
                );
            }
        }

        return powerOrder(
            composed,
            factor.count
        );
    }

    if (
        factor.type ===
            "quasi-polynomial"
    ) {
        const sourceOrder =
            factor.argumentOrder ??
            (
                factor.variable == null
                    ? null
                    : variableOrder(
                        factor.variable
                    )
            );
        const requiresComposition =
            asymptoticOrderVariables(
                sourceOrder
            ).some(name =>
                replacements.has(name)
            );

        if (!requiresComposition) {
            return specialOrder(factor);
        }

        const replacement =
            composeAsymptoticOrder(
                sourceOrder,
                replacements
            );

        if (!replacement.known) {
            return replacement;
        }

        const profile =
            polynomialMeasureProfile(
                replacement
            );

        if (profile == null) {
            return createUnknownOrder(
                COMPOSITION_UNSUPPORTED,
                `No se pudo componer el factor cuasipolinómico ${factor.label} con la medida real de la llamada.`
            );
        }

        return quasiPolynomialOrder(
            profile.name,
            {
                logarithmicCoefficient:
                    factor
                        .logarithmicCoefficient *
                    factor.count *
                    profile.exponent *
                    profile.exponent,
                polynomialExponent:
                    factor
                        .polynomialExponent *
                    factor.count *
                    profile.exponent,
                logBase:
                    factor.logBase
            }
        );
    }

    if (
        factor.type === "factorial" &&
        factor.variable != null &&
        replacements.has(
            factor.variable
        )
    ) {
        const replacement =
            replacements.get(
                factor.variable
            );

        if (!replacement.known) {
            return replacement;
        }

        const variable =
            simpleVariableName(
                replacement
            );

        return specialOrder(
            createSpecialFactor({
                ...factor,
                key:
                    "factorial:" +
                    orderKey(replacement),
                label:
                    groupedOrderLabel(
                        replacement
                    ) + "!",
                variable,
                comparable:
                    variable != null ||
                    isPolynomialMeasure(
                        replacement
                    )
            })
        );
    }

    if (
        factor.type === "exponential"
    ) {
        const composedExponent =
            factor.logOrder == null
                ? null
                : composeAsymptoticOrder(
                    factor.logOrder,
                    replacements
                );

        if (
            composedExponent != null &&
            !composedExponent.known
        ) {
            return composedExponent;
        }

        if (
            composedExponent != null &&
            orderKey(composedExponent) !==
                orderKey(
                    factor.logOrder
                )
        ) {
            const variable =
                simpleVariableName(
                    composedExponent
                );

            return specialOrder(
                createSpecialFactor({
                    ...factor,
                    key:
                        "exponential:" +
                        factor.base +
                        ":" +
                        orderKey(
                            composedExponent
                        ),
                    label:
                        factor.base +
                        "^" +
                        groupedOrderLabel(
                            composedExponent
                        ),
                    exponentKey:
                        "order:" +
                        orderKey(
                            composedExponent
                        ),
                    logOrder:
                        composedExponent,
                    comparable:
                        variable != null ||
                        isPolynomialMeasure(
                            composedExponent
                        )
                })
            );
        }

        if (composedExponent != null) {
            return specialOrder(factor);
        }
    }

    if (
        referencesReplacement(
            factor.label,
            replacements
        )
    ) {
        return createUnknownOrder(
            COMPOSITION_UNSUPPORTED,
            `No se pudo componer de forma segura el factor especial ${factor.label} con los argumentos de la llamada.`
        );
    }

    return specialOrder(factor);
}

function simpleVariableName(order) {
    if (
        !order.known ||
        order.terms.length !== 1
    ) {
        return null;
    }

    const [term] = order.terms;
    const polynomial =
        Object.entries(
            term.polynomial
        );

    return (
        polynomial.length === 1 &&
        polynomial[0][1] === 1 &&
        Object.keys(
            term.logarithmic
        ).length === 0 &&
        term.specialFactors.length === 0
    )
        ? polynomial[0][0]
        : null;
}

function isPolynomialMeasure(order) {
    if (
        !order.known ||
        order.terms.length !== 1
    ) {
        return false;
    }

    const [term] = order.terms;
    const polynomial =
        Object.values(
            term.polynomial
        );

    return (
        polynomial.length > 0 &&
        polynomial.every(
            exponent =>
                Number.isFinite(exponent) &&
                exponent > 0
        ) &&
        Object.keys(
            term.logarithmic
        ).length === 0 &&
        term.specialFactors.length === 0
    );
}

function polynomialMeasureProfile(order) {
    if (
        !order.known ||
        order.terms.length !== 1
    ) {
        return null;
    }

    const [term] = order.terms;
    const polynomial =
        Object.entries(
            term.polynomial
        );

    return (
        polynomial.length === 1 &&
        Number.isFinite(
            polynomial[0][1]
        ) &&
        polynomial[0][1] > 0 &&
        Object.keys(
            term.logarithmic
        ).length === 0 &&
        term.specialFactors.length === 0
    )
        ? {
            name: polynomial[0][0],
            exponent: polynomial[0][1]
        }
        : null;
}

function groupedOrderLabel(order) {
    const notation =
        formatOrder(order);
    const label =
        notation.slice(2, -1);

    return order.terms.length > 1 ||
        /[\s+^]/.test(label)
        ? `(${label})`
        : label;
}

function referencesReplacement(
    label,
    replacements
) {
    return [...replacements.keys()]
        .some(name =>
            new RegExp(
                `(^|[^A-Za-z0-9_])${escapeRegExp(name)}([^A-Za-z0-9_]|$)`
            ).test(label)
        );
}

function escapeRegExp(value) {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

function composeBoundKind(left, right) {
    const kinds = new Set([
        left ?? "tight",
        right ?? "tight"
    ]);

    if (kinds.has("unknown")) {
        return "unknown";
    }

    return kinds.has("upper")
        ? "upper"
        : "tight";
}
