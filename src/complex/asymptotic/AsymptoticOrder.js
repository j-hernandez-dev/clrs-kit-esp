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
    terms
) {
    return Object.freeze({
        known: true,
        terms:
            Object.freeze(
                reduceTerms(terms)
            ),
        code: null,
        message: null
    });
}

export function createUnknownOrder(
    code,
    message
) {
    return Object.freeze({
        known: false,
        terms: Object.freeze([]),
        code,
        message
    });
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
        )
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

    return createKnownOrder(terms);
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

    return createKnownOrder(terms);
}

export function powerOrder(
    order,
    exponent
) {
    if (!order.known) {
        return order;
    }

    if (
        !Number.isFinite(exponent) ||
        exponent < 0
    ) {
        return createUnknownOrder(
            "CLRS_ASYMPTOTIC_POWER_UNSUPPORTED",
            "El exponente del orden asintótico debe ser una constante no negativa."
        );
    }

    return createKnownOrder(
        order.terms.map(term =>
            powerGrowthTerm(
                term,
                exponent
            )
        )
    );
}

export function logarithmOfOrder(
    order
) {
    if (!order.known) {
        return order;
    }

    return sumOrders(
        order.terms.map(
            logarithmOfTerm
        )
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

function logarithmOfTerm(term) {
    const components = [];

    for (
        const factor
        of term.specialFactors
    ) {
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
        const label =
            Object.keys(
                term.logarithmic
            )
                .sort()
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
                        comparable: false
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

    return candidates.filter(
        (term, index) =>
            !candidates.some(
                (other, otherIndex) =>
                    index !== otherIndex &&
                    growthTermDominates(
                        other,
                        term
                    )
            )
    );
}
