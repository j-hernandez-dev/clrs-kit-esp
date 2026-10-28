import test from "node:test";
import assert from "node:assert/strict";

import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("resuelve un sistema aditivo mediante su raíz espectral", () => {
    const report = analyze([
        "PRIMERA(n)",
        "    si n > 1",
        "        retornar SEGUNDA(n - 1) + SEGUNDA(n - 1)",
        "    retornar 0",
        "SEGUNDA(q)",
        "    si q > 1",
        "        retornar PRIMERA(q - 1)",
        "    retornar 0"
    ]);
    const resolution = getResolution(report);
    const system = resolution.system;

    assert.deepEqual(
        report.statementsCost.map(
            node => node.bigO
        ),
        [
            "O(1.414214^n)",
            "O(1.414214^n)"
        ]
    );
    assert.equal(
        resolution.method,
        "scc-characteristic-root"
    );
    assert.equal(
        resolution.characteristic,
        1.414214
    );
    assert.equal(system.kind, "recurrence-system");
    assert.equal(system.reductionKind, "decrement");
    assert.equal(system.equations.length, 2);
    assert.equal(
        system.equations[0]
            .transitionTerms[0]
            .coefficient,
        2
    );
    assert.equal(
        system.equations[1]
            .transitionTerms[0]
            .coefficient,
        1
    );
    assert.equal(Object.isFrozen(system), true);
});

test("resuelve un sistema divisivo mediante su exponente espectral", () => {
    const report = analyze([
        "DIVIDE(n)",
        "    si n > 1",
        "        retornar REDUCE(PISO(n / 2)) + REDUCE(PISO(n / 2))",
        "    retornar 0",
        "REDUCE(q)",
        "    si q > 1",
        "        retornar DIVIDE(PISO(q / 2))",
        "    retornar 0"
    ]);
    const resolution = getResolution(report);

    assert.deepEqual(
        report.statementsCost.map(
            node => node.bigO
        ),
        ["O(n^0.5)", "O(n^0.5)"]
    );
    assert.equal(
        resolution.method,
        "scc-akra-bazzi-system"
    );
    assert.equal(resolution.characteristic, 0.5);
    assert.equal(resolution.tight, true);
});

test("permite que el costo local domine al exponente divisivo", () => {
    const report = analyze([
        "DIVIDE(n)",
        "    si n > 1",
        "        para i = 0 hasta n - 1",
        "            escribir i",
        "        retornar REDUCE(PISO(n / 2)) + REDUCE(PISO(n / 2))",
        "    retornar 0",
        "REDUCE(q)",
        "    si q > 1",
        "        retornar DIVIDE(PISO(q / 2))",
        "    retornar 0"
    ]);

    assert.deepEqual(
        report.statementsCost.map(
            node => node.bigO
        ),
        ["O(n)", "O(n)"]
    );
});

test("compone exactamente un ciclo con reducciones mixtas", () => {
    const report = analyze([
        "PRIMERA(n)",
        "    si n > 1",
        "        retornar SEGUNDA(n - 1)",
        "    retornar 0",
        "SEGUNDA(q)",
        "    si q > 1",
        "        retornar PRIMERA(PISO(q / 2))",
        "    retornar 0"
    ]);
    const resolution = getResolution(report);

    assert.deepEqual(
        report.statementsCost.map(
            node => node.bigO
        ),
        ["O(log n)", "O(log n)"]
    );
    assert.equal(resolution.method, "scc-mixed-cycle");
    assert.equal(resolution.boundKind, "tight");
    assert.equal(resolution.tight, true);
});

test("marca como cota superior una reducción mixta ramificada", () => {
    const report = analyze([
        "PRIMERA(n)",
        "    si n > 1",
        "        retornar SEGUNDA(n - 1) + SEGUNDA(PISO(n / 2))",
        "    retornar 0",
        "SEGUNDA(q)",
        "    si q > 1",
        "        retornar PRIMERA(q - 1)",
        "    retornar 0"
    ]);
    const resolution = getResolution(report);

    assert.deepEqual(
        report.statementsCost.map(
            node => node.bigO
        ),
        [
            "O(1.414214^n)",
            "O(1.414214^n)"
        ]
    );
    assert.equal(
        resolution.method,
        "scc-mixed-upper-bound"
    );
    assert.equal(resolution.boundKind, "upper");
    assert.equal(resolution.tight, false);
});

test("conserva O(?) para coeficientes variables del sistema", () => {
    const report = analyze([
        "PRIMERA(n)",
        "    si n > 1",
        "        para i = 1 hasta n",
        "            SEGUNDA(n - 1)",
        "    retornar 0",
        "SEGUNDA(q)",
        "    si q > 1",
        "        retornar PRIMERA(q - 1)",
        "    retornar 0"
    ]);
    const resolution = getResolution(report);

    assert.deepEqual(
        report.statementsCost.map(
            node => node.bigO
        ),
        ["O(?)", "O(?)"]
    );
    assert.equal(
        resolution.code,
        "CLRS_RECURRENCE_SYSTEM_COEFFICIENT_UNSUPPORTED"
    );
    assert.equal(
        report.unknownComplexityAnalysis
            .byCode(resolution.code)
            .length > 0,
        true
    );
});

test("mantiene el sistema fuera del contrato JSON histórico", () => {
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
        JSON.stringify(report).includes(
            "recurrence-system"
        ),
        false
    );
});

function getResolution(report) {
    return report.functionCallGraph
        .getResolution("TPRIMERA") ??
        report.functionCallGraph
            .getResolution("TDIVIDE") ??
        report.functionCallGraph
            .getResolution("TPAR");
}

function analyze(lines) {
    return new CostAnalysisVisitor()
        .costAnalysis(
            parseSource(
                lines.join("\n")
            ).ast
        );
}
