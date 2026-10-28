import {
    existsSync,
    readFileSync,
    unlinkSync
} from "node:fs";

export class ExecutionTraceFileSession {

    constructor(options) {
        this.tracePath = options.tracePath;
        this.onEvent = options.onEvent;
        this.onFinish =
            options.onFinish ?? (() => {});
        this.logger =
            options.logger ?? console;
        this.intervalMs =
            options.intervalMs ?? 40;
        this.fileSystem =
            options.fileSystem ?? {
                existsSync,
                readFileSync,
                unlinkSync
            };
        this.setInterval =
            options.setInterval ??
            globalThis.setInterval;
        this.clearInterval =
            options.clearInterval ??
            globalThis.clearInterval;
        this.setTimeout =
            options.setTimeout ??
            globalThis.setTimeout;
        this.offset = 0;
        this.buffer = "";
        this.timer = null;
        this.disposed = false;
    }

    start() {
        this.removeTraceFile();
        this.timer = this.setInterval(
            () => this.poll(),
            this.intervalMs
        );

        return this;
    }

    poll() {
        if (
            this.disposed ||
            !this.fileSystem
                .existsSync(this.tracePath)
        ) {
            return;
        }

        try {
            const source = String(
                this.fileSystem.readFileSync(
                    this.tracePath,
                    "utf8"
                )
            );

            if (source.length < this.offset) {
                this.offset = 0;
                this.buffer = "";
            }

            this.buffer +=
                source.slice(this.offset);
            this.offset = source.length;
            this.consumeLines();
        } catch (error) {
            this.logger.error?.(
                "Error reading CLRS execution trace:",
                error
            );
        }
    }

    consumeLines() {
        let newlineIndex =
            this.buffer.indexOf("\n");

        while (newlineIndex >= 0) {
            const line = this.buffer
                .slice(0, newlineIndex)
                .trim();

            this.buffer = this.buffer
                .slice(newlineIndex + 1);

            if (line !== "") {
                this.consumeLine(line);
            }

            if (this.disposed) {
                return;
            }

            newlineIndex =
                this.buffer.indexOf("\n");
        }
    }

    consumeLine(line) {
        try {
            const event = JSON.parse(line);

            this.onEvent(event);

            if (
                event.type === "test-result" ||
                (
                    event.type === "end" &&
                    event.awaitProcess !== true
                )
            ) {
                this.dispose({
                    cleanupDelayMs: 1000
                });
            }
        } catch (error) {
            this.logger.error?.(
                "Invalid CLRS execution trace event:",
                error
            );
        }
    }

    dispose(options = {}) {
        if (this.disposed) {
            return;
        }

        this.disposed = true;

        if (this.timer != null) {
            this.clearInterval(this.timer);
            this.timer = null;
        }

        if (
            (options.cleanupDelayMs ?? 0) > 0
        ) {
            this.setTimeout(
                () => this.removeTraceFile(),
                options.cleanupDelayMs
            );
        } else {
            this.removeTraceFile();
        }
        this.onFinish();
    }

    removeTraceFile() {
        try {
            if (
                this.fileSystem.existsSync(
                    this.tracePath
                )
            ) {
                this.fileSystem.unlinkSync(
                    this.tracePath
                );
            }
        } catch (error) {
            this.logger.error?.(
                "Error removing CLRS execution trace:",
                error
            );
        }
    }
}
