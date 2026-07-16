// operators.js

import { createToken } from "chevrotain";

/**
 * =========================
 * ASIGNACIÓN
 * =========================
 */
export const Assignment = createToken({
    name: "Assignment",
    pattern: /<-/,
    label: "<-"
});

/**
 * =========================
 * ARITMÉTICOS
 * =========================
 */
export const Plus = createToken({
  name: "Plus",
  pattern: /\+/,
  label: "+"
});

export const Minus = createToken({
  name: "Minus",
  pattern: /-/,
  label: "-"
});

export const Multiply = createToken({
  name: "Multiply",
  pattern: /\*/,
  label: "*"
});

export const Divide = createToken({
  name: "Divide",
  pattern: /\//,
  label: "/"
});

export const Power = createToken({
  name: "Power",
  pattern: /\^/,
  label: "^"
});

export const Mod = createToken({
  name: "Mod",
  pattern: /\%/,
  label: "%"
});

/**
 * =========================
 * RELACIONALES
 * =========================
 */

export const LessOrEqual = createToken({
  name: "LessOrEqual",
  pattern: /<=/,
  label: "<="
});

export const GreaterOrEqual = createToken({
  name: "GreaterOrEqual",
  pattern: />=/,
  label: ">="
});

export const NotEqual = createToken({
  name: "NotEqual",
  pattern: /!=/,
  label: "!="
});

export const LessThan = createToken({
  name: "LessThan",
  pattern: /</,
  label: "<"
});

export const GreaterThan = createToken({
  name: "GreaterThan",
  pattern: />/,
  label: ">"
});

export const Equal = createToken({
  name: "Equal",
  pattern: /=/,
  label: "="
});

/**
 * =========================
 * EXPORT AGRUPADO
 * =========================
 */
export const OPERATORS = [
  Assignment,

  Plus,
  Minus,
  Multiply,
  Divide,
  Power,
  Mod,
  
  LessOrEqual,
  GreaterOrEqual,
  NotEqual,
  LessThan,
  GreaterThan,
  Equal,
];