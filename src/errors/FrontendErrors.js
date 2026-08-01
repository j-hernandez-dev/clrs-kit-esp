import { LanguageError } from "./LanguageError.js";

/**
 * Error base de las fases que convierten código fuente en un AST.
 */
export class FrontendError extends LanguageError {

    constructor(
        message,
        name,
        phase,
        code,
        location = null,
        options = {}
    ) {
        super(message, name, location, {
            ...options,
            phase,
            code
        });
    }
}

export class FrontendInputError extends FrontendError {

    constructor(message, location = null, options = {}) {
        super(
            message,
            "FrontendInputError",
            "frontend",
            "CLRS_FRONTEND_INPUT_ERROR",
            location,
            options
        );
    }
}

export class LexicalError extends FrontendError {

    constructor(message, location = null, options = {}) {
        super(
            message,
            "LexicalError",
            "lexer",
            "CLRS_LEXICAL_ERROR",
            location,
            options
        );
    }
}

export class IndentationError extends FrontendError {

    constructor(message, location = null, options = {}) {
        super(
            message,
            "IndentationError",
            "indentation",
            "CLRS_INDENTATION_ERROR",
            location,
            options
        );
    }
}

export class ParserError extends FrontendError {

    constructor(message, location = null, options = {}) {
        super(
            message,
            "ParserError",
            "parser",
            "CLRS_PARSER_ERROR",
            location,
            options
        );
    }
}

export class ASTBuildError extends FrontendError {

    constructor(message, location = null, options = {}) {
        super(
            message,
            "ASTBuildError",
            "ast",
            "CLRS_AST_BUILD_ERROR",
            location,
            {
                ...options,
                audience:
                    options.audience ??
                    "developer",
                publicMessage:
                    options.publicMessage ??
                    "Ocurrió un error interno al construir el programa.",
                technicalMessage:
                    options.technicalMessage ??
                    message
            }
        );
    }
}
