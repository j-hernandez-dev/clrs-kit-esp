import path from "node:path";

export class VSCodeDiagramHost {

    constructor(
        vscodeApi,
        loadWebviewHtml,
        options
    ) {
        this.vscode = vscodeApi;
        this.loadWebviewHtml =
            loadWebviewHtml;
        this.viewType =
            options.diagramViewType;
        this.titlePrefix =
            options.diagramTitlePrefix;
    }

    getActiveDocument() {
        const editor =
            this.vscode.window
                .activeTextEditor;

        if (!editor) {
            return null;
        }

        return {
            editor,
            fileName:
                path.basename(
                    editor.document
                        .uri.fsPath
                ),
            documentUri:
                editor.document
                    .uri.toString(),
            getSource: () =>
                this.getCurrentSource(
                    editor
                )
        };
    }

    createPanel(context, document) {
        const panel =
            this.vscode.window
                .createWebviewPanel(
                    this.viewType,
                    `${this.titlePrefix} - ${document.fileName}`,
                    this.vscode.ViewColumn.Beside,
                    {
                        enableScripts: true,
                        localResourceRoots: [
                            this.vscode.Uri
                                .joinPath(
                                    context
                                        .extensionUri,
                                    "flow",
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

        return {
            postMessage: message =>
                panel.webview
                    .postMessage(message),
            onMessage: listener =>
                panel.webview
                    .onDidReceiveMessage(
                        listener
                    ),
            onDispose: listener =>
                panel.onDidDispose(
                    listener
                ),
            dispose: () =>
                panel.dispose()
        };
    }

    onDocumentChange(
        document,
        listener
    ) {
        return this.vscode.workspace
            .onDidChangeTextDocument(
                event => {
                    if (
                        event.document
                            .uri.toString() ===
                        document.documentUri
                    ) {
                        listener();
                    }
                }
            );
    }

    onSelectionChange(
        document,
        listener
    ) {
        return this.vscode.window
            .onDidChangeTextEditorSelection(
                event => {
                    if (
                        event.textEditor ===
                        document.editor
                    ) {
                        listener();
                    }
                }
            );
    }

    schedule(callback, milliseconds) {
        const timeoutId =
            setTimeout(
                callback,
                milliseconds
            );

        return {
            dispose() {
                clearTimeout(timeoutId);
            }
        };
    }

    async saveSvg(svg) {
        const uri =
            await this.vscode.window
                .showSaveDialog({
                    saveLabel:
                        "Guardar diagrama",
                    filters: {
                        SVG: ["svg"]
                    }
                });

        if (!uri) {
            return false;
        }

        await this.vscode.workspace
            .fs.writeFile(
                uri,
                Buffer.from(
                    svg,
                    "utf8"
                )
            );

        return true;
    }

    getCurrentSource(editor) {
        const selection =
            editor.selection;

        return selection.isEmpty
            ? editor.document.getText()
            : editor.document
                .getText(selection);
    }
}
