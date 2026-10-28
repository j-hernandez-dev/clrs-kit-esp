// primary.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * ==================================
 * PRIMARIO
 * ==================================
 *
 * primario ::=
 *       numero
 *     | cadena
 *     | logico
 *     | NULO
 *     | literal_arreglo
 *     | llamada_funcion
 *     | acceso
 *     | "(" expresion ")" ;
 * 
 * 
 */

/**
 * @param {any} parser
 */
export function registerPrimaryRules(parser) {

  parser.RULE("primary", () => {

    parser.OR([

      /**
       * numero
       */
      {
        ALT: () => {
          parser.OR1([
            { ALT: () => parser.CONSUME(Tokens.ScientificLiteral) },
            { ALT: () => parser.CONSUME(Tokens.NumberLiteral) }
          ]);
        }
      },

      /**
       * cadena
       */
      {
        ALT: () => {
          parser.CONSUME(Tokens.StringLiteral);
        }
      },

      /**
       * logico
       */
      {
        ALT: () => {
          parser.OR2([
            { ALT: () => parser.CONSUME(Tokens.TrueLiteral) },
            { ALT: () => parser.CONSUME(Tokens.FalseLiteral) }
          ]);
        }
      },

      /**
       * NULO
       */
      {
        ALT: () => {
          parser.CONSUME(Tokens.NullLiteral);
        }
      },

      /**
       * literal_arreglo
       */
      {
        ALT: () => {
          parser.SUBRULE(parser.arrayLiteral);
        }
      },

      /** * llamada_funcion * * Debe ir antes que Identifier. */
      {
        GATE: () => parser.LA(2).tokenType === Tokens.LParen,
        ALT: () => { return parser.SUBRULE(parser.functionCall);

        }
      },

      /**
       * identificador
       */
      {
        ALT: () => {
          parser.CONSUME(Tokens.Identifier);
        }
      },

      /**
       * "(" expresion ")"
       */
      {
        ALT: () => {
          parser.CONSUME(Tokens.LParen);
          parser.SUBRULE(parser.expression);
          parser.CONSUME(Tokens.RParen);
        }
      }

    ]);

  });

}
