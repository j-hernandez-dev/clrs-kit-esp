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
    DIAGRAM_EDGE_RELATIONS,
    DIAGRAM_NODE_ROLES
} from "./DiagramEditableIdentity.js";
import {
    isTerminal,
    sortSubgraphEdges
} from "./DiagramUtilities.js";
import {
    DiagramStatementVisitor
} from "./DiagramStatementVisitor.js";

/**
 * Coordina la generación de un modelo de diagrama desde el AST.
 */
export class DiagramVisitor
    extends DiagramASTVisitor {

    constructor(options = {}) {
        super();

        this.diagramContext =
            options.diagramContext ??
            new DiagramContext({
                sourceOrigin:
                    options.sourceOrigin ??
                    null
            });
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
                        {
                            declaration:
                                statement,
                            subgraphId:
                                `function_${statement.identifier.name}`,
                            location:
                                statement.location
                        }
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
                const scopeId =
                    `function_${statement.identifier?.name ??
                        "anonymous"}`;

                this.diagramContext.withScope(
                    scopeId,
                    () => this.visit(
                        statement,
                        diagram
                    )
                );
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

        const scopeId = subgraph?.id ??
            "__main__";

        this.diagramContext.withScope(
            scopeId,
            () => this.diagramContext.withBlock(
                {
                    scopeId,
                    containerId: `${scopeId}/body`,
                    branch: "body"
                },
                () => {
                    const startId =
                        this.diagramContext
                            .createNode(
                                targetDiagram,
                                {
                                    type: "start",
                                    label: "Inicio",
                                    identityPath:
                                        `${scopeId}/start`,
                                    role:
                                        DIAGRAM_NODE_ROLES
                                            .GLOBAL_START
                                }
                            );
                    let previousNode = startId;
                    let previousExitLabel = null;
                    let previousExitRelation =
                        DIAGRAM_EDGE_RELATIONS
                            .SEQUENCE;
                    let statementIndex = 0;

                    for (const statement of statements) {
                        let sourceStatement = statement;

                        if (
                            statement.type ===
                            NodeTypes.FUNCTION_DECLARATION
                        ) {
                            if (
                                statement.identifier
                                    ?.name !== "PRINCIPAL" ||
                                insertedMainCall
                            ) {
                                continue;
                            }

                            sourceStatement = {
                                type:
                                    NodeTypes.FUNCTION_CALL,
                                identifier: {
                                    name: "PRINCIPAL",
                                    location:
                                        statement.identifier
                                            ?.location ??
                                        statement.location
                                },
                                arguments: [],
                                location:
                                    statement.identifier
                                        ?.location ??
                                    statement.location,
                                synthetic: true,
                                editableSynthetic: true,
                                declarationParameters:
                                    (statement.parameters ?? [])
                                        .map(parameter => {
                                            const dimensions =
                                                parameter.dimensions ?? [];

                                            return (
                                                parameter.identifier.name +
                                                "[]".repeat(
                                                    dimensions.length
                                                )
                                            );
                                        })
                                        .join(", "),
                                sourceType:
                                    NodeTypes
                                        .FUNCTION_DECLARATION
                            };
                            insertedMainCall = true;
                        }

                        const currentIndex =
                            statementIndex++;
                        const result =
                            this.diagramContext
                                .withStatement(
                                    sourceStatement,
                                    currentIndex,
                                    () => this.visit(
                                        sourceStatement,
                                        targetDiagram
                                    )
                                );

                        if (
                            result?.entry &&
                            previousNode
                        ) {
                            this.diagramContext.connect(
                                targetDiagram,
                                previousNode,
                                result.entry,
                                previousExitLabel,
                                {
                                    relation:
                                        previousExitRelation,
                                    insertion:
                                        this.diagramContext
                                            .createInsertionPoint(
                                                currentIndex,
                                                currentIndex === 0
                                                    ? "start"
                                                    : "between"
                                            )
                                }
                            );
                            previousNode = result.exit;
                            previousExitLabel =
                                result.exitLabel ?? null;
                            previousExitRelation =
                                result.exitRelation ??
                                DIAGRAM_EDGE_RELATIONS
                                    .SEQUENCE;

                            if (
                                result.fallsThrough ===
                                    false ||
                                !previousNode ||
                                isTerminal(
                                    previousNode,
                                    targetDiagram
                                )
                            ) {
                                previousNode = null;
                                previousExitLabel = null;
                            }
                        }
                    }

                    const endId =
                        this.diagramContext
                            .createNode(
                                targetDiagram,
                                {
                                    type: "return",
                                    label: "Fin",
                                    identityPath:
                                        `${scopeId}/end`,
                                    role:
                                        DIAGRAM_NODE_ROLES
                                            .GLOBAL_END
                                }
                            );

                    if (previousNode) {
                        this.diagramContext.connect(
                            targetDiagram,
                            previousNode,
                            endId,
                            previousExitLabel,
                            {
                                relation:
                                    previousExitRelation ===
                                        DIAGRAM_EDGE_RELATIONS
                                            .LOOP_EXIT
                                        ? previousExitRelation
                                        : DIAGRAM_EDGE_RELATIONS
                                            .EXIT,
                                insertion:
                                    this.diagramContext
                                        .createInsertionPoint(
                                            statementIndex,
                                            "end"
                                        )
                            }
                        );
                    }
                }
            )
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
