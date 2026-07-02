// additive.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * suma ::=
 *     termino
 *     {
 *         ("+" | "-")
 *         termino
 *     } ;
 */

/**
 * @param {any} parser
 */
export function registerAdditiveRules(parser) {

  parser.RULE("additive", () => {

    parser.SUBRULE(parser.multiplicative);

    parser.MANY(() => {

      parser.OR([
        { ALT: () => parser.CONSUME(Tokens.Plus) },
        { ALT: () => parser.CONSUME(Tokens.Minus) }
      ]);

      parser.SUBRULE2(parser.multiplicative);

    });

  });

}