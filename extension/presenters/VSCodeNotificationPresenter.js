import {
    formatDeveloperError,
    formatLanguageError,
    shouldLogDeveloperError
} from "../../src/errors/ErrorFormatter.js";

export class VSCodeNotificationPresenter {

    constructor(vscodeWindow, options = {}) {
        this.window = vscodeWindow;
        this.developerLogger =
            options.developerLogger ??
            console;
    }

    info(message, timeout = undefined) {
        return this.window
            .showInformationMessage(
                message,
                ...(timeout === undefined
                    ? []
                    : [timeout])
            );
    }

    error(error, fallbackTitle = null) {
        const message =
            typeof error === "string"
                ? error
                : formatLanguageError(
                    error,
                    fallbackTitle
                );

        return this.window
            .showErrorMessage(message);
    }

    present(result, options = {}) {
        if (result.ok) {
            if (options.successMessage) {
                this.info(
                    options.successMessage,
                    options.timeout
                );
            }

            return result;
        }

        for (const error of result.errors) {
            this.error(
                error,
                options.fallbackTitle ??
                null
            );

            if (
                shouldLogDeveloperError(error)
            ) {
                const writer =
                    this.developerLogger.error ??
                    this.developerLogger.log;

                writer?.call(
                    this.developerLogger,
                    formatDeveloperError(error)
                );
            }
        }

        return result;
    }
}
