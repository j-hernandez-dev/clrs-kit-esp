/**
 * Mensajes léxicos destinados al usuario final.
 */
export const spanishLexerErrorMessageProvider =
    Object.freeze({
        buildUnexpectedCharactersMessage(
            fullText,
            startOffset,
            length
        ) {
            const text =
                fullText.slice(
                    startOffset,
                    startOffset + length
                );
            const printable =
                text
                    .replaceAll("\r", "\\r")
                    .replaceAll("\n", "\\n")
                    .replaceAll("\t", "\\t");

            return length === 1
                ? `Carácter no reconocido: «${printable}».`
                : `Secuencia no reconocida: «${printable}».`;
        },

        /*
         * Este caso representa una configuración inválida del lexer, no un
         * error del código fuente. Se conserva en inglés para desarrollo.
         */
        buildUnableToPopLexerModeMessage(token) {
            return (
                "Unable to pop lexer mode after token " +
                `«${token.image}»: the mode stack is empty.`
            );
        }
    });
