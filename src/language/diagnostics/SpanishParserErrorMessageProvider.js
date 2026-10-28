import {
    tokenLabel
} from "chevrotain";

/**
 * Mensajes de reconocimiento destinados al usuario final.
 */
export const spanishParserErrorMessageProvider =
    Object.freeze({
        buildMismatchTokenMessage({
            expected,
            actual
        }) {
            return (
                `Se esperaba ${formatExpectedToken(expected)}, ` +
                `pero se encontró ${formatActualToken(actual)}.`
            );
        },

        buildNotAllInputParsedMessage({
            firstRedundant
        }) {
            return (
                "Se encontró contenido adicional no esperado: " +
                `${formatActualToken(firstRedundant)}.`
            );
        },

        buildNoViableAltMessage({
            expectedPathsPerAlt,
            actual,
            customUserDescription
        }) {
            return formatExpectedPaths({
                paths:
                    expectedPathsPerAlt.flat(),
                actual,
                customUserDescription
            });
        },

        buildEarlyExitMessage({
            expectedIterationPaths,
            actual,
            customUserDescription
        }) {
            return formatExpectedPaths({
                paths: expectedIterationPaths,
                actual,
                customUserDescription
            });
        }
    });

function formatExpectedPaths({
    paths,
    actual,
    customUserDescription
}) {
    if (customUserDescription) {
        return (
            `${customUserDescription}\n` +
            `Se encontró ${formatActualToken(actual[0])}.`
        );
    }

    const sequences =
        uniqueSequences(paths);
    const heading =
        sequences.length === 1
            ? "Se esperaba la siguiente secuencia:"
            : "Se esperaba una de las siguientes secuencias:";
    const list = sequences
        .map(
            (sequence, index) =>
                `  ${index + 1}. ${sequence}`
        )
        .join("\n");

    return (
        `${heading}\n` +
        `${list}\n` +
        "pero se encontró: " +
        `${formatActualToken(actual[0])}.`
    );
}

function uniqueSequences(paths) {
    return [
        ...new Set(
            paths.map(path =>
                "[" +
                path
                    .map(formatTokenType)
                    .join(", ") +
                "]"
            )
        )
    ];
}

function formatExpectedToken(tokenType) {
    const label =
        formatTokenType(tokenType);

    return label === "fin del archivo"
        ? `el ${label}`
        : `«${label}»`;
}

function formatTokenType(tokenType) {
    if (
        tokenType?.name === "EOF"
    ) {
        return "fin del archivo";
    }

    return tokenLabel(tokenType);
}

function formatActualToken(token) {
    if (
        token == null ||
        token.tokenType?.name === "EOF" ||
        token.image === ""
    ) {
        return "el final del archivo";
    }

    return `«${token.image}»`;
}
