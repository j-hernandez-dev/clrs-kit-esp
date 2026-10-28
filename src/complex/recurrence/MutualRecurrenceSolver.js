import {
    CostExpressionKind
} from "../algebra/CostExpression.js";
import {
    createUnknownOrder
} from "../asymptotic/AsymptoticOrder.js";
import {
    compareAffineReduction,
    createAffine,
    substituteAffine
} from "./AffineExpression.js";
import {
    RecurrenceSolver
} from "./RecurrenceSolver.js";
import {
    RecurrenceSystemSolver
} from "./RecurrenceSystemSolver.js";
import {
    analyzeRecurrenceScenarios,
    hasEffectiveMeasureGuard
} from "./RecurrenceScenarioAnalysis.js";

const MAX_MEASURE_COMBINATIONS = 256;

export class MutualRecurrenceSolver {

    constructor(options = {}) {
        this.recurrenceSolver =
            options.recurrenceSolver ??
            new RecurrenceSolver();
        this.systemSolver =
            options.systemSolver ??
            new RecurrenceSystemSolver({
                extractor:
                    this.recurrenceSolver
                        .extractor
            });
    }

    prepare(
        component,
        definitions
    ) {
        if (!component?.mutual) {
            return Object.freeze({
                applicable: false,
                component,
                names:
                    Object.freeze([]),
                measures:
                    Object.freeze([]),
                relations:
                    Object.freeze([]),
                order: null
            });
        }

        const names = [...component.names];
        const measures =
            inferMeasures(
                names,
                component.internalEdges,
                definitions
            );

        if (measures == null) {
            return unsupportedSystem({
                component,
                names,
                code:
                    "CLRS_CALL_GRAPH_MEASURE_UNRESOLVED",
                message:
                    "No se encontró una medida compatible cuyo grafo de cambio disminuya y alcance una guarda base en toda vuelta recursiva."
            });
        }

        const relations =
            component.internalEdges.map(
                edge =>
                    Object.freeze({
                        edge,
                        relation:
                            relationForEdge(
                                edge,
                                measures,
                                definitions
                            ),
                        guarded:
                            edgeHasEffectiveGuard(
                                edge,
                                measures,
                                definitions
                            )
                    })
            );
        const kinds =
            new Set(
                relations.map(record =>
                    record.relation.kind
                )
            );
        const guardCyclesProven =
            !hasUnguardedCycle(
                names,
                relations
            );

        return Object.freeze({
            applicable: true,
            ready: true,
            component,
            names:
                Object.freeze(names),
            measures:
                freezeMeasureRecords(
                    measures
                ),
            relations:
                Object.freeze(relations),
            reductionKind:
                kinds.size === 1
                    ? [...kinds][0]
                    : "mixed",
            sizeChange:
                Object.freeze({
                    proven: true,
                    guardCyclesProven,
                    method:
                        "size-change-termination",
                    evidence:
                        Object.freeze([
                            "Toda vuelta del componente recursivo contiene al menos una disminución estricta de la medida.",
                            ...(guardCyclesProven
                                ? [
                                    "Toda vuelta del componente atraviesa una guarda efectiva que impide continuar al alcanzar la frontera base."
                                ]
                                : [])
                        ])
                }),
            order: null,
            code: null,
            message: null
        });
    }

    solve(
        system,
        definitions,
        classify
    ) {
        if (!system?.applicable) {
            return Object.freeze({
                ...system,
                solved: false
            });
        }

        if (!system.ready) {
            return Object.freeze({
                ...system,
                solved: false
            });
        }

        const result = this.systemSolver.solve({
            componentSystem: system,
            definitions,
            classify,
            resolveRelation:
                (name, call) =>
                    relationForCall(
                        system,
                        name,
                        call,
                        definitions
                    ),
            hasBaseCase:
                (name, recursiveNames) =>
                    hasSoundBaseCase(
                        definitions.get(name),
                        new Set(
                            [...recursiveNames]
                                .map(item =>
                                    definitions.get(item)
                                        ?.recurrenceDefinition
                                        ?.name ?? item
                                )
                        ),
                        getMutualRecurrenceMeasure(
                            system,
                            name
                        ),
                        system.relations
                            .filter(record =>
                                record.edge.caller ===
                                name
                            ).map(record =>
                                record.relation
                            )
                    )
        });

        if (
            result.order?.known !== true ||
            system.sizeChange
                ?.guardCyclesProven === true
        ) {
            return result;
        }

        const code =
            "CLRS_RECURRENCE_WELL_FOUNDEDNESS_UNPROVEN";
        const message =
            "Existe una vuelta del componente recursivo que puede seguir disminuyendo sin atravesar una guarda base efectiva.";

        return Object.freeze({
            ...result,
            solved: false,
            ready: false,
            order:
                createUnknownOrder(
                    code,
                    message
                ),
            method: null,
            tight: false,
            code,
            message
        });
    }
}

export function getMutualRecurrenceMeasure(
    system,
    name
) {
    return system?.measures
        ?.find(record =>
            record.name === name
        )?.measure ?? null;
}

function inferMeasures(
    names,
    edges,
    definitions
) {
    const candidates =
        new Map(
            names.map(name => [
                name,
                measureCandidates(
                    definitions.get(name)
                        .summary.parameters
                )
            ])
        );

    if (
        [...candidates.values()]
            .some(items =>
                items.length === 0
            )
    ) {
        return null;
    }

    let attempts = 0;
    const selected = new Map();

    const search = index => {
        if (
            attempts >=
            MAX_MEASURE_COMBINATIONS
        ) {
            return false;
        }

        if (index === names.length) {
            const relations = edges.map(
                edge => ({
                    edge,
                    relation:
                        relationForEdge(
                            edge,
                            selected,
                            definitions
                        ),
                    guarded:
                        edgeHasEffectiveGuard(
                            edge,
                            selected,
                            definitions
                        )
                })
            );

            return (
                relations.every(record =>
                    record.relation != null
                ) &&
                !hasNonStrictCycle(
                    names,
                    relations
                )
            );
        }

        const name = names[index];

        for (
            const measure
            of candidates.get(name)
        ) {
            attempts++;
            selected.set(name, measure);

            const consistent =
                edges.every(edge =>
                    !selected.has(
                        edge.caller
                    ) ||
                    !selected.has(
                        edge.callee
                    ) ||
                    relationForEdge(
                        edge,
                        selected,
                        definitions
                    ) != null
                );

            if (
                consistent &&
                search(index + 1)
            ) {
                return true;
            }
        }

        selected.delete(name);
        return false;
    };

    return search(0)
        ? new Map(selected)
        : null;
}

function measureCandidates(parameters) {
    const measures =
        parameters.map(parameter =>
            Object.freeze({
                kind: "parameter",
                parameter,
                affine:
                    createAffine(
                        0,
                        {
                            [parameter]: 1
                        }
                    )
            })
        );

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

function relationForEdge(
    edge,
    measures,
    definitions
) {
    return compareMeasureTransition(
        measures.get(edge.caller),
        measures.get(edge.callee),
        definitions.get(edge.callee)
            .summary.parameters,
        edge.arguments
    );
}

function edgeHasEffectiveGuard(
    edge,
    measures,
    definitions
) {
    const definition = definitions.get(
        edge.caller
    );
    const site = definition
        ?.recurrenceDefinition
        ?.flow?.callSites
        ?.find(candidate =>
            candidate.node === edge.node
        );

    return hasEffectiveMeasureGuard(
        site?.constraints ?? [],
        measures.get(edge.caller)
    );
}

function relationForCall(
    system,
    caller,
    call,
    definitions
) {
    if (!system.names.includes(call.name)) {
        return null;
    }

    return compareMeasureTransition(
        getMutualRecurrenceMeasure(
            system,
            caller
        ),
        getMutualRecurrenceMeasure(
            system,
            call.name
        ),
        definitions.get(call.name)
            .summary.parameters,
        call.args
    );
}

function compareMeasureTransition(
    callerMeasure,
    calleeMeasure,
    calleeParameters,
    args
) {
    if (
        callerMeasure == null ||
        calleeMeasure == null
    ) {
        return null;
    }

    const next = substituteAffine(
        calleeMeasure.affine,
        calleeParameters,
        args
    );

    return compareAffineReduction(
        callerMeasure.affine,
        next
    ) ?? (
        sameAffine(
            callerMeasure.affine,
            next
        )
            ? Object.freeze({
                kind: "decrement",
                amount: 0,
                strict: false
            })
            : null
    );
}

function sameAffine(left, right) {
    return (
        left != null &&
        right != null &&
        JSON.stringify(left) ===
            JSON.stringify(right)
    );
}

function hasNonStrictCycle(
    names,
    relations
) {
    return hasFilteredCycle(
        names,
        relations,
        record =>
            !isStrictRelation(
                record.relation
            )
    );
}

function hasUnguardedCycle(
    names,
    relations
) {
    return hasFilteredCycle(
        names,
        relations,
        record => record.guarded !== true
    );
}

function hasFilteredCycle(
    names,
    relations,
    include
) {
    const adjacency = new Map(
        names.map(name => [name, []])
    );

    for (const record of relations) {
        if (!include(record)) {
            continue;
        }

        adjacency.get(record.edge.caller)
            ?.push(record.edge.callee);
    }

    const visiting = new Set();
    const visited = new Set();

    const visit = name => {
        if (visiting.has(name)) {
            return true;
        }

        if (visited.has(name)) {
            return false;
        }

        visiting.add(name);

        for (const next of adjacency.get(name) ?? []) {
            if (visit(next)) {
                return true;
            }
        }

        visiting.delete(name);
        visited.add(name);
        return false;
    };

    return names.some(visit);
}

function isStrictRelation(relation) {
    if (relation?.kind === "decrement") {
        return relation.amount > 0;
    }

    if (relation?.kind === "division") {
        return relation.ratio > 0 &&
            relation.ratio < 1;
    }

    if (relation?.kind === "power") {
        return relation.exponent > 0 &&
            relation.exponent < 1;
    }

    return false;
}

function canAvoidInternalCalls(
    expression,
    recursiveNames
) {
    if (
        expression?.kind ===
            CostExpressionKind.CALL &&
        recursiveNames.has(
            expression.name
        )
    ) {
        return false;
    }

    if (
        expression == null ||
        typeof expression !== "object"
    ) {
        return true;
    }

    if (
        expression.kind ===
            CostExpressionKind.EQUATION ||
        expression.kind ===
            CostExpressionKind.RECURRENCE
    ) {
        return canAvoidInternalCalls(
            expression.right,
            recursiveNames
        );
    }

    if (
        expression.kind ===
            CostExpressionKind.MINIMUM
    ) {
        return expression.expressions
            .some(candidate =>
                canAvoidInternalCalls(
                    candidate,
                    recursiveNames
                )
            );
    }

    return Object.values(expression)
        .every(value =>
            Array.isArray(value)
                ? value.every(item =>
                    canAvoidInternalCalls(
                        item,
                        recursiveNames
                    )
                )
                : canAvoidInternalCalls(
                    value,
                    recursiveNames
                )
        );
}

function hasSoundBaseCase(
    definition,
    recursiveNames,
    measure,
    transitions = []
) {
    const flow =
        definition?.recurrenceDefinition
            ?.flow ?? null;

    if (flow == null) {
        return canAvoidInternalCalls(
            definition.summary.best,
            recursiveNames
        );
    }

    return analyzeRecurrenceScenarios({
        name:
            definition.recurrenceDefinition
                ?.name ??
            definition.summary.name,
        recursiveNames,
        measure,
        flow,
        transitions
    }).terminationProven;
}

function unsupportedSystem({
    component,
    names,
    measures = new Map(),
    relations = [],
    code,
    message
}) {
    return Object.freeze({
        applicable: true,
        ready: false,
        component,
        names:
            Object.freeze([...names]),
        measures:
            freezeMeasureRecords(
                measures
            ),
        relations:
            Object.freeze([
                ...relations
            ]),
        reductionKind: null,
        sizeChange: null,
        order:
            createUnknownOrder(
                code,
                message
            ),
        code,
        message
    });
}

function freezeMeasureRecords(measures) {
    return Object.freeze(
        [...measures.entries()]
            .map(([name, measure]) =>
                Object.freeze({
                    name,
                    measure
                })
            )
    );
}
