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
    method = null,
    code = null,
    message = null,
    measure = null,
    branches = 0,
    location = null
}) {
    return Object.freeze({
        status,
        notation:
            formatOrder(order),
        order,
        method,
        code,
        message,
        measure,
        branches,
        location:
            location == null
                ? null
                : Object.freeze({
                    ...location
                })
    });
}
