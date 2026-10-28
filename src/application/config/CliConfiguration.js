import {
    ApplicationError
} from "../../errors/ApplicationError.js";

export const DEFAULT_CLI_CONFIGURATION =
    Object.freeze({
        successExitCode: 0,
        failureExitCode: 1
    });

export function createCliConfiguration(
    overrides = {}
) {
    const config = {
        ...DEFAULT_CLI_CONFIGURATION,
        ...overrides
    };

    for (
        const key
        of [
            "successExitCode",
            "failureExitCode"
        ]
    ) {
        if (!Number.isInteger(config[key])) {
            throw ApplicationError.configuration(
                `config.${key}`,
                "an integer"
            );
        }
    }

    return Object.freeze(config);
}
