import {
    LanguageError
} from "../../errors/LanguageError.js";
import {
    parseSource
} from "../LanguageFrontend.js";
import {
    SemanticAnalyzer
} from "../../semantic/SemanticAnalyzer.js";

export const LanguageDiagnosticSeverity =
    Object.freeze({
        ERROR: "error",
        WARNING: "warning",
        INFORMATION: "information",
        HINT: "hint"
    });

/**
 * Ejecuta las fases que pueden diagnosticar el código sin transpilar,
 * escribir archivos ni ejecutar el programa.
 */
export class LanguageDiagnosticsService {

    constructor(options = {}) {
        this.parseSource =
            options.parseSource ??
            parseSource;
        this.semanticAnalyzer =
            options.semanticAnalyzer ??
            new SemanticAnalyzer();
    }

    /**
     * Devuelve un resultado enriquecido que podrá reutilizarse para futuras
     * características semánticas del editor.
     *
     * @param {string} sourceCode
     * @returns {{
     *   ok: boolean,
     *   diagnostics: ReadonlyArray<object>,
     *   frontend: object|null,
     *   semanticModel: object|null
     * }}
     */
    analyze(sourceCode) {
        let frontend = null;

        try {
            frontend =
                this.parseSource(sourceCode);
            const semanticModel =
                this.semanticAnalyzer
                    .analyze(frontend.ast);

            return Object.freeze({
                ok: true,
                diagnostics:
                    Object.freeze([]),
                frontend,
                semanticModel
            });
        } catch (error) {
            if (
                !(error instanceof LanguageError) ||
                error.audience === "developer"
            ) {
                throw error;
            }

            return Object.freeze({
                ok: false,
                diagnostics:
                    createLanguageDiagnostics(
                        error
                    ),
                frontend,
                semanticModel: null
            });
        }
    }

    /**
     * Contrato reducido para adaptadores de editor y un futuro servidor LSP.
     *
     * @param {string} sourceCode
     * @returns {ReadonlyArray<object>}
     */
    diagnose(sourceCode) {
        return this.analyze(sourceCode)
            .diagnostics;
    }
}

/**
 * Normaliza los diagnósticos internos sin introducir dependencias de VS Code.
 *
 * @param {LanguageError} error
 * @returns {ReadonlyArray<object>}
 */
export function createLanguageDiagnostics(
    error
) {
    const sourceDiagnostics =
        error.diagnostics?.length > 0
            ? error.diagnostics
            : [{
                message:
                    error.publicMessage,
                location:
                    error.location
            }];

    return Object.freeze(
        sourceDiagnostics.map(
            diagnostic =>
                Object.freeze({
                    code:
                        diagnostic.code ??
                        error.code ??
                        "CLRS_LANGUAGE_ERROR",
                    message:
                        diagnostic.message ??
                        error.publicMessage,
                    phase:
                        diagnostic.phase ??
                        error.phase ??
                        "frontend",
                    severity:
                        diagnostic.severity ??
                        LanguageDiagnosticSeverity
                            .ERROR,
                    location:
                        freezeLocation(
                            diagnostic.location ??
                            error.location
                        )
                })
        )
    );
}

function freezeLocation(location) {
    if (location == null) {
        return null;
    }

    return Object.freeze({
        startLine:
            finiteOrNull(
                location.startLine
            ),
        startColumn:
            finiteOrNull(
                location.startColumn
            ),
        endLine:
            finiteOrNull(
                location.endLine
            ),
        endColumn:
            finiteOrNull(
                location.endColumn
            )
    });
}

function finiteOrNull(value) {
    return Number.isFinite(value)
        ? value
        : null;
}
