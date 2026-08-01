import { LanguageError } from "./LanguageError.js";

export class RuntimeExecutionError extends LanguageError {

    constructor(
        message,
        programPath,
        options = {}
    ) {
        super(message, "RuntimeExecutionError", null, {
            ...options,
            phase: "runtime",
            code:
                options.code ??
                "CLRS_RUNTIME_EXECUTION_ERROR"
        });

        this.programPath = programPath;
        this.exitCode = options.exitCode ?? null;
        this.signal = options.signal ?? null;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            programPath: this.programPath,
            exitCode: this.exitCode,
            signal: this.signal
        };
    }

    static startFailure(programPath, cause) {
        return new RuntimeExecutionError(
            `No fue posible iniciar ${programPath}.`,
            programPath,
            {
                code: "CLRS_RUNTIME_START_ERROR",
                cause,
                presented: true
            }
        );
    }

    static exitFailure(
        programPath,
        exitCode,
        signal = null
    ) {
        return new RuntimeExecutionError(
            `El programa terminó con código ${String(exitCode)}.`,
            programPath,
            {
                code: "CLRS_RUNTIME_EXIT_ERROR",
                exitCode,
                signal,
                presented: true
            }
        );
    }
}
