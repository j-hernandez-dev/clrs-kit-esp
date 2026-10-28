import Formula from "./Formula.jsx";
import InterproceduralTrace from "./InterproceduralTrace.jsx";
import AsymptoticGrowthChart from "./AsymptoticGrowthChart.jsx";

const SCENARIO_LABELS = {
    best: "Mejor caso",
    worst: "Peor caso"
};

export default function ScenarioSection({
    scenario,
    onNavigate
}) {
    return (
        <section
            className={`scenario-card ${scenario.name}`}
        >
            <header className="scenario-header">
                <div>
                    <span className="eyebrow">
                        {SCENARIO_LABELS[
                            scenario.name
                        ]}
                    </span>
                    <Formula
                        latex={
                            scenario.conclusion
                                ?.latex ??
                            scenario.asymptotic
                                .latex
                        }
                    />
                </div>
                <ResultBadge
                    conclusion={
                        scenario.conclusion
                    }
                />
            </header>

            <div className="result-conclusion">
                <strong>
                    {scenario.conclusion
                        ?.label ??
                        "Alcance no especificado"}
                </strong>
                <p>
                    {scenario.conclusion
                        ?.summary ??
                        "Consulta el desarrollo para conocer el alcance del resultado."}
                </p>
            </div>

            <AsymptoticGrowthChart
                scenario={scenario}
            />

            {scenario.conclusion?.proof != null && (
                <details
                    className="report-section proof-verification"
                    open
                >
                    <summary>
                        <span>
                            {"Verificaci\u00f3n del resultado"}
                        </span>
                        <small>
                            {proofStatusLabel(
                                scenario.conclusion
                                    .proof.status
                            )}
                        </small>
                    </summary>
                    <dl className="proof-grid">
                        <div>
                            <dt>Confianza</dt>
                            <dd>
                                {confidenceLabel(
                                    scenario.conclusion
                                        .proof.confidence
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt>Alcance</dt>
                            <dd>
                                {boundKindLabel(
                                    scenario.conclusion
                                        .proof.boundKind
                                )}
                            </dd>
                        </div>
                    </dl>
                    {scenario.conclusion.proof
                        .evidence.length > 0 && (
                        <ul className="condition-list">
                            {scenario.conclusion
                                .proof.evidence.map(
                                    evidence => (
                                        <li key={evidence}>
                                            {evidence}
                                        </li>
                                    )
                                )}
                        </ul>
                    )}
                </details>
            )}

            {scenario.asymptotic.conditions.length > 0 && (
                <details className="report-section conditions" open>
                    <summary>
                        <span>
                            Condiciones asintóticas
                        </span>
                        <small>
                            {scenario.asymptotic.conditions.length}
                        </small>
                    </summary>
                    <ul className="condition-list">
                        {scenario.asymptotic.conditions.map(
                            condition => (
                                <li key={condition}>
                                    {condition}
                                </li>
                            )
                        )}
                    </ul>
                </details>
            )}

            {scenario.recurrence != null && (
                <details className="report-section conditions" open>
                    <summary>
                        <span>
                            Resolución de la recurrencia
                        </span>
                        <small>
                            {scenario.recurrence.tight
                                ? "ajustada"
                                : "cota superior"}
                        </small>
                    </summary>
                    <div className="scenario-meta">
                        Método: {recurrenceMethodLabel(
                            scenario.recurrence.method
                        )}
                    </div>
                    {scenario.recurrence.evidence.length > 0 && (
                        <ul className="condition-list">
                            {scenario.recurrence.evidence.map(
                                evidence => (
                                    <li key={evidence}>
                                        {evidence}
                                    </li>
                                )
                            )}
                        </ul>
                    )}
                </details>
            )}

            <details
                className="report-section"
                open
            >
                <summary>
                    <span>
                        Desarrollo de la simplificación
                    </span>
                    <small>
                        {scenario.explanations.length}
                        {" pasos"}
                    </small>
                </summary>

                <ol className="simplification-steps">
                    {scenario.explanations.map(
                        (step, index) => (
                            <li
                                key={step.stage}
                            >
                                <span className="step-index">
                                    {index + 1}
                                </span>
                                <div className="step-content">
                                    <h4>
                                        {step.title}
                                    </h4>
                                    <Formula
                                        latex={
                                            step.formula
                                                .latex
                                        }
                                    />
                                    <p>
                                        {step.explanation}
                                    </p>
                                </div>
                            </li>
                        )
                    )}
                </ol>
            </details>

            <InterproceduralTrace
                trace={scenario.interprocedural}
                onNavigate={onNavigate}
            />

            {scenario.reasons.length > 0 && (
                <details className="report-section unresolved">
                    <summary>
                        <span>
                            Información pendiente
                        </span>
                        <small>
                            {scenario.reasons.length}
                        </small>
                    </summary>
                    <ul className="reason-list">
                        {scenario.reasons.map(
                            reason => (
                                <li key={`${reason.code}-${reason.message}`}>
                                    <code>
                                        {reason.code}
                                    </code>
                                    <span>
                                        {reason.message}
                                    </span>
                                </li>
                            )
                        )}
                    </ul>
                </details>
            )}
        </section>
    );
}

export function StatusBadge({ status }) {
    return (
        <span
            className={`status-badge ${status}`}
        >
            {statusLabel(status)}
        </span>
    );
}

export function ResultBadge({ conclusion }) {
    const kind =
        conclusion?.kind ??
        "unknown";

    return (
        <span
            className={[
                "result-badge",
                kind,
                conclusion?.conditional
                    ? "conditional"
                    : ""
            ].filter(Boolean).join(" ")}
        >
            {conclusion?.label ??
                "No determinado"}
        </span>
    );
}

export function statusLabel(status) {
    switch (status) {
        case "known":
            return "Resultado disponible";
        case "conditional":
            return "Bajo condiciones";
        case "partial":
            return "Parcial";
        default:
            return "No determinado";
    }
}

function recurrenceMethodLabel(method) {
    switch (method) {
        case "factorial-product":
            return "producto factorial";
        case "generalized-factorial-product":
            return "producto factorial generalizado";
        case "quasi-polynomial-product":
            return "producto cuasipolinomial";
        case "mixed-reduction-upper-bound":
            return "mayoración de reducciones mixtas";
        default:
            return method ?? "no especificado";
    }
}

function proofStatusLabel(status) {
    switch (status) {
        case "verified":
            return "demostrado";
        case "conditional":
            return "condicionado";
        case "partial":
            return "parcial";
        default:
            return "sin demostrar";
    }
}

function confidenceLabel(confidence) {
    switch (confidence) {
        case "exact":
            return "ajustada";
        case "upper-bound":
            return "cota superior";
        case "lower-bound":
            return "cota inferior";
        case "syntactic-bound":
            return "cota estructural";
        default:
            return "no concluyente";
    }
}

function boundKindLabel(boundKind) {
    switch (boundKind) {
        case "tight":
            return "superior e inferior";
        case "upper":
            return "s\u00f3lo superior";
        case "lower":
            return "s\u00f3lo inferior";
        default:
            return "no determinado";
    }
}
