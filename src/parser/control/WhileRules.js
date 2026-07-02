// whileRules.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * ==================================
 * WHILE
 * ==================================
 *
 * while_stmt ::=
 *     "Mientras"
 *     expresion
 *
 *     bloque
 *
 *     "Fin"
 *     "Mientras" ;
 */

/**
 * @param {any} parser
 */
export function registerWhileRules(parser) {

  parser.RULE("whileStatement", () => {

    parser.CONSUME(Tokens.While);

    parser.SUBRULE(parser.expression);
    
    parser.CONSUME(Tokens.Indent);

    parser.SUBRULE(parser.block);

    parser.CONSUME(Tokens.Dedent);
  });

}