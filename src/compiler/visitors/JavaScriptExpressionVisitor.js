import { NodeTypes } from "../../ast/core/NodeTypes.js";
import { ASTVisitor } from "../../ast/visitors/ASTVisitor.js";
import { TranspilerError } from "../../errors/TranspilerError.js";
import {
    LANGUAGE_ESCAPE_CHARACTERS
} from "../../language/StringLiteralSemantics.js";
import {
    normalizeJavaScriptIdentifierResolver
} from "../JavaScriptIdentifierResolver.js";

const OPERATOR_MAP = Object.freeze({
    "==": "===",
    "^": "**"
});

function escapeStringLiteral(value) {
    const source = String(value);
    let result = '"';

    for (let index = 0; index < source.length;) {
        const character = source[index];

        if (character === "\\") {
            let runEnd = index;

            while (source[runEnd] === "\\") {
                runEnd += 1;
            }

            const runLength = runEnd - index;
            const escapeCharacter =
                source[runEnd];

            if (
                runLength === 1 &&
                LANGUAGE_ESCAPE_CHARACTERS
                    .has(escapeCharacter)
            ) {
                result +=
                    "\\" + escapeCharacter;
                index = runEnd + 1;
                continue;
            }

            result += "\\\\".repeat(runLength);
            index = runEnd;
            continue;
        }

        result += escapeLiteralCharacter(
            character
        );
        index += 1;
    }

    return result + '"';
}

function escapeLiteralCharacter(character) {
    switch (character) {
        case '"':
            return '\\"';
        case "\b":
            return "\\b";
        case "\f":
            return "\\f";
        case "\n":
            return "\\n";
        case "\r":
            return "\\r";
        case "\t":
            return "\\t";
        default:
            if (
                character.charCodeAt(0) < 0x20
            ) {
                return (
                    "\\u" +
                    character
                        .charCodeAt(0)
                        .toString(16)
                        .padStart(4, "0")
                );
            }

            return character;
    }
}

/**
 * Emite fragmentos JavaScript para expresiones del AST.
 */
export class JavaScriptExpressionVisitor extends ASTVisitor {

    constructor(options = {}) {
        super();

        this.awaitCalls = true;
        this.gui = null;

        this.identifierResolver =
            normalizeJavaScriptIdentifierResolver(
                options.identifierResolver
            );

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
            [NodeTypes.NULL_LITERAL]:
                this.emitLiteral,
            [NodeTypes.ARRAY_EXPRESSION]:
                this.emitArrayExpression,
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
        return this.identifierResolver
            .resolve(expression);
    }

    emitFunctionCall(expression) {
        if (!expression.identifier) {
            throw new TranspilerError(
                "The function call does not have an identifier",
                expression.location
            );
        }

        const callback = this.gui?.callbacks.get(expression);
        const args = (expression.arguments ?? []).map((argument, index) => {
            const emitted = this.visit(argument);
            return callback && index === 2
                ? `$clrs$gui$callback(${emitted}, ${callback.synchronous}, ${JSON.stringify(callback.location)})`
                : emitted;
        }).join(", ");

        return (
            (this.awaitCalls ? "await " : "") +
            this.identifierResolver.resolve(
                expression.identifier
            ) +
            "(" +
            args +
            ")"
        );
    }

    emitLiteral(literal) {
        return this.getLiteral(literal);
    }

    emitArrayExpression(expression) {
        const elements =
            this.visitMany(expression.elements ?? [])
                .join(", ");

        return `[${elements}]`;
    }

    emitAccess(expression) {
        if (!expression.identifier) {
            throw new TranspilerError(
                "Array access does not have an identifier",
                expression.location
            );
        }

        let result =
            this.identifierResolver.resolve(
                expression.identifier
            );

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
                return escapeStringLiteral(literal.value);

            case NodeTypes.BOOLEAN_LITERAL:
                return (
                    literal.value === true ||
                    literal.value === "TRUE"
                )
                    ? "true"
                    : "false";

            case NodeTypes.NULL_LITERAL:
                return "null";

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

    setIdentifierResolver(resolver) {
        const previous =
            this.identifierResolver;

        this.identifierResolver =
            normalizeJavaScriptIdentifierResolver(
                resolver
            );

        return previous;
    }
}
