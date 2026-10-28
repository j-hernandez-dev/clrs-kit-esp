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
    getSemanticNavigationIndex,
    SemanticOccurrenceKind
} from "../src/semantic/SemanticNavigationIndex.js";
import {
    SemanticSymbolKind
} from "../src/semantic/SemanticSymbol.js";

const SOURCE = [
    "dato = 1",
    "SUMA(a, b[])",
    "    total = a + b[0]",
    "    total = total + 1",
    "    retornar total",
    "PRINCIPAL()",
    "    A[0] = 2",
    "    longitud = LONG(A)",
    "    resultado = SUMA(dato, A)",
    "    escribir resultado"
].join("\n");

test("construye un esquema jerárquico con definiciones efectivas", () => {
    const { snapshot, index } =
        analyzeSource();

    assert.equal(snapshot.ok, true);
    assert.equal(
        getSemanticNavigationIndex(
            snapshot
        ),
        index
    );
    assert.deepEqual(
        index.documentSymbols.map(
            symbol => symbol.name
        ),
        ["dato", "SUMA", "PRINCIPAL"]
    );

    const suma =
        index.documentSymbols[1];

    assert.equal(
        suma.kind,
        SemanticSymbolKind.FUNCTION
    );
    assert.equal(suma.detail, "(a, b[])");
    assert.deepEqual(
        suma.children.map(
            symbol => symbol.name
        ),
        ["a", "b", "total"]
    );
    assert.deepEqual(
        suma.children.map(
            symbol => symbol.kind
        ),
        [
            SemanticSymbolKind.PARAMETER,
            SemanticSymbolKind.PARAMETER,
            SemanticSymbolKind.VARIABLE
        ]
    );
    assert.equal(suma.location.startLine, 2);
    assert.equal(suma.location.endLine, 5);
    assert.equal(
        suma.selectionLocation
            .startColumn,
        1
    );

    const principal =
        index.documentSymbols[2];

    assert.deepEqual(
        principal.children.map(
            symbol => symbol.name
        ),
        ["A", "longitud", "resultado"]
    );
});

test("distingue definición, escrituras posteriores y lecturas", () => {
    const { index } = analyzeSource();
    const definition =
        index.getDefinitionAt({
            line: 5,
            column: 14
        });

    assert.ok(definition);
    assert.equal(definition.name, "total");
    assert.equal(
        definition.kind,
        SemanticOccurrenceKind.DEFINITION
    );
    assert.equal(
        definition.location.startLine,
        3
    );
    assert.equal(
        definition.location.startColumn,
        5
    );

    const references =
        index.getReferencesAt({
            line: 5,
            column: 14
        });

    assert.deepEqual(
        references.map(
            occurrence => [
                occurrence.location
                    .startLine,
                occurrence.location
                    .startColumn,
                occurrence.kind
            ]
        ),
        [
            [
                4,
                5,
                SemanticOccurrenceKind.WRITE
            ],
            [
                4,
                13,
                SemanticOccurrenceKind.REFERENCE
            ],
            [
                5,
                14,
                SemanticOccurrenceKind.REFERENCE
            ]
        ]
    );
    assert.equal(
        index.getReferencesAt(
            {
                line: 5,
                column: 14
            },
            { includeDefinition: true }
        ).length,
        4
    );
});

test("resuelve llamadas locales y conserva built-ins sin definición fuente", () => {
    const { index } = analyzeSource();
    const functionDefinition =
        index.getDefinitionAt({
            line: 9,
            column: 18
        });

    assert.ok(functionDefinition);
    assert.equal(
        functionDefinition.name,
        "SUMA"
    );
    assert.equal(
        functionDefinition.location
            .startLine,
        2
    );
    assert.equal(
        index.getDefinitionAt({
            line: 8,
            column: 17
        }),
        null
    );

    const builtinReferences =
        index.getReferencesAt({
            line: 8,
            column: 17
        });

    assert.equal(
        builtinReferences.length,
        1
    );
    assert.equal(
        builtinReferences[0].name,
        "LONG"
    );
});

test("navega referencias y llamadas dentro de arreglos literales anidados", () => {
    const sourceCode = [
        "base = 2",
        "DUPLICA(valor)",
        "    retornar valor * 2",
        "PRINCIPAL()",
        "    datos = [base, DUPLICA(base), [base]]",
        "    escribir datos[0]"
    ].join("\n");
    const { index } =
        analyzeSource(sourceCode);
    const baseDefinition =
        index.getDefinitionAt({
            line: 5,
            column: 37
        });
    const baseReferences =
        index.getReferencesAt({
            line: 5,
            column: 29
        });
    const functionDefinition =
        index.getDefinitionAt({
            line: 5,
            column: 20
        });

    assert.equal(
        baseDefinition.location.startLine,
        1
    );
    assert.deepEqual(
        baseReferences.map(
            occurrence => [
                occurrence.location
                    .startLine,
                occurrence.location
                    .startColumn
            ]
        ),
        [
            [5, 14],
            [5, 28],
            [5, 36]
        ]
    );
    assert.equal(
        functionDefinition.name,
        "DUPLICA"
    );
    assert.equal(
        functionDefinition.location
            .startLine,
        2
    );
});

function analyzeSource(sourceCode = SOURCE) {
    const compilationService =
        new CompilationService();
    const service =
        new DocumentAnalysisService({
            languageDiagnosticsService:
                new LanguageDiagnosticsService(),
            analyzeCost:
                ast =>
                    compilationService
                        .analyzeCostAST(ast)
        });
    const snapshot = service.analyze({
        key: "file:///navegacion.clrs",
        version: 1,
        sourceCode
    });

    return {
        snapshot,
        index:
            getSemanticNavigationIndex(
                snapshot
            )
    };
}
