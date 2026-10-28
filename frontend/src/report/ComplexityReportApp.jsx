import {
    useEffect,
    useMemo,
    useState
} from "react";
import CallGraph from "./CallGraph.jsx";
import ScenarioSection, {
    StatusBadge,
    statusLabel
} from "./ScenarioSection.jsx";
import {
    complexityReportBridge
} from "./ComplexityReportBridge.js";
import "./report.css";

export default function ComplexityReportApp() {
    const [report, setReport] =
        useState(null);
    const [error, setError] =
        useState(null);
    const [selectedId, setSelectedId] =
        useState(null);
    const selected = useMemo(
        () =>
            report?.functions.find(
                item => item.id === selectedId
            ) ??
            report?.functions[0] ??
            null,
        [report, selectedId]
    );

    useEffect(
        () => {
            const disconnect =
                complexityReportBridge
                    .connect(message => {
                if (
                    message?.type ===
                    "complexity-report"
                ) {
                    setError(null);
                    setReport(message.report);
                    setSelectedId(current => {
                        const requested =
                            message
                                .selectedFunctionId;
                        const candidates = [
                            requested,
                            current,
                            message.report
                                .functions[0]?.id
                        ];

                        return candidates.find(
                            id =>
                                message.report
                                    .functions.some(
                                        item =>
                                            item.id === id
                                    )
                        ) ?? null;
                    });
                }

                if (
                    message?.type ===
                    "report-error"
                ) {
                    setError(message.error);
                }
                    });

            if (
                import.meta.env.DEV &&
                new URLSearchParams(
                    globalThis.location.search
                ).has("preview")
            ) {
                void import(
                    "./ReportPreviewFixture.js"
                ).then(module => {
                    setReport(
                        module.reportPreviewFixture
                    );
                    setSelectedId("TORDENA");
                });
            }

            return disconnect;
        },
        []
    );

    const handleSelect = functionId => {
        setSelectedId(functionId);
        complexityReportBridge
            .selectFunction(functionId);
    };
    const handleNavigate = location => {
        if (location) {
            complexityReportBridge
                .navigate(location);
        }
    };
    if (!report && !error) {
        return (
            <main className="report-state">
                <span className="report-spinner" />
                <p>
                    Analizando la versión actual…
                </p>
            </main>
        );
    }

    if (error) {
        return (
            <main className="report-state error">
                <span className="state-icon">
                    !
                </span>
                <h1>
                    El informe no está disponible
                </h1>
                <p>{error.message}</p>
            </main>
        );
    }

    return (
        <main className="complexity-report-app">
            <aside className="function-sidebar">
                <div className="report-brand">
                    <span className="brand-mark">
                        O
                    </span>
                    <div>
                        <strong>
                            Complejidad
                        </strong>
                        <small>
                            Informe algorítmico
                        </small>
                    </div>
                </div>

                <label htmlFor="function-selector">
                    Función
                </label>
                <select
                    id="function-selector"
                    value={selected?.id ?? ""}
                    onChange={event =>
                        handleSelect(
                            event.target.value
                        )
                    }
                >
                    {report.functions.map(
                        item => (
                            <option
                                key={item.id}
                                value={item.id}
                            >
                                {item.signature}
                            </option>
                        )
                    )}
                </select>

                <nav className="function-list">
                    {report.functions.map(item => (
                        <button
                            type="button"
                            key={item.id}
                            className={
                                item.id === selected?.id
                                    ? "selected"
                                    : ""
                            }
                            onClick={() =>
                                handleSelect(item.id)
                            }
                        >
                            <span>{item.name}</span>
                            <i className={item.status}>
                                {statusLabel(
                                    item.status
                                )}
                            </i>
                        </button>
                    ))}
                </nav>

                <div className="document-version">
                    <span>
                        {report.document.fileName}
                    </span>
                    <small>
                        Versión {report.document.version ?? "—"}
                    </small>
                </div>
            </aside>

            <section className="report-workspace">
                <header className="report-toolbar">
                    <div>
                        <span className="eyebrow">
                            Estado general
                        </span>
                        <StatusBadge
                            status={report.status}
                        />
                    </div>
                </header>

                {selected && (
                    <article
                        className="report-document"
                    >
                        <header className="function-header">
                            <div>
                                <span className="eyebrow">
                                    Análisis de función
                                </span>
                                <h1>
                                    {selected.signature}
                                </h1>
                                <p>
                                    Comparación separada del mejor y peor caso para la versión {report.document.version ?? "actual"} del documento.
                                </p>
                            </div>
                            <div className="function-actions">
                                <StatusBadge
                                    status={
                                        selected.status
                                    }
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleNavigate(
                                            selected.location
                                        )
                                    }
                                >
                                    Ir al código fuente
                                </button>
                            </div>
                        </header>

                        <div className="scenario-grid">
                            <ScenarioSection
                                scenario={selected.best}
                                onNavigate={handleNavigate}
                            />
                            <ScenarioSection
                                scenario={selected.worst}
                                onNavigate={handleNavigate}
                            />
                        </div>

                        {(selected.assumptions.length > 0 ||
                            selected.evidence.length > 0) && (
                            <details className="report-section context-section">
                                <summary>
                                    <span>
                                        Supuestos y evidencia
                                    </span>
                                    <small>
                                        Contexto del análisis
                                    </small>
                                </summary>
                                <div className="context-columns">
                                    <ContextList
                                        title="Supuestos"
                                        values={
                                            selected.assumptions
                                        }
                                    />
                                    <ContextList
                                        title="Evidencia"
                                        values={
                                            selected.evidence
                                        }
                                    />
                                </div>
                            </details>
                        )}

                        <CallGraph
                            graph={selected.callGraph}
                            onNavigate={handleNavigate}
                        />
                    </article>
                )}
            </section>
        </main>
    );
}

function ContextList({ title, values }) {
    if (values.length === 0) return null;

    return (
        <div>
            <h3>{title}</h3>
            <ul>
                {values.map(value => (
                    <li key={value}>{value}</li>
                ))}
            </ul>
        </div>
    );
}
