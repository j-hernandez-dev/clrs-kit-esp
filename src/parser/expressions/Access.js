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

    parser.OR([
      {
        GATE: () =>
          parser.LA(1).tokenType === Tokens.Identifier &&
          parser.LA(2).tokenType === Tokens.LBracket,
        ALT: () => {
          parser.SUBRULE(parser.primary);

          parser.AT_LEAST_ONE(() => {
            parser.CONSUME(Tokens.LBracket);
            parser.SUBRULE(parser.expression);
            parser.CONSUME(Tokens.RBracket);
          });
        }
      },
      {
        ALT: () => {
          parser.SUBRULE2(parser.primary);
        }
      }
    ]);

  });

}
