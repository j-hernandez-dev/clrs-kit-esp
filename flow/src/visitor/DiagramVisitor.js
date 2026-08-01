import {
    NodeTypes
} from "../../../src/ast/core/NodeTypes.js";
import {
    DiagramGenerationError
} from "../../../src/errors/DiagramGenerationError.js";
import {
    DiagramASTVisitor
} from "./DiagramASTVisitor.js";
import {
    DiagramContext
} from "./DiagramContext.js";
import {
    DiagramControlFlowVisitor
} from "./DiagramControlFlowVisitor.js";
import {
    DiagramDeclarationVisitor
} from "./DiagramDeclarationVisitor.js";
import {
    DiagramExpressionVisitor
} from "./DiagramExpressionVisitor.js";
import {
    DiagramStatementVisitor
} from "./DiagramStatementVisitor.js";
import {
    sortSubgraphEdges
} from "./DiagramUtilities.js";

/**
 * Coordina la generación de un modelo de diagrama desde el AST.
 */
export class DiagramVisitor
    extends DiagramASTVisitor {

    constructor(options = {}) {
        super();

        this.diagramContext =
            options.diagramContext ??
            new DiagramContext();
        this.expressionVisitor =
            options.expressionVisitor ??
            new DiagramExpressionVisitor();

        const statementDispatcher =
            (statement, diagram) =>
                this.visit(
                    statement,
                    diagram
                );

        this.statementVisitor =
            options.statementVisitor ??
            new DiagramStatementVisitor(
                this.diagramContext,
                this.expressionVisitor
            );
        this.controlFlowVisitor =
            options.controlFlowVisitor ??
            new DiagramControlFlowVisitor(
                this.diagramContext,
                this.expressionVisitor,
                statementDispatcher
            );
        this.declarationVisitor =
            options.declarationVisitor ??
            new DiagramDeclarationVisitor(
                this.diagramContext,
                statementDispatcher
            );

        this.registerHandlers({
            [NodeTypes.ASSIGNMENT]:
                this.visitStatement,
            [NodeTypes.FUNCTION_CALL]:
                this.visitStatement,
            [NodeTypes.WRITE_STATEMENT]:
                this.visitStatement,
            [NodeTypes.READ_STATEMENT]:
                this.visitStatement,
            [NodeTypes.RETURN_STATEMENT]:
                this.visitStatement,
            [NodeTypes.IF_STATEMENT]:
                this.visitControlFlow,
            [NodeTypes.WHILE_STATEMENT]:
                this.visitControlFlow,
            [NodeTypes.FOR_STATEMENT]:
                this.visitControlFlow,
            [NodeTypes.FUNCTION_DECLARATION]:
                this.visitDeclaration
        });
    }

    /**
     * Ejecuta las tres pasadas históricas del generador.
     */
    build(ast) {
        if (!ast) {
            throw DiagramGenerationError
                .astRequired();
        }

        if (ast.type !== NodeTypes.PROGRAM) {
            throw DiagramGenerationError
                .programRequired(ast);
        }

        this.diagramContext.reset();

        const diagram =
            this.diagramContext
                .createDiagram();
        const statements =
            ast.statements ?? [];

        this.registerFunctions(statements);
        this.buildFunctionSubgraphs(
            statements,
            diagram
        );
        this.buildTopLevel(
            statements,
            diagram
        );

        return diagram;
    }

    registerFunctions(statements) {
        for (const statement of statements) {
            if (
                statement.type ===
                    NodeTypes
                        .FUNCTION_DECLARATION &&
                statement.identifier
            ) {
                this.diagramContext
                    .registerFunction(
                        statement.identifier.name,
                        statement
                    );
            }
        }
    }

    buildFunctionSubgraphs(
        statements,
        diagram
    ) {
        for (const statement of statements) {
            if (
                statement.type ===
                NodeTypes.FUNCTION_DECLARATION
            ) {
                this.visit(statement, diagram);
            }
        }
    }

    buildTopLevel(statements, diagram) {
        let insertedMainCall = false;
        const hasFunctions =
            statements.some(statement =>
                statement.type ===
                NodeTypes.FUNCTION_DECLARATION
            );
        let targetDiagram = diagram;
        let subgraph = null;

        if (hasFunctions) {
            subgraph =
                this.diagramContext
                    .createSubgraph(
                        diagram,
                        {
                            id: "top_level",
                            title:
                                "Flujo global"
                        }
                    );
            targetDiagram = {
                ...diagram,
                nodes: subgraph.nodes,
                edges: subgraph.edges
            };
        }

        const startId =
            this.diagramContext.createNode(
                targetDiagram,
                {
                    type: "start",
                    label: "Inicio"
                }
            );
        let previousNode = startId;
        let previousExitLabel = null;

        for (const statement of statements) {
            if (
                statement.type ===
                NodeTypes.FUNCTION_DECLARATION
            ) {
                if (
                    statement.identifier
                        ?.name === "PRINCIPAL" &&
                    !insertedMainCall
                ) {
                    const result = this.visit(
                        {
                            type:
                                NodeTypes
                                    .FUNCTION_CALL,
                            identifier: {
                                name: "PRINCIPAL"
                            },
                            arguments: []
                        },
                        targetDiagram
                    );

                    if (result?.entry) {
                        this.diagramContext
                            .connect(
                                targetDiagram,
                                previousNode,
                                result.entry,
                                previousExitLabel
                            );
                        previousNode =
                            result.exit;
                        previousExitLabel =
                            result.exitLabel ??
                            null;
                    }

                    insertedMainCall = true;
                }

                continue;
            }

            const result = this.visit(
                statement,
                targetDiagram
            );

            if (result?.entry) {
                this.diagramContext.connect(
                    targetDiagram,
                    previousNode,
                    result.entry,
                    previousExitLabel
                );
                previousNode = result.exit;
                previousExitLabel =
                    result.exitLabel ?? null;
            }
        }

        const endId =
            this.diagramContext.createNode(
                targetDiagram,
                {
                    type: "return",
                    label: "Fin"
                }
            );

        this.diagramContext.connect(
            targetDiagram,
            previousNode,
            endId,
            previousExitLabel
        );

        if (subgraph) {
            sortSubgraphEdges(subgraph);
            diagram.subgraphs.push(subgraph);
        }
    }

    visitStatement(statement, diagram) {
        return this.statementVisitor.visit(
            statement,
            diagram
        );
    }

    visitControlFlow(statement, diagram) {
        return this.controlFlowVisitor.visit(
            statement,
            diagram
        );
    }

    visitDeclaration(statement, diagram) {
        return this.declarationVisitor.visit(
            statement,
            diagram
        );
    }

    statementType(statement, diagram) {
        return this.visit(statement, diagram);
    }

    getExpression(expression) {
        return this.expressionVisitor
            .visit(expression);
    }

    buildBlock(diagram, statements) {
        return this.diagramContext.buildBlock(
            diagram,
            statements,
            (statement, targetDiagram) =>
                this.visit(
                    statement,
                    targetDiagram
                )
        );
    }
}

/**
 * Fachada funcional conservada para React y consumidores históricos.
 */
export function build(ast) {
    return new DiagramVisitor().build(ast);
}

export {
    sortSubgraphEdges
} from "./DiagramUtilities.js";
