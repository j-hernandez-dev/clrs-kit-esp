import test from "node:test";
import assert from "node:assert/strict";

import { parseSource } from "../src/language/LanguageFrontend.js";
import { Transpiler } from "../src/compiler/Transpiler.js";
import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import { build } from "../flow/src/visitor/DiagramVisitor.js";

test("los consumidores aceptan expresiones científicas y unarias del contrato", () => {
    const { ast } = parseSource([
        "PRINCIPAL()",
        "    valor <- -1e2",
        "    escribir valor"
    ].join("\n"));
    const assignment = ast.statements[0].body.statements[0];

    const transpiler = new Transpiler("contrato.clrs", false);
    assert.equal(
        transpiler.getExpression(assignment.right),
        "-100"
    );

    const report = new CostAnalysisVisitor().costAnalysis(ast);
    assert.equal(report.statementsCost.length, 1);

    const diagram = build(ast);
    assert.ok(
        diagram.subgraphs
            .flatMap(subgraph => subgraph.nodes)
            .some(node => node.label?.includes("-100"))
    );
});
