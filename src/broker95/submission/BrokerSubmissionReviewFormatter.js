import {
    BrokerReviewFindingSeverity,
    BrokerSubmissionReadiness
} from "./BrokerSubmissionReview.js";

const READINESS_LABELS = Object.freeze({
    [BrokerSubmissionReadiness.READY]:
        "LISTA PARA ENTREGA",
    [BrokerSubmissionReadiness.NEEDS_CHANGES]:
        "REQUIERE CAMBIOS",
    [BrokerSubmissionReadiness.BLOCKED]:
        "BLOQUEADA"
});

const SEVERITY_LABELS = Object.freeze({
    [BrokerReviewFindingSeverity.CRITICAL]:
        "CRÍTICO",
    [BrokerReviewFindingSeverity.IMPORTANT]:
        "IMPORTANTE",
    [BrokerReviewFindingSeverity.IMPROVEMENT]:
        "MEJORA"
});

export function formatBrokerSubmissionReview(
    result
) {
    const review = result?.review;

    if (
        review == null ||
        !Array.isArray(review.findings) ||
        !Array.isArray(review.nextSteps)
    ) {
        throw new TypeError(
            "Invalid BROKER.95 submission review result."
        );
    }

    const tests = result.deterministicEvidence
        ?.testSummary;
    const testLine = tests
        ? `Pruebas: ${tests.passed}/${tests.total} superadas`
        : "Pruebas: sin resumen disponible";
    const lines = [
        "REVISIÓN NO DEFINITIVA",
        `Estado: ${READINESS_LABELS[review.readiness]}`,
        testLine,
        "",
        review.summary
    ];

    if (review.findings.length > 0) {
        lines.push("", "HALLAZGOS");

        review.findings.forEach(
            (finding, index) => {
                const location = finding.location
                    ? ` · ${finding.location}`
                    : "";

                lines.push(
                    `${index + 1}. [${SEVERITY_LABELS[finding.severity]}] ${finding.criterion}${location}`,
                    `   Problema: ${finding.problem}`,
                    `   Evidencia: ${finding.evidence}`,
                    `   Recomendación: ${finding.recommendation}`
                );
            }
        );
    }

    if (review.nextSteps.length > 0) {
        lines.push("", "SIGUIENTES PASOS");
        review.nextSteps.forEach(
            (step, index) => {
                lines.push(`${index + 1}. ${step}`);
            }
        );
    }

    lines.push(
        "",
        "Puedes corregir el documento activo y ejecutar ai -review nuevamente."
    );

    return lines.join("\n");
}
