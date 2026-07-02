// semanticError.js

import { LanguageError } from "./LanguageError.js";


export class TranspilerError extends LanguageError {

    /**
     * @param {any} message
     * @param {any} location
     */
    constructor(message, location = null) {
        super(message, "TranspilerError", location);
    }
}