import {
    CostExpressionKind,
    requireCostExpression
} from "../algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../algebra/CostExpressionFactory.js";
import {
    simplifyCostExpression
} from "../algebra/CostExpressionSimplifier.js";
import {
    IterationProgression
} from "./IterationAnalysis.js";

/**
 * Secuencia simbólica de estados observados al inicio de cada vuelta. El
 * índice es interno al álgebra de costos y no puede colisionar con un
 * identificador válido del programa fuente.
 */
export function createLoopTrajectory({
    transition,
    iterations
}) {
    if (transition?.kind !== "loop-transition") {
        return null;
    }

    requireCostExpression(
        iterations,
        "loop trajectory length"
    );

    const index =
        `#${transition.variable}:iteration`;
    const indexExpression = Cost.symbol(index);
    const value = trajectoryValue(
        transition,
        indexExpression
    );
    const magnitudeBound =
        trajectoryMagnitudeBound(
            transition
        );

    return Object.freeze({
        kind: "loop-trajectory",
        variable: transition.variable,
        index,
        length: iterations,
        start: transition.start,
        bound: transition.bound,
        condition: transition.condition,
        update: transition.update,
        value,
        magnitudeBound,
        postValue:
            transition.update
                ?.piecewise === true
                ? transition.bound
                : magnitudeBound,
        pathAnalysis:
            transition.pathAnalysis,
        boundKind:
            transition.boundKind,
        exact:
            transition.boundKind ===
                "tight" &&
            transition.update
                ?.piecewise !== true,
        evidence: Object.freeze(
            trajectoryEvidence(
                transition,
                value
            )
        )
    });
}

export function trajectoryValueAt(
    trajectory,
    indexExpression = null
) {
    if (trajectory?.kind !== "loop-trajectory") {
        return null;
    }

    if (indexExpression == null) {
        return trajectory.value;
    }

    requireCostExpression(
        indexExpression,
        "trajectory index"
    );

    return trajectoryValue(
        {
            start: trajectory.start,
            update: trajectory.update
        },
        indexExpression
    );
}

function trajectoryValue(
    transition,
    index
) {
    const update = transition.update;

    if (update?.piecewise === true) {
        return null;
    }

    if (
        update?.progression ===
            IterationProgression.ADDITIVE
    ) {
        return simplifyCostExpression(
            Cost.sum([
                transition.start,
                Cost.product([
                    Cost.constant(
                        update.amount
                    ),
                    index
                ])
            ])
        );
    }

    if (
        update?.progression ===
            IterationProgression.MULTIPLICATIVE &&
        update.relational !== true
    ) {
        return simplifyCostExpression(
            Cost.product([
                transition.start,
                Cost.power(
                    Cost.constant(
                        update.factor
                    ),
                    index
                )
            ])
        );
    }

    if (
        update?.progression ===
            IterationProgression.AFFINE &&
        update.scale !== 1
    ) {
        const power = Cost.power(
            Cost.constant(update.scale),
            index
        );
        const displacement = Cost.quotient(
            Cost.product([
                Cost.constant(update.offset),
                Cost.difference(
                    power,
                    Cost.constant(1)
                )
            ]),
            Cost.constant(
                update.scale - 1
            )
        );

        return simplifyCostExpression(
            Cost.sum([
                Cost.product([
                    transition.start,
                    power
                ]),
                displacement
            ])
        );
    }

    if (
        update?.progression ===
            IterationProgression.EXPONENTIAL &&
        Number.isFinite(update.degree)
    ) {
        return Cost.power(
            transition.start,
            Cost.power(
                Cost.constant(update.degree),
                index
            )
        );
    }

    return null;
}

function trajectoryMagnitudeBound(transition) {
    if (transition.relational != null) {
        return transition.relational
            .initialMeasure ??
            transition.relational.measure ??
            transition.bound;
    }

    if (
        transition.update?.piecewise === true
    ) {
        return simplifyCostExpression(
            Cost.call("ABS", [
                Cost.difference(
                    transition.start,
                    transition.bound
                )
            ])
        );
    }

    const direction = trajectoryDirection(
        transition.update
    );

    if (direction === "ascending") {
        return simplifyCostExpression(
            Cost.maximum([
                transition.start,
                transition.bound
            ])
        );
    }

    if (direction === "descending") {
        return simplifyCostExpression(
            Cost.maximum([
                transition.start,
                transition.bound
            ])
        );
    }

    return transition.bound;
}

function trajectoryDirection(update) {
    if (
        update?.progression ===
            IterationProgression.ADDITIVE
    ) {
        return update.amount > 0
            ? "ascending"
            : update.amount < 0
                ? "descending"
                : null;
    }

    if (
        update?.progression ===
            IterationProgression.MULTIPLICATIVE
    ) {
        return update.factor > 1
            ? "ascending"
            : update.factor > 0 &&
                update.factor < 1
                ? "descending"
                : null;
    }

    if (
        update?.progression ===
            IterationProgression.AFFINE
    ) {
        return update.scale > 1
            ? "ascending"
            : update.scale > 0 &&
                update.scale < 1
                ? "descending"
                : null;
    }

    if (
        update?.progression ===
            IterationProgression.EXPONENTIAL
    ) {
        return "ascending";
    }

    return null;
}

function trajectoryEvidence(transition, value) {
    if (transition.update?.piecewise === true) {
        return [
            "Cada trayectoria factible reduce la distancia absoluta respecto del límite."
        ];
    }

    if (value == null) {
        return [
            "La transición conserva una cota de magnitud, pero no una forma cerrada por iteración."
        ];
    }

    return [
        "La transición produce una forma cerrada del valor de control en la iteración k."
    ];
}

export function isGrowingTrajectory(trajectory) {
    if (trajectory?.kind !== "loop-trajectory") {
        return false;
    }

    const update = trajectory.update;

    return (
        update?.progression ===
            IterationProgression.MULTIPLICATIVE &&
        update.factor > 1
    ) || (
        update?.progression ===
            IterationProgression.AFFINE &&
        update.scale > 1
    );
}

export function isShrinkingTrajectory(trajectory) {
    if (trajectory?.kind !== "loop-trajectory") {
        return false;
    }

    const update = trajectory.update;

    return (
        update?.progression ===
            IterationProgression.MULTIPLICATIVE &&
        update.factor > 0 &&
        update.factor < 1
    ) || (
        update?.progression ===
            IterationProgression.AFFINE &&
        update.scale > 0 &&
        update.scale < 1
    );
}

export function isConstantTrajectoryLength(trajectory) {
    return trajectory?.length?.kind ===
        CostExpressionKind.CONSTANT;
}
