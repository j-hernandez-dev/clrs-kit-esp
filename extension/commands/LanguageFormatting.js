import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

/**
 * Registra el formateador documental nativo de CLRS.
 */
export function registerLanguageFormatting(
    options = {}
) {
    const vscode = requireObject(
        options.vscodeApi,
        "vscodeApi"
    );
    const provider = requirePort(
        options.provider,
        "formattingProvider",
        ["provideDocumentFormattingEdits"]
    );
    const lifecycle = requirePort(
        options.lifecycle,
        "extensionLifecycle",
        ["add"]
    );
    const registration =
        vscode.languages
            .registerDocumentFormattingEditProvider(
                {
                    language:
                        options.languageId
                },
                provider
            );
    const commandRegistration =
        vscode.commands.registerCommand(
            "CLRS.formatDocument",
            () =>
                vscode.commands.executeCommand(
                    "editor.action.formatDocument"
                )
        );

    lifecycle.add(
        registration,
        commandRegistration
    );

    return registration;
}
