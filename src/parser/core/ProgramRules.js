// programRules.js

/**
 * ==================================
 * PROGRAMA
 * ==================================
 *
 * programa ::= { instruccion } ;
 */

/**
 * @param {any} parser
 */
export function registerProgramRules(parser) {

  parser.RULE("program", () => {
    parser.MANY(() => {
      parser.SUBRULE(parser.statement);
    });
  });

}