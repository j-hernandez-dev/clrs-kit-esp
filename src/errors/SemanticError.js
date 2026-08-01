import { LanguageError } from "./LanguageError.js";

/**
 * Error producido por las reglas semánticas del lenguaje CLRS.
 */
export class SemanticError extends LanguageError {

    constructor(
        message,
        node = null,
        options = {}
    ) {
        const code =
            options.code ??
            "CLRS_SEMANTIC_ANALYSIS_ERROR";
        const location =
            options.location ??
            node?.location ??
            null;
        const nodeType =
            options.nodeType ??
            node?.type ??
            null;

        super(
            message,
            "SemanticError",
            location,
            {
                ...options,
                phase: "semantic",
                code,
                diagnostics:
                    options.diagnostics ??
                    [{
                        code,
                        message,
                        nodeType,
                        location
                    }]
            }
        );

        this.nodeType = nodeType;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            nodeType: this.nodeType
        };
    }

    static astRequired() {
        return new SemanticError(
            "Semantic analysis requires an AST.",
            null,
            {
                code:
                    "CLRS_SEMANTIC_AST_REQUIRED",
                audience: "developer",
                publicMessage:
                    "Ocurrió un error interno durante el análisis semántico."
            }
        );
    }

    static programRequired(node) {
        return new SemanticError(
            "Semantic analysis requires a Program root node.",
            node,
            {
                code:
                    "CLRS_SEMANTIC_PROGRAM_REQUIRED",
                audience: "developer",
                publicMessage:
                    "Ocurrió un error interno durante el análisis semántico."
            }
        );
    }

    static undefinedIdentifier(node) {
        const identifier =
            node?.name ??
            "<desconocido>";
        const error = new SemanticError(
            `El identificador «${identifier}» no está definido.`,
            node,
            {
                code:
                    "CLRS_UNDEFINED_IDENTIFIER"
            }
        );

        error.diagnostics[0].identifier =
            identifier;

        return error;
    }

    static returnOutsideFunction(node) {
        return new SemanticError(
            "La instrucción «retornar» solo puede utilizarse dentro de una función.",
            node,
            {
                code:
                    "CLRS_RETURN_OUTSIDE_FUNCTION"
            }
        );
    }

    static duplicateParameter(node) {
        const identifier =
            node?.name ??
            "<desconocido>";
        const error = new SemanticError(
            `El parámetro «${identifier}» está repetido en la misma función.`,
            node,
            {
                code:
                    "CLRS_DUPLICATE_PARAMETER"
            }
        );

        error.diagnostics[0].identifier =
            identifier;

        return error;
    }

    static aggregate(errors) {
        const diagnostics =
            errors.flatMap(error =>
                error.diagnostics?.length > 0
                    ? error.diagnostics
                    : [{
                        code: error.code,
                        message: error.message,
                        location: error.location,
                        nodeType:
                            error.nodeType ??
                            null
                    }]
            );

        return new SemanticError(
            `Se encontraron ${diagnostics.length} errores semánticos.`,
            null,
            {
                code:
                    "CLRS_SEMANTIC_ANALYSIS_ERROR",
                location:
                    diagnostics[0]?.location ??
                    null,
                nodeType:
                    diagnostics[0]?.nodeType ??
                    null,
                diagnostics
            }
        );
    }
}
