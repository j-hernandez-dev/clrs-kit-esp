import test from "node:test";
import assert from "node:assert/strict";

import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    formatCostExpression
} from "../src/complex/algebra/CostExpressionFormatter.js";
import {
    ComplexityReportBuilder
} from "../src/complex/report/ComplexityReportBuilder.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("conserva la cadena de sustituciones entre funciones", () => {
    const costReport = analyze([
        "RECORRE(x)",
        "    para i = 0 hasta x - 1",
        "        escribir i",
        "AUXILIAR(q)",
        "    RECORRE(q^2)",
        "USA(A)",
        "    AUXILIAR(LONG(A))"
    ]);
    const provenance =
        costReport.interproceduralProvenance;
    const [root] = provenance.traceFor(
        "USA",
        "worst"
    );
    const auxiliary = root.children[0];
    const linear = auxiliary.children[0];

    assert.equal(root.callee, "TUSA");
    assert.equal(root.status, "resolved");
    assert.equal(auxiliary.caller, "TUSA");
    assert.equal(auxiliary.callee, "TAUXILIAR");
    assert.equal(
        formatCostExpression(
            auxiliary.bindings[0].expression
        ),
        "LONG(A)"
    );
    assert.equal(linear.caller, "TAUXILIAR");
    assert.equal(linear.callee, "TRECORRE");
    assert.equal(
        formatCostExpression(
            linear.bindings[0].expression
        ),
        "LONG(A)^2"
    );
    assert.equal(linear.notation, "O(n^2)");
    assert.equal(
        Object.keys(costReport).includes(
            "interproceduralProvenance"
        ),
        false
    );
});

test("conserva el motivo y el parámetro ausente al propagar una llamada inválida", () => {
    const costReport = analyze([
        "RECORRE(n)",
        "    para i = 0 hasta n - 1",
        "        escribir i",
        "USA()",
        "    RECORRE()"
    ]);
    const [root] = costReport
        .interproceduralProvenance
        .traceFor("TUSA", "worst");
    const call = root.children[0];

    assert.equal(call.kind, "invalid-arguments");
    assert.equal(call.status, "unknown");
    assert.equal(
        call.code,
        "CLRS_ASYMPTOTIC_CALL_ARGUMENT_MISSING"
    );
    assert.deepEqual(call.missing, ["n"]);
});

test("serializa una vista legible de la proveniencia sólo cuando hay llamadas internas", () => {
    const report = new ComplexityReportBuilder()
        .build(analyze([
            "RECORRE(x)",
            "    para i = 0 hasta x - 1",
            "        escribir i",
            "USA(A)",
            "    RECORRE(LONG(A))",
            "LOCAL(n)",
            "    escribir n"
        ]));
    const usa = report.functions.find(
        item => item.name === "USA"
    );
    const local = report.functions.find(
        item => item.name === "LOCAL"
    );
    const trace = usa.worst.interprocedural;

    assert.equal(trace.title, "Propagación entre funciones");
    assert.equal(trace.traces[0].functionName, "USA");
    assert.equal(
        trace.traces[0].children[0].functionName,
        "RECORRE"
    );
    assert.equal(
        trace.traces[0].children[0]
            .bindings[0].argument.text,
        "LONG(A)"
    );
    assert.deepEqual(
        trace.traces[0].children[0]
            .transfer.requiredParameters,
        ["x"]
    );
    assert.deepEqual(
        trace.traces[0].children[0]
            .transfer.replacements.map(
                item => item.notation
            ),
        ["O(n)"]
    );
    assert.equal(local.worst.interprocedural, null);
    assert.equal(
        JSON.stringify(trace).includes(
            "CLRS_ASYMPTOTIC_CALL_ARGUMENT_MISSING"
        ),
        false
    );
});

function analyze(lines) {
    return new CostAnalysisVisitor()
        .costAnalysis(
            parseSource(
                lines.join("\n")
            ).ast
        );
}
