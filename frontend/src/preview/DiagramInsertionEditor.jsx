import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    createDiagramInsertionDraft,
    createDiagramInsertionIntent,
    selectDiagramInsertionFigure,
    updateDiagramInsertionDraft,
    validateDiagramInsertionDraft
} from "../editor/DiagramInsertionEditorModel.js";

export default function DiagramInsertionEditor({
    edge,
    onCancel = null,
    onAccept = null,
    operation = null
}) {
    const initialDraft = useMemo(
        () => createDiagramInsertionDraft(
            edge
        ),
        [edge]
    );
    const [draft, setDraft] = useState(
        initialDraft
    );
    const firstFieldRef = useRef(null);
    const validation =
        validateDiagramInsertionDraft(draft);
    const insertionOperation =
        operation?.operation === "insert-node"
            ? operation
            : null;
    const operationPending =
        operation?.pending === true;

    useEffect(() => {
        setDraft(initialDraft);
    }, [initialDraft]);

    useEffect(() => {
        firstFieldRef.current?.focus?.({
            preventScroll: true
        });
    }, [draft.figure, draft.identityId]);

    const handleKeyDown = event => {
        if (event.key !== "Escape") {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        onCancel?.();
    };
    const handleSubmit = event => {
        event.preventDefault();

        if (!validation.valid || !onAccept) {
            return;
        }

        onAccept(
            createDiagramInsertionIntent(draft)
        );
    };

    return (
        <section
            className="diagram-node-editor diagram-insertion-editor"
            role="dialog"
            aria-modal="false"
            aria-labelledby="diagram-insertion-editor-title"
            onKeyDown={handleKeyDown}
        >
            <header className="diagram-node-editor-header">
                <div className="diagram-node-editor-heading">
                    <span className="diagram-node-editor-eyebrow">
                        INSERTAR FIGURA
                    </span>
                    <h2 id="diagram-insertion-editor-title">
                        {draft.title}
                    </h2>
                </div>
            </header>

            <form
                className="diagram-node-editor-form"
                onSubmit={handleSubmit}
            >
                <div className="diagram-node-editor-fields">
                    <div className="diagram-insertion-placement">
                        <span>
                            PUNTO DE INSERCIÓN
                        </span>
                        <strong>
                            {draft.placement.branchLabel}
                        </strong>
                        <small>
                            {draft.placement.positionLabel}
                            {" · "}
                            {draft.placement.relationLabel}
                        </small>
                    </div>

                    <div
                        className="diagram-insertion-figures"
                        role="listbox"
                        aria-label="Tipo de figura que se insertará"
                    >
                        {draft.choices.map(choice => (
                            <button
                                key={choice.figure}
                                type="button"
                                role="option"
                                aria-selected={
                                    choice.figure ===
                                    draft.figure
                                }
                                className={
                                    "diagram-insertion-figure" +
                                    (
                                        choice.figure ===
                                        draft.figure
                                            ? " diagram-insertion-figure-selected"
                                            : ""
                                    )
                                }
                                disabled={
                                    operationPending
                                }
                                onClick={() =>
                                    setDraft(current =>
                                        selectDiagramInsertionFigure(
                                            current,
                                            choice.figure
                                        )
                                    )
                                }
                            >
                                <span
                                    className="diagram-insertion-figure-symbol"
                                    aria-hidden="true"
                                >
                                    {choice.symbol}
                                </span>
                                <span>
                                    <strong>
                                        {choice.category}
                                    </strong>
                                    <small>
                                        {choice.label}
                                    </small>
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="diagram-insertion-fields-separator">
                        Datos iniciales
                    </div>

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

                                {field.multiline ? (
                                    <textarea
                                        ref={
                                            index === 0
                                                ? firstFieldRef
                                                : null
                                        }
                                        name={field.name}
                                        value={
                                            draft.values[
                                                field.name
                                            ]
                                        }
                                        placeholder={
                                            field.placeholder
                                        }
                                        rows={2}
                                        required={
                                            field.required
                                        }
                                        spellCheck="false"
                                        disabled={
                                            operationPending
                                        }
                                        onChange={event =>
                                            setDraft(current =>
                                                updateDiagramInsertionDraft(
                                                    current,
                                                    field.name,
                                                    event.target.value
                                                )
                                            )
                                        }
                                    />
                                ) : (
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
                                        disabled={
                                            operationPending
                                        }
                                        onChange={event =>
                                            setDraft(current =>
                                                updateDiagramInsertionDraft(
                                                    current,
                                                    field.name,
                                                    event.target.value
                                                )
                                            )
                                        }
                                    />
                                )}
                            </label>
                        )
                    )}
                </div>

                {!validation.valid && (
                    <p
                        className="diagram-node-editor-validation"
                        role="status"
                    >
                        Completa los campos obligatorios.
                    </p>
                )}

                {insertionOperation?.pending && (
                    <p
                        className="diagram-node-editor-status"
                        role="status"
                    >
                        Insertando figura…
                    </p>
                )}

                {insertionOperation?.error && (
                    <p
                        className="diagram-node-editor-validation"
                        role="alert"
                    >
                        {insertionOperation.error}
                    </p>
                )}

                <footer className="diagram-node-editor-footer">
                    <button
                        type="button"
                        className="diagram-node-editor-button diagram-node-editor-button-secondary"
                        onClick={() => onCancel?.()}
                        disabled={operationPending}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="diagram-node-editor-button diagram-node-editor-button-primary"
                        disabled={
                            !validation.valid ||
                            !onAccept ||
                            operationPending
                        }
                    >
                        Insertar
                    </button>
                </footer>
            </form>
        </section>
    );
}
