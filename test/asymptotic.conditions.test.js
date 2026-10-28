import test from "node:test";
import assert from "node:assert/strict";

import {
    CostExpressionFactory as Cost
} from "../src/complex/algebra/CostExpressionFactory.js";
import {
    AsymptoticAnalysisStatus,
    createAsymptoticAnalysis
} from "../src/complex/asymptotic/AsymptoticAnalysis.js";
import {
    AsymptoticConditionKind,
    analyzeAsymptoticConditions,
    createAsymptoticCondition
} from "../src/complex/asymptotic/AsymptoticCondition.js";
import {
    AsymptoticClassifier
} from "../src/complex/asymptotic/AsymptoticClassifier.js";
import {
    CompilationService
} from "../src/compiler/services/CompilationService.js";
import {
    ComplexityReportBuilder
} from "../src/complex/report/ComplexityReportBuilder.js";

const N = Cost.symbol("n");

test("conserva órdenes demostrables bajo condiciones asintóticas", () => {
    const expression =
        Cost.logarithm(N);
    const analysis =
        analyzeConditioned(expression);

    assert.equal(
        analysis.notation,
        "O(log n)"
    );
    assert.equal(
        analysis.status,
        AsymptoticAnalysisStatus
            .CONDITIONAL
    );
    assert.deepEqual(
        analysis.assumptions,
        ["n > 1"]
    );
    assert.equal(
        analysis.code,
        null
    );
});

test("descarga condiciones explícitas y hechos constantes", () => {
    const explicit =
        createAsymptoticCondition(
            AsymptoticConditionKind
                .GREATER_THAN_ONE,
            N
        );
    const fromContext =
        analyzeConditioned(
            Cost.logarithm(N),
            {
                asymptoticConditions: [explicit]
            }
        );
    const constant =
        analyzeConditioned(
            Cost.logarithm(
                Cost.constant(8)
            )
        );

    assert.equal(
        fromContext.status,
        AsymptoticAnalysisStatus
            .DETERMINED
    );
    assert.deepEqual(
        fromContext.assumptions,
        []
    );
    assert.equal(
        constant.status,
        AsymptoticAnalysisStatus
            .DETERMINED
    );
});

test("preserva cocientes y potencias inversas como órdenes condicionados", () => {
    const quotient =
        analyzeConditioned(
            Cost.quotient(
                N,
                Cost.symbol("m")
            )
        );
    const inverse =
        analyzeConditioned(
            Cost.power(
                N,
                Cost.constant(-1)
            )
        );

    assert.equal(
        quotient.notation,
        "O(n m^-1)"
    );
    assert.deepEqual(
        quotient.assumptions,
        ["m != 0"]
    );
    assert.equal(
        inverse.notation,
        "O(n^-1)"
    );
    assert.deepEqual(
        inverse.assumptions,
        ["n != 0"]
    );
});

test("el informe muestra órdenes condicionados sin convertirlos en O(?)", () => {
    const costReport =
        new CompilationService()
            .analyzeSource([
                "LOGARITMICA(n)",
                "    i = n",
                "    mientras i > 1",
                "        i = PISO(i / 2)"
            ].join("\n"));
    const report =
        new ComplexityReportBuilder()
            .build(costReport);
    const functionReport =
        report.functions[0];

    assert.equal(
        report.status,
        "conditional"
    );
    assert.equal(
        functionReport.status,
        "conditional"
    );
    assert.equal(
        functionReport.worst.status,
        "conditional"
    );
    assert.equal(
        functionReport.worst.asymptotic.notation,
        "O(log n)"
    );
    assert.deepEqual(
        functionReport.worst.asymptotic.conditions,
        ["n > 1"]
    );
    assert.deepEqual(
        functionReport.worst.reasons,
        []
    );
});

function analyzeConditioned(expression, context = {}) {
    const classifier =
        new AsymptoticClassifier();
    const conditions =
        analyzeAsymptoticConditions(
            expression,
            context
        );

    return createAsymptoticAnalysis(
        classifier.classify(
            expression,
            context
        ),
        null,
        {
            conditions:
                conditions.conditions
        }
    );
}
