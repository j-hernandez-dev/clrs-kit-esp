// punctuation.js

import { createToken } from "chevrotain";

/**
 * =========================
 * GROUPING
 * =========================
 */
export const LParen = createToken({
  name: "LParen",
  pattern: /\(/,
  label: "("
});

export const RParen = createToken({
  name: "RParen",
  pattern: /\)/,
  label: ")"
});

/**
 * =========================
 * ARRAYS / INDEXING
 * =========================
 */
export const LBracket = createToken({
  name: "LBracket",
  pattern: /\[/,
  label: "["
});

export const RBracket = createToken({
  name: "RBracket",
  pattern: /\]/,
  label: "]"
});

/**
 * =========================
 * SEPARATORS
 * =========================
 */
export const Comma = createToken({
  name: "Comma",
  pattern: /,/,
  label: ","
});

export const Colon = createToken({
  name: "Colon",
  pattern: /:/,
  label: ":"
});

export const Semicolon = createToken({
  name: "Semicolon",
  pattern: /;/,
  label: ";"
});

export const Dot = createToken({
  name: "Dot",
  pattern: /\./,
  label: "."
});

/**
 * =========================
 * EXPORT LIST
 * =========================
 */
export const PUNCTUATION = [
  LParen,
  RParen,

  LBracket,
  RBracket,
  
  Comma,
  Colon,
  Semicolon,
  Dot
];