import test from "node:test";
import assert from "node:assert/strict";

import {
    CompilationService
} from "../src/compiler/services/CompilationService.js";
import {
    CostExpressionFactory as Cost
} from "../src/complex/algebra/CostExpressionFactory.js";
import {
    formatCostExpressionLatex
} from "../src/complex/report/CostExpressionLatexFormatter.js";
import {
    ComplexityReportBuilder
} from "../src/complex/report/ComplexityReportBuilder.js";
import {
    ComplexityResultKind,
    presentComplexityResult
} from "../src/complex/report/ComplexityResultPresentation.js";

test("formatea el álgebra de costos como LaTeX apto para KaTeX", () => {
    const expression = Cost.equation(
        Cost.call("TORDENA", [
            Cost.symbol("A")
        ]),
        Cost.sum([
            Cost.product([
                Cost.symbol("n"),
                Cost.logarithm(
                    Cost.symbol("n"),
                    Cost.constant(2)
                )
            ]),
            Cost.quotient(
                Cost.symbol("m"),
                Cost.constant(2)
            )
        ])
    );

    assert.equal(
        formatCostExpressionLatex(expression),
        "TORDENA\\left(A\\right) = n \\cdot \\log_{2}\\left(n\\right) + \\frac{m}{2}"
    );
    assert.equal(
        formatCostExpressionLatex(
            Cost.raw("costo_{x}\\ruta")
        ),
        "\\text{costo\\_\\{x\\}\\textbackslash{}ruta}"
    );
});

test("construye un informe serializable con escenarios, pasos y navegación", () => {
    const costReport =
        new CompilationService()
            .analyzeSource([
                "LINEAL(n)",
                "    si n > 1",
                "        retornar LINEAL(n - 1)",
                "    retornar 0",
                "USA(n)",
                "    LINEAL(n)"
            ].join("\n"));
    const report =
        new ComplexityReportBuilder()
            .build(costReport, {
                uri: "file:///algoritmo.clrs",
                fileName: "algoritmo.clrs",
                version: 7
            });
    const linear = report.functions[0];
    const consumer = report.functions[1];

    assert.equal(
        report.document.version,
        7
    );
    assert.equal(linear.name, "LINEAL");
    assert.equal(
        linear.best.asymptotic.notation,
        "O(n)"
    );
    assert.equal(
        linear.worst.asymptotic.notation,
        "O(n)"
    );
    assert.equal(
        linear.worst.conclusion.notation,
        "O(n)"
    );
    assert.equal(
        linear.worst.conclusion.kind,
        "upper-bound"
    );
    assert.equal(
        linear.worst.conclusion
            .proof.verified,
        true
    );
    assert.equal(
        linear.best.explanations.length,
        3
    );
    assert.match(
        linear.worst.simplified.latex,
        /TLINEAL/
    );
    assert.equal(
        consumer.callGraph.edges[0].to,
        "TLINEAL"
    );
    assert.equal(
        JSON.parse(
            JSON.stringify(report)
        ).functions.length,
        2
    );
});

test("distingue informes conocidos, parciales y desconocidos", () => {
    const service =
        new CompilationService();
    const partial =
        new ComplexityReportBuilder()
            .build(
                service.analyzeSource([
                    "H(n)",
                    "    retornar n > 0",
                    "G(n)",
                    "    si n > 0",
                    "        escribir 1",
                    "    sino",
                    "        mientras H(n)",
                    "            escribir n"
                ].join("\n"))
            );
    const functionReport =
        partial.functions.find(
            item => item.name === "G"
        );

    assert.equal(partial.status, "partial");
    assert.equal(
        functionReport.status,
        "partial"
    );
    assert.equal(
        functionReport.best.status,
        "known"
    );
    assert.equal(
        functionReport.worst.status,
        "unknown"
    );
    assert.equal(
        functionReport.worst
            .conclusion.notation,
        "No determinado"
    );
    assert.ok(
        functionReport.worst
            .reasons.length > 0
    );
});

test("expone el método y la seguridad de recurrencias avanzadas", () => {
    const service =
        new CompilationService();
    const mixed =
        new ComplexityReportBuilder()
            .build(
                service.analyzeSource([
                    "MIXTA(n)",
                    "    si n > 1",
                    "        MIXTA(n - 1)",
                    "        MIXTA(n / 2)"
                ].join("\n"))
            ).functions[0].worst;
    const quasiPolynomial =
        new ComplexityReportBuilder()
            .build(
                service.analyzeSource([
                    "CUASI(n)",
                    "    si n > 1",
                    "        para i = 1 hasta n",
                    "            CUASI(n / 2)",
                    "    retornar 0"
                ].join("\n"))
            ).functions[0].worst;

    assert.equal(
        mixed.confidence,
        "upper-bound"
    );
    assert.equal(
        mixed.recurrence.method,
        "mixed-reduction-upper-bound"
    );
    assert.equal(
        mixed.recurrence.tight,
        false
    );
    assert.equal(
        mixed.conclusion.kind,
        "upper-bound"
    );
    assert.equal(
        mixed.conclusion.notation,
        "O(2^n)"
    );
    assert.equal(
        quasiPolynomial
            .recurrence.method,
        "quasi-polynomial-product"
    );
    assert.match(
        quasiPolynomial
            .asymptotic.latex,
        /\\log_\{2\}/
    );
    assert.match(
        quasiPolynomial
            .conclusion.latex,
        /^\\mathcal\{O\}/
    );
});

test("presenta cada alcance asintótico sin fortalecer la conclusión", () => {
    const determined = {
        status: "determined",
        notation: "O(n)"
    };
    const tight =
        presentComplexityResult({
            analysis: determined,
            confidence: "exact"
        });
    const lower =
        presentComplexityResult({
            analysis: determined,
            confidence: "lower-bound"
        });
    const conditional =
        presentComplexityResult({
            analysis: {
                status: "conditional",
                notation: "O(n)"
            },
            confidence: "upper-bound"
        });
    const unknown =
        presentComplexityResult({
            analysis: {
                status: "unknown",
                notation: "O(?)"
            },
            confidence: "exact"
        });
    const unsupportedProof =
        presentComplexityResult({
            analysis: {
                status: "determined",
                notation: "O(n)",
                boundKind: "unknown"
            },
            confidence: "exact"
        });

    assert.equal(tight.notation, "Θ(n)");
    assert.equal(
        tight.sourceNotation,
        "O(n)"
    );
    assert.equal(lower.notation, "Ω(n)");
    assert.equal(
        conditional.kind,
        ComplexityResultKind
            .UPPER_BOUND
    );
    assert.equal(
        conditional.conditional,
        true
    );
    assert.equal(
        unknown.notation,
        "No determinado"
    );
    assert.equal(
        unknown.kind,
        ComplexityResultKind.UNKNOWN
    );
    assert.equal(tight.verified, true);
    assert.equal(
        tight.proofStatus,
        "verified"
    );
    assert.equal(
        unsupportedProof.kind,
        ComplexityResultKind.UNQUALIFIED
    );
    assert.equal(
        unsupportedProof.notation,
        "O(n)"
    );
    assert.equal(
        unsupportedProof.verified,
        false
    );
});

test("formatea logaritmos iterados como LaTeX anidado", () => {
    const report =
        new ComplexityReportBuilder()
            .build(
                new CompilationService()
                    .analyzeSource([
                        "RAIZ_RECURSIVA(n)",
                        "    si n > 1",
                        "        retornar RAIZ_RECURSIVA(RAIZ(n))",
                        "    retornar 0"
                    ].join("\n"))
            );
    const latex = report.functions[0]
        .worst.asymptotic.latex;

    assert.equal(
        latex.includes(
            "\\log\\left(\\log\\left(n\\right)\\right)"
        ),
        true
    );
    assert.equal(
        latex.includes("\\log(log)"),
        false
    );
});
