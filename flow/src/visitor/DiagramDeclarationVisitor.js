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
                    label:
                        `Inicio\n${identifier}(${args})`
                }
            );
        const body =
            this.diagramContext.buildBlock(
                functionDiagram,
                statement.body?.statements,
                this.statementDispatcher
            );
        let exitId;

        if (!body.first) {
            exitId =
                this.diagramContext.createNode(
                    functionDiagram,
                    {
                        type: "return",
                        label: "Fin"
                    }
                );

            this.diagramContext.connect(
                functionDiagram,
                startId,
                exitId
            );
        } else {
            this.diagramContext.connect(
                functionDiagram,
                startId,
                body.first
            );

            const statements =
                statement.body?.statements ??
                [];
            const lastStatement =
                statements.at(-1);

            exitId = body.last;

            if (
                !this.endsWithReturn(
                    lastStatement
                )
            ) {
                exitId =
                    this.diagramContext
                        .createNode(
                            functionDiagram,
                            {
                                type: "return",
                                label: "Fin"
                            }
                        );

                this.diagramContext.connect(
                    functionDiagram,
                    body.last,
                    exitId,
                    body.lastExitLabel
                );
            }
        }

        sortSubgraphEdges(subgraph);
        diagram.subgraphs.push(subgraph);

        this.diagramContext.registerFunction(
            identifier,
            {
                entry: startId,
                exit: exitId
            }
        );

        return {
            entry: startId,
            exit: exitId
        };
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
}
