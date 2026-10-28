import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    formatDeveloperError
} from "../../src/errors/ErrorFormatter.js";
import {
    getSemanticNavigationIndex
} from "../../src/semantic/SemanticNavigationIndex.js";
import {
    SemanticSymbolKind
} from "../../src/semantic/SemanticSymbol.js";
import {
    createVSCodeRange
} from "./StaticDiagnosticsProvider.js";

/**
 * Adapta el índice semántico neutral a símbolos y navegación de VS Code.
 */
export class CLRSSymbolNavigationProvider {

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
        this.languageId =
            options.languageId;
        this.developerLogger =
            options.developerLogger ??
            console;
        this.disposed = false;
    }

    provideDocumentSymbols(document) {
        if (!this.isSupported(document)) {
            return [];
        }

        return this.tryProvide(
            [],
            index =>
                index.documentSymbols.map(
                    symbol =>
                        this.createDocumentSymbol(
                            document,
                            symbol
                        )
                ),
            document
        );
    }

    provideDefinition(
        document,
        position
    ) {
        if (!this.isSupported(document)) {
            return null;
        }

        return this.tryProvide(
            null,
            index => {
                const definition =
                    index.getDefinitionAt(
                        toLanguagePosition(
                            position
                        )
                    );

                return definition == null
                    ? null
                    : this.createLocation(
                        document,
                        definition.location
                    );
            },
            document
        );
    }

    provideReferences(
        document,
        position,
        context = {}
    ) {
        if (!this.isSupported(document)) {
            return [];
        }

        return this.tryProvide(
            [],
            index =>
                index.getReferencesAt(
                    toLanguagePosition(
                        position
                    ),
                    {
                        includeDefinition:
                            context
                                .includeDeclaration ===
                            true
                    }
                ).map(
                    occurrence =>
                        this.createLocation(
                            document,
                            occurrence.location
                        )
                ),
            document
        );
    }

    createDocumentSymbol(
        document,
        symbol
    ) {
        const item =
            new this.vscode.DocumentSymbol(
                symbol.name,
                symbol.detail,
                getVSCodeSymbolKind(
                    this.vscode,
                    symbol.kind
                ),
                createVSCodeRange(
                    this.vscode,
                    document,
                    symbol.location
                ),
                createVSCodeRange(
                    this.vscode,
                    document,
                    symbol.selectionLocation
                )
            );

        item.children =
            symbol.children.map(
                child =>
                    this.createDocumentSymbol(
                        document,
                        child
                    )
            );

        return item;
    }

    createLocation(document, location) {
        return new this.vscode.Location(
            document.uri,
            createVSCodeRange(
                this.vscode,
                document,
                location
            )
        );
    }

    tryProvide(
        fallback,
        provide,
        document
    ) {
        try {
            const snapshot =
                this
                    .documentAnalysisService
                    .analyzeDocument(
                        document
                    );

            if (
                !snapshot.ok ||
                snapshot.semanticModel ==
                    null
            ) {
                return fallback;
            }

            return provide(
                getSemanticNavigationIndex(
                    snapshot
                )
            );
        } catch (error) {
            this.developerLogger.error(
                formatDeveloperError(
                    error
                )
            );

            return fallback;
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

function toLanguagePosition(position) {
    return {
        line: (position?.line ?? -1) + 1,
        column:
            (position?.character ?? -1) +
            1
    };
}

function getVSCodeSymbolKind(
    vscode,
    kind
) {
    switch (kind) {
        case SemanticSymbolKind.FUNCTION:
            return vscode.SymbolKind.Function;
        case SemanticSymbolKind.PARAMETER:
            return vscode.SymbolKind
                .TypeParameter;
        default:
            return vscode.SymbolKind.Variable;
    }
}
