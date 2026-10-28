import { ReportNode } from "./ReportNode.js";
import { CostNode } from "./CostNode.js";
import { BlockCostNode } from "./BlockCostNode.js";
import { ComplexAnalysisError } from "../errors/ComplexAnalysisError.js";
import { costSubstitution } from "./LibrarySubstitution.js";
import { CostExpressionFactory as Cost } from "./algebra/CostExpressionFactory.js";
import { formatCostExpression } from "./algebra/CostExpressionFormatter.js";
import {
    simplifyCostExpression
} from "./algebra/CostExpressionSimplifier.js";
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
import {
    createScenarioCost,
    createUniformScenarioCost,
    ScenarioCostConfidence,
    ScenarioCostModel,
    sumScenarioCosts
} from "./scenario/index.js";
import {
    UnknownComplexityAnalysisService
} from "./unknown/index.js";
import {
    FunctionSemanticSummaryService
} from "./function-semantics/index.js";
import { NodeTypes } from "../ast/core/NodeTypes.js";
import { ASTVisitor } from "../ast/visitors/ASTVisitor.js";
import {
    ComplexityControlFlowAnalysisService
} from "./soundness/index.js";
import {
    sumCostAlongTrajectory
} from "./summation/index.js";

import { analyzeGuiCosts } from "./gui/GuiCostAnalysis.js";

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
        this.functionSemanticSummaryAnalyzer =
            options
                .functionSemanticSummaryAnalyzer ??
            new FunctionSemanticSummaryService();
        this.functionSemanticSummaryAnalysis =
            null;
        this.asymptoticAnalyzer =
            options.asymptoticAnalyzer ??
            new AsymptoticAnalysisService();
        this.unknownComplexityAnalyzer =
            options
                .unknownComplexityAnalyzer ??
            new UnknownComplexityAnalysisService();
        this.callArgumentResolver =
            options.callArgumentResolver ??
            new SymbolicValueResolver();
        this.controlFlowAnalyzer =
            options.controlFlowAnalyzer ??
            new ComplexityControlFlowAnalysisService();
        this.controlFlowAnalysis = null;

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

        this.guiCostAnalysis = analyzeGuiCosts(ast);
        this.functionSemanticSummaryAnalysis =
            this.functionSemanticSummaryAnalyzer
                .analyze(ast);
        if (
            this.callArgumentResolver instanceof
            SymbolicValueResolver
        ) {
            this.callArgumentResolver
                .functionSummaryResolver =
                this.functionSemanticSummaryAnalysis;
        }
        this.controlFlowAnalysis =
            this.controlFlowAnalyzer
                .analyze(ast, {
                    functionSummaryResolver:
                        this
                            .functionSemanticSummaryAnalysis
                });
        this.iterationAnalysis =
            this.iterationAnalyzer
                .analyze(ast, {
                    functionSummaryResolver:
                        this
                            .functionSemanticSummaryAnalysis,
                    controlFlowAnalysis:
                        this.controlFlowAnalysis
                });
        this.recurrenceInputAnalysis =
            this.recurrenceInputAnalyzer
                .analyze(ast, {
                    functionSummaryResolver:
                        this
                            .functionSemanticSummaryAnalysis,
                    controlFlowAnalysis:
                        this.controlFlowAnalysis
                });

        const nodes =
            this.visitMany(ast.statements)
                .filter(Boolean);

        const report =
            new ReportNode(
                nodes,
                this.iterationAnalysis,
                this.recurrenceInputAnalysis,
                this.controlFlowAnalysis
            );

        attachScenarioCostModel(
            report,
            nodes
        );
        if (this.guiCostAnalysis.calls.length) {
            Object.defineProperty(report, "guiCostModel", { value: this.guiCostAnalysis });
        }
        attachFunctionSemanticSummaryModel(
            report,
            this.functionSemanticSummaryAnalysis
        );

        this.asymptoticAnalyzer
            .analyze(report);
        this.unknownComplexityAnalyzer
            .analyze(report);

        return report;
    }

    statementType(statement) {
        return this.visit(statement);
    }

    getFunctionCall(statement) {
        const guiCost = this.guiCostAnalysis?.get(statement);
        if (guiCost) { return guiCost.expression; }
        const functionName =
            statement.identifier.name;
        const libraryCost =
            // GUI se sustituye sólo si la resolución semántica la reconoció.
            // Una función de usuario homónima conserva su propia función de costo.
            this.guiCostAnalysis?.isGuiName(functionName)
                ? null : costSubstitution(functionName);

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
            return resolvedArguments.map((argument, index) =>
                this.guiCostAnalysis?.argumentValue?.(statement, index, argument) ?? argument);
        }

        return argumentsList.map(
            (argument, index) => {
                const resolved = this.callArgumentResolver.resolve(argument);
                return this.guiCostAnalysis?.argumentValue?.(statement, index, resolved) ?? resolved;
            }
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
        const scenarioCost =
            this.buildFunctionScenarioCost(
                statement.identifier.name,
                parameters,
                body.scenarioCost
            );

        return this.blockNodeFactory(
            NodeTypes.FUNCTION_DECLARATION,
            statement.location,
            scenarioCost.worst,
            body.instructions,
            scenarioCost
        );
    }

    buildFunctionScenarioCost(
        name,
        parameters,
        bodyScenario
    ) {
        return createScenarioCost({
            best:
                this.buildFunctionExpression(
                    name,
                    parameters,
                    bodyScenario.best
                ),
            worst:
                this.buildFunctionExpression(
                    name,
                    parameters,
                    bodyScenario.worst
                ),
            assumptions:
                bodyScenario.assumptions,
            evidence:
                bodyScenario.evidence,
            confidence:
                bodyScenario.confidence
        });
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
            this.guiCostAnalysis?.calls.length
                ? Cost.sum([this.getFunctionCall(statement), ...this.getFunctionCalls(statement.arguments)])
                : this.getFunctionCall(statement)
        );
    }

    buildInstructions(statements = []) {
        return this.visitMany(
            statements.filter(statement =>
                this.controlFlowAnalysis
                    ?.isReachable(statement) ??
                true
            )
        );
    }

    buildBlockExpression(nodes = []) {
        return this.buildBlockScenarioCost(
            nodes
        ).worst;
    }

    buildBlockScenarioCost(nodes = []) {
        return sumScenarioCosts(
            nodes.map(
                node =>
                    node.scenarioCost
            )
        );
    }

    buildBlockCost(
        prefixExpression,
        instructions
    ) {
        return this.buildBlockScenario(
            createUniformScenarioCost(
                prefixExpression
            ),
            instructions
        ).worst;
    }

    buildBlockScenario(
        prefixScenario,
        instructions
    ) {
        const body =
            this.buildBlockScenarioCost(
                instructions
            );

        return createScenarioCost({
            best:
                Cost.sum([
                    prefixScenario.best,
                    Cost.group(
                        body.best
                    )
                ]),
            worst:
                Cost.sum([
                    prefixScenario.worst,
                    Cost.group(
                        body.worst
                    )
                ]),
            assumptions: [
                ...prefixScenario.assumptions,
                ...body.assumptions
            ],
            evidence: [
                ...prefixScenario.evidence,
                ...body.evidence
            ],
            confidence: {
                best:
                    combineScenarioConfidence([
                        prefixScenario.confidence.best,
                        body.confidence.best
                    ]),
                worst:
                    combineScenarioConfidence([
                        prefixScenario.confidence.worst,
                        body.confidence.worst
                    ])
            }
        });
    }

    buildBlock(statements = []) {
        const instructions =
            this.buildInstructions(
                statements
            );
        const scenarioCost =
            this.buildBlockScenarioCost(
                instructions
            );
        const costExpression =
            scenarioCost.worst;

        return {
            instructions,
            costExpression,
            scenarioCost,
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
        statements,
        prefixScenario = null
    ) {
        const instructions =
            this.buildInstructions(
                statements
            );
        const scenarioCost =
            this.buildBlockScenario(
                prefixScenario ??
                    createUniformScenarioCost(
                        prefixExpression
                    ),
                instructions
            );
        const costExpression =
            scenarioCost.worst;
        const node =
            this.blockNodeFactory(
                type,
                location,
                costExpression,
                instructions,
                scenarioCost
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

        const fallthrough =
            statement.elseBlock == null
                ? this.buildConditionCost(
                    branchNumber,
                    [
                        ...ifConditionCalls,
                        ...accumulatedConditionCalls
                    ]
                )
                : null;

        const blockExpression =
            expressions.length === 1
                ? expressions[0]
                : Cost.maximum(
                    expressions
                );
        const bestExpressions = [
            ...branches.map(
                branch =>
                    branch.scenarioCost.best
            ),
            ...(
                fallthrough == null
                    ? []
                    : [fallthrough]
            )
        ];
        const branchAssumptions =
            branches.flatMap(
                branch =>
                    branch
                        .scenarioCost
                        .assumptions
            );
        const branchEvidence =
            branches.flatMap(
                branch =>
                    branch
                        .scenarioCost
                        .evidence
            );
        const scenarioCost =
            createScenarioCost({
                best:
                    bestExpressions.length === 1
                        ? bestExpressions[0]
                        : Cost.minimum(
                            bestExpressions
                        ),
                worst:
                    blockExpression,
                assumptions: [
                    "Las rutas sintácticas se consideran potencialmente alcanzables hasta incorporar análisis de caminos.",
                    ...branchAssumptions
                ],
                evidence: [
                    "El mejor caso usa la ruta sintáctica de menor costo y el peor conserva el máximo histórico.",
                    ...branchEvidence
                ],
                confidence: {
                    best:
                        ScenarioCostConfidence
                            .SYNTACTIC_BOUND,
                    worst:
                        ScenarioCostConfidence
                            .UPPER_BOUND
                }
            });

        return this.blockNodeFactory(
            "IfBlock",
            statement.location,
            blockExpression,
            branches,
            scenarioCost
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
        bodyExpression,
        iterationAnalysis = null
    ) {
        const iterationWork = Cost.sum([
            conditionCost,
            Cost.group(bodyExpression)
        ]);

        return Cost.sum([
            conditionCost,
            this.aggregateLoopIterations(
                iterations,
                iterationWork,
                iterationAnalysis
            )
        ]);
    }

    aggregateLoopIterations(
        iterations,
        iterationWork,
        iterationAnalysis
    ) {
        const transition =
            iterationAnalysis?.transition;
        const trajectory =
            iterationAnalysis?.trajectory;
        const update = transition?.update;
        const dependsOnTrajectory =
            transition?.variable != null &&
            this.containsTrajectorySymbol(
                iterationWork,
                transition.variable
            );
        const trajectorySum =
            dependsOnTrajectory
                ? sumCostAlongTrajectory({
                    trajectory,
                    term: iterationWork
                })
                : null;

        if (trajectorySum != null) {
            return trajectorySum.expression;
        }

        const preservesBoundIndex =
            transition?.start?.kind ===
                "constant" &&
            transition.start.value !== 0;
        const supportsSummation =
            iterationAnalysis?.boundKind ===
                "tight" &&
            transition?.start?.kind ===
                "constant" &&
            update?.progression ===
                "additive" &&
            update.amount === 1 &&
            dependsOnTrajectory &&
            (
                transition.condition.operator === "<" ||
                transition.condition.operator === "<="
            );

        if (!supportsSummation) {
            if (
                dependsOnTrajectory
            ) {
                return Cost.unknown(
                    "El trabajo depende de una trayectoria de la variable de control que todavía no se ha sumado de forma segura."
                );
            }

            return Cost.product([
                iterations,
                Cost.group(iterationWork)
            ]);
        }

        const upper =
            transition.condition.operator === "<"
                ? Cost.difference(
                    transition.bound,
                    Cost.constant(1)
                )
                : transition.bound;
        const summation = Cost.summation(
            transition.variable,
            transition.start,
            upper,
            iterationWork
        );
        const closed = simplifyCostExpression(
            summation
        );

        return closed.kind === "summation"
            ? preservesBoundIndex
                ? summation
                : Cost.product([
                    iterations,
                    Cost.group(iterationWork)
                ])
            : closed;
    }

    containsTrajectorySymbol(
        expression,
        name
    ) {
        return containsCostSymbol(
            expression,
            name,
            this.functionSemanticSummaryAnalysis
        );
    }

    buildLoopNode(
        type,
        location,
        iterations,
        headerCost,
        statements,
        iterationAnalysis = null
    ) {
        const body =
            this.buildBlock(statements);
        const scenarioCost =
            createScenarioCost({
                best:
                    this.buildLoopExpression(
                        iterations,
                        headerCost,
                        body.scenarioCost.best,
                        iterationAnalysis
                    ),
                worst:
                    this.buildLoopExpression(
                        iterations,
                        headerCost,
                        body.scenarioCost.worst,
                        iterationAnalysis
                    ),
                assumptions: [
                    ...(
                        iterationAnalysis
                            ?.assumptions ?? []
                    ),
                    ...body
                        .scenarioCost
                        .assumptions
                ],
                evidence:
                    [
                        ...(
                            iterationAnalysis
                                ?.trajectory
                                ?.evidence ?? []
                        ),
                        ...body.scenarioCost
                            .evidence
                    ],
                confidence: {
                    best:
                        iterationAnalysis?.kind ===
                            "unknown"
                            ? ScenarioCostConfidence
                                .UNKNOWN
                            : body.scenarioCost
                                .confidence.best,
                    worst:
                        iterationAnalysis?.kind ===
                            "unknown"
                            ? ScenarioCostConfidence
                                .UNKNOWN
                            : body.scenarioCost
                                .confidence.worst
                }
            });
        const costExpression =
            scenarioCost.worst;
        const node =
            this.blockNodeFactory(
                type,
                location,
                costExpression,
                body.instructions,
                scenarioCost
            );

        return {
            node,
            costExpression,
            expression:
                formatCostExpression(
                    costExpression
                ),
            instructions:
                body.instructions,
            scenarioCost
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
                statement.body.statements,
                iterationAnalysis
            );
        const block =
            this.blockNodeFactory(
                "WhileBlock",
                statement.location,
                loop.costExpression,
                [loop.node],
                loop.scenarioCost
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
        bodyExpression,
        iterationAnalysis = null
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
            this.aggregateLoopIterations(
                iterations,
                Cost.sum([
                    incrementCost,
                    Cost.group(bodyExpression)
                ]),
                iterationAnalysis
            )
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
            body.costExpression,
            iterationAnalysis
            );
        const scenarioCost =
            createScenarioCost({
                best:
                    this.buildForExpression(
                        initializerCost,
                        conditionCost,
                        incrementCost,
                        iterations,
                        body.scenarioCost.best,
                        iterationAnalysis
                    ),
                worst:
                    fullExpression,
                assumptions: [
                    ...(
                        iterationAnalysis
                            ?.assumptions ?? []
                    ),
                    ...body.scenarioCost.assumptions
                ],
                evidence:
                    [
                        ...(
                            iterationAnalysis
                                ?.trajectory
                                ?.evidence ?? []
                        ),
                        ...body.scenarioCost
                            .evidence
                    ],
                confidence: {
                    best:
                        iterationAnalysis?.kind ===
                            "unknown"
                            ? ScenarioCostConfidence
                                .UNKNOWN
                            : body.scenarioCost
                                .confidence.best,
                    worst:
                        iterationAnalysis?.kind ===
                            "unknown"
                            ? ScenarioCostConfidence
                                .UNKNOWN
                            : body.scenarioCost
                                .confidence.worst
                }
            });
        const forNode =
            this.blockNodeFactory(
                NodeTypes.FOR_STATEMENT,
                statement.location,
                fullExpression,
                body.instructions,
                scenarioCost
            );

        const block =
            this.blockNodeFactory(
                "ForBlock",
                statement.location,
                fullExpression,
                [forNode],
                scenarioCost
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
        expression,
        scenarioCost = null
    ) {
        if (!scenarioCost && this.guiCostAnalysis?.calls.length) {
            scenarioCost = createUniformScenarioCost(expression, { assumptions: this.guiCostAnalysis.assumptions });
        }
        return new CostNode(
            type,
            location,
            expression,
            scenarioCost
        );
    }

    blockNodeFactory(
        type,
        location,
        expression,
        instructions,
        scenarioCost = null
    ) {
        return new BlockCostNode(
            type,
            location,
            expression,
            instructions,
            scenarioCost
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

function combineScenarioConfidence(values) {
    const unique =
        new Set(values);

    if (
        unique.has(
            ScenarioCostConfidence.UNKNOWN
        )
    ) {
        return ScenarioCostConfidence.UNKNOWN;
    }

    unique.delete(
        ScenarioCostConfidence.EXACT
    );

    if (unique.size === 0) {
        return ScenarioCostConfidence.EXACT;
    }

    return unique.size === 1
        ? [...unique][0]
        : ScenarioCostConfidence.UNKNOWN;
}

function attachScenarioCostModel(
    report,
    roots
) {
    const records = [];

    for (const root of roots) {
        collectScenarioCostRecords(
            root,
            records
        );
    }

    Object.defineProperty(
        report,
        "scenarioCostAnalysis",
        {
            value:
                new ScenarioCostModel(
                    records
                )
        }
    );
}

function attachFunctionSemanticSummaryModel(
    report,
    model
) {
    Object.defineProperty(
        report,
        "functionSemanticSummaryAnalysis",
        {
            value: model
        }
    );
}

function collectScenarioCostRecords(
    node,
    records
) {
    records.push({
        node,
        cost: node.scenarioCost
    });

    for (
        const instruction
        of node.instructions ?? []
    ) {
        collectScenarioCostRecords(
            instruction,
            records
        );
    }
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

function containsCostSymbol(
    expression,
    name,
    semanticSummaries = null
) {
    if (
        expression?.kind === "symbol" &&
        expression.name === name
    ) {
        return true;
    }

    if (
        expression == null ||
        typeof expression !== "object"
    ) {
        return false;
    }

    if (
        expression.kind === "call" &&
        expression.name?.startsWith("T") &&
        semanticSummaries
            ?.get(
                expression.name.slice(1)
            )
            ?.transparent === true
    ) {
        return false;
    }

    return Object.entries(expression)
        .some(([key, value]) => {
            if (key === "kind" || key === "name") {
                return false;
            }

            return Array.isArray(value)
                ? value.some(item =>
                    containsCostSymbol(
                        item,
                        name,
                        semanticSummaries
                    )
                )
                : containsCostSymbol(
                    value,
                    name,
                    semanticSummaries
                );
        });
}
