import test from "node:test";
import assert from "node:assert/strict";

import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    LanguageIntelligenceService
} from "../src/language/intelligence/LanguageIntelligenceService.js";
import {
    CLRSLanguageIntelligenceProvider
} from "../extension/providers/LanguageIntelligenceProvider.js";

test("adapta completado, hover y firmas a objetos de VS Code", () => {
    const vscode = createFakeVSCode();
    const provider = createProvider(vscode);
    const document = createDocument([
        "SUMA(a, b)",
        "    resultado = a + b",
        "    retornar resultado",
        "PRINCIPAL()",
        "    total = SUMA(1, "
    ].join("\n"));
    const position = {
        line: 4,
        character:
            document.lineAt(4)
                .text.length
    };
    const completions =
        provider.provideCompletionItems(
            document,
            position
        );
    const suma = completions.find(
        item => item.label === "SUMA"
    );
    const long = completions.find(
        item => item.label === "LONG"
    );

    assert.equal(
        suma.kind,
        vscode.CompletionItemKind
            .Function
    );
    assert.equal(
        suma.insertText.value,
        "SUMA(${1:a}, ${2:b})"
    );
    assert.equal(
        long.insertText.value,
        "LONG(${1:estructura})"
    );

    const hoverDocument =
        createDocument([
            "PRINCIPAL()",
            "    arreglo[0] = 1",
            "    longitud = LONG(arreglo)"
        ].join("\n"));
    const hover = provider.provideHover(
        hoverDocument,
        { line: 2, character: 17 }
    );

    assert.equal(
        hover.contents.codeBlocks[0]
            .value,
        "LONG(estructura)"
    );
    assert.match(
        hover.contents.value,
        /Costo declarado/
    );

    const signature =
        provider.provideSignatureHelp(
            document,
            position
        );

    assert.equal(
        signature.signatures[0].label,
        "SUMA(a, b)"
    );
    assert.equal(
        signature.activeParameter,
        1
    );
    assert.deepEqual(
        signature.signatures[0]
            .parameters.map(
                parameter =>
                    parameter.label
            ),
        ["a", "b"]
    );

    const inlayHints =
        provider.provideInlayHints(
            document,
            {
                start: {
                    line: 0,
                    character: 0
                },
                end: {
                    line: 4,
                    character:
                        document.lineAt(4)
                            .text.length
                }
            }
        );

    assert.deepEqual(
        inlayHints.map(hint => ({
            label: hint.label,
            line: hint.position.line,
            character:
                hint.position.character,
            kind: hint.kind,
            paddingRight:
                hint.paddingRight
        })),
        [
            {
                label: "a:",
                line: 4,
                character: 17,
                kind:
                    vscode.InlayHintKind
                        .Parameter,
                paddingRight: true
            }
        ]
    );
    assert.match(
        inlayHints[0].tooltip,
        /SUMA/
    );

    provider.dispose();
    assert.deepEqual(
        provider.provideCompletionItems(
            document,
            position
        ),
        []
    );
});

function createProvider(vscode) {
    return new CLRSLanguageIntelligenceProvider({
        vscodeApi: vscode,
        documentAnalysisService:
            new DocumentAnalysisService({
                languageDiagnosticsService:
                    new LanguageDiagnosticsService(),
                analyzeCost() {
                    return null;
                }
            }),
        intelligenceService:
            new LanguageIntelligenceService(),
        languageId: "clrs-es",
        developerLogger: {
            error() {
                assert.fail(
                    "No se esperaba un error interno."
                );
            }
        }
    });
}

function createDocument(sourceCode) {
    return {
        uri: {
            toString() {
                return "file:///ayuda.clrs";
            }
        },
        languageId: "clrs-es",
        version: 1,
        sourceCode,
        get lineCount() {
            return this.sourceCode
                .split("\n").length;
        },
        getText() {
            return this.sourceCode;
        },
        lineAt(line) {
            return {
                text:
                    this.sourceCode
                        .split("\n")[line] ??
                    ""
            };
        }
    };
}

function createFakeVSCode() {
    class Range {
        constructor(
            startLine,
            startCharacter,
            endLine,
            endCharacter
        ) {
            this.start = {
                line: startLine,
                character: startCharacter
            };
            this.end = {
                line: endLine,
                character: endCharacter
            };
        }
    }

    class MarkdownString {
        constructor(value = "") {
            this.value = value;
            this.codeBlocks = [];
        }

        appendCodeblock(value, language) {
            this.codeBlocks.push({
                value,
                language
            });
            return this;
        }

        appendMarkdown(value) {
            this.value += value;
            return this;
        }
    }

    class CompletionItem {
        constructor(label, kind) {
            this.label = label;
            this.kind = kind;
        }
    }

    class SnippetString {
        constructor(value) {
            this.value = value;
        }
    }

    class Hover {
        constructor(contents, range) {
            this.contents = contents;
            this.range = range;
        }
    }

    class SignatureHelp {
        constructor() {
            this.signatures = [];
        }
    }

    class SignatureInformation {
        constructor(label, documentation) {
            this.label = label;
            this.documentation =
                documentation;
            this.parameters = [];
        }
    }

    class ParameterInformation {
        constructor(label, documentation) {
            this.label = label;
            this.documentation =
                documentation;
        }
    }

    class Position {
        constructor(line, character) {
            this.line = line;
            this.character = character;
        }
    }

    class InlayHint {
        constructor(position, label, kind) {
            this.position = position;
            this.label = label;
            this.kind = kind;
        }
    }

    return {
        Range,
        MarkdownString,
        CompletionItem,
        SnippetString,
        Hover,
        SignatureHelp,
        SignatureInformation,
        ParameterInformation,
        Position,
        InlayHint,
        InlayHintKind: {
            Parameter: 2
        },
        CompletionItemKind: {
            Function: 3,
            Variable: 6,
            Keyword: 13,
            TypeParameter: 24
        }
    };
}
