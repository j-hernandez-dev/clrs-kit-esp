import test from "node:test";
import assert from "node:assert/strict";

import {
    CostExpressionFactory as Cost
} from "../src/complex/algebra/CostExpressionFactory.js";
import {
    formatCostExpression
} from "../src/complex/algebra/CostExpressionFormatter.js";
import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    createScenarioCost,
    ScenarioCostConfidence
} from "../src/complex/scenario/index.js";
import {
    AsymptoticClassifier
} from "../src/complex/asymptotic/AsymptoticClassifier.js";
import {
    formatOrder
} from "../src/complex/asymptotic/AsymptoticOrder.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("ScenarioCost es inmutable y conserva dos expresiones válidas", () => {
    const scenario =
        createScenarioCost({
            best: Cost.constant(1),
            worst: Cost.symbol("n"),
            assumptions: ["n >= 1"],
            evidence: ["fixture"],
            confidence: {
                best:
                    ScenarioCostConfidence.EXACT,
                worst:
                    ScenarioCostConfidence
                        .UPPER_BOUND
            }
        });

    assert.equal(
        formatCostExpression(
            scenario.best
        ),
        "1"
    );
    assert.equal(
        formatCostExpression(
            scenario.worst
        ),
        "n"
    );
    assert.equal(
        formatCostExpression(
            scenario.canonicalBest
        ),
        "1"
    );
    assert.equal(
        formatCostExpression(
            scenario.canonicalWorst
        ),
        "n"
    );
    assert.equal(Object.isFrozen(scenario), true);
    assert.equal(
        Object.isFrozen(
            scenario.confidence
        ),
        true
    );
    assert.throws(
        () => createScenarioCost({
            best: "c",
            worst: Cost.constant(1)
        }),
        /valid cost expression/
    );
});

test("el mínimo asintótico elige órdenes comparables y conserva los incomparables", () => {
    const classifier =
        new AsymptoticClassifier();
    const comparable =
        classifier.classify(
            Cost.minimum([
                Cost.constant(1),
                Cost.symbol("n"),
                Cost.power(
                    Cost.symbol("n"),
                    Cost.constant(2)
                )
            ])
        );
    const incomparable =
        classifier.classify(
            Cost.minimum([
                Cost.symbol("n"),
                Cost.symbol("m")
            ])
        );

    assert.equal(
        formatOrder(comparable),
        "O(1)"
    );
    assert.equal(incomparable.known, false);
    assert.equal(
        incomparable.code,
        "CLRS_ASYMPTOTIC_MINIMUM_INCOMPARABLE"
    );
});

test("instrucciones y secuencias comparten costo en ambos escenarios", () => {
    const functionNode =
        analyze([
            "F()",
            "    escribir 1",
            "    x = 2"
        ]).statementsCost[0];

    assert.equal(
        formatCostExpression(
            functionNode
                .scenarioCost
                .simplifiedBest
        ),
        "TF() = 2c"
    );
    assert.equal(
        formatCostExpression(
            functionNode
                .scenarioCost
                .simplifiedWorst
        ),
        "TF() = 2c"
    );
    assert.equal(functionNode.bestBigO, "O(1)");
    assert.equal(functionNode.worstBigO, "O(1)");
});

test("un si sin sino incorpora la ruta falsa implícita", () => {
    const report = analyze([
        "F(n)",
        "    si n > 0",
        "        escribir 1",
        "        escribir 2"
    ]);
    const conditional =
        report.statementsCost[0]
            .instructions[0];

    assert.equal(
        formatCostExpression(
            conditional.scenarioCost.best
        ),
        "min(c + (c + c), c)"
    );
    assert.equal(
        conditional.scenarioCost.worst,
        conditional.costExpression
    );
    assert.equal(
        conditional
            .scenarioCost
            .confidence.best,
        ScenarioCostConfidence
            .SYNTACTIC_BOUND
    );
    assert.equal(conditional.bestBigO, "O(1)");
    assert.equal(conditional.worstBigO, "O(1)");
});

test("condicionales combinan mínimos y máximos sin alterar la fachada", () => {
    const report = analyze([
        "F(n)",
        "    si n > 0",
        "        escribir 1",
        "    sino",
        "        escribir 2",
        "        escribir 3"
    ]);
    const functionNode =
        report.statementsCost[0];
    const conditional =
        functionNode.instructions[0];

    assert.equal(
        formatCostExpression(
            conditional
                .scenarioCost
                .simplifiedBest
        ),
        "min(2c, 3c)"
    );
    assert.equal(
        formatCostExpression(
            conditional
                .scenarioCost
                .simplifiedWorst
        ),
        "max(2c, 3c)"
    );
    assert.equal(
        conditional.expression,
        "max(c + (c), c + (c + c))"
    );
    assert.equal(
        conditional.bigO,
        conditional
            .scenarioAsymptoticAnalysis
            .worst.notation
    );
    assert.equal(
        report
            .scenarioCostAnalysis
            .get(conditional),
        conditional.scenarioCost
    );
    assert.equal(
        report
            .scenarioAsymptoticAnalysis
            .get(conditional),
        conditional
            .scenarioAsymptoticAnalysis
    );
});

test("los escenarios atraviesan ciclos deterministas y unknown parciales", () => {
    const deterministic =
        analyze([
            "F(n)",
            "    para i = 0 hasta n - 1",
            "        si i > 0",
            "            escribir i"
        ]).statementsCost[0];
    const partial =
        analyze([
            "G(n)",
            "    si n > 0",
            "        escribir 1",
            "    sino",
            "        mientras H(n)",
            "            escribir n"
        ]).statementsCost[0];

    assert.equal(deterministic.bestBigO, "O(n)");
    assert.equal(deterministic.worstBigO, "O(n)");
    assert.notEqual(
        formatCostExpression(
            deterministic.scenarioCost.best
        ),
        formatCostExpression(
            deterministic.scenarioCost.worst
        )
    );
    assert.equal(partial.bestBigO, "O(1)");
    assert.equal(partial.worstBigO, "O(?)");
    assert.equal(
        partial
            .scenarioAsymptoticAnalysis
            .status,
        "partial"
    );
});

test("el mejor caso interprocedural usa el resumen parametrizado", () => {
    const report = analyze([
        "AYUDA(n)",
        "    para i = 0 hasta n - 1",
        "        escribir i",
        "USA(n)",
        "    AYUDA(n)"
    ]);
    const consumer =
        report.statementsCost[1];

    assert.equal(consumer.bestBigO, "O(n)");
    assert.equal(consumer.worstBigO, "O(n)");
    assert.equal(
        consumer
            .scenarioAsymptoticAnalysis
            .best.code,
        null
    );
    assert.equal(consumer.bigO, "O(n)");
    assert.deepEqual(
        Object.keys(consumer),
        [
            "type",
            "location",
            "expression",
            "instructions"
        ]
    );
    assert.equal(
        JSON.stringify(report).includes(
            "scenarioCost"
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
