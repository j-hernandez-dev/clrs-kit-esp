import { LanguageError } from "./LanguageError.js";

const TERMINAL_SEPARATOR =
    "────────────────────────";

const PHASE_TITLES = Object.freeze({
    frontend: "Error de entrada",
    lexer: "Error léxico",
    indentation: "Error de indentación",
    parser: "Error de sintaxis",
    ast: "Error interno del compilador",
    "ast-validation":
        "Error interno del compilador",
    "ast-visitor":
        "Error interno del compilador",
    semantic: "Error semántico",
    transpiler: "Error de compilación",
    "compiler-io":
        "Error de archivos",
    runtime: "Error de ejecución",
    cost: "Error de análisis",
    diagram: "Error de diagrama",
    application: "Error de aplicación"
});

/**
 * Convierte un error del lenguaje en texto apto para consola o webview.
 *
 * @param {any} error
 * @param {string|null} [fallbackTitle]
 * @returns {string}
 */
export function formatLanguageError(error, fallbackTitle = null) {
    if (!(error instanceof LanguageError)) {
        return (
            "[Error interno] " +
            "Ocurrió un error interno inesperado."
        );
    }

    const title = getErrorTitle(
        error,
        fallbackTitle
    );
    const lines = [
        `[${title}] ${getPublicMessage(error)}`
    ];

    if (error.location?.startLine != null) {
        lines.push(formatLocation(error.location));
    }

    for (
        const diagnostic
        of visibleDiagnostics(error)
    ) {
        lines.push(`- ${diagnostic.message}`);

        if (diagnostic.location?.startLine != null) {
            lines.push(`  ${formatLocation(diagnostic.location)}`);
        }
    }

    return lines.join("\n");
}

/**
 * Aplica la presentación minimalista del ejecutor de consola.
 */
export function formatTerminalError(
    error,
    options = {}
) {
    const title =
        getErrorTitle(
            error,
            options.fallbackTitle ?? null
        );
    const displayName =
        options.displayName ?? null;
    const status =
        options.status ??
        getTerminalStatus(error);
    const lines = [
        options.title ?? "CLRS Runtime",
        TERMINAL_SEPARATOR
    ];

    if (displayName) {
        lines.push(`▶ ${displayName}`);
    }

    lines.push(
        "",
        `✕ ${title}`,
        ""
    );

    for (
        const line
        of getPublicMessage(error).split("\n")
    ) {
        lines.push(`  ${line}`);
    }

    if (error?.location?.startLine != null) {
        lines.push(
            `  ${formatLocation(error.location)}`
        );
    }

    for (
        const diagnostic
        of visibleDiagnostics(error)
    ) {
        lines.push("");

        for (
            const [index, line]
            of diagnostic.message
                .split("\n")
                .entries()
        ) {
            lines.push(
                index === 0
                    ? `  • ${line}`
                    : `    ${line}`
            );
        }

        if (
            diagnostic.location
                ?.startLine != null
        ) {
            lines.push(
                "    " +
                formatLocation(
                    diagnostic.location
                )
            );
        }
    }

    if (
        error?.audience === "developer" &&
        error?.code
    ) {
        lines.push(
            "",
            `  Código: ${error.code}`
        );
    }

    lines.push(
        "",
        TERMINAL_SEPARATOR,
        `Estado: ${status}`
    );

    return lines.join("\n");
}

/**
 * Conserva mensaje, stack y causas originales para logs de desarrollo.
 */
export function formatDeveloperError(error) {
    const phase =
        error?.phase ?? "internal";
    const code =
        error?.code ?? "UNCLASSIFIED";
    const name =
        error?.name ?? "Error";
    const message =
        error?.technicalMessage ??
        error?.message ??
        String(error);
    const lines = [
        `[developer][${phase}][${code}]`,
        `${name}: ${message}`
    ];

    if (error?.stack) {
        lines.push("", error.stack);
    }

    let cause = error?.cause;

    while (cause != null) {
        lines.push(
            "",
            "Caused by:",
            cause.stack ??
            cause.message ??
            String(cause)
        );
        cause = cause.cause;
    }

    return lines.join("\n");
}

export function shouldLogDeveloperError(error) {
    return (
        error?.audience === "developer" ||
        error?.cause != null
    );
}

export function getErrorTitle(
    error,
    fallbackTitle = null
) {
    return (
        fallbackTitle ??
        PHASE_TITLES[error?.phase] ??
        "Error interno"
    );
}

export function getPublicMessage(error) {
    if (error instanceof LanguageError) {
        return error.publicMessage;
    }

    return "Ocurrió un error interno inesperado.";
}

export function formatLocation(location) {
    const line = location.startLine;
    const column = location.startColumn;

    return column == null
        ? `Línea ${line}`
        : `Línea ${line}, columna ${column}`;
}

function visibleDiagnostics(error) {
    if (
        !(error instanceof LanguageError) ||
        error.audience === "developer"
    ) {
        return [];
    }

    const firstDiagnosticIsSummary =
        error.diagnostics[0]?.message !==
        error.message;
    const diagnosticStart =
        firstDiagnosticIsSummary
            ? 0
            : 1;

    return error.diagnostics.slice(
        diagnosticStart
    );
}

function getTerminalStatus(error) {
    return error?.phase === "runtime"
        ? "Error"
        : "No ejecutado";
}
