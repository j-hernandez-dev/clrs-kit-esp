// power.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * potencia ::=
 *     acceso
 *     [
 *         "^"
 *         potencia
 *     ] ;
 *
 * Asociatividad derecha:
 * 2 ^ 3 ^ 2
 * =
 * 2 ^ (3 ^ 2)
 */

/**
 * @param {any} parser
 */
export function registerPowerRules(parser) {

  parser.RULE("power", () => {

    parser.SUBRULE(parser.access);

    parser.OPTION(() => {

      parser.CONSUME(Tokens.Power);

      parser.SUBRULE(parser.power);

    });

  });

}