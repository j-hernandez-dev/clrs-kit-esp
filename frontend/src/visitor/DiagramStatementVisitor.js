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
    DIAGRAM_EDITABLE_FIGURES,
    DIAGRAM_NODE_ROLES
} from "./DiagramEditableIdentity.js";

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
                        `${left} = ${right}`,
                    location:
                        statement.location,
                    synthetic:
                        statement.synthetic ===
                        true,
                    editableFigure:
                        DIAGRAM_EDITABLE_FIGURES
                            .ASSIGNMENT,
                    editor: {
                        target: left,
                        expression: right
                    },
                    sourceType: statement.type
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
        const principalCallProxy =
            statement.synthetic === true &&
            statement.editableSynthetic === true &&
            statement.sourceType ===
                NodeTypes.FUNCTION_DECLARATION;
        const id =
            this.diagramContext.createNode(
                diagram,
                {
                    type: "call",
                    label:
                        `${identifier}(${args})`,
                    location:
                        statement.location,
                    synthetic:
                        statement.synthetic ===
                        true,
                    editableSynthetic:
                        principalCallProxy,
                    editableFigure:
                        DIAGRAM_EDITABLE_FIGURES
                            .FUNCTION_CALL,
                    readOnly:
                        principalCallProxy,
                    deletable:
                        !principalCallProxy,
                    editor:
                        principalCallProxy
                            ? {
                                identifier,
                                arguments:
                                    statement
                                        .declarationParameters ??
                                    ""
                            }
                            : {
                                identifier,
                                arguments: args
                            },
                    sourceType:
                        statement.sourceType ??
                        statement.type
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
                    label,
                    location:
                        statement.location,
                    editableFigure:
                        DIAGRAM_EDITABLE_FIGURES
                            .WRITE,
                    editor: {
                        expressions:
                            (statement.expressions ?? [])
                                .map(expression =>
                                    this.expressionVisitor
                                        .visit(expression)
                                )
                                .join(", ")
                    },
                    sourceType: statement.type
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
                    label,
                    location:
                        statement.location,
                    editableFigure:
                        DIAGRAM_EDITABLE_FIGURES
                            .READ,
                    editor: {
                        variables:
                            (statement.identifiers ?? [])
                                .map(identifier =>
                                    this.expressionVisitor
                                        .visit(identifier)
                                )
                                .join(", ")
                    },
                    sourceType: statement.type
                }
            );

        return {
            entry: id,
            exit: id
        };
    }

    returnStatement(statement, diagram) {
        const expression =
            this.expressionVisitor.visit(
                statement.expression
            );
        const label =
            `Retornar ${expression}`;
        const isProtectedTerminal =
            this.diagramContext
                .getProtectedFunctionTerminal() ===
            statement;

        const id =
            this.diagramContext.createNode(
                diagram,
                {
                    type: "return",
                    label,
                    location:
                        statement.location,
                    editableFigure:
                        DIAGRAM_EDITABLE_FIGURES
                            .RETURN,
                    // Sólo la terminal final queda protegida. Vaciar su
                    // expresión desde el editor la transforma en un Fin
                    // sintético, por lo que la función conserva siempre un
                    // cierre visual y estructural.
                    deletable:
                        !isProtectedTerminal,
                    editor: {
                        expression
                    },
                    role:
                        DIAGRAM_NODE_ROLES
                            .EXPLICIT_RETURN,
                    sourceType: statement.type
                }
            );

        return {
            entry: id,
            exit: id
        };
    }
}
