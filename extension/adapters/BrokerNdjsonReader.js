const DEFAULT_MAX_LINE_CHARACTERS = 1_048_576;

export class BrokerNdjsonReaderError extends Error {

    constructor(code, message) {
        super(message);
        this.name = "BrokerNdjsonReaderError";
        this.code = code;
    }
}

/**
 * Lector de NDJSON para protocolos locales como Ollama. Conserva el límite,
 * la cancelación y la liberación de recursos del lector SSE sin asumir que
 * el contenido remoto usa eventos HTTP.
 */
export class BrokerNdjsonReader {

    constructor(options = {}) {
        this.createDecoder = options.createDecoder ??
            (() => new TextDecoder());
        this.maximumLineCharacters = options.maximumLineCharacters ??
            DEFAULT_MAX_LINE_CHARACTERS;

        if (
            typeof this.createDecoder !== "function" ||
            !Number.isSafeInteger(this.maximumLineCharacters) ||
            this.maximumLineCharacters < 1
        ) {
            throw new BrokerNdjsonReaderError(
                "BROKER95_NDJSON_CONFIGURATION_INVALID",
                "Invalid BROKER.95 NDJSON reader configuration."
            );
        }
    }

    async *read(body, options = {}) {
        const reader = requireReader(body);
        const signal = options.signal ?? null;
        const decoder = this.createDecoder();
        let buffer = "";

        try {
            while (true) {
                throwIfAborted(signal);
                const chunk = await reader.read();

                if (chunk.done) {
                    buffer += decoder.decode();
                    const finalLine = buffer.trim();

                    if (finalLine.length > 0) {
                        yield requireLine(finalLine, this.maximumLineCharacters);
                    }

                    return;
                }

                buffer += decoder.decode(chunk.value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop();

                if (buffer.length > this.maximumLineCharacters) {
                    invalidLine();
                }

                for (const line of lines) {
                    const selected = line.endsWith("\r")
                        ? line.slice(0, -1)
                        : line;

                    if (selected.trim().length > 0) {
                        yield requireLine(
                            selected,
                            this.maximumLineCharacters
                        );
                    }
                }
            }
        } catch (error) {
            try {
                await reader.cancel?.();
            } catch {
                // La cancelación secundaria no desplaza la causa inicial.
            }

            throw error;
        } finally {
            reader.releaseLock?.();
        }
    }
}

export const brokerNdjsonReader = new BrokerNdjsonReader();

function requireReader(body) {
    if (body == null || typeof body.getReader !== "function") {
        throw new BrokerNdjsonReaderError(
            "BROKER95_NDJSON_BODY_INVALID",
            "BROKER.95 expected a readable NDJSON body."
        );
    }

    const reader = body.getReader();

    if (reader == null || typeof reader.read !== "function") {
        throw new BrokerNdjsonReaderError(
            "BROKER95_NDJSON_READER_INVALID",
            "BROKER.95 expected an NDJSON reader."
        );
    }

    return reader;
}

function requireLine(line, maximum) {
    if (line.length === 0 || line.length > maximum) {
        invalidLine();
    }

    return line;
}

function throwIfAborted(signal) {
    if (signal?.aborted) {
        throw new BrokerNdjsonReaderError(
            "BROKER95_NDJSON_ABORTED",
            "BROKER.95 NDJSON reading was aborted."
        );
    }
}

function invalidLine() {
    throw new BrokerNdjsonReaderError(
        "BROKER95_NDJSON_LINE_INVALID",
        "BROKER.95 received an invalid NDJSON line."
    );
}
