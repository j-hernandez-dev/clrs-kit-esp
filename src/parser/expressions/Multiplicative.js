// multiplicative.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * termino ::=
 *     potencia
 *     {
 *         ("*" | "/" | "MOD")
 *         potencia
 *     } ;
 */

/**
 * @param {any} parser
 */
export function registerMultiplicativeRules(parser) {

  parser.RULE("multiplicative", () => {

    parser.SUBRULE(parser.unary);

    parser.MANY(() => {

      parser.OR([
        { ALT: () => parser.CONSUME(Tokens.Multiply) },
        { ALT: () => parser.CONSUME(Tokens.Divide) },
        { ALT: () => parser.CONSUME(Tokens.Mod) }
      ]);

      parser.SUBRULE2(parser.unary);

    });

  });

}