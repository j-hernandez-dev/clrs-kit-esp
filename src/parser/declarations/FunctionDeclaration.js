// functionDeclaration.js

import * as Tokens from "../../lexer/tokens/Index.js";

/**
 * ==================================
 * FUNCIÓN
 * ==================================
 *
 * funcion ::=
 *     "Funcion"
 *      tipo
 *      identificador
 *      "(" [ parametros ] ")"
 *      bloque
 *      "Fin" "Funcion"
 *     ;
 */

/**
 * @param {any} parser
 */
export function registerFunctionDeclarationRules(parser) {
    /**
     * Reconocimiento acotado para resolver la ambigüedad entre
     * `nombre(parametros)` como declaración y como llamada. No inspecciona
     * el bloque: una vez encontrado el INDENT, la declaración debe conservar
     * y comunicar cualquier error real de su cuerpo.
     */
    parser.RULE("functionDeclarationStart", () => {
        parser.CONSUME(Tokens.Identifier);

        parser.CONSUME(Tokens.LParen);

        parser.OPTION(() => {
            parser.SUBRULE(parser.parameterList);
        });

        parser.CONSUME(Tokens.RParen);

        parser.CONSUME(Tokens.Indent);
    });

    parser.RULE("functionDeclaration", () => {
        
        parser.CONSUME(Tokens.Identifier);

        parser.CONSUME(Tokens.LParen);

        parser.OPTION(() => {
            parser.SUBRULE(parser.parameterList);
        });

        parser.CONSUME(Tokens.RParen);

        parser.CONSUME(Tokens.Indent);

        parser.SUBRULE(parser.block);

        parser.CONSUME(Tokens.Dedent);
    });
}
