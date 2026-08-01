import {
    NodeTypes
} from "../../../src/ast/core/NodeTypes.js";
import {
    DiagramGenerationError
} from "../../../src/errors/DiagramGenerationError.js";
import {
    DiagramASTVisitor
} from "./DiagramASTVisitor.js";

export class DiagramExpressionVisitor
    extends DiagramASTVisitor {

    constructor() {
        super();

        this.registerHandlers({
            [NodeTypes.IDENTIFIER]:
                this.identifier,
            [NodeTypes.NUMBER_LITERAL]:
                this.literal,
            [NodeTypes.SCIENTIFIC_LITERAL]:
                this.literal,
            [NodeTypes.STRING_LITERAL]:
                this.literal,
            [NodeTypes.BOOLEAN_LITERAL]:
                this.literal,
            [NodeTypes.BINARY_EXPRESSION]:
                this.binary,
            [NodeTypes.LOGICAL_EXPRESSION]:
                this.logical,
            [NodeTypes.LOGICAL_NOT]:
                this.logicalNot,
            [NodeTypes.UNARY]:
                this.unary,
            [NodeTypes.GROUP_EXPRESSION]:
                this.group,
            [NodeTypes.FUNCTION_CALL]:
                this.functionCall,
            [NodeTypes.ACCESS]:
                this.access
        });
    }

    identifier(expression) {
        return expression.name;
    }

    literal(expression) {
        return this.getLiteral(expression);
    }

    binary(expression) {
        return (
            this.visit(expression.left) +
            " " +
            expression.operator +
            " " +
            this.visit(expression.right)
        );
    }

    logical(expression) {
        const operator =
            expression.operator === "&&"
                ? "Y"
                : "O";

        return (
            this.visit(expression.left) +
            " " +
            operator +
            " " +
            this.visit(expression.right)
        );
    }

    logicalNot(expression) {
        return (
            "No " +
            this.visit(expression.operand)
        );
    }

    unary(expression) {
        return (
            expression.operator +
            this.visit(expression.operand)
        );
    }

    group(expression) {
        return (
            "(" +
            this.visit(expression.expression) +
            ")"
        );
    }

    functionCall(expression) {
        if (!expression.identifier) {
            throw DiagramGenerationError
                .invalidStructure(
                    "The function call does not have an identifier.",
                    expression,
                    "CLRS_INVALID_DIAGRAM_FUNCTION_CALL"
                );
        }

        const args =
            (expression.arguments ?? [])
                .map(argument =>
                    this.visit(argument)
                )
                .join(", ");

        return (
            `${expression.identifier.name}(${args})`
        );
    }

    access(expression) {
        if (!expression.identifier) {
            throw DiagramGenerationError
                .invalidStructure(
                    "The access does not have an identifier.",
                    expression,
                    "CLRS_INVALID_DIAGRAM_ACCESS"
                );
        }

        let result =
            expression.identifier.name;

        for (
            const index
            of expression.indexes ?? []
        ) {
            result += `[${this.visit(index)}]`;
        }

        return result;
    }

    getLiteral(literal) {
        switch (literal.type) {
            case NodeTypes.STRING_LITERAL:
                return `"${literal.value}"`;

            case NodeTypes.BOOLEAN_LITERAL:
                return (
                    literal.value === true ||
                    literal.value === "TRUE"
                        ? "Verdadero"
                        : "Falso"
                );

            default:
                return String(literal.value);
        }
    }
}
