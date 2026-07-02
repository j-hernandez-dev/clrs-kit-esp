// readStatement.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * ==================================
 * ENTRADA
 * ==================================
 *
 * entrada ::=
 *     "Leer"
 *     identificador
 *     { "," L_Valor } ;
 */

/**
 * @param {any} parser
 */
export function registerReadRules(parser) {

  parser.RULE("readStatement", () => {

    parser.CONSUME(Tokens.Scan);

    // Primer identificador obligatorio
    parser.SUBRULE(parser.LValue);

    // Identificadores adicionales
    parser.MANY(() => {

      parser.CONSUME(Tokens.Comma);

      parser.SUBRULE2(parser.LValue);

    });

  });

}