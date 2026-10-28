import {
    formatDeveloperError,
    formatTerminalError,
    shouldLogDeveloperError
} from "../../errors/ErrorFormatter.js";
import {
    TerminalUI
} from "./TerminalUI.js";

export class ConsolePresenter {

    constructor(options = {}) {
        this.logger =
            options.logger ?? console;
        this.successExitCode =
            options.successExitCode ?? 0;
        this.failureExitCode =
            options.failureExitCode ?? 1;
        this.developerLogger =
            options.developerLogger ??
            this.logger;
        this.debug =
            options.debug ??
            process.env.CLRS_DEBUG === "1";
        this.standardOutputUI =
            options.terminalUI ??
            new TerminalUI({
                stream:
                    options.standardOutput ??
                    process.stdout,
                environment:
                    options.environment ??
                    process.env
            });
        this.standardErrorUI =
            options.errorTerminalUI ??
            options.terminalUI ??
            new TerminalUI({
                stream:
                    options.standardError ??
                    process.stderr,
                environment:
                    options.environment ??
                    process.env
            });
    }

    present(result, options = {}) {
        if (result.ok) {
            if (options.successMessage) {
                this.logger.log(
                    this.standardOutputUI
                        .success(
                            options.successMessage
                        )
                );
            }

            return this.successExitCode;
        }

        for (const error of result.errors) {
            if (!error.presented) {
                this.logger.error(
                    formatTerminalError(
                        error,
                        {
                            displayName:
                                options.displayName ??
                                null,
                            fallbackTitle:
                                options.fallbackTitle ??
                                null,
                            terminalUI:
                                this.standardErrorUI
                        }
                    )
                );
            }

            if (
                this.debug &&
                shouldLogDeveloperError(error)
            ) {
                const writer =
                    this.developerLogger.error ??
                    this.developerLogger.log;

                writer?.call(
                    this.developerLogger,
                    formatDeveloperError(
                        error
                    )
                );
            }
        }

        return this.failureExitCode;
    }
}
