// semanticError.js

import { LanguageError } from "./LanguageError.js";


export class TranspilerError extends LanguageError {

    /**
     * @param {any} message
     * @param {any} location
     */
    constructor(message, location = null, options = {}) {
        super(message, "TranspilerError", location, {
            ...options,
            phase: "transpiler",
            code:
                options.code ??
                "CLRS_TRANSPILER_ERROR",
            audience:
                options.audience ??
                "developer",
            publicMessage:
                options.publicMessage ??
                "Ocurrió un error interno al generar el programa.",
            technicalMessage:
                options.technicalMessage ??
                message
        });
    }
}
