import {
    polynomialToCostExpression,
    requirePolynomial
} from "../algebra/NormalizedPolynomial.js";
import {
    constantOrder,
    multiplyOrders,
    orderDominates,
    orderKey,
    powerOrder,
    sumOrders,
    withOrderMetadata
} from "./AsymptoticOrder.js";

export const ComplexityBoundKind =
    Object.freeze({
        TIGHT: "tight",
        UPPER: "upper",
        LOWER: "lower",
        UNKNOWN: "unknown"
    });

export const ComplexityEventualSign =
    Object.freeze({
        POSITIVE: "positive",
        NEGATIVE: "negative",
        ZERO: "zero",
        UNKNOWN: "unknown"
    });

/**
 * Interpreta una forma polinómica normal sin confundir magnitud con ajuste.
 * Los coeficientes negativos se conservan para detectar cancelaciones. Si
 * dos términos incomparables tienen signos opuestos, sólo se afirma la cota
 * superior dada por la suma de sus magnitudes.
 */
export class ComplexityDomain {

    classifyPolynomial(
        polynomial,
        classifyAtom
    ) {
        requirePolynomial(polynomial);

        if (polynomial.isZero()) {
            return createComplexityValue({
                order: withOrderMetadata(
                    constantOrder(),
                    {
                        eventualSign:
                            ComplexityEventualSign
                                .ZERO,
                        normalForm:
                            polynomialToCostExpression(
                                polynomial
                            ),
                        evidence: [
                            "La forma polinómica normal cancela exactamente todos sus términos."
                        ]
                    }
                ),
                boundKind:
                    ComplexityBoundKind.TIGHT,
                eventualSign:
                    ComplexityEventualSign.ZERO,
                polynomial
            });
        }

        const terms = polynomial.terms.map(
            term => ({
                term,
                order:
                    classifyPolynomialTerm(
                        term,
                        classifyAtom
                    )
            })
        );
        const unknown = terms.find(item =>
            !item.order.known
        );

        if (unknown != null) {
            return createComplexityValue({
                order: unknown.order,
                boundKind:
                    ComplexityBoundKind.UNKNOWN,
                eventualSign:
                    ComplexityEventualSign.UNKNOWN,
                polynomial
            });
        }

        const magnitude = sumOrders(
            terms.map(item =>
                item.order
            )
        );
        const sign = eventualPolynomialSign(
            terms
        );
        const signSupportsMagnitude =
            sign ===
                ComplexityEventualSign.POSITIVE ||
            sign ===
                ComplexityEventualSign.ZERO;
        const magnitudeBound =
            magnitude.boundKind ??
            ComplexityBoundKind.TIGHT;
        const boundKind = signSupportsMagnitude
            ? magnitudeBound
            : magnitudeBound ===
                    ComplexityBoundKind.TIGHT ||
                magnitudeBound ===
                    ComplexityBoundKind.UPPER
                ? ComplexityBoundKind.UPPER
                : ComplexityBoundKind.UNKNOWN;
        const evidence = boundKind ===
            ComplexityBoundKind.TIGHT
            ? [
                "La forma normal conserva un término dominante positivo después de aplicar todas las cancelaciones."
            ]
            : [
                "La forma normal contiene términos dominantes con signo negativo o incomparable; se conserva la suma de magnitudes como cota superior."
            ];
        const order = withOrderMetadata(
            magnitude,
            {
                boundKind,
                eventualSign: sign,
                normalForm:
                    polynomialToCostExpression(
                        polynomial
                    ),
                evidence
            }
        );

        return createComplexityValue({
            order,
            boundKind,
            eventualSign: sign,
            polynomial
        });
    }
}

export function createComplexityValue({
    order,
    boundKind = ComplexityBoundKind.TIGHT,
    eventualSign =
        ComplexityEventualSign.UNKNOWN,
    polynomial = null
}) {
    return Object.freeze({
        kind: "complexity-domain-value",
        known: Boolean(order?.known),
        order,
        boundKind,
        eventualSign,
        polynomial
    });
}

function classifyPolynomialTerm(
    term,
    classifyAtom
) {
    if (term.factors.length === 0) {
        return constantOrder();
    }

    return multiplyOrders(
        term.factors.map(factor =>
            powerOrder(
                classifyAtom(
                    factor.expression
                ),
                factor.exponent
            )
        )
    );
}

function eventualPolynomialSign(terms) {
    const groups = groupEquivalentOrders(
        maximalTerms(terms)
    );
    const signs = new Set();

    for (const group of groups.values()) {
        const coefficients = group.map(item =>
            Math.sign(
                item.term.coefficient
            )
        );
        const unique = new Set(coefficients);

        if (unique.size !== 1) {
            return ComplexityEventualSign.UNKNOWN;
        }

        signs.add(coefficients[0]);
    }

    if (signs.size !== 1) {
        return ComplexityEventualSign.UNKNOWN;
    }

    return [...signs][0] > 0
        ? ComplexityEventualSign.POSITIVE
        : ComplexityEventualSign.NEGATIVE;
}

function maximalTerms(terms) {
    return terms.filter((candidate, index) =>
        !terms.some((other, otherIndex) =>
            index !== otherIndex &&
            strictlyDominates(
                other.order,
                candidate.order
            )
        )
    );
}

function strictlyDominates(left, right) {
    return (
        orderDominates(left, right) &&
        !orderDominates(right, left)
    );
}

function groupEquivalentOrders(terms) {
    const grouped = new Map();

    for (const term of terms) {
        const key = orderKey(term.order);
        const values = grouped.get(key) ?? [];

        values.push(term);
        grouped.set(key, values);
    }

    return grouped;
}
