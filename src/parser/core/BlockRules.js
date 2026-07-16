// blockRules.js
import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * ==================================
 * BLOQUE
 * ==================================
 *
 * bloque ::= { instruccion } ;
 */

/**
 * @param {any} parser
 */
export function registerBlockRules(parser) {

  parser.RULE("block", () => {
    parser.MANY(() => {
      parser.SUBRULE(parser.statement);
    });
  });

}