import {
    requireObject,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    formatDeveloperError
} from "../../src/errors/ErrorFormatter.js";
import {
    CLRS_SEMANTIC_TOKEN_MODIFIERS,
    CLRS_SEMANTIC_TOKEN_TYPES
} from "../../src/language/intelligence/SemanticTokenService.js";

/**
 * Convierte los tokens neutrales al formato delta de VS Code.
 */
export class CLRSSemanticTokensProvider {

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
        this.semanticTokenService =
            requirePort(
                options.semanticTokenService,
                "semanticTokenService",
                ["getDocumentTokens"]
            );
        this.languageId =
            options.languageId;
        this.developerLogger =
            options.developerLogger ??
            console;
        this.legend =
            new this.vscode
                .SemanticTokensLegend(
                    [
                        ...CLRS_SEMANTIC_TOKEN_TYPES
                    ],
                    [
                        ...CLRS_SEMANTIC_TOKEN_MODIFIERS
                    ]
                );
        this.typeIndexes = new Map(
            CLRS_SEMANTIC_TOKEN_TYPES
                .map(
                    (type, index) => [
                        type,
                        index
                    ]
                )
        );
        this.modifierIndexes = new Map(
            CLRS_SEMANTIC_TOKEN_MODIFIERS
                .map(
                    (modifier, index) => [
                        modifier,
                        index
                    ]
                )
        );
        this.disposed = false;
    }

    provideDocumentSemanticTokens(
        document
    ) {
        if (!this.isSupported(document)) {
            return this.createBuilder()
                .build();
        }

        try {
            const snapshot =
                this
                    .documentAnalysisService
                    .analyzeDocument(
                        document
                    );
            const tokens =
                this.semanticTokenService
                    .getDocumentTokens({
                        sourceCode:
                            document.getText(),
                        snapshot
                    });
            const builder =
                this.createBuilder();

            for (const token of tokens) {
                const type =
                    this.typeIndexes.get(
                        token.type
                    );

                if (type == null) {
                    continue;
                }

                builder.push(
                    token.location
                        .startLine - 1,
                    token.location
                        .startColumn - 1,
                    token.location
                        .endColumn -
                        token.location
                            .startColumn +
                        1,
                    type,
                    this.getModifierMask(
                        token.modifiers
                    )
                );
            }

            return builder.build();
        } catch (error) {
            this.developerLogger.error(
                formatDeveloperError(
                    error
                )
            );

            return this.createBuilder()
                .build();
        }
    }

    createBuilder() {
        return new this.vscode
            .SemanticTokensBuilder(
                this.legend
            );
    }

    getModifierMask(modifiers) {
        let mask = 0;

        for (const modifier of modifiers) {
            const index =
                this.modifierIndexes.get(
                    modifier
                );

            if (index != null) {
                mask |= 1 << index;
            }
        }

        return mask;
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
