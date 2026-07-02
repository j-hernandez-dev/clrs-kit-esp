// expression.js

/**
 * ==================================
 * EXPRESION
 * ==================================
 *
 * expresion ::= logica ;
 */

/**
 * @param {any} parser
 */
export function registerExpressionRules(parser) {

  parser.RULE("expression", () => {

    parser.SUBRULE(parser.logical);

  });

}