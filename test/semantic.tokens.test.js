import test from "node:test";
import assert from "node:assert/strict";

import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    SemanticTokenModifier,
    SemanticTokenService,
    SemanticTokenType
} from "../src/language/intelligence/SemanticTokenService.js";

const VALID_SOURCE = [
    "PROCESA(A[], limite)",
    "    total = LONG(A)",
    "    total = total + limite",
    "    retornar total",
    "PRINCIPAL()",
    "    datos[0] = 1",
    "    resultado = PROCESA(datos, 2)"
].join("\n");

test("clasifica bindings, declaraciones, escrituras y biblioteca", () => {
    const tokens =
        createTokens(VALID_SOURCE);

    assertToken(
        tokens,
        "PROCESA",
        1,
        1,
        SemanticTokenType.FUNCTION,
        [
            SemanticTokenModifier
                .DECLARATION
        ]
    );
    assertToken(
        tokens,
        "A",
        1,
        9,
        SemanticTokenType.PARAMETER,
        [
            SemanticTokenModifier
                .DECLARATION
        ]
    );
    assertToken(
        tokens,
        "A",
        2,
        18,
        SemanticTokenType.PARAMETER,
        []
    );
    assertToken(
        tokens,
        "total",
        2,
        5,
        SemanticTokenType.VARIABLE,
        [
            SemanticTokenModifier
                .DECLARATION
        ]
    );
    assertToken(
        tokens,
        "total",
        3,
        5,
        SemanticTokenType.VARIABLE,
        [
            SemanticTokenModifier
                .MODIFICATION
        ]
    );
    assertToken(
        tokens,
        "LONG",
        2,
        13,
        SemanticTokenType.FUNCTION,
        [
            SemanticTokenModifier
                .DEFAULT_LIBRARY
        ]
    );
    assertToken(
        tokens,
        "PROCESA",
        7,
        17,
        SemanticTokenType.FUNCTION,
        []
    );
    assert.deepEqual(
        tokens,
        [...tokens].sort(
            (left, right) =>
                left.location.startLine -
                    right.location.startLine ||
                left.location.startColumn -
                    right.location.startColumn
        )
    );
});

test("reutiliza los tokens de un mismo snapshot documental", () => {
    const snapshot = analyze(VALID_SOURCE);
    const service =
        new SemanticTokenService();
    const first =
        service.getDocumentTokens({
            sourceCode: VALID_SOURCE,
            snapshot
        });
    const repeated =
        service.getDocumentTokens({
            sourceCode: VALID_SOURCE,
            snapshot
        });

    assert.equal(repeated, first);
});

test("mantiene tokens tolerantes durante una llamada incompleta", () => {
    const sourceCode = [
        "PROCESA(A[], limite)",
        "    retornar limite",
        "PRINCIPAL()",
        "    datos[0] = 1",
        "    resultado = PROCESA(datos, ",
        "    escribir \"PROCESA datos LONG\"",
        "    // PROCESA(datos)",
        "    longitud = LONG(datos"
    ].join("\n");
    const snapshot = analyze(sourceCode);
    const tokens =
        new SemanticTokenService()
            .getDocumentTokens({
                sourceCode,
                snapshot
            });

    assert.equal(snapshot.ok, false);
    assertToken(
        tokens,
        "A",
        1,
        9,
        SemanticTokenType.PARAMETER,
        [
            SemanticTokenModifier
                .DECLARATION
        ]
    );
    assertToken(
        tokens,
        "datos",
        4,
        5,
        SemanticTokenType.VARIABLE,
        [
            SemanticTokenModifier
                .DECLARATION
        ]
    );
    assertToken(
        tokens,
        "PROCESA",
        5,
        17,
        SemanticTokenType.FUNCTION,
        []
    );
    assertToken(
        tokens,
        "LONG",
        8,
        16,
        SemanticTokenType.FUNCTION,
        [
            SemanticTokenModifier
                .DEFAULT_LIBRARY
        ]
    );
    assert.equal(
        tokens.some(
            token =>
                token.location
                    .startLine === 6 &&
                token.name === "PROCESA"
        ),
        false
    );
    assert.equal(
        tokens.some(
            token =>
                token.location
                    .startLine === 7
        ),
        false
    );
});

test("una función local con nombre estándar no se marca como biblioteca", () => {
    const sourceCode = [
        "LONG(x)",
        "    retornar x",
        "PRINCIPAL()",
        "    resultado = LONG(1)"
    ].join("\n");
    const tokens =
        createTokens(sourceCode);
    const call = tokens.find(
        token =>
            token.name === "LONG" &&
            token.location.startLine ===
                4
    );

    assert.ok(call);
    assert.equal(
        call.type,
        SemanticTokenType.FUNCTION
    );
    assert.deepEqual(call.modifiers, []);
});

test("clasifica variables y llamadas dentro de arreglos literales", () => {
    const sourceCode = [
        "base = 2",
        "DUPLICA(valor)",
        "    retornar valor * 2",
        "PRINCIPAL()",
        "    datos = [base, DUPLICA(base), [base]]"
    ].join("\n");
    const tokens = createTokens(sourceCode);

    assertToken(
        tokens,
        "datos",
        5,
        5,
        SemanticTokenType.VARIABLE,
        [SemanticTokenModifier.DECLARATION]
    );
    assertToken(
        tokens,
        "base",
        5,
        14,
        SemanticTokenType.VARIABLE,
        []
    );
    assertToken(
        tokens,
        "DUPLICA",
        5,
        20,
        SemanticTokenType.FUNCTION,
        []
    );
    assertToken(
        tokens,
        "base",
        5,
        36,
        SemanticTokenType.VARIABLE,
        []
    );
});

function createTokens(sourceCode) {
    return new SemanticTokenService()
        .getDocumentTokens({
            sourceCode,
            snapshot: analyze(sourceCode)
        });
}

function analyze(sourceCode) {
    return new DocumentAnalysisService({
        languageDiagnosticsService:
            new LanguageDiagnosticsService(),
        analyzeCost() {
            return null;
        }
    }).analyze({
        key: "file:///tokens.clrs",
        version: 1,
        sourceCode
    });
}

function assertToken(
    tokens,
    name,
    line,
    column,
    type,
    modifiers
) {
    const token = tokens.find(
        item =>
            item.name === name &&
            item.location.startLine ===
                line &&
            item.location.startColumn ===
                column
    );

    assert.ok(
        token,
        `Falta ${name} en ${line}:${column}.`
    );
    assert.equal(token.type, type);
    assert.deepEqual(
        token.modifiers,
        modifiers
    );
}
