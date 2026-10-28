import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    ComplexAnalysisError
} from "../../errors/ComplexAnalysisError.js";
import {
    SymbolicValueResolver
} from "../iteration/SymbolicValueResolver.js";
import {
    compareAffineReduction,
    createAffine,
    substituteAffine
} from "./AffineExpression.js";
import {
    generalizedReductionForCall
} from "./GeneralizedReduction.js";
import {
    RecurrenceInputAnalysisModel
} from "./RecurrenceInputAnalysisModel.js";
import {
    analyzeRecurrenceScenarios
} from "./RecurrenceScenarioAnalysis.js";

export class RecurrenceInputAnalysisService {

    constructor(options = {}) {
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
                "Recurrence input analysis requires a Program AST.",
                ast?.location ?? null,
                {
                    code:
                        "CLRS_RECURRENCE_PROGRAM_REQUIRED"
                }
            );
        }

        const definitions = [];
        const allCalls = [];
        this.activeControlFlowAnalysis =
            options.controlFlowAnalysis ??
            null;

        for (
            const statement
            of ast.statements
        ) {
            if (
                statement.type !==
                NodeTypes.FUNCTION_DECLARATION
            ) {
                continue;
            }

            const definition =
                this.analyzeFunction(
                    statement,
                    options.functionSummaryResolver
                );

            definitions.push(
                definition
            );
            allCalls.push(
                ...definition.calls
            );
        }

        return new RecurrenceInputAnalysisModel({
            functions: definitions,
            calls: allCalls
        });
    }

    analyzeFunction(
        statement,
        functionSummaryResolver = null
    ) {
        const name =
            statement.identifier.name;
        const parameters =
            (statement.parameters ?? [])
                .map(parameter =>
                    parameter.identifier
                        ?.name
                )
                .filter(Boolean);
        const resolver =
            this.createResolver(
                functionSummaryResolver
            );
        const records = [];

        for (const parameter of parameters) {
            resolver.define(parameter);
        }

        this.processStatements(
            statement.body.statements,
            resolver,
            records,
            name
        );

        const recursiveCalls =
            records.filter(
                record =>
                    record.callee === name
            );
        const measure =
            inferMeasure(
                parameters,
                recursiveCalls
            );
        const flow =
            this.activeControlFlowAnalysis
                ?.getFunction(statement) ??
            null;
        const soundness =
            analyzeRecurrenceScenarios({
                name,
                measure,
                flow,
                transitions:
                    recursiveCalls.map(record =>
                        measure == null
                            ? null
                            : relationForRecord(
                                measure,
                                parameters,
                                record
                            )
                    )
            });
        const calls =
            records.map(record => {
                const relation =
                    record.callee === name &&
                    measure != null
                        ? relationForRecord(
                            measure,
                            parameters,
                            record
                        )
                        : null;

                return Object.freeze({
                    ...record,
                    costName:
                        "T" +
                        record.callee,
                    recursive:
                        record.callee ===
                        name,
                    relation
                });
            });

        return Object.freeze({
            name,
            costName: "T" + name,
            parameters:
                Object.freeze([
                    ...parameters
                ]),
            measure,
            soundness,
            flow,
            calls:
                Object.freeze(calls)
        });
    }

    createResolver(functionSummaryResolver = null) {
        return new SymbolicValueResolver(
            undefined,
            {
                functionSummaryResolver:
                    functionSummaryResolver ??
                    this.functionSummaryResolver
            }
        );
    }

    processStatements(
        statements,
        resolver,
        records,
        functionName
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
                records,
                functionName
            );
        }
    }

    processStatement(
        statement,
        resolver,
        records,
        functionName
    ) {
        switch (statement.type) {
            case NodeTypes.ASSIGNMENT:
                this.collectCalls(
                    statement.right,
                    resolver,
                    records,
                    functionName
                );

                if (
                    statement.left?.type ===
                    NodeTypes.IDENTIFIER
                ) {
                    resolver.assign(
                        statement.left.name,
                        statement.right
                    );
                }
                break;
            case NodeTypes.READ_STATEMENT:
                for (
                    const target
                    of statement.identifiers ?? []
                ) {
                    if (
                        target.type ===
                        NodeTypes.IDENTIFIER
                    ) {
                        resolver.define(
                            target.name
                        );
                    }
                }
                break;
            case NodeTypes.WRITE_STATEMENT:
                this.collectCalls(
                    statement.expressions,
                    resolver,
                    records,
                    functionName
                );
                break;
            case NodeTypes.RETURN_STATEMENT:
                this.collectCalls(
                    statement.expression,
                    resolver,
                    records,
                    functionName
                );
                break;
            case NodeTypes.FUNCTION_CALL:
                this.collectCalls(
                    statement,
                    resolver,
                    records,
                    functionName
                );
                break;
            case NodeTypes.IF_STATEMENT:
                this.processIf(
                    statement,
                    resolver,
                    records,
                    functionName
                );
                break;
            case NodeTypes.WHILE_STATEMENT:
                this.processWhile(
                    statement,
                    resolver,
                    records,
                    functionName
                );
                break;
            case NodeTypes.FOR_STATEMENT:
                this.processFor(
                    statement,
                    resolver,
                    records,
                    functionName
                );
                break;
            default:
                this.collectCalls(
                    statement,
                    resolver,
                    records,
                    functionName
                );
        }
    }

    processIf(
        statement,
        resolver,
        records,
        functionName
    ) {
        this.collectCalls(
            statement.condition,
            resolver,
            records,
            functionName
        );

        for (
            const branch
            of statement.elseIfBranches ?? []
        ) {
            this.collectCalls(
                branch.condition,
                resolver,
                records,
                functionName
            );
        }

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
        const previousConditions = [];

        for (const branch of branches) {
            const branchResolver = resolver.clone();

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
                    records,
                    functionName
                );
            }

            if (branch.condition != null) {
                previousConditions.push(
                    branch.condition
                );
            }
        }
    }

    processWhile(
        statement,
        resolver,
        records,
        functionName
    ) {
        this.collectCalls(
            statement.condition,
            resolver,
            records,
            functionName
        );
        this.processStatements(
            statement.body.statements,
            resolver.clone()
                .assume(
                    statement.condition,
                    true
                ),
            records,
            functionName
        );
    }

    processFor(
        statement,
        resolver,
        records,
        functionName
    ) {
        const loopResolver =
            resolver.clone();

        this.collectCalls(
            statement.initializer,
            loopResolver,
            records,
            functionName
        );

        if (
            statement.initializer
                ?.left?.type ===
            NodeTypes.IDENTIFIER
        ) {
            loopResolver.assign(
                statement.initializer
                    .left.name,
                statement.initializer
                    .right
            );
        }

        this.collectCalls(
            [
                statement.condition,
                statement.increment
            ],
            loopResolver,
            records,
            functionName
        );
        loopResolver.assume(
            statement.condition,
            true
        );
        this.processStatements(
            statement.body.statements,
            loopResolver,
            records,
            functionName
        );
    }

    collectCalls(
        value,
        resolver,
        records,
        functionName
    ) {
        if (Array.isArray(value)) {
            for (const item of value) {
                this.collectCalls(
                    item,
                    resolver,
                    records,
                    functionName
                );
            }

            return;
        }

        if (
            value == null ||
            typeof value !== "object"
        ) {
            return;
        }

        if (
            value.type ===
            NodeTypes.FUNCTION_CALL
        ) {
            const shared =
                this.activeControlFlowAnalysis
                    ?.getCallSite(value) ??
                null;
            const argumentsList =
                shared?.arguments ??
                (value.arguments ?? [])
                    .map(argument =>
                        resolver.resolve(
                            argument
                        )
                    );
            const alternatives =
                shared
                    ?.argumentAlternatives ??
                argumentsList.map(
                    argument => [argument]
                );

            records.push({
                node: value,
                caller: functionName,
                callee:
                    value.identifier.name,
                arguments:
                    Object.freeze([
                        ...argumentsList
                    ]),
                argumentAlternatives:
                    Object.freeze(
                        alternatives.map(
                            values =>
                                Object.freeze([
                                    ...values
                                ])
                        )
                    ),
                relationalContext:
                    shared?.context ?? null,
                ssaState:
                    shared?.ssaState ?? null
            });
        }

        for (
            const [key, child]
            of Object.entries(value)
        ) {
            if (
                key === "location" ||
                key === "identifier"
            ) {
                continue;
            }

            this.collectCalls(
                child,
                resolver,
                records,
                functionName
            );
        }
    }
}

function inferMeasure(
    parameters,
    recursiveCalls
) {
    if (
        parameters.length === 0 ||
        recursiveCalls.length === 0
    ) {
        return null;
    }

    const candidates = [
        ...parameters.map(
            parameter =>
                parameterMeasure(
                    parameter
                )
        ),
        ...intervalMeasures(
            parameters
        )
    ];
    const valid =
        candidates.filter(candidate =>
            recursiveCalls.every(call =>
                relationForRecord(
                    candidate,
                    parameters,
                    call
                ) != null
            )
        );

    valid.sort(
        compareMeasures
    );

    return valid[0] ?? null;
}

function relationForRecord(
    measure,
    parameters,
    record
) {
    const variants =
        expandArgumentAlternatives(
            record.arguments,
            record.argumentAlternatives
        );
    const relations = variants.map(
        argumentsList =>
            relationForCall(
                measure,
                parameters,
                argumentsList
            )
    );

    if (relations.some(relation =>
        relation == null
    )) {
        return null;
    }

    return combineRelations(relations);
}

function expandArgumentAlternatives(
    argumentsList,
    alternatives
) {
    if (
        !Array.isArray(alternatives) ||
        alternatives.length !==
            argumentsList.length
    ) {
        return [argumentsList];
    }

    let variants = [[]];

    for (const values of alternatives) {
        variants = variants.flatMap(prefix =>
            values.map(value => [
                ...prefix,
                value
            ])
        );

        if (variants.length > 32) {
            return [argumentsList];
        }
    }

    return variants;
}

function combineRelations(relations) {
    const kinds = new Set(
        relations.map(relation =>
            relation.kind
        )
    );

    if (kinds.size !== 1) {
        return null;
    }

    const kind = relations[0].kind;

    if (kind === "decrement") {
        return Object.freeze({
            ...relations[0],
            amount: Math.min(
                ...relations.map(
                    relation =>
                        relation.amount
                )
            )
        });
    }

    if (kind === "division") {
        return Object.freeze({
            ...relations[0],
            ratio: Math.max(
                ...relations.map(
                    relation =>
                        relation.ratio
                )
            )
        });
    }

    const first = JSON.stringify(
        relations[0]
    );

    return relations.every(relation =>
        JSON.stringify(relation) === first
    )
        ? relations[0]
        : null;
}

function parameterMeasure(parameter) {
    return Object.freeze({
        kind: "parameter",
        parameter,
        affine:
            createAffine(
                0,
                {
                    [parameter]: 1
                }
            )
    });
}

function intervalMeasures(parameters) {
    const measures = [];

    for (
        let lowerIndex = 0;
        lowerIndex <
            parameters.length - 1;
        lowerIndex++
    ) {
        for (
            let upperIndex =
                lowerIndex + 1;
            upperIndex <
                parameters.length;
            upperIndex++
        ) {
            const lower =
                parameters[lowerIndex];
            const upper =
                parameters[upperIndex];

            measures.push(
                Object.freeze({
                    kind: "interval",
                    lower,
                    upper,
                    affine:
                        createAffine(
                            1,
                            {
                                [lower]: -1,
                                [upper]: 1
                            }
                        )
                })
            );
        }
    }

    return measures;
}

function relationForCall(
    measure,
    parameters,
    argumentsList
) {
    return compareAffineReduction(
        measure.affine,
        substituteAffine(
            measure.affine,
            parameters,
            argumentsList
        )
    ) ?? generalizedReductionForCall(
        measure,
        parameters,
        argumentsList
    );
}

function compareMeasures(left, right) {
    if (left.kind !== right.kind) {
        return left.kind ===
            "parameter"
            ? -1
            : 1;
    }

    return measureWidth(left) -
        measureWidth(right);
}

function measureWidth(measure) {
    return Object.keys(
        measure.affine.coefficients
    ).length;
}
