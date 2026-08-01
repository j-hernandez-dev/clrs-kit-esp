import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

export function registerDiagramCommands(
    context,
    options = {}
) {
    const vscode =
        requireObject(
            options.vscodeApi,
            "vscodeApi"
        );
    const controller =
        requirePort(
            options.controller,
            "diagramCommandController",
            ["toggleDiagram", "exportSvg"]
        );
    const lifecycle =
        requirePort(
            options.lifecycle,
            "extensionLifecycle",
            ["add"]
        );

    lifecycle.add(
        vscode.commands.registerCommand(
            "CLRS.toggleDiagram",
            () =>
                controller
                    .toggleDiagram(context)
        ),
        vscode.commands.registerCommand(
            "CLRS.exportSVG",
            () =>
                controller.exportSvg()
        )
    );

    return {
        controller
    };
}
