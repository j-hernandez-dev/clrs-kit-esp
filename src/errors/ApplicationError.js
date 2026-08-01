import { LanguageError } from "./LanguageError.js";

export class ApplicationError extends LanguageError {

    constructor(
        message,
        options = {}
    ) {
        super(
            message,
            "ApplicationError",
            options.location ?? null,
            {
                ...options,
                phase: "application",
                code:
                    options.code ??
                    "CLRS_APPLICATION_ERROR"
            }
        );
    }

    static invalidRequest(message) {
        return new ApplicationError(
            message,
            {
                code:
                    "CLRS_INVALID_APPLICATION_REQUEST"
            }
        );
    }

    static configuration(
        dependency,
        expected
    ) {
        return new ApplicationError(
            `Invalid configuration: "${dependency}" must implement ${expected}.`,
            {
                code:
                    "CLRS_APPLICATION_CONFIGURATION_ERROR",
                audience: "developer",
                publicMessage:
                    "Ocurrió un error interno de configuración.",
                diagnostics: [{
                    dependency,
                    expected
                }]
            }
        );
    }

    static noActiveDocument() {
        return new ApplicationError(
            "No hay un proyecto abierto.",
            {
                code:
                    "CLRS_NO_ACTIVE_DOCUMENT"
            }
        );
    }

    static sourceNotFound(sourcePath, cause) {
        return new ApplicationError(
            `No existe un archivo en la ruta: ${sourcePath}`,
            {
                code:
                    "CLRS_SOURCE_FILE_NOT_FOUND",
                cause
            }
        );
    }

    static sourceReadFailure(
        sourcePath,
        cause
    ) {
        return new ApplicationError(
            `No fue posible leer el archivo: ${sourcePath}`,
            {
                code:
                    "CLRS_SOURCE_FILE_READ_ERROR",
                cause
            }
        );
    }
}
