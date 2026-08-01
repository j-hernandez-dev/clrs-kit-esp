// syntaxError.js

import { LanguageError } from "./LanguageError.js";


export class SyntaxError extends LanguageError {

    /**
     * @param {any} message
     */
    constructor(message, location = null, options = {}) {
        super(message, "SyntaxError", location, {
            ...options,
            phase: "parser",
            code: "CLRS_SYNTAX_ERROR"
        });
    }

}
