// comparison.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * comparacion ::=
 *     suma
 *     [
 *         (
 *             "="
 *           | "<>"
 *           | "<"
 *           | ">"
 *           | "<="
 *           | ">="
 *         )
 *         suma
 *     ] ;
 *
 * @param {any} parser
 */
export function registerComparisonRules(parser) {

  parser.RULE("comparison", () => {

    parser.SUBRULE(parser.additive);

    parser.OPTION(() => {

      parser.OR([

        { ALT: () => parser.CONSUME(Tokens.Equal) },
        { ALT: () => parser.CONSUME(Tokens.NotEqual) },
        { ALT: () => parser.CONSUME(Tokens.LessThan) },
        { ALT: () => parser.CONSUME(Tokens.GreaterThan) },
        { ALT: () => parser.CONSUME(Tokens.LessOrEqual) },
        { ALT: () => parser.CONSUME(Tokens.GreaterOrEqual) }

      ]);

      parser.SUBRULE2(parser.additive);

    });

  });

}