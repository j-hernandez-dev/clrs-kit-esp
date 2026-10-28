import {
    useEffect,
    useRef,
    useState
} from "react";
import {
    createDiagramFunctionDraft,
    createDiagramFunctionIntent,
    updateDiagramFunctionDraft,
    validateDiagramFunctionDraft
} from "../editor/DiagramFunctionEditorModel.js";

export default function DiagramFunctionEditor({
    onCancel = null,
    onAccept = null,
    operation = null
}) {
    const [draft, setDraft] = useState(
        createDiagramFunctionDraft
    );
    const firstFieldRef = useRef(null);
    const validation =
        validateDiagramFunctionDraft(draft);
    const pending =
        operation?.operation ===
            "create-function" &&
        operation.pending === true;
    const error =
        operation?.operation ===
            "create-function"
            ? operation.error
            : null;

    useEffect(() => {
        firstFieldRef.current?.focus?.({
            preventScroll: true
        });
    }, []);

    const handleKeyDown = event => {
        if (event.key !== "Escape") {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (!pending) {
            onCancel?.();
        }
    };
    const handleSubmit = event => {
        event.preventDefault();

        if (
            !validation.valid ||
            pending ||
            !onAccept
        ) {
            return;
        }

        onAccept(
            createDiagramFunctionIntent(draft)
        );
    };

    return (
        <section
            className="diagram-node-editor diagram-function-editor"
            role="dialog"
            aria-modal="false"
            aria-labelledby="diagram-function-editor-title"
            onKeyDown={handleKeyDown}
        >
            <header className="diagram-node-editor-header">
                <div className="diagram-node-editor-heading">
                    <span className="diagram-node-editor-eyebrow">
                        CREAR SUBPROCESO
                    </span>
                    <h2 id="diagram-function-editor-title">
                        Subproceso · función
                    </h2>
                </div>
            </header>

            <form
                className="diagram-node-editor-form"
                onSubmit={handleSubmit}
            >
                <div className="diagram-node-editor-fields">
                    {draft.fields.map(
                        (field, index) => (
                            <label
                                key={field.name}
                                className="diagram-node-editor-field"
                            >
                                <span>
                                    {field.label}
                                    {field.required && (
                                        <span
                                            className="diagram-node-editor-required"
                                            aria-hidden="true"
                                        >
                                            *
                                        </span>
                                    )}
                                </span>
                                <input
                                    ref={
                                        index === 0
                                            ? firstFieldRef
                                            : null
                                    }
                                    type="text"
                                    name={field.name}
                                    value={
                                        draft.values[
                                            field.name
                                        ]
                                    }
                                    placeholder={
                                        field.placeholder
                                    }
                                    required={
                                        field.required
                                    }
                                    spellCheck="false"
                                    autoComplete="off"
                                    disabled={pending}
                                    onChange={event =>
                                        setDraft(current =>
                                            updateDiagramFunctionDraft(
                                                current,
                                                field.name,
                                                event.target.value
                                            )
                                        )
                                    }
                                />
                            </label>
                        )
                    )}

                </div>

                {!validation.valid && (
                    <p
                        className="diagram-node-editor-validation"
                        role="status"
                    >
                        Escribe un identificador para el subproceso.
                    </p>
                )}

                {pending && (
                    <p
                        className="diagram-node-editor-status"
                        role="status"
                    >
                        Creando subproceso…
                    </p>
                )}

                {error && (
                    <p
                        className="diagram-node-editor-validation"
                        role="alert"
                    >
                        {error}
                    </p>
                )}

                <footer className="diagram-node-editor-footer">
                    <button
                        type="button"
                        className="diagram-node-editor-button diagram-node-editor-button-secondary"
                        disabled={pending}
                        onClick={() => onCancel?.()}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="diagram-node-editor-button diagram-node-editor-button-primary"
                        disabled={
                            !validation.valid ||
                            pending ||
                            !onAccept
                        }
                    >
                        Crear subproceso
                    </button>
                </footer>
            </form>
        </section>
    );
}
