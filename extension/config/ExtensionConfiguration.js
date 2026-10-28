import {
    ApplicationError
} from "../../src/errors/ApplicationError.js";

export const DEFAULT_EXTENSION_CONFIGURATION =
    Object.freeze({
        languageId: "clrs-es",
        cliEntryRelativePath:
            "extension-dist/clrs-cli.js",
        terminalName: "CLRS",
        outputChannelName: "CLRS",
        diagramViewType: "clrsDiagram",
        diagramTitlePrefix:
            "Diagrama de flujo",
        diagramInitialSourceDelay: 500,
        complexityReportViewType:
            "clrsComplexityReport",
        complexityReportTitlePrefix:
            "Informe de complejidad",
        complexityReportUpdateDelay: 180,
        brokerViewType: "clrsBroker95",
        brokerTitle: "BROKER.95",
        debugType: "clrs",
        debugName:
            "Depurar programa CLRS",
        diagnosticsDebounceMs: 300,
        maximumAnalysisSnapshots: 16,
        initialShowCost: false
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
            "cliEntryRelativePath",
            "terminalName",
            "outputChannelName",
            "diagramViewType",
            "diagramTitlePrefix",
            "complexityReportViewType",
            "complexityReportTitlePrefix",
            "brokerViewType",
            "brokerTitle",
            "debugType",
            "debugName"
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
        !Number.isInteger(
            config.maximumAnalysisSnapshots
        ) ||
        config.maximumAnalysisSnapshots <= 0
    ) {
        throw ApplicationError.configuration(
            "config.maximumAnalysisSnapshots",
            "a positive integer"
        );
    }

    if (
        !Number.isFinite(
            config.complexityReportUpdateDelay
        ) ||
        config.complexityReportUpdateDelay < 0
    ) {
        throw ApplicationError.configuration(
            "config.complexityReportUpdateDelay",
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
