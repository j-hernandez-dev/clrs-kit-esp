import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

export function registerDebugCommands(
    options = {}
) {
    const vscode = requireObject(
        options.vscodeApi,
        "vscodeApi"
    );
    const controller = requirePort(
        options.controller,
        "debugCommandController",
        ["startDebugging"]
    );
    const lifecycle = requirePort(
        options.lifecycle,
        "extensionLifecycle",
        ["add"]
    );

    lifecycle.add(
        vscode.commands.registerCommand(
            "CLRS.debugCode",
            () => controller.startDebugging()
        ),
        vscode.debug
            .registerDebugConfigurationProvider(
                options.debugType,
                options.configurationProvider
            ),
        vscode.debug
            .registerDebugAdapterDescriptorFactory(
                options.debugType,
                options.adapterFactory
            ),
        options.adapterFactory
    );

    return {
        controller,
        configurationProvider:
            options.configurationProvider,
        adapterFactory:
            options.adapterFactory
    };
}
