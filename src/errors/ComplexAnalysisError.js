// semanticError.js

import { LanguageError } from "./LanguageError.js";


export class ComplexAnalysisError extends LanguageError {

    /**
     * @param {any} message
     * @param {any} location
     */
    constructor(message, location = null) {
        super(message, "ComplexAnalysisError", location);
    }
}