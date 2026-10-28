export const LANGUAGE_ESCAPE_CHARACTERS =
    new Set([
        "n",
        "t",
        '"',
        "r",
        "b"
    ]);

const LANGUAGE_ESCAPE_VALUES =
    Object.freeze({
        n: "\n",
        t: "\t",
        '"': '"',
        r: "\r",
        b: "\b"
    });

export function decodeLanguageStringLiteral(value) {
    const source = String(value);
    let result = "";

    for (let index = 0; index < source.length;) {
        if (source[index] !== "\\") {
            result += source[index];
            index += 1;
            continue;
        }

        let runEnd = index;

        while (source[runEnd] === "\\") {
            runEnd += 1;
        }

        const runLength = runEnd - index;
        const escapeCharacter = source[runEnd];

        if (
            runLength === 1 &&
            LANGUAGE_ESCAPE_CHARACTERS
                .has(escapeCharacter)
        ) {
            result +=
                LANGUAGE_ESCAPE_VALUES[
                    escapeCharacter
                ];
            index = runEnd + 1;
            continue;
        }

        result += "\\".repeat(runLength);
        index = runEnd;
    }

    return result;
}
