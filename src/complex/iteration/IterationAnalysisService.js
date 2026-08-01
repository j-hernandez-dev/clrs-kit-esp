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
    }

    analyze(ast) {
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

        const records = [];
        const resolver =
            new SymbolicValueResolver();

        this.processStatements(
            ast.statements,
            resolver,
            records
        );

        return new IterationAnalysisModel(
            records
        );
    }

    processStatements(
        statements,
        resolver,
        records
    ) {
        for (const statement of statements) {
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
            new SymbolicValueResolver();

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
        const blocks = [
            statement.thenBlock,
            ...(statement.elseIfBranches ?? [])
                .map(branch =>
                    branch.block
                ),
            statement.elseBlock
        ].filter(Boolean);
        const writtenNames =
            new Set();

        for (const block of blocks) {
            this.processStatements(
                block.statements,
                resolver.clone(),
                records
            );

            collectWrittenNames(
                block,
                writtenNames
            );
        }

        this.forgetNames(
            resolver,
            writtenNames
        );
    }

    processWhile(
        statement,
        resolver,
        records
    ) {
        const analysis =
            this.loopAnalyzer
                .analyzeWhile(
                    statement,
                    resolver
                );

        records.push({
            node: statement,
            analysis
        });

        const writtenNames =
            collectWrittenNames(
                statement.body
            );
        const bodyResolver =
            resolver.clone();

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
    }

    processFor(
        statement,
        resolver,
        records
    ) {
        const analysis =
            this.loopAnalyzer
                .analyzeFor(
                    statement,
                    resolver
                );

        records.push({
            node: statement,
            analysis
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
    }

    forgetNames(resolver, names) {
        for (const name of names) {
            resolver.forget(name);
        }
    }
}
