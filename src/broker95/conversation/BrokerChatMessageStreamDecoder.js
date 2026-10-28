/**
 * Extrae incrementalmente el valor JSON de `message`. El proveedor transmite
 * el objeto protocolario completo; el Webview sólo debe ver el texto de CIPHER.
 */
export class BrokerChatMessageStreamDecoder {

    constructor() {
        this.source = "";
        this.emittedText = "";
    }

    push(source) {
        if (typeof source !== "string") {
            return "";
        }

        this.source += source;
        const decoded = decodeAvailableMessage(
            this.source
        );

        if (
            decoded == null ||
            !decoded.startsWith(
                this.emittedText
            )
        ) {
            return "";
        }

        const delta = decoded.slice(
            this.emittedText.length
        );

        this.emittedText = decoded;
        return delta;
    }

    finish(message) {
        if (
            typeof message !== "string" ||
            !message.startsWith(
                this.emittedText
            )
        ) {
            return "";
        }

        const delta = message.slice(
            this.emittedText.length
        );

        this.emittedText = message;
        return delta;
    }
}

function decodeAvailableMessage(source) {
    const match = /^\s*\{\s*"message"\s*:\s*"/u
        .exec(source);

    if (!match) {
        return null;
    }

    const raw = source.slice(match[0].length);
    const safeLength = findSafeStringLength(raw);

    try {
        return JSON.parse(
            `"${raw.slice(0, safeLength)}"`
        );
    } catch {
        return null;
    }
}

function findSafeStringLength(source) {
    let index = 0;
    let safeLength = 0;

    while (index < source.length) {
        const character = source[index];

        if (character === "\"") {
            break;
        }

        if (
            character.charCodeAt(0) < 0x20
        ) {
            break;
        }

        if (character !== "\\") {
            index += 1;
            safeLength = index;
            continue;
        }

        const escape = source[index + 1];

        if (escape == null) {
            break;
        }

        if (escape === "u") {
            const hexadecimal = source.slice(
                index + 2,
                index + 6
            );

            if (
                hexadecimal.length !== 4 ||
                !/^[0-9A-Fa-f]{4}$/u
                    .test(hexadecimal)
            ) {
                break;
            }

            index += 6;
            safeLength = index;
            continue;
        }

        if (!/["\\/bfnrt]/u.test(escape)) {
            break;
        }

        index += 2;
        safeLength = index;
    }

    return safeLength;
}
