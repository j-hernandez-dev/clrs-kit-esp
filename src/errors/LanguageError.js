export class LanguageError extends Error {

    /**
     * @param {string} message
     * @param {string} [name]
     * @param {any} [location]
     * @param {{
     *   phase?: string|null,
     *   code?: string|null,
     *   diagnostics?: any[],
     *   cause?: any,
     *   audience?: "user"|"developer",
     *   publicMessage?: string,
     *   technicalMessage?: string,
     *   presented?: boolean
     * }} [options]
     */
    constructor(
        message,
        name = "LanguageError",
        location = null,
        options = {}
    ) {
        super(
            message,
            options.cause === undefined
                ? undefined
                : { cause: options.cause }
        );

        this.name = name;

        this.location = location;

        this.phase = options.phase ?? null;

        this.code = options.code ?? null;

        this.diagnostics = options.diagnostics ?? [];

        Object.defineProperties(this, {
            audience: {
                value:
                    options.audience ??
                    "user",
                writable: true
            },
            publicMessage: {
                value:
                    options.publicMessage ??
                    message,
                writable: true
            },
            technicalMessage: {
                value:
                    options.technicalMessage ??
                    message,
                writable: true
            },
            presented: {
                value:
                    options.presented ??
                    false,
                writable: true
            }
        });
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            phase: this.phase,
            code: this.code,
            location: this.location,
            diagnostics: this.diagnostics
        };
    }
}
