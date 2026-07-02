// literals.js

import { createToken } from "chevrotain";

/**
 * =========================
 * IDENTIFICADORES
 * =========================
 * variables, funciones, etc.
 */
export const Identifier = createToken({
  name: "Identifier",
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
  label: "identificador"
});

/**
 * =========================
 * NÚMEROS ENTEROS
 * =========================
 */
export const NumberLiteral = createToken({
  name: "NumberLiteral",
  pattern: /\d+/,
  label: "numero"
});

/**
 * =========================
 * NOTACIÓN CIENTÍFICA
 * =========================
 */
export const ScientificLiteral = createToken({
  name: "ScientificLiteral",
  pattern: /\d+(\.\d+)?[eE][+-]?\d+/,
  label: "numeroCientifico"
});

/**
 * =========================
 * STRINGS
 * =========================
 */
export const StringLiteral = createToken({
  name: "StringLiteral",
  pattern: /"([^"\\]|\\.)*"/,
  label: "cadena"
});

/**
 * =========================
 * BOOLEAN
 * =========================
 */
export const TrueLiteral =
createToken({
  name: "TrueLiteral",
  pattern: /VERDAD/,
  label: "VERDAD"
});

export const FalseLiteral =
createToken({
  name: "FalseLiteral",
  pattern: /FALSO/,
  label: "FALSO"
});

/**
 * =========================
 * AGRUPACIÓN
 * =========================
 */
export const LITERALS = [
  ScientificLiteral,
  NumberLiteral,

  StringLiteral,

  TrueLiteral,
  FalseLiteral,

  Identifier
];