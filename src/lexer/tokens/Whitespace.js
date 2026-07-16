// whitespace.js

import { createToken, Lexer } from "chevrotain";

/**
 * =========================
 * WHITESPACE
 * =========================
 * Espacios, tabulaciones y saltos de línea.
 * Se ignoran durante el análisis léxico.
 */
export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /[ \t]+/,
  group: Lexer.SKIPPED
});

/**
 * INDENT
 */

export const NewLine = createToken({
  name: "NewLine",
  pattern: /\r?\n/,
  label: "nuevaLinea"
});

export const Indent = createToken({
  name: "Indent",
  pattern: Lexer.NA,
  label: "indentación"
});

export const Dedent = createToken({
  name: "Dedent",
  pattern: Lexer.NA,
  label: "desindentación"
});

/**
 * =========================
 * EXPORT LIST
 * =========================
 */
export const WHITESPACE = [
  WhiteSpace,
  NewLine,
  Indent,
  Dedent
];