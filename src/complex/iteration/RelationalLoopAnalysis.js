import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    simplifyCostExpression
} from "../algebra/CostExpressionSimplifier.js";

export const RelationalLoopKind =
    Object.freeze({
        INTERVAL_HALVING:
            "interval-halving"
    });

/**
 * Reconoce una reducción relacional de intervalo de la forma clásica de
 * búsqueda binaria. El reconocimiento exige un punto medio con piso y dos
 * ramas que descartan, como mínimo, dicho punto. Si alguna parte no puede
 * probarse, devuelve null para que el analizador general conserve O(?).
 */
export function analyzeRelationalLoop(
    node,
    resolver
) {
    const guard = intervalGuard(node?.condition);

    if (guard == null) {
        return null;
    }

    const shape = intervalHalvingShape(
        node.body,
        guard.left,
        guard.right
    );

    if (shape == null) {
        return null;
    }

    const leftStart = resolver.getAbstract(
        guard.left
    ).expression;
    const rightStart = resolver.getAbstract(
        guard.right
    ).expression;
    const initialMeasure = intervalMeasure(
        leftStart,
        rightStart
    );
    const currentMeasure = intervalMeasure(
        Cost.symbol(guard.left),
        Cost.symbol(guard.right)
    );
    const iterations = Cost.maximum([
        Cost.constant(0),
        Cost.call("ceil", [
            Cost.logarithm(
                Cost.sum([
                    initialMeasure,
                    Cost.constant(1)
                ]),
                Cost.constant(2)
            )
        ])
    ]);

    return Object.freeze({
        kind:
            RelationalLoopKind
                .INTERVAL_HALVING,
        left: guard.left,
        right: guard.right,
        midpoint: shape.midpoint,
        operator: guard.operator,
        initialMeasure,
        measure: currentMeasure,
        iterations:
            simplifyCostExpression(
                iterations
            ),
        factor: 1 / 2,
        updates: Object.freeze([
            Object.freeze({
                variables: Object.freeze([
                    guard.left,
                    guard.right
                ]),
                midpoint: shape.midpoint,
                leftOffset: shape.leftOffset,
                rightOffset: shape.rightOffset,
                progression: "interval-halving",
                factor: 1 / 2
            })
        ]),
        assumptions: Object.freeze([
            "Los extremos del intervalo y el punto medio son enteros.",
            "Cada rama descarta el punto medio y conserva, como máximo, la mitad del intervalo."
        ]),
        evidence: Object.freeze([
            `La guarda mantiene el intervalo ${guard.left}..${guard.right}.`,
            `El punto medio ${shape.midpoint} divide el intervalo y las ramas actualizan extremos opuestos.`,
            "La longitud efectiva del intervalo se reduce a lo sumo a la mitad en cada iteración."
        ])
    });
}

function intervalGuard(condition) {
    const expression = unwrapGroup(condition);

    if (
        expression?.type !==
            NodeTypes.BINARY_EXPRESSION ||
        expression.operator !== "<="
    ) {
        return null;
    }

    const left = identifierName(
        unwrapGroup(expression.left)
    );
    const right = identifierName(
        unwrapGroup(expression.right)
    );

    return left == null ||
        right == null ||
        left === right
        ? null
        : {
            left,
            right,
            operator: expression.operator
        };
}

function intervalHalvingShape(
    body,
    left,
    right
) {
    const statements = body?.statements ?? [];
    const branch = statements.find(statement =>
        statement.type ===
        NodeTypes.IF_STATEMENT
    );

    if (
        branch == null ||
        branch.elseIfBranches?.length > 0 ||
        branch.elseBlock == null
    ) {
        return null;
    }

    const midpointAssignment = statements.find(statement =>
        isMidpointAssignment(
            statement,
            left,
            right
        )
    );

    if (midpointAssignment == null) {
        return null;
    }

    const midpoint = midpointAssignment.left.name;
    const branchIndex = statements.indexOf(branch);
    const midpointIndex =
        statements.indexOf(
            midpointAssignment
        );

    if (
        midpointIndex >=
        branchIndex
    ) {
        return null;
    }
    const before = statements.slice(
        0,
        branchIndex
    );

    if (
        statements.some((statement, index) =>
            statement !==
                midpointAssignment &&
            index < branchIndex &&
            writesIdentifier(
                statement,
                midpoint
            )
        )
    ) {
        return null;
    }

    if (
        before.some(statement =>
            writesEndpoint(statement, left, right)
        ) ||
        statements.slice(branchIndex + 1)
        .some(statement =>
            writesEndpoint(statement, left, right)
        )
    ) {
        return null;
    }

    const thenUpdate = endpointUpdate(
        branch.thenBlock,
        left,
        right,
        midpoint
    );
    const elseUpdate = endpointUpdate(
        branch.elseBlock,
        left,
        right,
        midpoint
    );

    if (thenUpdate == null || elseUpdate == null) {
        return null;
    }

    const updates = [thenUpdate, elseUpdate];
    const leftUpdate = updates.find(update =>
        update.endpoint === left
    );
    const rightUpdate = updates.find(update =>
        update.endpoint === right
    );

    if (
        leftUpdate == null ||
        rightUpdate == null ||
        leftUpdate.offset < 1 ||
        rightUpdate.offset > -1
    ) {
        return null;
    }

    return {
        midpoint,
        leftOffset: leftUpdate.offset,
        rightOffset: rightUpdate.offset
    };
}

function isMidpointAssignment(
    statement,
    left,
    right
) {
    return statement?.type ===
        NodeTypes.ASSIGNMENT &&
        identifierName(statement.left) != null &&
        midpointExpression(
            statement.right,
            left,
            right
        );
}

function midpointExpression(expression, left, right) {
    const call = unwrapGroup(expression);

    if (
        call?.type !== NodeTypes.FUNCTION_CALL ||
        call.identifier?.name !== "PISO" ||
        call.arguments?.length !== 1
    ) {
        return false;
    }

    const quotient = unwrapGroup(call.arguments[0]);

    if (
        quotient?.type !==
            NodeTypes.BINARY_EXPRESSION ||
        quotient.operator !== "/" ||
        numericLiteral(quotient.right) !== 2
    ) {
        return false;
    }

    const sum = unwrapGroup(quotient.left);

    if (
        sum?.type !== NodeTypes.BINARY_EXPRESSION ||
        sum.operator !== "+"
    ) {
        return false;
    }

    const names = [
        identifierName(unwrapGroup(sum.left)),
        identifierName(unwrapGroup(sum.right))
    ];

    return names.includes(left) &&
        names.includes(right) &&
        names[0] !== names[1];
}

function endpointUpdate(
    block,
    left,
    right,
    midpoint
) {
    const assignments = (block?.statements ?? [])
        .filter(statement =>
            statement.type ===
                NodeTypes.ASSIGNMENT &&
            [left, right].includes(
                identifierName(statement.left)
            )
        );

    if (assignments.length !== 1) {
        return null;
    }

    const assignment = assignments[0];
    const offset = midpointOffset(
        assignment.right,
        midpoint
    );

    return offset == null
        ? null
        : {
            endpoint: assignment.left.name,
            offset
        };
}

function midpointOffset(expression, midpoint) {
    const value = unwrapGroup(expression);
    const direct = identifierName(value);

    if (direct === midpoint) {
        return 0;
    }

    if (
        value?.type !== NodeTypes.BINARY_EXPRESSION ||
        !["+", "-"].includes(value.operator)
    ) {
        return null;
    }

    const left = identifierName(
        unwrapGroup(value.left)
    );
    const right = numericLiteral(value.right);

    if (left !== midpoint || right == null) {
        return null;
    }

    return value.operator === "+"
        ? right
        : -right;
}

function writesEndpoint(statement, left, right) {
    if (statement?.type ===
        NodeTypes.ASSIGNMENT &&
        [left, right].includes(
            identifierName(statement.left)
        )) {
        return true;
    }

    if (
        statement == null ||
        typeof statement !== "object" ||
        statement.type ===
            NodeTypes.FUNCTION_DECLARATION
    ) {
        return false;
    }

    return Object.entries(statement)
        .some(([key, value]) => {
            if (key === "location" || key === "type") {
                return false;
            }

            return Array.isArray(value)
                ? value.some(item =>
                    writesEndpoint(item, left, right)
                )
                : writesEndpoint(value, left, right);
        });
}

function writesIdentifier(statement, name) {
    if (
        statement?.type ===
            NodeTypes.ASSIGNMENT &&
        identifierName(statement.left) === name
    ) {
        return true;
    }

    if (
        statement == null ||
        typeof statement !== "object" ||
        statement.type ===
            NodeTypes.FUNCTION_DECLARATION
    ) {
        return false;
    }

    return Object.entries(statement)
        .some(([key, value]) => {
            if (key === "location" || key === "type") {
                return false;
            }

            return Array.isArray(value)
                ? value.some(item =>
                    writesIdentifier(
                        item,
                        name
                    )
                )
                : writesIdentifier(
                    value,
                    name
                );
        });
}

function intervalMeasure(left, right) {
    const distance = shiftCostExpression(
        simplifyCostExpression(
            Cost.difference(right, left)
        ),
        1
    );

    return simplifyCostExpression(
        Cost.maximum([
            Cost.constant(0),
            distance
        ])
    );
}

function shiftCostExpression(expression, amount) {
    if (expression.kind === "constant") {
        return Cost.constant(expression.value + amount);
    }

    if (
        expression.kind === "difference" &&
        expression.right.kind === "constant"
    ) {
        const remainder = expression.right.value - amount;

        return remainder === 0
            ? expression.left
            : Cost.difference(
                expression.left,
                Cost.constant(remainder)
            );
    }

    return Cost.sum([
        expression,
        Cost.constant(amount)
    ]);
}

function numericLiteral(node) {
    const expression = unwrapGroup(node);

    if (
        expression?.type !==
            NodeTypes.NUMBER_LITERAL &&
        expression?.type !==
            NodeTypes.SCIENTIFIC_LITERAL
    ) {
        return null;
    }

    const value = Number(expression.value);

    return Number.isFinite(value)
        ? value
        : null;
}

function identifierName(node) {
    return node?.type === NodeTypes.IDENTIFIER
        ? node.name
        : null;
}

function unwrapGroup(node) {
    let current = node;

    while (
        current?.type ===
        NodeTypes.GROUP_EXPRESSION
    ) {
        current = current.expression;
    }

    return current;
}
