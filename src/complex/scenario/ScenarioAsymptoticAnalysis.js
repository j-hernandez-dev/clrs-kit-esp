import {
    AsymptoticAnalysisStatus
} from "../asymptotic/AsymptoticAnalysis.js";

export function createScenarioAsymptoticAnalysis({
    best,
    worst,
    confidence,
    assumptions = [],
    evidence = [],
    location = null
}) {
    return Object.freeze({
        best,
        worst,
        status:
            scenarioStatus(
                best,
                worst
            ),
        confidence:
            Object.freeze({
                best:
                    effectiveConfidence(
                        confidence?.best,
                        best
                    ),
                worst:
                    effectiveConfidence(
                        confidence?.worst,
                        worst
                    )
            }),
        assumptions:
            Object.freeze([
                ...assumptions
            ]),
        evidence:
            Object.freeze([
                ...evidence
            ]),
        location:
            location == null
                ? null
                : Object.freeze({
                    ...location
                })
    });
}

function effectiveConfidence(
    confidence,
    analysis
) {
    if (analysis?.boundKind === "upper") {
        return "upper-bound";
    }

    if (analysis?.boundKind === "lower") {
        return "lower-bound";
    }

    if (analysis?.boundKind === "unknown") {
        return "unknown";
    }

    return confidence ?? "unknown";
}

function scenarioStatus(best, worst) {
    if (
        best.status ===
            AsymptoticAnalysisStatus
                .DETERMINED &&
        worst.status ===
            AsymptoticAnalysisStatus
                .DETERMINED
    ) {
        return "determined";
    }

    if (
        best.status ===
            AsymptoticAnalysisStatus
                .UNKNOWN &&
        worst.status ===
            AsymptoticAnalysisStatus
                .UNKNOWN
    ) {
        return "unknown";
    }

    if (
        best.status !==
            AsymptoticAnalysisStatus
                .UNKNOWN &&
        worst.status !==
            AsymptoticAnalysisStatus
                .UNKNOWN &&
        (
            best.status ===
                AsymptoticAnalysisStatus
                    .CONDITIONAL ||
            worst.status ===
                AsymptoticAnalysisStatus
                    .CONDITIONAL
        )
    ) {
        return "conditional";
    }

    return "partial";
}
