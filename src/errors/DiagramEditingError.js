import { LanguageError } from "./LanguageError.js";

export class DiagramEditingError
    extends LanguageError {

    constructor(
        message,
        options = {}
    ) {
        super(
            message,
            "DiagramEditingError",
            options.location ?? null,
            {
                ...options,
                phase: "diagram",
                code:
                    options.code ??
                    "CLRS_DIAGRAM_EDIT_ERROR",
                audience:
                    options.audience ??
                    "user",
                publicMessage:
                    options.publicMessage ??
                    message,
                technicalMessage:
                    options.technicalMessage ??
                    message
            }
        );
    }

    static invalidIntent(detail = null) {
        return new DiagramEditingError(
            "La solicitud de edición del diagrama no es válida.",
            {
                code:
                    "CLRS_DIAGRAM_EDIT_INVALID_INTENT",
                diagnostics:
                    detail == null
                        ? []
                        : [{ message: detail }]
            }
        );
    }

    static staleDocument() {
        return new DiagramEditingError(
            "El documento cambió desde que se abrió el editor de la figura. Revisa el diagrama e inténtalo nuevamente.",
            {
                code:
                    "CLRS_DIAGRAM_EDIT_STALE_DOCUMENT"
            }
        );
    }

    static entityNotFound(location = null) {
        return new DiagramEditingError(
            "La figura ya no corresponde con el documento actual.",
            {
                code:
                    "CLRS_DIAGRAM_EDIT_ENTITY_NOT_FOUND",
                location
            }
        );
    }

    static readOnlyProjection(
        location = null
    ) {
        return new DiagramEditingError(
            "La llamada implícita a PRINCIPAL es de solo lectura.",
            {
                code:
                    "CLRS_DIAGRAM_EDIT_READ_ONLY",
                location,
                diagnostics: [{
                    message:
                        "Edita la declaración desde el terminal de inicio de PRINCIPAL."
                }]
            }
        );
    }

    static insertionNotFound() {
        return new DiagramEditingError(
            "La conexión ya no representa un punto seguro de inserción en el documento actual.",
            {
                code:
                    "CLRS_DIAGRAM_EDIT_INSERTION_NOT_FOUND"
            }
        );
    }

    static unsafeScope() {
        return new DiagramEditingError(
            "La inserción requiere un diagrama del documento completo o una selección que comience al inicio de una línea.",
            {
                code:
                    "CLRS_DIAGRAM_EDIT_UNSAFE_SCOPE"
            }
        );
    }

    static functionRequiresWholeDocument() {
        return new DiagramEditingError(
            "Para crear una función abre el diagrama del documento completo.",
            {
                code:
                    "CLRS_DIAGRAM_EDIT_FUNCTION_SCOPE"
            }
        );
    }

    static duplicateFunction(identifier) {
        return new DiagramEditingError(
            `Ya existe una función llamada «${identifier}».`,
            {
                code:
                    "CLRS_DIAGRAM_EDIT_DUPLICATE_FUNCTION"
            }
        );
    }

    static emptyRequiredBlock(
        location = null
    ) {
        return new DiagramEditingError(
            "La figura es la única instrucción de un bloque obligatorio y no puede eliminarse de forma aislada.",
            {
                code:
                    "CLRS_DIAGRAM_EDIT_EMPTY_BLOCK",
                location,
                diagnostics: [{
                    message:
                        "Agrega primero otra instrucción al bloque o elimina su estructura contenedora."
                }]
            }
        );
    }

    static invalidValue(
        field,
        location = null
    ) {
        return new DiagramEditingError(
            `El campo «${field}» contiene un valor no válido para una edición de una sola instrucción.`,
            {
                code:
                    "CLRS_DIAGRAM_EDIT_INVALID_VALUE",
                location
            }
        );
    }

    static invalidResult(
        errors,
        location = null
    ) {
        return new DiagramEditingError(
            "El cambio produciría código CLRS inválido y no fue aplicado.",
            {
                code:
                    "CLRS_DIAGRAM_EDIT_INVALID_RESULT",
                location,
                diagnostics:
                    (errors ?? []).map(error => ({
                        code: error?.code ?? null,
                        message:
                            error?.publicMessage ??
                            error?.message ??
                            "El código resultante no es válido.",
                        location:
                            error?.location ?? null
                    }))
            }
        );
    }

    static applyFailed(cause = null) {
        return new DiagramEditingError(
            "VS Code no pudo aplicar la edición al documento.",
            {
                code:
                    "CLRS_DIAGRAM_EDIT_APPLY_FAILED",
                cause,
                audience: "developer",
                publicMessage:
                    "No fue posible aplicar el cambio al documento. Inténtalo nuevamente."
            }
        );
    }
}
