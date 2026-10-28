import test from "node:test";
import assert from "node:assert/strict";

import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("construye el grafo y ordena primero las dependencias", () => {
    const report = analyze([
        "BASE(n)",
        "    retornar n",
        "MEDIO(n)",
        "    retornar BASE(n)",
        "ENTRADA(n)",
        "    retornar MEDIO(n)"
    ]);
    const graph =
        report.functionCallGraph;

    assert.deepEqual(
        graph.vertices.map(
            vertex => vertex.name
        ),
        ["TBASE", "TMEDIO", "TENTRADA"]
    );
    assert.deepEqual(
        graph.edges.map(edge => [
            edge.caller,
            edge.callee
        ]),
        [
            ["TMEDIO", "TBASE"],
            ["TENTRADA", "TMEDIO"]
        ]
    );
    assert.deepEqual(
        graph.evaluationOrder
            .map(component =>
                component.names[0]
            ),
        ["TBASE", "TMEDIO", "TENTRADA"]
    );
    assert.equal(
        graph.recursiveComponents()
            .length,
        0
    );
});

test("resuelve recursión mutua con parámetros diferentes", () => {
    const report = analyze([
        "PAR(x)",
        "    si x > 0",
        "        retornar IMPAR(x - 1)",
        "    retornar VERDAD",
        "IMPAR(q)",
        "    si q > 0",
        "        retornar PAR(q - 1)",
        "    retornar FALSO"
    ]);
    const [even, odd] =
        report.statementsCost;
    const component =
        report.functionCallGraph
            .getComponent("TPAR");
    const resolution =
        report.functionCallGraph
            .getResolution(component);

    assert.deepEqual(
        component.names,
        ["TPAR", "TIMPAR"]
    );
    assert.equal(component.mutual, true);
    assert.equal(even.bigO, "O(n)");
    assert.equal(odd.bigO, "O(n)");
    assert.equal(even.bestBigO, "O(n)");
    assert.equal(odd.bestBigO, "O(n)");
    assert.equal(
        even.recurrenceAnalysis
            .method,
        "scc-substitution"
    );
    assert.equal(
        even.recurrenceAnalysis
            .measure.parameter,
        "x"
    );
    assert.equal(
        odd.recurrenceAnalysis
            .measure.parameter,
        "q"
    );
    assert.equal(resolution.status, "solved");
    assert.equal(resolution.notation, "O(n)");
});

test("resuelve ciclos de tres funciones", () => {
    const report = analyze([
        "PRIMERA(x)",
        "    si x > 0",
        "        retornar SEGUNDA(x - 1)",
        "    retornar 0",
        "SEGUNDA(q)",
        "    si q > 0",
        "        retornar TERCERA(q - 1)",
        "    retornar 0",
        "TERCERA(z)",
        "    si z > 0",
        "        retornar PRIMERA(z - 1)",
        "    retornar 0"
    ]);
    const component =
        report.functionCallGraph
            .getComponent("TPRIMERA");

    assert.equal(component.names.length, 3);
    assert.equal(component.internalEdges.length, 3);
    assert.deepEqual(
        report.statementsCost.map(
            node => node.bigO
        ),
        ["O(n)", "O(n)", "O(n)"]
    );
});

test("resuelve divisiones mutuas y propaga el argumento real", () => {
    const report = analyze([
        "DIVIDE(n)",
        "    si n > 1",
        "        retornar REDUCE(PISO(n / 2))",
        "    retornar 0",
        "REDUCE(m)",
        "    si m > 1",
        "        retornar DIVIDE(PISO(m / 2))",
        "    retornar 0",
        "USA(q)",
        "    retornar DIVIDE(q^2)"
    ]);
    const [divide, reduce, consumer] =
        report.statementsCost;
    const resolution =
        report.functionCallGraph
            .getResolution("TDIVIDE");

    assert.equal(divide.bigO, "O(log n)");
    assert.equal(reduce.bigO, "O(log n)");
    assert.equal(consumer.bigO, "O(log q)");
    assert.equal(
        resolution.method,
        "scc-master-theorem"
    );
    assert.equal(
        resolution.reductionKind,
        "division"
    );
});

test("propaga una recurrencia mutua lineal sobre un tamaño cuadrático", () => {
    const report = analyze([
        "PAR(n)",
        "    si n > 0",
        "        retornar IMPAR(n - 1)",
        "    retornar 0",
        "IMPAR(n)",
        "    si n > 0",
        "        retornar PAR(n - 1)",
        "    retornar 0",
        "USA(m)",
        "    retornar PAR(m^2)"
    ]);

    assert.equal(
        report.statementsCost[2].bigO,
        "O(m^2)"
    );
});

test("conserva O(?) cuando falta caso base o disminución", () => {
    const noBase = analyze([
        "PAR(n)",
        "    retornar IMPAR(n - 1)",
        "IMPAR(n)",
        "    retornar PAR(n - 1)"
    ]);
    const noReduction = analyze([
        "PAR(n)",
        "    si n > 0",
        "        retornar IMPAR(n)",
        "    retornar 0",
        "IMPAR(n)",
        "    si n > 0",
        "        retornar PAR(n)",
        "    retornar 0"
    ]);

    assertUnsupported(
        noBase,
        "CLRS_CALL_GRAPH_BASE_CASE_UNPROVEN"
    );
    assertUnsupported(
        noReduction,
        "CLRS_CALL_GRAPH_MEASURE_UNRESOLVED"
    );
});

test("resuelve reducciones mixtas y ramificación interna constante", () => {
    const mixed = analyze([
        "PRIMERA(n)",
        "    si n > 1",
        "        retornar SEGUNDA(n - 1)",
        "    retornar 0",
        "SEGUNDA(q)",
        "    si q > 1",
        "        retornar PRIMERA(PISO(q / 2))",
        "    retornar 0"
    ]);
    const branching = analyze([
        "PRIMERA(n)",
        "    si n > 1",
        "        retornar SEGUNDA(n - 1) + SEGUNDA(n - 1)",
        "    retornar 0",
        "SEGUNDA(q)",
        "    si q > 1",
        "        retornar PRIMERA(q - 1)",
        "    retornar 0"
    ]);

    const mixedResolution =
        mixed.functionCallGraph
            .getResolution("TPRIMERA");
    const branchingResolution =
        branching.functionCallGraph
            .getResolution("TPRIMERA");

    assert.deepEqual(
        mixed.statementsCost.map(
            node => node.bigO
        ),
        ["O(log n)", "O(log n)"]
    );
    assert.equal(
        mixedResolution.method,
        "scc-mixed-cycle"
    );
    assert.equal(
        mixedResolution.tight,
        true
    );
    assert.deepEqual(
        branching.statementsCost.map(
            node => node.bigO
        ),
        [
            "O(1.414214^n)",
            "O(1.414214^n)"
        ]
    );
    assert.equal(
        branchingResolution.method,
        "scc-characteristic-root"
    );
    assert.equal(
        branchingResolution.characteristic,
        1.414214
    );
});

test("admite funciones cuyo nombre fuente comienza con T", () => {
    const report = analyze([
        "TABLA(n)",
        "    retornar n",
        "USA(n)",
        "    retornar TABLA(n)"
    ]);
    const graph =
        report.functionCallGraph;

    assert.equal(
        graph.getVertex("TABLA").name,
        "TTABLA"
    );
    assert.equal(
        graph.outgoing("TUSA")[0]
            .callee,
        "TTABLA"
    );
});

test("publica el grafo sin alterar el contrato JSON", () => {
    const report = analyze([
        "PAR(n)",
        "    si n > 0",
        "        retornar IMPAR(n - 1)",
        "    retornar 0",
        "IMPAR(n)",
        "    si n > 0",
        "        retornar PAR(n - 1)",
        "    retornar 0"
    ]);

    assert.equal(
        Object.keys(report).includes(
            "functionCallGraph"
        ),
        false
    );
    assert.equal(
        Object.keys(
            report.statementsCost[0]
        ).includes(
            "functionCallComponent"
        ),
        false
    );
    assert.equal(
        JSON.stringify(report).includes(
            "functionCallGraph"
        ),
        false
    );
});

function assertUnsupported(
    report,
    code
) {
    const component =
        report.functionCallGraph
            .recursiveComponents()[0];
    const resolution =
        report.functionCallGraph
            .getResolution(component);

    assert.equal(
        report.statementsCost[0].bigO,
        "O(?)"
    );
    assert.equal(
        report.statementsCost[0]
            .recurrenceAnalysis.code,
        code
    );
    assert.equal(
        resolution.status,
        "unsupported"
    );
    assert.equal(resolution.code, code);
    assert.equal(
        report.unknownComplexityAnalysis
            .byCode(code).length > 0,
        true
    );
}

function analyze(lines) {
    return new CostAnalysisVisitor()
        .costAnalysis(
            parseSource(
                lines.join("\n")
            ).ast
        );
}
