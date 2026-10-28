import {
    NodeTypes
} from "../../../src/ast/core/NodeTypes.js";
import {
    DiagramASTVisitor
} from "./DiagramASTVisitor.js";
import {
    DIAGRAM_EDGE_RELATIONS,
    DIAGRAM_EDITABLE_FIGURES,
    DIAGRAM_NODE_ROLES
} from "./DiagramEditableIdentity.js";
import {
    blockFallsThrough,
    isTerminal
} from "./DiagramUtilities.js";

export class DiagramControlFlowVisitor
    extends DiagramASTVisitor {

    constructor(
        diagramContext,
        expressionVisitor,
        statementDispatcher
    ) {
        super();

        this.diagramContext = diagramContext;
        this.expressionVisitor =
            expressionVisitor;
        this.statementDispatcher =
            statementDispatcher;

        this.registerHandlers({
            [NodeTypes.IF_STATEMENT]:
                this.ifStatement,
            [NodeTypes.WHILE_STATEMENT]:
                this.whileStatement,
            [NodeTypes.FOR_STATEMENT]:
                this.forStatement
        });
    }

    ifStatement(statement, diagram) {
        const decisionId =
            this.diagramContext.createNode(
                diagram,
                {
                    type: "decision",
                    label:
                        this.expressionVisitor
                            .visit(
                                statement.condition
                            ),
                    location:
                        statement.location,
                    editableFigure:
                        DIAGRAM_EDITABLE_FIGURES.IF,
                    editor: {
                        condition:
                            this.expressionVisitor
                                .visit(
                                    statement.condition
                                )
                    },
                    sourceType: statement.type
                }
            );
        const branches = [];
        const thenBlock = this.buildBlock(
            diagram,
            statement.thenBlock?.statements,
            this.diagramContext
                .createChildBlockOptions(
                    "then"
                )
        );

        branches.push({
            decision: decisionId,
            block: thenBlock,
            label: "Sí"
        });

        let previousDecision = decisionId;

        for (
            const branch
            of statement.elseIfBranches ?? []
        ) {
            const elseIfId =
                this.diagramContext.createNode(
                    diagram,
                    {
                        type: "decision",
                        label:
                            this.expressionVisitor
                                .visit(
                                    branch.condition
                                ),
                        location:
                            branch.location ??
                            branch.condition
                                ?.location ??
                            statement.location,
                        editableFigure:
                            DIAGRAM_EDITABLE_FIGURES
                                .IF,
                        editor: {
                            condition:
                                this.expressionVisitor
                                    .visit(
                                        branch.condition
                                    )
                        },
                        sourceType:
                            NodeTypes.IF_STATEMENT
                    }
                );

            this.diagramContext.connect(
                diagram,
                previousDecision,
                elseIfId,
                "No",
                {
                    relation:
                        DIAGRAM_EDGE_RELATIONS
                            .BRANCH_CHAIN
                }
            );

            const block = this.buildBlock(
                diagram,
                branch.block?.statements,
                this.diagramContext
                    .createChildBlockOptions(
                        "else-if",
                        branches.length
                    )
            );

            branches.push({
                decision: elseIfId,
                block,
                label: "Sí"
            });
            previousDecision = elseIfId;
        }

        const hasElse =
            statement.elseBlock != null;
        const elseBlock = this.buildBlock(
            diagram,
            statement.elseBlock?.statements,
            this.diagramContext
                .createChildBlockOptions(
                    "else"
                )
        );

        branches.push({
            decision: previousDecision,
            block: elseBlock,
            label: "No"
        });

        const needsMerge =
            branches.some(branch =>
                blockFallsThrough(
                    branch.block,
                    diagram
                )
            ) || !hasElse;
        const mergeId =
            needsMerge
                ? this.diagramContext
                    .createNode(
                        diagram,
                        {
                            type: "merge",
                            label: ""
                        }
                    )
                : null;

        for (const branch of branches) {
            const {
                decision,
                block,
                label
            } = branch;

            if (block.first) {
                this.diagramContext.connect(
                    diagram,
                    decision,
                    block.first,
                    label,
                    {
                        relation:
                            DIAGRAM_EDGE_RELATIONS
                                .BRANCH,
                        insertion:
                            block.insertionStart
                    }
                );

                if (mergeId) {
                    this.connectToMerge(
                        block.last,
                        mergeId,
                        diagram,
                        block.insertionEnd,
                        block.lastExitRelation,
                        block.lastExitLabel
                    );
                }
            } else if (mergeId) {
                this.diagramContext.connect(
                    diagram,
                    decision,
                    mergeId,
                    label,
                    {
                        relation:
                            DIAGRAM_EDGE_RELATIONS
                                .BRANCH,
                        insertion:
                            block.insertionEnd
                    }
                );
            }
        }

        return {
            entry: decisionId,
            exit: mergeId ?? null
        };
    }

    whileStatement(statement, diagram) {
        const decisionId =
            this.diagramContext.createNode(
                diagram,
                {
                    type: "decision",
                    label:
                        this.expressionVisitor
                            .visit(
                                statement.condition
                            ),
                    location:
                        statement.location,
                    editableFigure:
                        DIAGRAM_EDITABLE_FIGURES
                            .WHILE,
                    editor: {
                        condition:
                            this.expressionVisitor
                                .visit(
                                    statement.condition
                                )
                    },
                    role:
                        DIAGRAM_NODE_ROLES
                            .LOOP_DECISION,
                    sourceType: statement.type
                }
            );
        const body = this.buildBlock(
            diagram,
            statement.body?.statements,
            this.diagramContext
                .createChildBlockOptions(
                    "body",
                    "while"
                )
        );

        if (body.first) {
            this.diagramContext.connect(
                diagram,
                decisionId,
                body.first,
                "Sí",
                {
                    relation:
                        DIAGRAM_EDGE_RELATIONS
                            .LOOP_ENTRY,
                    insertion:
                        body.insertionStart
                }
            );

            if (
                blockFallsThrough(
                    body,
                    diagram
                )
            ) {
                this.diagramContext.connect(
                    diagram,
                    body.last,
                    decisionId,
                    body.lastExitLabel,
                    {
                        relation:
                            body.lastExitRelation ===
                                DIAGRAM_EDGE_RELATIONS
                                    .LOOP_EXIT
                                ? body.lastExitRelation
                                : DIAGRAM_EDGE_RELATIONS
                                    .LOOP_BACK,
                        insertion:
                            body.insertionEnd
                    }
                );
            }
        } else {
            this.diagramContext.connect(
                diagram,
                decisionId,
                decisionId,
                "Sí",
                {
                    relation:
                        DIAGRAM_EDGE_RELATIONS
                            .LOOP_BACK,
                    insertion:
                        body.insertionStart
                }
            );
        }

        return {
            entry: decisionId,
            exit: decisionId,
            exitLabel: "No",
            exitRelation:
                DIAGRAM_EDGE_RELATIONS
                    .LOOP_EXIT
        };
    }

    forStatement(statement, diagram) {
        const preparationId =
            this.diagramContext.createNode(
                diagram,
                {
                    type: "preparation",
                    label:
                        this.buildForHeader(
                            statement
                        ),
                    location:
                        statement.location,
                    editableFigure:
                        this.getForFigure(
                            statement
                        ),
                    editor:
                        this.buildForEditor(
                            statement
                        ),
                    role:
                        DIAGRAM_NODE_ROLES
                            .FOR_PREPARATION,
                    sourceType: statement.type
                }
            );
        const decisionId =
            this.diagramContext.createNode(
                diagram,
                {
                    type: "decision",
                    label:
                        this.expressionVisitor
                            .visit(
                                statement.condition
                            ),
                    location:
                        statement.condition
                            ?.location ??
                        statement.location,
                    role:
                        DIAGRAM_NODE_ROLES
                            .LOOP_DECISION,
                    sourceType: statement.type
                }
            );

        this.diagramContext.connect(
            diagram,
            preparationId,
            decisionId,
            null,
            {
                relation:
                    DIAGRAM_EDGE_RELATIONS
                        .SEQUENCE
            }
        );
        const body = this.buildBlock(
            diagram,
            statement.body?.statements,
            this.diagramContext
                .createChildBlockOptions(
                    "body",
                    "for"
                )
        );

        if (body.first) {
            this.diagramContext.connect(
                diagram,
                decisionId,
                body.first,
                "Sí",
                {
                    relation:
                        DIAGRAM_EDGE_RELATIONS
                            .LOOP_ENTRY,
                    insertion:
                        body.insertionStart
                }
            );

            if (
                blockFallsThrough(
                    body,
                    diagram
                )
            ) {
                this.diagramContext.connect(
                    diagram,
                    body.last,
                    preparationId,
                    body.lastExitLabel,
                    {
                        relation:
                            body.lastExitRelation ===
                                DIAGRAM_EDGE_RELATIONS
                                    .LOOP_EXIT
                                ? body.lastExitRelation
                                : DIAGRAM_EDGE_RELATIONS
                                    .LOOP_BACK,
                        insertion:
                            body.insertionEnd
                    }
                );
            }
        } else {
            this.diagramContext.connect(
                diagram,
                decisionId,
                preparationId,
                "Sí",
                {
                    relation:
                        DIAGRAM_EDGE_RELATIONS
                            .LOOP_BACK,
                    insertion:
                        body.insertionStart
                }
            );
        }

        return {
            entry: preparationId,
            exit: decisionId,
            exitLabel: "No",
            exitRelation:
                DIAGRAM_EDGE_RELATIONS
                    .LOOP_EXIT
        };
    }

    buildForHeader(statement) {
        const variable =
            this.expressionVisitor.visit(
                statement.initializer.left
            );
        const initialValue =
            this.expressionVisitor.visit(
                statement.initializer.right
            );
        const finalValue =
            this.expressionVisitor.visit(
                statement.condition.right
            );
        const incrementOperator =
            statement.increment.right.operator;
        const direction =
            incrementOperator === "+"
                ? "hasta"
                : "bajando";

        return (
            `Para ${variable} = ${initialValue} ` +
            `${direction} ${finalValue}`
        );
    }

    buildForEditor(statement) {
        return {
            variable:
                this.expressionVisitor.visit(
                    statement.initializer.left
                ),
            initialValue:
                this.expressionVisitor.visit(
                    statement.initializer.right
                ),
            finalValue:
                this.expressionVisitor.visit(
                    statement.condition.right
                )
        };
    }

    getForFigure(statement) {
        return statement.increment
            ?.right?.operator === "+"
            ? DIAGRAM_EDITABLE_FIGURES
                .FOR_TO
            : DIAGRAM_EDITABLE_FIGURES
                .FOR_DOWNTO;
    }

    buildBlock(
        diagram,
        statements,
        options = {}
    ) {
        return this.diagramContext.buildBlock(
            diagram,
            statements,
            this.statementDispatcher,
            options
        );
    }

    connectToMerge(
        nodeId,
        mergeId,
        diagram,
        insertion = null,
        exitRelation = null,
        exitLabel = null
    ) {
        if (
            !nodeId ||
            isTerminal(nodeId, diagram)
        ) {
            return false;
        }

        this.diagramContext.connect(
            diagram,
            nodeId,
            mergeId,
            exitLabel,
            {
                relation:
                    exitRelation ===
                        DIAGRAM_EDGE_RELATIONS
                            .LOOP_EXIT
                        ? exitRelation
                        : DIAGRAM_EDGE_RELATIONS
                            .MERGE,
                insertion
            }
        );

        return true;
    }
}
