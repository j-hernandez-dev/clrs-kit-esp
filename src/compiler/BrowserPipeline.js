import "./utils/ProgramKey.js";

import {
  buildASTFromTokens,
  tokenizeSource,
  tryParseSource
} from "../language/LanguageFrontend.js";
import { formatLanguageError } from "../errors/ErrorFormatter.js";

/**
 * API histórica conservada para consumidores del navegador.
 *
 * @param {string} sourceCode
 * @returns {import("chevrotain").IToken[]|null}
 */
export function tokenizeCode(sourceCode) {
  try {
    return tokenizeSource(sourceCode);
  } catch (error) {
    reportError(error);
    return null;
  }
}

/**
 * API histórica conservada para consumidores del navegador.
 *
 * @param {import("chevrotain").IToken[]} tokens
 * @returns {any|null}
 */
export function parserCode(tokens) {
  try {
    return buildASTFromTokens(tokens).ast;
  } catch (error) {
    reportError(error);
    return null;
  }
}

/**
 * Construye un AST mediante el frontend compartido.
 *
 * @param {string} sourceCode
 * @returns {any|null}
 */
export function getAST(sourceCode) {
  const result = tryParseSource(sourceCode);

  if (!result.ok) {
    reportError(result.errors[0]);
    return null;
  }

  return result.value.ast;
}

function reportError(error) {
  console.error(formatLanguageError(error));
}
