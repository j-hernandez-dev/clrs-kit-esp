// parameterRules.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * parametros_lista ::=
 *     parametro
 *     { "," parametro } ;
 *
 * parametro ::=
 *     tipo
 *     identificador
 *     dimensiones_opc ;
 * 
 * dimensiones_opc ::=
 *     dimensiones
 *     | ε ;
 */

/**
 * @param {any} parser
 */
export function registerParameterRules(parser) {

  /**
   * parametro ::=
   *     tipo
   *     identificador
   *     dimensiones_opc ;
   */
  parser.RULE("parameter", () => {

    parser.CONSUME(Tokens.Identifier);

    parser.OPTION(() => {
      parser.SUBRULE(parser.parameterDimensionList);
    });
  });

  /**
   * parametros_lista ::=
   *     parametro
   *     { "," parametro } ;
   */
  parser.RULE("parameterList", () => {

    parser.SUBRULE(parser.parameter);

    parser.MANY(() => {

      parser.CONSUME(Tokens.Comma);

      parser.SUBRULE2(parser.parameter);

    });

  });

  parser.RULE("parameterDimensionList", () => {

    parser.AT_LEAST_ONE(() => {

      parser.CONSUME(Tokens.LBracket);

      parser.CONSUME(Tokens.RBracket);

    });
  });
}