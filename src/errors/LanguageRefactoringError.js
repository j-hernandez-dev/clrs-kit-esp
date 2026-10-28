import {
    ApplicationError
} from "./ApplicationError.js";

/**
 * Error esperado al validar una refactorización solicitada por el usuario.
 */
export class LanguageRefactoringError extends ApplicationError {

    constructor(
        message,
        options = {}
    ) {
        super(message, {
            ...options,
            code:
                options.code ??
                "CLRS_REFACTORING_ERROR"
        });

        this.name =
            "LanguageRefactoringError";
    }

    static invalidDocument() {
        return new LanguageRefactoringError(
            "Corrige los errores del documento antes de realizar el renombrado.",
            {
                code:
                    "CLRS_RENAME_INVALID_DOCUMENT"
            }
        );
    }

    static symbolRequired(location = null) {
        return new LanguageRefactoringError(
            "No hay un símbolo que pueda renombrarse en esta posición.",
            {
                code:
                    "CLRS_RENAME_SYMBOL_REQUIRED",
                location
            }
        );
    }

    static builtin(name, location = null) {
        return new LanguageRefactoringError(
            `El símbolo predefinido «${name}» no puede renombrarse.`,
            {
                code:
                    "CLRS_RENAME_BUILTIN",
                location
            }
        );
    }

    static invalidIdentifier(
        name,
        location = null
    ) {
        return new LanguageRefactoringError(
            `«${name}» no es un identificador CLRS válido.`,
            {
                code:
                    "CLRS_RENAME_INVALID_IDENTIFIER",
                location
            }
        );
    }

    static reservedIdentifier(
        name,
        location = null
    ) {
        return new LanguageRefactoringError(
            `«${name}» es una palabra reservada de CLRS y no puede usarse como nombre.`,
            {
                code:
                    "CLRS_RENAME_RESERVED_IDENTIFIER",
                location
            }
        );
    }

    static collision(
        name,
        location = null
    ) {
        return new LanguageRefactoringError(
            `El nombre «${name}» ya identifica otro símbolo visible y el renombrado cambiaría el comportamiento del programa.`,
            {
                code:
                    "CLRS_RENAME_COLLISION",
                location
            }
        );
    }
}
