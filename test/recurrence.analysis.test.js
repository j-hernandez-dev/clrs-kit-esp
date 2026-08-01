import test from "node:test";
import assert from "node:assert/strict";

import {
    RecurrenceAnalysisStatus
} from "../src/complex/recurrence/RecurrenceAnalysis.js";
import {
    CostExpressionKind
} from "../src/complex/algebra/CostExpression.js";
import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("resuelve recurrencias aditivas mediante sustitución", () => {
    const linear =
        analyzeFunction([
            "LINEAL(n)",
            "    si n > 1",
            "        retornar LINEAL(n - 1)",
            "    retornar 0"
        ]);
    const quadratic =
        analyzeFunction([
            "CUADRATICA(n)",
            "    si n > 1",
            "        para i <- 0 hasta n - 1",
            "            escribir i",
            "        retornar CUADRATICA(n - 1)",
            "    retornar 0"
        ]);

    assertSolved(
        linear,
        "O(n)",
        "substitution"
    );
    assert.equal(
        linear.costExpression.kind,
        CostExpressionKind.RECURRENCE
    );
    assertSolved(
        quadratic,
        "O(n^2)",
        "substitution"
    );
});

test("aplica el teorema maestro a recurrencias divide y vencerás", () => {
    const binary =
        analyzeFunction([
            "BINARIA(n)",
            "    si n > 1",
            "        retornar BINARIA(n / 2)",
            "    retornar 0"
        ]);
    const merge =
        analyzeFunction([
            "MEZCLA(n)",
            "    si n > 1",
            "        para i <- 0 hasta n - 1",
            "            escribir i",
            "        MEZCLA(n / 2)",
            "        MEZCLA(n / 2)"
        ]);
    const threeBranches =
        analyzeFunction([
            "TRES(n)",
            "    si n > 1",
            "        TRES(n / 2)",
            "        TRES(n / 2)",
            "        TRES(n / 2)"
        ]);

    assertSolved(
        binary,
        "O(log n)",
        "master-theorem"
    );
    assertSolved(
        merge,
        "O(n log n)",
        "master-theorem"
    );
    assertSolved(
        threeBranches,
        "O(n^1.584963)",
        "master-theorem"
    );
});

test("infiere el tamaño de subarreglos mediante límites simbólicos", () => {
    const mergeSort =
        analyzeFunction([
            "MERGE_SORT(A, p, r)",
            "    si p < r",
            "        q <- PISO((p + r) / 2)",
            "        MERGE_SORT(A, p, q)",
            "        MERGE_SORT(A, q + 1, r)",
            "        para i <- p hasta r",
            "            escribir A[i]"
        ]);
    const measure =
        mergeSort
            .recurrenceAnalysis
            .measure;

    assertSolved(
        mergeSort,
        "O(n log n)",
        "master-theorem"
    );
    assert.equal(
        measure.kind,
        "interval"
    );
    assert.equal(
        measure.lower,
        "p"
    );
    assert.equal(
        measure.upper,
        "r"
    );
});

test("resuelve particiones desiguales y ramificación aditiva", () => {
    const unequal =
        analyzeFunction([
            "PARTICION(n)",
            "    si n > 1",
            "        PARTICION(n / 3)",
            "        PARTICION((2 * n) / 3)",
            "        para i <- 0 hasta n - 1",
            "            escribir i"
        ]);
    const fibonacci =
        analyzeFunction([
            "FIBONACCI(n)",
            "    si n > 1",
            "        retornar FIBONACCI(n - 1) + FIBONACCI(n - 2)",
            "    retornar n"
        ]);
    const binaryTree =
        analyzeFunction([
            "ARBOL(n)",
            "    si n > 1",
            "        ARBOL(n - 1)",
            "        ARBOL(n - 1)"
        ]);

    assertSolved(
        unequal,
        "O(n log n)",
        "akra-bazzi"
    );
    assertSolved(
        fibonacci,
        "O(1.618034^n)",
        "characteristic-root"
    );
    assertSolved(
        binaryTree,
        "O(2^n)",
        "characteristic-root"
    );
});

test("reconoce ramificación variable con crecimiento factorial", () => {
    const factorial =
        analyzeFunction([
            "RAMIFICA(n)",
            "    si n > 1",
            "        para i <- 1 hasta n",
            "            RAMIFICA(n - 1)",
            "    retornar 0"
        ]);

    assert.equal(
        factorial.bigO,
        "O(n!)"
    );
    assert.equal(
        factorial
            .recurrenceAnalysis
            .status,
        RecurrenceAnalysisStatus
            .SOLVED
    );
});

test("mantiene O(?) cuando no puede demostrar una reducción", () => {
    const unchanged =
        analyzeFunction([
            "SIN_REDUCCION(n)",
            "    retornar SIN_REDUCCION(n)"
        ]);
    const variableNonUnit =
        analyzeFunction([
            "SALTO_VARIABLE(n)",
            "    si n > 2",
            "        para i <- 1 hasta n",
            "            SALTO_VARIABLE(n - 2)",
            "    retornar 0"
        ]);
    const report =
        analyzeSource([
            "A(n)",
            "    retornar B(n - 1)",
            "B(n)",
            "    retornar A(n - 1)"
        ]);

    assert.equal(
        unchanged.bigO,
        "O(?)"
    );
    assert.equal(
        unchanged
            .recurrenceAnalysis
            .status,
        RecurrenceAnalysisStatus
            .UNSUPPORTED
    );
    assert.equal(
        unchanged
            .recurrenceAnalysis
            .code,
        "CLRS_RECURRENCE_ARGUMENT_UNSUPPORTED"
    );
    assert.equal(
        variableNonUnit.bigO,
        "O(?)"
    );
    assert.equal(
        variableNonUnit
            .recurrenceAnalysis
            .code,
        "CLRS_RECURRENCE_VARIABLE_BRANCHING"
    );

    for (
        const functionNode
        of report.statementsCost
    ) {
        assert.equal(
            functionNode.bigO,
            "O(?)"
        );
        assert.equal(
            functionNode
                .asymptoticAnalysis
                .code,
            "CLRS_ASYMPTOTIC_RECURRENCE_UNRESOLVED"
        );
    }
});

test("publica análisis consultable sin alterar el contrato JSON", () => {
    const report =
        analyzeSource([
            "MITAD(n)",
            "    si n > 1",
            "        retornar MITAD(n / 2)",
            "    retornar 0"
        ]);
    const functionNode =
        report.statementsCost[0];
    const analysis =
        report.recurrenceAnalysis
            .get(functionNode);

    assert.equal(
        analysis,
        functionNode
            .recurrenceAnalysis
    );
    assert.equal(
        analysis.notation,
        "O(log n)"
    );
    assert.equal(
        Object.keys(functionNode)
            .includes(
                "recurrenceAnalysis"
            ),
        false
    );
    assert.equal(
        Object.keys(report)
            .includes(
                "recurrenceAnalysis"
            ),
        false
    );
    assert.equal(
        JSON.stringify(report)
            .includes(
                "recurrenceAnalysis"
            ),
        false
    );
});

function assertSolved(
    node,
    notation,
    method
) {
    assert.equal(
        node.bigO,
        notation
    );
    assert.equal(
        node
            .recurrenceAnalysis
            .status,
        RecurrenceAnalysisStatus
            .SOLVED
    );
    assert.equal(
        node
            .recurrenceAnalysis
            .method,
        method
    );
}

function analyzeFunction(lines) {
    return analyzeSource(lines)
        .statementsCost[0];
}

function analyzeSource(lines) {
    const { ast } =
        parseSource(
            lines.join("\n")
        );

    return new CostAnalysisVisitor()
        .costAnalysis(ast);
}
