import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    simplifyCostExpression
} from "../algebra/CostExpressionSimplifier.js";

export const NonlinearLoopKind =
    Object.freeze({
        POLYNOMIAL_GUARD:
            "polynomial-guard",
        POWER_UPDATE:
            "power-update"
    });

/**
 * Reconoce dos familias no lineales con una prueba local completa:
 *  - i^k < límite con un incremento aditivo positivo de i;
 *  - i = i^k con i inicial mayor que uno y un límite superior fijo.
 *
 * El análisis no intenta extrapolar a expresiones polinómicas arbitrarias ni
 * a actualizaciones condicionales: esas formas vuelven al analizador general.
 */
export function analyzeNonlinearLoop(
    node,
    resolver
) {
    const polynomial = polynomialGuard(
        node?.condition
    );

    if (polynomial != null) {
        const update = directControlUpdate(
            node.body,
            polynomial.variable
        );

        if (
            update?.kind === "additive" &&
            update.amount > 0
        ) {
            return analyzePolynomialGuard(
                polynomial,
                update,
                resolver
            );
        }
    }

    const direct = directGuard(node?.condition);

    if (direct != null) {
        const update = directControlUpdate(
            node.body,
            direct.variable
        );

        if (update?.kind === "power") {
            return analyzePowerUpdate(
                direct,
                update,
                resolver
            );
        }
    }

    return null;
}

function analyzePolynomialGuard(
    guard,
    update,
    resolver
) {
    const start = numericValue(
        resolver.getAbstract(guard.variable)
            .expression
    );

    if (start == null || start < 0) {
        return null;
    }

    const bound = resolver.resolveAbstract(
        guard.bound
    ).expression;
    const root = Cost.power(
        bound,
        Cost.constant(1 / guard.degree)
    );
    const distance = Cost.quotient(
        Cost.difference(
            root,
            Cost.constant(start)
        ),
        Cost.constant(update.amount)
    );
    const iterations = guard.operator === "<"
        ? Cost.call("ceil", [distance])
        : Cost.sum([
            Cost.call("floor", [distance]),
            Cost.constant(1)
        ]);
    const measure = Cost.maximum([
        Cost.constant(0),
        Cost.difference(
            root,
            Cost.symbol(guard.variable)
        )
    ]);

    return createNonlinearAnalysis({
        kind:
            NonlinearLoopKind
                .POLYNOMIAL_GUARD,
        variable: guard.variable,
        operator: guard.operator,
        degree: guard.degree,
        start: Cost.constant(start),
        bound,
        iterations: Cost.maximum([
            Cost.constant(0),
            iterations
        ]),
        measure,
        update: Object.freeze({
            progression: "additive",
            amount: update.amount
        }),
        assumptions: [
            "La variable de control inicia en un valor no negativo.",
            "La guarda polinómica es monótona en el dominio no negativo.",
            "El límite de la guarda es no negativo."
        ],
        evidence: [
            `La guarda equivale a ${guard.variable} < límite^(1/${guard.degree}) en el dominio no negativo.`,
            `Cada iteración incrementa ${guard.variable} en ${update.amount}.`
        ]
    });
}

function analyzePowerUpdate(
    guard,
    update,
    resolver
) {
    if (
        guard.operator !== "<" &&
        guard.operator !== "<="
    ) {
        return null;
    }

    const start = numericValue(
        resolver.getAbstract(guard.variable)
            .expression
    );

    if (start == null || start <= 1) {
        return null;
    }

    const bound = resolver.resolveAbstract(
        guard.bound
    ).expression;
    const firstLog = Cost.logarithm(
        bound,
        Cost.constant(start)
    );
    const logarithm = Cost.logarithm(
        firstLog,
        Cost.constant(update.degree)
    );
    const iterations = guard.operator === "<"
        ? Cost.call("ceil", [logarithm])
        : Cost.sum([
            Cost.call("floor", [logarithm]),
            Cost.constant(1)
        ]);

    return createNonlinearAnalysis({
        kind:
            NonlinearLoopKind
                .POWER_UPDATE,
        variable: guard.variable,
        operator: guard.operator,
        degree: update.degree,
        start: Cost.constant(start),
        bound,
        iterations: Cost.maximum([
            Cost.constant(0),
            iterations
        ]),
        measure: null,
        update: Object.freeze({
            progression: "exponential",
            degree: update.degree
        }),
        assumptions: [
            "La variable de control inicia en un valor mayor que uno.",
            "El límite superior es positivo."
        ],
        evidence: [
            `Cada iteración eleva ${guard.variable} a la potencia ${update.degree}.`,
            "Dos logaritmos con bases constantes acotan el número de iteraciones."
        ]
    });
}

function createNonlinearAnalysis({
    iterations,
    assumptions,
    evidence,
    ...details
}) {
    return Object.freeze({
        ...details,
        iterations:
            simplifyCostExpression(
                iterations
            ),
        assumptions:
            Object.freeze([...assumptions]),
        evidence:
            Object.freeze([...evidence])
    });
}

function polynomialGuard(condition) {
    const normalized = normalizedComparison(condition);

    if (
        normalized == null ||
        !["<", "<="].includes(
            normalized.operator
        )
    ) {
        return null;
    }

    const power = polynomialPower(
        normalized.left
    );

    return power == null ||
        containsIdentifier(
            normalized.right,
            power.variable
        )
        ? null
        : {
            variable: power.variable,
            degree: power.degree,
            operator: normalized.operator,
            bound: normalized.right
        };
}

function polynomialPower(expression) {
    const value = unwrapGroup(expression);

    if (
        value?.type ===
            NodeTypes.BINARY_EXPRESSION &&
        value.operator === "^"
    ) {
        const variable = identifierName(
            unwrapGroup(value.left)
        );
        const degree = positiveIntegerLiteral(value.right);

        return variable == null || degree == null || degree < 2
            ? null
            : { variable, degree };
    }

    const factors = multiplicationFactors(value);

    if (factors == null || factors.length < 2) {
        return null;
    }

    const names = factors.map(factor =>
        identifierName(unwrapGroup(factor))
    );
    const variable = names[0] ?? null;

    return variable == null ||
        names.some(name => name !== variable)
        ? null
        : {
            variable,
            degree: names.length
        };
}

function multiplicationFactors(expression) {
    const value = unwrapGroup(expression);

    if (
        value?.type !==
            NodeTypes.BINARY_EXPRESSION ||
        value.operator !== "*"
    ) {
        return null;
    }

    return [
        ...multiplicationFactorList(value.left),
        ...multiplicationFactorList(value.right)
    ];
}

function multiplicationFactorList(expression) {
    const value = unwrapGroup(expression);

    return value?.type ===
        NodeTypes.BINARY_EXPRESSION &&
        value.operator === "*"
        ? [
            ...multiplicationFactorList(value.left),
            ...multiplicationFactorList(value.right)
        ]
        : [value];
}

function directGuard(condition) {
    const normalized = normalizedComparison(condition);

    if (normalized == null) {
        return null;
    }

    const variable = identifierName(
        unwrapGroup(normalized.left)
    );

    return variable == null ||
        containsIdentifier(
            normalized.right,
            variable
        )
        ? null
        : {
            variable,
            operator: normalized.operator,
            bound: normalized.right
        };
}

function normalizedComparison(condition) {
    const expression = unwrapGroup(condition);

    if (
        expression?.type !==
            NodeTypes.BINARY_EXPRESSION ||
        !["<", "<=", ">", ">="].includes(
            expression.operator
        )
    ) {
        return null;
    }

    const left = unwrapGroup(expression.left);
    const right = unwrapGroup(expression.right);

    return {
        left,
        right,
        operator: expression.operator
    };
}

function directControlUpdate(body, variable) {
    const statements = body?.statements ?? [];
    const assignments = statements.filter(statement =>
        statement.type === NodeTypes.ASSIGNMENT &&
        identifierName(statement.left) === variable
    );

    if (
        assignments.length !== 1 ||
        statements.some(statement =>
            statement !== assignments[0] &&
            writesIdentifier(statement, variable)
        )
    ) {
        return null;
    }

    return parseDirectUpdate(
        assignments[0].right,
        variable
    );
}

function parseDirectUpdate(expression, variable) {
    const value = unwrapGroup(expression);

    if (
        value?.type !==
            NodeTypes.BINARY_EXPRESSION
    ) {
        return null;
    }

    if (value.operator === "^") {
        return identifierName(
            unwrapGroup(value.left)
        ) !== variable
            ? null
            : (() => {
                const degree = positiveIntegerLiteral(
                    value.right
                );

                return degree == null || degree < 2
                    ? null
                    : {
                        kind: "power",
                        degree
                    };
            })();
    }

    const left = identifierName(
        unwrapGroup(value.left)
    );
    const right = numericLiteral(value.right);

    if (
        value.operator === "+" &&
        left === variable &&
        right != null
    ) {
        return {
            kind: "additive",
            amount: right
        };
    }

    if (
        value.operator === "-" &&
        left === variable &&
        right != null
    ) {
        return {
            kind: "additive",
            amount: -right
        };
    }

    return null;
}

function writesIdentifier(node, name) {
    if (
        node == null ||
        typeof node !== "object" ||
        node.type === NodeTypes.FUNCTION_DECLARATION
    ) {
        return false;
    }

    if (
        node.type === NodeTypes.ASSIGNMENT &&
        identifierName(node.left) === name
    ) {
        return true;
    }

    return Object.entries(node)
        .some(([key, value]) => {
            if (key === "location" || key === "type") {
                return false;
            }

            return Array.isArray(value)
                ? value.some(item =>
                    writesIdentifier(item, name)
                )
                : writesIdentifier(value, name);
        });
}

function containsIdentifier(node, name) {
    if (identifierName(node) === name) {
        return true;
    }

    if (node == null || typeof node !== "object") {
        return false;
    }

    return Object.entries(node)
        .some(([key, value]) => {
            if (key === "location" || key === "type") {
                return false;
            }

            return Array.isArray(value)
                ? value.some(item =>
                    containsIdentifier(item, name)
                )
                : containsIdentifier(value, name);
        });
}

function positiveIntegerLiteral(node) {
    const value = numericLiteral(node);

    return value != null &&
        Number.isInteger(value) &&
        value > 0
        ? value
        : null;
}

function numericLiteral(node) {
    const value = unwrapGroup(node);

    if (
        value?.type !== NodeTypes.NUMBER_LITERAL &&
        value?.type !== NodeTypes.SCIENTIFIC_LITERAL
    ) {
        return null;
    }

    const number = Number(value.value);

    return Number.isFinite(number)
        ? number
        : null;
}

function numericValue(expression) {
    const simplified = simplifyCostExpression(
        expression
    );

    return simplified.kind === "constant"
        ? simplified.value
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
