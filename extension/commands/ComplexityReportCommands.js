import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

export function registerComplexityReportCommands(
    context,
    options = {}
) {
    const vscode = requireObject(
        options.vscodeApi,
        "vscodeApi"
    );
    const controller = requirePort(
        options.controller,
        "complexityReportController",
        ["openReport"]
    );
    const lifecycle = requirePort(
        options.lifecycle,
        "extensionLifecycle",
        ["add"]
    );

    lifecycle.add(
        vscode.commands.registerCommand(
            "CLRS.showComplexityReport",
            selection =>
                controller.openReport(
                    context,
                    selection
                )
        )
    );

    return { controller };
}
