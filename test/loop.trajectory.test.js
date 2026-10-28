import test from "node:test";
import assert from "node:assert/strict";

import { CostAnalysisVisitor } from "../src/complex/CostAnalysisVisitor.js";
import { formatCostExpression } from "../src/complex/algebra/CostExpressionFormatter.js";
import { parseSource } from "../src/language/LanguageFrontend.js";

test("una trayectoria geométrica suma el trabajo del estado i(k)", () => {
    const { report, loops } = analyze([
        "GEOMETRICA(n)",
        "    i = 1",
        "    mientras i < n",
        "        para j = 1 hasta i",
        "            escribir j",
        "        i = i * 2"
    ]);
    const trajectory = report.iterationAnalysis
        .get(loops[0]).trajectory;

    assert.equal(report.statementsCost[0].bigO, "O(n)");
    assert.equal(trajectory.kind, "loop-trajectory");
    assert.equal(
        formatCostExpression(trajectory.value),
        "2^#i:iteration"
    );
    assert.match(
        formatCostExpression(
            report.statementsCost[0]
                .simplifiedCostExpression
        ),
        /n/
    );
});

test("el postestado de un ciclo alimenta la fase siguiente", () => {
    const { report, loops } = analyze([
        "DOS_FASES(n)",
        "    i = 1",
        "    mientras i < n",
        "        i = i * 2",
        "    mientras i > 1",
        "        i = i - 1"
    ]);
    const second = report.iterationAnalysis
        .get(loops[1]);
    const environment = report.iterationAnalysis
        .getEnvironment(loops[1]);

    assert.equal(report.statementsCost[0].bigO, "O(n)");
    assert.match(
        formatCostExpression(second.iterations),
        /n/
    );
    assert.equal(
        environment.get("i").source,
        "loop-postcondition"
    );
});

test("una trayectoria descendente conserva la sumatoria cuadrática", () => {
    const { report } = analyze([
        "DESCENDENTE(n)",
        "    i = n",
        "    mientras i > 0",
        "        para j = 1 hasta i",
        "            escribir j",
        "        i = i - 1"
    ]);

    assert.equal(
        report.statementsCost[0].bigO,
        "O(n^2)"
    );
});

test("las guardas de camino conservan transiciones opuestas hacia un objetivo", () => {
    const { report, loops } = analyze([
        "POR_CAMINOS(n)",
        "    i = -n",
        "    mientras i != 0",
        "        si i < 0",
        "            i = i + 1",
        "        sino",
        "            i = i - 1"
    ]);
    const analysis = report.iterationAnalysis
        .get(loops[0]);
    const paths = analysis.pathAnalysis.paths;

    assert.equal(report.statementsCost[0].bigO, "O(n)");
    assert.equal(analysis.code, null);
    assert.equal(analysis.termination.guaranteed, true);
    assert.deepEqual(
        paths.map(path => path.transitions[0].amount),
        [1, -1]
    );
    assert.deepEqual(
        paths.map(path => path.guards.at(-1).truth),
        [true, false]
    );
});

function analyze(lines) {
    const { ast } = parseSource(lines.join("\n"));
    const report = new CostAnalysisVisitor()
        .costAnalysis(ast);
    const loops = [];

    collectLoops(ast.statements, loops);

    return { ast, report, loops };
}

function collectLoops(statements, result) {
    for (const statement of statements ?? []) {
        if (
            statement.type === "WhileStatement" ||
            statement.type === "ForStatement"
        ) {
            result.push(statement);
        }

        collectLoops(statement.body?.statements, result);
        collectLoops(statement.thenBlock?.statements, result);

        for (
            const branch
            of statement.elseIfBranches ?? []
        ) {
            collectLoops(branch.block?.statements, result);
        }

        collectLoops(statement.elseBlock?.statements, result);
    }
}
