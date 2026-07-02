// statementRules.js
import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * ==================================
 * INSTRUCCION
 * ==================================
 *
 * instruccion ::=
 *     | constante_declaracion
 *     | variable_declaracion
 *     | asignacion
 *     | entrada
 *     | salida
 *     | if_stmt
 *     | while_stmt
 *     | for_stmt
 *     | switch_stmt
 *     | funcion
 *     | procedimiento
 *     | llamada_procedimiento ;
 */

/**
 * @param {any} parser
 */
export function registerStatementRules(parser) {

  parser.RULE("statement", () => {

    parser.OR([
      /**
       * Funciones
       */
      {
        GATE: parser.BACKTRACK(parser.functionDeclaration),
        ALT: () => parser.SUBRULE(parser.functionDeclaration)
      },

      /**
       * Control de flujo
       */
      {
        ALT: () => parser.SUBRULE(parser.ifStatement)
      },
      {
        ALT: () => parser.SUBRULE(parser.whileStatement)
      },
      {
        ALT: () => parser.SUBRULE(parser.forStatement)
      },
      /**
       * Entrada / salida
       */
      {
        ALT: () => parser.SUBRULE(parser.readStatement)
      },
      {
        ALT: () => parser.SUBRULE(parser.writeStatement)
      },

      /**
       * Retornar
       */
      {
        ALT: () => parser.SUBRULE(parser.returnStatement)
      },

      /**
       * Llamadas
       */
      {
        GATE: () => parser.LA(2).tokenType === Tokens.LParen,
        ALT: () => parser.SUBRULE(parser.functionCall)
      },

      /**
       * Asignación
       *
       * Se deja al final porque comienza
       * con Identifier y suele ser la regla
       * más genérica.
       */
      {
        ALT: () => parser.SUBRULE(parser.assignmentStatement)
      }

    ]);

  });

}