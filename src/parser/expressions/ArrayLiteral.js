// ArrayLiteral.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * ==================================
 * LITERAL DE ARREGLO
 * ==================================
 *
 * arrayLiteral ::=
 *     "["
 *     [ expression { "," expression } ]
 *     "]" ;
 *
 * El contrato admite arreglos vacíos, expresiones como elementos y
 * anidamiento recursivo. La coma final no forma parte de la gramática.
 *
 * @param {any} parser
 */
export function registerArrayLiteralRules(parser) {
  parser.RULE("arrayLiteral", () => {
    parser.CONSUME(Tokens.LBracket);

    parser.OPTION(() => {
      parser.SUBRULE(parser.expression);

      parser.MANY(() => {
        parser.CONSUME(Tokens.Comma);
        parser.SUBRULE2(parser.expression);
      });
    });

    parser.CONSUME(Tokens.RBracket);
  });
}
