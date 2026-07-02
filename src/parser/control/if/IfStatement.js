// ifStatement.js

import * as Tokens from "../../../lexer/tokens/Index.js";

/**
 * ==================================
 * IF
 * ==================================
 *
 * if_stmt ::=
 *     "Si"
 *     expresion
 *     "Entonces"
 *
 *     bloque
 *
 *     { else_if }
 *
 *     [ else ]
 *
 *     "Fin"
 *     "Si" ;
 */

/**
 * @param {any} parser
 */
export function registerIfRules(parser) {

  parser.RULE("ifStatement", () => {

    parser.CONSUME(Tokens.If);

    parser.SUBRULE(parser.expression);

    parser.CONSUME(Tokens.Indent);

    parser.SUBRULE(parser.block);

    parser.CONSUME(Tokens.Dedent);

    parser.MANY(() => {
      parser.SUBRULE(parser.elseIfClause);
    });

    parser.OPTION(() => {
      parser.SUBRULE(parser.elseClause);
    });
  });

}