import {
    NodeTypes
} from "../../../src/ast/core/NodeTypes.js";
import {
    DiagramASTVisitor
} from "./DiagramASTVisitor.js";
import {
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
                            )
                }
            );
        const branches = [];
        const thenBlock = this.buildBlock(
            diagram,
            statement.thenBlock?.statements
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
                                )
                    }
                );

            this.diagramContext.connect(
                diagram,
                previousDecision,
                elseIfId,
                "No"
            );

            const block = this.buildBlock(
                diagram,
                branch.block?.statements
            );

            branches.push({
                decision: elseIfId,
                block,
                label: "Sí"
            });
            previousDecision = elseIfId;
        }

        let hasElse = false;

        if (statement.elseBlock) {
            hasElse = true;

            branches.push({
                decision: previousDecision,
                block: this.buildBlock(
                    diagram,
                    statement.elseBlock
                        .statements
                ),
                label: "No"
            });
        }

        const needsMerge =
            branches.some(branch =>
                branch.block.first &&
                !isTerminal(
                    branch.block.last,
                    diagram
                )
            ) ||
            !hasElse;
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
                    label
                );

                if (mergeId) {
                    this.connectToMerge(
                        block.last,
                        mergeId,
                        diagram
                    );
                }
            } else if (mergeId) {
                this.diagramContext.connect(
                    diagram,
                    decision,
                    mergeId,
                    label
                );
            }
        }

        if (!hasElse && mergeId) {
            this.diagramContext.connect(
                diagram,
                previousDecision,
                mergeId,
                "No"
            );
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
                            )
                }
            );
        const body = this.buildBlock(
            diagram,
            statement.body?.statements
        );

        if (body.first) {
            this.diagramContext.connect(
                diagram,
                decisionId,
                body.first,
                "Sí"
            );

            if (
                !isTerminal(
                    body.last,
                    diagram
                )
            ) {
                this.diagramContext.connect(
                    diagram,
                    body.last,
                    decisionId
                );
            }
        } else {
            this.diagramContext.connect(
                diagram,
                decisionId,
                decisionId,
                "Sí"
            );
        }

        return {
            entry: decisionId,
            exit: decisionId,
            exitLabel: "No"
        };
    }

    forStatement(statement, diagram) {
        const forId =
            this.diagramContext.createNode(
                diagram,
                {
                    type: "preparation",
                    label:
                        this.buildForHeader(
                            statement
                        )
                }
            );
        const body = this.buildBlock(
            diagram,
            statement.body?.statements
        );

        if (body.first) {
            this.diagramContext.connect(
                diagram,
                forId,
                body.first,
                "No"
            );

            if (
                !isTerminal(
                    body.last,
                    diagram
                )
            ) {
                this.diagramContext.connect(
                    diagram,
                    body.last,
                    forId
                );
            }
        }

        return {
            entry: forId,
            exit: forId,
            exitLabel: "Sí"
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
            `Para ${variable} <- ${initialValue} ` +
            `${direction} ${finalValue}`
        );
    }

    buildBlock(diagram, statements) {
        return this.diagramContext.buildBlock(
            diagram,
            statements,
            this.statementDispatcher
        );
    }

    connectToMerge(
        nodeId,
        mergeId,
        diagram
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
            mergeId
        );

        return true;
    }
}
