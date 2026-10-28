import {
    AsymptoticAnalysisStatus
} from "../asymptotic/AsymptoticAnalysis.js";

export const ComplexityResultKind =
    Object.freeze({
        TIGHT: "tight",
        UPPER_BOUND: "upper-bound",
        LOWER_BOUND: "lower-bound",
        SYNTACTIC_BOUND:
            "syntactic-bound",
        UNQUALIFIED: "unqualified",
        UNKNOWN: "unknown"
    });

/**
 * Traduce el resultado técnico a una afirmación que no promete más de lo
 * demostrado. La notación histórica del analizador permanece intacta; esta
 * vista decide si corresponde comunicar Θ, O, Ω o ningún orden.
 */
export function presentComplexityResult({
    analysis,
    confidence = "unknown",
    boundKind = null
} = {}) {
    const sourceNotation =
        analysis?.notation ?? "O(?)";
    const unknown =
        analysis == null ||
        analysis.status ===
            AsymptoticAnalysisStatus
                .UNKNOWN ||
        sourceNotation === "O(?)";

    if (unknown) {
        return presentation({
            kind:
                ComplexityResultKind
                    .UNKNOWN,
            confidence: "unknown",
            conditional: false,
            operator: null,
            notation: "No determinado",
            sourceNotation,
            label: "No determinado",
            summary:
                "La información disponible no permite justificar una cota asintótica. Las causas pendientes se muestran debajo."
        });
    }

    const conditional =
        analysis.status ===
            AsymptoticAnalysisStatus
                .CONDITIONAL;
    const effectiveBoundKind =
        boundKind ??
        analysis.boundKind ??
        null;
    const effectiveConfidence =
        effectiveBoundKind === "upper"
            ? "upper-bound"
            : effectiveBoundKind === "lower"
                ? "lower-bound"
                : effectiveBoundKind === "unknown"
                    ? "unknown"
                    : confidence;
    const claim = claimFor(
        effectiveConfidence
    );

    return presentation({
        ...claim,
        confidence:
            effectiveConfidence,
        conditional,
        notation:
            replaceOperator(
                sourceNotation,
                claim.operator
            ),
        sourceNotation,
        label:
            conditional
                ? claim.conditionalLabel
                : claim.label,
        summary:
            conditional
                ? claim.conditionalSummary
                : claim.summary,
        analysisStatus:
            analysis.status,
        boundKind:
            effectiveBoundKind,
        proofStatus:
            proofStatusFor(
                claim.kind,
                conditional
            )
    });
}

function proofStatusFor(kind, conditional) {
    if (
        kind === ComplexityResultKind.UNKNOWN
    ) {
        return "unverified";
    }

    if (
        kind ===
            ComplexityResultKind.UNQUALIFIED
    ) {
        return "partial";
    }

    return conditional
        ? "conditional"
        : "verified";
}

function claimFor(confidence) {
    switch (confidence) {
        case "exact":
            return {
                kind:
                    ComplexityResultKind
                        .TIGHT,
                operator: "Θ",
                label:
                    "Orden ajustado",
                conditionalLabel:
                    "Orden ajustado bajo condiciones",
                summary:
                    "El crecimiento está demostrado como cota superior e inferior dentro del modelo de costo.",
                conditionalSummary:
                    "El crecimiento es ajustado únicamente cuando se cumplen todas las condiciones indicadas."
            };
        case "upper-bound":
            return {
                kind:
                    ComplexityResultKind
                        .UPPER_BOUND,
                operator: "O",
                label:
                    "Cota superior demostrada",
                conditionalLabel:
                    "Cota superior condicionada",
                summary:
                    "Se garantiza que el crecimiento no supera asintóticamente esta cota; podría existir una cota más ajustada.",
                conditionalSummary:
                    "Esta cota superior sólo está demostrada cuando se cumplen todas las condiciones indicadas."
            };
        case "lower-bound":
            return {
                kind:
                    ComplexityResultKind
                        .LOWER_BOUND,
                operator: "Ω",
                label:
                    "Cota inferior demostrada",
                conditionalLabel:
                    "Cota inferior condicionada",
                summary:
                    "Se garantiza que el crecimiento es al menos de este orden; no se afirma una cota superior equivalente.",
                conditionalSummary:
                    "Esta cota inferior sólo está demostrada cuando se cumplen todas las condiciones indicadas."
            };
        case "syntactic-bound":
            return {
                kind:
                    ComplexityResultKind
                        .SYNTACTIC_BOUND,
                operator: "O",
                label:
                    "Cota estructural conservadora",
                conditionalLabel:
                    "Cota estructural condicionada",
                summary:
                    "La estructura sintáctica permite esta cota conservadora, pero no demuestra que sea ajustada.",
                conditionalSummary:
                    "La estructura sintáctica permite esta cota sólo bajo las condiciones indicadas y no demuestra que sea ajustada."
            };
        default:
            return {
                kind:
                    ComplexityResultKind
                        .UNQUALIFIED,
                operator: "O",
                label:
                    "Orden disponible",
                conditionalLabel:
                    "Orden disponible bajo condiciones",
                summary:
                    "El analizador obtuvo este orden, pero la evidencia actual no permite afirmar que sea ajustado.",
                conditionalSummary:
                    "El orden depende de las condiciones indicadas y la evidencia actual no permite afirmar que sea ajustado."
            };
    }
}

function presentation(value) {
    return Object.freeze({
        kind: value.kind,
        confidence: value.confidence,
        conditional: value.conditional,
        operator: value.operator,
        notation: value.notation,
        sourceNotation:
            value.sourceNotation,
        label: value.label,
        summary: value.summary,
        proofStatus:
            value.proofStatus ??
            "unverified",
        analysisStatus:
            value.analysisStatus ??
            "unknown",
        boundKind:
            value.boundKind ?? null,
        verified:
            value.proofStatus ===
                "verified" ||
            value.proofStatus ===
                "conditional"
    });
}

function replaceOperator(
    notation,
    operator
) {
    if (operator == null) {
        return notation;
    }

    return String(notation).replace(
        /^[OΘΩ](?=\()/,
        operator
    );
}
