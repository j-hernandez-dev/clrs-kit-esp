import {
    formatLanguageError
} from "../../../src/errors/ErrorFormatter.js";

export default function DiagramDiagnostics({
    status,
    errors = []
}) {
    if (
        status !== "error" ||
        errors.length === 0
    ) {
        return null;
    }

    return (
        <aside
            className="diagram-diagnostics"
            role="alert"
            aria-live="polite"
        >
            <strong>
                No se pudo actualizar el diagrama
            </strong>

            {errors.map((error, index) => (
                <pre
                    key={
                        error.code ??
                        `${error.name}-${index}`
                    }
                >
                    {formatLanguageError(error)}
                </pre>
            ))}
        </aside>
    );
}
