// syntaxError.js

import { LanguageError } from "./LanguageError.js";


export class SyntaxError extends LanguageError {

    /**
     * @param {any} message
     */
    constructor(message, location = null) {
        super(message, "SyntaxError", location);
    }

}