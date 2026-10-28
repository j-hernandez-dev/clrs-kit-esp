import path from "node:path";

export class VSCodeComplexityReportHost {

    constructor(
        vscodeApi,
        loadWebviewHtml,
        options
    ) {
        this.vscode = vscodeApi;
        this.loadWebviewHtml =
            loadWebviewHtml;
        this.viewType =
            options.complexityReportViewType;
        this.titlePrefix =
            options.complexityReportTitlePrefix;
    }

    getActiveDocument() {
        const editor =
            this.vscode.window
                .activeTextEditor;

        if (!editor) {
            return null;
        }

        return new ComplexityReportDocumentSession(
            this.vscode,
            editor
        );
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
                        retainContextWhenHidden:
                            true,
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
                panel.onDidDispose(listener),
            reveal: () =>
                panel.reveal(
                    panel.viewColumn,
                    true
                ),
            dispose: () => panel.dispose()
        };
    }

    onDocumentChange(document, listener) {
        return this.vscode.workspace
            .onDidChangeTextDocument(
                event => {
                    if (
                        event.document.uri
                            .toString() !==
                        document.documentUri
                    ) {
                        return;
                    }

                    document.updateDocument(
                        event.document
                    );
                    listener(event.document);
                }
            );
    }

    schedule(callback, milliseconds) {
        const timeoutId = setTimeout(
            callback,
            milliseconds
        );

        return {
            dispose() {
                clearTimeout(timeoutId);
            }
        };
    }

    revealLocation(document, location) {
        return document.revealLocation(
            location
        );
    }
}

export class ComplexityReportDocumentSession {

    constructor(vscodeApi, editor) {
        this.vscode = vscodeApi;
        this.editor = editor;
        this.document = editor.document;
        this.documentUri =
            this.document.uri.toString();
        this.fileName = path.basename(
            this.document.uri.fsPath ??
            this.document.fileName
        );
    }

    get version() {
        return this.document.version ?? null;
    }

    getAnalysisDocument() {
        return this.document;
    }

    updateDocument(document) {
        if (
            document?.uri?.toString() !==
            this.documentUri
        ) {
            return false;
        }

        this.document = document;
        return true;
    }

    adopt(other) {
        if (
            other?.documentUri !==
                this.documentUri
        ) {
            return false;
        }

        this.editor = other.editor;
        this.document = other.document;
        return true;
    }

    metadata() {
        return {
            uri: this.documentUri,
            fileName: this.fileName,
            version: this.version
        };
    }

    async revealLocation(location) {
        const normalized =
            normalizeLocation(location);

        if (!normalized) {
            return false;
        }

        const rawRange =
            new this.vscode.Range(
                normalized.startLine - 1,
                normalized.startColumn - 1,
                normalized.endLine - 1,
                normalized.endColumn - 1
            );
        const range =
            this.document
                .validateRange(rawRange);
        const editor =
            await this.vscode.window
                .showTextDocument(
                    this.document,
                    {
                        viewColumn:
                            this.editor
                                .viewColumn,
                        preserveFocus: false,
                        preview: false
                    }
                );

        this.editor = editor;
        editor.selection =
            new this.vscode.Selection(
                range.start,
                range.start
            );
        editor.revealRange(
            range,
            this.vscode
                .TextEditorRevealType
                .InCenterIfOutsideViewport
        );

        return true;
    }
}

function normalizeLocation(location) {
    const startLine =
        positiveInteger(location?.startLine);
    const startColumn =
        positiveInteger(
            location?.startColumn
        );

    if (
        startLine == null ||
        startColumn == null
    ) {
        return null;
    }

    return {
        startLine,
        startColumn,
        endLine:
            positiveInteger(
                location?.endLine
            ) ?? startLine,
        endColumn:
            positiveInteger(
                location?.endColumn
            ) ?? startColumn
    };
}

function positiveInteger(value) {
    return Number.isInteger(value) && value > 0
        ? value
        : null;
}
