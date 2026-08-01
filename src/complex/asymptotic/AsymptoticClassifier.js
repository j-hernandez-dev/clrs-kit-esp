import {
    CostExpressionKind,
    costExpressionKey,
    requireCostExpression
} from "../algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    formatCostExpression
} from "../algebra/CostExpressionFormatter.js";
import {
    simplifyCostExpression
} from "../algebra/CostExpressionSimplifier.js";
import {
    createSpecialFactor
} from "./GrowthTerm.js";
import {
    constantOrder,
    createUnknownOrder,
    divideOrders,
    logarithmOfOrder,
    multiplyOrders,
    powerOrder,
    specialOrder,
    sumOrders,
    variableOrder
} from "./AsymptoticOrder.js";
import {
    StandardLibrarySymbolicEffect,
    getStandardLibraryDefinition
} from "../../standard-library/StandardLibraryCatalog.js";

const INTERNAL_ORDER_PRESERVING_CALLS =
    new Set([
        "ceil",
        "floor"
    ]);

export class AsymptoticClassifier {

    constructor(options = {}) {
        this.constantSymbols =
            new Set(
                options.constantSymbols ??
                ["c"]
            );
    }

    classify(expression, context = {}) {
        requireCostExpression(
            expression
        );

        return this.classifyExpression(
            simplifyCostExpression(
                expression
            ),
            {
                ...context,
                resolvingSymbols:
                    context.resolvingSymbols ??
                    new Set()
            }
        );
    }

    classifyExpression(
        expression,
        context
    ) {
        const resolved =
            context.resolveExpression?.(
                expression
            ) ?? null;

        if (resolved != null) {
            return resolved;
        }

        switch (expression.kind) {
            case CostExpressionKind.CONSTANT:
                return constantOrder();
            case CostExpressionKind.SYMBOL:
                return this.classifySymbol(
                    expression,
                    context
                );
            case CostExpressionKind.SUM:
                return sumOrders(
                    expression.terms.map(
                        term =>
                            this.classifyExpression(
                                term,
                                context
                            )
                    )
                );
            case CostExpressionKind.DIFFERENCE:
                return sumOrders([
                    this.classifyExpression(
                        expression.left,
                        context
                    ),
                    this.classifyExpression(
                        expression.right,
                        context
                    )
                ]);
            case CostExpressionKind.PRODUCT:
                return multiplyOrders(
                    expression.factors.map(
                        factor =>
                            this.classifyExpression(
                                factor,
                                context
                            )
                    )
                );
            case CostExpressionKind.QUOTIENT:
                return divideOrders(
                    this.classifyExpression(
                        expression.numerator,
                        context
                    ),
                    this.classifyExpression(
                        expression.denominator,
                        context
                    )
                );
            case CostExpressionKind.GROUP:
                return this.classifyExpression(
                    expression.expression,
                    context
                );
            case CostExpressionKind.POWER:
                return this.classifyPower(
                    expression,
                    context
                );
            case CostExpressionKind.LOGARITHM:
                return logarithmOfOrder(
                    this.classifyExpression(
                        expression.argument,
                        context
                    )
                );
            case CostExpressionKind.FACTORIAL:
                return this.classifyFactorial(
                    expression,
                    context
                );
            case CostExpressionKind.CALL:
                return this.classifyCall(
                    expression,
                    context
                );
            case CostExpressionKind.MAXIMUM:
                return sumOrders(
                    expression.expressions
                        .map(item =>
                            this.classifyExpression(
                                item,
                                context
                            )
                        )
                );
            case CostExpressionKind.EQUATION:
                return this.classifyExpression(
                    expression.right,
                    context
                );
            case CostExpressionKind.RECURRENCE:
                return createUnknownOrder(
                    "CLRS_ASYMPTOTIC_RECURRENCE_UNRESOLVED",
                    "La expresión contiene una recurrencia que todavía no ha sido resuelta."
                );
            case CostExpressionKind.UNKNOWN:
                return createUnknownOrder(
                    "CLRS_ASYMPTOTIC_UNKNOWN_COST",
                    "La expresión de costo contiene una cantidad desconocida."
                );
            case CostExpressionKind.RAW:
            default:
                return createUnknownOrder(
                    "CLRS_ASYMPTOTIC_EXPRESSION_UNSUPPORTED",
                    "La expresión de costo no tiene una representación asintótica estructurada."
                );
        }
    }

    classifySymbol(expression, context) {
        if (
            this.constantSymbols.has(
                expression.name
            )
        ) {
            return constantOrder();
        }

        const replacement =
            context.resolveSymbol?.(
                expression.name
            ) ?? null;

        if (
            replacement != null &&
            !context.resolvingSymbols
                .has(expression.name)
        ) {
            const resolvingSymbols =
                new Set(
                    context.resolvingSymbols
                );

            resolvingSymbols.add(
                expression.name
            );

            return this.classifyExpression(
                simplifyCostExpression(
                    replacement
                ),
                {
                    ...context,
                    resolvingSymbols
                }
            );
        }

        return variableOrder(
            expression.name
        );
    }

    classifyPower(expression, context) {
        const exponent =
            simplifyCostExpression(
                expression.exponent
            );

        if (
            exponent.kind ===
            CostExpressionKind.CONSTANT
        ) {
            return powerOrder(
                this.classifyExpression(
                    expression.base,
                    context
                ),
                exponent.value
            );
        }

        const base =
            simplifyCostExpression(
                expression.base
            );
        const exponentOrder =
            this.classifyExpression(
                exponent,
                context
            );

        if (
            base.kind ===
                CostExpressionKind.CONSTANT &&
            base.value > 1
        ) {
            return specialOrder(
                createSpecialFactor({
                    key:
                        "exponential:" +
                        base.value +
                        ":" +
                        costExpressionKey(
                            exponent
                        ),
                    label:
                        formatCostExpression(
                            Cost.power(
                                base,
                                exponent
                            )
                        ),
                    rank: 2,
                    type: "exponential",
                    base: base.value,
                    exponentKey:
                        costExpressionKey(
                            exponent
                        ),
                    logOrder:
                        exponentOrder,
                    comparable:
                        isLinearOrder(
                            exponentOrder
                        )
                })
            );
        }

        if (
            base.kind ===
                CostExpressionKind.CONSTANT &&
            (
                base.value === 0 ||
                base.value === 1
            )
        ) {
            return constantOrder();
        }

        const comparable =
            base.kind ===
                CostExpressionKind.SYMBOL &&
            exponent.kind ===
                CostExpressionKind.SYMBOL &&
            base.name ===
                exponent.name;

        return specialOrder(
            createSpecialFactor({
                key:
                    "generic-power:" +
                    costExpressionKey(
                        expression
                    ),
                label:
                    formatCostExpression(
                        expression
                ),
                rank: 4,
                type: "generic-power",
                comparable
            })
        );
    }

    classifyFactorial(
        expression,
        context
    ) {
        const argument =
            simplifyCostExpression(
                expression.argument
            );

        if (
            argument.kind ===
            CostExpressionKind.CONSTANT
        ) {
            return constantOrder();
        }

        if (
            argument.kind ===
            CostExpressionKind.SYMBOL
        ) {
            const replacement =
                context.resolveSymbol?.(
                    argument.name
                ) ?? null;

            if (
                replacement != null &&
                !context.resolvingSymbols
                    .has(argument.name)
            ) {
                return this.classifyFactorial(
                    Cost.factorial(
                        replacement
                    ),
                    {
                        ...context,
                        resolvingSymbols:
                            new Set([
                                ...context
                                    .resolvingSymbols,
                                argument.name
                            ])
                    }
                );
            }

            return specialOrder(
                createSpecialFactor({
                    key:
                        "factorial:" +
                        argument.name,
                    label:
                        argument.name +
                        "!",
                    rank: 3,
                    type: "factorial",
                    variable:
                        argument.name,
                    comparable: true
                })
            );
        }

        return specialOrder(
            createSpecialFactor({
                key:
                    "factorial:" +
                    costExpressionKey(
                        argument
                    ),
                label:
                    formatCostExpression(
                        Cost.factorial(
                            argument
                        )
                    ),
                rank: 3,
                type: "factorial",
                comparable: false
            })
        );
    }

    classifyCall(expression, context) {
        if (
            INTERNAL_ORDER_PRESERVING_CALLS
                .has(expression.name) &&
            expression.args.length === 1
        ) {
            return this.classifyExpression(
                expression.args[0],
                context
            );
        }

        if (
            expression.name === "max" &&
            expression.args.length > 0
        ) {
            return sumOrders(
                expression.args.map(
                    argument =>
                        this.classifyExpression(
                            argument,
                            context
                        )
                )
            );
        }

        const standardDefinition =
            getStandardLibraryDefinition(
                expression.name
            );

        if (standardDefinition != null) {
            const standardOrder =
                this.classifyStandardCall(
                    expression,
                    standardDefinition,
                    context
                );

            if (standardOrder != null) {
                return standardOrder;
            }
        }

        if (
            expression.name.startsWith("T")
        ) {
            return (
                context.resolveCall?.(
                    expression.name
                ) ??
                createUnknownOrder(
                    "CLRS_ASYMPTOTIC_CALL_UNRESOLVED",
                    `No se encontró una función de costo para ${expression.name}.`
                )
            );
        }

        return createUnknownOrder(
            "CLRS_ASYMPTOTIC_CALL_UNSUPPORTED",
            `No se puede determinar el crecimiento del valor devuelto por ${expression.name}.`
        );
    }

    classifyStandardCall(
        expression,
        definition,
        context
    ) {
        const effect =
            definition.symbolicEffect;
        const argument =
            expression.args[
                effect.argument ?? 0
            ];

        switch (effect.kind) {
            case StandardLibrarySymbolicEffect
                .CONSTANT:
            case StandardLibrarySymbolicEffect
                .BOUNDED:
                return constantOrder();
            case StandardLibrarySymbolicEffect
                .ROUNDING:
            case StandardLibrarySymbolicEffect
                .ABSOLUTE:
            case StandardLibrarySymbolicEffect
                .LINEAR:
                return argument == null
                    ? null
                    : this.classifyExpression(
                        argument,
                        context
                    );
            case StandardLibrarySymbolicEffect
                .SIZE:
                return (
                    context.resolveSize?.(
                        expression
                    ) ??
                    variableOrder(
                        formatCostExpression(
                            expression
                        )
                    )
                );
            case StandardLibrarySymbolicEffect
                .LOGARITHMIC:
                return argument == null
                    ? null
                    : logarithmOfOrder(
                        this.classifyExpression(
                            argument,
                            context
                        )
                    );
            case StandardLibrarySymbolicEffect
                .ROOT:
                return argument == null
                    ? null
                    : powerOrder(
                        this.classifyExpression(
                            argument,
                            context
                        ),
                        effect.exponent
                    );
            case StandardLibrarySymbolicEffect
                .EXPONENTIAL:
                return argument == null
                    ? null
                    : this.classifyPower(
                        Cost.power(
                            Cost.constant(
                                effect.base
                            ),
                            argument
                        ),
                        context
                    );
            case StandardLibrarySymbolicEffect
                .EXTREMUM:
                return (
                    effect.operation ===
                        "maximum" &&
                    expression.args.length > 0
                )
                    ? sumOrders(
                        expression.args.map(
                            item =>
                                this.classifyExpression(
                                    item,
                                    context
                                )
                        )
                    )
                    : null;
            case StandardLibrarySymbolicEffect
                .OPAQUE:
            default:
                return null;
        }
    }
}

function isLinearOrder(order) {
    if (
        !order.known ||
        order.terms.length !== 1
    ) {
        return false;
    }

    const [term] =
        order.terms;
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
    );
}
