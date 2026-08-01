import {
    NodeTypes
} from "../../../src/ast/core/NodeTypes.js";
import {
    DiagramGenerationError
} from "../../../src/errors/DiagramGenerationError.js";
import {
    DiagramASTVisitor
} from "./DiagramASTVisitor.js";

export class DiagramStatementVisitor
    extends DiagramASTVisitor {

    constructor(
        diagramContext,
        expressionVisitor
    ) {
        super();

        this.diagramContext = diagramContext;
        this.expressionVisitor =
            expressionVisitor;

        this.registerHandlers({
            [NodeTypes.ASSIGNMENT]:
                this.assignment,
            [NodeTypes.FUNCTION_CALL]:
                this.functionCall,
            [NodeTypes.WRITE_STATEMENT]:
                this.writeStatement,
            [NodeTypes.READ_STATEMENT]:
                this.readStatement,
            [NodeTypes.RETURN_STATEMENT]:
                this.returnStatement
        });
    }

    assignment(statement, diagram) {
        const left =
            this.expressionVisitor.visit(
                statement.left
            );
        const right =
            this.expressionVisitor.visit(
                statement.right
            );
        const id =
            this.diagramContext.createNode(
                diagram,
                {
                    type: "process",
                    label:
                        `${left} <- ${right}`
                }
            );

        return {
            entry: id,
            exit: id
        };
    }

    functionCall(statement, diagram) {
        if (!statement.identifier) {
            throw DiagramGenerationError
                .invalidStructure(
                    "The function call does not have an identifier.",
                    statement,
                    "CLRS_INVALID_DIAGRAM_FUNCTION_CALL"
                );
        }

        const identifier =
            statement.identifier.name;
        const args =
            (statement.arguments ?? [])
                .map(argument =>
                    this.expressionVisitor
                        .visit(argument)
                )
                .join(", ");
        const targetFunction =
            this.diagramContext
                .getFunction(identifier);
        const id =
            this.diagramContext.createNode(
                diagram,
                {
                    type: "call",
                    label:
                        `${identifier}(${args})`
                }
            );
        const node = diagram.nodes.find(
            item => item.id === id
        );

        if (node && targetFunction) {
            node.reference = {
                type: "function",
                name: identifier,
                subgraphId:
                    targetFunction.subgraphId
            };
        }

        return {
            entry: id,
            exit: id
        };
    }

    writeStatement(statement, diagram) {
        const label =
            "Salida " +
            (statement.expressions ?? [])
                .map(expression =>
                    this.expressionVisitor
                        .visit(expression)
                )
                .join(", ");
        const id =
            this.diagramContext.createNode(
                diagram,
                {
                    type: "write",
                    label
                }
            );

        return {
            entry: id,
            exit: id
        };
    }

    readStatement(statement, diagram) {
        const label =
            "Entrada " +
            (statement.identifiers ?? [])
                .map(identifier =>
                    this.expressionVisitor
                        .visit(identifier)
                )
                .join(", ");
        const id =
            this.diagramContext.createNode(
                diagram,
                {
                    type: "read",
                    label
                }
            );

        return {
            entry: id,
            exit: id
        };
    }

    returnStatement(statement, diagram) {
        let label = "Retornar";

        if (statement.expression) {
            label +=
                "\n" +
                this.expressionVisitor.visit(
                    statement.expression
                );
        }

        const id =
            this.diagramContext.createNode(
                diagram,
                {
                    type: "return",
                    label
                }
            );

        return {
            entry: id,
            exit: id
        };
    }
}
