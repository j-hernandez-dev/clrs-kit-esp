const DEFAULT_FRAMES = Object.freeze([
    "⠋",
    "⠙",
    "⠹",
    "⠸",
    "⠼",
    "⠴",
    "⠦",
    "⠧",
    "⠇",
    "⠏"
]);

const SYSTEM_SCHEDULER = Object.freeze({
    setTimeout(callback, delay) {
        return globalThis.setTimeout(
            callback,
            delay
        );
    },
    clearTimeout(handle) {
        globalThis.clearTimeout(handle);
    },
    setInterval(callback, delay) {
        return globalThis.setInterval(
            callback,
            delay
        );
    },
    clearInterval(handle) {
        globalThis.clearInterval(handle);
    }
});

/** Spinner diferido que nunca modifica stdin ni la salida del programa. */
export class TerminalSpinner {

    constructor(options) {
        this.terminalUI = options.terminalUI;
        this.writeLine =
            options.writeLine ?? (() => {});
        this.scheduler =
            options.scheduler ??
            SYSTEM_SCHEDULER;
        this.delayMs =
            options.delayMs ?? 200;
        this.intervalMs =
            options.intervalMs ?? 80;
        this.frames =
            options.frames ??
            DEFAULT_FRAMES;
        this.running = false;
        this.visible = false;
        this.frameIndex = 0;
        this.delayHandle = null;
        this.intervalHandle = null;
        this.message = "";
    }

    start(message) {
        this.stop();
        this.running = true;
        this.message = String(message);
        this.frameIndex = 0;

        if (
            !this.terminalUI
                .liveUpdatesEnabled
        ) {
            this.writeLine(
                this.terminalUI.activity(
                    this.message
                )
            );
            return;
        }

        this.delayHandle =
            this.scheduler.setTimeout(
                () => {
                    this.delayHandle = null;

                    if (!this.running) {
                        return;
                    }

                    this.render();
                    this.intervalHandle =
                        this.scheduler
                            .setInterval(
                                () =>
                                    this.render(),
                                this.intervalMs
                            );
                },
                this.delayMs
            );
    }

    stop() {
        this.running = false;

        if (this.delayHandle != null) {
            this.scheduler.clearTimeout(
                this.delayHandle
            );
            this.delayHandle = null;
        }

        if (this.intervalHandle != null) {
            this.scheduler.clearInterval(
                this.intervalHandle
            );
            this.intervalHandle = null;
        }

        if (this.visible) {
            this.terminalUI.clearLine();
            this.visible = false;
        }
    }

    dispose() {
        this.stop();
    }

    render() {
        const frame = this.frames[
            this.frameIndex %
            this.frames.length
        ];
        this.frameIndex += 1;
        this.visible =
            this.terminalUI.updateLine(
                this.terminalUI.section(
                    `${frame} ${this.message}`
                )
            );
    }
}
