import test from "node:test";
import assert from "node:assert/strict";

import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    LanguageCompletionKind,
    LanguageIntelligenceService
} from "../src/language/intelligence/LanguageIntelligenceService.js";
import {
    findCallContext,
    findFunctionCalls
} from "../src/language/intelligence/TolerantSourceAnalyzer.js";

const VALID_SOURCE = [
    "GLOBAL = 1",
    "PROCESA(A[], limite)",
    "    total = LONG(A)",
    "    retornar total + limite",
    "PRINCIPAL()",
    "    datos[0] = GLOBAL",
    "    resultado = PROCESA(datos, 2)",
    "    escribir resultado"
].join("\n");

test("completa símbolos visibles, biblioteca y palabras del lenguaje", () => {
    const service =
        new LanguageIntelligenceService();
    const snapshot =
        analyze(VALID_SOURCE);
    const completions =
        service.getCompletions({
            sourceCode: VALID_SOURCE,
            snapshot,
            position: {
                line: 4,
                column: 15
            }
        });
    const byName = new Map(
        completions.map(
            item => [item.label, item]
        )
    );

    assert.equal(
        byName.get("A").kind,
        LanguageCompletionKind.PARAMETER
    );
    assert.equal(
        byName.get("limite").priority,
        0
    );
    assert.equal(
        byName.get("total").kind,
        LanguageCompletionKind.VARIABLE
    );
    assert.equal(
        byName.get("GLOBAL").priority,
        1
    );
    assert.equal(
        byName.get("PROCESA").detail,
        "PROCESA(A[], limite)"
    );
    assert.equal(
        byName.get("LONG").detail,
        "LONG(estructura) → Número"
    );
    assert.equal(
        byName.get("mientras").kind,
        LanguageCompletionKind.KEYWORD
    );
    assert.equal(byName.has("datos"), false);
    assert.equal(
        new Set(
            completions.map(
                item => item.label
            )
        ).size,
        completions.length
    );
});

test("hover describe variables, funciones y biblioteca estándar", () => {
    const service =
        new LanguageIntelligenceService();
    const snapshot =
        analyze(VALID_SOURCE);
    const variable = service.getHover({
        sourceCode: VALID_SOURCE,
        snapshot,
        position: {
            line: 4,
            column: 15
        }
    });
    const standard = service.getHover({
        sourceCode: VALID_SOURCE,
        snapshot,
        position: {
            line: 3,
            column: 15
        }
    });
    const call = service.getHover({
        sourceCode: VALID_SOURCE,
        snapshot,
        position: {
            line: 7,
            column: 20
        }
    });

    assert.equal(
        variable.signature,
        "variable total"
    );
    assert.match(
        variable.documentation,
        /línea 3/
    );
    assert.equal(
        standard.signature,
        "LONG(estructura)"
    );
    assert.match(
        standard.documentation,
        /O\(1\)/
    );
    assert.equal(
        call.signature,
        "PROCESA(A[], limite)"
    );
});

test("mantiene completado y firmas locales mientras el código está incompleto", () => {
    const sourceCode = [
        "PROCESA(A[], limite)",
        "    retornar limite",
        "PRINCIPAL()",
        "    datos[0] = 1",
        "    resultado = PROCESA(datos, "
    ].join("\n");
    const service =
        new LanguageIntelligenceService();
    const snapshot = analyze(sourceCode);
    const position = {
        line: 5,
        column:
            sourceCode.split("\n")[4]
                .length + 1
    };
    const signature =
        service.getSignatureHelp({
            sourceCode,
            snapshot,
            position
        });
    const completions =
        service.getCompletions({
            sourceCode,
            snapshot,
            position
        });

    assert.equal(snapshot.ok, false);
    assert.equal(
        signature.label,
        "PROCESA(A[], limite)"
    );
    assert.deepEqual(
        signature.parameters.map(
            parameter =>
                parameter.label
        ),
        ["A[]", "limite"]
    );
    assert.equal(
        signature.activeParameter,
        1
    );
    assert.ok(
        completions.some(
            item =>
                item.label === "datos"
        )
    );
    assert.ok(
        completions.some(
            item =>
                item.label === "resultado"
        )
    );
    assert.ok(
        completions.some(
            item =>
                item.label === "PROCESA"
        )
    );
});

test("calcula el parámetro activo en llamadas anidadas", () => {
    const sourceCode =
        "valor = MAX(1, MIN(2, ";
    const position = {
        line: 1,
        column: sourceCode.length + 1
    };
    const context =
        findCallContext(
            sourceCode,
            position
        );
    const help =
        new LanguageIntelligenceService()
            .getSignatureHelp({
                sourceCode,
                snapshot:
                    analyze(sourceCode),
                position
            });

    assert.deepEqual(context, {
        name: "MIN",
        activeParameter: 1
    });
    assert.equal(help.label, "MIN(a, b)");
    assert.equal(help.activeParameter, 1);
    assert.equal(
        findCallContext(
            "escribir \"MAX(1, \" // MIN(2, ",
            {
                line: 1,
                column: 31
            }
        ),
        null
    );
});

test("proyecta nombres de parámetros en llamadas locales y estándar", () => {
    const sourceCode = [
        "SUMA(varA, varB)",
        "    retornar varA + varB",
        "PRINCIPAL()",
        "    resultado = SUMA(10, LONG(\"Hola\"))",
        "    incompleto = SUMA(30, "
    ].join("\n");
    const service =
        new LanguageIntelligenceService();
    const hints = service.getInlayHints({
        sourceCode,
        snapshot: analyze(sourceCode)
    });

    assert.deepEqual(
        hints.map(hint => ({
            label: hint.label,
            functionName:
                hint.functionName,
            line: hint.position.line,
            column: hint.position.column
        })),
        [
            {
                label: "varA:",
                functionName: "SUMA",
                line: 4,
                column: 22
            },
            {
                label: "varB:",
                functionName: "SUMA",
                line: 4,
                column: 26
            },
            {
                label: "estructura:",
                functionName: "LONG",
                line: 4,
                column: 31
            },
            {
                label: "varA:",
                functionName: "SUMA",
                line: 5,
                column: 23
            }
        ]
    );
});

test("filtra Inlay Hints por rango e ignora declaraciones, comentarios y cadenas", () => {
    const sourceCode = [
        "SUMA(a, b)",
        "    retornar a + b",
        "PRINCIPAL()",
        "    primero = SUMA(1, 2)",
        "    texto = \"SUMA(3, 4)\" // SUMA(5, 6)",
        "    segundo = SUMA(",
        "        7,",
        "        8",
        "    )"
    ].join("\n");
    const calls =
        findFunctionCalls(sourceCode);
    const hints =
        new LanguageIntelligenceService()
            .getInlayHints({
                sourceCode,
                range: {
                    start: {
                        line: 6,
                        column: 1
                    },
                    end: {
                        line: 9,
                        column: 6
                    }
                }
            });

    assert.deepEqual(
        calls.map(call => call.name),
        [
            "SUMA",
            "PRINCIPAL",
            "SUMA",
            "SUMA"
        ]
    );
    assert.deepEqual(
        hints.map(hint => ({
            label: hint.label,
            position: hint.position
        })),
        [
            {
                label: "a:",
                position: {
                    line: 7,
                    column: 9
                }
            },
            {
                label: "b:",
                position: {
                    line: 8,
                    column: 9
                }
            }
        ]
    );
});

test("conserva símbolos locales en una línea vacía del cuerpo", () => {
    const sourceCode = [
        "SUMA(a)",
        "    valor = a",
        "    ",
        "PRINCIPAL()",
        "    retornar SUMA(1)"
    ].join("\n");
    const completions =
        new LanguageIntelligenceService()
            .getCompletions({
                sourceCode,
                snapshot:
                    analyze(sourceCode),
                position: {
                    line: 3,
                    column: 5
                }
            });

    assert.ok(
        completions.some(
            item => item.label === "a"
        )
    );
    assert.ok(
        completions.some(
            item =>
                item.label === "valor"
        )
    );
});

test("ofrece hover, firmas y completado dentro de arreglos literales", () => {
    const validSource = [
        "base = 2",
        "DUPLICA(valor)",
        "    retornar valor * 2",
        "PRINCIPAL()",
        "    datos = [base, DUPLICA(base), [base]]"
    ].join("\n");
    const service =
        new LanguageIntelligenceService();
    const snapshot = analyze(validSource);
    const variable = service.getHover({
        sourceCode: validSource,
        snapshot,
        position: {
            line: 5,
            column: 30
        }
    });
    const call = service.getHover({
        sourceCode: validSource,
        snapshot,
        position: {
            line: 5,
            column: 22
        }
    });
    const incompleteSource = [
        "base = 2",
        "DUPLICA(valor)",
        "    retornar valor * 2",
        "PRINCIPAL()",
        "    datos = [base, DUPLICA("
    ].join("\n");
    const position = {
        line: 5,
        column:
            incompleteSource
                .split("\n")[4]
                .length + 1
    };
    const incompleteSnapshot =
        analyze(incompleteSource);
    const signature =
        service.getSignatureHelp({
            sourceCode: incompleteSource,
            snapshot: incompleteSnapshot,
            position
        });
    const completions =
        service.getCompletions({
            sourceCode: incompleteSource,
            snapshot: incompleteSnapshot,
            position
        });

    assert.equal(
        variable.signature,
        "variable base"
    );
    assert.match(
        variable.documentation,
        /línea 1/
    );
    assert.equal(
        call.signature,
        "DUPLICA(valor)"
    );
    assert.equal(
        incompleteSnapshot.ok,
        false
    );
    assert.equal(
        signature.label,
        "DUPLICA(valor)"
    );
    assert.equal(
        signature.activeParameter,
        0
    );
    assert.ok(
        completions.some(
            item => item.label === "base"
        )
    );
});

function analyze(sourceCode) {
    return new DocumentAnalysisService({
        languageDiagnosticsService:
            new LanguageDiagnosticsService(),
        analyzeCost() {
            return null;
        }
    }).analyze({
        key: "file:///intelligence.clrs",
        version: 1,
        sourceCode
    });
}
