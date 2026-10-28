import {
    requireCostExpression
} from "../algebra/CostExpression.js";

export const TerminationAnalysisStatus =
    Object.freeze({
        TERMINATES: "terminates",
        MAY_TERMINATE: "may-terminate",
        NON_TERMINATING:
            "non-terminating",
        UNKNOWN: "unknown"
    });

export function createTerminationAnalysis({
    status,
    code = null,
    message = null,
    rankingFunction = null,
    rankingKind = null,
    pathAnalysis = null,
    transition = null,
    invariants = null,
    evidence = [],
    location = null
}) {
    if (rankingFunction != null) {
        requireCostExpression(
            rankingFunction,
            "termination ranking function"
        );
    }

    return Object.freeze({
        kind: "termination-analysis",
        status,
        guaranteed:
            status ===
            TerminationAnalysisStatus
                .TERMINATES,
        code,
        message,
        rankingFunction,
        rankingKind,
        pathAnalysis,
        transition,
        invariants,
        evidence:
            Object.freeze([...evidence]),
        location:
            location == null
                ? null
                : Object.freeze({
                    ...location
                })
    });
}

export function terminatingAnalysis({
    rankingFunction = null,
    rankingKind = null,
    pathAnalysis = null,
    evidence = [],
    location = null
} = {}) {
    return createTerminationAnalysis({
        status:
            TerminationAnalysisStatus
                .TERMINATES,
        rankingFunction,
        rankingKind,
        pathAnalysis,
        evidence,
        location
    });
}

export function unresolvedTermination({
    code,
    message,
    pathAnalysis = null,
    location = null
}) {
    const status =
        code ===
            "CLRS_ITERATION_NON_TERMINATING"
            ? TerminationAnalysisStatus
                .NON_TERMINATING
            : code ===
                "CLRS_ITERATION_TERMINATION_CONDITIONAL" ||
              code ===
                "CLRS_ITERATION_UPDATE_PATH_INCOMPLETE" ||
              code ===
                "CLRS_ITERATION_UPDATE_CONFLICT"
              || code ===
                "CLRS_ITERATION_DIRECTION_MISMATCH"
              || code ===
                "CLRS_ITERATION_BOUND_MUTATED"
                ? TerminationAnalysisStatus
                    .MAY_TERMINATE
                : TerminationAnalysisStatus
                    .UNKNOWN;

    return createTerminationAnalysis({
        status,
        code,
        message,
        pathAnalysis,
        location
    });
}
