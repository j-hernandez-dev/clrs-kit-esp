import { spawn } from "node:child_process";

import {
    RuntimeExecutionError
} from "../../errors/RuntimeExecutionError.js";
import {
    FileSystemEmitter
} from "./FileSystemEmitter.js";

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

        return new Promise((resolve, reject) => {
            let childProcess;
            let standardError = "";

            try {
                childProcess = this.spawn(
                    this.command,
                    [programPath],
                    { stdio: this.stdio }
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

            childProcess.stderr?.on?.(
                "data",
                chunk => {
                    standardError +=
                        String(chunk);
                }
            );

            let settled = false;

            childProcess.once("error", error => {
                if (settled) {
                    return;
                }

                settled = true;

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

                    void this.finishRun(
                        {
                            programPath,
                            cleanupPath,
                            exitCode,
                            signal,
                            standardError
                        },
                        resolve,
                        reject
                    );
                }
            );
        });
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
            standardError
        } = result;
        const status =
            exitCode === 0
                ? "Correct"
                : "Error";

        try {
            await this.cleanup(cleanupPath);
        } catch (error) {
            reject(error);
            return;
        }

        if (exitCode !== 0) {
            if (
                exitCode ===
                this.handledRuntimeExitCode
            ) {
                this.writeError(
                    standardError.trim()
                );
            } else {
                this.printRuntimeError(
                    "El programa terminó inesperadamente."
                );
                this.logDeveloperFailure(
                    standardError
                );
            }

            this.printEnd(status);

            reject(
                RuntimeExecutionError.exitFailure(
                    programPath,
                    exitCode,
                    signal
                )
            );
            return;
        }

        if (standardError.trim() !== "") {
            this.writeError(
                standardError.trim()
            );
        }

        this.printEnd(status);

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
        this.printEnd("Error");

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
            "\nCLRS Runtime\n" +
            "────────────────────────\n" +
            `▶ ${displayName}\n`
        );
    }

    printEnd(status) {
        const statusLabel =
            status === "Correct"
                ? "Correcto"
                : "Error";

        this.logger.log(
            "\n────────────────────────\n" +
            `Estado: ${statusLabel}\n`
        );
    }

    printRuntimeError(message) {
        this.writeError(
            "✕ Error de ejecución\n\n" +
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
}
