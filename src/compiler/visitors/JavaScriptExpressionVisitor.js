import { NodeTypes } from "../../ast/core/NodeTypes.js";
import { ASTVisitor } from "../../ast/visitors/ASTVisitor.js";
import { TranspilerError } from "../../errors/TranspilerError.js";

const OPERATOR_MAP = Object.freeze({
    "=": "===",
    "^": "**"
});

/**
 * Emite fragmentos JavaScript para expresiones del AST.
 */
export class JavaScriptExpressionVisitor extends ASTVisitor {

    constructor() {
        super();

        this.registerHandlers({
            [NodeTypes.LOGICAL_NOT]:
                this.emitUnary,
            [NodeTypes.UNARY]:
                this.emitUnary,
            [NodeTypes.GROUP_EXPRESSION]:
                this.emitGroup,
            [NodeTypes.BINARY_EXPRESSION]:
                this.emitBinary,
            [NodeTypes.LOGICAL_EXPRESSION]:
                this.emitBinary,
            [NodeTypes.IDENTIFIER]:
                this.emitIdentifier,
            [NodeTypes.FUNCTION_CALL]:
                this.emitFunctionCall,
            [NodeTypes.NUMBER_LITERAL]:
                this.emitLiteral,
            [NodeTypes.SCIENTIFIC_LITERAL]:
                this.emitLiteral,
            [NodeTypes.STRING_LITERAL]:
                this.emitLiteral,
            [NodeTypes.BOOLEAN_LITERAL]:
                this.emitLiteral,
            [NodeTypes.ACCESS]:
                this.emitAccess
        });
    }

    emitUnary(expression) {
        const operator =
            expression.operator === "Not"
                ? "!"
                : expression.operator;

        return (
            operator +
            this.visit(expression.operand)
        );
    }

    emitGroup(expression) {
        return (
            "(" +
            this.visit(expression.expression) +
            ")"
        );
    }

    emitBinary(expression) {
        const operator =
            this.getOperator(expression.operator);

        return (
            this.visit(expression.left) +
            " " +
            operator +
            " " +
            this.visit(expression.right)
        );
    }

    emitIdentifier(expression) {
        return expression.name;
    }

    emitFunctionCall(expression) {
        if (!expression.identifier) {
            throw new TranspilerError(
                "The function call does not have an identifier",
                expression.location
            );
        }

        const args =
            this.visitMany(expression.arguments ?? [])
                .join(", ");

        return (
            "await " +
            expression.identifier.name +
            "(" +
            args +
            ")"
        );
    }

    emitLiteral(literal) {
        return this.getLiteral(literal);
    }

    emitAccess(expression) {
        if (!expression.identifier) {
            throw new TranspilerError(
                "Array access does not have an identifier",
                expression.location
            );
        }

        let result =
            expression.identifier.name;

        for (const index of expression.indexes ?? []) {
            result += `[${this.visit(index)}]`;
        }

        return result;
    }

    getOperator(operator) {
        return OPERATOR_MAP[operator] ?? operator;
    }

    getLiteral(literal) {
        switch (literal.type) {
            case NodeTypes.STRING_LITERAL:
                return JSON.stringify(literal.value);

            case NodeTypes.BOOLEAN_LITERAL:
                return (
                    literal.value === true ||
                    literal.value === "TRUE"
                )
                    ? "true"
                    : "false";

            default:
                return String(literal.value);
        }
    }

    getReferenceName(expression) {
        switch (expression?.type) {
            case NodeTypes.IDENTIFIER:
                return expression.name;

            case NodeTypes.ACCESS:
                return expression.identifier.name;

            default:
                throw new TranspilerError(
                    "Invalid assignment/read target.",
                    expression?.location ?? null
                );
        }
    }
}
