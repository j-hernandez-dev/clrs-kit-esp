const ANSI = Object.freeze({
    reset: "\u001b[0m",
    dim: "\u001b[2m",
    red: "\u001b[31m",
    green: "\u001b[32m",
    yellow: "\u001b[33m",
    cyan: "\u001b[36m"
});
const CLEAR_LINE = "\r\u001b[2K";
const ANSI_PATTERN =
    /\u001b\[[0-?]*[ -/]*[@-~]/gu;

export const TERMINAL_SYMBOLS =
    Object.freeze({
        identity: "●",
        activity: "▶",
        success: "✓",
        error: "✕",
        warning: "!",
        cancellation: "■",
        time: "⌛︎"
    });

export function isTTY(stream) {
    return stream?.isTTY === true;
}

export function hasNoColor(
    environment = process.env
) {
    return Object.prototype.hasOwnProperty.call(
        environment ?? {},
        "NO_COLOR"
    );
}

export function supportsAnsi(
    stream = process.stdout,
    environment = process.env
) {
    return (
        isTTY(stream) &&
        !hasNoColor(environment)
    );
}

export function supportsLiveUpdates(
    stream = process.stdout
) {
    return isTTY(stream);
}

export function ansi(
    text,
    style,
    enabled = true
) {
    const value = String(text);

    if (!enabled) {
        return value;
    }

    const opening = ANSI[style];

    return opening == null
        ? value
        : opening + value + ANSI.reset;
}

/**
 * Lenguaje visual centralizado para la terminal real de CLRS.
 */
export class TerminalUI {

    constructor(options = {}) {
        this.stream =
            options.stream ??
            process.stdout;
        this.environment =
            options.environment ??
            process.env;
        this.separatorWidth =
            options.separatorWidth ?? 60;
        this.ansiEnabled =
            options.ansiEnabled ??
            supportsAnsi(
                this.stream,
                this.environment
            );
        this.liveUpdatesEnabled =
            options.liveUpdatesEnabled ??
            supportsLiveUpdates(this.stream);
    }

    identity(label = "CLRS Runtime") {
        return this.paint(
            `${TERMINAL_SYMBOLS.identity} ${label}`,
            "cyan"
        );
    }

    separator() {
        return this.secondary(
            "─".repeat(
                this.separatorWidth
            )
        );
    }

    activity(message) {
        return this.paint(
            `${TERMINAL_SYMBOLS.activity} ${message}`,
            "cyan"
        );
    }

    success(message) {
        return this.paint(
            `${TERMINAL_SYMBOLS.success} ${message}`,
            "green"
        );
    }

    error(message) {
        return this.paint(
            `${TERMINAL_SYMBOLS.error} ${message}`,
            "red"
        );
    }

    warning(message) {
        return this.paint(
            `${TERMINAL_SYMBOLS.warning} ${message}`,
            "yellow"
        );
    }

    cancellation(message) {
        return this.paint(
            `${TERMINAL_SYMBOLS.cancellation} ${message}`,
            "yellow"
        );
    }

    secondary(message) {
        return this.paint(
            message,
            "dim"
        );
    }

    section(message) {
        return this.paint(
            message,
            "cyan"
        );
    }

    time(milliseconds) {
        const numericValue =
            Number(milliseconds);
        const rounded = Number.isFinite(
            numericValue
        )
            ? Math.max(
                0,
                Math.round(numericValue)
            )
            : 0;

        return this.secondary(
            `${TERMINAL_SYMBOLS.time}Tiempo: ${rounded} ms`
        );
    }

    progress(
        receivedBytes,
        totalBytes
    ) {
        const received =
            Number(receivedBytes);
        const total = Number(totalBytes);

        if (
            !Number.isFinite(received) ||
            !Number.isFinite(total) ||
            received < 0 ||
            total <= 0
        ) {
            return null;
        }

        const ratio = Math.min(
            1,
            received / total
        );
        const percentage = Math.floor(
            ratio * 100
        );
        const columns = Number.isFinite(
            Number(this.stream?.columns)
        )
            ? Number(this.stream.columns)
            : 80;
        const width = Math.min(
            40,
            Math.max(1, columns - 8)
        );
        const occupied = Math.floor(
            ratio * width
        );
        const hasHead =
            occupied > 0 &&
            occupied < width;
        const completedWidth = hasHead
            ? occupied - 1
            : occupied;
        const completed =
            "━".repeat(completedWidth);
        const head = hasHead ? "╸" : "";
        const pending = "─".repeat(
            width - completedWidth -
            head.length
        );

        return (
            "  " +
            this.paint(
                completed + head,
                "cyan"
            ) +
            this.secondary(pending) +
            " " +
            String(percentage).padStart(
                3,
                " "
            ) +
            "%"
        );
    }

    updateProgress(
        receivedBytes,
        totalBytes
    ) {
        const progress = this.progress(
            receivedBytes,
            totalBytes
        );

        return progress == null
            ? false
            : this.updateLine(progress);
    }

    updateLine(message) {
        if (!this.liveUpdatesEnabled) {
            return false;
        }

        this.stream.write?.(
            CLEAR_LINE +
            this.fitLiveLine(message)
        );
        return true;
    }

    clearLine() {
        if (!this.liveUpdatesEnabled) {
            return false;
        }

        this.stream.write?.(CLEAR_LINE);
        return true;
    }

    fitLiveLine(message) {
        const value = String(message);
        const columns = Number(
            this.stream?.columns
        );

        if (
            !Number.isFinite(columns) ||
            columns <= 1
        ) {
            return value;
        }

        const maximumWidth =
            Math.max(
                1,
                Math.floor(columns) - 1
            );
        const plain = value.replace(
            ANSI_PATTERN,
            ""
        );
        const characters = Array.from(plain);

        if (
            characters.length <=
            maximumWidth
        ) {
            return value;
        }

        if (maximumWidth === 1) {
            return "…";
        }

        return (
            characters
                .slice(0, maximumWidth - 1)
                .join("") +
            "…"
        );
    }

    header(
        displayName = null,
        label = "CLRS Runtime"
    ) {
        const lines = [
            this.identity(label),
            this.separator()
        ];

        if (displayName) {
            lines.push(
                this.activity(displayName)
            );
        }

        return lines.join("\n");
    }

    status(status) {
        const normalized =
            String(status).toLocaleLowerCase(
                "es"
            );

        if (
            normalized === "correct" ||
            normalized === "correcto"
        ) {
            return this.success(
                "Estado: Correcto"
            );
        }

        if (
            normalized === "cancelled" ||
            normalized === "cancelado"
        ) {
            return this.cancellation(
                "Estado: Cancelado"
            );
        }

        return this.error(
            `Estado: ${status}`
        );
    }

    styleFirstLine(message, style) {
        const value = String(message);
        const lineBreak = value.indexOf("\n");

        if (lineBreak < 0) {
            return this.paint(value, style);
        }

        return (
            this.paint(
                value.slice(0, lineBreak),
                style
            ) +
            value.slice(lineBreak)
        );
    }

    paint(message, style) {
        return ansi(
            message,
            style,
            this.ansiEnabled
        );
    }
}
