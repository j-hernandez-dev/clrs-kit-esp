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
            "        para i = 0 hasta n - 1",
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
            "        para i = 0 hasta n - 1",
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
            "        q = PISO((p + r) / 2)",
            "        MERGE_SORT(A, p, q)",
            "        MERGE_SORT(A, q + 1, r)",
            "        para i = p hasta r",
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
            "        para i = 0 hasta n - 1",
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
            "        para i = 1 hasta n",
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
    assert.equal(
        factorial
            .recurrenceAnalysis
            .method,
        "factorial-product"
    );
});

test("mantiene O(?) cuando no puede demostrar una reducción", () => {
    const unchanged =
        analyzeFunction([
            "SIN_REDUCCION(n)",
            "    retornar SIN_REDUCCION(n)"
        ]);
    const independentBranching =
        analyzeFunction([
            "DOS_MEDIDAS(n, m)",
            "    si n > 1",
            "        para i = 1 hasta m",
            "            DOS_MEDIDAS(n - 1, m)",
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
        "CLRS_RECURRENCE_BASE_CASE_UNPROVEN"
    );
    assert.equal(
        independentBranching.bigO,
        "O(?)"
    );
    assert.equal(
        independentBranching
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

test("resuelve productos factoriales con decrementos no unitarios", () => {
    const generalized =
        analyzeFunction([
            "SALTO_VARIABLE(n)",
            "    si n > 2",
            "        para i = 1 hasta n",
            "            SALTO_VARIABLE(n - 2)",
            "    retornar 0"
        ]);
    const analysis =
        generalized.recurrenceAnalysis;

    assertSolved(
        generalized,
        "O(n^0.25 (n!)^0.5)",
        "generalized-factorial-product"
    );
    assert.equal(
        analysis.boundKind,
        "tight"
    );
    assert.deepEqual(
        analysis.characteristic,
        {
            kind: "factorial-product",
            decrement: 2,
            degree: 1,
            multiplier: 1
        }
    );
    assert.equal(
        analysis.evidence.length,
        2
    );
});

test("resuelve ramificación variable divisiva como crecimiento cuasipolinomial", () => {
    const report =
        analyzeSource([
            "CUASIPOLINOMIAL(n)",
            "    si n > 1",
            "        para i = 1 hasta n",
            "            CUASIPOLINOMIAL(n / 2)",
            "    retornar 0",
            "PROPAGA(m)",
            "    CUASIPOLINOMIAL(m)"
        ]);
    const [recursive, caller] =
        report.statementsCost;

    assertSolved(
        recursive,
        "O(n^(0.5 log_2 n + 0.5))",
        "quasi-polynomial-product"
    );
    assert.equal(
        recursive
            .recurrenceAnalysis
            .tight,
        true
    );
    assert.deepEqual(
        recursive
            .recurrenceAnalysis
            .characteristic,
        {
            kind: "quasi-polynomial",
            ratio: 0.5,
            degree: 1,
            multiplier: 1
        }
    );
    assert.equal(
        caller.bigO,
        "O(m^(0.5 log_2 m + 0.5))"
    );
});

test("resuelve reducciones recursivas por potencia y propaga log log", () => {
    const report = analyzeSource([
        "RAIZ_RECURSIVA(n)",
        "    si n > 1",
        "        retornar RAIZ_RECURSIVA(RAIZ(n))",
        "    retornar 0",
        "DOBLE_RAIZ(n)",
        "    si n > 1",
        "        retornar DOBLE_RAIZ(RAIZ(n)) + DOBLE_RAIZ(RAIZ(n))",
        "    retornar 0",
        "POTENCIA_EXPLICITA(n)",
        "    si n > 1",
        "        retornar POTENCIA_EXPLICITA(n ^ 0.5)",
        "    retornar 0",
        "PROPAGA(m)",
        "    retornar RAIZ_RECURSIVA(m)"
    ]);
    const [
        root,
        doubled,
        explicit,
        caller
    ] = report.statementsCost;

    assertSolved(
        root,
        "O(log log n)",
        "power-reduction"
    );
    assert.equal(
        root.recurrenceAnalysis.measure.parameter,
        "n"
    );
    assert.deepEqual(
        root.recurrenceAnalysis.characteristic,
        {
            kind: "power-reduction",
            exponent: 0.5,
            branches: 1,
            transformedExponent: 0
        }
    );
    assertSolved(
        doubled,
        "O(log n)",
        "power-reduction"
    );
    assertSolved(
        explicit,
        "O(log log n)",
        "power-reduction"
    );
    assert.equal(caller.bigO, "O(log log m)");
});

test("acota recurrencias con reducciones mixtas", () => {
    const mixed =
        analyzeFunction([
            "MIXTA(n)",
            "    si n > 1",
            "        MIXTA(n - 1)",
            "        MIXTA(n / 2)"
        ]);
    const analysis =
        mixed.recurrenceAnalysis;

    assertSolved(
        mixed,
        "O(2^n)",
        "mixed-reduction-upper-bound"
    );
    assert.equal(
        analysis.boundKind,
        "upper"
    );
    assert.equal(analysis.tight, false);
    assert.equal(
        analysis.evidence.length,
        2
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
