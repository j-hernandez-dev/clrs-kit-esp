import {
    CostExpressionKind
} from "../algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    simplifyCostExpression
} from "../algebra/CostExpressionSimplifier.js";
import {
    getRecurrenceCallMetadata
} from "./RecurrenceCallMetadata.js";

const MAX_BRANCHES = 64;
const ZERO = Cost.constant(0);
const ONE = Cost.constant(1);

export class RecurrenceExtractor {

    extract(
        expression,
        functionName
    ) {
        const source =
            (
                expression.kind ===
                    CostExpressionKind.EQUATION ||
                expression.kind ===
                    CostExpressionKind.RECURRENCE
            )
                ? expression.right
                : expression;
        const forms =
            this.extractForms(
                source,
                functionName
            );

        if (
            forms.length >
            MAX_BRANCHES
        ) {
            return [
                unsupportedForm(
                    "CLRS_RECURRENCE_BRANCH_LIMIT",
                    "La recurrencia produce demasiadas combinaciones de ramas para analizarlas con seguridad."
                )
            ];
        }

        return forms.map(
            normalizeForm
        );
    }

    extractForms(
        expression,
        functionName
    ) {
        switch (expression.kind) {
            case CostExpressionKind.EQUATION:
            case CostExpressionKind.RECURRENCE:
                return this.extractForms(
                    expression.right,
                    functionName
                );
            case CostExpressionKind.SUM:
                return this.combineMany(
                    expression.terms,
                    functionName,
                    addForms
                );
            case CostExpressionKind.DIFFERENCE:
                return combineAlternatives(
                    this.extractForms(
                        expression.left,
                        functionName
                    ),
                    this.extractForms(
                        expression.right,
                        functionName
                    ),
                    subtractForms
                );
            case CostExpressionKind.PRODUCT:
                return this.combineMany(
                    expression.factors,
                    functionName,
                    multiplyForms,
                    constantForm(ONE)
                );
            case CostExpressionKind.QUOTIENT:
                return combineAlternatives(
                    this.extractForms(
                        expression.numerator,
                        functionName
                    ),
                    this.extractForms(
                        expression.denominator,
                        functionName
                    ),
                    divideForms
                );
            case CostExpressionKind.GROUP:
                return this.extractForms(
                    expression.expression,
                    functionName
                );
            case CostExpressionKind.MAXIMUM:
                return expression.expressions
                    .flatMap(item =>
                        this.extractForms(
                            item,
                            functionName
                        )
                    );
            case CostExpressionKind.CALL:
                return [
                    this.extractCall(
                        expression,
                        functionName
                    )
                ];
            default:
                return [
                    constantForm(
                        expression
                    )
                ];
        }
    }

    extractCall(
        expression,
        functionName
    ) {
        if (
            expression.name !==
            functionName
        ) {
            return constantForm(
                expression
            );
        }

        const metadata =
            getRecurrenceCallMetadata(
                expression
            );

        if (
            metadata?.relation == null
        ) {
            return unsupportedForm(
                "CLRS_RECURRENCE_ARGUMENT_UNSUPPORTED",
                `No se pudo demostrar que el argumento de ${functionName} disminuya en cada llamada.`
            );
        }

        return createForm({
            toll: ZERO,
            terms: [
                Object.freeze({
                    coefficient: ONE,
                    relation:
                        metadata.relation,
                    call: expression
                })
            ]
        });
    }

    combineMany(
        expressions,
        functionName,
        combine,
        initial = constantForm(ZERO)
    ) {
        let forms = [
            initial
        ];

        for (const expression of expressions) {
            forms =
                combineAlternatives(
                    forms,
                    this.extractForms(
                        expression,
                        functionName
                    ),
                    combine
                );

            if (
                forms.length >
                MAX_BRANCHES
            ) {
                return [
                    unsupportedForm(
                        "CLRS_RECURRENCE_BRANCH_LIMIT",
                        "La recurrencia produce demasiadas combinaciones de ramas para analizarlas con seguridad."
                    )
                ];
            }
        }

        return forms;
    }
}

function constantForm(expression) {
    return createForm({
        toll: expression,
        terms: []
    });
}

function unsupportedForm(
    code,
    message
) {
    return createForm({
        toll: ZERO,
        terms: [],
        recursive: true,
        code,
        message
    });
}

function createForm({
    toll,
    terms,
    recursive = terms.length > 0,
    code = null,
    message = null
}) {
    return {
        toll,
        terms,
        recursive,
        code,
        message
    };
}

function addForms(left, right) {
    const error =
        firstError(left, right);

    if (error != null) {
        return error;
    }

    return createForm({
        toll:
            Cost.sum([
                left.toll,
                right.toll
            ]),
        terms: [
            ...left.terms,
            ...right.terms
        ],
        recursive:
            left.recursive ||
            right.recursive
    });
}

function subtractForms(left, right) {
    const error =
        firstError(left, right);

    if (error != null) {
        return error;
    }

    if (right.recursive) {
        return unsupportedForm(
            "CLRS_RECURRENCE_NON_MONOTONE",
            "No se admiten llamadas recursivas sustraídas dentro de una ecuación de costo."
        );
    }

    return createForm({
        toll:
            Cost.difference(
                left.toll,
                right.toll
            ),
        terms: left.terms,
        recursive: left.recursive
    });
}

function multiplyForms(left, right) {
    const error =
        firstError(left, right);

    if (error != null) {
        return error;
    }

    if (
        left.recursive &&
        right.recursive
    ) {
        return unsupportedForm(
            "CLRS_RECURRENCE_NON_LINEAR",
            "La ecuación multiplica dos expresiones que contienen llamadas recursivas."
        );
    }

    if (left.recursive) {
        return scaleForm(
            left,
            right.toll
        );
    }

    if (right.recursive) {
        return scaleForm(
            right,
            left.toll
        );
    }

    return constantForm(
        Cost.product([
            left.toll,
            right.toll
        ])
    );
}

function divideForms(
    numerator,
    denominator
) {
    const error =
        firstError(
            numerator,
            denominator
        );

    if (error != null) {
        return error;
    }

    if (denominator.recursive) {
        return unsupportedForm(
            "CLRS_RECURRENCE_NON_LINEAR",
            "No se admiten llamadas recursivas en el denominador de una ecuación de costo."
        );
    }

    return createForm({
        toll:
            Cost.quotient(
                numerator.toll,
                denominator.toll
            ),
        terms:
            numerator.terms.map(
                term =>
                    Object.freeze({
                        ...term,
                        coefficient:
                            Cost.quotient(
                                term.coefficient,
                                denominator.toll
                            )
                    })
            ),
        recursive:
            numerator.recursive
    });
}

function scaleForm(form, scale) {
    return createForm({
        toll:
            Cost.product([
                form.toll,
                scale
            ]),
        terms:
            form.terms.map(
                term =>
                    Object.freeze({
                        ...term,
                        coefficient:
                            Cost.product([
                                term.coefficient,
                                scale
                            ])
                    })
            ),
        recursive: form.recursive
    });
}

function combineAlternatives(
    left,
    right,
    combine
) {
    return left.flatMap(
        leftForm =>
            right.map(
                rightForm =>
                    combine(
                        leftForm,
                        rightForm
                    )
            )
    );
}

function firstError(left, right) {
    if (left.code != null) {
        return left;
    }

    if (right.code != null) {
        return right;
    }

    return null;
}

function normalizeForm(form) {
    const terms =
        form.terms.map(term =>
            Object.freeze({
                ...term,
                coefficient:
                    simplifyCostExpression(
                        term.coefficient
                    )
            })
        );

    return Object.freeze({
        toll:
            simplifyCostExpression(
                form.toll
            ),
        terms:
            Object.freeze(terms),
        recursive:
            form.recursive,
        code:
            form.code,
        message:
            form.message
    });
}
