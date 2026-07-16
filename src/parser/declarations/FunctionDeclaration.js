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