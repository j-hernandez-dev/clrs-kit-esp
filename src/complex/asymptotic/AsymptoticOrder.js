import {
    constantGrowthTerm,
    createSpecialFactor,
    createGrowthTerm,
    divideGrowthTerms,
    formatGrowthTerm,
    growthTermDominates,
    growthTermKey,
    logarithmicGrowthTerm,
    multiplyGrowthTerms,
    powerGrowthTerm,
    specialGrowthTerm,
    variableGrowthTerm
} from "./GrowthTerm.js";

export function createKnownOrder(
    terms,
    metadata = {}
) {
    return freezeOrder({
        known: true,
        terms:
            Object.freeze(
                reduceTerms(terms)
            ),
        code: null,
        message: null
    }, metadata);
}

export function createUnknownOrder(
    code,
    message,
    metadata = {}
) {
    return freezeOrder({
        known: false,
        terms: Object.freeze([]),
        code,
        message
    }, {
        boundKind: "unknown",
        ...metadata
    });
}

export function withOrderMetadata(
    order,
    metadata = {}
) {
    return freezeOrder(
        {
            known: order.known,
            terms: order.terms,
            code: order.code,
            message: order.message
        },
        {
            boundKind:
                metadata.boundKind ??
                order.boundKind,
            eventualSign:
                metadata.eventualSign ??
                order.eventualSign,
            normalForm:
                metadata.normalForm ??
                order.normalForm,
            conditions: [
                ...(order.conditions ?? []),
                ...(metadata.conditions ?? [])
            ],
            evidence: [
                ...(order.evidence ?? []),
                ...(metadata.evidence ?? [])
            ]
        }
    );
}

export function constantOrder() {
    return createKnownOrder([
        constantGrowthTerm()
    ]);
}

export function variableOrder(name) {
    return createKnownOrder([
        variableGrowthTerm(name)
    ]);
}

export function logarithmicOrder(
    name
) {
    return createKnownOrder([
        logarithmicGrowthTerm(name)
    ]);
}

export function polylogarithmicOrder(
    name,
    polynomialExponent = 0,
    logarithmicExponent = 0
) {
    return createKnownOrder([
        createGrowthTerm({
            polynomial:
                polynomialExponent === 0
                    ? {}
                    : {
                        [name]:
                            polynomialExponent
                    },
            logarithmic:
                logarithmicExponent === 0
                    ? {}
                    : {
                        [name]:
                            logarithmicExponent
                    }
        })
    ]);
}

export function exponentialOrder(
    base,
    name = "n"
) {
    const exponentKey =
        JSON.stringify({
            kind: "symbol",
            name
        });

    return specialOrder(
        createSpecialFactor({
            key:
                "exponential:" +
                base +
                ":" +
                exponentKey,
            label:
                base +
                "^" +
                name,
            rank: 2,
            type: "exponential",
            base,
            exponentKey,
            logOrder:
                variableOrder(name),
            comparable: true
        })
    );
}

export function factorialOrder(
    name = "n",
    exponent = 1
) {
    return powerOrder(
        specialOrder(
            createSpecialFactor({
                key:
                    "factorial:" +
                    name,
                label:
                    name +
                    "!",
                rank: 3,
                type: "factorial",
                variable: name,
                comparable: true
            })
        ),
        exponent
    );
}

export function quasiPolynomialOrder(
    name = "n",
    {
        logarithmicCoefficient = 1,
        polynomialExponent = 0,
        logBase = 2
    } = {}
) {
    const normalizedLogarithmic =
        normalizeDisplayNumber(
            logarithmicCoefficient
        );
    const normalizedPolynomial =
        normalizeDisplayNumber(
            polynomialExponent
        );
    const normalizedBase =
        normalizeDisplayNumber(logBase);
    const exponentParts = [];

    if (normalizedLogarithmic !== 0) {
        exponentParts.push(
            (
                normalizedLogarithmic === 1
                    ? ""
                    : `${normalizedLogarithmic} `
            ) +
            `log_${normalizedBase} ${name}`
        );
    }

    if (normalizedPolynomial !== 0) {
        exponentParts.push(
            String(normalizedPolynomial)
        );
    }

    const exponent =
        exponentParts.length === 0
            ? "0"
            : exponentParts.join(" + ");

    return specialOrder(
        createSpecialFactor({
            key: [
                "quasi-polynomial",
                name,
                normalizedLogarithmic,
                normalizedPolynomial,
                normalizedBase
            ].join(":"),
            label:
                `${name}^(${exponent})`,
            rank: 1.5,
            type: "quasi-polynomial",
            variable: name,
            argumentOrder:
                variableOrder(name),
            logarithmicCoefficient:
                normalizedLogarithmic,
            polynomialExponent:
                normalizedPolynomial,
            logBase:
                normalizedBase,
            comparable: true
        })
    );
}

export function specialOrder(factor) {
    return createKnownOrder([
        specialGrowthTerm(factor)
    ]);
}

export function sumOrders(orders) {
    const unknown =
        orders.find(
            order =>
                !order.known
        );

    if (unknown != null) {
        return unknown;
    }

    return createKnownOrder(
        orders.flatMap(
            order =>
                order.terms
        ),
        mergeOrderMetadata(orders)
    );
}

export function minimumOrders(orders) {
    const known =
        orders.filter(
            order =>
                order.known
        );

    if (known.length === 0) {
        return orders[0];
    }

    const candidates = [];
    const hasUnknown = known.length !==
        orders.length;

    for (const order of known) {
        if (
            candidates.some(candidate =>
                orderDominates(
                    order,
                    candidate
                )
            )
        ) {
            continue;
        }

        for (
            let index =
                candidates.length - 1;
            index >= 0;
            index -= 1
        ) {
            if (
                orderDominates(
                    candidates[index],
                    order
                )
            ) {
                candidates.splice(index, 1);
            }
        }

        candidates.push(order);
    }

    if (candidates.length === 1) {
        return withOrderMetadata(
            candidates[0],
            {
                ...mergeOrderMetadata(known),
                boundKind:
                    hasUnknown
                        ? "upper"
                        : mergeOrderMetadata(
                            known
                        ).boundKind,
                evidence:
                    hasUnknown
                        ? [
                            "El mínimo de una alternativa conocida y otra desconocida conserva la alternativa conocida únicamente como cota superior."
                        ]
                        : []
            }
        );
    }

    return createUnknownOrder(
        "CLRS_ASYMPTOTIC_MINIMUM_INCOMPARABLE",
        "No se pudo determinar un orden mínimo común entre rutas con medidas incomparables."
    );
}

export function multiplyOrders(
    orders
) {
    const unknown =
        orders.find(
            order =>
                !order.known
        );

    if (unknown != null) {
        return unknown;
    }

    let terms = [
        constantGrowthTerm()
    ];

    for (const order of orders) {
        terms =
            terms.flatMap(left =>
                order.terms.map(
                    right =>
                        multiplyGrowthTerms(
                            left,
                            right
                        )
                )
            );
    }

    return createKnownOrder(
        terms,
        mergeOrderMetadata(orders)
    );
}

export function divideOrders(
    numerator,
    denominator
) {
    if (!numerator.known) {
        return numerator;
    }

    if (!denominator.known) {
        return denominator;
    }

    if (
        denominator.terms.length !== 1
    ) {
        return createUnknownOrder(
            "CLRS_ASYMPTOTIC_QUOTIENT_UNSUPPORTED",
            "No se puede comparar un cociente cuyo denominador tiene varios términos dominantes."
        );
    }

    const terms =
        numerator.terms.map(term =>
            divideGrowthTerms(
                term,
                denominator.terms[0]
            )
        );

    if (
        terms.some(
            term =>
                term == null
        )
    ) {
        return createUnknownOrder(
            "CLRS_ASYMPTOTIC_QUOTIENT_UNSUPPORTED",
            "No se pudo simplificar el orden asintótico del cociente."
        );
    }

    return createKnownOrder(
        terms,
        quotientOrderMetadata(
            numerator,
            denominator
        )
    );
}

export function powerOrder(
    order,
    exponent
) {
    if (!order.known) {
        return order;
    }

    if (
        !Number.isFinite(exponent)
    ) {
        return createUnknownOrder(
            "CLRS_ASYMPTOTIC_POWER_UNSUPPORTED",
            "El exponente del orden asintótico debe ser una constante finita."
        );
    }

    if (
        exponent < 0 &&
        order.terms.some(term =>
            term.specialFactors.length > 0
        )
    ) {
        return createUnknownOrder(
            "CLRS_ASYMPTOTIC_POWER_UNSUPPORTED",
            "No se puede invertir de forma segura un factor asintótico especial."
        );
    }

    return createKnownOrder(
        order.terms.map(term =>
            powerGrowthTerm(
                term,
                exponent
            )
        ),
        powerOrderMetadata(
            order,
            exponent
        )
    );
}

export function logarithmOfOrder(
    order
) {
    if (!order.known) {
        return order;
    }

    return withOrderMetadata(
        sumOrders(
            order.terms.map(
                logarithmOfTerm
            )
        ),
        mergeOrderMetadata([order])
    );
}

export function formatOrder(order) {
    if (!order.known) {
        return "O(?)";
    }

    return (
        "O(" +
        order.terms
            .map(formatGrowthTerm)
            .join(" + ") +
        ")"
    );
}

export function orderKey(order) {
    return order.known
        ? order.terms
            .map(growthTermKey)
            .join("+")
        : `unknown:${order.code}`;
}

export function orderDominates(
    left,
    right
) {
    if (!left.known || !right.known) {
        return false;
    }

    return right.terms.every(
        rightTerm =>
            left.terms.some(
                leftTerm =>
                    growthTermDominates(
                        leftTerm,
                        rightTerm
                    )
            )
    );
}

function logarithmOfTerm(term) {
    const components = [];

    for (
        const factor
        of term.specialFactors
    ) {
        if (
            factor.type ===
                "quasi-polynomial"
        ) {
            const argumentOrder =
                factor.argumentOrder ??
                (
                    factor.variable == null
                        ? null
                        : variableOrder(
                            factor.variable
                        )
                );

            if (argumentOrder == null) {
                return createUnknownOrder(
                    "CLRS_ASYMPTOTIC_LOGARITHM_UNSUPPORTED",
                    "No se pudo determinar el argumento del termino cuasipolinomico."
                );
            }

            const logarithm =
                logarithmOfOrder(
                    argumentOrder
                );

            if (!logarithm.known) {
                return logarithm;
            }

            if (
                factor.logarithmicCoefficient !== 0
            ) {
                components.push(
                    powerOrder(
                        logarithm,
                        2
                    )
                );
            } else if (
                factor.polynomialExponent !== 0
            ) {
                components.push(logarithm);
            }
            continue;
        }

        if (
            factor.type === "iterated-log" &&
            factor.variable != null
        ) {
            const iterations =
                (factor.iterations ?? 2) + 1;
            const label =
                `${"log ".repeat(iterations)}${factor.variable}`;

            components.push(
                specialOrder(
                    createSpecialFactor({
                        ...factor,
                        key:
                            `iterated-log:${iterations}:${factor.variable}`,
                        label,
                        iterations
                    })
                )
            );
            continue;
        }

        if (factor.logOrder != null) {
            components.push(
                factor.logOrder
            );
            continue;
        }

        if (
            factor.type ===
                "factorial" &&
            factor.variable != null
        ) {
            components.push(
                multiplyOrders([
                    variableOrder(
                        factor.variable
                    ),
                    logarithmicOrder(
                        factor.variable
                    )
                ])
            );
            continue;
        }

        return createUnknownOrder(
            "CLRS_ASYMPTOTIC_LOGARITHM_UNSUPPORTED",
            "No se pudo determinar el logaritmo del término dominante."
        );
    }

    for (
        const [name, exponent]
        of Object.entries(
            term.polynomial
        )
    ) {
        if (exponent !== 0) {
            components.push(
                logarithmicOrder(name)
            );
        }
    }

    if (
        components.length === 0 &&
        Object.keys(
            term.logarithmic
        ).length > 0
    ) {
        const names = Object.keys(
            term.logarithmic
        ).sort();
        const label = names
                .map(name =>
                    `log log ${name}`
                )
                .join(" + ");

        return createKnownOrder([
            createGrowthTerm({
                specialFactors: [
                    createSpecialFactor({
                        key:
                            `iterated-log:${label}`,
                        label,
                        rank: 0.5,
                        type:
                            "iterated-log",
                        iterations: 2,
                        variable:
                            names.length === 1
                                ? names[0]
                                : null,
                        comparable: true
                    })
                ]
            })
        ]);
    }

    return components.length === 0
        ? constantOrder()
        : sumOrders(components);
}

function reduceTerms(terms) {
    const unique =
        new Map();

    for (const term of terms) {
        unique.set(
            growthTermKey(term),
            term
        );
    }

    const candidates = [
        ...unique.values()
    ];

    return candidates
        .filter(
            (term, index) =>
                !candidates.some(
                    (other, otherIndex) =>
                        index !== otherIndex &&
                        growthTermDominates(
                            other,
                            term
                        )
                )
        )
        .sort(compareGrowthTerms);
}

function freezeOrder(value, metadata = {}) {
    const order = {
        ...value
    };

    Object.defineProperties(
        order,
        {
            boundKind: {
                value:
                    normalizeBoundKind(
                        metadata.boundKind
                    )
            },
            eventualSign: {
                value:
                    metadata.eventualSign ??
                    "non-negative"
            },
            normalForm: {
                value:
                    metadata.normalForm ?? null
            },
            conditions: {
                value:
                    Object.freeze([
                        ...new Map(
                            (metadata.conditions ?? [])
                                .map(condition => [
                                    condition.key ??
                                        JSON.stringify(
                                            condition
                                        ),
                                    condition
                                ])
                        ).values()
                    ])
            },
            evidence: {
                value:
                    Object.freeze([
                        ...new Set(
                            metadata.evidence ?? []
                        )
                    ])
            }
        }
    );

    return Object.freeze(order);
}

function mergeOrderMetadata(orders) {
    const kinds = new Set(
        orders.map(order =>
            order.boundKind ?? "tight"
        )
    );
    const boundKind = kinds.has("unknown")
        ? "unknown"
        : kinds.has("upper") &&
            kinds.has("lower")
            ? "unknown"
            : kinds.has("upper")
            ? "upper"
            : kinds.has("lower")
                ? "lower"
                : "tight";

    return {
        boundKind,
        conditions:
            orders.flatMap(order =>
                order.conditions ?? []
            ),
        evidence:
            orders.flatMap(order =>
                order.evidence ?? []
            )
    };
}

function quotientOrderMetadata(
    numerator,
    denominator
) {
    const numeratorKind =
        numerator.boundKind ?? "tight";
    const denominatorKind =
        invertBoundKind(
            denominator.boundKind ??
                "tight"
        );

    return {
        ...mergeOrderMetadata([
            withOrderMetadata(
                numerator,
                {
                    boundKind:
                        numeratorKind
                }
            ),
            withOrderMetadata(
                denominator,
                {
                    boundKind:
                        denominatorKind
                }
            )
        ])
    };
}

function powerOrderMetadata(order, exponent) {
    if (exponent === 0) {
        return {
            ...mergeOrderMetadata([order]),
            boundKind: "tight"
        };
    }

    return {
        ...mergeOrderMetadata([order]),
        boundKind:
            exponent < 0
                ? invertBoundKind(
                    order.boundKind ??
                        "tight"
                )
                : order.boundKind ??
                    "tight"
    };
}

function invertBoundKind(kind) {
    if (kind === "upper") {
        return "lower";
    }

    if (kind === "lower") {
        return "upper";
    }

    return kind;
}

function normalizeBoundKind(value) {
    return [
        "tight",
        "upper",
        "lower",
        "unknown"
    ].includes(value)
        ? value
        : "tight";
}

function compareGrowthTerms(left, right) {
    const leftUsesN =
        usesPreferredSize(left);
    const rightUsesN =
        usesPreferredSize(right);

    if (leftUsesN !== rightUsesN) {
        return leftUsesN ? -1 : 1;
    }

    return formatGrowthTerm(left)
        .localeCompare(
            formatGrowthTerm(right)
        );
}

function usesPreferredSize(term) {
    return (
        Object.hasOwn(
            term.polynomial,
            "n"
        ) ||
        Object.hasOwn(
            term.logarithmic,
            "n"
        )
    );
}

function normalizeDisplayNumber(value) {
    const number = Number(value);
    const nearest = Math.round(number);

    if (Math.abs(number - nearest) < 1e-8) {
        return nearest;
    }

    return Number(number.toFixed(6));
}
