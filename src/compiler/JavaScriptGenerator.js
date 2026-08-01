import "./utils/ProgramKey.js";

import { NodeTypes } from "../ast/core/NodeTypes.js";
import { TranspilerError } from "../errors/TranspilerError.js";
import {
    dependencies,
    endProgram,
    standartLibrary
} from "./StandartLibrary.js";
import {
    JavaScriptExpressionVisitor
} from "./visitors/JavaScriptExpressionVisitor.js";
import {
    JavaScriptStatementVisitor
} from "./visitors/JavaScriptStatementVisitor.js";

/**
 * Generador puro de JavaScript. No conoce rutas, archivos ni procesos.
 */
export class JavaScriptGenerator {

    constructor(options = {}) {
        this.expressionVisitor =
            options.expressionVisitor ??
            new JavaScriptExpressionVisitor();
        this.statementVisitor =
            options.statementVisitor ??
            new JavaScriptStatementVisitor(
                this.expressionVisitor
            );
    }

    /**
     * @param {import("../ast/core/ASTTypes.js").ProgramNode} ast
     * @returns {string}
     */
    emitProgram(ast) {
        this.assertProgram(ast);

        return this.statementVisitor
            .emitProgram(ast.statements);
    }

    /**
     * @param {import("../ast/core/ASTTypes.js").ProgramNode} ast
     * @param {string|null} [userCode]
     * @returns {string}
     */
    assembleProgram(ast, userCode = null) {
        const emittedCode =
            userCode ?? this.emitProgram(ast);

        if (userCode != null) {
            this.assertProgram(ast);
        }

        return (
            dependencies +
            standartLibrary +
            emittedCode +
            endProgram
        );
    }

    /**
     * @param {import("../ast/core/ASTTypes.js").ProgramNode} ast
     */
    generate(ast) {
        const userCode = this.emitProgram(ast);

        return {
            userCode,
            generatedCode:
                this.assembleProgram(ast, userCode)
        };
    }

    assertProgram(ast) {
        if (!ast) {
            throw new TranspilerError(
                "There is no AST to analyze"
            );
        }

        if (ast.type !== NodeTypes.PROGRAM) {
            throw new TranspilerError(
                "The root node must be a Program",
                ast.location
            );
        }
    }

    statementType(statement) {
        return this.statementVisitor.visit(statement);
    }

    getExpression(expression) {
        return this.expressionVisitor.visit(expression);
    }

    getOperator(operator) {
        return this.expressionVisitor.getOperator(operator);
    }

    getLiteral(literal) {
        return this.expressionVisitor.getLiteral(literal);
    }

    getReferenceName(expression) {
        return this.expressionVisitor
            .getReferenceName(expression);
    }

    generateVariable(identifier, dimensions) {
        return this.statementVisitor
            .generateVariable(
                identifier,
                dimensions
            );
    }

    assignment(statement) {
        return this.statementVisitor
            .assignment(statement);
    }

    functionsDeclaration(statement) {
        return this.statementVisitor
            .functionsDeclaration(statement);
    }

    functionCall(statement) {
        return this.statementVisitor
            .functionCall(statement);
    }

    writeStatement(statement) {
        return this.statementVisitor
            .writeStatement(statement);
    }

    readStatement(statement) {
        return this.statementVisitor
            .readStatement(statement);
    }

    ifStatement(statement) {
        return this.statementVisitor
            .ifStatement(statement);
    }

    buildBlock(statements = []) {
        return this.statementVisitor
            .buildBlock(statements);
    }

    whileStatement(statement) {
        return this.statementVisitor
            .whileStatement(statement);
    }

    forStatement(statement) {
        return this.statementVisitor
            .forStatement(statement);
    }

    returnStatement(statement) {
        return this.statementVisitor
            .returnStatement(statement);
    }
}
