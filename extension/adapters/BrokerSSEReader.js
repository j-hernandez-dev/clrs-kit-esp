const DEFAULT_MAX_EVENT_CHARACTERS =
    1_048_576;

export class BrokerSSEReaderError extends Error {

    constructor(code, message) {
        super(message);
        this.name = "BrokerSSEReaderError";
        this.code = code;
    }
}

/**
 * Convierte un ReadableStream de Server-Sent Events en eventos sin conocer
 * el proveedor ni el formato semántico de `data`.
 */
export class BrokerSSEReader {

    constructor(options = {}) {
        this.createDecoder =
            options.createDecoder ??
            (() => new TextDecoder());
        this.maximumEventCharacters =
            options.maximumEventCharacters ??
            DEFAULT_MAX_EVENT_CHARACTERS;

        if (
            typeof this.createDecoder !==
                "function" ||
            !Number.isSafeInteger(
                this.maximumEventCharacters
            ) ||
            this.maximumEventCharacters < 1
        ) {
            throw new BrokerSSEReaderError(
                "BROKER95_SSE_CONFIGURATION_INVALID",
                "Invalid BROKER.95 SSE reader configuration."
            );
        }
    }

    async *read(body, options = {}) {
        const reader = requireReader(body);
        const signal = options.signal ?? null;
        const decoder = this.createDecoder();
        let buffer = "";
        let event = createEvent();

        try {
            while (true) {
                throwIfAborted(signal);
                const chunk = await reader.read();

                if (chunk.done) {
                    buffer += decoder.decode();

                    for (const line of splitLines(buffer)) {
                        const completed = acceptLine(
                            event,
                            line,
                            this.maximumEventCharacters
                        );

                        if (completed) {
                            yield completed;
                        }
                    }

                    const completed = completeEvent(event);

                    if (completed) {
                        yield completed;
                    }

                    return;
                }

                buffer += decoder.decode(
                    chunk.value,
                    { stream: true }
                );

                const lines = buffer.split("\n");
                buffer = lines.pop();

                for (const line of lines) {
                    const completed = acceptLine(
                        event,
                        trimLineEnding(line),
                        this.maximumEventCharacters
                    );

                    if (completed) {
                        yield completed;
                    }
                }
            }
        } catch (error) {
            try {
                await reader.cancel?.();
            } catch {
                // La cancelación secundaria no oculta la causa original.
            }

            throw error;
        } finally {
            reader.releaseLock?.();
        }
    }
}

export const brokerSSEReader = new BrokerSSEReader();

function requireReader(body) {
    if (
        body == null ||
        typeof body.getReader !== "function"
    ) {
        throw new BrokerSSEReaderError(
            "BROKER95_SSE_BODY_INVALID",
            "BROKER.95 expected a readable SSE body."
        );
    }

    const reader = body.getReader();

    if (
        reader == null ||
        typeof reader.read !== "function"
    ) {
        throw new BrokerSSEReaderError(
            "BROKER95_SSE_READER_INVALID",
            "BROKER.95 expected an SSE reader."
        );
    }

    return reader;
}

function createEvent() {
    return {
        name: "message",
        id: null,
        data: []
    };
}

function acceptLine(event, line, maximum) {
    if (line.length === 0) {
        const completed = completeEvent(event);
        resetEvent(event);
        return completed;
    }

    if (line.startsWith(":")) {
        return null;
    }

    const separator = line.indexOf(":");
    const field = separator === -1
        ? line
        : line.slice(0, separator);
    const rawValue = separator === -1
        ? ""
        : line.slice(separator + 1);
    const value = rawValue.startsWith(" ")
        ? rawValue.slice(1)
        : rawValue;

    switch (field) {
        case "event":
            event.name = value || "message";
            break;

        case "id":
            if (!value.includes("\u0000")) {
                event.id = value || null;
            }
            break;

        case "data":
            event.data.push(value);

            if (
                event.data.join("\n").length > maximum
            ) {
                throw new BrokerSSEReaderError(
                    "BROKER95_SSE_EVENT_TOO_LARGE",
                    "BROKER.95 received an oversized SSE event."
                );
            }
            break;

        default:
            break;
    }

    return null;
}

function completeEvent(event) {
    if (event.data.length === 0) {
        return null;
    }

    return Object.freeze({
        event: event.name,
        id: event.id,
        data: event.data.join("\n")
    });
}

function resetEvent(event) {
    event.name = "message";
    event.id = null;
    event.data = [];
}

function splitLines(value) {
    return value.split("\n").map(
        trimLineEnding
    );
}

function trimLineEnding(value) {
    return value.endsWith("\r")
        ? value.slice(0, -1)
        : value;
}

function throwIfAborted(signal) {
    if (signal?.aborted) {
        throw new BrokerSSEReaderError(
            "BROKER95_SSE_ABORTED",
            "BROKER.95 SSE reading was aborted."
        );
    }
}
