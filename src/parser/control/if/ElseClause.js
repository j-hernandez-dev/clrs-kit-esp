// elseClause.js

import * as Tokens from "../../../lexer/tokens/Index.js";

/**
 * ==================================
 * ELSE
 * ==================================
 *
 * else ::=
 *     "Sino"
 *
 *     bloque ;
 */

/**
 * @param {any} parser
 */
export function registerElseRules(parser) {

  parser.RULE("elseClause", () => {

    parser.CONSUME(Tokens.Else);

    parser.CONSUME(Tokens.Indent);

    parser.SUBRULE(parser.block);

    parser.CONSUME(Tokens.Dedent);

  });

}