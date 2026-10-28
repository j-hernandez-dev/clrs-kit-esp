import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    formatDeveloperError
} from "../../src/errors/ErrorFormatter.js";

/**
 * Adapta el formateador neutral de CLRS a DocumentFormattingEditProvider.
 */
export class CLRSDocumentFormattingProvider {

    constructor(options = {}) {
        this.vscode = requireObject(
            options.vscodeApi,
            "vscodeApi"
        );
        this.documentAnalysisService =
            requirePort(
                options.documentAnalysisService,
                "documentAnalysisService",
                ["analyzeDocument"]
            );
        this.formatter = requirePort(
            options.formatter,
            "formatter",
            ["format"]
        );
        this.languageId = options.languageId;
        this.developerLogger =
            options.developerLogger ??
            console;
        this.disposed = false;
    }

    provideDocumentFormattingEdits(
        document,
        formattingOptions,
        cancellationToken
    ) {
        if (
            !this.isSupported(document) ||
            cancellationToken
                ?.isCancellationRequested
        ) {
            return [];
        }

        try {
            const snapshot =
                this.documentAnalysisService
                    .analyzeDocument(document);

            // Sin un AST completo no existe suficiente información para
            // reconstruir de forma segura los bloques por indentación.
            if (snapshot.ast == null) {
                return [];
            }

            const sourceCode = document.getText();
            const formatted =
                this.formatter.format(
                    sourceCode,
                    {
                        ast: snapshot.ast,
                        tabSize:
                            formattingOptions
                                ?.tabSize,
                        insertSpaces:
                            formattingOptions
                                ?.insertSpaces
                    }
                );

            if (formatted === sourceCode) {
                return [];
            }

            const range =
                new this.vscode.Range(
                    document.positionAt(0),
                    document.positionAt(
                        sourceCode.length
                    )
                );

            return [
                this.vscode.TextEdit.replace(
                    range,
                    formatted
                )
            ];
        } catch (error) {
            this.developerLogger.error(
                formatDeveloperError(error)
            );

            return [];
        }
    }

    isSupported(document) {
        return (
            !this.disposed &&
            document != null &&
            document.languageId ===
                this.languageId
        );
    }

    dispose() {
        this.disposed = true;
    }
}
