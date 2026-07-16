import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * unario ::=
 *       "-" unario
 *     | "+" unario
 *     | potencia ;
 * @param {any} parser
 */
export function registerUnaryRules(parser) {

  parser.RULE("unary", () => {

    parser.OR([
      {
        ALT: () => {
          parser.CONSUME(Tokens.Minus);
          parser.SUBRULE(parser.unary);
        }
      },
      {
        ALT: () => {
          parser.CONSUME(Tokens.Plus);
          parser.SUBRULE2(parser.unary);
        }
      },
      {
        ALT: () => {
          parser.SUBRULE(parser.power);
        }
      }
    ]);

  });

}