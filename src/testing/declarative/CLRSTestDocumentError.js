import {
    ApplicationError
} from "../../errors/ApplicationError.js";

/**
 * Error estructurado de un documento declarativo de pruebas CLRS.
 */
export class CLRSTestDocumentError extends ApplicationError {

    constructor(
        code,
        publicMessage,
        options = {}
    ) {
        super(
            `Invalid CLRS test document: ${code}.`,
            {
                code,
                publicMessage,
                cause: options.cause,
                diagnostics:
                    options.field == null
                        ? []
                        : [{
                            field: options.field,
                            documentPath:
                                options.documentPath ??
                                null
                        }]
            }
        );

        this.name = "CLRSTestDocumentError";
        this.documentPath =
            options.documentPath ?? null;
        this.field = options.field ?? null;
    }

    static invalidJson(documentPath, cause) {
        return new CLRSTestDocumentError(
            "CLRS_TEST_DOCUMENT_JSON_INVALID",
            "El archivo de pruebas CLRS no contiene JSON válido.",
            { documentPath, cause }
        );
    }

    static invalid(code, documentPath, field) {
        return new CLRSTestDocumentError(
            code,
            "El archivo de pruebas CLRS no cumple el formato esperado.",
            { documentPath, field }
        );
    }

    static unsupportedVersion(
        documentPath,
        version
    ) {
        return new CLRSTestDocumentError(
            "CLRS_TEST_DOCUMENT_VERSION_UNSUPPORTED",
            `La versión ${String(version)} del archivo de pruebas CLRS no es compatible.`,
            {
                documentPath,
                field: "version"
            }
        );
    }
}
