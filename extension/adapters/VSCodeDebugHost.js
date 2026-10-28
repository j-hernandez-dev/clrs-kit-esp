export class VSCodeDebugHost {

    constructor(
        vscodeApi,
        languageId,
        documentResolver = null
    ) {
        this.vscode = vscodeApi;
        this.languageId = languageId;
        this.documentResolver =
            documentResolver;
    }

    getActiveDocument() {
        const initialDocument =
            this.documentResolver
                ?.getDocument?.() ??
            this.vscode.window
                .activeTextEditor?.document;

        if (
            !initialDocument ||
            initialDocument.languageId !==
                this.languageId
        ) {
            return null;
        }

        const resolveDocument = () =>
            this.documentResolver
                ?.getDocument?.() ??
            initialDocument;

        return {
            get filePath() {
                const document =
                    resolveDocument();

                return document.uri.fsPath ??
                    document.fileName;
            },
            get version() {
                return resolveDocument()
                    .version;
            },
            get uri() {
                return resolveDocument().uri;
            },
            save: async () => {
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

                return initialDocument.save();
            }
        };
    }

    getWorkspaceFolder(document) {
        return this.vscode.workspace
            .getWorkspaceFolder(
                document.uri
            );
    }

    startDebugging(folder, configuration) {
        return this.vscode.debug
            .startDebugging(
                folder,
                configuration
            );
    }
}
