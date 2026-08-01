import {
    ApplicationError
} from "../../src/errors/ApplicationError.js";

export const DEFAULT_EXTENSION_CONFIGURATION =
    Object.freeze({
        languageId: "clrs-es",
        terminalName: "CLRS",
        outputChannelName: "CLRS",
        diagramViewType: "clrsDiagram",
        diagramTitlePrefix:
            "Diagrama de flujo",
        diagramInitialSourceDelay: 500,
        diagnosticsDebounceMs: 300,
        initialShowCost: true
    });

export function createExtensionConfiguration(
    overrides = {}
) {
    const config = {
        ...DEFAULT_EXTENSION_CONFIGURATION,
        ...overrides
    };

    for (
        const key
        of [
            "languageId",
            "terminalName",
            "outputChannelName",
            "diagramViewType",
            "diagramTitlePrefix"
        ]
    ) {
        if (
            typeof config[key] !== "string" ||
            config[key].length === 0
        ) {
                throw ApplicationError
                .configuration(
                    `config.${key}`,
                    "a non-empty string"
                );
        }
    }

    if (
        !Number.isFinite(
            config.diagramInitialSourceDelay
        ) ||
        config.diagramInitialSourceDelay < 0
    ) {
        throw ApplicationError.configuration(
            "config.diagramInitialSourceDelay",
            "a number greater than or equal to zero"
        );
    }

    if (
        !Number.isFinite(
            config.diagnosticsDebounceMs
        ) ||
        config.diagnosticsDebounceMs < 0
    ) {
        throw ApplicationError.configuration(
            "config.diagnosticsDebounceMs",
            "a number greater than or equal to zero"
        );
    }

    if (
        typeof config.initialShowCost !==
        "boolean"
    ) {
        throw ApplicationError.configuration(
            "config.initialShowCost",
            "a boolean"
        );
    }

    return Object.freeze(config);
}
