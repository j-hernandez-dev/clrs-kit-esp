import { LanguageError } from "./LanguageError.js";

const operationCodes = Object.freeze({
    write: "CLRS_COMPILATION_WRITE_ERROR",
    append: "CLRS_COMPILATION_APPEND_ERROR",
    delete: "CLRS_COMPILATION_DELETE_ERROR"
});

export class CompilationIOError extends LanguageError {

    constructor(
        message,
        operation,
        targetPath,
        options = {}
    ) {
        super(message, "CompilationIOError", null, {
            ...options,
            phase: "compiler-io",
            code:
                options.code ??
                operationCodes[operation] ??
                "CLRS_COMPILATION_IO_ERROR"
        });

        this.operation = operation;
        this.targetPath = targetPath;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            operation: this.operation,
            targetPath: this.targetPath
        };
    }

    static from(error, operation, targetPath) {
        return new CompilationIOError(
            `No fue posible ${operationLabel(operation)} ${targetPath}.`,
            operation,
            targetPath,
            { cause: error }
        );
    }
}

function operationLabel(operation) {
    const labels = {
        write: "escribir",
        append: "añadir contenido a",
        delete: "eliminar"
    };

    return labels[operation] ?? "procesar";
}
