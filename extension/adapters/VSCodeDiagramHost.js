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
        this.documentResolver =
            options.documentResolver ??
            null;
    }

    getActiveDocument(options = {}) {
        const editor =
            this.documentResolver
                ?.getEditor?.() ??
            this.vscode.window
                .activeTextEditor;

        if (!editor) {
            return null;
        }

        return new DiagramDocumentSession(
            this.vscode,
            editor,
            {
                ...options,
                documentResolver:
                    this.documentResolver
            }
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
                        enableCommandUris: false,
                        retainContextWhenHidden:
                            true,
                        portMapping: [],
                        localResourceRoots: [
                            this.vscode.Uri
                                .joinPath(
                                    context
                                        .extensionUri,
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
                panel.onDidDispose(
                    listener
                ),
            reveal: () =>
                panel.reveal(
                    panel.viewColumn,
                    true
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
                        document.updateDocument(
                            event.document,
                            event.contentChanges
                        );
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
                        event.textEditor.document
                            .uri.toString() ===
                        document.documentUri
                    ) {
                        document.updateEditor(
                            event.textEditor
                        );
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

    async saveDocument(document) {
        return document.save();
    }

    async revealLocation(
        document,
        location
    ) {
        return document.revealLocation(
            location
        );
    }

    async applySourceEdits(
        document,
        plan
    ) {
        return document.applyEdits(plan);
    }

}

export class DiagramDocumentSession {

    constructor(
        vscodeApi,
        editor,
        options = {}
    ) {
        this.vscode = vscodeApi;
        this.documentResolver =
            options.documentResolver ??
            null;
        this.editor = editor;
        this.document = editor.document;
        this.fileName = path.basename(
            this.document.uri.fsPath
        );
        this.filePath =
            this.document.uri.fsPath ??
            this.document.fileName;
        this.documentUri =
            this.document.uri.toString();

        const selection = editor.selection;

        this.sourceScope =
            options.wholeDocument === true ||
            selection.isEmpty
            ? null
            : {
                startOffset:
                    editor.document.offsetAt(
                        selection.start
                    ),
                endOffset:
                    editor.document.offsetAt(
                        selection.end
                    )
            };
        this.lastSelection =
            createSelectionLocation(
                editor.selection
            );
    }

    get version() {
        return this.document.version ?? null;
    }

    isWholeDocument() {
        return this.sourceScope == null;
    }

    getSource() {
        if (!this.sourceScope) {
            return this.document
                .getText();
        }

        return this.document.getText(
            this.getSourceRange()
        );
    }

    getSourceOrigin() {
        if (!this.sourceScope) {
            return {
                startLine: 1,
                startColumn: 1
            };
        }

        const position =
            this.document.positionAt(
                this.sourceScope.startOffset
            );

        return {
            startLine: position.line + 1,
            startColumn:
                position.character + 1
        };
    }

    getSelection() {
        const editor = this.resolveEditor();

        if (editor) {
            this.lastSelection =
                createSelectionLocation(
                    editor.selection
                );
        }

        return this.lastSelection;
    }

    matchesExecutionTrace(trace) {
        if (!trace?.sourcePath) {
            return false;
        }

        return (
            normalizePath(trace.sourcePath) ===
                normalizePath(this.filePath) &&
            (
                trace.documentVersion == null ||
                trace.documentVersion ===
                    this.version
            )
        );
    }

    matchesTestCoverage(snapshot) {
        if (!snapshot?.sourcePath) {
            return false;
        }

        return (
            normalizePath(snapshot.sourcePath) ===
                normalizePath(this.filePath) &&
            (
                snapshot.documentVersion == null ||
                snapshot.documentVersion ===
                    this.version
            )
        );
    }

    matchesSession(other) {
        return (
            other?.documentUri ===
                this.documentUri &&
            sourceScopesEqual(
                this.sourceScope,
                other.sourceScope
            )
        );
    }

    adopt(other) {
        if (!this.matchesSession(other)) {
            return false;
        }

        this.document = other.document;
        this.updateEditor(other.editor);
        return true;
    }

    updateDocument(
        document,
        contentChanges = []
    ) {
        if (
            document?.uri?.toString() !==
            this.documentUri
        ) {
            return false;
        }

        this.document = document;

        if (!this.sourceScope) {
            return true;
        }

        this.sourceScope = {
            startOffset:
                transformOffset(
                    this.sourceScope
                        .startOffset,
                    contentChanges,
                    "start"
                ),
            endOffset:
                transformOffset(
                    this.sourceScope.endOffset,
                    contentChanges,
                    "end"
                )
        };

        return true;
    }

    updateEditor(editor) {
        if (
            editor?.document?.uri
                ?.toString() !==
            this.documentUri
        ) {
            return false;
        }

        this.editor = editor;
        this.document = editor.document;
        this.lastSelection =
            createSelectionLocation(
                editor.selection
            );
        return true;
    }

    async revealLocation(location) {
        const normalized =
            normalizeLocation(location);

        if (!normalized) {
            return false;
        }

        const rawRange = new this.vscode.Range(
            normalized.startLine - 1,
            normalized.startColumn - 1,
            normalized.endLine - 1,
            normalized.endColumn - 1
        );
        const range =
            this.document
                .validateRange(rawRange);
        const linkedEditor =
            this.resolveEditor();
        const showOptions = {
            preserveFocus: false,
            preview: false
        };

        if (linkedEditor?.viewColumn != null) {
            showOptions.viewColumn =
                linkedEditor.viewColumn;
        }

        const editor =
            await this.vscode.window
                .showTextDocument(
                    this.document,
                    showOptions
                );

        this.updateEditor(editor);
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

    async applyEdits(plan) {
        if (
            plan?.expectedDocumentVersion !==
                this.version ||
            !Array.isArray(plan?.edits) ||
            plan.edits.length === 0
        ) {
            return false;
        }

        const source = this.getSource();
        const sourceBaseOffset =
            this.sourceScope?.startOffset ?? 0;
        const workspaceEdit =
            new this.vscode.WorkspaceEdit();

        for (const edit of plan.edits) {
            if (
                !validSourceEdit(edit) ||
                edit.endOffset > source.length ||
                source.slice(
                    edit.startOffset,
                    edit.endOffset
                ) !== edit.expectedText
            ) {
                return false;
            }

            const start =
                this.document.positionAt(
                    sourceBaseOffset +
                    edit.startOffset
                );
            const end =
                this.document.positionAt(
                    sourceBaseOffset +
                    edit.endOffset
                );

            workspaceEdit.replace(
                this.document.uri,
                new this.vscode.Range(
                    start,
                    end
                ),
                edit.newText
            );
        }

        return this.vscode.workspace
            .applyEdit(workspaceEdit);
    }

    async save() {
        const initialDocument =
            this.document;

        if (initialDocument.isUntitled) {
            await this.vscode.window
                .showTextDocument(
                    initialDocument,
                    {
                        preview: false,
                        preserveFocus: false
                    }
                );
        }

        const saved =
            await initialDocument.save();

        if (!saved) {
            return false;
        }

        const currentEditor =
            this.documentResolver
                ?.getEditor?.() ??
            this.vscode.window
                .activeTextEditor;

        if (
            currentEditor?.document
                ?.languageId ===
                initialDocument.languageId
        ) {
            this.editor = currentEditor;
            this.document =
                currentEditor.document;
            this.fileName = path.basename(
                this.document.uri.fsPath
            );
            this.filePath =
                this.document.uri.fsPath ??
                this.document.fileName;
            this.documentUri =
                this.document.uri.toString();
        }

        return true;
    }

    resolveEditor() {
        const visibleEditors =
            this.vscode.window
                .visibleTextEditors ?? [];
        const editor =
            visibleEditors.find(
                candidate =>
                    candidate === this.editor
            ) ??
            visibleEditors.find(
                candidate =>
                    candidate.document.uri
                        .toString() ===
                    this.documentUri
            ) ??
            (
                this.editor?.document?.uri
                    ?.toString() ===
                    this.documentUri
                    ? this.editor
                    : null
            );

        if (editor) {
            this.editor = editor;
            this.document = editor.document;
        }

        return editor;
    }

    getSourceRange() {
        const document = this.document;
        const textLength =
            document.getText().length;
        const startOffset = Math.min(
            this.sourceScope.startOffset,
            textLength
        );
        const endOffset = Math.max(
            startOffset,
            Math.min(
                this.sourceScope.endOffset,
                textLength
            )
        );

        return new this.vscode.Range(
            document.positionAt(startOffset),
            document.positionAt(endOffset)
        );
    }
}

function createSelectionLocation(selection) {
    const active = selection?.active;

    if (!active) {
        return null;
    }

    return {
        startLine: active.line + 1,
        startColumn: active.character + 1,
        endLine: active.line + 1,
        endColumn: active.character + 1
    };
}

function sourceScopesEqual(left, right) {
    if (left == null || right == null) {
        return left == null && right == null;
    }

    return (
        left.startOffset ===
            right.startOffset &&
        left.endOffset === right.endOffset
    );
}

function transformOffset(
    offset,
    contentChanges,
    affinity
) {
    let delta = 0;

    for (
        const change
        of [...contentChanges].sort(
            (left, right) =>
                left.rangeOffset -
                right.rangeOffset
        )
    ) {
        const start = change.rangeOffset;
        const end =
            start + change.rangeLength;
        const insertedLength =
            String(change.text ?? "").length;

        if (offset < start) {
            continue;
        }

        if (
            offset > end ||
            (
                offset === end &&
                change.rangeLength > 0
            )
        ) {
            delta +=
                insertedLength -
                change.rangeLength;
            continue;
        }

        return (
            start +
            delta +
            (affinity === "end"
                ? insertedLength
                : 0)
        );
    }

    return Math.max(0, offset + delta);
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

function normalizePath(value) {
    const normalized = path.resolve(
        String(value)
    );

    return process.platform === "win32"
        ? normalized.toLocaleLowerCase("en")
        : normalized;
}

function validSourceEdit(edit) {
    return (
        Number.isInteger(edit?.startOffset) &&
        edit.startOffset >= 0 &&
        Number.isInteger(edit?.endOffset) &&
        edit.endOffset >= edit.startOffset &&
        typeof edit.newText === "string" &&
        typeof edit.expectedText === "string"
    );
}
