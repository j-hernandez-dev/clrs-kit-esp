import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    resolveCLRSContextualStart
} from "../getting-started/CLRSContextualStart.js";

export const CLRS_CONTEXTUAL_START_COMMAND =
    "CLRS.openContextualStart";

const SEARCH_EXCLUDE =
    "**/{node_modules,.git,.clrs}/**";

export function registerContextualStartCommands(
    options = {}
) {
    const vscode = requireObject(
        options.vscodeApi,
        "vscodeApi"
    );
    const lifecycle = requirePort(
        options.lifecycle,
        "extensionLifecycle",
        ["add"]
    );
    const languageId =
        options.languageId ?? "clrs-es";
    const registration =
        vscode.commands.registerCommand(
            CLRS_CONTEXTUAL_START_COMMAND,
            () => openContextualStart({
                vscode,
                languageId
            })
        );

    lifecycle.add(registration);

    return Object.freeze({
        commandId:
            CLRS_CONTEXTUAL_START_COMMAND
    });
}

async function openContextualStart({
    vscode,
    languageId
}) {
    const [programUris, testSuiteUris] =
        await Promise.all([
            vscode.workspace.findFiles(
                "**/*.clrs",
                SEARCH_EXCLUDE,
                1
            ),
            vscode.workspace.findFiles(
                "**/*.clrs-tests.json",
                SEARCH_EXCLUDE,
                1
            )
        ]);
    const contextualStart =
        resolveCLRSContextualStart({
            activeDocument:
                vscode.window
                    .activeTextEditor
                    ?.document ?? null,
            programUris,
            testSuiteUris,
            languageId
        });
    const selected =
        await vscode.window.showQuickPick(
            contextualStart.actions,
            {
                title: contextualStart.title,
                placeHolder:
                    contextualStart.placeHolder,
                matchOnDescription: true
            }
        );

    if (selected == null) {
        return Object.freeze({
            status: "cancelled",
            state: contextualStart.state
        });
    }

    if (selected.kind === "document") {
        const document =
            await vscode.workspace
                .openTextDocument(
                    selected.documentUri
                );

        await vscode.window.showTextDocument(
            document,
            {
                preview: false,
                preserveFocus: false
            }
        );
    } else {
        await vscode.commands.executeCommand(
            selected.commandId
        );
    }

    return Object.freeze({
        status: "selected",
        state: contextualStart.state,
        action: selected.kind === "document"
            ? selected.documentUri.toString()
            : selected.commandId
    });
}
