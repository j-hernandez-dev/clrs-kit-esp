/**
 * Conserva el último editor CLRS mientras una vista nativa de VS Code, como
 * un Walkthrough, ocupa el área del editor y activeTextEditor queda vacío.
 */
export class VSCodeClrsDocumentResolver {

    constructor(vscodeApi, languageId) {
        this.vscode = vscodeApi;
        this.languageId = languageId;
        this.lastEditor = null;
        this.resources = [];

        this.#remember(
            this.vscode.window.activeTextEditor
        );

        const editorSubscription =
            this.vscode.window
                .onDidChangeActiveTextEditor?.(
                    editor => this.#remember(
                        editor,
                        { clearForOtherLanguage: true }
                    )
                );
        const closeSubscription =
            this.vscode.workspace
                .onDidCloseTextDocument?.(
                    document => {
                        if (
                            this.lastEditor?.document ===
                                document
                        ) {
                            this.lastEditor = null;
                        }
                    }
                );

        for (const resource of [
            editorSubscription,
            closeSubscription
        ]) {
            if (resource?.dispose) {
                this.resources.push(resource);
            }
        }
    }

    getEditor() {
        const activeEditor = this.vscode.window
            .activeTextEditor;

        if (activeEditor != null) {
            if (!this.#isClrsEditor(activeEditor)) {
                return null;
            }

            this.lastEditor = activeEditor;
            return activeEditor;
        }

        if (!this.#isClrsEditor(this.lastEditor)) {
            this.lastEditor = null;
            return null;
        }

        return this.lastEditor;
    }

    getDocument() {
        return this.getEditor()?.document ?? null;
    }

    dispose() {
        for (const resource of this.resources) {
            resource.dispose();
        }

        this.resources = [];
        this.lastEditor = null;
    }

    #remember(editor, options = {}) {
        if (this.#isClrsEditor(editor)) {
            this.lastEditor = editor;
        } else if (
            editor != null &&
            options.clearForOtherLanguage === true
        ) {
            this.lastEditor = null;
        }
    }

    #isClrsEditor(editor) {
        return (
            editor?.document?.languageId ===
                this.languageId &&
            editor.document.isClosed !== true
        );
    }
}
