// indentation.js

import { createTokenInstance } from "chevrotain";
import { Indent, Dedent, NewLine } from "./tokens/Index.js";

/**
 * Agrega tokens INDENT y DEDENT.
 *
 * Reglas:
 *  - Los NewLine no se envían al parser.
 *  - Las líneas vacías se ignoran.
 *  - Un aumento de indentación genera un INDENT.
 *  - Una disminución genera uno o varios DEDENT.
 *  - Al terminar el archivo se cierran todos los bloques.
 */
export function addIndentationTokens(tokens) {

    const result = [];
    const indentStack = [0];

    let lastProcessedLine = -1;

    for (const token of tokens) {

        // Nunca enviar NewLine al parser
        if (token.tokenType === NewLine) {
            continue;
        }

        // Sólo calcular indentación una vez por línea
        if (token.startLine !== lastProcessedLine) {

            lastProcessedLine = token.startLine;

            const indent = token.startColumn - 1;
            const currentIndent = indentStack[indentStack.length - 1];

            // ===========================
            // INDENT
            // ===========================
            if (indent > currentIndent) {

                indentStack.push(indent);

                result.push(
                    createTokenInstance(
                        Indent,
                        "<INDENT>",
                        token.startOffset,
                        token.startOffset,
                        token.startLine,
                        token.startLine,
                        token.startColumn,
                        token.startColumn
                    )
                );
            }

            // ===========================
            // DEDENT
            // ===========================
            else if (indent < currentIndent) {

                while (indent < indentStack[indentStack.length - 1]) {

                    indentStack.pop();

                    result.push(
                        createTokenInstance(
                            Dedent,
                            "<DEDENT>",
                            token.startOffset,
                            token.startOffset,
                            token.startLine,
                            token.startLine,
                            token.startColumn,
                            token.startColumn
                        )
                    );
                }

                if (indent !== indentStack[indentStack.length - 1]) {
                    throw new Error(
                        `Indentación inválida en la línea ${token.startLine}.`
                    );
                }
            }
        }

        result.push(token);
    }

    // ===========================
    // Cerrar bloques abiertos
    // ===========================

    const lastToken = tokens[tokens.length - 1];

    while (indentStack.length > 1) {

        indentStack.pop();

        result.push(
            createTokenInstance(
                Dedent,
                "<DEDENT>",
                lastToken?.endOffset ?? 0,
                lastToken?.endOffset ?? 0,
                lastToken?.endLine ?? 0,
                lastToken?.endLine ?? 0,
                lastToken?.endColumn ?? 0,
                lastToken?.endColumn ?? 0
            )
        );
    }

    return result;
}