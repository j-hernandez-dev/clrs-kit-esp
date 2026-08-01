import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

/**
 * Registra los comandos públicos conservando sus identificadores históricos.
 * La función no construye dependencias ni posee su ciclo de vida.
 */
export function registerCodeCommands(
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
            "codeCommandController",
            [
                "runProgram",
                "copyCostExpression",
                "toggleCost",
                "generateJavaScript"
            ]
        );
    const codeLensProvider =
        requirePort(
            options.codeLensProvider,
            "codeLensProvider",
            ["refresh", "provideCodeLenses"]
        );
    const costDecorator =
        requirePort(
            options.costDecorator,
            "costDecorator",
            ["update"]
        );
    const viewState =
        requireObject(
            options.viewState,
            "viewState"
        );
    const lifecycle =
        requirePort(
            options.lifecycle,
            "extensionLifecycle",
            ["add"]
        );
    const languageId =
        options.config.languageId;

    function updateDecorations() {
        const editor =
            vscode.window.activeTextEditor;

        if (
            !editor ||
            editor.document.languageId !==
                languageId
        ) {
            return;
        }

        costDecorator.update(editor);
    }

    lifecycle.add(
        vscode.commands.registerCommand(
            "CLRS.runCode",
            () =>
                controller.runProgram(
                    context.extensionPath
                )
        ),
        vscode.languages
            .registerCodeLensProvider(
                { language: languageId },
                codeLensProvider
            ),
        vscode.window
            .onDidChangeActiveTextEditor(
                updateDecorations
            ),
        vscode.workspace
            .onDidChangeTextDocument(
                updateDecorations
            ),
        vscode.window
            .onDidChangeVisibleTextEditors(
                editors => {
                    for (
                        const editor
                        of editors
                    ) {
                        if (
                            editor.document
                                .languageId ===
                            languageId
                        ) {
                            costDecorator
                                .update(editor);
                        }
                    }
                }
            ),
        vscode.commands.registerCommand(
            "CLRS.copyCostExpression",
            text =>
                controller
                    .copyCostExpression(
                        text
                    )
        ),
        vscode.commands.registerCommand(
            "CLRS.toggleCost",
            () =>
                controller.toggleCost(
                    viewState,
                    codeLensProvider,
                    updateDecorations
                )
        ),
        vscode.commands.registerCommand(
            "CLRS.generateCodeDiagram",
            async () => {}
        ),
        vscode.commands.registerCommand(
            "CLRS.generateCode",
            () =>
                controller
                    .generateJavaScript()
        )
    );

    updateDecorations();

    return {
        controller,
        updateDecorations
    };
}
