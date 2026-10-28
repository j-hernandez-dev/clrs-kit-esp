import test from "node:test";
import assert from "node:assert/strict";

import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    costExpressionKey
} from "../src/complex/algebra/CostExpression.js";
import {
    formatCostExpression
} from "../src/complex/algebra/CostExpressionFormatter.js";
import {
    ControlFlowBlockKind,
    ControlFlowEdgeKind
} from "../src/complex/control-flow/index.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("el CFG modela ramas, retorno y elimina el código muerto", () => {
    const { ast, report } = analyze([
        "RAMA(n)",
        "    si n > 0",
        "        retornar n",
        "    sino",
        "        n = n + 1",
        "    escribir n",
        "    retornar n",
        "    escribir \"inalcanzable\""
    ]);
    const functionNode = ast.statements[0];
    const graph = report.controlFlowAnalysis
        .getGraph("RAMA");
    const dead = functionNode.body
        .statements.at(-1);

    assert.equal(graph.kind, "control-flow-graph");
    assert.ok(graph.getBlock(graph.entry));
    assert.ok(graph.getBlock(graph.exit));
    assert.ok(
        graph.blocks.some(block =>
            block.kind ===
            ControlFlowBlockKind.CONDITION
        )
    );
    assert.ok(
        graph.edges.some(edge =>
            edge.kind ===
            ControlFlowEdgeKind.RETURN
        )
    );
    assert.ok(
        graph.blocks.some(block =>
            block.terminator.kind ===
            "branch"
        )
    );
    assert.equal(
        report.controlFlowAnalysis
            .isReachable(dead),
        false
    );
    assert.equal(
        graph.getBlock(dead),
        null
    );
});

test("SSA crea una unión phi y conserva sus alternativas fuente", () => {
    const { ast, report } = analyze([
        "ELIGE(n, activo)",
        "    si activo",
        "        m = n - 1",
        "    sino",
        "        m = n - 2",
        "    retornar ELIGE(m, activo)"
    ]);
    const call = ast.statements[0]
        .body.statements[1]
        .expression;
    const state = report.controlFlowAnalysis
        .getStateBefore(call);
    const binding = state.get("m");

    assert.equal(binding.phi, true);
    assert.match(binding.displayName, /^m#\d+$/);
    assert.deepEqual(
        binding.alternatives
            .map(formatCostExpression)
            .sort(),
        ["n - 1", "n - 2"]
            .sort()
    );
    assert.equal(
        binding.definitions.length,
        2
    );
});

test("el contexto relacional acompaña la arista y la llamada recursiva", () => {
    const { ast, report } = analyze([
        "LINEAL(n)",
        "    si n > 1",
        "        retornar LINEAL(n - 1)",
        "    retornar 0"
    ]);
    const call = ast.statements[0]
        .body.statements[0]
        .thenBlock.statements[0]
        .expression;
    const context = report.controlFlowAnalysis
        .getContextBefore(call);
    const recurrenceCall =
        report.recurrenceInputAnalysis
            .getCall(call);

    assert.equal(context.kind, "relational-context");
    assert.equal(context.reachable, true);
    assert.ok(
        context.getConstraints()
            .some(constraint =>
                constraint.operator === ">"
            )
    );
    assert.equal(
        recurrenceCall.relationalContext,
        context
    );
});

test("la propagación parametrizada consume alternativas phi seguras", () => {
    const { report } = analyze([
        "VARIABLE(n)",
        "    si n <= 1",
        "        retornar 0",
        "    si n > 5",
        "        siguiente = n - 1",
        "    sino",
        "        siguiente = n - 2",
        "    retornar VARIABLE(siguiente)"
    ]);
    const definition =
        report.recurrenceInputAnalysis
            .getFunction("TVARIABLE");

    assert.equal(
        definition.calls[0]
            .argumentAlternatives[0]
            .length,
        2
    );
    assert.deepEqual(
        definition.calls[0].relation,
        {
            kind: "decrement",
            amount: 1
        }
    );
    assert.equal(
        report.statementsCost[0].bigO,
        "O(n)"
    );
});

test("los ciclos comparten el estado anterior y exponen retroaristas SSA", () => {
    const { ast, report } = analyze([
        "RECORRE(n)",
        "    inicio = n - 1",
        "    mientras inicio > 0",
        "        inicio = inicio - 1",
        "    retornar inicio"
    ]);
    const loop = ast.statements[0]
        .body.statements[1];
    const graph = report.controlFlowAnalysis
        .getGraph("RECORRE");
    const shared = report.controlFlowAnalysis
        .getLoopEntryState(loop);
    const iteration = report.iterationAnalysis
        .getEnvironment(loop);

    assert.equal(
        costExpressionKey(
            shared.environment
                .get("inicio")
                .expression
        ),
        costExpressionKey(
            iteration.get("inicio")
                .expression
        )
    );
    assert.ok(
        graph.edges.some(edge =>
            edge.backEdge &&
            edge.kind ===
                ControlFlowEdgeKind.BACK
        )
    );
    assert.ok(
        report.controlFlowAnalysis
            .getStateAfter(loop)
    );
});

function analyze(lines) {
    const { ast } = parseSource(
        lines.join("\n")
    );
    const report = new CostAnalysisVisitor()
        .costAnalysis(ast);

    return { ast, report };
}
