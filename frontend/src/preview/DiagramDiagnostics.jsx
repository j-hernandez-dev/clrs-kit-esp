import {
    formatLanguageError,
    formatLocation
} from "../../../src/errors/ErrorFormatter.js";

export default function DiagramDiagnostics({
    status,
    errors = [],
    semanticDiagnostics = []
}) {
    const blockingErrors = status === "error"
        ? errors
        : [];

    if (
        blockingErrors.length === 0 &&
        semanticDiagnostics.length === 0
    ) {
        return null;
    }

    return (
        <aside
            className="diagram-diagnostics"
            role={
                blockingErrors.length > 0
                    ? "alert"
                    : "status"
            }
            aria-live="polite"
        >
            {blockingErrors.length > 0 && (
                <section>
                    <strong>
                        No se pudo actualizar el diagrama
                    </strong>

                    {blockingErrors.map(
                        (error, index) => (
                            <pre
                                key={
                                    error.code ??
                                    `${error.name}-${index}`
                                }
                            >
                                {formatLanguageError(
                                    error
                                )}
                            </pre>
                        )
                    )}
                </section>
            )}

            {semanticDiagnostics.length > 0 && (
                <section>
                    <strong>
                        Problemas semánticos detectados
                    </strong>

                    {semanticDiagnostics.map(
                        (diagnostic, index) => (
                            <pre
                                key={
                                    diagnostic.code ??
                                    `semantic-${index}`
                                }
                            >
                                {formatSemanticDiagnostic(
                                    diagnostic
                                )}
                            </pre>
                        )
                    )}
                </section>
            )}
        </aside>
    );
}

function formatSemanticDiagnostic(diagnostic) {
    const lines = [
        `[Error semántico] ${diagnostic.message}`
    ];

    if (
        diagnostic.location?.startLine != null
    ) {
        lines.push(
            formatLocation(
                diagnostic.location
            )
        );
    }

    return lines.join("\n");
}
