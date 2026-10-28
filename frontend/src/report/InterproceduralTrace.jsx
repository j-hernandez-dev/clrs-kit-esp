import Formula from "./Formula.jsx";

export default function InterproceduralTrace({
    trace,
    onNavigate
}) {
    if (trace == null) {
        return null;
    }

    return (
        <details
            className="report-section interprocedural"
            open
        >
            <summary>
                <span>{trace.title}</span>
                <small>
                    {countCalls(trace.traces)} llamadas
                </small>
            </summary>
            <p className="interprocedural-summary">
                {trace.summary}
            </p>
            <div className="interprocedural-traces">
                {trace.traces.map(item => (
                    <TraceStep
                        key={item.id}
                        step={item}
                        onNavigate={onNavigate}
                    />
                ))}
            </div>
        </details>
    );
}

function TraceStep({ step, onNavigate }) {
    const caller = step.caller?.name;
    const ignoredMissing =
        step.transfer?.ignoredMissing ?? [];
    const relevantMissing =
        step.missing.filter(parameter =>
            !ignoredMissing.includes(parameter)
        );

    return (
        <section className="trace-step">
            <header className="trace-step-header">
                <div>
                    <span className="trace-step-eyebrow">
                        {caller == null
                            ? "Función analizada"
                            : `${caller} llama a`}
                    </span>
                    <button
                        className="trace-function"
                        type="button"
                        onClick={() =>
                            onNavigate(step.location)
                        }
                    >
                        {step.functionName}
                    </button>
                </div>
                <TraceResult result={step.result} />
            </header>

            {step.bindings.length > 0 && (
                <div className="trace-bindings">
                    {step.bindings.map(binding => (
                        <div
                            className="trace-binding"
                            key={binding.parameter}
                        >
                            <code>{binding.parameter}</code>
                            <span>=</span>
                            <Formula
                                latex={
                                    binding.argument.latex
                                }
                                display={false}
                            />
                        </div>
                    ))}
                </div>
            )}

            {step.transfer?.replacements.length > 0 && (
                <div className="trace-bindings transfer-bindings">
                    {step.transfer.replacements.map(
                        replacement => (
                            <div
                                className="trace-binding"
                                key={replacement.variable}
                            >
                                <code>
                                    {replacement.variable}
                                </code>
                                <span>{"\u21d2"}</span>
                                <code>
                                    {replacement.notation}
                                </code>
                            </div>
                        )
                    )}
                </div>
            )}

            {relevantMissing.length > 0 && (
                <p className="trace-warning">
                    Faltan argumentos relevantes para: {relevantMissing.join(", ")}.
                </p>
            )}

            {ignoredMissing.length > 0 && (
                <p className="trace-note">
                    Los argumentos ausentes para {ignoredMissing.join(", ")} no intervienen en el orden propagado.
                </p>
            )}

            {step.extraArguments.length > 0 && (
                <p className="trace-note">
                    La llamada incluye argumentos adicionales que no intervienen en este costo.
                </p>
            )}

            {step.children.length > 0 && (
                <div className="trace-children">
                    {step.children.map(child => (
                        <TraceStep
                            key={child.id}
                            step={child}
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

function TraceResult({ result }) {
    return (
        <span
            className={
                `trace-result ${result.status}`
            }
        >
            {result.status === "resolved"
                ? result.notation
                : "Sin resolver"}
        </span>
    );
}

function countCalls(traces) {
    return traces.reduce(
        (count, trace) =>
            count + countTrace(trace),
        0
    );
}

function countTrace(trace) {
    return 1 + trace.children.reduce(
        (count, child) =>
            count + countTrace(child),
        0
    );
}
