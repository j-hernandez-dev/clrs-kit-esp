import { spawn } from "node:child_process";
import { guiProcessEnvironment } from "../../infrastructure/gui/GuiProcessAdapter.js";
import {
    appendFileSync,
    readFileSync
} from "node:fs";

import {
    RuntimeExecutionError
} from "../../errors/RuntimeExecutionError.js";
import {
    FileSystemEmitter
} from "./FileSystemEmitter.js";
import {
    TerminalUI
} from "../../application/presenters/TerminalUI.js";

/**
 * Ejecuta artefactos JavaScript mediante Node.js.
 */
export class NodeProgramRunner {

    constructor(options = {}) {
        this.spawn = options.spawn ?? spawn;
        this.fileEmitter =
            options.fileEmitter ??
            new FileSystemEmitter();
        this.logger = options.logger ?? console;
        this.developerLogger =
            options.developerLogger ??
            this.logger;
        this.debug =
            options.debug ??
            process.env.CLRS_DEBUG === "1";
        this.command = options.command ?? "node";
        this.stdio =
            options.stdio ??
            ["inherit", "inherit", "pipe"];
        this.handledRuntimeExitCode =
            options.handledRuntimeExitCode ??
            70;
        this.environment =
            options.environment ??
            process.env;
        this.readFileSync =
            options.readFileSync ??
            readFileSync;
        this.appendFileSync =
            options.appendFileSync ??
            appendFileSync;
        this.standardOutput =
            options.standardOutput ??
            process.stdout;
        this.signalSource =
            options.signalSource ?? process;
        this.clock =
            options.clock ??
            (() => process.hrtime.bigint());
        this.terminalUI =
            options.terminalUI ??
            new TerminalUI({
                stream:
                    options.standardOutput ??
                    process.stdout,
                environment:
                    this.environment
            });
        this.errorTerminalUI =
            options.errorTerminalUI ??
            new TerminalUI({
                stream:
                    options.standardError ??
                    process.stderr,
                environment:
                    this.environment
            });
    }

    /**
     * @param {{
     *   displayName?: string,
     *   programPath: string,
     *   cleanupPath?: string|null
     * }} request
     */
    run(request) {
        const {
            displayName = request.programPath,
            programPath,
            cleanupPath = null
        } = request;

        this.printStart(displayName);

        if (request.signal?.aborted) {
            return this.cleanup(cleanupPath).then(() => { throw request.signal.reason; });
        }

        return new Promise((resolve, reject) => {
            let childProcess;
            let standardError = "";
            let standardOutput = "";
            let outputTruncated = false;
            const captureTestResult =
                this.shouldCaptureTestResult();

            try {
                childProcess = this.spawn(
                    request.command ?? this.command,
                    [programPath],
                    {
                        ...(request.gui ? { env: guiProcessEnvironment(this.environment), windowsHide: true, shell: false } : {}),
                        stdio: captureTestResult
                            ? ["inherit", "pipe", "pipe"]
                            : this.stdio
                    }
                );
            } catch (error) {
                void this.rejectAfterCleanup(
                    this.presentStartFailure(
                        programPath,
                        error
                    ),
                    cleanupPath,
                    reject
                );
                return;
            }

            childProcess.stdout?.on?.(
                "data",
                chunk => {
                    const output = String(chunk);

                    standardOutput = appendBounded(
                        standardOutput,
                        output,
                        65_536,
                        () => {
                            outputTruncated = true;
                        }
                    );
                    this.standardOutput.write?.(
                        output
                    );
                }
            );
            childProcess.stderr?.on?.(
                "data",
                chunk => {
                    standardError = appendBounded(
                        standardError,
                        String(chunk),
                        65_536,
                        () => {
                            outputTruncated = true;
                        }
                    );
                }
            );

            let settled = false;
            let cancellationRequested = false;
            let executionStartedAt = null;
            const markExecutionStarted = () => {
                executionStartedAt =
                    this.clock();
            };
            childProcess.once(
                "spawn",
                markExecutionStarted
            );
            const stopExecutionClock = () => {
                childProcess.off?.(
                    "spawn",
                    markExecutionStarted
                );

                if (
                    executionStartedAt == null
                ) {
                    return null;
                }

                return elapsedMilliseconds(
                    executionStartedAt,
                    this.clock()
                );
            };
            const stopObservingProcessSignals =
                this.observeTerminationSignals(
                    childProcess,
                    () => { cancellationRequested = true; }
                );
            const abort = () => {
                cancellationRequested = true;
                childProcess.kill?.("SIGTERM");
            };
            const stopObservingSignals = () => {
                stopObservingProcessSignals();
                request.signal?.removeEventListener("abort", abort);
            };
            request.signal?.addEventListener("abort", abort, { once: true });
            if (request.signal?.aborted) { abort(); }

            childProcess.once("error", error => {
                if (settled) {
                    return;
                }

                settled = true;
                stopObservingSignals();
                childProcess.off?.(
                    "spawn",
                    markExecutionStarted
                );

                void this.rejectAfterCleanup(
                    this.presentStartFailure(
                        programPath,
                        error
                    ),
                    cleanupPath,
                    reject
                );
            });

            childProcess.once(
                "close",
                (exitCode, signal) => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    stopObservingSignals();
                    const elapsedTime =
                        stopExecutionClock();

                    void this.finishRun(
                        {
                            programPath,
                            cleanupPath,
                            exitCode,
                            signal,
                            standardOutput,
                            outputTruncated,
                            standardError,
                            elapsedTime,
                            cancellationRequested
                        },
                        resolve,
                        reject
                    );
                }
            );
        });
    }

    observeTerminationSignals(childProcess, onCancel = () => {}) {
        const signalSource =
            this.signalSource;

        if (
            typeof signalSource?.once !==
                "function"
        ) {
            return () => {};
        }

        const handlers = new Map();

        for (const signal of [
            "SIGINT",
            "SIGTERM"
        ]) {
            const handler = () => {
                onCancel();
                try {
                    childProcess.kill?.(signal);
                } catch (error) {
                    this.developerLogger.error?.(
                        "Error stopping the generated CLRS program:",
                        error
                    );
                }
            };

            handlers.set(signal, handler);
            signalSource.once(
                signal,
                handler
            );
        }

        return () => {
            for (
                const [signal, handler]
                of handlers
            ) {
                if (
                    typeof signalSource.off ===
                        "function"
                ) {
                    signalSource.off(
                        signal,
                        handler
                    );
                } else {
                    signalSource.removeListener?.(
                        signal,
                        handler
                    );
                }
            }

            handlers.clear();
        };
    }

    async finishRun(
        result,
        resolve,
        reject
    ) {
        const {
            programPath,
            cleanupPath,
            exitCode,
            signal,
            standardError,
            elapsedTime
        } = result;
        const traceStatus =
            this.readRuntimeTraceStatus();
        const status =
            traceStatus === "cancelled" ||
            standardError.trim() === "■ Ejecución cancelada durante la entrada." ||
            result.cancellationRequested ||
            isCancellationSignal(signal) ||
            exitCode === 3221225786 || exitCode === -1073741510
                ? "Cancelled"
                : exitCode === 0
                    ? "Correct"
                    : "Error";
        const runtimeLocation =
            extractRuntimeLocation(
                standardError
            );

        this.writeTestResult({
            status: traceStatus ??
                status.toLocaleLowerCase("en-US"),
            stdout: result.standardOutput,
            stderr: standardError,
            exitCode,
            signal,
            outputTruncated:
                result.outputTruncated === true
        });

        try {
            await this.cleanup(cleanupPath);
        } catch (error) {
            reject(error);
            return;
        }

        if (exitCode !== 0) {
            if (status === "Cancelled") {
                // El proceso ya conserva su código y diagnóstico; la cancelación
                // solicitada se presenta como tal, sin un error inesperado adicional.
            } else if (
                exitCode ===
                this.handledRuntimeExitCode
            ) {
                this.writeError(
                    this.errorTerminalUI
                        .styleFirstLine(
                            standardError.trim(),
                            "red"
                        )
                );
            } else {
                this.printRuntimeError(
                    "El programa terminó inesperadamente."
                );
                this.logDeveloperFailure(
                    standardError
                );
            }

            this.printEnd(
                status,
                elapsedTime
            );

            reject(
                RuntimeExecutionError.exitFailure(
                    programPath,
                    exitCode,
                    signal,
                    {
                        location:
                            runtimeLocation
                    }
                )
            );
            return;
        }

        if (standardError.trim() !== "") {
            this.writeError(
                this.errorTerminalUI
                    .styleFirstLine(
                        standardError.trim(),
                        "red"
                    )
            );
        }

        this.printEnd(
            status,
            elapsedTime
        );

        resolve({
            ok: true,
            programPath,
            exitCode,
            signal,
            status
        });
    }

    async rejectAfterCleanup(
        runtimeError,
        cleanupPath,
        reject
    ) {
        try {
            await this.cleanup(cleanupPath);
            reject(runtimeError);
        } catch (cleanupError) {
            reject(cleanupError);
        }
    }

    presentStartFailure(
        programPath,
        cause
    ) {
        const error =
            RuntimeExecutionError
                .startFailure(
                    programPath,
                    cause
                );

        this.printRuntimeError(
            error.publicMessage
        );
        this.printEnd(
            "Error"
        );

        if (this.debug) {
            this.developerLogger.error?.(
                cause?.stack ??
                cause?.message ??
                String(cause)
            );
        }

        return error;
    }

    async cleanup(cleanupPath) {
        if (cleanupPath == null) {
            return;
        }

        await this.fileEmitter.remove(
            cleanupPath,
            { ignoreMissing: true }
        );
    }

    printStart(displayName) {
        this.logger.log(
            "\n" +
            this.terminalUI.header(
                displayName
            ) +
            "\n"
        );
    }

    printEnd(
        status,
        elapsedTime = null
    ) {
        const statusLabel =
            status === "Correct"
                ? "Correcto"
                : status === "Cancelled"
                    ? "Cancelado"
                    : "Error";

        const lines = [
            "",
            this.terminalUI.separator(),
            this.terminalUI.status(
                statusLabel
            )
        ];

        if (elapsedTime != null) {
            lines.push(
                this.terminalUI.time(
                    elapsedTime
                )
            );
        }

        lines.push("");
        this.logger.log(
            lines.join("\n")
        );
    }

    printRuntimeError(message) {
        this.writeError(
            this.errorTerminalUI.error(
                "Error de ejecución"
            ) +
            "\n\n" +
            `  ${message}`
        );
    }

    writeError(message) {
        if (message === "") {
            return;
        }

        const writer =
            typeof this.logger.error ===
            "function"
                ? this.logger.error
                : this.logger.log;

        writer.call(this.logger, message);
    }

    logDeveloperFailure(standardError) {
        if (
            !this.debug ||
            standardError.trim() === ""
        ) {
            return;
        }

        const writer =
            this.developerLogger.error ??
            this.developerLogger.log;

        writer?.call(
            this.developerLogger,
            "[developer][runtime]\n" +
            standardError.trim()
        );
    }

    readRuntimeTraceStatus() {
        const tracePath =
            this.environment
                .CLRS_TRACE_FILE;

        if (!tracePath) {
            return null;
        }

        try {
            const lines = String(
                this.readFileSync(
                    tracePath,
                    "utf8"
                )
            ).trim().split("\n");

            for (
                let index = lines.length - 1;
                index >= 0;
                index -= 1
            ) {
                const event =
                    JSON.parse(lines[index]);

                if (event.type === "end") {
                    return event.status ?? null;
                }
            }
        } catch {
            // La traza no forma parte del resultado funcional del runner.
        }

        return null;
    }

    shouldCaptureTestResult() {
        return this.environment
            .CLRS_TEST_DEBUG === "1" &&
            typeof this.environment
                .CLRS_TRACE_FILE === "string";
    }

    writeTestResult(result) {
        if (!this.shouldCaptureTestResult()) {
            return false;
        }

        try {
            this.appendFileSync(
                this.environment.CLRS_TRACE_FILE,
                JSON.stringify({
                    type: "test-result",
                    ...result
                }) + "\n",
                "utf8"
            );
            return true;
        } catch {
            return false;
        }
    }
}

function appendBounded(
    current,
    chunk,
    maximum,
    onLimit
) {
    const appended = current + chunk;

    if (appended.length <= maximum) {
        return appended;
    }

    onLimit();

    return appended.slice(0, maximum);
}

function extractRuntimeLocation(output) {
    const match =
        String(output).match(
            /^\s{2}Línea\s+(\d+)(?:,\s+columna\s+(\d+))?\s*$/mu
        );

    if (!match) {
        return null;
    }

    const startLine = Number(match[1]);
    const startColumn =
        match[2] == null
            ? 1
            : Number(match[2]);

    return {
        startLine,
        startColumn,
        endLine: startLine,
        endColumn: startColumn
    };
}

function elapsedMilliseconds(start, end) {
    if (
        typeof start === "bigint" &&
        typeof end === "bigint"
    ) {
        const nanoseconds =
            end > start
                ? end - start
                : 0n;

        return Number(
            (
                nanoseconds +
                500_000n
            ) /
            1_000_000n
        );
    }

    const milliseconds =
        Number(end) - Number(start);

    return Number.isFinite(milliseconds)
        ? Math.max(
            0,
            Math.round(milliseconds)
        )
        : 0;
}

function isCancellationSignal(signal) {
    return (
        signal === "SIGINT" ||
        signal === "SIGTERM"
    );
}
