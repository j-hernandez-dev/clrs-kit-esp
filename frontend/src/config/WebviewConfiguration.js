import {
    ApplicationError
} from "../../../src/errors/ApplicationError.js";

export const DEFAULT_WEBVIEW_CONFIGURATION =
    Object.freeze({
        initialSourceCode: ""
    });

export function createWebviewConfiguration(
    overrides = {}
) {
    const config = {
        ...DEFAULT_WEBVIEW_CONFIGURATION,
        ...overrides
    };

    if (
        typeof config.initialSourceCode !==
        "string"
    ) {
        throw ApplicationError.configuration(
            "config.initialSourceCode",
            "a string"
        );
    }

    return Object.freeze(config);
}
