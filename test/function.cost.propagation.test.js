import test from "node:test";
import assert from "node:assert/strict";

import {
    CostExpressionFactory as Cost
} from "../src/complex/algebra/CostExpressionFactory.js";
import {
    formatCostExpression
} from "../src/complex/algebra/CostExpressionFormatter.js";
import {
    createCostParameterSubstitution,
    instantiateCostParameters,
    substituteCostExpression
} from "../src/complex/algebra/CostExpressionSubstitution.js";
import {
    attachRecurrenceCallMetadata,
    getRecurrenceCallMetadata
} from "../src/complex/recurrence/RecurrenceCallMetadata.js";
import {
    instantiateFunctionCostSummary
} from "../src/complex/function-summary/index.js";
import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("la sustitución de parámetros es simultánea y evita capturas", () => {
    const expression =
        Cost.sum([
            Cost.symbol("a"),
            Cost.symbol("b")
        ]);
    const instantiation =
        instantiateCostParameters(
            expression,
            ["a", "b"],
            [
                Cost.symbol("b"),
                Cost.symbol("n")
            ]
        );

    assert.equal(instantiation.complete, true);
    assert.equal(
        formatCostExpression(
            instantiation.expression
        ),
        "b + n"
    );
    assert.equal(
        formatCostExpression(
            substituteCostExpression(
                Cost.symbol("a"),
                instantiation.bindings
            )
        ),
        "b"
    );
});

test("la sustitución distingue argumentos faltantes, adicionales y parámetros inválidos", () => {
    const missing =
        createCostParameterSubstitution(
            ["a", "b"],
            [Cost.symbol("n")]
        );
    const extra =
        createCostParameterSubstitution(
            ["a"],
            [
                Cost.symbol("n"),
                Cost.symbol("m")
            ]
        );
    const duplicate =
        createCostParameterSubstitution(
            ["a", "a"],
            [
                Cost.symbol("n"),
                Cost.symbol("m")
            ]
        );
    const partial =
        createCostParameterSubstitution(
            ["a", "b"],
            [Cost.symbol("n")],
            {
                allowMissing: true
            }
        );

    assert.equal(missing.complete, false);
    assert.equal(
        missing.code,
        "CLRS_ASYMPTOTIC_CALL_ARGUMENT_MISSING"
    );
    assert.deepEqual(missing.missing, ["b"]);
    assert.equal(extra.complete, true);
    assert.equal(extra.extraArguments.length, 1);
    assert.equal(duplicate.complete, false);
    assert.equal(
        duplicate.code,
        "CLRS_ASYMPTOTIC_CALL_PARAMETERS_INVALID"
    );
    assert.equal(partial.complete, true);
    assert.equal(partial.partial, true);
    assert.equal(partial.code, null);
    assert.deepEqual(partial.missing, ["b"]);
});

test("la sustitución conserva metadatos de llamadas recursivas", () => {
    const metadata =
        Object.freeze({
            relation:
                Object.freeze({
                    kind: "decrement",
                    amount: 1
                })
        });
    const call =
        Cost.call(
            "TF",
            [Cost.symbol("n")]
        );

    attachRecurrenceCallMetadata(
        call,
        metadata
    );

    const substituted =
        substituteCostExpression(
            call,
            {
                n:
                    Cost.symbol("m")
            }
        );

    assert.equal(
        getRecurrenceCallMetadata(
            substituted
        ),
        metadata
    );
});

test("propaga argumentos reales a través de varias funciones", () => {
    const report = analyze([
        "RECORRE(x)",
        "    para i = 0 hasta x - 1",
        "        escribir i",
        "AUXILIAR(q)",
        "    RECORRE(q^2)",
        "USA(A)",
        "    AUXILIAR(LONG(A))"
    ]);
    const [recorre, auxiliar, usa] =
        report.statementsCost;

    assert.equal(recorre.bigO, "O(x)");
    assert.equal(auxiliar.bigO, "O(q^2)");
    assert.equal(usa.bigO, "O(n^2)");
    assert.equal(usa.bestBigO, "O(n^2)");
    assert.equal(usa.worstBigO, "O(n^2)");
});

test("la propagación simultánea conserva el binding del argumento", () => {
    const report = analyze([
        "RECORRE(x)",
        "    para i = 0 hasta x - 1",
        "        escribir i",
        "CAMBIA(a, b)",
        "    RECORRE(a)",
        "USA(n, b)",
        "    CAMBIA(b, n)"
    ]);
    const consumer =
        report.statementsCost[2];

    assert.equal(consumer.bigO, "O(b)");
    assert.equal(consumer.bestBigO, "O(b)");
});

test("las llamadas flexibles toleran extras y explican argumentos faltantes", () => {
    const report = analyze([
        "RECORRE(n)",
        "    para i = 0 hasta n - 1",
        "        escribir i",
        "CON_EXTRA(n)",
        "    RECORRE(n, n^2)",
        "SIN_ARGUMENTO()",
        "    RECORRE()"
    ]);
    const extra =
        report.statementsCost[1];
    const missing =
        report.statementsCost[2];

    assert.equal(extra.bigO, "O(n)");
    assert.equal(missing.bigO, "O(?)");
    assert.equal(
        missing.asymptoticAnalysis.code,
        "CLRS_ASYMPTOTIC_CALL_ARGUMENT_MISSING"
    );
    assert.equal(
        report.unknownComplexityAnalysis
            .byCode(
                "CLRS_ASYMPTOTIC_CALL_ARGUMENT_MISSING"
            ).length > 0,
        true
    );
});

test("compone recurrencias con tamaños reales escalares y especiales", () => {
    const report = analyze([
        "LINEAL(n)",
        "    si n > 1",
        "        retornar LINEAL(n - 1)",
        "    retornar 0",
        "FIBONACCI(n)",
        "    si n > 1",
        "        retornar FIBONACCI(n - 1) + FIBONACCI(n - 2)",
        "    retornar n",
        "USA(m)",
        "    LINEAL(m^2)",
        "    FIBONACCI(m^2)"
    ]);
    const linear =
        report.statementsCost[0];
    const fibonacci =
        report.statementsCost[1];
    const consumer =
        report.statementsCost[2];

    assert.equal(linear.bestBigO, "O(n)");
    assert.equal(linear.worstBigO, "O(n)");
    assert.equal(
        fibonacci.bestBigO,
        "O(1.618034^n)"
    );
    assert.equal(
        fibonacci.worstBigO,
        "O(1.618034^n)"
    );
    assert.equal(
        consumer.bigO,
        "O(1.618034^(m^2))"
    );
    assert.equal(
        consumer.bestBigO,
        "O(1.618034^(m^2))"
    );
});

test("compone la medida de intervalo de una recurrencia", () => {
    const report = analyze([
        "MERGE_SORT(A, p, r)",
        "    si p < r",
        "        q = PISO((p + r) / 2)",
        "        MERGE_SORT(A, p, q)",
        "        MERGE_SORT(A, q + 1, r)",
        "        para i = p hasta r",
        "            escribir A[i]",
        "USA(A)",
        "    MERGE_SORT(A, 0, LONG(A) - 1)"
    ]);

    assert.equal(
        report.statementsCost[1].bigO,
        "O(n log n)"
    );
    assert.equal(
        report.statementsCost[1]
            .bestBigO,
        "O(n log n)"
    );
});

test("compone órdenes cuasipolinomiales con medidas polinómicas", () => {
    const report = analyze([
        "CUASI(n)",
        "    si n > 1",
        "        para i = 1 hasta n",
        "            CUASI(n / 2)",
        "    retornar 0",
        "USA(m)",
        "    CUASI(m^2)"
    ]);

    assert.equal(
        report.statementsCost[0].bigO,
        "O(n^(0.5 log_2 n + 0.5))"
    );
    assert.equal(
        report.statementsCost[1].bigO,
        "O(m^(2 log_2 m + 1))"
    );
});

test("publica resúmenes consultables sin alterar el contrato JSON", () => {
    const report = analyze([
        "RECORRE(n)",
        "    para i = 0 hasta n - 1",
        "        escribir i"
    ]);
    const node =
        report.statementsCost[0];
    const summary =
        report.functionCostSummaries
            .get("TRECORRE");
    const instantiation =
        instantiateFunctionCostSummary(
            summary,
            [Cost.symbol("m")],
            "worst"
        );

    assert.equal(summary, node.functionCostSummary);
    assert.deepEqual(summary.parameters, ["n"]);
    assert.equal(instantiation.complete, true);
    assert.equal(
        formatCostExpression(
            instantiation.expression
        ).includes("m"),
        true
    );
    assert.equal(
        Object.keys(node).includes(
            "functionCostSummary"
        ),
        false
    );
    assert.equal(
        JSON.stringify(report).includes(
            "functionCostSummaries"
        ),
        false
    );
});

test("sustituye solo los parametros libres del orden propagado", () => {
    const report = analyze([
        "RECORRE(n, dato)",
        "    si n > 1",
        "        retornar RECORRE(n - 1, dato)",
        "    retornar 0",
        "USA(m, A)",
        "    RECORRE(m, A[0])",
        "SIN_DATO(m)",
        "    RECORRE(m)"
    ]);
    const consumer = report.statementsCost[1];
    const omitted = report.statementsCost[2];

    assert.equal(consumer.bigO, "O(m)");
    assert.equal(consumer.bestBigO, "O(m)");
    assert.equal(omitted.bigO, "O(m)");

    const [root] = report
        .interproceduralProvenance
        .traceFor("USA", "worst");
    const call = root.children[0];

    assert.deepEqual(
        call.requiredParameters,
        ["n"]
    );
    assert.deepEqual(
        call.ignoredParameters,
        ["dato"]
    );

    const [omittedRoot] = report
        .interproceduralProvenance
        .traceFor("SIN_DATO", "worst");

    assert.deepEqual(
        omittedRoot.children[0]
            .ignoredMissing,
        ["dato"]
    );
});

test("mantiene invalido un argumento ausente si participa en el orden", () => {
    const report = analyze([
        "RECORRE(n, limite)",
        "    para i = 0 hasta limite - 1",
        "        escribir i",
        "USA(m)",
        "    RECORRE(m)"
    ]);
    const consumer = report.statementsCost[1];

    assert.equal(consumer.bigO, "O(?)");
    assert.equal(
        consumer.asymptoticAnalysis.code,
        "CLRS_ASYMPTOTIC_CALL_ARGUMENT_MISSING"
    );
});

test("compone logaritmos iterados sobre argumentos logaritmicos", () => {
    const report = analyze([
        "RAIZ_RECURSIVA(n)",
        "    si n > 1",
        "        retornar RAIZ_RECURSIVA(RAIZ(n))",
        "    retornar 0",
        "USA(m)",
        "    retornar RAIZ_RECURSIVA(LOG2(m))"
    ]);

    assert.equal(
        report.statementsCost[0].bigO,
        "O(log log n)"
    );
    assert.equal(
        report.statementsCost[1].bigO,
        "O(log log log m)"
    );
});

test("reutiliza el resumen semantico sin reutilizar la instanciacion", () => {
    const report = analyze([
        "RECORRE(x)",
        "    para i = 0 hasta x - 1",
        "        escribir i",
        "USA(A)",
        "    RECORRE(LONG(A))",
        "OTRA(m)",
        "    RECORRE(m^2)"
    ]);
    const [root] = report
        .interproceduralProvenance
        .traceFor("OTRA", "worst");
    const call = root.children[0];

    assert.equal(
        report.statementsCost[2].bigO,
        "O(m^2)"
    );
    assert.equal(
        call.method,
        "parametric-summary-cache"
    );
    assert.notEqual(call.reusedFrom, null);
    assert.equal(call.notation, "O(m^2)");
});

function analyze(lines) {
    return new CostAnalysisVisitor()
        .costAnalysis(
            parseSource(
                lines.join("\n")
            ).ast
        );
}
