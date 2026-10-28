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
    DIAGRAM_EDGE_RELATIONS,
    DIAGRAM_EDITABLE_FIGURES,
    DIAGRAM_NODE_ROLES,
    DIAGRAM_STRUCTURAL_FIGURES
} from "./DiagramEditableIdentity.js";
import {
    blockFallsThrough,
    sortSubgraphEdges
} from "./DiagramUtilities.js";

export class DiagramDeclarationVisitor
    extends DiagramASTVisitor {

    constructor(
        diagramContext,
        statementDispatcher
    ) {
        super();

        this.diagramContext = diagramContext;
        this.statementDispatcher =
            statementDispatcher;

        this.registerHandlers({
            [NodeTypes.FUNCTION_DECLARATION]:
                this.functionDeclaration
        });
    }

    functionDeclaration(statement, diagram) {
        if (!statement.identifier) {
            throw DiagramGenerationError
                .invalidStructure(
                    "The function declaration does not have an identifier.",
                    statement,
                    "CLRS_INVALID_DIAGRAM_FUNCTION_DECLARATION"
                );
        }

        const identifier =
            statement.identifier.name;
        const args =
            (statement.parameters ?? [])
                .map(parameter => {
                    const dimensions =
                        parameter.dimensions ??
                        [];

                    return (
                        parameter.identifier.name +
                        "[]".repeat(
                            dimensions.length
                        )
                    );
                })
                .join(", ");
        const subgraph =
            this.diagramContext
                .createSubgraph(
                    diagram,
                    {
                        id:
                            `function_${identifier}`,
                        title: `${identifier}`
                    }
                );
        const functionDiagram = {
            ...diagram,
            nodes: subgraph.nodes,
            edges: subgraph.edges
        };
        const startId =
            this.diagramContext.createNode(
                functionDiagram,
                {
                    type: "start",
                    label: `${identifier}(${args})`,
                    location:
                        statement.identifier
                            ?.location ??
                        statement.location,
                    editableFigure:
                        DIAGRAM_STRUCTURAL_FIGURES
                            .FUNCTION_DECLARATION,
                    editor: {
                        identifier,
                        parameters: args
                    },
                    identityPath:
                        `${this.diagramContext
                            .getCurrentScope()}` +
                        "/declaration",
                    identityContext: {
                        scopeId:
                            this.diagramContext
                                .getCurrentScope(),
                        containerId:
                            `${subgraph.id}/body`,
                        branch: "body",
                        statementIndex: null,
                        statementCount:
                            statement.body
                                ?.statements
                                ?.length ?? 0
                    },
                    sourceType:
                        NodeTypes.FUNCTION_DECLARATION,
                    role:
                        DIAGRAM_NODE_ROLES
                            .FUNCTION_START
                }
            );
        const statements =
            statement.body?.statements ?? [];
        const lastStatement =
            statements.at(-1);
        const protectedTerminal =
            this.finalReturnStatement(
                lastStatement
            );
        const body = this.diagramContext
            .withProtectedFunctionTerminal(
                protectedTerminal,
                () => this.diagramContext
                    .buildBlock(
                        functionDiagram,
                        statements,
                        this.statementDispatcher,
                        {
                            scopeId:
                                this.diagramContext
                                    .getCurrentScope(),
                            containerId:
                                `${subgraph.id}/body`,
                            branch: "body"
                        }
                    )
            );
        let exitId;

        if (!body.first) {
            exitId =
                this.createImplicitReturn(
                    functionDiagram,
                    body.insertionEnd
                );

            this.diagramContext.connect(
                functionDiagram,
                startId,
                exitId,
                null,
                {
                    relation:
                        DIAGRAM_EDGE_RELATIONS.ENTRY,
                    insertion:
                        body.insertionEnd
                }
            );
        } else {
            this.diagramContext.connect(
                functionDiagram,
                startId,
                body.first,
                null,
                {
                    relation:
                        DIAGRAM_EDGE_RELATIONS.ENTRY,
                    insertion:
                        body.insertionStart
                }
            );

            exitId = body.last ?? body.terminal;

            if (
                blockFallsThrough(
                    body,
                    functionDiagram
                )
            ) {
                exitId =
                    this.createImplicitReturn(
                        functionDiagram,
                        body.insertionEnd
                    );

                this.diagramContext.connect(
                    functionDiagram,
                    body.last,
                    exitId,
                    body.lastExitLabel,
                    {
                        relation:
                            body.lastExitRelation ===
                                DIAGRAM_EDGE_RELATIONS
                                    .LOOP_EXIT
                                ? body.lastExitRelation
                                : DIAGRAM_EDGE_RELATIONS
                                    .EXIT,
                        insertion:
                            body.insertionEnd
                    }
                );
            }
        }

        sortSubgraphEdges(subgraph);
        diagram.subgraphs.push(subgraph);

        this.diagramContext.registerFunction(
            identifier,
            {
                entry: startId,
                exit: exitId,
                subgraphId:
                    subgraph.id,
                location:
                    statement.location
            }
        );

        return {
            entry: startId,
            exit: exitId
        };
    }

    createImplicitReturn(diagram, insertion) {
        return this.diagramContext.createNode(
            diagram,
            {
                type: "return",
                label: "Fin",
                synthetic: true,
                editableSynthetic: true,
                editableFigure:
                    DIAGRAM_EDITABLE_FIGURES
                        .RETURN,
                deletable: false,
                editor: {
                    expression: ""
                },
                materialization: {
                    kind: "implicit-return",
                    relation:
                        DIAGRAM_EDGE_RELATIONS.EXIT,
                    insertion
                },
                identityPath:
                    `${this.diagramContext
                        .getCurrentScope()}/end`,
                role:
                    DIAGRAM_NODE_ROLES
                        .FUNCTION_END,
                sourceType:
                    NodeTypes.RETURN_STATEMENT
            }
        );
    }

    endsWithReturn(statement) {
        if (!statement) {
            return false;
        }

        switch (statement.type) {
            case NodeTypes.RETURN_STATEMENT:
                return true;

            case NodeTypes.IF_STATEMENT:
                return (
                    statement.thenBlock
                        ?.statements
                        ?.at(-1)?.type ===
                        NodeTypes.RETURN_STATEMENT &&
                    statement.elseBlock
                        ?.statements
                        ?.at(-1)?.type ===
                        NodeTypes.RETURN_STATEMENT
                );

            default:
                return false;
        }
    }

    finalReturnStatement(statement) {
        if (!this.endsWithReturn(statement)) {
            return null;
        }

        if (
            statement.type ===
                NodeTypes.RETURN_STATEMENT
        ) {
            return statement;
        }

        return statement.elseBlock
            ?.statements?.at(-1) ?? null;
    }
}
