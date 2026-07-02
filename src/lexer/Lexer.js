// lexer.js

import { Lexer } from "chevrotain";
import { TOKEN_VOCABULARY } from "./TokenVocabulary.js";

/**
 * ==================================
 * GADDIS LEXER
 * ==================================
 */

export const GaddisLexer = new Lexer(TOKEN_VOCABULARY);

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
    throw new Error(
      `Lexing failed:\n${lexingResult.errors
        .map(error => error.message)
        .join("\n")}`
    );
  }

  return lexingResult.tokens;
}