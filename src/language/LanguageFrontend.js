import { tokenize } from "../lexer/Lexer.js";
import { addIndentationTokens } from "../lexer/Indentation.js";
import { parser } from "../parser/Parser.js";
import { ASTBuilder } from "../ast/builders/ASTBuilder.js";
import { validateAST } from "../ast/validation/ASTValidator.js";
import {
    ASTBuildError,
    FrontendError,
    FrontendInputError,
    ParserError
} from "../errors/FrontendErrors.js";

/**
 * Ejecuta exclusivamente las fases léxicas del frontend.
 *
 * @param {string} sourceCode
 * @returns {import("chevrotain").IToken[]}
 */
export function tokenizeSource(sourceCode) {
    if (typeof sourceCode !== "string") {
        throw new FrontendInputError(
            "El código fuente debe ser una cadena."
        );
    }

    const tokens = tokenize(sourceCode);

    return addIndentationTokens(
        tokens,
        sourceCode
    );
}

/**
 * Convierte tokens normalizados en CST y AST.
 *
 * @param {import("chevrotain").IToken[]} tokens
 * @returns {{
 *   cst: any,
 *   ast: import("../ast/core/ASTTypes.js").ProgramNode
 * }}
 */
export function buildASTFromTokens(tokens) {
    if (!Array.isArray(tokens)) {
        throw new FrontendInputError(
            "Los tokens deben proporcionarse como un arreglo."
        );
    }

    const { cst, errors } = parser.parse(tokens);

    if (errors.length > 0) {
        throw createParserError(errors);
    }

    try {
        const builder = new ASTBuilder(parser);
        const ast = builder.build(cst);

        validateAST(ast);

        return {
            cst,
            ast
        };
    } catch (error) {
        if (error instanceof FrontendError) {
            throw error;
        }

        throw new ASTBuildError(
            error instanceof Error
                ? error.message
                : "The AST could not be built.",
            null,
            { cause: error }
        );
    }
}

/**
 * Frontend compartido por Node.js y el navegador.
 *
 * @param {string} sourceCode
 * @returns {{
 *   sourceCode: string,
 *   tokens: import("chevrotain").IToken[],
 *   cst: any,
 *   ast: import("../ast/core/ASTTypes.js").ProgramNode
 * }}
 */
export function parseSource(sourceCode) {
    const tokens = tokenizeSource(sourceCode);
    const { cst, ast } = buildASTFromTokens(tokens);

    return {
        sourceCode,
        tokens,
        cst,
        ast
    };
}

/**
 * Variante sin excepciones para consumidores interactivos.
 *
 * @param {string} sourceCode
 * @returns {{
 *   ok: true,
 *   value: ReturnType<typeof parseSource>,
 *   errors: []
 * } | {
 *   ok: false,
 *   value: null,
 *   errors: any[]
 * }}
 */
export function tryParseSource(sourceCode) {
    try {
        return {
            ok: true,
            value: parseSource(sourceCode),
            errors: []
        };
    } catch (error) {
        return {
            ok: false,
            value: null,
            errors: [normalizeFrontendError(error)]
        };
    }
}

/**
 * Garantiza que los consumidores reciban un error serializable y con fase.
 *
 * @param {any} error
 * @returns {any}
 */
export function normalizeFrontendError(error) {
    if (error instanceof FrontendError) {
        return error;
    }

    return new ASTBuildError(
        error instanceof Error
            ? error.message
            : "Unknown language frontend error.",
        null,
        { cause: error }
    );
}

function createParserError(errors) {
    const diagnostics = errors.map(error => {
        const token = getRelevantToken(error);

        return {
            message: error.message,
            location: locationFromToken(token),
            ruleStack: error.context?.ruleStack ?? []
        };
    });

    const firstDiagnostic = diagnostics[0];
    const count = diagnostics.length;

    return new ParserError(
        count === 1
            ? firstDiagnostic.message
            : `Se encontraron ${count} errores sintácticos.`,
        firstDiagnostic?.location ?? null,
        {
            diagnostics,
            cause: errors[0]
        }
    );
}

function getRelevantToken(error) {
    const token = error.token;

    if (
        token &&
        Number.isFinite(token.startLine) &&
        Number.isFinite(token.startColumn)
    ) {
        return token;
    }

    return error.previousToken ?? token ?? null;
}

function locationFromToken(token) {
    if (!token) {
        return null;
    }

    return {
        startLine: finiteOrNull(token.startLine),
        startColumn: finiteOrNull(token.startColumn),
        endLine: finiteOrNull(token.endLine ?? token.startLine),
        endColumn: finiteOrNull(token.endColumn ?? token.startColumn)
    };
}

function finiteOrNull(value) {
    return Number.isFinite(value)
        ? value
        : null;
}
