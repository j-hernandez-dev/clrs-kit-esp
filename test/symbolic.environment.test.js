import test from "node:test";
import assert from "node:assert/strict";

import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    CostExpressionFactory as Cost
} from "../src/complex/algebra/CostExpressionFactory.js";
import {
    formatCostExpression
} from "../src/complex/algebra/CostExpressionFormatter.js";
import {
    IterationAnalysisKind,
    IterationProgression
} from "../src/complex/iteration/IterationAnalysis.js";
import {
    IterationAnalysisService
} from "../src/complex/iteration/IterationAnalysisService.js";
import {
    SymbolicValueResolver
} from "../src/complex/iteration/SymbolicValueResolver.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("el entorno une expresiones canónicas equivalentes", () => {
    const resolver =
        new SymbolicValueResolver();
    const left = resolver.clone();
    const right = resolver.clone();

    left.define(
        "limite",
        Cost.sum([
            Cost.symbol("n"),
            Cost.constant(1)
        ])
    );
    right.define(
        "limite",
        Cost.sum([
            Cost.constant(1),
            Cost.symbol("n")
        ])
    );
    resolver.merge([left, right]);

    const snapshot = resolver.snapshot();
    const binding =
        snapshot.get("limite");

    assert.equal(
        formatCostExpression(
            binding.expression
        ),
        "n + 1"
    );
    assert.equal(
        binding.source,
        "branch-merge"
    );
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(
        Object.isFrozen(snapshot.bindings),
        true
    );
});

test("conserva bindings iguales después de un condicional", () => {
    const ast = parse([
        "RECORRE(n, bandera)",
        "    si bandera",
        "        limite = n",
        "    sino",
        "        limite = n",
        "    i = 0",
        "    mientras i < limite",
        "        i = i + 1"
    ]);
    const loop = whileOf(ast);
    const model =
        new IterationAnalysisService()
            .analyze(ast);
    const environment =
        model.getEnvironment(loop);

    assert.equal(
        formatCostExpression(
            model.get(loop).iterations
        ),
        "max(0, n)"
    );
    assert.equal(
        formatCostExpression(
            environment
                .get("limite")
                .expression
        ),
        "n"
    );
});

test("compone varias actualizaciones aditivas de una iteración", () => {
    const analysis = analyzeWhile([
        "RECORRE(n)",
        "    i = 0",
        "    mientras i < n",
        "        i = i + 1",
        "        i = i + 2"
    ]);

    assert.equal(
        analysis.progression,
        IterationProgression.ADDITIVE
    );
    assert.equal(
        formatCostExpression(
            analysis.iterations
        ),
        "max(0, ceil(n / 3))"
    );
    assert.equal(
        analysis.updates[0].offset,
        3
    );
    assert.equal(analysis.tight, true);
});

test("reconoce una composición afín como logarítmica", () => {
    const source = [
        "EXPANDE(n)",
        "    i = 0",
        "    mientras i < n",
        "        i = i + 1",
        "        i = i * 2"
    ];
    const ast = parse(source);
    const loop = whileOf(ast);
    const analysis =
        new IterationAnalysisService()
            .analyze(ast)
            .get(loop);
    const report =
        new CostAnalysisVisitor()
            .costAnalysis(ast);

    assert.equal(
        analysis.kind,
        IterationAnalysisKind.LOGARITHMIC
    );
    assert.equal(
        analysis.progression,
        IterationProgression.AFFINE
    );
    assert.equal(
        formatCostExpression(
            analysis.iterations
        ),
        "max(0, ceil(log_2 ((n + 2) / 2)))"
    );
    assert.equal(
        report.statementsCost[0].bigO,
        "O(log n)"
    );
});

test("usa una cota superior cuando las ramas avanzan a ritmos distintos", () => {
    const analysis = analyzeWhile([
        "RECORRE(n, rapido)",
        "    i = 0",
        "    mientras i < n",
        "        si rapido",
        "            i = i + 2",
        "        sino",
        "            i = i + 1"
    ]);

    assert.equal(
        formatCostExpression(
            analysis.iterations
        ),
        "max(0, n)"
    );
    assert.equal(analysis.boundKind, "upper");
    assert.equal(analysis.tight, false);
    assert.equal(analysis.updates.length, 2);
});

test("combina el avance de ambos extremos de la condición", () => {
    const analysis = analyzeWhile([
        "ACERCA(n)",
        "    izquierda = 0",
        "    derecha = n",
        "    mientras izquierda < derecha",
        "        izquierda = izquierda + 1",
        "        derecha = derecha - 1"
    ]);

    assert.equal(
        analysis.progression,
        IterationProgression.ADDITIVE
    );
    assert.equal(
        formatCostExpression(
            analysis.iterations
        ),
        "max(0, ceil(n / 2))"
    );
    assert.deepEqual(
        analysis.updates[0].variables,
        ["izquierda", "derecha"]
    );
});

test("resuelve temporales recalculados antes de actualizar el control", () => {
    const analysis = analyzeWhile([
        "RECORRE(n)",
        "    i = 0",
        "    mientras i < n",
        "        siguiente = i + 1",
        "        i = siguiente"
    ]);

    assert.equal(
        formatCostExpression(
            analysis.iterations
        ),
        "max(0, n)"
    );
});

test("distingue caminos incompletos y actualizaciones incompatibles", () => {
    const incomplete = analyzeWhile([
        "INCOMPLETO(n, cambia)",
        "    i = 0",
        "    mientras i < n",
        "        si cambia",
        "            i = i + 1"
    ]);
    const conflict = analyzeWhile([
        "CONFLICTO(n, avanza)",
        "    i = 0",
        "    mientras i < n",
        "        si avanza",
        "            i = i + 1",
        "        sino",
        "            i = i - 1"
    ]);

    assert.equal(
        incomplete.code,
        "CLRS_ITERATION_UPDATE_PATH_INCOMPLETE"
    );
    assert.equal(
        conflict.code,
        "CLRS_ITERATION_UPDATE_CONFLICT"
    );
    assert.equal(
        incomplete.kind,
        IterationAnalysisKind.UNKNOWN
    );
    assert.equal(
        conflict.kind,
        IterationAnalysisKind.UNKNOWN
    );
});

test("limita la explosión combinatoria de caminos simbólicos", () => {
    const lines = [
        "MUCHOS(n, bandera)",
        "    i = 0",
        "    mientras i < n"
    ];

    for (let index = 0; index < 7; index++) {
        lines.push(
            "        si bandera",
            "            i = i + 1",
            "        sino",
            "            i = i + 2"
        );
    }

    const analysis =
        analyzeWhile(lines);

    assert.equal(
        analysis.code,
        "CLRS_ITERATION_UPDATE_PATH_LIMIT"
    );
});

function analyzeWhile(lines) {
    const ast = parse(lines);

    return new IterationAnalysisService()
        .analyze(ast)
        .get(whileOf(ast));
}

function whileOf(ast) {
    return ast.statements[0]
        .body.statements
        .find(statement =>
            statement.type ===
            "WhileStatement"
        );
}

function parse(lines) {
    return parseSource(
        lines.join("\n")
    ).ast;
}
