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
import {
    SemanticAnalyzer
} from "../semantic/SemanticAnalyzer.js";
import {
    JavaScriptIdentifierResolver
} from "./JavaScriptIdentifierResolver.js";
import {
    collectRuntimeCoveragePoints
} from "./runtime/RuntimeCoverageCatalog.js";
import { assembleGuiJavaScript } from "./gui/GuiJavaScriptAssembly.js";

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
        this.semanticAnalyzer =
            options.semanticAnalyzer ??
            new SemanticAnalyzer();
        this.identifierResolverFactory =
            options.identifierResolverFactory ??
            (semanticModel =>
                new JavaScriptIdentifierResolver(
                    semanticModel
                ));
    }

    /**
     * @param {import("../ast/core/ASTTypes.js").ProgramNode} ast
     * @returns {string}
     */
    emitProgram(ast, options = {}) {
        this.assertProgram(ast);

        const semanticModel =
            options.semanticModel ??
            this.semanticAnalyzer.analyze(ast);
        const resolver =
            this.identifierResolverFactory(
                semanticModel
            );
        const previousResolver =
            this.statementVisitor
                .setIdentifierResolver(
                    resolver
                );
        const previousGui = this.expressionVisitor.gui;
        this.expressionVisitor.gui = semanticModel.gui ?? null;

        try {
            return this.statementVisitor
                .emitProgram(ast.statements);
        } finally {
            this.expressionVisitor.gui = previousGui;
            this.statementVisitor
                .setIdentifierResolver(
                    previousResolver
                );
        }
    }

    /**
     * @param {import("../ast/core/ASTTypes.js").ProgramNode} ast
     * @param {string|null} [userCode]
     * @returns {string}
     */
    assembleProgram(ast, userCode = null, options = {}) {
        const semanticModel = options.semanticModel ?? this.semanticAnalyzer.analyze(ast);
        const emittedCode =
            userCode ?? this.emitProgram(ast, { semanticModel });

        if (userCode != null) {
            this.assertProgram(ast);
        }

        if (semanticModel.gui?.usage.requiresGui) {
            return assembleGuiJavaScript({ dependencies, library: standartLibrary, userCode: emittedCode,
                endProgram, gui: semanticModel.gui, runtimeContext: options.runtimeContext });
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
    generate(ast, options = {}) {
        const semanticModel = options.semanticModel ?? this.semanticAnalyzer.analyze(ast);
        const userCode = this.emitProgram(
            ast,
            { ...options, semanticModel }
        );

        return {
            userCode,
            generatedCode:
                this.assembleProgram(ast, userCode, { ...options, semanticModel }),
            requiredCapabilities: semanticModel.gui?.usage.capabilities ?? Object.freeze([]),
            coveragePoints:
                collectRuntimeCoveragePoints(ast)
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
