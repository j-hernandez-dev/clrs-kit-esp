// assignmentStatement.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * ==================================
 * ASIGNACIÓN
 * ==================================
 *
 * asignacion ::=
 *     L_valor
 *     "<-"
 *      expresion ;
 * 
 * L_valor ::=
 *     identificador
 *     { "[" expresion "]" } ;
 */

/**
 * @param {any} parser
 */
export function registerAssignmentRules(parser) {

  parser.RULE("assignmentStatement", () => {

    parser.SUBRULE(parser.LValue);

    parser.CONSUME(Tokens.Assignment);

    parser.SUBRULE(parser.expression);

  });

  parser.RULE("LValue", () => {

    parser.CONSUME(Tokens.Identifier);

    parser.MANY(() => {
      parser.CONSUME(Tokens.LBracket);
      parser.SUBRULE(parser.expression);
      parser.CONSUME(Tokens.RBracket);
    });
  });
}