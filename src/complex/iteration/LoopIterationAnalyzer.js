import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    CostExpressionKind
} from "../algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    simplifyCostExpression
} from "../algebra/CostExpressionSimplifier.js";
import {
    createIterationAnalysis,
    IterationAnalysisKind,
    IterationProgression
} from "./IterationAnalysis.js";
import {
    StandardLibrarySymbolicEffect,
    getStandardLibraryDefinition
} from "../../standard-library/StandardLibraryCatalog.js";

const COMPARISON_INVERSE =
    Object.freeze({
        "<": ">",
        "<=": ">=",
        ">": "<",
        ">=": "<="
    });

export class LoopIterationAnalyzer {

    analyzeFor(node, resolver) {
        const variable =
            identifierName(
                node.initializer?.left
            );

        if (variable == null) {
            return this.unknown(
                node,
                "CLRS_ITERATION_INITIALIZER_UNSUPPORTED",
                "No se pudo identificar la variable de control del ciclo."
            );
        }

        const condition =
            this.normalizeCondition(
                node.condition,
                variable
            );

        if (condition == null) {
            return this.unknown(
                node,
                "CLRS_ITERATION_CONDITION_UNSUPPORTED",
                "La condición del ciclo no tiene una comparación reconocible."
            );
        }

        const incrementVariable =
            identifierName(
                node.increment?.left
            );

        if (incrementVariable !== variable) {
            return this.unknown(
                node,
                "CLRS_ITERATION_INCREMENT_MISMATCH",
                "El incremento no modifica la variable de control."
            );
        }

        const bodyWrites =
            collectWrittenNames(
                node.body
            );

        if (bodyWrites.has(variable)) {
            return this.unknown(
                node,
                "CLRS_ITERATION_CONTROL_VARIABLE_MUTATED",
                "El cuerpo modifica la variable de control del ciclo."
            );
        }

        if (
            this.boundChanges(
                condition.bound,
                bodyWrites
            )
        ) {
            return this.unknown(
                node,
                "CLRS_ITERATION_BOUND_MUTATED",
                "El límite del ciclo cambia durante la iteración."
            );
        }

        const update =
            this.parseUpdate(
                node.increment.right,
                variable,
                resolver,
                condition
            );

        return this.analyzeProgression({
            node,
            variable,
            condition,
            update,
            start:
                resolver.resolve(
                    node.initializer.right
                ),
            bound:
                resolver.resolve(
                    condition.bound
                )
        });
    }

    analyzeWhile(node, resolver) {
        const candidate =
            this.findWhileControl(
                node,
                resolver
            );

        if (candidate == null) {
            return this.unknown(
                node,
                "CLRS_ITERATION_UPDATE_NOT_FOUND",
                "No se encontró una actualización incondicional para la variable de control."
            );
        }

        const {
            variable,
            assignment,
            condition,
            update
        } = candidate;

        const bodyWrites =
            collectWrittenNames(
                node.body
            );

        if (
            this.boundChanges(
                condition.bound,
                bodyWrites,
                variable
            )
        ) {
            return this.unknown(
                node,
                "CLRS_ITERATION_BOUND_MUTATED",
                "El límite del ciclo cambia durante la iteración."
            );
        }

        if (
            this.updateChanges(
                assignment.right,
                bodyWrites,
                variable
            )
        ) {
            return this.unknown(
                node,
                "CLRS_ITERATION_STEP_MUTATED",
                "El valor utilizado para actualizar la variable de control cambia dentro del ciclo.",
                variable
            );
        }

        return this.analyzeProgression({
            node,
            variable,
            condition,
            update,
            start:
                resolver.get(variable),
            bound:
                resolver.resolve(
                    condition.bound
                )
        });
    }

    findWhileControl(node, resolver) {
        const conditionVariables =
            collectIdentifierNames(
                node.condition
            );
        const directAssignments =
            (node.body?.statements ?? [])
                .filter(statement =>
                    statement.type ===
                        NodeTypes.ASSIGNMENT &&
                    identifierName(
                        statement.left
                    ) != null
                );
        const nestedWrites =
            collectNestedWrittenNames(
                node.body
            );
        const candidates =
            directAssignments.filter(
                assignment => {
                    const name =
                        identifierName(
                            assignment.left
                        );

                    return (
                        conditionVariables
                            .has(name) &&
                        !nestedWrites.has(name)
                    );
                }
            );
        const analyzed =
            candidates.flatMap(
                assignment => {
                    const variable =
                        identifierName(
                            assignment.left
                        );
                    const condition =
                        this.normalizeCondition(
                            node.condition,
                            variable
                        );
                    const update =
                        this.parseUpdate(
                            assignment.right,
                            variable,
                            resolver,
                            condition
                        );
                    const writesToVariable =
                        directAssignments.filter(
                            item =>
                                identifierName(
                                    item.left
                                ) === variable
                        );

                    if (
                        condition == null ||
                        update == null ||
                        writesToVariable
                            .length !== 1
                    ) {
                        return [];
                    }

                    return [{
                        variable,
                        assignment,
                        condition,
                        update
                    }];
                }
            );

        if (analyzed.length === 1) {
            return analyzed[0];
        }

        const matching =
            analyzed.filter(candidate =>
                progressionMatches(
                    candidate.condition
                        .operator,
                    candidate.update
                )
            );

        return matching.length === 1
            ? matching[0]
            : null;
    }

    normalizeCondition(
        condition,
        variable
    ) {
        const expression =
            unwrapGroup(condition);

        if (
            expression?.type !==
                NodeTypes.BINARY_EXPRESSION ||
            !Object.hasOwn(
                COMPARISON_INVERSE,
                expression.operator
            )
        ) {
            return null;
        }

        const leftIsControl =
            identifierName(
                unwrapGroup(
                    expression.left
                )
            ) === variable;
        const rightIsControl =
            identifierName(
                unwrapGroup(
                    expression.right
                )
            ) === variable;

        if (
            leftIsControl ===
            rightIsControl
        ) {
            return null;
        }

        const bound =
            leftIsControl
                ? expression.right
                : expression.left;

        if (
            collectIdentifierNames(
                bound
            ).has(variable)
        ) {
            return null;
        }

        return {
            operator:
                leftIsControl
                    ? expression.operator
                    : COMPARISON_INVERSE[
                        expression.operator
                    ],
            bound
        };
    }

    parseUpdate(
        expression,
        variable,
        resolver,
        condition = null
    ) {
        const normalized =
            unwrapStandardUpdate(
                expression
            );
        const update =
            normalized.expression;

        if (
            update?.type !==
            NodeTypes.BINARY_EXPRESSION
        ) {
            return null;
        }

        const leftIsControl =
            identifierName(
                unwrapGroup(
                    update.left
                )
            ) === variable;
        const rightIsControl =
            identifierName(
                unwrapGroup(
                    update.right
                )
            ) === variable;

        if (
            leftIsControl ===
            rightIsControl
        ) {
            return null;
        }

        const operandNode =
            leftIsControl
                ? update.right
                : update.left;
        const operand =
            numericValue(
                resolver.resolve(
                    operandNode
                )
            );

        if (
            operand == null ||
            !Number.isFinite(operand)
        ) {
            return null;
        }

        let parsed = null;

        if (update.operator === "+") {
            parsed = additiveUpdate(
                operand
            );
        }

        if (
            parsed == null &&
            update.operator === "-" &&
            leftIsControl
        ) {
            parsed = additiveUpdate(
                -operand
            );
        }

        if (update.operator === "*") {
            parsed = multiplicativeUpdate(
                operand
            );
        }

        if (
            parsed == null &&
            update.operator === "/" &&
            leftIsControl &&
            operand !== 0
        ) {
            parsed = multiplicativeUpdate(
                1 / operand
            );
        }

        if (
            parsed == null ||
            (
                normalized.absolute &&
                !absoluteUpdateIsSafe(
                    parsed,
                    condition,
                    resolver
                )
            )
        ) {
            return null;
        }

        return parsed;
    }

    analyzeProgression({
        node,
        variable,
        condition,
        update,
        start,
        bound
    }) {
        if (update == null) {
            return this.unknown(
                node,
                "CLRS_ITERATION_UPDATE_UNSUPPORTED",
                "La actualización del ciclo no es una progresión constante reconocible.",
                variable
            );
        }

        if (
            containsUnknown(start) ||
            containsUnknown(bound)
        ) {
            return this.unknown(
                node,
                "CLRS_ITERATION_VALUE_UNRESOLVED",
                "No se pudieron resolver los valores inicial y límite del ciclo.",
                variable
            );
        }

        if (
            update.progression ===
            IterationProgression.ADDITIVE
        ) {
            return this.analyzeAdditive({
                node,
                variable,
                condition,
                update,
                start,
                bound
            });
        }

        return this.analyzeMultiplicative({
            node,
            variable,
            condition,
            update,
            start,
            bound
        });
    }

    analyzeAdditive({
        node,
        variable,
        condition,
        update,
        start,
        bound
    }) {
        const ascending =
            update.amount > 0;
        const validOperator =
            ascending
                ? (
                    condition.operator ===
                        "<" ||
                    condition.operator ===
                        "<="
                )
                : (
                    condition.operator ===
                        ">" ||
                    condition.operator ===
                        ">="
                );

        if (!validOperator) {
            return this.unknown(
                node,
                "CLRS_ITERATION_DIRECTION_MISMATCH",
                "La actualización se aleja del límite y no garantiza la terminación.",
                variable
            );
        }

        const numericStart =
            numericValue(start);
        const numericBound =
            numericValue(bound);

        if (
            numericStart != null &&
            numericBound != null
        ) {
            return this.result({
                node,
                variable,
                progression:
                    IterationProgression.ADDITIVE,
                iterations:
                    Cost.constant(
                        additiveIterationCount(
                            numericStart,
                            numericBound,
                            condition.operator,
                            update.amount
                        )
                    ),
                exact: true
            });
        }

        const distance =
            simplifyCostExpression(
                ascending
                    ? Cost.difference(
                        bound,
                        start
                    )
                    : Cost.difference(
                        start,
                        bound
                    )
            );
        const step =
            Math.abs(
                update.amount
            );
        const inclusive =
            condition.operator === "<=" ||
            condition.operator === ">=";
        let iterations;

        if (step === 1) {
            iterations =
                inclusive
                    ? shiftExpression(
                        distance,
                        1
                    )
                    : distance;
        } else {
            const quotient =
                Cost.quotient(
                    distance,
                    Cost.constant(step)
                );

            iterations =
                inclusive
                    ? shiftExpression(
                        Cost.call(
                            "floor",
                            [quotient]
                        ),
                        1
                    )
                    : Cost.call(
                        "ceil",
                        [quotient]
                    );
        }

        return this.result({
            node,
            variable,
            progression:
                IterationProgression.ADDITIVE,
            iterations:
                Cost.maximum([
                    Cost.constant(0),
                    simplifyCostExpression(
                        iterations
                    )
                ]),
            exact: false,
            assumptions: [
                "La variable de control y el límite toman valores enteros."
            ]
        });
    }

    analyzeMultiplicative({
        node,
        variable,
        condition,
        update,
        start,
        bound
    }) {
        const ascending =
            update.factor > 1;
        const descending =
            update.factor > 0 &&
            update.factor < 1;
        const validOperator =
            (
                ascending &&
                (
                    condition.operator === "<" ||
                    condition.operator === "<="
                )
            ) ||
            (
                descending &&
                (
                    condition.operator === ">" ||
                    condition.operator === ">="
                )
            );

        if (!validOperator) {
            return this.unknown(
                node,
                "CLRS_ITERATION_DIRECTION_MISMATCH",
                "La progresión multiplicativa no garantiza alcanzar el límite.",
                variable
            );
        }

        const numericStart =
            numericValue(start);
        const numericBound =
            numericValue(bound);

        if (
            (
                numericStart != null &&
                numericStart <= 0
            ) ||
            (
                numericBound != null &&
                numericBound <= 0
            )
        ) {
            return this.unknown(
                node,
                "CLRS_ITERATION_NON_TERMINATING",
                "Una progresión multiplicativa requiere valores inicial y límite positivos.",
                variable
            );
        }

        if (
            numericStart != null &&
            numericBound != null
        ) {
            const iterations =
                multiplicativeIterationCount(
                    numericStart,
                    numericBound,
                    condition.operator,
                    update.factor
                );

            if (iterations == null) {
                return this.unknown(
                    node,
                    "CLRS_ITERATION_NON_TERMINATING",
                    "Los valores del ciclo no garantizan una progresión multiplicativa finita.",
                    variable
                );
            }

            return this.result({
                node,
                variable,
                progression:
                    IterationProgression.MULTIPLICATIVE,
                iterations:
                    Cost.constant(
                        iterations
                    ),
                exact: true
            });
        }

        const base =
            ascending
                ? update.factor
                : 1 / update.factor;
        const ratio =
            simplifyCostExpression(
                Cost.quotient(
                    ascending
                        ? bound
                        : start,
                    ascending
                        ? start
                        : bound
                )
            );
        const logarithm =
            Cost.logarithm(
                ratio,
                Cost.constant(base)
            );
        const inclusive =
            condition.operator === "<=" ||
            condition.operator === ">=";
        const iterations =
            inclusive
                ? shiftExpression(
                    Cost.call(
                        "floor",
                        [logarithm]
                    ),
                    1
                )
                : Cost.call(
                    "ceil",
                    [logarithm]
                );

        return this.result({
            node,
            variable,
            progression:
                IterationProgression.MULTIPLICATIVE,
            iterations:
                Cost.maximum([
                    Cost.constant(0),
                    iterations
                ]),
            exact: false,
            assumptions: [
                "Los valores inicial y límite son positivos."
            ]
        });
    }

    boundChanges(
        bound,
        writtenNames,
        ignoredName = null
    ) {
        for (
            const name
            of collectIdentifierNames(bound)
        ) {
            if (
                name !== ignoredName &&
                writtenNames.has(name)
            ) {
                return true;
            }
        }

        return false;
    }

    updateChanges(
        update,
        writtenNames,
        variable
    ) {
        for (
            const name
            of collectIdentifierNames(
                update
            )
        ) {
            if (
                name !== variable &&
                writtenNames.has(name)
            ) {
                return true;
            }
        }

        return false;
    }

    result({
        node,
        variable,
        progression,
        iterations,
        exact,
        assumptions = []
    }) {
        const simplified =
            simplifyCostExpression(
                iterations
            );

        return createIterationAnalysis({
            kind:
                numericValue(simplified) == null
                    ? (
                        progression ===
                            IterationProgression
                                .MULTIPLICATIVE
                            ? IterationAnalysisKind
                                .LOGARITHMIC
                            : IterationAnalysisKind
                                .SYMBOLIC
                    )
                    : IterationAnalysisKind
                        .CONSTANT,
            progression,
            iterations: simplified,
            variable,
            exact,
            assumptions,
            location: node.location
        });
    }

    unknown(
        node,
        code,
        message,
        variable = null
    ) {
        return createIterationAnalysis({
            kind:
                IterationAnalysisKind.UNKNOWN,
            progression:
                IterationProgression.UNKNOWN,
            iterations:
                Cost.unknown(),
            variable,
            exact: false,
            code,
            message,
            location: node.location
        });
    }
}

function additiveUpdate(amount) {
    if (
        amount === 0 ||
        !Number.isFinite(amount)
    ) {
        return null;
    }

    return {
        progression:
            IterationProgression.ADDITIVE,
        amount
    };
}

function multiplicativeUpdate(factor) {
    if (
        factor <= 0 ||
        factor === 1 ||
        !Number.isFinite(factor)
    ) {
        return null;
    }

    return {
        progression:
            IterationProgression
                .MULTIPLICATIVE,
        factor
    };
}

function progressionMatches(
    operator,
    update
) {
    if (
        update.progression ===
        IterationProgression.ADDITIVE
    ) {
        return (
            (
                update.amount > 0 &&
                (
                    operator === "<" ||
                    operator === "<="
                )
            ) ||
            (
                update.amount < 0 &&
                (
                    operator === ">" ||
                    operator === ">="
                )
            )
        );
    }

    return (
        (
            update.factor > 1 &&
            (
                operator === "<" ||
                operator === "<="
            )
        ) ||
        (
            update.factor > 0 &&
            update.factor < 1 &&
            (
                operator === ">" ||
                operator === ">="
            )
        )
    );
}

function additiveIterationCount(
    start,
    bound,
    operator,
    amount
) {
    const distance =
        amount > 0
            ? bound - start
            : start - bound;
    const step =
        Math.abs(amount);
    const inclusive =
        operator === "<=" ||
        operator === ">=";

    return Math.max(
        0,
        inclusive
            ? Math.floor(
                distance / step
            ) + 1
            : Math.ceil(
                distance / step
            )
    );
}

function multiplicativeIterationCount(
    start,
    bound,
    operator,
    factor
) {
    if (
        start <= 0 ||
        bound <= 0
    ) {
        return null;
    }

    const condition = value => {
        switch (operator) {
            case "<":
                return value < bound;
            case "<=":
                return value <= bound;
            case ">":
                return value > bound;
            case ">=":
                return value >= bound;
            default:
                return false;
        }
    };
    let value = start;
    let iterations = 0;

    while (condition(value)) {
        value *= factor;
        iterations++;

        if (
            iterations > 100000 ||
            value === start ||
            !Number.isFinite(value)
        ) {
            return null;
        }
    }

    return iterations;
}

function shiftExpression(
    expression,
    amount
) {
    const simplified =
        simplifyCostExpression(
            expression
        );

    if (
        simplified.kind ===
        CostExpressionKind.CONSTANT
    ) {
        return Cost.constant(
            simplified.value +
            amount
        );
    }

    if (
        simplified.kind ===
            CostExpressionKind.DIFFERENCE &&
        simplified.right.kind ===
            CostExpressionKind.CONSTANT
    ) {
        const remainder =
            simplified.right.value -
            amount;

        if (remainder === 0) {
            return simplified.left;
        }

        if (remainder > 0) {
            return Cost.difference(
                simplified.left,
                Cost.constant(
                    remainder
                )
            );
        }

        return Cost.sum([
            simplified.left,
            Cost.constant(
                -remainder
            )
        ]);
    }

    return simplifyCostExpression(
        Cost.sum([
            simplified,
            Cost.constant(amount)
        ])
    );
}

function numericValue(expression) {
    const simplified =
        simplifyCostExpression(
            expression
        );

    return (
        simplified.kind ===
            CostExpressionKind.CONSTANT
            ? simplified.value
            : null
    );
}

function containsUnknown(expression) {
    if (
        expression.kind ===
        CostExpressionKind.UNKNOWN
    ) {
        return true;
    }

    for (
        const value
        of Object.values(expression)
    ) {
        if (
            Array.isArray(value) &&
            value.some(item =>
                item != null &&
                typeof item === "object" &&
                containsUnknown(item)
            )
        ) {
            return true;
        }

        if (
            value != null &&
            typeof value === "object" &&
            typeof value.kind === "string" &&
            containsUnknown(value)
        ) {
            return true;
        }
    }

    return false;
}

function identifierName(node) {
    return (
        node?.type ===
            NodeTypes.IDENTIFIER
            ? node.name
            : null
    );
}

function unwrapStandardUpdate(node) {
    let expression =
        unwrapGroup(node);
    let absolute = false;

    while (
        expression?.type ===
            NodeTypes.FUNCTION_CALL &&
        expression.arguments?.length === 1
    ) {
        const definition =
            getStandardLibraryDefinition(
                expression.identifier
                    ?.name
            );
        const effect =
            definition
                ?.symbolicEffect.kind;

        if (
            effect !==
                StandardLibrarySymbolicEffect
                    .ROUNDING &&
            effect !==
                StandardLibrarySymbolicEffect
                    .ABSOLUTE
        ) {
            break;
        }

        absolute =
            absolute ||
            effect ===
                StandardLibrarySymbolicEffect
                    .ABSOLUTE;
        expression =
            unwrapGroup(
                expression.arguments[0]
            );
    }

    return {
        expression,
        absolute
    };
}

function absoluteUpdateIsSafe(
    update,
    condition,
    resolver
) {
    if (
        condition == null ||
        (
            condition.operator !== ">" &&
            condition.operator !== ">="
        )
    ) {
        return false;
    }

    const bound =
        numericValue(
            resolver.resolve(
                condition.bound
            )
        );

    if (
        bound == null ||
        bound < 0
    ) {
        return false;
    }

    if (
        update.progression ===
        IterationProgression
            .MULTIPLICATIVE
    ) {
        return (
            update.factor > 0 &&
            update.factor < 1
        );
    }

    return (
        update.progression ===
            IterationProgression
                .ADDITIVE &&
        update.amount < 0 &&
        bound >=
            Math.abs(
                update.amount
            )
    );
}

function unwrapGroup(node) {
    let current = node;

    while (
        current?.type ===
        NodeTypes.GROUP_EXPRESSION
    ) {
        current =
            current.expression;
    }

    return current;
}

export function collectIdentifierNames(
    node,
    names = new Set()
) {
    if (
        node == null ||
        typeof node !== "object"
    ) {
        return names;
    }

    if (
        node.type ===
        NodeTypes.IDENTIFIER
    ) {
        names.add(node.name);
        return names;
    }

    for (
        const [key, value]
        of Object.entries(node)
    ) {
        if (
            key === "location" ||
            key === "type"
        ) {
            continue;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                collectIdentifierNames(
                    item,
                    names
                );
            }
        } else {
            collectIdentifierNames(
                value,
                names
            );
        }
    }

    return names;
}

export function collectWrittenNames(
    node,
    names = new Set()
) {
    if (
        node == null ||
        typeof node !== "object"
    ) {
        return names;
    }

    if (
        node.type ===
        NodeTypes.FUNCTION_DECLARATION
    ) {
        return names;
    }

    if (
        node.type ===
        NodeTypes.ASSIGNMENT
    ) {
        const name =
            identifierName(node.left);

        if (name != null) {
            names.add(name);
        }
    }

    if (
        node.type ===
        NodeTypes.READ_STATEMENT
    ) {
        for (
            const target
            of node.identifiers ?? []
        ) {
            const name =
                identifierName(target);

            if (name != null) {
                names.add(name);
            }
        }
    }

    for (
        const [key, value]
        of Object.entries(node)
    ) {
        if (
            key === "location" ||
            key === "type"
        ) {
            continue;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                collectWrittenNames(
                    item,
                    names
                );
            }
        } else {
            collectWrittenNames(
                value,
                names
            );
        }
    }

    return names;
}

function collectNestedWrittenNames(
    body
) {
    const names = new Set();

    for (
        const statement
        of body?.statements ?? []
    ) {
        if (
            statement.type !==
            NodeTypes.ASSIGNMENT
        ) {
            collectWrittenNames(
                statement,
                names
            );
        }
    }

    return names;
}
