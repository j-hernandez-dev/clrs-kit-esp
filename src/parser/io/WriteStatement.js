// writeStatement.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * ==================================
 * SALIDA
 * ==================================
 *
 * salida ::=
 *     "Escribir"
 *     expresion
 *     { "," expresion } ;
 */

/**
 * @param {any} parser
 */
export function registerWriteRules(parser) {

  parser.RULE("writeStatement", () => {

    parser.CONSUME(Tokens.Print);

    // Primera expresión obligatoria
    parser.SUBRULE(parser.expression);

    // Expresiones adicionales
    parser.MANY(() => {

      parser.CONSUME(Tokens.Comma);

      parser.SUBRULE2(parser.expression);

    });

  });

}