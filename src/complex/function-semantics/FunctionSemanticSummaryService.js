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
    createFunctionSemanticSummary
} from "./FunctionSemanticSummary.js";
import {
    FunctionSemanticSummaryModel
} from "./FunctionSemanticSummaryModel.js";

/**
 * Extrae contratos de retorno seguros sin ejecutar funciones de usuario.
 * Esta primera versión acepta asignaciones locales y condicionales; cualquier
 * E/S, escritura por acceso, mutación de parámetros o ciclo vuelve opaco el
 * resumen. Así, ampliar el soporte nunca cambia un resultado ya probado por
 * una suposición implícita.
 */
export class FunctionSemanticSummaryService {

    analyze(ast) {
        if (ast?.type !== NodeTypes.PROGRAM) {
            throw new ComplexAnalysisError(
                "Function semantic summaries require a Program AST.",
                ast?.location ?? null,
                {
                    code:
                        "CLRS_FUNCTION_SEMANTIC_PROGRAM_REQUIRED"
                }
            );
        }

        const records = ast.statements
            .filter(statement =>
                statement.type ===
                NodeTypes.FUNCTION_DECLARATION
            )
            .map(node => ({
                node,
                summary: this.analyzeFunction(node)
            }));

        return new FunctionSemanticSummaryModel(
            records
        );
    }

    analyzeFunction(node) {
        const parameters = (node.parameters ?? [])
            .map(parameter =>
                parameter.identifier?.name
            )
            .filter(Boolean);
        const resolver = new SymbolicValueResolver();

        for (const parameter of parameters) {
            resolver.define(parameter);
        }

        const states = this.processStatements(
            node.body?.statements ?? [],
            [{
                resolver,
                status: "continuing",
                returnValue: null,
                returnLocation: null,
                effectKinds: new Set()
            }],
            new Set(parameters)
        );
        const returns = states
            .filter(state =>
                state.status === "returned"
            )
            .map(state => ({
                expression: state.returnValue,
                constraints:
                    state.resolver.getConstraints(),
                location: state.returnLocation
            }));
        const effectKinds = states.flatMap(state =>
            [...state.effectKinds]
        );

        return createFunctionSemanticSummary({
            name: node.identifier.name,
            parameters,
            returns,
            effectKinds,
            complete: states.every(state =>
                state.status === "returned"
            ),
            location: node.location
        });
    }

    processStatements(
        statements,
        states,
        parameters
    ) {
        let current = states;

        for (const statement of statements) {
            current = current.flatMap(state =>
                state.status === "returned"
                    ? [state]
                    : this.processStatement(
                        statement,
                        state,
                        parameters
                    )
            );
        }

        return current;
    }

    processStatement(
        statement,
        state,
        parameters
    ) {
        switch (statement.type) {
            case NodeTypes.ASSIGNMENT:
                return [this.processAssignment(
                    statement,
                    state,
                    parameters
                )];
            case NodeTypes.RETURN_STATEMENT:
                return [{
                    ...state,
                    status: "returned",
                    returnValue:
                        state.resolver.resolve(
                            statement.expression
                        ),
                    returnLocation:
                        statement.location ?? null
                }];
            case NodeTypes.IF_STATEMENT:
                return this.processIf(
                    statement,
                    state,
                    parameters
                );
            case NodeTypes.READ_STATEMENT:
                return [this.withEffect(
                    state,
                    "input"
                )];
            case NodeTypes.WRITE_STATEMENT:
                return [this.withEffect(
                    state,
                    "output"
                )];
            case NodeTypes.FUNCTION_CALL:
                return [this.withEffect(
                    state,
                    "standalone-call"
                )];
            case NodeTypes.WHILE_STATEMENT:
            case NodeTypes.FOR_STATEMENT:
                return [this.withEffect(
                    state,
                    "loop"
                )];
            default:
                return [this.withEffect(
                    state,
                    `unsupported:${statement.type}`
                )];
        }
    }

    processAssignment(
        statement,
        state,
        parameters
    ) {
        if (
            statement.left?.type !==
            NodeTypes.IDENTIFIER
        ) {
            return this.withEffect(
                state,
                "indirect-write"
            );
        }

        const next = this.cloneState(state);
        const name = statement.left.name;

        if (parameters.has(name)) {
            next.effectKinds.add(
                "parameter-write"
            );
        }

        next.resolver.assign(
            name,
            statement.right
        );

        return next;
    }

    processIf(statement, state, parameters) {
        const branches = [
            {
                condition: statement.condition,
                block: statement.thenBlock
            },
            ...(statement.elseIfBranches ?? []).map(
                branch => ({
                    condition: branch.condition,
                    block: branch.block
                })
            ),
            ...(statement.elseBlock == null
                ? []
                : [{
                    condition: null,
                    block: statement.elseBlock
                }])
        ];
        const outputs = [];
        const previousConditions = [];

        for (const branch of branches) {
            const branchState = this.cloneState(state);

            for (const condition of previousConditions) {
                branchState.resolver.assume(
                    condition,
                    false
                );
            }

            if (branch.condition != null) {
                branchState.resolver.assume(
                    branch.condition,
                    true
                );
            }

            if (branchState.resolver.isReachable()) {
                outputs.push(...this.processStatements(
                    branch.block?.statements ?? [],
                    [branchState],
                    parameters
                ));
            }

            if (branch.condition != null) {
                previousConditions.push(
                    branch.condition
                );
            }
        }

        if (statement.elseBlock == null) {
            const fallthrough = this.cloneState(state);

            for (const condition of previousConditions) {
                fallthrough.resolver.assume(
                    condition,
                    false
                );
            }

            if (fallthrough.resolver.isReachable()) {
                outputs.push(fallthrough);
            }
        }

        return outputs;
    }

    cloneState(state) {
        return {
            ...state,
            resolver: state.resolver.clone(),
            effectKinds: new Set(state.effectKinds)
        };
    }

    withEffect(state, effect) {
        const next = this.cloneState(state);
        next.effectKinds.add(effect);

        return next;
    }
}
