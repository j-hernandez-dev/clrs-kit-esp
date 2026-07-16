// functionCall.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * ==================================
 * ARGUMENTOS
 * ==================================
 *
 * argumentos ::=
 *     expresion
 *     { "," expresion } ;
 *
 * ==================================
 * LLAMADA FUNCION
 * ==================================
 *
 * llamada_funcion ::=
 *     identificador
 *     "("
 *     [ argumentos ]
 *     ")" ;
 */

/**
 * @param {any} parser
 */
export function registerFunctionCallRules(parser) {

  /**
   * argumentos
   */
  parser.RULE("argumentsList", () => {

    parser.SUBRULE(parser.expression);

    parser.MANY(() => {

      parser.CONSUME(Tokens.Comma);

      parser.SUBRULE2(parser.expression);

    });

  });

  /**
   * llamada_funcion
   */
  parser.RULE("functionCall", () => {

    parser.CONSUME(Tokens.Identifier);

    parser.CONSUME(Tokens.LParen);

    parser.OPTION(() => {
      parser.SUBRULE(parser.argumentsList);
    });

    parser.CONSUME(Tokens.RParen);

  });

}