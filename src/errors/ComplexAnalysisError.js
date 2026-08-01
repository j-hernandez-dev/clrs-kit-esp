// semanticError.js

import { LanguageError } from "./LanguageError.js";


export class ComplexAnalysisError extends LanguageError {

    /**
     * @param {any} message
     * @param {any} location
     */
    constructor(message, location = null, options = {}) {
        super(message, "ComplexAnalysisError", location, {
            ...options,
            phase: "cost",
            code:
                options.code ??
                "CLRS_COST_ANALYSIS_ERROR",
            audience:
                options.audience ??
                "developer",
            publicMessage:
                options.publicMessage ??
                "Ocurrió un error interno durante el análisis de costo.",
            technicalMessage:
                options.technicalMessage ??
                message
        });
    }
}
