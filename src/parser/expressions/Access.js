// acceso.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * acceso ::=
 *     identificador
 *     { "[" expression "]" } ;
 */

/**
 * @param {any} parser
 */
export function registerAccessRules(parser) {

  parser.RULE("access", () => {

    parser.SUBRULE(parser.primary);

    parser.MANY(() => {

      parser.CONSUME(Tokens.LBracket);
      parser.SUBRULE(parser.expression);
      parser.CONSUME(Tokens.RBracket);

    });

  });

}