import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    ASTVisitor
} from "../../ast/visitors/ASTVisitor.js";
import {
    SemanticError
} from "../../errors/SemanticError.js";
import {
    SemanticSymbolKind
} from "../SemanticSymbol.js";

/**
 * Primera pasada: recolecta todos los bindings antes de resolver lecturas.
 * Esto reproduce el hoisting de `var` y de las declaraciones de función.
 */
export class SemanticBindingCollector extends ASTVisitor {

    constructor(context) {
        super();

        this.context = context;

        this.registerHandlers({
            [NodeTypes.PROGRAM]:
                this.visitProgram,
            [NodeTypes.BLOCK]:
                this.visitBlock,
            [NodeTypes.ASSIGNMENT]:
                this.visitAssignment,
            [NodeTypes.IF_STATEMENT]:
                this.visitIf,
            [NodeTypes.WHILE_STATEMENT]:
                this.visitWhile,
            [NodeTypes.FOR_STATEMENT]:
                this.visitFor,
            [NodeTypes.RETURN_STATEMENT]:
                this.visitReturn,
            [NodeTypes.READ_STATEMENT]:
                this.visitRead,
            [NodeTypes.WRITE_STATEMENT]:
                this.visitWrite,
            [NodeTypes.FUNCTION_DECLARATION]:
                this.visitFunctionDeclaration,
            [NodeTypes.PARAMETER]:
                this.visitParameter,
            [NodeTypes.ARRAY_DECLARATION]:
                this.visitArrayDeclaration,
            [NodeTypes.DECLARATION_ITEM]:
                this.visitDeclarationItem,
            [NodeTypes.FUNCTION_CALL]:
                this.visitFunctionCall,
            [NodeTypes.ACCESS]:
                this.visitAccess,
            [NodeTypes.BINARY_EXPRESSION]:
                this.visitBinary,
            [NodeTypes.LOGICAL_EXPRESSION]:
                this.visitBinary,
            [NodeTypes.LOGICAL_NOT]:
                this.visitUnary,
            [NodeTypes.UNARY]:
                this.visitUnary,
            [NodeTypes.GROUP_EXPRESSION]:
                this.visitGroup,
            [NodeTypes.IDENTIFIER]:
                this.visitLeaf,
            [NodeTypes.NUMBER_LITERAL]:
                this.visitLeaf,
            [NodeTypes.SCIENTIFIC_LITERAL]:
                this.visitLeaf,
            [NodeTypes.STRING_LITERAL]:
                this.visitLeaf,
            [NodeTypes.BOOLEAN_LITERAL]:
                this.visitLeaf
        });
    }

    collect(ast) {
        this.visit(ast);

        return this.context;
    }

    mark(node) {
        this.context.recordScope(node);

        return node;
    }

    visitProgram(node) {
        this.mark(node);
        this.visitMany(node.statements ?? []);
    }

    visitBlock(node) {
        this.mark(node);
        this.visitMany(node.statements ?? []);
    }

    visitAssignment(node) {
        this.mark(node);
        this.collectAssignmentTarget(node.left);
        this.visit(node.right);
    }

    collectAssignmentTarget(target) {
        this.mark(target);

        const identifier =
            target.type === NodeTypes.ACCESS
                ? target.identifier
                : target;
        const symbol = this.context.define(
            identifier.name,
            SemanticSymbolKind.VARIABLE,
            identifier
        );

        this.mark(identifier);
        this.context.bind(identifier, symbol);
        this.context.bind(target, symbol);

        if (target.type === NodeTypes.ACCESS) {
            this.visitMany(target.indexes ?? []);
        }
    }

    visitIf(node) {
        this.mark(node);
        this.visit(node.condition);
        this.visit(node.thenBlock);

        for (
            const branch
            of node.elseIfBranches ?? []
        ) {
            this.visit(branch.condition);
            this.visit(branch.block);
        }

        if (node.elseBlock != null) {
            this.visit(node.elseBlock);
        }
    }

    visitWhile(node) {
        this.mark(node);
        this.visit(node.condition);
        this.visit(node.body);
    }

    visitFor(node) {
        this.mark(node);
        this.visit(node.initializer);
        this.visit(node.condition);
        this.visit(node.increment);
        this.visit(node.body);
    }

    visitReturn(node) {
        this.mark(node);

        if (node.expression != null) {
            this.visit(node.expression);
        }
    }

    visitRead(node) {
        this.mark(node);
        this.visitMany(node.identifiers ?? []);
    }

    visitWrite(node) {
        this.mark(node);
        this.visitMany(node.expressions ?? []);
    }

    visitFunctionDeclaration(node) {
        this.mark(node);
        this.mark(node.identifier);

        const functionSymbol =
            this.context.define(
                node.identifier.name,
                SemanticSymbolKind.FUNCTION,
                node.identifier
            );

        this.context.bind(
            node.identifier,
            functionSymbol
        );
        this.context.bind(
            node,
            functionSymbol
        );

        const functionScope =
            this.context.createFunctionScope(
                node
            );

        this.context.withScope(
            functionScope,
            () => {
                const parameterNames =
                    new Set();

                for (
                    const parameter
                    of node.parameters ?? []
                ) {
                    const name =
                        parameter.identifier.name;

                    if (
                        parameterNames.has(name)
                    ) {
                        this.context.report(
                            SemanticError
                                .duplicateParameter(
                                    parameter.identifier
                                )
                        );
                    }

                    parameterNames.add(name);
                    this.visit(parameter);
                }

                this.visit(node.body);
            }
        );
    }

    visitParameter(node) {
        this.mark(node);
        this.mark(node.identifier);

        const symbol = this.context.define(
            node.identifier.name,
            SemanticSymbolKind.PARAMETER,
            node.identifier
        );

        this.context.bind(
            node.identifier,
            symbol
        );
        this.context.bind(node, symbol);
    }

    visitArrayDeclaration(node) {
        this.mark(node);
        this.mark(node.identifier);

        const symbol = this.context.define(
            node.identifier.name,
            SemanticSymbolKind.VARIABLE,
            node.identifier
        );

        this.context.bind(
            node.identifier,
            symbol
        );
        this.context.bind(node, symbol);
        this.visitMany(node.dimensions ?? []);
    }

    visitDeclarationItem(node) {
        this.visitArrayDeclaration(node);
    }

    visitFunctionCall(node) {
        this.mark(node);
        this.visit(node.identifier);
        this.visitMany(node.arguments ?? []);
    }

    visitAccess(node) {
        this.mark(node);
        this.visit(node.identifier);
        this.visitMany(node.indexes ?? []);
    }

    visitBinary(node) {
        this.mark(node);
        this.visit(node.left);
        this.visit(node.right);
    }

    visitUnary(node) {
        this.mark(node);
        this.visit(node.operand);
    }

    visitGroup(node) {
        this.mark(node);
        this.visit(node.expression);
    }

    visitLeaf(node) {
        this.mark(node);
    }
}
