import {
    formatOrder
} from "../asymptotic/AsymptoticOrder.js";

export const RecurrenceAnalysisStatus =
    Object.freeze({
        SOLVED: "solved",
        UNSUPPORTED: "unsupported"
    });

export function createRecurrenceAnalysis({
    status,
    order,
    scenario = "worst",
    method = null,
    code = null,
    message = null,
    measure = null,
    branches = 0,
    location = null,
    boundKind = "tight",
    characteristic = null,
    system = null,
    evidence = [],
    soundness = null
}) {
    return Object.freeze({
        status,
        scenario,
        notation:
            formatOrder(order),
        order,
        method,
        code,
        message,
        measure,
        branches,
        boundKind,
        tight:
            boundKind === "tight",
        characteristic,
        system,
        evidence:
            Object.freeze([
                ...evidence
            ]),
        soundness:
            soundness == null
                ? null
                : Object.freeze({
                    ...soundness,
                    evidence:
                        Object.freeze([
                            ...(soundness
                                .evidence ?? [])
                        ])
                }),
        location:
            location == null
                ? null
                : Object.freeze({
                    ...location
                })
    });
}
