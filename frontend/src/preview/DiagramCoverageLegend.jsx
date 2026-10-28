export default function DiagramCoverageLegend({
    coverage
}) {
    if (coverage == null) {
        return null;
    }

    const total = coverage.summary.totalPoints;
    const covered =
        coverage.summary.coveredPoints;
    const percentage = total === 0
        ? 0
        : Math.round(covered * 100 / total);
    const incomplete =
        !coverage.complete || coverage.truncated;

    return (
        <aside
            className="diagram-coverage-legend"
            aria-label="Cobertura de pruebas del diagrama"
        >
            <span className="coverage-summary">
                Cobertura {percentage}%
            </span>
            <span className="coverage-key covered">
                <b aria-hidden="true">✓</b>
                Cubierto
            </span>
            <span className="coverage-key partial">
                <b aria-hidden="true">◐</b>
                Parcial
            </span>
            <span className="coverage-key uncovered">
                <b aria-hidden="true">
                    {incomplete ? "?" : "○"}
                </b>
                {incomplete
                    ? "Sin evidencia"
                    : "No ejecutado"}
            </span>
        </aside>
    );
}
