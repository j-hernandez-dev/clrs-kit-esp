import test from "node:test";
import assert from "node:assert/strict";

import {
    CompilationService
} from "../src/compiler/services/CompilationService.js";
import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticSeverity,
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    SemanticCallDiagnosticCode,
    SemanticCallDiagnosticsService
} from "../src/language/diagnostics/SemanticCallDiagnosticsService.js";

const SOURCE = [
    "dato = GLOBAL(1)",
    "GLOBAL(n)",
    "    retornar n",
    "USADA(n)",
    "    retornar n",
    "DIRECTA(n)",
    "    retornar DIRECTA(n)",
    "A(n)",
    "    retornar B(n)",
    "B(n)",
    "    retornar A(n)",
    "HUERFANA()",
    "    retornar 0",
    "PRINCIPAL()",
    "    resultado = USADA(1)",
    "    ciclo = A(1)"
].join("\n");

test("deriva funciones inalcanzables y recursión sin activar el costo", () => {
    const snapshot = analyzeSource(SOURCE);
    const service =
        new SemanticCallDiagnosticsService();

    assert.equal(snapshot.ok, true);
    assert.deepEqual(snapshot.diagnostics, []);
    assert.equal(
        snapshot.hasCostAnalysis,
        false
    );

    const diagnostics =
        service.diagnose(snapshot);
    const unused = diagnostics.filter(
        diagnostic =>
            diagnostic.code ===
                SemanticCallDiagnosticCode
                    .UNUSED_FUNCTION
    );
    const direct = diagnostics.filter(
        diagnostic =>
            diagnostic.code ===
                SemanticCallDiagnosticCode
                    .DIRECT_RECURSION
    );
    const indirect = diagnostics.filter(
        diagnostic =>
            diagnostic.code ===
                SemanticCallDiagnosticCode
                    .INDIRECT_RECURSION
    );

    assert.deepEqual(
        unused.map(
            diagnostic =>
                diagnostic.data.functionName
        ),
        ["DIRECTA", "HUERFANA"]
    );
    assert.deepEqual(
        direct.map(
            diagnostic =>
                diagnostic.data.functionName
        ),
        ["DIRECTA"]
    );
    assert.deepEqual(
        indirect.map(
            diagnostic =>
                diagnostic.data.functionName
        ),
        ["A", "B"]
    );
    assert.ok(
        unused.every(
            diagnostic =>
                diagnostic.severity ===
                    LanguageDiagnosticSeverity
                        .HINT
        )
    );
    assert.ok(
        [...direct, ...indirect].every(
            diagnostic =>
                diagnostic.severity ===
                    LanguageDiagnosticSeverity
                        .INFORMATION
        )
    );
    assert.ok(
        diagnostics.every(
            diagnostic =>
                diagnostic.phase ===
                    "call-graph" &&
                diagnostic.location != null
        )
    );
    assert.equal(
        diagnostics.some(
            diagnostic =>
                diagnostic.data
                    .functionName ===
                "PRINCIPAL"
        ),
        false
    );
    assert.equal(
        snapshot.hasCostAnalysis,
        false
    );
    assert.equal(
        Object.isFrozen(diagnostics),
        true
    );
    assert.ok(
        diagnostics.every(
            diagnostic =>
                Object.isFrozen(
                    diagnostic
                ) &&
                Object.isFrozen(
                    diagnostic.data
                )
        )
    );
});

test("no deriva avisos cuando el análisis documental es inválido", () => {
    const service =
        new SemanticCallDiagnosticsService();
    const snapshot = analyzeSource(
        "PRINCIPAL("
    );
    const diagnostics =
        service.diagnose(snapshot);

    assert.equal(snapshot.ok, false);
    assert.deepEqual(diagnostics, []);
    assert.equal(
        Object.isFrozen(diagnostics),
        true
    );
});

function analyzeSource(sourceCode) {
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

    return service.analyze({
        key:
            "file:///diagnosticos-grafo.clrs",
        version: 1,
        sourceCode
    });
}
