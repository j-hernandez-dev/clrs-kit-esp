import {
    existsSync,
    unlinkSync,
    writeFileSync
} from "node:fs";

export class ExecutionControlFileSession {

    constructor(options) {
        this.controlPath =
            options.controlPath;
        this.logger =
            options.logger ?? console;
        this.fileSystem =
            options.fileSystem ?? {
                existsSync,
                unlinkSync,
                writeFileSync
            };
        this.setTimeout =
            options.setTimeout ??
            globalThis.setTimeout;
        this.clearTimeout =
            options.clearTimeout ??
            globalThis.clearTimeout;
        this.onTerminateTimeout =
            typeof options
                .onTerminateTimeout ===
                "function"
                ? options.onTerminateTimeout
                : null;
        this.terminationGraceMs =
            nonNegativeNumber(
                options.terminationGraceMs
            ) ?? 300;
        this.terminationTimer = null;
        this.sequence = 0;
        this.breakpoints = [];
        this.stopOnEntry = false;
        this.disposed = false;
    }

    start(options = {}) {
        this.breakpoints =
            normalizeBreakpoints(
                options.breakpoints
            );
        this.stopOnEntry =
            options.stopOnEntry === true;
        this.write("configure");

        return this;
    }

    setBreakpoints(lines) {
        this.breakpoints =
            normalizeBreakpoints(lines);
        return this.write("configure");
    }

    pause() {
        return this.write("pause");
    }

    continue() {
        return this.write("continue");
    }

    next() {
        return this.stepOver();
    }

    stepIn() {
        return this.write("stepIn");
    }

    stepOver() {
        return this.write("stepOver");
    }

    stepOut() {
        return this.write("stepOut");
    }

    terminate() {
        const written =
            this.write("terminate");

        this.scheduleTerminationFallback();

        return written;
    }

    write(command) {
        if (this.disposed) {
            return false;
        }

        const state = {
            version: 1,
            sequence: ++this.sequence,
            command,
            breakpoints:
                this.breakpoints.map(
                    cloneBreakpoint
                ),
            stopOnEntry:
                this.stopOnEntry
        };

        try {
            this.fileSystem.writeFileSync(
                this.controlPath,
                JSON.stringify(state) + "\n",
                "utf8"
            );
            return true;
        } catch (error) {
            this.logger.error?.(
                "Error writing CLRS execution control:",
                error
            );
            return false;
        }
    }

    dispose(options = {}) {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.clearTerminationFallback();
        const delay =
            options.cleanupDelayMs ?? 0;

        if (delay > 0) {
            this.setTimeout(
                () => this.removeControlFile(),
                delay
            );
        } else {
            this.removeControlFile();
        }
    }

    removeControlFile() {
        try {
            if (
                this.fileSystem.existsSync(
                    this.controlPath
                )
            ) {
                this.fileSystem.unlinkSync(
                    this.controlPath
                );
            }
        } catch (error) {
            this.logger.error?.(
                "Error removing CLRS execution control:",
                error
            );
        }
    }

    scheduleTerminationFallback() {
        if (!this.onTerminateTimeout) {
            return;
        }

        this.clearTerminationFallback();
        this.terminationTimer =
            this.setTimeout(() => {
                this.terminationTimer = null;

                if (!this.disposed) {
                    this.onTerminateTimeout();
                }
            }, this.terminationGraceMs);
    }

    clearTerminationFallback() {
        if (this.terminationTimer == null) {
            return;
        }

        this.clearTimeout(
            this.terminationTimer
        );
        this.terminationTimer = null;
    }
}

function normalizeBreakpoints(breakpoints) {
    const normalized = [];
    const seen = new Set();

    for (
        const candidate
        of breakpoints ?? []
    ) {
        const breakpoint =
            normalizeBreakpoint(candidate);

        if (!breakpoint) {
            continue;
        }

        const key = breakpoint.id;

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        normalized.push(breakpoint);
    }

    return normalized.sort((left, right) =>
        left.line - right.line ||
        left.id - right.id
    );
}

function normalizeBreakpoint(candidate) {
    if (
        Number.isInteger(candidate) &&
        candidate > 0
    ) {
        return {
            id: candidate,
            line: candidate,
            column: null,
            condition: null,
            hitCondition: null,
            logSegments: null
        };
    }

    if (
        !candidate ||
        typeof candidate !== "object" ||
        !Number.isInteger(candidate.line) ||
        candidate.line <= 0
    ) {
        return null;
    }

    return {
        id:
            Number.isInteger(candidate.id) &&
            candidate.id > 0
                ? candidate.id
                : candidate.line,
        line: candidate.line,
        column:
            Number.isInteger(candidate.column) &&
            candidate.column > 0
                ? candidate.column
                : null,
        condition:
            clonePlain(candidate.condition),
        hitCondition:
            clonePlain(candidate.hitCondition),
        logSegments:
            clonePlain(candidate.logSegments)
    };
}

function cloneBreakpoint(breakpoint) {
    return clonePlain(breakpoint);
}

function clonePlain(value) {
    if (value == null) {
        return null;
    }

    return JSON.parse(JSON.stringify(value));
}

function nonNegativeNumber(value) {
    return Number.isFinite(value) && value >= 0
        ? value
        : null;
}
