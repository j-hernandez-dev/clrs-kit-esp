import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    createExecutionCoveragePoint,
    ExecutionCoverageKind
} from "../../runtime/ExecutionCoverageEvent.js";

const STATEMENT_TYPES = new Set([
    NodeTypes.ASSIGNMENT,
    NodeTypes.FUNCTION_CALL,
    NodeTypes.WRITE_STATEMENT,
    NodeTypes.READ_STATEMENT,
    NodeTypes.RETURN_STATEMENT
]);

/**
 * Enumera los puntos que el emisor JavaScript instrumentará. El catálogo es
 * estático: permite reconocer también instrucciones, funciones y resultados
 * de control que una prueba concreta nunca visitó.
 */
export function collectRuntimeCoveragePoints(ast) {
    if (ast?.type !== NodeTypes.PROGRAM) {
        return Object.freeze([]);
    }

    const points = new Map();

    collectStatements(
        ast.statements ?? [],
        points
    );

    return Object.freeze(
        [...points.values()]
    );
}

function collectStatements(statements, points) {
    for (const statement of statements ?? []) {
        if (statement == null) {
            continue;
        }

        if (STATEMENT_TYPES.has(statement.type)) {
            addPoint(
                points,
                ExecutionCoverageKind.STATEMENT,
                statement.location
            );
            continue;
        }

        switch (statement.type) {
            case NodeTypes.FUNCTION_DECLARATION:
                addPoint(
                    points,
                    ExecutionCoverageKind.FUNCTION,
                    statement.location,
                    {
                        name:
                            statement.identifier?.name
                    }
                );
                collectStatements(
                    statement.body?.statements,
                    points
                );
                break;

            case NodeTypes.IF_STATEMENT:
                addPoint(
                    points,
                    ExecutionCoverageKind.BRANCH,
                    statement.condition?.location ??
                        statement.location
                );
                collectStatements(
                    statement.thenBlock?.statements,
                    points
                );

                for (
                    const branch of
                    statement.elseIfBranches ?? []
                ) {
                    addPoint(
                        points,
                        ExecutionCoverageKind.BRANCH,
                        branch.condition?.location ??
                            branch.location ??
                            statement.location
                    );
                    collectStatements(
                        branch.block?.statements,
                        points
                    );
                }

                collectStatements(
                    statement.elseBlock?.statements,
                    points
                );
                break;

            case NodeTypes.WHILE_STATEMENT:
                addPoint(
                    points,
                    ExecutionCoverageKind.LOOP,
                    statement.condition?.location ??
                        statement.location
                );
                collectStatements(
                    statement.body?.statements,
                    points
                );
                break;

            case NodeTypes.FOR_STATEMENT:
                addPoint(
                    points,
                    ExecutionCoverageKind.STATEMENT,
                    statement.initializer?.location ??
                        statement.location
                );
                addPoint(
                    points,
                    ExecutionCoverageKind.LOOP,
                    statement.condition?.location ??
                        statement.location
                );
                collectStatements(
                    statement.body?.statements,
                    points
                );
                break;
        }
    }
}

function addPoint(
    points,
    kind,
    location,
    options = {}
) {
    const point = createExecutionCoveragePoint(
        kind,
        location,
        options
    );

    if (point != null) {
        points.set(point.pointId, point);
    }
}
