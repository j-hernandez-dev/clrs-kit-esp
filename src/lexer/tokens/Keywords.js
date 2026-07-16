// keywords.js

import { createToken } from "chevrotain";

/**
 * =========================
 * CONTROL FLOW
 * =========================
 */

export const If = createToken({
  name: "If",
  pattern: /\bsi\b/,
  label: "si"
});

export const Else = createToken({
  name: "Else",
  pattern: /\bsino\b/,
  label: "sino"
});

export const While = createToken({
  name: "While",
  pattern: /\bmientras\b/,
  label: "mientras"
});

export const For = createToken({
  name: "For",
  pattern: /\bpara\b/,
  label: "para"
});

export const To = createToken({
  name: "To",
  pattern: /\bhasta\b/,
  label: "hasta"
});

export const Downto = createToken({
  name: "Downto",
  pattern: /\bbajando\b/,
  label: "bajando"
});

/**
 * =========================
 * SUBPROGRAMS
 * =========================
 */

export const Return = createToken({
  name: "Return",
  pattern: /\bretornar\b/,
  label: "retornar"
});

/**
 * =========================
 * IO
 * =========================
 */
export const Print = createToken({
  name: "Print",
  pattern: /\bescribir\b/,
  label: "escribir"
});

export const Scan = createToken({
  name: "Scan",
  pattern: /\bleer\b/,
  label: "leer"
});

/**
 * =========================
 * WORD OPERATORS
 * =========================
 */
export const And = createToken({
  name: "And",
  pattern: /\by\b/,
  label: "y"
});

export const Or = createToken({
  name: "Or",
  pattern: /\bo\b/,
  label: "o"
});

export const Not = createToken({
  name: "Not",
  pattern: /\bno\b/,
  label: "no"
});

/**
 * =========================
 * EXPORT LIST
 * =========================
 */
export const KEYWORDS = [
  If,
  Else,

  While,

  For,
  To,
  Downto,

  Return,

  Print,
  Scan,

  And,
  Or,
  Not,
];