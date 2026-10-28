import test from "node:test";
import assert from "node:assert/strict";

import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    SemanticTokenService
} from "../src/language/intelligence/SemanticTokenService.js";
import {
    CLRSSemanticTokensProvider
} from "../extension/providers/SemanticTokensProvider.js";

test("codifica tipos y modificadores según la leyenda de VS Code", () => {
    const vscode = createFakeVSCode();
    const provider =
        new CLRSSemanticTokensProvider({
            vscodeApi: vscode,
            documentAnalysisService:
                new DocumentAnalysisService({
                    languageDiagnosticsService:
                        new LanguageDiagnosticsService(),
                    analyzeCost() {
                        return null;
                    }
                }),
            semanticTokenService:
                new SemanticTokenService(),
            languageId: "clrs-es",
            developerLogger: {
                error() {
                    assert.fail(
                        "No se esperaba un error interno."
                    );
                }
            }
        });
    const document = createDocument([
        "PRINCIPAL()",
        "    dato = 1",
        "    dato = dato + LONG(\"a\")"
    ].join("\n"));
    const result =
        provider
            .provideDocumentSemanticTokens(
                document
            );

    assert.deepEqual(
        provider.legend.tokenTypes,
        ["function", "variable", "parameter"]
    );
    assert.deepEqual(
        provider.legend.tokenModifiers,
        [
            "declaration",
            "modification",
            "defaultLibrary"
        ]
    );
    assert.deepEqual(
        result.entries,
        [
            [0, 0, 9, 0, 1],
            [1, 4, 4, 1, 1],
            [2, 4, 4, 1, 2],
            [2, 12, 4, 1, 0],
            [2, 19, 4, 0, 4]
        ]
    );

    provider.dispose();
    assert.deepEqual(
        provider
            .provideDocumentSemanticTokens(
                document
            ).entries,
        []
    );
});

function createDocument(sourceCode) {
    return {
        uri: {
            toString() {
                return "file:///tokens.clrs";
            }
        },
        languageId: "clrs-es",
        version: 1,
        sourceCode,
        getText() {
            return this.sourceCode;
        }
    };
}

function createFakeVSCode() {
    class SemanticTokensLegend {
        constructor(
            tokenTypes,
            tokenModifiers
        ) {
            this.tokenTypes = tokenTypes;
            this.tokenModifiers =
                tokenModifiers;
        }
    }

    class SemanticTokensBuilder {
        constructor(legend) {
            this.legend = legend;
            this.entries = [];
        }

        push(...entry) {
            this.entries.push(entry);
        }

        build() {
            return {
                entries: this.entries
            };
        }
    }

    return {
        SemanticTokensLegend,
        SemanticTokensBuilder
    };
}
