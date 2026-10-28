import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

/**
 * Registra las refactorizaciones semánticas disponibles para CLRS.
 */
export function registerLanguageRefactoring(
    options = {}
) {
    const vscode =
        requireObject(
            options.vscodeApi,
            "vscodeApi"
        );
    const provider =
        requirePort(
            options.provider,
            "renameProvider",
            [
                "prepareRename",
                "provideRenameEdits"
            ]
        );
    const lifecycle =
        requirePort(
            options.lifecycle,
            "extensionLifecycle",
            ["add"]
        );
    const registration =
        vscode.languages
            .registerRenameProvider(
                {
                    language:
                        options.languageId
                },
                provider
            );

    lifecycle.add(registration);

    return registration;
}
