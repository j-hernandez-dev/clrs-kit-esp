import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    CLRS_EXPLAIN_CORRECTION_COMMAND
} from "../providers/CodeActionProvider.js";

/**
 * Registra las correcciones de CLRS en la bombilla nativa de VS Code.
 */
export function registerLanguageCorrections(
    options = {}
) {
    const vscode = requireObject(
        options.vscodeApi,
        "vscodeApi"
    );
    const provider = requirePort(
        options.provider,
        "codeActionProvider",
        [
            "provideCodeActions",
            "presentExplanation"
        ]
    );
    const lifecycle = requirePort(
        options.lifecycle,
        "extensionLifecycle",
        ["add"]
    );
    const registration =
        vscode.languages
            .registerCodeActionsProvider(
                {
                    language:
                        options.languageId
                },
                provider,
                {
                    providedCodeActionKinds: [
                        vscode.CodeActionKind
                            .QuickFix
                    ]
                }
            );
    const commandRegistration =
        vscode.commands.registerCommand(
            CLRS_EXPLAIN_CORRECTION_COMMAND,
            explanation =>
                provider
                    .presentExplanation(
                        explanation
                    )
        );

    lifecycle.add(
        registration,
        commandRegistration
    );

    return registration;
}
