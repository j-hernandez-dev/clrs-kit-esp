import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

export function registerBrokerCommands(
    context,
    options = {}
) {
    const vscode = requireObject(
        options.vscodeApi,
        "vscodeApi"
    );
    const controller = requirePort(
        options.controller,
        "brokerCommandController",
        ["open"]
    );
    const lifecycle = requirePort(
        options.lifecycle,
        "extensionLifecycle",
        ["add"]
    );

    lifecycle.add(
        vscode.commands.registerCommand(
            "CLRS.playBroker95",
            () => controller.open(context)
        )
    );

    return Object.freeze({ controller });
}
