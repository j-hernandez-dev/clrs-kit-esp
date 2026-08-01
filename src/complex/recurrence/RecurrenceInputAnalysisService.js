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
    RecurrenceInputAnalysisModel
} from "./RecurrenceInputAnalysisModel.js";

export class RecurrenceInputAnalysisService {

    analyze(ast) {
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
                    statement
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

    analyzeFunction(statement) {
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
            new SymbolicValueResolver();
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
        const calls =
            records.map(record => {
                const relation =
                    record.callee === name &&
                    measure != null
                        ? relationForCall(
                            measure,
                            parameters,
                            record.arguments
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
            calls:
                Object.freeze(calls)
        });
    }

    processStatements(
        statements,
        resolver,
        records,
        functionName
    ) {
        for (const statement of statements) {
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
            statement.thenBlock,
            ...(statement.elseIfBranches ?? [])
                .map(branch =>
                    branch.block
                ),
            statement.elseBlock
        ].filter(Boolean);

        for (const branch of branches) {
            this.processStatements(
                branch.statements,
                resolver.clone(),
                records,
                functionName
            );
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
            resolver.clone(),
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
            records.push({
                node: value,
                caller: functionName,
                callee:
                    value.identifier.name,
                arguments:
                    Object.freeze(
                        (value.arguments ?? [])
                            .map(argument =>
                                resolver.resolve(
                                    argument
                                )
                            )
                    )
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
                relationForCall(
                    candidate,
                    parameters,
                    call.arguments
                ) != null
            )
        );

    valid.sort(
        compareMeasures
    );

    return valid[0] ?? null;
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
