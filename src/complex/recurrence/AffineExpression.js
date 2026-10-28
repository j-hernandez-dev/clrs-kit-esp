import {
    CostExpressionKind
} from "../algebra/CostExpression.js";
import {
    StandardLibrarySymbolicEffect,
    getStandardLibraryDefinition
} from "../../standard-library/StandardLibraryCatalog.js";

const EPSILON = 1e-9;

export function affineFromCostExpression(
    expression
) {
    if (expression == null) {
        return null;
    }

    switch (expression.kind) {
        case CostExpressionKind.CONSTANT:
            return createAffine(
                expression.value
            );
        case CostExpressionKind.SYMBOL:
            return createAffine(
                0,
                {
                    [expression.name]: 1
                }
            );
        case CostExpressionKind.GROUP:
            return affineFromCostExpression(
                expression.expression
            );
        case CostExpressionKind.SUM:
            return combineAffines(
                expression.terms,
                addAffine
            );
        case CostExpressionKind.DIFFERENCE: {
            const left =
                affineFromCostExpression(
                    expression.left
                );
            const right =
                affineFromCostExpression(
                    expression.right
                );

            return (
                left == null ||
                right == null
            )
                ? null
                : addAffine(
                    left,
                    scaleAffine(
                        right,
                        -1
                    )
                );
        }
        case CostExpressionKind.PRODUCT:
            return affineProduct(
                expression.factors
            );
        case CostExpressionKind.QUOTIENT:
            return affineQuotient(
                expression
            );
        case CostExpressionKind.CALL:
            return (
                isAffinePreservingCall(
                    expression.name
                ) &&
                expression.args.length === 1
            )
                ? affineFromCostExpression(
                    expression.args[0]
                )
                : null;
        default:
            return null;
    }
}

function isAffinePreservingCall(name) {
    return (
        getStandardLibraryDefinition(
            name
        )?.symbolicEffect.kind ===
        StandardLibrarySymbolicEffect
            .ROUNDING
    );
}

export function createAffine(
    constant = 0,
    coefficients = {}
) {
    return Object.freeze({
        constant:
            normalizeNumber(
                constant
            ),
        coefficients:
            Object.freeze(
                normalizeCoefficients(
                    coefficients
                )
            )
    });
}

export function addAffine(
    left,
    right
) {
    const coefficients = {
        ...left.coefficients
    };

    for (
        const [name, value]
        of Object.entries(
            right.coefficients
        )
    ) {
        coefficients[name] =
            (coefficients[name] ?? 0) +
            value;
    }

    return createAffine(
        left.constant +
            right.constant,
        coefficients
    );
}

export function scaleAffine(
    affine,
    scale
) {
    return createAffine(
        affine.constant * scale,
        Object.fromEntries(
            Object.entries(
                affine.coefficients
            ).map(
                ([name, value]) => [
                    name,
                    value * scale
                ]
            )
        )
    );
}

export function substituteAffine(
    measure,
    parameters,
    argumentsList
) {
    let result =
        createAffine(
            measure.constant
        );

    for (
        let index = 0;
        index < parameters.length;
        index++
    ) {
        const coefficient =
            measure.coefficients[
                parameters[index]
            ] ?? 0;

        if (coefficient === 0) {
            continue;
        }

        const argument =
            affineFromCostExpression(
                argumentsList[index]
            );

        if (argument == null) {
            return null;
        }

        result =
            addAffine(
                result,
                scaleAffine(
                    argument,
                    coefficient
                )
            );
    }

    return result;
}

export function compareAffineReduction(
    current,
    next
) {
    if (
        current == null ||
        next == null
    ) {
        return null;
    }

    const names =
        new Set([
            ...Object.keys(
                current.coefficients
            ),
            ...Object.keys(
                next.coefficients
            )
        ]);
    let ratio = null;

    for (const name of names) {
        const currentValue =
            current.coefficients[
                name
            ] ?? 0;
        const nextValue =
            next.coefficients[
                name
            ] ?? 0;

        if (nearZero(currentValue)) {
            if (!nearZero(nextValue)) {
                return null;
            }

            continue;
        }

        const candidate =
            nextValue /
            currentValue;

        if (
            ratio != null &&
            !approximatelyEqual(
                ratio,
                candidate
            )
        ) {
            return null;
        }

        ratio = candidate;
    }

    if (
        ratio == null ||
        ratio <= 0 ||
        ratio >
            1 + EPSILON
    ) {
        return null;
    }

    const offset =
        next.constant -
        ratio *
            current.constant;

    if (ratio < 1 - EPSILON) {
        return Object.freeze({
            kind: "division",
            ratio:
                normalizeNumber(
                    ratio
                ),
            factor:
                normalizeNumber(
                    1 / ratio
                ),
            offset:
                normalizeNumber(
                    offset
                )
        });
    }

    if (offset < -EPSILON) {
        return Object.freeze({
            kind: "decrement",
            amount:
                normalizeNumber(
                    -offset
                )
        });
    }

    return null;
}

export function affineMatchesMeasure(
    expression,
    measure
) {
    const affine =
        affineFromCostExpression(
            expression
        );

    if (
        affine == null ||
        measure == null
    ) {
        return false;
    }

    const relation =
        proportionalRelation(
            measure.affine,
            affine
        );

    return (
        relation != null &&
        relation.scale > 0
    );
}

function proportionalRelation(
    current,
    candidate
) {
    const names =
        new Set([
            ...Object.keys(
                current.coefficients
            ),
            ...Object.keys(
                candidate.coefficients
            )
        ]);
    let scale = null;

    for (const name of names) {
        const currentValue =
            current.coefficients[
                name
            ] ?? 0;
        const candidateValue =
            candidate.coefficients[
                name
            ] ?? 0;

        if (nearZero(currentValue)) {
            if (!nearZero(candidateValue)) {
                return null;
            }

            continue;
        }

        const nextScale =
            candidateValue /
            currentValue;

        if (
            scale != null &&
            !approximatelyEqual(
                scale,
                nextScale
            )
        ) {
            return null;
        }

        scale = nextScale;
    }

    return scale == null
        ? null
        : {
            scale,
            offset:
                candidate.constant -
                scale *
                    current.constant
        };
}

function combineAffines(
    expressions,
    combine
) {
    let result =
        createAffine();

    for (const expression of expressions) {
        const affine =
            affineFromCostExpression(
                expression
            );

        if (affine == null) {
            return null;
        }

        result =
            combine(
                result,
                affine
            );
    }

    return result;
}

function affineProduct(factors) {
    let constant = 1;
    let nonConstant = null;

    for (const factor of factors) {
        const affine =
            affineFromCostExpression(
                factor
            );

        if (affine == null) {
            return null;
        }

        if (
            Object.keys(
                affine.coefficients
            ).length === 0
        ) {
            constant *=
                affine.constant;
            continue;
        }

        if (nonConstant != null) {
            return null;
        }

        nonConstant = affine;
    }

    return nonConstant == null
        ? createAffine(constant)
        : scaleAffine(
            nonConstant,
            constant
        );
}

function affineQuotient(expression) {
    const numerator =
        affineFromCostExpression(
            expression.numerator
        );
    const denominator =
        affineFromCostExpression(
            expression.denominator
        );

    if (
        numerator == null ||
        denominator == null ||
        Object.keys(
            denominator.coefficients
        ).length > 0 ||
        nearZero(
            denominator.constant
        )
    ) {
        return null;
    }

    return scaleAffine(
        numerator,
        1 / denominator.constant
    );
}

function normalizeCoefficients(
    coefficients
) {
    return Object.fromEntries(
        Object.entries(
            coefficients
        ).filter(
            ([, value]) =>
                !nearZero(value)
        ).map(
            ([name, value]) => [
                name,
                normalizeNumber(value)
            ]
        ).sort(
            ([left], [right]) =>
                left.localeCompare(right)
        )
    );
}

function normalizeNumber(value) {
    if (nearZero(value)) {
        return 0;
    }

    const rounded =
        Math.round(value);

    return approximatelyEqual(
        value,
        rounded
    )
        ? rounded
        : Number(
            value.toPrecision(12)
        );
}

function nearZero(value) {
    return Math.abs(value) <
        EPSILON;
}

function approximatelyEqual(
    left,
    right
) {
    return Math.abs(
        left - right
    ) < EPSILON;
}
