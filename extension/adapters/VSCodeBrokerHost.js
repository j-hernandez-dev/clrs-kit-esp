import path from "node:path";

export class VSCodeBrokerHost {

    constructor(
        vscodeApi,
        loadWebviewHtml,
        options
    ) {
        this.vscode = vscodeApi;
        this.loadWebviewHtml =
            loadWebviewHtml;
        this.viewType =
            options.brokerViewType;
        this.title =
            options.brokerTitle;
        this.languageId =
            options.languageId;
    }

    createPanel(context) {
        const documentName =
            this.#getActiveDocumentName();
        const panelTitle = documentName
            ? `${this.title} - ${documentName}`
            : this.title;
        const panel =
            this.vscode.window
                .createWebviewPanel(
                    this.viewType,
                    panelTitle,
                    this.vscode.ViewColumn.Beside,
                    {
                        enableScripts: true,
                        enableCommandUris: false,
                        retainContextWhenHidden:
                            true,
                        portMapping: [],
                        localResourceRoots: [
                            this.vscode.Uri.joinPath(
                                    context.extensionUri,
                                    "frontend",
                                    "dist"
                            )
                        ]
                    }
                );

        panel.webview.html =
            this.loadWebviewHtml(
                panel.webview,
                context.extensionUri
            );

        return Object.freeze({
            postMessage: message =>
                panel.webview
                    .postMessage(message),
            onMessage: listener =>
                panel.webview
                    .onDidReceiveMessage(
                        listener
                    ),
            onDispose: listener =>
                panel.onDidDispose(listener),
            reveal: () =>
                panel.reveal(
                    panel.viewColumn,
                    true
                ),
            dispose: () => panel.dispose()
        });
    }

    #getActiveDocumentName() {
        const document =
            this.vscode.window
                .activeTextEditor
                ?.document;

        if (
            !document ||
            document.languageId !==
                this.languageId
        ) {
            return null;
        }

        const filePath =
            document.uri?.fsPath ??
            document.fileName ??
            document.uri?.path ??
            "";

        return path.basename(filePath) ||
            null;
    }

}
