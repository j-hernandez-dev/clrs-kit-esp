import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    SymbolicValueResolver
} from "../iteration/SymbolicValueResolver.js";
import {
    addAffine,
    affineFromCostExpression,
    scaleAffine
} from "./AffineExpression.js";

const EPSILON = 1e-9;

export const RecurrencePathScale =
    Object.freeze({
        UNBOUNDED: "unbounded",
        BOUNDARY: "boundary",
        UNKNOWN: "unknown"
    });

export const RecurrenceBestStrategy =
    Object.freeze({
        SAME_RECURRENCE:
            "same-recurrence",
        UNKNOWN: "unknown"
    });

/**
 * Demuestra las obligaciones que conectan una transición recursiva con un
 * caso base para entradas cuyo tamaño crece. El análisis es deliberadamente
 * conservador: una guarda que sólo menciona otra entrada no se considera una
 * cota inferior de la medida.
 */
export function analyzeRecurrenceScenarios({
    name,
    recursiveNames = new Set([name]),
    measure,
    flow,
    transitions = []
}) {
    const normalizedNames =
        new Set(recursiveNames);
    const recursiveSites =
        flow?.callSites.filter(site =>
            normalizedNames.has(site.name)
        ) ?? [];
    const exits = flow?.exits ?? [];
    const loopScaleFacts =
        collectLoopScaleFacts(
            flow?.node,
            measure
        );

    if (recursiveSites.length === 0) {
        return Object.freeze({
            kind:
                "recurrence-scenario-analysis",
            applicable: false,
            terminationProven: true,
            hasReachableBaseCase: true,
            measureWellFounded: true,
            boundaryCompatible: true,
            callsGuardedByMeasure: true,
            guardSeparatesBase: true,
            code: null,
            message: null,
            best: freezeBest({
                strategy:
                    RecurrenceBestStrategy
                        .UNKNOWN
            }),
            paths: Object.freeze([]),
            evidence: Object.freeze([])
        });
    }

    const paths = exits.map((exit, index) => {
        const recursive = exit.calls.some(
            call => normalizedNames.has(call)
        );
        const scale = classifyPathScale(
            exit.constraints,
            measure,
            {
                recursive,
                loopScaleFacts
            }
        );
        const guardedBoundary =
            !recursive &&
            isBoundaryAlternative(
                exit.constraints,
                recursiveSites,
                measure
            );
        const boundaryKind =
            scale ===
                RecurrencePathScale.BOUNDARY ||
            guardedBoundary
                ? pathBoundaryKind(
                    exit.constraints,
                    measure,
                    loopScaleFacts
                )
                : null;

        return Object.freeze({
            id: `recurrence-path:${index}`,
            recursive,
            scale,
            boundaryKind,
            kind: exit.kind,
            constraints: exit.constraints,
            location: exit.location ?? null
        });
    });
    const basePaths = paths.filter(path =>
        !path.recursive
    );
    const recursivePaths = paths.filter(path =>
        path.recursive
    );
    const hasReachableBaseCase =
        basePaths.length > 0;
    const boundaryBaseCase =
        basePaths.some(path =>
            path.scale ===
                RecurrencePathScale.BOUNDARY ||
            path.boundaryKind != null
        );
    const boundaryCompatible =
        isBoundaryCompatible(
            basePaths,
            transitions
        );
    const unboundedRecursivePaths =
        recursivePaths.filter(path =>
            path.scale ===
                RecurrencePathScale.UNBOUNDED
        );
    const unboundedBasePaths =
        basePaths.filter(path =>
            path.scale ===
                RecurrencePathScale.UNBOUNDED
        );
    const unknownPaths = paths.filter(path =>
        path.scale ===
            RecurrencePathScale.UNKNOWN
    );
    const measureWellFounded =
        measure?.affine != null &&
        boundaryBaseCase &&
        boundaryCompatible &&
        unboundedRecursivePaths.length > 0;
    const callsGuardedByMeasure =
        recursiveSites.every(site =>
            hasEffectiveMeasureGuard(
                site.constraints,
                measure
            )
        );
    const guardSeparatesBase =
        boundaryBaseCase &&
        unboundedBasePaths.length === 0 &&
        unknownPaths.length === 0;
    const terminationProven =
        measureWellFounded &&
        hasReachableBaseCase &&
        callsGuardedByMeasure;
    const bestStrategy =
        terminationProven &&
        guardSeparatesBase &&
        unboundedRecursivePaths.length === 1
            ? RecurrenceBestStrategy
                .SAME_RECURRENCE
            : RecurrenceBestStrategy.UNKNOWN;
    const failure = terminationProven
        ? null
        : terminationFailure({
            name,
            measure,
            hasReachableBaseCase,
            measureWellFounded,
            boundaryCompatible,
            callsGuardedByMeasure,
            guardSeparatesBase
        });

    return Object.freeze({
        kind:
            "recurrence-scenario-analysis",
        applicable: true,
        terminationProven,
        hasReachableBaseCase,
        measureWellFounded,
        boundaryCompatible,
        callsGuardedByMeasure,
        guardSeparatesBase,
        code: failure?.code ?? null,
        message: failure?.message ?? null,
        best: freezeBest({
            strategy: bestStrategy,
            forcedAtScale:
                bestStrategy ===
                RecurrenceBestStrategy
                    .SAME_RECURRENCE,
            unboundedRecursivePaths:
                unboundedRecursivePaths.length,
            unboundedBasePaths:
                unboundedBasePaths.length,
            unknownPaths:
                unknownPaths.length
        }),
        paths: Object.freeze(paths),
        evidence: Object.freeze([
            ...(boundaryBaseCase
                ? [
                    "El caso base ocupa una frontera acotada de la medida recursiva."
                ]
                : []),
            ...(unboundedRecursivePaths.length > 0
                ? [
                    "La recursión permanece alcanzable cuando la medida tiende a infinito."
                ]
                : []),
            ...(callsGuardedByMeasure
                ? [
                    "Cada llamada del componente está protegida por una guarda efectiva sobre su medida."
                ]
                : []),
            ...(boundaryCompatible
                ? [
                    "Las transiciones no pueden saltar la frontera que detiene la recurrencia."
                ]
                : []),
            ...(bestStrategy ===
                RecurrenceBestStrategy
                    .SAME_RECURRENCE
                ? [
                    "Existe una única trayectoria asintótica alcanzable y obliga a evaluar la recurrencia también en el mejor caso."
                ]
                : [])
        ])
    });
}

export function classifyPathScale(
    constraints = [],
    measure = null,
    options = {}
) {
    if (measure?.affine == null) {
        return RecurrencePathScale.UNKNOWN;
    }

    if (constraints.length === 0) {
        return options.recursive === true
            ? RecurrencePathScale.UNBOUNDED
            : RecurrencePathScale.UNKNOWN;
    }

    let related = false;
    let unknownRelated = false;

    for (
        const constraint
        of effectivePathConstraints(
            constraints,
            options.recursive === true
        )
    ) {
        const classification =
            classifyConstraintAtScale(
                constraint,
                measure,
                options.loopScaleFacts
            );

        if (!classification.related) {
            continue;
        }

        related = true;

        if (classification.possible === false) {
            return RecurrencePathScale.BOUNDARY;
        }

        if (!classification.understood) {
            unknownRelated = true;
        }
    }

    if (unknownRelated) {
        return RecurrencePathScale.UNKNOWN;
    }

    return related
        ? RecurrencePathScale.UNBOUNDED
        : RecurrencePathScale.UNKNOWN;
}

export function hasEffectiveMeasureGuard(
    constraints = [],
    measure = null
) {
    if (measure?.affine == null) {
        return false;
    }

    return constraints.some(constraint =>
        outcomeRequiresMeasureBoundary(
            constraint?.condition,
            Boolean(constraint?.truth),
            measure
        )
    );
}

function classifyConstraintAtScale(
    constraint,
    measure,
    loopScaleFacts = null
) {
    const condition = loopScaleFacts?.has(
        constraint?.condition
    )
        ? definiteCondition(
            loopScaleFacts.get(
                constraint.condition
            ),
            true
        )
        : conditionPossibilitiesAtScale(
            constraint?.condition,
            measure
        );
    const truth = Boolean(
        constraint?.truth
    );
    const possible = truth
        ? condition.canTrue
        : condition.canFalse;
    const oppositePossible = truth
        ? condition.canFalse
        : condition.canTrue;

    return {
        related: condition.related,
        possible,
        understood:
            condition.understood,
        value: !possible
            ? false
            : oppositePossible
                ? null
                : true
    };
}

function outcomeRequiresMeasureBoundary(
    node,
    truth,
    measure
) {
    if (node?.type === NodeTypes.LOGICAL_NOT) {
        return outcomeRequiresMeasureBoundary(
            node.operand,
            !truth,
            measure
        );
    }

    if (node?.type === NodeTypes.LOGICAL_EXPRESSION) {
        const left =
            outcomeRequiresMeasureBoundary(
                node.left,
                truth,
                measure
            );
        const right =
            outcomeRequiresMeasureBoundary(
                node.right,
                truth,
                measure
            );

        if (node.operator === "&&") {
            return truth
                ? left || right
                : left && right;
        }

        if (node.operator === "||") {
            return truth
                ? left && right
                : left || right;
        }

        return false;
    }

    const classification = conditionAtScale(
        node,
        measure
    );

    return (
        classification.related &&
        classification.value != null &&
        classification.value === truth
    );
}

function conditionPossibilitiesAtScale(
    node,
    measure,
    resolver = null
) {
    if (node?.type === NodeTypes.LOGICAL_NOT) {
        const operand =
            conditionPossibilitiesAtScale(
                node.operand,
                measure,
                resolver
            );

        return {
            related: operand.related,
            understood: operand.understood,
            canTrue: operand.canFalse,
            canFalse: operand.canTrue
        };
    }

    if (node?.type === NodeTypes.LOGICAL_EXPRESSION) {
        const left =
            conditionPossibilitiesAtScale(
                node.left,
                measure,
                resolver
            );
        const right =
            conditionPossibilitiesAtScale(
                node.right,
                measure,
                resolver
            );

        if (node.operator === "&&") {
            return {
                related:
                    left.related || right.related,
                understood:
                    left.understood &&
                    right.understood,
                canTrue:
                    left.canTrue &&
                    right.canTrue,
                canFalse:
                    left.canFalse ||
                    right.canFalse
            };
        }

        if (node.operator === "||") {
            return {
                related:
                    left.related || right.related,
                understood:
                    left.understood &&
                    right.understood,
                canTrue:
                    left.canTrue ||
                    right.canTrue,
                canFalse:
                    left.canFalse &&
                    right.canFalse
            };
        }

        return unknownCondition(
            left.related || right.related
        );
    }

    const classification = conditionAtScale(
        node,
        measure,
        resolver
    );

    if (classification.value == null) {
        return classification.related
            ? unknownCondition(true)
            : {
                related: false,
                understood: true,
                canTrue: true,
                canFalse: true
            };
    }

    return definiteCondition(
        classification.value,
        classification.related
    );
}

function definiteCondition(value, related) {
    return {
        related,
        understood: true,
        canTrue: value === true,
        canFalse: value === false
    };
}

function unknownCondition(related) {
    return {
        related,
        understood: false,
        canTrue: true,
        canFalse: true
    };
}

function pathBoundaryKind(
    constraints,
    measure,
    loopScaleFacts
) {
    const kinds = constraints.flatMap(
        constraint => {
            const classification =
                classifyConstraintAtScale(
                    constraint,
                    measure,
                    loopScaleFacts
                );

            if (
                !classification.related
            ) {
                return [];
            }

            return [
                measureBoundaryKind(
                    constraint.condition,
                    measure
                )
            ];
        }
    );

    if (kinds.includes("threshold")) {
        return "threshold";
    }

    return kinds.includes("equality")
        ? "equality"
        : "unknown";
}

function isBoundaryCompatible(
    basePaths,
    transitions
) {
    if (
        basePaths.some(path =>
            path.boundaryKind ===
                "threshold"
        )
    ) {
        return true;
    }

    const equalityBoundary =
        basePaths.some(path =>
            path.boundaryKind ===
                "equality"
        );

    if (!equalityBoundary) {
        return false;
    }

    return (
        transitions.length > 0 &&
        transitions.every(transition =>
            transition?.kind ===
                "decrement" &&
            Math.abs(
                transition.amount - 1
            ) < EPSILON
        )
    );
}

function measureBoundaryKind(node, measure) {
    if (node?.type === NodeTypes.LOGICAL_NOT) {
        return measureBoundaryKind(
            node.operand,
            measure
        );
    }

    if (node?.type === NodeTypes.LOGICAL_EXPRESSION) {
        const kinds = [
            measureBoundaryKind(
                node.left,
                measure
            ),
            measureBoundaryKind(
                node.right,
                measure
            )
        ];

        return kinds.includes("threshold")
            ? "threshold"
            : kinds.includes("equality")
                ? "equality"
                : "unknown";
    }

    const classification = conditionAtScale(
        node,
        measure
    );

    if (!classification.related) {
        return "unknown";
    }

    return node?.type ===
        NodeTypes.BINARY_EXPRESSION &&
        (node.operator === "==" ||
            node.operator === "!=")
        ? "equality"
        : "threshold";
}

function isBoundaryAlternative(
    constraints,
    recursiveSites,
    measure
) {
    if (measure?.affine == null) {
        return false;
    }

    return constraints.some(baseConstraint =>
        recursiveSites.some(site =>
            site.constraints.some(
                recursiveConstraint =>
                    recursiveConstraint
                        .condition ===
                        baseConstraint.condition &&
                    Boolean(
                        recursiveConstraint.truth
                    ) !==
                        Boolean(
                            baseConstraint.truth
                        ) &&
                    outcomeRequiresMeasureBoundary(
                        recursiveConstraint
                            .condition,
                        Boolean(
                            recursiveConstraint
                                .truth
                        ),
                        measure
                    )
            )
        )
    );
}

function conditionAtScale(
    node,
    measure,
    resolver = null
) {
    if (node?.type === NodeTypes.LOGICAL_NOT) {
        const operand = conditionAtScale(
            node.operand,
            measure,
            resolver
        );

        return {
            related: operand.related,
            value:
                operand.value == null
                    ? null
                    : !operand.value
        };
    }

    if (node?.type === NodeTypes.LOGICAL_EXPRESSION) {
        const left = conditionAtScale(
            node.left,
            measure,
            resolver
        );
        const right = conditionAtScale(
            node.right,
            measure,
            resolver
        );

        return {
            related:
                left.related || right.related,
            value: logicalValue(
                node.operator,
                left.value,
                right.value
            )
        };
    }

    if (
        node?.type !==
            NodeTypes.BINARY_EXPRESSION ||
        !isComparison(node.operator)
    ) {
        return {
            related: false,
            value: null
        };
    }

    const left = affineFromAst(
        node.left,
        resolver
    );
    const right = affineFromAst(
        node.right,
        resolver
    );

    if (left == null || right == null) {
        return {
            related:
                mentionsOnlyMeasure(
                    node,
                    measure
                ),
            value: null
        };
    }

    const difference = addAffine(
        left,
        scaleAffine(right, -1)
    );
    const relation = proportionalToMeasure(
        difference,
        measure.affine
    );

    if (relation == null) {
        return {
            related:
                mentionsOnlyMeasure(
                    node,
                    measure
                ),
            value: null
        };
    }

    const sign = Math.sign(relation.scale);

    return {
        related: true,
        value: comparisonAtInfinity(
            node.operator,
            sign
        )
    };
}

function affineFromAst(node, resolver = null) {
    if (node == null) {
        return null;
    }

    const activeResolver =
        resolver ??
        new SymbolicValueResolver();
    const expression =
        activeResolver.resolve(node);

    return affineFromCostExpression(
        expression
    );
}

function effectivePathConstraints(
    constraints,
    recursive
) {
    if (!recursive) {
        return constraints;
    }

    const truths = new Map();

    for (const constraint of constraints) {
        const values = truths.get(
            constraint.condition
        ) ?? new Set();

        values.add(Boolean(constraint.truth));
        truths.set(constraint.condition, values);
    }

    return constraints.filter(constraint => {
        const values = truths.get(
            constraint.condition
        );

        return !(
            values?.size === 2 &&
            constraint.truth === false
        );
    });
}

function collectLoopScaleFacts(
    functionNode,
    measure
) {
    const facts = new WeakMap();

    if (
        functionNode == null ||
        measure?.affine == null
    ) {
        return facts;
    }

    visitStatements(
        functionNode.body?.statements ?? [],
        statement => {
            if (
                statement.type !==
                    NodeTypes.FOR_STATEMENT ||
                statement.initializer
                    ?.left?.type !==
                    NodeTypes.IDENTIFIER
            ) {
                return;
            }

            const resolver =
                new SymbolicValueResolver();

            resolver.assign(
                statement.initializer.left.name,
                statement.initializer.right
            );
            const condition = conditionAtScale(
                statement.condition,
                measure,
                resolver
            );

            if (
                condition.related &&
                condition.value != null
            ) {
                facts.set(
                    statement.condition,
                    condition.value
                );
            }
        }
    );

    return facts;
}

function visitStatements(statements, visitor) {
    for (const statement of statements ?? []) {
        visitor(statement);

        if (statement.type === NodeTypes.IF_STATEMENT) {
            visitStatements(
                statement.thenBlock?.statements,
                visitor
            );
            for (
                const branch
                of statement.elseIfBranches ?? []
            ) {
                visitStatements(
                    branch.block?.statements,
                    visitor
                );
            }
            visitStatements(
                statement.elseBlock?.statements,
                visitor
            );
        } else if (
            statement.type ===
                NodeTypes.FOR_STATEMENT ||
            statement.type ===
                NodeTypes.WHILE_STATEMENT
        ) {
            visitStatements(
                statement.body?.statements,
                visitor
            );
        }
    }
}

function proportionalToMeasure(
    expression,
    measure
) {
    const names = new Set([
        ...Object.keys(expression.coefficients),
        ...Object.keys(measure.coefficients)
    ]);
    let scale = null;

    for (const name of names) {
        const current =
            measure.coefficients[name] ?? 0;
        const candidate =
            expression.coefficients[name] ?? 0;

        if (Math.abs(current) < EPSILON) {
            if (Math.abs(candidate) >= EPSILON) {
                return null;
            }

            continue;
        }

        const next = candidate / current;

        if (
            scale != null &&
            Math.abs(scale - next) >= EPSILON
        ) {
            return null;
        }

        scale = next;
    }

    if (scale == null || Math.abs(scale) < EPSILON) {
        return null;
    }

    return {
        scale,
        offset:
            expression.constant -
            scale * measure.constant
    };
}

function comparisonAtInfinity(operator, sign) {
    switch (operator) {
        case ">":
        case ">=":
            return sign > 0;
        case "<":
        case "<=":
            return sign < 0;
        case "==":
            return false;
        case "!=":
            return true;
        default:
            return null;
    }
}

function logicalValue(operator, left, right) {
    if (operator === "&&") {
        if (left === false || right === false) {
            return false;
        }

        return left === true && right === true
            ? true
            : null;
    }

    if (operator === "||") {
        if (left === true || right === true) {
            return true;
        }

        return left === false && right === false
            ? false
            : null;
    }

    return null;
}

function isComparison(operator) {
    return [
        "<",
        "<=",
        ">",
        ">=",
        "==",
        "!="
    ].includes(operator);
}

function mentionsOnlyMeasure(node, measure) {
    const names = new Set(
        Object.keys(
            measure?.affine
                ?.coefficients ?? {}
        )
    );

    const identifiers = collectIdentifiers(node);

    return (
        identifiers.length > 0 &&
        identifiers.every(name =>
            names.has(name)
        )
    );
}

function collectIdentifiers(node, result = []) {
    if (node == null || typeof node !== "object") {
        return result;
    }

    if (node.type === NodeTypes.IDENTIFIER) {
        result.push(node.name);
        return result;
    }

    for (const [key, value] of Object.entries(node)) {
        if (key === "location" || key === "identifier") {
            continue;
        }

        if (Array.isArray(value)) {
            value.forEach(item =>
                collectIdentifiers(item, result)
            );
        } else {
            collectIdentifiers(value, result);
        }
    }

    return result;
}

function terminationFailure({
    name,
    measure,
    hasReachableBaseCase,
    measureWellFounded,
    boundaryCompatible,
    callsGuardedByMeasure,
    guardSeparatesBase
}) {
    if (!hasReachableBaseCase) {
        return {
            code:
                "CLRS_RECURRENCE_BASE_CASE_UNPROVEN",
            message:
                `No se encontró un camino base alcanzable de ${name} que evite la llamada recursiva.`
        };
    }

    if (measure == null) {
        return {
            code:
                "CLRS_RECURRENCE_MEASURE_UNPROVEN",
            message:
                `No se encontró una medida bien fundada para demostrar que ${name} progresa hacia un caso base.`
        };
    }

    if (!callsGuardedByMeasure) {
        return {
            code:
                "CLRS_RECURRENCE_GUARD_UNRELATED",
            message:
                `Las guardas de la recursión de ${name} no restringen efectivamente la medida que disminuye.`
        };
    }

    if (!boundaryCompatible) {
        return {
            code:
                "CLRS_RECURRENCE_BASE_LATTICE_UNPROVEN",
            message:
                `No se demostró que las transiciones de ${name} alcancen la frontera exacta del caso base sin saltarla.`
        };
    }

    if (!measureWellFounded || !guardSeparatesBase) {
        return {
            code:
                "CLRS_RECURRENCE_WELL_FOUNDEDNESS_UNPROVEN",
            message:
                `No se demostró que la medida de ${name} esté acotada por una frontera base alcanzable.`
        };
    }

    return null;
}

function freezeBest(value) {
    return Object.freeze({
        strategy:
            value.strategy ??
            RecurrenceBestStrategy.UNKNOWN,
        forcedAtScale:
            value.forcedAtScale === true,
        unboundedRecursivePaths:
            value.unboundedRecursivePaths ?? 0,
        unboundedBasePaths:
            value.unboundedBasePaths ?? 0,
        unknownPaths:
            value.unknownPaths ?? 0
    });
}
