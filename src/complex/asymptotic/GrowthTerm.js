export function createGrowthTerm({
    polynomial = {},
    logarithmic = {},
    specialFactors = []
} = {}) {
    return Object.freeze({
        polynomial:
            freezePowers(polynomial),
        logarithmic:
            freezePowers(logarithmic),
        specialFactors:
            Object.freeze(
                normalizeSpecialFactors(
                    specialFactors
                )
            )
    });
}

export function constantGrowthTerm() {
    return createGrowthTerm();
}

export function variableGrowthTerm(name) {
    return createGrowthTerm({
        polynomial: {
            [name]: 1
        }
    });
}

export function logarithmicGrowthTerm(
    name
) {
    return createGrowthTerm({
        logarithmic: {
            [name]: 1
        }
    });
}

export function specialGrowthTerm(
    factor
) {
    return createGrowthTerm({
        specialFactors: [
            factor
        ]
    });
}

export function createSpecialFactor({
    key,
    label,
    rank,
    type,
    count = 1,
    base = null,
    exponentKey = null,
    variable = null,
    logOrder = null,
    comparable = false
}) {
    return Object.freeze({
        key,
        label,
        rank,
        type,
        count,
        base,
        exponentKey,
        variable,
        logOrder,
        comparable
    });
}

export function multiplyGrowthTerms(
    left,
    right
) {
    return createGrowthTerm({
        polynomial:
            addPowers(
                left.polynomial,
                right.polynomial
            ),
        logarithmic:
            addPowers(
                left.logarithmic,
                right.logarithmic
            ),
        specialFactors: [
            ...left.specialFactors,
            ...right.specialFactors
        ]
    });
}

export function divideGrowthTerms(
    numerator,
    denominator
) {
    const specialFactors =
        subtractSpecialFactors(
            numerator.specialFactors,
            denominator.specialFactors
        );

    if (specialFactors == null) {
        return null;
    }

    return createGrowthTerm({
        polynomial:
            subtractPowers(
                numerator.polynomial,
                denominator.polynomial
            ),
        logarithmic:
            subtractPowers(
                numerator.logarithmic,
                denominator.logarithmic
            ),
        specialFactors
    });
}

export function powerGrowthTerm(
    term,
    exponent
) {
    return createGrowthTerm({
        polynomial:
            scalePowers(
                term.polynomial,
                exponent
            ),
        logarithmic:
            scalePowers(
                term.logarithmic,
                exponent
            ),
        specialFactors:
            term.specialFactors.map(
                factor =>
                    createSpecialFactor({
                        ...factor,
                        count:
                            factor.count *
                            exponent
                    })
            )
    });
}

export function growthTermKey(term) {
    return JSON.stringify({
        polynomial:
            term.polynomial,
        logarithmic:
            term.logarithmic,
        specialFactors:
            term.specialFactors.map(
                factor => ({
                    key: factor.key,
                    count:
                        factor.count
                })
            )
    });
}

export function growthTermDominates(
    left,
    right
) {
    if (
        growthTermKey(left) ===
        growthTermKey(right)
    ) {
        return true;
    }

    const leftRank =
        comparableSpecialRank(left);
    const rightRank =
        comparableSpecialRank(right);

    if (
        leftRank != null &&
        rightRank != null &&
        leftRank !== rightRank
    ) {
        return leftRank > rightRank;
    }

    if (
        left.specialFactors.length > 0 ||
        right.specialFactors.length > 0
    ) {
        const specialComparison =
            compareSpecialFactors(
                left.specialFactors,
                right.specialFactors
            );

        if (specialComparison == null) {
            return false;
        }

        if (specialComparison !== 0) {
            return specialComparison > 0;
        }
    }

    return dominatesPowers(
        left,
        right
    );
}

export function isConstantGrowthTerm(
    term
) {
    return (
        Object.keys(
            term.polynomial
        ).length === 0 &&
        Object.keys(
            term.logarithmic
        ).length === 0 &&
        term.specialFactors.length === 0
    );
}

export function formatGrowthTerm(term) {
    const factors = [];

    for (
        const name
        of orderedNames(
            term.polynomial
        )
    ) {
        factors.push(
            formatPower(
                name,
                term.polynomial[name]
            )
        );
    }

    for (
        const name
        of orderedNames(
            term.logarithmic
        )
    ) {
        factors.push(
            formatPower(
                `log ${name}`,
                term.logarithmic[name],
                true
            )
        );
    }

    for (
        const factor
        of term.specialFactors
    ) {
        factors.push(
            formatPower(
                factor.label,
                factor.count,
                factor.count !== 1
            )
        );
    }

    return factors.length === 0
        ? "1"
        : factors.join(" ");
}

function freezePowers(powers) {
    const normalized = {};

    for (
        const name
        of Object.keys(powers)
            .sort(compareNames)
    ) {
        const exponent =
            Number(powers[name]);

        if (
            Number.isFinite(exponent) &&
            exponent !== 0
        ) {
            normalized[name] =
                exponent;
        }
    }

    return Object.freeze(normalized);
}

function normalizeSpecialFactors(
    factors
) {
    const byKey = new Map();

    for (const factor of factors) {
        const existing =
            byKey.get(factor.key);

        if (existing == null) {
            byKey.set(
                factor.key,
                factor
            );
        } else {
            byKey.set(
                factor.key,
                createSpecialFactor({
                    ...existing,
                    count:
                        existing.count +
                        factor.count
                })
            );
        }
    }

    return [
        ...byKey.values()
    ].filter(
        factor =>
            factor.count !== 0
    ).sort(
        (left, right) =>
            left.key.localeCompare(
                right.key
            )
    );
}

function addPowers(left, right) {
    const result = {
        ...left
    };

    for (
        const [name, exponent]
        of Object.entries(right)
    ) {
        result[name] =
            (result[name] ?? 0) +
            exponent;
    }

    return result;
}

function subtractPowers(
    left,
    right
) {
    const result = {
        ...left
    };

    for (
        const [name, exponent]
        of Object.entries(right)
    ) {
        result[name] =
            (result[name] ?? 0) -
            exponent;
    }

    return result;
}

function scalePowers(powers, scale) {
    return Object.fromEntries(
        Object.entries(powers)
            .map(
                ([name, exponent]) => [
                    name,
                    exponent * scale
                ]
            )
    );
}

function subtractSpecialFactors(
    numerator,
    denominator
) {
    const result =
        new Map(
            numerator.map(
                factor => [
                    factor.key,
                    factor
                ]
            )
        );

    for (const factor of denominator) {
        const existing =
            result.get(factor.key);

        if (
            existing == null ||
            existing.count <
                factor.count
        ) {
            return null;
        }

        result.set(
            factor.key,
            createSpecialFactor({
                ...existing,
                count:
                    existing.count -
                    factor.count
            })
        );
    }

    return [
        ...result.values()
    ];
}

function comparableSpecialRank(term) {
    if (
        term.specialFactors.some(
            factor =>
                !factor.comparable
        )
    ) {
        return null;
    }

    return Math.max(
        0,
        ...term.specialFactors.map(
            factor =>
                factor.rank
        )
    );
}

function compareSpecialFactors(
    left,
    right
) {
    const leftSignature =
        specialSignature(left);
    const rightSignature =
        specialSignature(right);

    if (leftSignature === rightSignature) {
        return compareSpecialCounts(
            left,
            right
        );
    }

    if (
        left.length === 1 &&
        right.length === 1
    ) {
        const leftFactor = left[0];
        const rightFactor = right[0];

        if (
            leftFactor.type ===
                "exponential" &&
            rightFactor.type ===
                "exponential" &&
            leftFactor.exponentKey ===
                rightFactor.exponentKey &&
            Number.isFinite(
                leftFactor.base
            ) &&
            Number.isFinite(
                rightFactor.base
            )
        ) {
            return Math.sign(
                leftFactor.base -
                rightFactor.base
            );
        }
    }

    return null;
}

function specialSignature(factors) {
    return factors
        .map(factor =>
            factor.key
        )
        .join("|");
}

function compareSpecialCounts(
    left,
    right
) {
    let comparison = 0;

    for (let index = 0;
        index < left.length;
        index++
    ) {
        const difference =
            left[index].count -
            right[index].count;

        if (difference === 0) {
            continue;
        }

        if (
            comparison !== 0 &&
            Math.sign(difference) !==
                comparison
        ) {
            return null;
        }

        comparison =
            Math.sign(difference);
    }

    return comparison;
}

function dominatesPowers(left, right) {
    const names =
        new Set([
            ...Object.keys(
                left.polynomial
            ),
            ...Object.keys(
                right.polynomial
            ),
            ...Object.keys(
                left.logarithmic
            ),
            ...Object.keys(
                right.logarithmic
            )
        ]);
    let strictlyGreater = false;

    for (const name of names) {
        const comparison =
            compareGrowthPair(
                [
                    left.polynomial[
                        name
                    ] ?? 0,
                    left.logarithmic[
                        name
                    ] ?? 0
                ],
                [
                    right.polynomial[
                        name
                    ] ?? 0,
                    right.logarithmic[
                        name
                    ] ?? 0
                ]
            );

        if (comparison < 0) {
            return false;
        }

        if (comparison > 0) {
            strictlyGreater = true;
        }
    }

    return strictlyGreater;
}

function compareGrowthPair(
    left,
    right
) {
    if (left[0] !== right[0]) {
        return Math.sign(
            left[0] -
            right[0]
        );
    }

    return Math.sign(
        left[1] -
        right[1]
    );
}

function formatPower(
    base,
    exponent,
    grouped = false
) {
    if (exponent === 1) {
        return base;
    }

    return (
        (grouped
            ? `(${base})`
            : base) +
        "^" +
        exponent
    );
}

function orderedNames(powers) {
    return Object.keys(powers)
        .sort(compareNames);
}

function compareNames(left, right) {
    if (left === right) {
        return 0;
    }

    if (left === "n") {
        return -1;
    }

    if (right === "n") {
        return 1;
    }

    return left.localeCompare(right);
}
