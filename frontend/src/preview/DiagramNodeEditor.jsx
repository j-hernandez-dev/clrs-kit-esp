import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    createDiagramNodeDeleteIntent,
    createDiagramNodeDeletionPreview,
    createDiagramNodeEditIntent,
    createDiagramNodeEditorDraft,
    updateDiagramNodeEditorDraft,
    validateDiagramNodeEditorDraft
} from "../editor/DiagramNodeEditorModel.js";

export default function DiagramNodeEditor({
    node,
    onGoTo = null,
    onCancel = null,
    onAccept = null,
    onDelete = null,
    operation = null
}) {
    const initialDraft = useMemo(
        () => createDiagramNodeEditorDraft(
            node
        ),
        [node]
    );
    const [draft, setDraft] = useState(
        initialDraft
    );
    const [confirmingDelete, setConfirmingDelete] =
        useState(false);
    const deletionPreview = useMemo(
        () => createDiagramNodeDeletionPreview(
            node
        ),
        [node]
    );
    const firstFieldRef = useRef(null);
    const validation =
        validateDiagramNodeEditorDraft(draft);
    const updateOperation =
        operation?.operation === "update-node" ||
        operation?.operation === "delete-node" ||
        (
            draft.materialization != null &&
            operation?.operation === "insert-node"
        )
            ? operation
            : null;
    const deleteOperation =
        operation?.operation === "delete-node"
            ? operation
            : null;
    const operationPending =
        operation?.pending === true;
    const canGoTo =
        Boolean(
            onGoTo &&
            node?.location?.startLine != null
        );

    useEffect(() => {
        setDraft(initialDraft);
        setConfirmingDelete(false);
    }, [initialDraft]);

    useEffect(() => {
        firstFieldRef.current?.focus?.({
            preventScroll: true
        });
    }, [initialDraft.identityId]);

    const handleKeyDown = event => {
        if (event.key !== "Escape") {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (confirmingDelete) {
            setConfirmingDelete(false);
            return;
        }

        onCancel?.();
    };
    const handleSubmit = event => {
        event.preventDefault();

        if (
            draft.readOnly === true ||
            !validation.valid ||
            !onAccept
        ) {
            return;
        }

        const intent =
            createDiagramNodeEditIntent(draft);

        if (intent == null) {
            onCancel?.();
            return;
        }

        onAccept(intent);
    };
    const handleDelete = () => {
        if (!onDelete || operationPending) {
            return;
        }

        setConfirmingDelete(true);
    };
    const handleConfirmDelete = () => {
        if (!onDelete || operationPending) {
            return;
        }

        onDelete(
            createDiagramNodeDeleteIntent(node)
        );
    };

    return (
        <section
            className="diagram-node-editor"
            role="dialog"
            aria-modal="false"
            aria-labelledby="diagram-node-editor-title"
            onKeyDown={handleKeyDown}
        >
            <header className="diagram-node-editor-header">
                <div className="diagram-node-editor-heading">
                    <span className="diagram-node-editor-eyebrow">
                        {draft.readOnly
                            ? "CONSULTAR FIGURA"
                            : "EDITAR FIGURA"}
                    </span>
                    <h2 id="diagram-node-editor-title">
                        {draft.title}
                    </h2>
                </div>

                <div className="diagram-node-editor-header-actions">
                    <button
                        type="button"
                        className="diagram-node-editor-action"
                        onClick={() => onGoTo?.(node)}
                        disabled={
                            !canGoTo ||
                            operationPending
                        }
                        title="Ir a la instrucción en el código fuente"
                    >
                        Ir
                    </button>
                    <button
                        type="button"
                        className={
                            "diagram-node-editor-action " +
                            "diagram-node-editor-action-danger"
                        }
                        onClick={handleDelete}
                        aria-pressed={
                            confirmingDelete
                        }
                        disabled={
                            !onDelete ||
                            operationPending
                        }
                        title={
                            onDelete
                                ? "Eliminar la instrucción o el bloque completo"
                                : "La eliminación se habilitará al conectar la transformación del documento"
                        }
                    >
                        Eliminar
                    </button>
                </div>
            </header>

            {confirmingDelete ? (
                <div className="diagram-deletion-confirmation">
                    <div className="diagram-deletion-confirmation-body">
                        <span className="diagram-deletion-impact">
                            ACCIÓN DESTRUCTIVA
                        </span>
                        <h3>
                            {deletionPreview.title}
                        </h3>
                        <p>
                            {deletionPreview.message}
                        </p>
                        {deletionPreview.line != null && (
                            <p className="diagram-deletion-location">
                                Línea {deletionPreview.line}
                            </p>
                        )}
                        <p className="diagram-deletion-undo">
                            El cambio se aplicará como una sola edición y podrá deshacerse desde VS Code.
                        </p>

                        {deleteOperation?.pending && (
                            <p
                                className="diagram-node-editor-status"
                                role="status"
                            >
                                Eliminando figura…
                            </p>
                        )}

                        {deleteOperation?.error && (
                            <p
                                className="diagram-node-editor-validation"
                                role="alert"
                            >
                                {deleteOperation.error}
                            </p>
                        )}
                    </div>

                    <footer className="diagram-node-editor-footer">
                        <button
                            type="button"
                            className="diagram-node-editor-button diagram-node-editor-button-secondary"
                            onClick={() =>
                                setConfirmingDelete(false)
                            }
                            disabled={operationPending}
                        >
                            Conservar
                        </button>
                        <button
                            type="button"
                            className="diagram-node-editor-button diagram-node-editor-button-danger"
                            onClick={handleConfirmDelete}
                            disabled={
                                !onDelete ||
                                operationPending
                            }
                            autoFocus
                        >
                            Eliminar definitivamente
                        </button>
                    </footer>
                </div>
            ) : (
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
                                        rows={3}
                                        required={
                                            field.required
                                        }
                                        spellCheck="false"
                                        disabled={
                                            operationPending
                                        }
                                        readOnly={
                                            draft.readOnly
                                        }
                                        aria-readonly={
                                            draft.readOnly
                                        }
                                        onChange={event =>
                                            setDraft(
                                                current =>
                                                    updateDiagramNodeEditorDraft(
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
                                        readOnly={
                                            draft.readOnly
                                        }
                                        aria-readonly={
                                            draft.readOnly
                                        }
                                        onChange={event =>
                                            setDraft(
                                                current =>
                                                    updateDiagramNodeEditorDraft(
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

                {draft.readOnly && (
                    <p
                        className="diagram-node-editor-status"
                        role="status"
                    >
                        Esta llamada a PRINCIPAL es implícita y sólo puede consultarse.
                    </p>
                )}

                {!validation.valid && (
                    <p
                        className="diagram-node-editor-validation"
                        role="status"
                    >
                        Completa los campos obligatorios.
                    </p>
                )}

                {updateOperation?.pending && (
                    <p
                        className="diagram-node-editor-status"
                        role="status"
                    >
                        Aplicando cambio…
                    </p>
                )}

                {updateOperation?.error && (
                    <p
                        className="diagram-node-editor-validation"
                        role="alert"
                    >
                        {updateOperation.error}
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
                            draft.readOnly ||
                            !validation.valid ||
                            !onAccept ||
                            operationPending
                        }
                        title={
                            draft.readOnly
                                ? "La llamada implícita a PRINCIPAL es de solo lectura"
                                : onAccept
                                ? "Aplicar cambios"
                                : "La aplicación se habilitará al conectar la transformación del documento"
                        }
                    >
                        Aceptar
                    </button>
                </footer>
                </form>
            )}
        </section>
    );
}
