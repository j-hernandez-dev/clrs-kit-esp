import {
    CostExpressionKind,
    requireCostExpression
} from "./CostExpression.js";

export class CostExpressionFormatter {

    format(expression) {
        requireCostExpression(expression);

        switch (expression.kind) {
            case CostExpressionKind.CONSTANT:
                return String(
                    expression.value
                );
            case CostExpressionKind.SYMBOL:
                return expression.name;
            case CostExpressionKind.SUM:
                return this.formatSum(
                    expression.terms
                );
            case CostExpressionKind.DIFFERENCE:
                return (
                    this.formatDifferenceOperand(
                        expression.left,
                        false
                    ) +
                    " - " +
                    this.formatDifferenceOperand(
                        expression.right,
                        true
                    )
                );
            case CostExpressionKind.PRODUCT:
                return this.formatProduct(
                    expression.factors
                );
            case CostExpressionKind.QUOTIENT:
                return (
                    this.formatQuotientOperand(
                        expression.numerator
                    ) +
                    " / " +
                    this.formatQuotientOperand(
                        expression.denominator,
                        true
                    )
                );
            case CostExpressionKind.GROUP:
                return (
                    "(" +
                    this.format(
                        expression.expression
                    ) +
                    ")"
                );
            case CostExpressionKind.POWER:
                return (
                    this.formatPowerOperand(
                        expression.base
                    ) +
                    "^" +
                    this.formatPowerOperand(
                        expression.exponent
                    )
                );
            case CostExpressionKind.LOGARITHM:
                return this.formatLogarithm(
                    expression
                );
            case CostExpressionKind.FACTORIAL:
                return (
                    this.formatPowerOperand(
                        expression.argument
                    ) +
                    "!"
                );
            case CostExpressionKind.CALL:
                return (
                    expression.name +
                    "(" +
                    expression.args
                        .map(argument =>
                            this.format(argument)
                        )
                        .join(", ") +
                    ")"
                );
            case CostExpressionKind.MAXIMUM:
                return (
                    "max(" +
                    expression.expressions
                        .map(item =>
                            this.format(item)
                        )
                        .join(", ") +
                    ")"
                );
            case CostExpressionKind.EQUATION:
            case CostExpressionKind.RECURRENCE:
                return (
                    this.format(
                        expression.left
                    ) +
                    " = " +
                    this.format(
                        expression.right
                    )
                );
            case CostExpressionKind.UNKNOWN:
                return expression.reason
                    ? `? (${expression.reason})`
                    : "?";
            case CostExpressionKind.RAW:
                return expression.value;
            default:
                return "?";
        }
    }

    formatSum(terms) {
        if (terms.length === 0) {
            return "0";
        }

        return terms
            .map(term =>
                this.format(term)
            )
            .join(" + ");
    }

    formatProduct(factors) {
        if (factors.length === 0) {
            return "1";
        }

        let result = "";

        for (
            const [index, factor]
            of factors.entries()
        ) {
            if (
                index > 0 &&
                (
                    this.requiresProductSpace(
                        factor
                    ) ||
                    this.requiresTrailingProductSpace(
                        factors[index - 1]
                    )
                )
            ) {
                result += " ";
            }

            result +=
                this.formatProductFactor(
                    factor
                );
        }

        return result;
    }

    formatDifferenceOperand(
        expression,
        right = false
    ) {
        if (
            expression.kind ===
                CostExpressionKind.EQUATION ||
            expression.kind ===
                CostExpressionKind.RECURRENCE ||
            (
                right &&
                (
                    expression.kind ===
                        CostExpressionKind.SUM ||
                    expression.kind ===
                        CostExpressionKind.DIFFERENCE
                )
            )
        ) {
            return (
                "(" +
                this.format(expression) +
                ")"
            );
        }

        return this.format(expression);
    }

    formatProductFactor(expression) {
        if (
            expression.kind ===
                CostExpressionKind.SUM ||
            expression.kind ===
                CostExpressionKind.DIFFERENCE ||
            expression.kind ===
                CostExpressionKind.QUOTIENT ||
            expression.kind ===
                CostExpressionKind.EQUATION ||
            expression.kind ===
                CostExpressionKind.RECURRENCE
        ) {
            return (
                "(" +
                this.format(expression) +
                ")"
            );
        }

        return this.format(expression);
    }

    formatQuotientOperand(
        expression,
        denominator = false
    ) {
        if (
            expression.kind ===
                CostExpressionKind.SUM ||
            expression.kind ===
                CostExpressionKind.DIFFERENCE ||
            expression.kind ===
                CostExpressionKind.EQUATION ||
            expression.kind ===
                CostExpressionKind.RECURRENCE ||
            (
                denominator &&
                (
                    expression.kind ===
                        CostExpressionKind.PRODUCT ||
                    expression.kind ===
                        CostExpressionKind.QUOTIENT
                )
            )
        ) {
            return (
                "(" +
                this.format(expression) +
                ")"
            );
        }

        return this.format(expression);
    }

    formatLogarithm(expression) {
        const argument =
            this.formatPowerOperand(
                expression.argument
            );

        if (expression.base == null) {
            return `log ${argument}`;
        }

        return (
            "log_" +
            this.formatPowerOperand(
                expression.base
            ) +
            " " +
            argument
        );
    }

    formatPowerOperand(expression) {
        if (
            expression.kind ===
                CostExpressionKind.SUM ||
            expression.kind ===
                CostExpressionKind.DIFFERENCE ||
            expression.kind ===
                CostExpressionKind.PRODUCT ||
            expression.kind ===
                CostExpressionKind.QUOTIENT ||
            expression.kind ===
                CostExpressionKind.EQUATION ||
            expression.kind ===
                CostExpressionKind.RECURRENCE
        ) {
            return (
                "(" +
                this.format(expression) +
                ")"
            );
        }

        return this.format(expression);
    }

    requiresProductSpace(factor) {
        return (
            factor.kind ===
                CostExpressionKind.LOGARITHM ||
            factor.kind ===
                CostExpressionKind.UNKNOWN
        );
    }

    requiresTrailingProductSpace(
        factor
    ) {
        return (
            factor.kind ===
            CostExpressionKind.UNKNOWN
        );
    }
}

export const costExpressionFormatter =
    new CostExpressionFormatter();

export function formatCostExpression(
    expression
) {
    return costExpressionFormatter
        .format(expression);
}
