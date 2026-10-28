import {
    requireCostExpression
} from "../algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    simplifyCostExpression
} from "../algebra/CostExpressionSimplifier.js";

export const LoopInvariantKind =
    Object.freeze({
        GUARD_DISTANCE: "guard-distance",
        PROGRESS: "progress",
        RELATIONAL_INTERVAL:
            "relational-interval",
        NONLINEAR_GUARD:
            "nonlinear-guard",
        NONLINEAR_PROGRESSION:
            "nonlinear-progression",
        PATH_COVERAGE: "path-coverage"
    });

/**
 * Transición abstracta de una vuelta del ciclo. Conserva exclusivamente
 * hechos probados por el analizador de progresiones, no una simulación del
 * cuerpo ni una afirmación sobre estados concretos.
 */
export function createLoopTransition({
    variable,
    condition,
    start,
    bound,
    update,
    boundKind = "tight",
    pathAnalysis = null,
    relational = null,
    nonlinear = null,
    location = null
}) {
    if (
        typeof variable !== "string" ||
        variable.length === 0
    ) {
        throw new TypeError(
            "A loop transition requires a control variable."
        );
    }

    requireCostExpression(start, "transition start");
    requireCostExpression(bound, "transition bound");

    return Object.freeze({
        kind: "loop-transition",
        variable,
        condition: Object.freeze({
            operator: condition.operator,
            bound
        }),
        start,
        bound,
        update: Object.freeze({ ...update }),
        boundKind,
        pathAnalysis,
        relational: freezeRelationalProof(
            relational
        ),
        nonlinear: freezeNonlinearProof(
            nonlinear
        ),
        location: location == null
            ? null
            : Object.freeze({ ...location })
    });
}

export function createLoopInvariant({
    kind,
    expression = null,
    proven = false,
    evidence = [],
    location = null
}) {
    if (expression != null) {
        requireCostExpression(
            expression,
            "loop invariant expression"
        );
    }

    return Object.freeze({
        kind,
        expression,
        proven: Boolean(proven),
        evidence: Object.freeze([...evidence]),
        location: location == null
            ? null
            : Object.freeze({ ...location })
    });
}

/**
 * Deriva invariantes elementales de una transición ya demostrada. La función
 * de ranking se mantiene separada del conteo de iteraciones: la primera mide
 * distancia al objetivo; el segundo puede incluir redondeos y cotas.
 */
export function deriveLoopInvariantAnalysis(
    transition
) {
    if (transition?.kind !== "loop-transition") {
        return createLoopInvariantAnalysis();
    }

    if (
        transition.relational?.kind ===
        "interval-halving"
    ) {
        return deriveIntervalHalvingInvariantAnalysis(
            transition
        );
    }

    if (transition.nonlinear != null) {
        return deriveNonlinearInvariantAnalysis(
            transition
        );
    }

    const direction = progressionDirection(
        transition.update
    );
    const distance = distanceForTransition(
        transition,
        direction
    );
    const guardCompatible =
        direction != null &&
        guardMatchesDirection(
            transition.condition.operator,
            direction
        );
    const invariants = [];

    if (distance != null) {
        invariants.push(createLoopInvariant({
            kind: LoopInvariantKind.GUARD_DISTANCE,
            expression: distance,
            proven: guardCompatible,
            evidence: guardCompatible
                ? [
                    "La guarda del ciclo mantiene una distancia no negativa al límite mientras el cuerpo puede continuar."
                ]
                : [
                    "La dirección de la transición no demuestra una distancia decreciente compatible con la guarda."
                ],
            location: transition.location
        }));
    }

    invariants.push(createLoopInvariant({
        kind: LoopInvariantKind.PROGRESS,
        proven: direction != null,
        evidence: progressEvidence(
            transition.update,
            direction
        ),
        location: transition.location
    }));

    invariants.push(createLoopInvariant({
        kind: LoopInvariantKind.PATH_COVERAGE,
        proven: transition.pathAnalysis == null ||
            transition.pathAnalysis.continuingPaths > 0,
        evidence: pathEvidence(
            transition.pathAnalysis
        ),
        location: transition.location
    }));

    return createLoopInvariantAnalysis({
        invariants,
        rankingFunction: guardCompatible &&
            distance != null
            ? Cost.maximum([
                Cost.constant(0),
                distance
            ])
            : null,
        evidence: invariants.flatMap(invariant =>
            invariant.evidence
        )
    });
}

function deriveIntervalHalvingInvariantAnalysis(
    transition
) {
    const relation = transition.relational;
    const invariants = [
        createLoopInvariant({
            kind: LoopInvariantKind.GUARD_DISTANCE,
            expression: relation.measure,
            proven: true,
            evidence: [
                `La guarda mantiene el tamaño efectivo del intervalo ${relation.left}..${relation.right}.`
            ],
            location: transition.location
        }),
        createLoopInvariant({
            kind: LoopInvariantKind.RELATIONAL_INTERVAL,
            expression: relation.measure,
            proven: true,
            evidence: [
                "Las ramas descartan el punto medio y reducen el intervalo a lo sumo a la mitad."
            ],
            location: transition.location
        }),
        createLoopInvariant({
            kind: LoopInvariantKind.PATH_COVERAGE,
            proven: transition.pathAnalysis == null ||
                transition.pathAnalysis.continuingPaths > 0,
            evidence: pathEvidence(
                transition.pathAnalysis
            ),
            location: transition.location
        })
    ];

    return createLoopInvariantAnalysis({
        invariants,
        rankingFunction: relation.measure,
        evidence: invariants.flatMap(invariant =>
            invariant.evidence
        )
    });
}

function deriveNonlinearInvariantAnalysis(
    transition
) {
    const nonlinear = transition.nonlinear;
    const invariants = [];

    if (nonlinear.measure != null) {
        invariants.push(createLoopInvariant({
            kind: LoopInvariantKind.NONLINEAR_GUARD,
            expression: nonlinear.measure,
            proven: true,
            evidence: [
                "La guarda no lineal se reduce a una medida monótona sobre el dominio demostrado."
            ],
            location: transition.location
        }));
    }

    invariants.push(createLoopInvariant({
        kind: LoopInvariantKind.NONLINEAR_PROGRESSION,
        proven: true,
        evidence: nonlinear.evidence,
        location: transition.location
    }));
    invariants.push(createLoopInvariant({
        kind: LoopInvariantKind.PATH_COVERAGE,
        proven: transition.pathAnalysis == null ||
            transition.pathAnalysis.continuingPaths > 0,
        evidence: pathEvidence(
            transition.pathAnalysis
        ),
        location: transition.location
    }));

    return createLoopInvariantAnalysis({
        invariants,
        rankingFunction: nonlinear.measure,
        evidence: invariants.flatMap(invariant =>
            invariant.evidence
        )
    });
}

export function createLoopInvariantAnalysis({
    invariants = [],
    rankingFunction = null,
    evidence = []
} = {}) {
    if (rankingFunction != null) {
        requireCostExpression(
            rankingFunction,
            "loop invariant ranking function"
        );
    }

    const normalized = invariants.map(invariant =>
        invariant?.kind == null
            ? createLoopInvariant(invariant)
            : invariant
    );

    return Object.freeze({
        kind: "loop-invariant-analysis",
        invariants: Object.freeze(normalized),
        proven: normalized.length > 0 &&
            normalized.every(invariant =>
                invariant.proven
            ),
        rankingFunction: rankingFunction == null
            ? null
            : simplifyCostExpression(
                rankingFunction
            ),
        evidence: Object.freeze([
            ...new Set(evidence)
        ])
    });
}

function progressionDirection(update) {
    if (update?.piecewise === true) {
        return "piecewise";
    }

    if (update?.progression === "additive") {
        return update.amount > 0
            ? "ascending"
            : update.amount < 0
                ? "descending"
                : null;
    }

    if (update?.progression === "multiplicative") {
        return update.factor > 1
            ? "ascending"
            : update.factor > 0 &&
                update.factor < 1
                ? "descending"
                : null;
    }

    if (update?.progression === "affine") {
        return update.scale > 1 &&
            update.offset >= 0
            ? "ascending"
            : update.scale > 0 &&
                update.scale < 1
                ? "descending"
                : null;
    }

    return null;
}

function distanceForTransition(
    transition,
    direction
) {
    if (direction == null) {
        return null;
    }

    if (direction === "piecewise") {
        return simplifyCostExpression(
            Cost.call("ABS", [
                Cost.difference(
                    Cost.symbol(
                        transition.variable
                    ),
                    transition.bound
                )
            ])
        );
    }

    return simplifyCostExpression(
        direction === "ascending"
            ? Cost.difference(
                transition.bound,
                Cost.symbol(transition.variable)
            )
            : Cost.difference(
                Cost.symbol(transition.variable),
                transition.bound
            )
    );
}

function guardMatchesDirection(operator, direction) {
    if (direction === "piecewise") {
        return operator === "!=";
    }

    if (operator === "!=") {
        return direction != null;
    }

    return direction === "ascending"
        ? operator === "<" || operator === "<="
        : operator === ">" || operator === ">=";
}

function progressEvidence(update, direction) {
    if (direction == null) {
        return [
            "La transición no contiene un progreso direccional demostrable."
        ];
    }

    const detail = update.progression === "additive"
        ? update.piecewise === true
            ? "pasos aditivos por trayectoria"
            : `paso aditivo ${update.amount}`
        : update.progression === "multiplicative"
            ? `factor multiplicativo ${update.factor}`
            : `transformación afín ${update.scale}·x + ${update.offset}`;
    const directionLabel = direction === "ascending"
        ? "ascendente"
        : direction === "piecewise"
            ? "hacia el objetivo"
            : "descendente";

    return [
        `La transición tiene progreso ${directionLabel} mediante ${detail}.`
    ];
}

function pathEvidence(pathAnalysis) {
    if (pathAnalysis == null) {
        return [
            "La transición no requiere descomposición adicional de caminos."
        ];
    }

    return pathAnalysis.hasEarlyExit
        ? [
            "Las rutas que retornan terminan antes; las rutas restantes conservan la transición analizada."
        ]
        : [
            "Todos los caminos continuos considerados participan en la transición analizada."
        ];
}

function freezeRelationalProof(relation) {
    if (relation == null) {
        return null;
    }

    return Object.freeze({
        ...relation,
        updates: relation.updates == null
            ? Object.freeze([])
            : Object.freeze(
                relation.updates.map(update =>
                    Object.freeze({ ...update })
                )
            ),
        assumptions: relation.assumptions == null
            ? Object.freeze([])
            : Object.freeze([
                ...relation.assumptions
            ]),
        evidence: relation.evidence == null
            ? Object.freeze([])
            : Object.freeze([
                ...relation.evidence
            ])
    });
}

function freezeNonlinearProof(nonlinear) {
    if (nonlinear == null) {
        return null;
    }

    return Object.freeze({
        ...nonlinear,
        update: nonlinear.update == null
            ? null
            : Object.freeze({
                ...nonlinear.update
            }),
        assumptions: nonlinear.assumptions == null
            ? Object.freeze([])
            : Object.freeze([
                ...nonlinear.assumptions
            ]),
        evidence: nonlinear.evidence == null
            ? Object.freeze([])
            : Object.freeze([
                ...nonlinear.evidence
            ])
    });
}
