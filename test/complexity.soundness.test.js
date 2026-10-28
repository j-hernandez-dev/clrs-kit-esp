import test from "node:test";
import assert from "node:assert/strict";

import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    IterationAnalysisKind
} from "../src/complex/iteration/IterationAnalysis.js";
import {
    RecurrenceAnalysisStatus
} from "../src/complex/recurrence/RecurrenceAnalysis.js";
import {
    ComplexityReportBuilder
} from "../src/complex/report/ComplexityReportBuilder.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("retornar corta el flujo y elimina recurrencias de código muerto", () => {
    const { ast, report } = analyze([
        "CONSTANTE(n)",
        "    retornar 0",
        "    CONSTANTE(n - 1)"
    ]);
    const functionNode =
        report.statementsCost[0];
    const deadCall = ast.statements[0]
        .body.statements[1];

    assert.equal(
        report.controlFlowAnalysis
            .isReachable(deadCall),
        false
    );
    assert.equal(
        functionNode.instructions.length,
        1
    );
    assert.equal(functionNode.bigO, "O(1)");
    assert.equal(
        functionNode.recurrenceAnalysis,
        undefined
    );
});

test("el solver rechaza recurrencias sin caso base alcanzable", () => {
    for (const source of [
        [
            "DECREMENTA(n)",
            "    retornar DECREMENTA(n - 1)"
        ],
        [
            "DIVIDE(n)",
            "    retornar DIVIDE(n / 2)"
        ],
        [
            "RAIZ_RECURSIVA(n)",
            "    retornar RAIZ_RECURSIVA(RAIZ(n))"
        ]
    ]) {
        const node = analyze(source)
            .report.statementsCost[0];

        assert.equal(node.bigO, "O(?)");
        assert.equal(
            node.recurrenceAnalysis.status,
            RecurrenceAnalysisStatus
                .UNSUPPORTED
        );
        assert.equal(
            node.recurrenceAnalysis.code,
            "CLRS_RECURRENCE_BASE_CASE_UNPROVEN"
        );
        assert.equal(
            node.recurrenceAnalysis
                .soundness
                .terminationProven,
            false
        );
    }
});

test("una guarda ajena a la medida no demuestra la salida", () => {
    const node = analyze([
        "CONDICIONAL(n, activo)",
        "    si activo > 0",
        "        retornar CONDICIONAL(n - 1, activo)",
        "    retornar 0"
    ]).report.statementsCost[0];

    assert.equal(node.bigO, "O(?)");
    assert.equal(
        node.recurrenceAnalysis.code,
        "CLRS_RECURRENCE_GUARD_UNRELATED"
    );
});

test("el caso base se separa del mejor caso para entradas del mismo tamaño", () => {
    const node = analyze([
        "LINEAL(n)",
        "    si n > 1",
        "        retornar LINEAL(n - 1)",
        "    retornar 0"
    ]).report.statementsCost[0];

    assert.equal(node.worstBigO, "O(n)");
    assert.equal(node.bestBigO, "O(n)");
    assert.equal(
        node.bestRecurrenceAnalysis.method,
        "substitution"
    );
    assert.equal(
        node.recurrenceScenarioProfile
            .best.forcedAtScale,
        true
    );
});

test("una guarda inicialmente verdadera puede cambiar dentro del ciclo", () => {
    const { ast, report } = analyze([
        "DIEZ()",
        "    i = 0",
        "    mientras i < 10",
        "        i = i + 1"
    ]);
    const loop = ast.statements[0]
        .body.statements[1];
    const analysis =
        report.iterationAnalysis.get(loop);

    assert.notEqual(
        analysis.kind,
        IterationAnalysisKind.UNKNOWN
    );
    assert.equal(
        analysis.termination.guaranteed,
        true
    );
    assert.equal(
        report.statementsCost[0].bigO,
        "O(1)"
    );
});

test("los reconocedores especializados validan todas sus dependencias", () => {
    const overwritten = analyze([
        "BINARIA(n)",
        "    p = 0",
        "    r = n",
        "    mientras p <= r",
        "        q = PISO((p + r) / 2)",
        "        q = p",
        "        si q < r",
        "            p = q + 1",
        "        sino",
        "            r = q - 1"
    ]);
    const overwrittenLoop =
        overwritten.ast.statements[0]
            .body.statements[2];
    const overwrittenAnalysis =
        overwritten.report.iterationAnalysis
            .get(overwrittenLoop);

    assert.equal(
        overwrittenAnalysis.relational,
        null
    );

    const mutated = analyze([
        "NO_TERMINA(n)",
        "    i = 0",
        "    mientras i ^ 2 < n",
        "        i = i + 1",
        "        n = n ^ 2"
    ]);
    const mutatedLoop =
        mutated.ast.statements[0]
            .body.statements[1];
    const mutatedAnalysis =
        mutated.report.iterationAnalysis
            .get(mutatedLoop);

    assert.equal(
        mutatedAnalysis.kind,
        IterationAnalysisKind.UNKNOWN
    );
    assert.equal(
        mutatedAnalysis.code,
        "CLRS_ITERATION_BOUND_MUTATED"
    );
});

test("la normalización afín y la jerarquía de crecimiento evitan dominancias falsas", () => {
    const constantRange = analyze([
        "CERCA(n)",
        "    para i = n hasta n + 1",
        "        escribir i"
    ]).report.statementsCost[0];
    const mixed = analyze([
        "MEZCLA(n)",
        "    i = 2",
        "    mientras i < n",
        "        i = i ^ 2",
        "    para j = 0 hasta n - 1",
        "        escribir j"
    ]).report.statementsCost[0];

    assert.equal(constantRange.bigO, "O(1)");
    assert.equal(mixed.bigO, "O(n)");
});

test("las trayectorias sumadas y sus postestados producen órdenes demostrables", () => {
    const trajectory = analyze([
        "GEOMETRICO(n)",
        "    i = 1",
        "    mientras i < n",
        "        para j = 1 hasta i",
        "            escribir j",
        "        i = i * 2"
    ]).report.statementsCost[0];
    const postcondition = analyze([
        "DOS_FASES(n)",
        "    i = 1",
        "    mientras i < n",
        "        i = i * 2",
        "    mientras i > 1",
        "        i = i - 1"
    ]).report.statementsCost[0];

    assert.equal(trajectory.bigO, "O(n)");
    assert.equal(postcondition.bigO, "O(n)");
    assert.equal(
        postcondition.asymptoticAnalysis.code,
        null
    );
});

test("una recurrencia ajustada no fortalece una extracción sintáctica", () => {
    const { report } = analyze([
        "LINEAL(n)",
        "    si n > 1",
        "        retornar LINEAL(n - 1)",
        "    retornar 0"
    ]);
    const built =
        new ComplexityReportBuilder()
            .build(report);
    const worst = built.functions[0].worst;

    assert.equal(
        worst.recurrence.tight,
        true
    );
    assert.equal(
        worst.confidence,
        "upper-bound"
    );
    assert.equal(
        worst.conclusion.operator,
        "O"
    );
});

function analyze(lines) {
    const { ast } = parseSource(
        lines.join("\n")
    );
    const report = new CostAnalysisVisitor()
        .costAnalysis(ast);

    return { ast, report };
}
