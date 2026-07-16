// logical.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * ==================================
 * LOGICA
 * ==================================
 *
 * logica ::= or_expr ;
 * 
 * or_expr ::= and_expr { "O" and_expr } ;
 * 
 * and_expr ::= not_expr { "Y" not_expr } ;
 * 
 * not_expr ::= "No" not_expr | comparacion ;
 */

/**
 * @param {any} parser
 */
export function registerLogicalRules(parser) {

  // =========================
  // OR (nivel más bajo)
  // =========================
  parser.RULE("logical", () => {
    parser.SUBRULE(parser.logicalOr);
  });

  parser.RULE("logicalOr", () => {
    parser.SUBRULE(parser.logicalAnd);

    parser.MANY(() => {
      parser.CONSUME(Tokens.Or);
      parser.SUBRULE2(parser.logicalAnd);
    });
  });

  // =========================
  // AND (nivel medio)
  // =========================
  parser.RULE("logicalAnd", () => {
    parser.SUBRULE(parser.logicalNot);

    parser.MANY(() => {
      parser.CONSUME(Tokens.And);
      parser.SUBRULE2(parser.logicalNot);
    });
  });

  // =========================
  // NOT (nivel más alto)
  // =========================
  parser.RULE("logicalNot", () => {

    parser.OR([
      {
        ALT: () => {
          parser.CONSUME(Tokens.Not);
          parser.SUBRULE(parser.logicalNot);
        }
      },
      {
        ALT: () => parser.SUBRULE(parser.comparison)
      }
    ]);

  });
}