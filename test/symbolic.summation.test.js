import test from "node:test";
import assert from "node:assert/strict";

import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    CostExpressionKind
} from "../src/complex/algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../src/complex/algebra/CostExpressionFactory.js";
import {
    formatCostExpression
} from "../src/complex/algebra/CostExpressionFormatter.js";
import {
    simplifyCostExpression
} from "../src/complex/algebra/CostExpressionSimplifier.js";
import {
    substituteCostExpression
} from "../src/complex/algebra/CostExpressionSubstitution.js";
import {
    formatCostExpressionLatex
} from "../src/complex/report/CostExpressionLatexFormatter.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("las sumatorias simbólicas reducen constantes, términos lineales y cuadráticos", () => {
    const n = Cost.symbol("n");
    const i = Cost.symbol("i");
    const expression = Cost.summation(
        "i",
        Cost.constant(0),
        Cost.difference(
            n,
            Cost.constant(1)
        ),
        Cost.sum([
            Cost.symbol("c"),
            i,
            Cost.power(i, Cost.constant(2))
        ])
    );
    const simplified = simplifyCostExpression(
        expression
    );

    assert.equal(
        expression.kind,
        CostExpressionKind.SUMMATION
    );
    assert.equal(
        formatCostExpression(expression),
        "Σ[i=0..n - 1] (c + i + i^2)"
    );
    assert.equal(
        formatCostExpressionLatex(expression),
        "\\sum_{i=0}^{n - 1} \\left(c + i + {i}^{2}\\right)"
    );
    assert.notEqual(
        simplified.kind,
        CostExpressionKind.SUMMATION
    );
    assert.equal(
        formatCostExpression(simplified).includes("i"),
        false
    );
});

test("las sumatorias con inicio constante se cierran sin liberar el índice", () => {
    const n = Cost.symbol("n");
    const i = Cost.symbol("i");
    const expression = Cost.summation(
        "i",
        Cost.constant(1),
        n,
        Cost.sum([
            Cost.symbol("c"),
            i,
            Cost.power(i, Cost.constant(2))
        ])
    );
    const simplified = simplifyCostExpression(
        expression
    );

    assert.notEqual(
        simplified.kind,
        CostExpressionKind.SUMMATION
    );
    assert.equal(
        formatCostExpression(simplified).includes("i"),
        false
    );
});

test("la sustitución no captura el índice ligado de una sumatoria", () => {
    const expression = Cost.summation(
        "i",
        Cost.constant(0),
        Cost.symbol("n"),
        Cost.sum([
            Cost.symbol("i"),
            Cost.symbol("x")
        ])
    );
    const substituted = substituteCostExpression(
        expression,
        [
            {
                name: "i",
                expression: Cost.symbol("m")
            },
            {
                name: "x",
                expression: Cost.symbol("n")
            }
        ],
        { canonical: false }
    );

    assert.equal(substituted.index, "i");
    assert.equal(
        formatCostExpression(substituted.term),
        "i + n"
    );
});

test("los ciclos anidados dependientes del índice usan el cierre de sumatoria", () => {
    const ast = parseSource([
        "TRIANGULO(n)",
        "    para i = 0 hasta n - 1",
        "        para j = 0 hasta i",
        "            escribir j"
    ].join("\n")).ast;
    const functionCost = new CostAnalysisVisitor()
        .costAnalysis(ast)
        .statementsCost[0];
    const expression = formatCostExpression(
        functionCost.costExpression
    );

    assert.equal(functionCost.bigO, "O(n^2)");
    assert.equal(expression.includes("Σ["), false);
    assert.equal(/\bi\b/.test(expression), false);
    assert.equal(expression.includes("/ 2"), true);
});

test("un índice ligado con inicio no nulo no se sustituye como una cota global", () => {
    const ast = parseSource([
        "ARMONICA(n)",
        "    para i = 1 hasta n",
        "        para j = 1 hasta n / i",
        "            escribir j"
    ].join("\n")).ast;
    const functionCost = new CostAnalysisVisitor()
        .costAnalysis(ast)
        .statementsCost[0];
    const expression = formatCostExpression(
        functionCost.costExpression
    );

    assert.equal(functionCost.bigO, "O(n log n)");
    assert.equal(expression.includes("Σ[i=1..n]"), true);
    assert.equal(
        functionCost.asymptoticAnalysis.status,
        "determined"
    );
});
