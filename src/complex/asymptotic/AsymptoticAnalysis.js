import {
    formatOrder
} from "./AsymptoticOrder.js";

export const AsymptoticAnalysisStatus =
    Object.freeze({
        DETERMINED: "determined",
        UNKNOWN: "unknown"
    });

export function createAsymptoticAnalysis(
    order,
    location = null
) {
    return Object.freeze({
        status:
            order.known
                ? AsymptoticAnalysisStatus
                    .DETERMINED
                : AsymptoticAnalysisStatus
                    .UNKNOWN,
        notation:
            formatOrder(order),
        order,
        code:
            order.code,
        message:
            order.message,
        location:
            location == null
                ? null
                : Object.freeze({
                    ...location
                })
    });
}
