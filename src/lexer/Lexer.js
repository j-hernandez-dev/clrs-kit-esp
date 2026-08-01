// lexer.js

import { Lexer } from "chevrotain";
import { TOKEN_VOCABULARY } from "./TokenVocabulary.js";
import { LexicalError } from "../errors/FrontendErrors.js";
import {
  spanishLexerErrorMessageProvider
} from "../language/diagnostics/SpanishLexerErrorMessageProvider.js";

/**
 * ==================================
 * GADDIS LEXER
 * ==================================
 */

export const GaddisLexer = new Lexer(
  TOKEN_VOCABULARY,
  {
    errorMessageProvider:
      spanishLexerErrorMessageProvider
  }
);

/**
 * ==================================
 * TOKENIZE
 * ==================================
 * 
 * Convierte código fuente Gaddis
 * en una secuencia de tokens.
 * @param {string} sourceCode
 */
export function tokenize(sourceCode) {
  const lexingResult = GaddisLexer.tokenize(sourceCode);

  if (lexingResult.errors.length > 0) {
    const diagnostics = lexingResult.errors.map(error => ({
      message: error.message,
      location: {
        startLine: error.line ?? null,
        startColumn: error.column ?? null,
        endLine: error.line ?? null,
        endColumn:
          error.column == null
            ? null
            : error.column + Math.max(error.length ?? 1, 1) - 1
      }
    }));

    throw new LexicalError(
      diagnostics.map(diagnostic => diagnostic.message).join("\n"),
      diagnostics[0]?.location ?? null,
      { diagnostics }
    );
  }

  return lexingResult.tokens;
}
