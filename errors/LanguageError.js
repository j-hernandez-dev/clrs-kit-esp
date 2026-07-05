// languageError.js

export class LanguageError extends Error {

    /**
     * @param {string} message
     * @param {any} location
     * @param {any} name
     */
    constructor(message, name, location = null) {
        super(message);

        this.name = name;

        this.location = location;
    }
}