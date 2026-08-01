import { ReportNode } from "./ReportNode.js";
import { CostNode } from "./CostNode.js";
import { BlockCostNode } from "./BlockCostNode.js";
import { ComplexAnalysisError } from "../errors/ComplexAnalysisError.js";
import { costSubstitution } from "./LibrarySubstitution.js";
import { CostExpressionFactory as Cost } from "./algebra/CostExpressionFactory.js";
import { formatCostExpression } from "./algebra/CostExpressionFormatter.js";
import {
    IterationAnalysisService
} from "./iteration/IterationAnalysisService.js";
import {
    SymbolicValueResolver
} from "./iteration/SymbolicValueResolver.js";
import {
    AsymptoticAnalysisService
} from "./asymptotic/AsymptoticAnalysisService.js";
import {
    attachRecurrenceCallMetadata
} from "./recurrence/RecurrenceCallMetadata.js";
import {
    RecurrenceInputAnalysisService
} from "./recurrence/RecurrenceInputAnalysisService.js";
import { NodeTypes } from "../ast/core/NodeTypes.js";
import { ASTVisitor } from "../ast/visitors/ASTVisitor.js";

const C = Cost.symbol("c");

export class CostAnalysisVisitor extends ASTVisitor {

    constructor(options = {}) {
        super();

        this.iterationAnalyzer =
            options.iterationAnalyzer ??
            new IterationAnalysisService();
        this.iterationAnalysis = null;
        this.recurrenceInputAnalyzer =
            options.recurrenceInputAnalyzer ??
            new RecurrenceInputAnalysisService();
        this.recurrenceInputAnalysis =
            null;
        this.asymptoticAnalyzer =
            options.asymptoticAnalyzer ??
            new AsymptoticAnalysisService();
        this.callArgumentResolver =
            options.callArgumentResolver ??
            new SymbolicValueResolver();

        this.registerHandlers({
            [NodeTypes.ASSIGNMENT]:
                this.assignment,

            [NodeTypes.WRITE_STATEMENT]:
                this.writeStatement,

            [NodeTypes.READ_STATEMENT]:
                this.readStatement,

            [NodeTypes.RETURN_STATEMENT]:
                this.returnStatement,

            [NodeTypes.FUNCTION_CALL]:
                this.functionCall,

            [NodeTypes.FUNCTION_DECLARATION]:
                this.functionsDeclaration,

            [NodeTypes.IF_STATEMENT]:
                this.ifStatement,

            [NodeTypes.WHILE_STATEMENT]:
                this.whileStatement,

            [NodeTypes.FOR_STATEMENT]:
                this.forStatement
        });
    }

    costAnalysis(ast) {
        if (!ast) {
            throw new ComplexAnalysisError(
                "There is no AST to analyze"
            );
        }

        if (ast.type !== NodeTypes.PROGRAM) {
            throw new ComplexAnalysisError(
                "The root node must be a Program"
            );
        }

        this.iterationAnalysis =
            this.iterationAnalyzer
                .analyze(ast);
        this.recurrenceInputAnalysis =
            this.recurrenceInputAnalyzer
                .analyze(ast);

        const nodes =
            this.visitMany(ast.statements)
                .filter(Boolean);

        const report =
            new ReportNode(
                nodes,
                this.iterationAnalysis,
                this.recurrenceInputAnalysis
            );

        this.asymptoticAnalyzer
            .analyze(report);

        return report;
    }

    statementType(statement) {
        return this.visit(statement);
    }

    getFunctionCall(statement) {
        const functionName =
            statement.identifier.name;
        const libraryCost =
            costSubstitution(functionName);

        if (libraryCost !== null) {
            return libraryCost;
        }

        const recurrenceMetadata =
            this.recurrenceInputAnalysis
                ?.getCall(statement) ??
            null;
        const expression =
            Cost.call(
                "T" + functionName,
                this.buildCallArguments(
                    statement,
                    recurrenceMetadata
                )
            );

        if (recurrenceMetadata != null) {
            attachRecurrenceCallMetadata(
                expression,
                recurrenceMetadata
            );
        }

        return expression;
    }

    buildCallArguments(
        statement,
        recurrenceMetadata
    ) {
        const argumentsList =
            statement.arguments ?? [];
        const resolvedArguments =
            recurrenceMetadata
                ?.arguments;

        if (
            Array.isArray(
                resolvedArguments
            ) &&
            resolvedArguments.length ===
                argumentsList.length
        ) {
            return [
                ...resolvedArguments
            ];
        }

        return argumentsList.map(
            argument =>
                this.callArgumentResolver
                    .resolve(argument)
        );
    }

    getFunctionCalls(statement) {
        const expressions = [];

        if (
            !statement ||
            typeof statement !== "object"
        ) {
            return expressions;
        }

        if (
            statement.type ===
            NodeTypes.FUNCTION_CALL
        ) {
            expressions.push(
                this.getFunctionCall(
                    statement
                )
            );
        }

        for (
            const value
            of Object.values(statement)
        ) {
            expressions.push(
                ...this.getFunctionCalls(
                    value
                )
            );
        }

        return expressions;
    }

    buildInstructionExpression(
        statement
    ) {
        return Cost.sum([
            C,
            ...this.getFunctionCalls(
                statement
            )
        ]);
    }

    /**
     * Genera una asignación.
     *
     * @param {any} statement
     */
    assignment(statement) {
        return this.costNodeFactory(
            statement.type,
            statement.location,
            this.buildInstructionExpression(
                statement.right
            )
        );
    }

    /**
     * Genera una declaración de función o procedimiento.
     *
     * @param {any} statement
     */
    functionsDeclaration(statement) {
        const body =
            this.buildBlock(
                statement.body.statements
            );
        const parameters =
            (statement.parameters ?? [])
                .map(parameter =>
                    parameter.identifier
                        ?.name
                )
                .filter(Boolean)
                .map(name =>
                    Cost.symbol(name)
                );

        return this.blockNodeFactory(
            NodeTypes.FUNCTION_DECLARATION,
            statement.location,
            this.buildFunctionExpression(
                statement.identifier.name,
                parameters,
                body.costExpression
            ),
            body.instructions
        );
    }

    buildFunctionExpression(
        name,
        parameters,
        bodyExpression
    ) {
        const costName =
            "T" + name;
        const left =
            Cost.call(
                costName,
                parameters
            );

        return containsCostCall(
            bodyExpression,
            costName
        )
            ? Cost.recurrence(
                left,
                bodyExpression
            )
            : Cost.equation(
                left,
                bodyExpression
            );
    }

    /**
     * Genera una instrucción de salida.
     *
     * @param {any} statement
     */
    writeStatement(statement) {
        return this.costNodeFactory(
            statement.type,
            statement.location,
            this.buildInstructionExpression(
                statement.expressions ?? []
            )
        );
    }

    /**
     * Genera una instrucción de lectura (input).
     *
     * @param {any} statement
     */
    readStatement(statement) {
        return this.costNodeFactory(
            statement.type,
            statement.location,
            C
        );
    }

    /**
     * @param {any} statement
     */
    returnStatement(statement) {
        return this.costNodeFactory(
            statement.type,
            statement.location,
            this.buildInstructionExpression(
                statement.expression
            )
        );
    }

    /**
     * @param {any} statement
     */
    functionCall(statement) {
        return this.costNodeFactory(
            statement.type,
            statement.location,
            this.getFunctionCall(
                statement
            )
        );
    }

    buildInstructions(statements = []) {
        return this.visitMany(statements);
    }

    buildBlockExpression(nodes = []) {
        if (nodes.length === 0) {
            return Cost.constant(0);
        }

        return Cost.sum(
            nodes.map(
                node =>
                    node.costExpression
            )
        );
    }

    buildBlockCost(
        prefixExpression,
        instructions
    ) {
        return Cost.sum([
            prefixExpression,
            Cost.group(
                this.buildBlockExpression(
                    instructions
                )
            )
        ]);
    }

    buildBlock(statements = []) {
        const instructions =
            this.buildInstructions(
                statements
            );
        const costExpression =
            this.buildBlockExpression(
                instructions
            );

        return {
            instructions,
            costExpression,
            expression:
                formatCostExpression(
                    costExpression
                )
        };
    }

    buildBlockNode(
        type,
        location,
        prefixExpression,
        statements
    ) {
        const instructions =
            this.buildInstructions(
                statements
            );
        const costExpression =
            this.buildBlockCost(
                prefixExpression,
                instructions
            );
        const node =
            this.blockNodeFactory(
                type,
                location,
                costExpression,
                instructions
            );

        return {
            node,
            instructions
        };
    }

    /**
     * Genera estructura if / else if / else.
     *
     * @param {any} statement
     */
    ifStatement(statement) {
        const branches = [];
        const expressions = [];
        const ifConditionCalls =
            this.getFunctionCalls(
                statement.condition
            );
        const ifConditionCost =
            this.buildConditionCost(
                1,
                ifConditionCalls
            );
        let branchNumber = 1;

        const ifBranch =
            this.buildBlockNode(
                NodeTypes.IF_STATEMENT,
                statement.location,
                ifConditionCost,
                statement.thenBlock.statements
            );

        branches.push(ifBranch.node);
        expressions.push(
            ifBranch.node.costExpression
        );

        const accumulatedConditionCalls =
            [];

        for (
            const elseIf
            of statement.elseIfBranches
        ) {
            accumulatedConditionCalls.push(
                ...this.getFunctionCalls(
                    elseIf.condition
                )
            );
            branchNumber++;

            const prefixExpression =
                this.buildConditionCost(
                    branchNumber,
                    [
                        ...ifConditionCalls,
                        ...accumulatedConditionCalls
                    ]
                );
            const branch =
                this.buildBlockNode(
                    "ElseIfStatement",
                    elseIf.condition.location,
                    prefixExpression,
                    elseIf.block.statements
                );

            branches.push(branch.node);
            expressions.push(
                branch.node.costExpression
            );
        }

        if (statement.elseBlock) {
            const conditionCount =
                statement.elseIfBranches
                    .length === 0
                    ? 1
                    : branchNumber;
            const prefixExpression =
                this.buildConditionCost(
                    conditionCount,
                    [
                        ...ifConditionCalls,
                        ...accumulatedConditionCalls
                    ]
                );
            const branch =
                this.buildBlockNode(
                    "ElseStatement",
                    statement.elseBlock
                        .location,
                    prefixExpression,
                    statement.elseBlock
                        .statements
                );

            branches.push(branch.node);
            expressions.push(
                branch.node.costExpression
            );
        }

        const blockExpression =
            expressions.length === 1
                ? expressions[0]
                : Cost.maximum(
                    expressions
                );

        return this.blockNodeFactory(
            "IfBlock",
            statement.location,
            blockExpression,
            branches
        );
    }

    buildConditionCost(
        conditionCount,
        functionCalls
    ) {
        const baseCost =
            conditionCount === 1
                ? C
                : Cost.product([
                    Cost.constant(
                        conditionCount
                    ),
                    C
                ]);

        return Cost.sum([
            baseCost,
            ...functionCalls
        ]);
    }

    buildLoopExpression(
        iterations,
        conditionCost,
        bodyExpression
    ) {
        return Cost.sum([
            conditionCost,
            Cost.product([
                iterations,
                Cost.group(
                    Cost.sum([
                        conditionCost,
                        Cost.group(
                            bodyExpression
                        )
                    ])
                )
            ])
        ]);
    }

    buildLoopNode(
        type,
        location,
        iterations,
        headerCost,
        statements
    ) {
        const body =
            this.buildBlock(statements);
        const costExpression =
            this.buildLoopExpression(
                iterations,
                headerCost,
                body.costExpression
            );
        const node =
            this.blockNodeFactory(
                type,
                location,
                costExpression,
                body.instructions
            );

        return {
            node,
            costExpression,
            expression:
                formatCostExpression(
                    costExpression
                ),
            instructions:
                body.instructions
        };
    }

    /**
     * Genera estructura while.
     *
     * @param {any} statement
     */
    whileStatement(statement) {
        const iterationAnalysis =
            this.iterationAnalysis
                ?.get(statement) ??
            null;
        const conditionCost =
            this.buildInstructionExpression(
                statement.condition
            );
        const loop =
            this.buildLoopNode(
                NodeTypes.WHILE_STATEMENT,
                statement.location,
                iterationAnalysis
                    ?.iterations ??
                    Cost.unknown(),
                conditionCost,
                statement.body.statements
            );
        const block =
            this.blockNodeFactory(
                "WhileBlock",
                statement.location,
                loop.costExpression,
                [loop.node]
            );

        attachIterationAnalysis(
            loop.node,
            iterationAnalysis
        );
        attachIterationAnalysis(
            block,
            iterationAnalysis
        );

        return block;
    }

    buildForExpression(
        initializerCost,
        conditionCost,
        incrementCost,
        iterations,
        bodyExpression
    ) {
        return Cost.sum([
            initializerCost,
            Cost.product([
                Cost.group(
                    Cost.sum([
                        iterations,
                        Cost.constant(1)
                    ])
                ),
                Cost.group(
                    conditionCost
                )
            ]),
            Cost.product([
                iterations,
                Cost.group(
                    Cost.sum([
                        incrementCost,
                        Cost.group(
                            bodyExpression
                        )
                    ])
                )
            ])
        ]);
    }

    /**
     * Genera estructura for.
     *
     * @param {any} statement
     */
    forStatement(statement) {
        const iterationAnalysis =
            this.iterationAnalysis
                ?.get(statement) ??
            null;
        const iterations =
            iterationAnalysis
                ?.iterations ??
            Cost.unknown();
        const initializerCost =
            this.buildInstructionExpression(
                statement.initializer
            );
        const conditionCost =
            this.buildInstructionExpression(
                statement.condition
            );
        const incrementCost =
            this.buildInstructionExpression(
                statement.increment
            );
        const body =
            this.buildBlock(
                statement.body.statements
            );
        const fullExpression =
            this.buildForExpression(
                initializerCost,
                conditionCost,
                incrementCost,
                iterations,
                body.costExpression
            );
        const forNode =
            this.blockNodeFactory(
                NodeTypes.FOR_STATEMENT,
                statement.location,
                fullExpression,
                body.instructions
            );

        const block =
            this.blockNodeFactory(
                "ForBlock",
                statement.location,
                fullExpression,
                [forNode]
            );

        attachIterationAnalysis(
            forNode,
            iterationAnalysis
        );
        attachIterationAnalysis(
            block,
            iterationAnalysis
        );

        return block;
    }

    costNodeFactory(
        type,
        location,
        expression
    ) {
        return new CostNode(
            type,
            location,
            expression
        );
    }

    blockNodeFactory(
        type,
        location,
        expression,
        instructions
    ) {
        return new BlockCostNode(
            type,
            location,
            expression,
            instructions
        );
    }
}

function attachIterationAnalysis(
    node,
    analysis
) {
    if (analysis == null) {
        return node;
    }

    Object.defineProperty(
        node,
        "iterationAnalysis",
        {
            value: analysis
        }
    );

    return node;
}

function containsCostCall(
    expression,
    name
) {
    if (
        expression?.kind == null
    ) {
        return false;
    }

    if (
        expression.kind === "call" &&
        expression.name === name
    ) {
        return true;
    }

    return Object.values(expression)
        .some(value => {
            if (Array.isArray(value)) {
                return value.some(item =>
                    containsCostCall(
                        item,
                        name
                    )
                );
            }

            return containsCostCall(
                value,
                name
            );
        });
}
