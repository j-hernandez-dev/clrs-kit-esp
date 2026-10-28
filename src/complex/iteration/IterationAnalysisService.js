import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    ComplexAnalysisError
} from "../../errors/ComplexAnalysisError.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    collectWrittenNames,
    LoopIterationAnalyzer
} from "./LoopIterationAnalyzer.js";
import {
    IterationAnalysisModel
} from "./IterationAnalysisModel.js";
import {
    SymbolicValueResolver
} from "./SymbolicValueResolver.js";

/**
 * Recorre cada bloque en orden y captura el entorno simbólico disponible
 * justo antes de cada ciclo.
 */
export class IterationAnalysisService {

    constructor(options = {}) {
        this.loopAnalyzer =
            options.loopAnalyzer ??
            new LoopIterationAnalyzer();
        this.functionSummaryResolver =
            options.functionSummaryResolver ??
            null;
    }

    analyze(ast, options = {}) {
        if (
            ast?.type !==
            NodeTypes.PROGRAM
        ) {
            throw new ComplexAnalysisError(
                "Iteration analysis requires a Program AST.",
                ast?.location ?? null,
                {
                    code:
                        "CLRS_ITERATION_PROGRAM_REQUIRED"
                }
            );
        }

        this.activeFunctionSummaryResolver =
            options.functionSummaryResolver ??
            this.functionSummaryResolver;
        this.activeControlFlowAnalysis =
            options.controlFlowAnalysis ??
            null;
        const records = [];
        const resolver =
            this.createResolver();

        this.processStatements(
            ast.statements,
            resolver,
            records
        );

        return new IterationAnalysisModel(
            records
        );
    }

    createResolver(functionSummaryResolver) {
        return new SymbolicValueResolver(
            undefined,
            {
                functionSummaryResolver:
                    functionSummaryResolver ??
                    this.activeFunctionSummaryResolver ??
                    this.functionSummaryResolver
            }
        );
    }

    processStatements(
        statements,
        resolver,
        records
    ) {
        for (const statement of statements) {
            if (
                this.activeControlFlowAnalysis != null &&
                !this.activeControlFlowAnalysis
                    .isReachable(statement)
            ) {
                continue;
            }

            this.processStatement(
                statement,
                resolver,
                records
            );
        }
    }

    processStatement(
        statement,
        resolver,
        records
    ) {
        switch (statement.type) {
            case NodeTypes.ASSIGNMENT:
                this.processAssignment(
                    statement,
                    resolver
                );
                break;
            case NodeTypes.READ_STATEMENT:
                this.processRead(
                    statement,
                    resolver
                );
                break;
            case NodeTypes.FUNCTION_DECLARATION:
                this.processFunction(
                    statement,
                    records
                );
                break;
            case NodeTypes.IF_STATEMENT:
                this.processIf(
                    statement,
                    resolver,
                    records
                );
                break;
            case NodeTypes.WHILE_STATEMENT:
                this.processWhile(
                    statement,
                    resolver,
                    records
                );
                break;
            case NodeTypes.FOR_STATEMENT:
                this.processFor(
                    statement,
                    resolver,
                    records
                );
                break;
            default:
                break;
        }
    }

    processAssignment(
        statement,
        resolver
    ) {
        if (
            statement.left?.type ===
            NodeTypes.IDENTIFIER
        ) {
            resolver.assign(
                statement.left.name,
                statement.right
            );
        }
    }

    processRead(statement, resolver) {
        for (
            const target
            of statement.identifiers ?? []
        ) {
            if (
                target.type ===
                NodeTypes.IDENTIFIER
            ) {
                resolver.define(
                    target.name,
                    Cost.symbol(
                        target.name
                    )
                );
            }
        }
    }

    processFunction(
        statement,
        records
    ) {
        const functionResolver =
            this.createResolver();

        for (
            const parameter
            of statement.parameters ?? []
        ) {
            const name =
                parameter.identifier?.name;

            if (name != null) {
                functionResolver.define(
                    name,
                    Cost.symbol(name)
                );
            }
        }

        this.processStatements(
            statement.body.statements,
            functionResolver,
            records
        );
    }

    processIf(
        statement,
        resolver,
        records
    ) {
        const branches = [
            {
                condition: statement.condition,
                block: statement.thenBlock
            },
            ...(statement.elseIfBranches ?? [])
                .map(branch => ({
                    condition: branch.condition,
                    block: branch.block
                })),
            ...(statement.elseBlock == null
                ? []
                : [{
                    condition: null,
                    block: statement.elseBlock
                }])
        ];
        const branchResolvers = [];
        const previousConditions = [];

        for (const branch of branches) {
            const branchResolver =
                resolver.clone();

            for (const condition of previousConditions) {
                branchResolver.assume(
                    condition,
                    false
                );
            }

            if (branch.condition != null) {
                branchResolver.assume(
                    branch.condition,
                    true
                );
            }

            if (branchResolver.isReachable()) {
                this.processStatements(
                    branch.block.statements,
                    branchResolver,
                    records
                );
            }
            branchResolvers.push(
                branchResolver
            );

            if (branch.condition != null) {
                previousConditions.push(
                    branch.condition
                );
            }
        }

        if (statement.elseBlock == null) {
            const fallthrough = resolver.clone();

            for (const condition of previousConditions) {
                fallthrough.assume(
                    condition,
                    false
                );
            }

            branchResolvers.push(
                fallthrough
            );
        }

        resolver.merge(
            branchResolvers
        );
    }

    processWhile(
        statement,
        resolver,
        records
    ) {
        const analysisResolver =
            this.sharedResolverBefore(
                statement,
                resolver
            ) ?? resolver;
        const analysis =
            this.loopAnalyzer
                .analyzeWhile(
                    statement,
                    analysisResolver
                );

        records.push({
            node: statement,
            analysis,
            environment:
                analysisResolver.snapshot()
        });

        const writtenNames =
            collectWrittenNames(
                statement.body
            );
        const bodyResolver =
            resolver.clone();

        bodyResolver.assume(
            statement.condition,
            true
        );

        this.forgetNames(
            bodyResolver,
            writtenNames
        );

        this.processStatements(
            statement.body.statements,
            bodyResolver,
            records
        );

        this.forgetNames(
            resolver,
            writtenNames
        );
        this.applyLoopPostState(
            resolver,
            analysis
        );
    }

    processFor(
        statement,
        resolver,
        records
    ) {
        const analysisResolver =
            this.sharedResolverBefore(
                statement,
                resolver
            ) ?? resolver;
        const analysis =
            this.loopAnalyzer
                .analyzeFor(
                    statement,
                    analysisResolver
                );

        records.push({
            node: statement,
            analysis,
            environment:
                analysisResolver.snapshot()
        });

        const bodyResolver =
            resolver.clone();
        const variable =
            statement.initializer
                ?.left?.name;
        const writtenNames =
            collectWrittenNames(
                statement.body
            );

        this.forgetNames(
            bodyResolver,
            writtenNames
        );

        if (variable != null) {
            bodyResolver.define(
                variable,
                Cost.symbol(variable)
            );
        }

        bodyResolver.assume(
            statement.condition,
            true
        );

        this.processStatements(
            statement.body.statements,
            bodyResolver,
            records
        );

        if (variable != null) {
            writtenNames.add(variable);
        }

        this.forgetNames(
            resolver,
            writtenNames
        );
        this.applyLoopPostState(
            resolver,
            analysis
        );
    }

    forgetNames(resolver, names) {
        for (const name of names) {
            resolver.forget(name);
        }
    }

    applyLoopPostState(resolver, analysis) {
        const trajectory =
            analysis?.trajectory;

        if (
            trajectory?.variable == null ||
            trajectory.postValue == null ||
            analysis.kind === "unknown"
        ) {
            return;
        }

        resolver.define(
            trajectory.variable,
            trajectory.postValue,
            {
                dependencies:
                    [trajectory.variable],
                source:
                    "loop-postcondition",
                exact: false
            }
        );
    }

    sharedResolverBefore(
        node,
        sequentialResolver = null
    ) {
        const shared =
            this.activeControlFlowAnalysis
            ?.createResolverAtLoopEntry(
                node,
                {
                    functionSummaryResolver:
                        this
                            .activeFunctionSummaryResolver
                }
            ) ?? null;

        if (
            shared == null ||
            sequentialResolver == null
        ) {
            return shared;
        }

        const combined = shared.clone();
        const snapshot =
            sequentialResolver.snapshot();

        for (const binding of snapshot.bindings) {
            if (
                binding.source !==
                    "loop-postcondition"
            ) {
                continue;
            }

            combined.define(
                binding.name,
                binding.expression,
                {
                    dependencies:
                        binding.dependencies,
                    source: binding.source,
                    exact: false,
                    abstractValue:
                        binding.abstractValue
                }
            );
        }

        return combined;
    }
}
