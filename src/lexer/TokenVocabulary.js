// tokenVocabulary.js

import {
  // Keywords
  KEYWORDS,

  // Literals
  LITERALS,

  // Operators
  OPERATORS,

  // Punctuation
  PUNCTUATION,

  // Comments
  COMMENTS,

  // Whitespace
  WHITESPACE
} from "./tokens/Index.js";

/**
 * ==================================
 * TOKEN VOCABULARY
 * ==================================
 *
 * El orden es CRÍTICO en Chevrotain.
 */
export const TOKEN_VOCABULARY = [

  /**
   * Ignorados
   */
  ...WHITESPACE,
  ...COMMENTS,

  /**
   * Keywords
   *
   * Deben ir antes de Identifier.
   */
  ...KEYWORDS,

  /**
   * Literales
   *
   * Scientific -> Float -> Integer
   * antes de Identifier.
   */
  ...LITERALS,

  /**
   * Operadores
   *
   * Los compuestos ya están ordenados
   * dentro de operators.js
   */
  ...OPERATORS,

  /**
   * Puntuación
   */
  ...PUNCTUATION
];