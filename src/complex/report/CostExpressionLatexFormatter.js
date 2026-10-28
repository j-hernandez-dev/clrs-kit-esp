import {
    CostExpressionKind,
    requireCostExpression
} from "../algebra/CostExpression.js";

/**
 * Presenta el álgebra de costos sin introducir reglas de simplificación.
 * El resultado está pensado para KaTeX y conserva la estructura que produjo
 * el analizador.
 */
export class CostExpressionLatexFormatter {

    format(expression) {
        requireCostExpression(expression);

        switch (expression.kind) {
            case CostExpressionKind.CONSTANT:
                return String(expression.value);
            case CostExpressionKind.SYMBOL:
                return identifier(expression.name);
            case CostExpressionKind.SUM:
                return expression.terms.length === 0
                    ? "0"
                    : expression.terms
                        .map(term => this.format(term))
                        .join(" + ");
            case CostExpressionKind.SUMMATION:
                return `\\sum_{${identifier(expression.index)}=${this.format(expression.lower)}}^{${this.format(expression.upper)}} ${this.productFactor(expression.term)}`;
            case CostExpressionKind.DIFFERENCE:
                return `${this.operand(expression.left)} - ${this.operand(expression.right)}`;
            case CostExpressionKind.PRODUCT:
                return expression.factors.length === 0
                    ? "1"
                    : expression.factors
                        .map(factor =>
                            this.productFactor(factor)
                        )
                        .join(" \\cdot ");
            case CostExpressionKind.QUOTIENT:
                return `\\frac{${this.format(expression.numerator)}}{${this.format(expression.denominator)}}`;
            case CostExpressionKind.GROUP:
                return `\\left(${this.format(expression.expression)}\\right)`;
            case CostExpressionKind.POWER:
                return `{${this.powerOperand(expression.base)}}^{${this.format(expression.exponent)}}`;
            case CostExpressionKind.LOGARITHM:
                return expression.base == null
                    ? `\\log\\left(${this.format(expression.argument)}\\right)`
                    : `\\log_{${this.format(expression.base)}}\\left(${this.format(expression.argument)}\\right)`;
            case CostExpressionKind.FACTORIAL:
                return `${this.powerOperand(expression.argument)}!`;
            case CostExpressionKind.CALL:
                return `${identifier(expression.name)}\\left(${expression.args
                    .map(argument => this.format(argument))
                    .join(", ")}\\right)`;
            case CostExpressionKind.MAXIMUM:
            case CostExpressionKind.MINIMUM: {
                const operation =
                    expression.kind === CostExpressionKind.MAXIMUM
                        ? "max"
                        : "min";

                return `\\${operation}\\left(${expression.expressions
                    .map(item => this.format(item))
                    .join(", ")}\\right)`;
            }
            case CostExpressionKind.EQUATION:
            case CostExpressionKind.RECURRENCE:
                return `${this.format(expression.left)} = ${this.format(expression.right)}`;
            case CostExpressionKind.UNKNOWN:
                return "\\text{?}";
            case CostExpressionKind.RAW:
                return `\\text{${escapeText(expression.value)}}`;
            default:
                return "\\text{?}";
        }
    }

    operand(expression) {
        return (
            expression.kind === CostExpressionKind.SUM ||
            expression.kind === CostExpressionKind.SUMMATION ||
            expression.kind === CostExpressionKind.DIFFERENCE ||
            expression.kind === CostExpressionKind.EQUATION ||
            expression.kind === CostExpressionKind.RECURRENCE
        )
            ? `\\left(${this.format(expression)}\\right)`
            : this.format(expression);
    }

    productFactor(expression) {
        return (
            expression.kind === CostExpressionKind.SUM ||
            expression.kind === CostExpressionKind.SUMMATION ||
            expression.kind === CostExpressionKind.DIFFERENCE ||
            expression.kind === CostExpressionKind.EQUATION ||
            expression.kind === CostExpressionKind.RECURRENCE
        )
            ? `\\left(${this.format(expression)}\\right)`
            : this.format(expression);
    }

    powerOperand(expression) {
        return (
            expression.kind === CostExpressionKind.CONSTANT ||
            expression.kind === CostExpressionKind.SYMBOL ||
            expression.kind === CostExpressionKind.CALL
        )
            ? this.format(expression)
            : `\\left(${this.format(expression)}\\right)`;
    }
}

export const costExpressionLatexFormatter =
    new CostExpressionLatexFormatter();

export function formatCostExpressionLatex(
    expression
) {
    return costExpressionLatexFormatter
        .format(expression);
}

function identifier(value) {
    const text = String(value);

    if (/^[A-Za-z][A-Za-z0-9]*$/.test(text)) {
        return text;
    }

    return `\\mathrm{${escapeText(text)}}`;
}

function escapeText(value) {
    const replacements = {
        "\\": "\\textbackslash{}",
        "{": "\\{",
        "}": "\\}",
        "_": "\\_",
        "%": "\\%",
        "#": "\\#",
        "&": "\\&"
    };

    return [...String(value)]
        .map(character =>
            replacements[character] ??
            character
        )
        .join("");
}
