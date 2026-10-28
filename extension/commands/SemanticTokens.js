import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

/**
 * Registra el proveedor completo de tokens semánticos del documento.
 */
export function registerSemanticTokens(
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
            "semanticTokensProvider",
            [
                "provideDocumentSemanticTokens"
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
            .registerDocumentSemanticTokensProvider(
                {
                    language:
                        options.languageId
                },
                provider,
                provider.legend
            );

    lifecycle.add(registration);

    return registration;
}
