import {
    getBrokerEvaluationRubric
} from "./BrokerEvaluationRubric.js";

const DIMENSION_LABELS = Object.freeze({
    functionality: "Funcionalidad",
    robustness: "Robustez",
    design: "Diseño"
});

const SEVERITY_LABELS = Object.freeze({
    critical: "CRÍTICO",
    important: "IMPORTANTE",
    improvement: "MEJORA"
});

export function formatBrokerSubmissionPush(result) {
    requireResult(result);

    const rubric = getBrokerEvaluationRubric(
        result.contract.risk
    );
    const testSummary = result.deterministicEvidence
        ?.testSummary;
    const lines = [
        "ENTREGA DEFINITIVA",
        `Contrato #${result.contract.id}: ${result.contract.title}`,
        `Estado: ${result.contract.completed ? "COMPLETADO" : "FALLIDO"}`,
        `Documento: ${result.document.name} · versión ${result.document.version}`,
        testSummary
            ? `Pruebas: ${testSummary.passed}/${testSummary.total} superadas`
            : "Pruebas: sin resumen disponible",
        "",
        `Calificación final: ${result.finalScore}/100`,
        `Paga potencial: ${formatMoney(result.contract.payPotential)}`,
        `Porcentaje pagado en este intento: ${Math.round(result.contract.payoutMultiplier * 100)}%`,
        `Paga recibida: ${formatMoney(result.contract.payout)}`,
        `Saldo actual: ${formatMoney(result.settlement.money)}`
    ];

    if (result.learning != null) {
        lines.push(
            "",
            ...formatLearningSettlement(
                result.learning
            )
        );
    }

    lines.push("", "DIMENSIONES");

    rubric.dimensions.forEach(dimension => {
        const score = result.dimensionScores[
            dimension.dimension
        ];

        lines.push(
            `${DIMENSION_LABELS[dimension.dimension]}: ${score}/100 · peso ${formatPercent(dimension.finalWeight)}`
        );
    });

    lines.push("", "SUBCRITERIOS");

    rubric.dimensions.forEach(dimension => {
        dimension.criteria.forEach(criterion => {
            const evaluation = result.evaluation.criteria
                .find(item =>
                    item.criterion ===
                        criterion.criterion
                );

            lines.push(
                `${criterion.criterion} ${criterion.label}: ${result.criterionScores[criterion.criterion]}/100`,
                `   Evidencia: ${evaluation.evidence.join(" · ")}`,
                `   Justificación: ${evaluation.rationale}`
            );
        });
    });

    lines.push(
        "",
        "EVALUACIÓN DE CIPHER",
        result.evaluation.summary
    );

    if (result.evaluation.findings.length > 0) {
        lines.push("", "HALLAZGOS");

        result.evaluation.findings.forEach(
            (finding, index) => {
                const location = finding.location
                    ? ` · ${finding.location}`
                    : "";

                lines.push(
                    `${index + 1}. [${SEVERITY_LABELS[finding.severity]}] ${finding.criterion}${location}`,
                    `   Problema: ${finding.problem}`,
                    `   Recomendación: ${finding.recommendation}`
                );
            }
        );
    }

    lines.push(
        "",
        result.learning == null
            ? "El contrato quedó cerrado y esta entrega no puede repetirse."
            : "El intento quedó cerrado. Puedes volver a la lección para obtener otro contrato cuando corresponda."
    );

    return lines.join("\n");
}

function formatLearningSettlement(learning) {
    let resultLabel;

    if (learning.firstCompletion) {
        resultLabel = "LECCIÓN COMPLETADA";
    } else if (
        learning.passed &&
        learning.repetition
    ) {
        resultLabel =
            "REPETICIÓN APROBADA";
    } else if (learning.repetition) {
        resultLabel =
            "REPETICIÓN NO APROBADA · LA LECCIÓN CONTINÚA COMPLETADA";
    } else {
        resultLabel =
            "INTENTO NO APROBADO · LA LECCIÓN SIGUE DISPONIBLE";
    }

    const lines = [
        "PROGRESO DE APRENDIZAJE",
        `Lección: ${learning.lessonId}`,
        `Resultado: ${resultLabel}`,
        `Ruta: ${learning.completedLessons}/${learning.totalLessons} lecciones completadas`,
        learning.bestScore == null
            ? "Mejor calificación: sin aprobación"
            : `Mejor calificación: ${learning.bestScore}/100`,
        `Recompensa acumulada de la lección: ${formatMoney(learning.reward.earnedToDate)} de ${formatMoney(learning.reward.baseReward)}`
    ];

    if (learning.firstCompletion) {
        lines.push(
            learning.routeCompleted
                ? "Siguiente paso: RUTA COMPLETADA"
                : `Siguiente lección: ${learning.currentLessonId}`
        );
    } else if (
        learning.repetition &&
        learning.reward.payout === 0
    ) {
        lines.push(
            "Paga de mejora: USD 0; esta repetición no superó la mejor calificación anterior."
        );
    }

    return lines;
}

function requireResult(result) {
    if (
        result == null ||
        typeof result !== "object" ||
        result.contract == null ||
        result.document == null ||
        result.evaluation == null ||
        !Array.isArray(result.evaluation.criteria) ||
        !Array.isArray(result.evaluation.findings) ||
        result.settlement?.performed !== true
    ) {
        throw new TypeError(
            "Invalid BROKER.95 submission push result."
        );
    }
}

function formatMoney(value) {
    return `USD ${Number(value).toLocaleString("en-US")}`;
}

function formatPercent(value) {
    return `${Number(value * 100).toLocaleString("es-MX", {
        maximumFractionDigits: 1
    })}%`;
}
