import test from "node:test";
import assert from "node:assert/strict";

import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    RecurrenceBestStrategy,
    RecurrencePathScale
} from "../src/complex/recurrence/index.js";
import {
    ComplexityReportBuilder
} from "../src/complex/report/ComplexityReportBuilder.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("resuelve el mejor caso sobre la misma escala y no sobre el caso base", () => {
    const node = analyze([
        "LINEAL(n)",
        "    si n > 1",
        "        retornar LINEAL(n - 1)",
        "    retornar 0"
    ]).statementsCost[0];

    assert.equal(node.bestBigO, "O(n)");
    assert.equal(node.worstBigO, "O(n)");
    assert.equal(
        node.bestRecurrenceAnalysis.method,
        "substitution"
    );
    assert.equal(
        node.bestRecurrenceAnalysis.scenario,
        "best"
    );
    assert.equal(
        node.recurrenceAnalysis.scenario,
        "worst"
    );
    assert.equal(
        node.recurrenceScenarioProfile
            .best.strategy,
        RecurrenceBestStrategy
            .SAME_RECURRENCE
    );
    assert.equal(
        node.recurrenceScenarioProfile
            .measureWellFounded,
        true
    );
    assert.equal(
        node.recurrenceScenarioProfile
            .paths.some(path =>
                !path.recursive &&
                path.scale ===
                    RecurrencePathScale.BOUNDARY
            ),
        true
    );
});

test("una llamada repetida por un ciclo conserva el escenario factorial", () => {
    const node = analyze([
        "RAMIFICA(n)",
        "    si n > 1",
        "        para i = 1 hasta n",
        "            RAMIFICA(n - 1)",
        "    retornar 0"
    ]).statementsCost[0];

    assert.equal(node.bestBigO, "O(n!)");
    assert.equal(node.worstBigO, "O(n!)");
    assert.equal(
        node.recurrenceScenarioProfile
            .best.forcedAtScale,
        true
    );
});

test("mantiene desconocido el mejor caso cuando una entrada permite evitar la recursión", () => {
    const node = analyze([
        "OPCIONAL(n, detener)",
        "    si n > 1",
        "        si detener > 0",
        "            retornar 0",
        "        retornar OPCIONAL(n - 1, detener)",
        "    retornar 0"
    ]).statementsCost[0];

    assert.equal(node.worstBigO, "O(n)");
    assert.equal(node.bestBigO, "O(?)");
    assert.equal(
        node.recurrenceScenarioProfile
            .terminationProven,
        true
    );
    assert.equal(
        node.recurrenceScenarioProfile
            .best.strategy,
        RecurrenceBestStrategy.UNKNOWN
    );
    assert.equal(
        node.recurrenceScenarioProfile
            .best.unboundedBasePaths > 0,
        true
    );
});

test("distingue conjunción terminante de una disyunción que puede mantener la recursión", () => {
    const [conjunction, disjunction] = analyze([
        "CONJUNCION(n, activo)",
        "    si n > 0 y activo > 0",
        "        retornar CONJUNCION(n - 1, activo)",
        "    retornar 0",
        "DISYUNCION(n, activo)",
        "    si n > 0 o activo > 0",
        "        retornar DISYUNCION(n - 1, activo)",
        "    retornar 0"
    ]).statementsCost;

    assert.equal(conjunction.worstBigO, "O(n)");
    assert.equal(conjunction.bestBigO, "O(?)");
    assert.equal(
        conjunction.recurrenceScenarioProfile
            .terminationProven,
        true
    );
    assert.equal(
        conjunction.recurrenceScenarioProfile
            .best.unboundedBasePaths > 0,
        true
    );

    assert.equal(disjunction.worstBigO, "O(?)");
    assert.equal(
        disjunction.recurrenceAnalysis.code,
        "CLRS_RECURRENCE_GUARD_UNRELATED"
    );
    assert.equal(
        disjunction.recurrenceScenarioProfile
            .terminationProven,
        false
    );
});

test("una frontera exacta exige que el paso recursivo no pueda saltarla", () => {
    const [unit, jump, division] = analyze([
        "UNITARIA(n)",
        "    si n == 0",
        "        retornar 0",
        "    retornar UNITARIA(n - 1)",
        "SALTA(n)",
        "    si n == 0",
        "        retornar 0",
        "    retornar SALTA(n - 2)",
        "MITAD(n)",
        "    si n == 0",
        "        retornar 0",
        "    retornar MITAD(n / 2)"
    ]).statementsCost;

    assert.equal(unit.worstBigO, "O(n)");

    for (const node of [jump, division]) {
        assert.equal(node.worstBigO, "O(?)");
        assert.equal(
            node.recurrenceAnalysis.code,
            "CLRS_RECURRENCE_BASE_LATTICE_UNPROVEN"
        );
        assert.equal(
            node.recurrenceScenarioProfile
                .boundaryCompatible,
            false
        );
    }
});

test("resuelve por escenario una recursión mutua determinista", () => {
    const [even, odd] = analyze([
        "PAR(n)",
        "    si n > 0",
        "        retornar IMPAR(n - 1)",
        "    retornar VERDAD",
        "IMPAR(n)",
        "    si n > 0",
        "        retornar PAR(n - 1)",
        "    retornar FALSO"
    ]).statementsCost;

    assert.equal(even.bestBigO, "O(n)");
    assert.equal(odd.bestBigO, "O(n)");
    assert.equal(
        even.bestRecurrenceAnalysis.method,
        "scc-substitution"
    );
    assert.equal(
        odd.recurrenceScenarioProfile
            .terminationProven,
        true
    );
});

test("demuestra el descenso por ciclo aunque una arista mutua conserve la medida", () => {
    const [first, second] = analyze([
        "PRIMERA(n)",
        "    retornar SEGUNDA(n)",
        "SEGUNDA(n)",
        "    si n > 0",
        "        retornar PRIMERA(n - 1)",
        "    retornar 0"
    ]).statementsCost;

    for (const node of [first, second]) {
        assert.equal(node.bestBigO, "O(n)");
        assert.equal(node.worstBigO, "O(n)");
        assert.equal(
            node.recurrenceScenarioProfile
                .componentTerminationProven,
            true
        );
        assert.equal(
            node.bestRecurrenceAnalysis.method,
            "scc-substitution"
        );
    }
});

test("rechaza un ciclo mutuo compuesto sólo por transiciones neutras", () => {
    const [first, second] = analyze([
        "PRIMERA(n)",
        "    si n > 0",
        "        retornar SEGUNDA(n)",
        "    retornar 0",
        "SEGUNDA(n)",
        "    retornar PRIMERA(n)"
    ]).statementsCost;

    for (const node of [first, second]) {
        assert.equal(node.worstBigO, "O(?)");
        assert.equal(
            node.recurrenceAnalysis.code,
            "CLRS_CALL_GRAPH_MEASURE_UNRESOLVED"
        );
    }
});

test("rechaza una vuelta decreciente que puede evitar para siempre la guarda base", () => {
    const nodes = analyze([
        "ENTRADA(n, modo)",
        "    si n > 0",
        "        retornar PASO(n - 1, modo)",
        "    retornar 0",
        "PASO(n, modo)",
        "    retornar DESVIO(n - 1, modo)",
        "DESVIO(n, modo)",
        "    si modo > 0",
        "        retornar PASO(n - 1, modo)",
        "    retornar ENTRADA(n - 1, modo)"
    ]).statementsCost;

    for (const node of nodes) {
        assert.equal(node.worstBigO, "O(?)");
        assert.equal(
            node.recurrenceAnalysis.code,
            "CLRS_RECURRENCE_WELL_FOUNDEDNESS_UNPROVEN"
        );
    }
});

test("el informe publica la demostración de recurrencia del mejor caso", () => {
    const report = analyze([
        "BINARIA(n)",
        "    si n > 1",
        "        retornar BINARIA(n / 2)",
        "    retornar 0"
    ]);
    const view = new ComplexityReportBuilder()
        .build(report);
    const functionReport = view.functions[0];

    assert.equal(
        functionReport.best.asymptotic
            .notation,
        "O(log n)"
    );
    assert.equal(
        functionReport.best.recurrence.method,
        "master-theorem"
    );
    assert.equal(
        functionReport.worst.recurrence.method,
        "master-theorem"
    );
});

function analyze(lines) {
    const { ast } = parseSource(
        lines.join("\n")
    );

    return new CostAnalysisVisitor()
        .costAnalysis(ast);
}
