import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

/**
 * Registra las capacidades de asistencia interactiva del lenguaje.
 */
export function registerLanguageIntelligence(
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
            "languageIntelligenceProvider",
            [
                "provideCompletionItems",
                "provideHover",
                "provideSignatureHelp",
                "provideInlayHints"
            ]
        );
    const lifecycle =
        requirePort(
            options.lifecycle,
            "extensionLifecycle",
            ["add"]
        );
    const selector = {
        language: options.languageId
    };
    const registrations =
        Object.freeze({
            completion:
                vscode.languages
                    .registerCompletionItemProvider(
                        selector,
                        provider
                    ),
            hover:
                vscode.languages
                    .registerHoverProvider(
                        selector,
                        provider
                    ),
            signatureHelp:
                vscode.languages
                    .registerSignatureHelpProvider(
                        selector,
                        provider,
                        "(",
                        ","
                    ),
            inlayHints:
                vscode.languages
                    .registerInlayHintsProvider(
                        selector,
                        provider
                    )
        });

    lifecycle.add(
        registrations.completion,
        registrations.hover,
        registrations.signatureHelp,
        registrations.inlayHints
    );

    return registrations;
}
