import test from "node:test";
import assert from "node:assert/strict";

import {
    CompilationService
} from "../src/compiler/services/CompilationService.js";
import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    CLRSSymbolNavigationProvider
} from "../extension/providers/SymbolNavigationProvider.js";

test("adapta esquema, definición y referencias a VS Code", () => {
    const fake = createFakeVSCode();
    const service = createAnalysisService();
    const provider =
        new CLRSSymbolNavigationProvider({
            vscodeApi: fake,
            documentAnalysisService:
                service,
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
        "DUPLICA(valor)",
        "    resultado = valor + valor",
        "    retornar resultado",
        "PRINCIPAL()",
        "    dato = 2",
        "    salida = DUPLICA(dato)",
        "    escribir salida"
    ].join("\n"));
    const symbols =
        provider
            .provideDocumentSymbols(
                document
            );

    assert.deepEqual(
        symbols.map(symbol => symbol.name),
        ["DUPLICA", "PRINCIPAL"]
    );
    assert.equal(
        symbols[0].kind,
        fake.SymbolKind.Function
    );
    assert.equal(
        symbols[0].children[0].kind,
        fake.SymbolKind.TypeParameter
    );
    assert.equal(
        symbols[0].children[1].kind,
        fake.SymbolKind.Variable
    );
    assert.equal(
        symbols[0].range.start.line,
        0
    );
    assert.equal(
        symbols[0].range.end.line,
        2
    );

    const definition =
        provider.provideDefinition(
            document,
            { line: 2, character: 14 }
        );

    assert.equal(
        definition.uri,
        document.uri
    );
    assert.deepEqual(
        definition.range.start,
        { line: 1, character: 4 }
    );
    assert.deepEqual(
        definition.range.end,
        { line: 1, character: 13 }
    );

    const references =
        provider.provideReferences(
            document,
            { line: 5, character: 14 },
            { includeDeclaration: true }
        );

    assert.deepEqual(
        references.map(
            location => [
                location.range.start.line,
                location.range.start
                    .character
            ]
        ),
        [
            [0, 0],
            [5, 14]
        ]
    );

    provider.dispose();
    assert.deepEqual(
        provider.provideDocumentSymbols(
            document
        ),
        []
    );
});

test("no publica navegación parcial para documentos inválidos", () => {
    const errors = [];
    const provider =
        new CLRSSymbolNavigationProvider({
            vscodeApi: createFakeVSCode(),
            documentAnalysisService:
                createAnalysisService(),
            languageId: "clrs-es",
            developerLogger: {
                error(value) {
                    errors.push(value);
                }
            }
        });
    const document =
        createDocument("PRINCIPAL(");

    assert.deepEqual(
        provider.provideDocumentSymbols(
            document
        ),
        []
    );
    assert.equal(
        provider.provideDefinition(
            document,
            { line: 0, character: 1 }
        ),
        null
    );
    assert.deepEqual(
        provider.provideReferences(
            document,
            { line: 0, character: 1 },
            { includeDeclaration: false }
        ),
        []
    );
    assert.deepEqual(errors, []);
});

function createAnalysisService() {
    const compilationService =
        new CompilationService();

    return new DocumentAnalysisService({
        languageDiagnosticsService:
            new LanguageDiagnosticsService(),
        analyzeCost:
            ast =>
                compilationService
                    .analyzeCostAST(ast)
    });
}

function createDocument(sourceCode) {
    const uri = {
        toString() {
            return "file:///simbolos.clrs";
        }
    };

    return {
        uri,
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

    class DocumentSymbol {
        constructor(
            name,
            detail,
            kind,
            range,
            selectionRange
        ) {
            this.name = name;
            this.detail = detail;
            this.kind = kind;
            this.range = range;
            this.selectionRange =
                selectionRange;
            this.children = [];
        }
    }

    class Location {
        constructor(uri, range) {
            this.uri = uri;
            this.range = range;
        }
    }

    return {
        Range,
        DocumentSymbol,
        Location,
        SymbolKind: {
            Function: 11,
            Variable: 12,
            TypeParameter: 25
        }
    };
}
