import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    formatDeveloperError
} from "../../src/errors/ErrorFormatter.js";
import {
    LanguageError
} from "../../src/errors/LanguageError.js";
import {
    createVSCodeRange
} from "./StaticDiagnosticsProvider.js";

/**
 * Adapta los planes neutrales de renombrado a WorkspaceEdit.
 */
export class CLRSRenameProvider {

    constructor(options = {}) {
        this.vscode =
            requireObject(
                options.vscodeApi,
                "vscodeApi"
            );
        this.documentAnalysisService =
            requirePort(
                options
                    .documentAnalysisService,
                "documentAnalysisService",
                ["analyzeDocument"]
            );
        this.renameService =
            requirePort(
                options.renameService,
                "renameService",
                [
                    "prepareRename",
                    "planRename"
                ]
            );
        this.languageId =
            options.languageId;
        this.developerLogger =
            options.developerLogger ??
            console;
        this.disposed = false;
    }

    prepareRename(document, position) {
        if (!this.isSupported(document)) {
            return null;
        }

        try {
            const prepared =
                this.renameService
                    .prepareRename(
                        this.createRequest(
                            document,
                            position
                        )
                    );

            return {
                range:
                    createVSCodeRange(
                        this.vscode,
                        document,
                        prepared.location
                    ),
                placeholder:
                    prepared.name
            };
        } catch (error) {
            return this.handleError(error);
        }
    }

    provideRenameEdits(
        document,
        position,
        newName
    ) {
        if (!this.isSupported(document)) {
            return null;
        }

        try {
            const plan =
                this.renameService
                    .planRename({
                        ...this.createRequest(
                            document,
                            position
                        ),
                        newName
                    });
            const workspaceEdit =
                new this.vscode
                    .WorkspaceEdit();

            for (const edit of plan.edits) {
                workspaceEdit.replace(
                    document.uri,
                    createVSCodeRange(
                        this.vscode,
                        document,
                        edit.location
                    ),
                    edit.newText
                );
            }

            return workspaceEdit;
        } catch (error) {
            return this.handleError(error);
        }
    }

    createRequest(document, position) {
        return {
            snapshot:
                this
                    .documentAnalysisService
                    .analyzeDocument(
                        document
                    ),
            position:
                toLanguagePosition(
                    position
                )
        };
    }

    handleError(error) {
        if (
            error instanceof LanguageError &&
            error.audience !== "developer"
        ) {
            throw new Error(
                error.publicMessage
            );
        }

        this.developerLogger.error(
            formatDeveloperError(error)
        );

        throw new Error(
            "No fue posible completar el renombrado debido a un error interno."
        );
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

function toLanguagePosition(position) {
    return {
        line: (position?.line ?? -1) + 1,
        column:
            (position?.character ?? -1) +
            1
    };
}
