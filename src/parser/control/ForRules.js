// forRules.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * ==================================
 * FOR
 * ==================================
 *
 * for_stmt ::=
 *     "Para"
 *     identificador
 *     "<-"
 *     expresion
 *
 *     "Hasta"
 *     expresion
 *
 *     "Paso"
 * 
 *     expresion
 *
 *     bloque
 *
 *     "Fin"
 *     "Para" ;
 */

/**
 * @param {any} parser
 */
export function registerForRules(parser) {

  parser.RULE("forStatement", () => {

    parser.CONSUME(Tokens.For);

    parser.CONSUME(Tokens.Identifier);

    parser.CONSUME(Tokens.Assignment);

    parser.SUBRULE(parser.expression);

    parser.OR([
      {
        ALT: () => parser.CONSUME(Tokens.To)
      },
      {
        ALT: () => parser.CONSUME(Tokens.Downto)
      }
    ]);

    parser.SUBRULE2(parser.expression);

    parser.CONSUME(Tokens.Indent);

    parser.SUBRULE(parser.block);

    parser.CONSUME(Tokens.Dedent);

  });

}