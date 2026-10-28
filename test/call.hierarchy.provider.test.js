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
    CLRSCallHierarchyProvider
} from "../extension/providers/CallHierarchyProvider.js";

const SOURCE = [
    "dato = BASE(1)",
    "BASE(n)",
    "    retornar n",
    "DOBLE(x)",
    "    retornar BASE(x) + BASE(x)",
    "PRINCIPAL()",
    "    resultado = DOBLE(2)"
].join("\n");

test("prepara funciones desde su definición y sus llamadas", () => {
    const { fake, provider, document } =
        createFixture();
    const definition =
        provider.prepareCallHierarchy(
            document,
            { line: 1, character: 1 }
        );
    const call =
        provider.prepareCallHierarchy(
            document,
            { line: 6, character: 17 }
        );

    assert.ok(definition);
    assert.equal(definition.name, "BASE");
    assert.equal(
        definition.kind,
        fake.SymbolKind.Function
    );
    assert.equal(definition.detail, "(n)");
    assert.equal(
        definition.range.start.line,
        1
    );
    assert.equal(
        definition.selectionRange
            .start.character,
        0
    );
    assert.equal(call.name, "DOBLE");

    assert.equal(
        provider.prepareCallHierarchy(
            document,
            { line: 6, character: 4 }
        ),
        null
    );
});

test("agrupa llamadas entrantes por origen y conserva todos los rangos", () => {
    const { fake, provider, document } =
        createFixture();
    const base =
        provider.prepareCallHierarchy(
            document,
            { line: 1, character: 1 }
        );
    const incoming =
        provider
            .provideCallHierarchyIncomingCalls(
                base
            );

    assert.equal(incoming.length, 2);
    assert.ok(
        incoming.every(
            call =>
                call instanceof
                fake.CallHierarchyIncomingCall
        )
    );
    assert.deepEqual(
        incoming.map(call => call.from.name),
        ["Programa CLRS", "DOBLE"]
    );
    assert.deepEqual(
        incoming.map(call =>
            call.fromRanges.map(range => [
                range.start.line,
                range.start.character
            ])
        ),
        [
            [[0, 7]],
            [[4, 13], [4, 23]]
        ]
    );
    assert.equal(
        incoming[0].from.kind,
        fake.SymbolKind.Module
    );
});

test("agrupa llamadas salientes y resuelve elementos rehidratados", () => {
    const { fake, provider, document } =
        createFixture();
    const doble =
        provider.prepareCallHierarchy(
            document,
            { line: 3, character: 2 }
        );
    const rehydrated =
        new fake.CallHierarchyItem(
            doble.kind,
            doble.name,
            doble.detail,
            doble.uri,
            doble.range,
            doble.selectionRange
        );
    const outgoing =
        provider
            .provideCallHierarchyOutgoingCalls(
                rehydrated
            );

    assert.equal(outgoing.length, 1);
    assert.ok(
        outgoing[0] instanceof
            fake.CallHierarchyOutgoingCall
    );
    assert.equal(outgoing[0].to.name, "BASE");
    assert.deepEqual(
        outgoing[0].fromRanges.map(
            range => range.start.character
        ),
        [13, 23]
    );
});

test("respeta cancelación, lenguaje y ciclo de vida", () => {
    const { provider, document } =
        createFixture();
    const cancelled = {
        isCancellationRequested: true
    };

    assert.equal(
        provider.prepareCallHierarchy(
            document,
            { line: 1, character: 1 },
            cancelled
        ),
        null
    );
    assert.equal(
        provider.prepareCallHierarchy(
            {
                ...document,
                languageId: "javascript"
            },
            { line: 1, character: 1 }
        ),
        null
    );

    const item =
        provider.prepareCallHierarchy(
            document,
            { line: 1, character: 1 }
        );

    provider.dispose();

    assert.deepEqual(
        provider
            .provideCallHierarchyIncomingCalls(
                item
            ),
        []
    );
    assert.equal(
        provider.prepareCallHierarchy(
            document,
            { line: 1, character: 1 }
        ),
        null
    );
});

function createFixture() {
    const fake = createFakeVSCode();
    const compilationService =
        new CompilationService();
    const documentAnalysisService =
        new DocumentAnalysisService({
            languageDiagnosticsService:
                new LanguageDiagnosticsService(),
            analyzeCost:
                ast =>
                    compilationService
                        .analyzeCostAST(ast)
        });
    const provider =
        new CLRSCallHierarchyProvider({
            vscodeApi: fake,
            documentAnalysisService,
            languageId: "clrs-es",
            developerLogger: {
                error() {
                    assert.fail(
                        "No se esperaba un error interno."
                    );
                }
            }
        });

    return {
        fake,
        provider,
        document: createDocument(SOURCE)
    };
}

function createDocument(sourceCode) {
    const uri = {
        toString() {
            return "file:///jerarquia.clrs";
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

    class CallHierarchyItem {
        constructor(
            kind,
            name,
            detail,
            uri,
            range,
            selectionRange
        ) {
            Object.assign(this, {
                kind,
                name,
                detail,
                uri,
                range,
                selectionRange
            });
        }
    }

    class CallHierarchyIncomingCall {
        constructor(from, fromRanges) {
            this.from = from;
            this.fromRanges = fromRanges;
        }
    }

    class CallHierarchyOutgoingCall {
        constructor(to, fromRanges) {
            this.to = to;
            this.fromRanges = fromRanges;
        }
    }

    return {
        Range,
        CallHierarchyItem,
        CallHierarchyIncomingCall,
        CallHierarchyOutgoingCall,
        SymbolKind: {
            Module: 1,
            Function: 11
        }
    };
}
