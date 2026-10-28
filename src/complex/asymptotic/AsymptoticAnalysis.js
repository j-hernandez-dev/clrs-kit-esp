import {
    formatOrder
} from "./AsymptoticOrder.js";

export const AsymptoticAnalysisStatus =
    Object.freeze({
        DETERMINED: "determined",
        CONDITIONAL: "conditional",
        UNKNOWN: "unknown"
    });

export function createAsymptoticAnalysis(
    order,
    location = null,
    options = {}
) {
    const conditions =
        normalizeConditions(
            [
                ...(options?.conditions ?? []),
                ...(order.conditions ?? [])
            ]
        );
    const conditional =
        order.known &&
        conditions.length > 0;

    return Object.freeze({
        status:
            !order.known
                ? AsymptoticAnalysisStatus
                    .UNKNOWN
                : conditional
                    ? AsymptoticAnalysisStatus
                        .CONDITIONAL
                    : AsymptoticAnalysisStatus
                        .DETERMINED,
        notation:
            formatOrder(order),
        order,
        code:
            order.code,
        message:
            order.message ??
            (
                conditional
                    ? "El orden asintótico está demostrado bajo las condiciones indicadas."
                    : null
            ),
        conditions:
            Object.freeze(conditions),
        assumptions:
            Object.freeze(
                conditions.map(condition =>
                    condition.text
                )
            ),
        boundKind:
            order.boundKind ?? "tight",
        tight:
            (order.boundKind ?? "tight") ===
            "tight",
        eventualSign:
            order.eventualSign ??
            "non-negative",
        normalForm:
            order.normalForm ?? null,
        evidence:
            Object.freeze([
                ...(order.evidence ?? []),
                ...(options?.evidence ?? [])
            ]),
        location:
            location == null
                ? null
                : Object.freeze({
                    ...location
                })
    });
}

function normalizeConditions(conditions) {
    if (!Array.isArray(conditions)) {
        return [];
    }

    const unique =
        new Map();

    for (const condition of conditions) {
        if (
            condition?.kind ===
            "asymptotic-condition"
        ) {
            unique.set(
                condition.key,
                condition
            );
        }
    }

    return [...unique.values()]
        .sort((left, right) =>
            left.text.localeCompare(right.text)
        );
}
