// comments.js

import { createToken, Lexer } from "chevrotain";

/**
 * =========================
 * COMENTARIOS DE LÍNEA
 * =========================
 * // comentario
 */
export const LineComment = createToken({
  name: "LineComment",
  pattern: /\/\/[^\n\r]*/,
  label: "lineaComentario",
  group: Lexer.SKIPPED
});

/**
 * =========================
 * EXPORT LIST
 * =========================
 */
export const COMMENTS = [
  LineComment
];