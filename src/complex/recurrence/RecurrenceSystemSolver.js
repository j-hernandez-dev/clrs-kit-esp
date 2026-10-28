import {
    createUnknownOrder,
    exponentialOrder,
    sumOrders
} from "../asymptotic/AsymptoticOrder.js";
import {
    accumulateToll,
    approximatelyEqual,
    combineCharacteristicAndToll,
    numericConstant,
    rounded,
    solvePolynomialToll
} from "./RecurrenceSolver.js";
import {
    createRecurrenceSystem
} from "./RecurrenceSystem.js";
import {
    RecurrenceExtractor
} from "./RecurrenceExtractor.js";

const EPSILON = 1e-8;
const MAX_NUMERIC_VALUE = 1e12;
const MAX_SYSTEM_VARIANTS = 256;

export class RecurrenceSystemSolver {

    constructor(options = {}) {
        this.extractor =
            options.extractor ??
            new RecurrenceExtractor();
    }

    solve({
        componentSystem,
        definitions,
        classify,
        resolveRelation,
        hasBaseCase
    }) {
        const built =
            this.buildSystem({
                componentSystem,
                definitions,
                classify,
                resolveRelation,
                hasBaseCase
            });

        if (!built.ok) {
            return unsupportedResult(
                componentSystem,
                built.code,
                built.message,
                built.system ?? null
            );
        }

        const system = built.system;

        if (!system.hasBaseCase) {
            return unsupportedResult(
                componentSystem,
                "CLRS_CALL_GRAPH_BASE_CASE_UNPROVEN",
                "No se encontró un camino base sin llamadas internas dentro del componente recursivo.",
                system
            );
        }

        const expansion =
            expandSystemVariants(
                system
            );
        const solutions =
            expansion.variants.map(
                solveNormalizedSystem
            );
        const failed =
            solutions.find(
                candidate =>
                    !candidate.order.known
            );

        if (failed != null) {
            return unsupportedResult(
                componentSystem,
                failed.order.code,
                failed.order.message,
                system
            );
        }

        const order =
            sumOrders(
                solutions.map(
                    candidate =>
                        candidate.order
                )
            );
        const boundKind =
            solutions.some(
                candidate =>
                    candidate.boundKind ===
                    "upper"
            )
                ? "upper"
                : "tight";
        const method =
            expansion.variants.length === 1
                ? solutions[0].method
                : expansion.truncated
                    ? "scc-branch-upper-envelope"
                    : "scc-branch-envelope";
        const characteristic =
            expansion.variants.length === 1
                ? solutions[0]
                    .characteristic ??
                    null
                : commonCharacteristic(
                    solutions
                );

        return Object.freeze({
            ...componentSystem,
            solved: true,
            ready: true,
            order,
            method,
            boundKind,
            tight:
                boundKind === "tight",
            characteristic,
            recurrenceSystem:
                system,
            code: null,
            message: null
        });
    }

    buildSystem({
        componentSystem,
        definitions,
        classify,
        resolveRelation,
        hasBaseCase
    }) {
        const recursiveNames =
            new Set(
                componentSystem.names
            );
        const equations = [];
        const relationKinds =
            new Set();

        for (
            const name
            of componentSystem.names
        ) {
            const definition =
                definitions.get(name);
            const measure =
                componentSystem.measures
                    .find(record =>
                        record.name === name
                    )?.measure ?? null;
            const forms =
                this.extractor.extract(
                    definition.summary.worst,
                    name,
                    {
                        recursiveNames,
                        resolveRelation:
                            call =>
                                resolveRelation(
                                    name,
                                    call
                                )
                    }
                );
            const invalid =
                forms.find(form =>
                    form.code != null
                );

            if (invalid != null) {
                return failure(
                    invalid.code,
                    invalid.message
                );
            }

            const normalizedForms = [];

            for (const form of forms) {
                const terms = [];

                for (const term of form.terms) {
                    const coefficient =
                        numericConstant(
                            term.coefficient
                        );

                    if (
                        coefficient == null ||
                        !Number.isFinite(
                            coefficient
                        ) ||
                        coefficient < 0
                    ) {
                        return failure(
                            "CLRS_RECURRENCE_SYSTEM_COEFFICIENT_UNSUPPORTED",
                            "Los coeficientes de un sistema de recurrencias deben ser constantes no negativas."
                        );
                    }

                    if (coefficient === 0) {
                        continue;
                    }

                    relationKinds.add(
                        term.relation.kind
                    );
                    terms.push({
                        callee:
                            term.call.name,
                        coefficient,
                        relation:
                            term.relation,
                        call: term.call
                    });
                }

                normalizedForms.push({
                    recursive:
                        terms.length > 0,
                    toll: form.toll,
                    tollOrder:
                        classify(
                            name,
                            form.toll,
                            measure
                        ),
                    terms
                });
            }

            const recursiveForms =
                normalizedForms.filter(
                    form =>
                        form.recursive
                );

            if (recursiveForms.length === 0) {
                return failure(
                    "CLRS_CALL_GRAPH_SYSTEM_UNRESOLVED",
                    `La ecuación de ${name} no contiene una transición interna analizable.`
                );
            }

            const enveloped =
                recursiveForms.length > 1;

            equations.push({
                name,
                measure,
                forms:
                    normalizedForms,
                transitionTerms:
                    recursiveForms.flatMap(
                        form => form.terms
                    ),
                enveloped
            });
        }

        const reductionKind =
            relationKinds.size === 1
                ? [...relationKinds][0]
                : "mixed";
        const system =
            createRecurrenceSystem({
                componentId:
                    componentSystem
                        .component.id,
                names:
                    componentSystem.names,
                equations,
                reductionKind,
                hasBaseCase:
                    componentSystem.names
                        .some(name =>
                            hasBaseCase(
                                name,
                                recursiveNames
                            )
                        ),
                boundKind: "tight"
            });

        return {
            ok: true,
            system
        };
    }
}

function solveNormalizedSystem(system) {
    const toll =
        sumOrders(
            system.equations
                .flatMap(equation =>
                    equation.forms.map(
                        form =>
                            form.tollOrder
                    )
                )
        );

    if (!toll.known) {
        return solution({
            order: toll,
            method: null,
            boundKind:
                system.boundKind
        });
    }

    return system.reductionKind ===
        "decrement"
        ? solveAdditiveSystem(
            system,
            toll
        )
        : system.reductionKind ===
            "division"
            ? solveDivisionSystem(
                system,
                toll
            )
            : solveMixedSystem(
                system,
                toll
            );
}

function expandSystemVariants(system) {
    const alternatives =
        system.equations.map(
            equation => ({
                equation,
                forms:
                    equation.forms.filter(
                        form =>
                            form.recursive
                    )
            })
        );
    const count =
        alternatives.reduce(
            (total, item) =>
                total *
                item.forms.length,
            1
        );

    if (count > MAX_SYSTEM_VARIANTS) {
        return {
            variants:
                [upperEnvelope(system)],
            truncated: true
        };
    }

    const variants = [];

    enumerateVariants(
        alternatives,
        0,
        [],
        equations => {
            variants.push(
                recurrenceVariant(
                    system,
                    equations,
                    "tight"
                )
            );
        }
    );

    return {
        variants,
        truncated: false
    };
}

function enumerateVariants(
    alternatives,
    index,
    selected,
    accept
) {
    if (index === alternatives.length) {
        accept([...selected]);
        return;
    }

    const item = alternatives[index];

    for (const form of item.forms) {
        selected.push({
            ...item.equation,
            forms: [form],
            transitionTerms:
                form.terms,
            enveloped: false
        });
        enumerateVariants(
            alternatives,
            index + 1,
            selected,
            accept
        );
        selected.pop();
    }
}

function upperEnvelope(system) {
    return recurrenceVariant(
        system,
        system.equations.map(
            equation => ({
                ...equation,
                forms:
                    equation.forms.filter(
                        form =>
                            form.recursive
                    ),
                transitionTerms:
                    equation.forms
                        .filter(form =>
                            form.recursive
                        )
                        .flatMap(
                            form =>
                                form.terms
                        ),
                enveloped: true
            })
        ),
        "upper"
    );
}

function recurrenceVariant(
    system,
    equations,
    boundKind
) {
    return createRecurrenceSystem({
        componentId:
            system.componentId,
        names: system.names,
        equations,
        reductionKind:
            reductionKindFor(
                equations
            ),
        hasBaseCase:
            system.hasBaseCase,
        boundKind
    });
}

function reductionKindFor(equations) {
    const kinds =
        new Set(
            equations.flatMap(
                equation =>
                    equation.transitionTerms
                        .map(term =>
                            term.relation.kind
                        )
            )
        );

    return kinds.size === 1
        ? [...kinds][0]
        : "mixed";
}

function commonCharacteristic(solutions) {
    const values =
        solutions.map(
            candidate =>
                candidate.characteristic
        );
    const first = values[0];

    return (
        first != null &&
        values.every(value =>
            value != null &&
            approximatelyEqual(
                value,
                first
            )
        )
    )
        ? first
        : null;
}

function solveAdditiveSystem(
    system,
    toll,
    options = {}
) {
    const relationWeight =
        options.relationWeight ??
        ((relation, base) =>
            1 /
            Math.pow(
                base,
                relation.amount
            ));
    const atOne =
        spectralRadius(
            transitionMatrix(
                system,
                relation =>
                    relationWeight(
                        relation,
                        1
                    )
            )
        );
    const boundKind =
        options.boundKind ??
        system.boundKind;

    if (atOne < 1 - EPSILON) {
        return solution({
            order: toll,
            method:
                options.method ??
                "scc-matrix-substitution",
            characteristic: 1,
            boundKind
        });
    }

    if (approximatelyEqual(atOne, 1)) {
        return solution({
            order:
                accumulateToll(toll),
            method:
                options.method ??
                simpleUnitCycle(system)
                    ? "scc-substitution"
                    : "scc-matrix-substitution",
            characteristic: 1,
            boundKind
        });
    }

    const base =
        solveDecrementBase(
            system,
            relationWeight
        );

    if (base == null) {
        return solution({
            order:
                createUnknownOrder(
                    "CLRS_RECURRENCE_SYSTEM_NUMERIC_LIMIT",
                    "No se pudo calcular la raíz espectral del sistema de recurrencias aditivas."
                ),
            method: null,
            boundKind
        });
    }

    const normalizedBase =
        rounded(base);

    return solution({
        order:
            combineCharacteristicAndToll(
                exponentialOrder(
                    normalizedBase
                ),
                toll,
                normalizedBase
            ),
        method:
            options.method ??
            "scc-characteristic-root",
        characteristic:
            normalizedBase,
        boundKind
    });
}

function solveDivisionSystem(
    system,
    toll
) {
    const exponent =
        solveDivisionExponent(system);

    if (exponent == null) {
        return solution({
            order:
                createUnknownOrder(
                    "CLRS_RECURRENCE_SYSTEM_NUMERIC_LIMIT",
                    "No se pudo calcular el exponente espectral del sistema divide y vencerás."
                ),
            method: null,
            boundKind:
                system.boundKind
        });
    }

    const normalizedExponent =
        rounded(exponent);

    return solution({
        order:
            solvePolynomialToll(
                toll,
                normalizedExponent
            ),
        method:
            simpleUnitCycle(system)
                ? "scc-master-theorem"
                : "scc-akra-bazzi-system",
        characteristic:
            normalizedExponent,
        boundKind:
            system.boundKind
    });
}

function solveMixedSystem(
    system,
    toll
) {
    const cycle =
        deterministicCycle(system);

    if (cycle != null) {
        const exponent =
            cycle.coefficient <= 1
                ? 0
                : Math.log(
                    cycle.coefficient
                ) /
                Math.log(
                    1 / cycle.ratio
                );

        return solution({
            order:
                solvePolynomialToll(
                    toll,
                    rounded(exponent)
                ),
            method:
                "scc-mixed-cycle",
            characteristic:
                rounded(exponent),
            boundKind:
                system.boundKind
        });
    }

    return solveAdditiveSystem(
        system,
        toll,
        {
            relationWeight:
                (relation, base) =>
                    1 /
                    Math.pow(
                        base,
                        relation.kind ===
                            "decrement"
                            ? relation.amount
                            : 1
                    ),
            method:
                "scc-mixed-upper-bound",
            boundKind: "upper"
        }
    );
}

function solveDecrementBase(
    system,
    relationWeight
) {
    const radius = base =>
        spectralRadius(
            transitionMatrix(
                system,
                relation =>
                    relationWeight(
                        relation,
                        base
                    )
            )
        );
    let lower = 1;
    let upper = 2;

    while (
        radius(upper) > 1 &&
        upper < MAX_NUMERIC_VALUE
    ) {
        upper *= 2;
    }

    if (upper >= MAX_NUMERIC_VALUE) {
        return null;
    }

    return bisectRoot(
        lower,
        upper,
        value => radius(value) > 1
    );
}

function solveDivisionExponent(system) {
    const radius = exponent =>
        spectralRadius(
            transitionMatrix(
                system,
                relation =>
                    Math.pow(
                        relation.ratio,
                        exponent
                    )
            )
        );

    if (radius(0) <= 1) {
        return 0;
    }

    let lower = 0;
    let upper = 1;

    while (
        radius(upper) > 1 &&
        upper < 1024
    ) {
        upper *= 2;
    }

    if (upper >= 1024) {
        return null;
    }

    return bisectRoot(
        lower,
        upper,
        value => radius(value) > 1
    );
}

function deterministicCycle(system) {
    if (
        system.boundKind !== "tight" ||
        system.equations.some(equation =>
            equation.transitionTerms
                .length !== 1
        )
    ) {
        return null;
    }

    const byName =
        new Map(
            system.equations.map(
                equation => [
                    equation.name,
                    equation
                        .transitionTerms[0]
                ]
            )
        );
    const start = system.names[0];
    const visited = new Set();
    let current = start;
    let ratio = 1;
    let offset = 0;
    let coefficient = 1;

    while (!visited.has(current)) {
        visited.add(current);
        const term = byName.get(current);
        const relation = term.relation;
        const nextRatio =
            relation.kind === "division"
                ? relation.ratio
                : 1;
        const nextOffset =
            relation.kind === "division"
                ? relation.offset
                : -relation.amount;

        offset =
            nextRatio * offset +
            nextOffset;
        ratio *= nextRatio;
        coefficient *=
            term.coefficient;
        current = term.callee;
    }

    return (
        current === start &&
        visited.size ===
            system.names.length &&
        ratio > 0 &&
        ratio < 1
    )
        ? {
            ratio,
            offset,
            coefficient
        }
        : null;
}

function simpleUnitCycle(system) {
    return (
        system.boundKind === "tight" &&
        system.equations.every(
            equation =>
                equation.transitionTerms
                    .length === 1 &&
                equation.transitionTerms[0]
                    .coefficient === 1
        )
    );
}

function transitionMatrix(
    system,
    relationWeight
) {
    const indexByName =
        new Map(
            system.names.map(
                (name, index) => [
                    name,
                    index
                ]
            )
        );
    const matrix =
        system.names.map(() =>
            system.names.map(() => 0)
        );

    for (const equation of system.equations) {
        const row =
            indexByName.get(
                equation.name
            );

        for (
            const term
            of equation.transitionTerms
        ) {
            const column =
                indexByName.get(
                    term.callee
                );

            matrix[row][column] +=
                term.coefficient *
                relationWeight(
                    term.relation
                );
        }
    }

    return matrix;
}

function spectralRadius(matrix) {
    const size = matrix.length;

    if (size === 0) {
        return 0;
    }

    const shifted =
        matrix.map(
            (row, rowIndex) =>
                row.map(
                    (value, columnIndex) =>
                        value +
                        (rowIndex ===
                            columnIndex
                            ? 1
                            : 0)
                )
        );
    let vector =
        Array(size).fill(1 / size);
    let lower = 0;
    let upper = Infinity;

    for (
        let iteration = 0;
        iteration < 1000;
        iteration++
    ) {
        const next =
            shifted.map(row =>
                row.reduce(
                    (sum, value, index) =>
                        sum +
                        value * vector[index],
                    0
                )
            );
        const ratios =
            next.map(
                (value, index) =>
                    value / vector[index]
            );

        lower = Math.min(...ratios);
        upper = Math.max(...ratios);

        const norm =
            next.reduce(
                (sum, value) =>
                    sum + value,
                0
            );

        if (norm === 0) {
            return 0;
        }

        vector = next.map(
            value => value / norm
        );

        if (
            upper - lower <
            1e-12
        ) {
            break;
        }
    }

    return Math.max(
        0,
        (lower + upper) / 2 - 1
    );
}

function bisectRoot(
    lower,
    upper,
    chooseLower
) {
    for (
        let iteration = 0;
        iteration < 120;
        iteration++
    ) {
        const middle =
            (lower + upper) / 2;

        if (chooseLower(middle)) {
            lower = middle;
        } else {
            upper = middle;
        }
    }

    return (lower + upper) / 2;
}

function solution({
    order,
    method,
    characteristic = null,
    boundKind = "tight"
}) {
    return {
        order,
        method,
        characteristic,
        boundKind
    };
}

function unsupportedResult(
    componentSystem,
    code,
    message,
    recurrenceSystem
) {
    return Object.freeze({
        ...componentSystem,
        solved: false,
        ready: false,
        order:
            createUnknownOrder(
                code,
                message
            ),
        method: null,
        boundKind:
            recurrenceSystem
                ?.boundKind ??
            null,
        tight: false,
        characteristic: null,
        recurrenceSystem,
        code,
        message
    });
}

function failure(code, message) {
    return {
        ok: false,
        code,
        message,
        system: null
    };
}
