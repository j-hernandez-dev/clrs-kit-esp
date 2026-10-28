import test from "node:test";
import assert from "node:assert/strict";

import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    FunctionSemanticSummaryService
} from "../src/complex/function-semantics/index.js";
import {
    formatCostExpression
} from "../src/complex/algebra/CostExpressionFormatter.js";
import {
    SymbolicValueResolver
} from "../src/complex/iteration/SymbolicValueResolver.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("los resúmenes propagan una reducción segura de una función propia", () => {
    const ast = parse([
        "MITAD(x)",
        "    retornar PISO(x / 2)",
        "REDUCE(n)",
        "    i = n",
        "    mientras i > 1",
        "        i = MITAD(i)"
    ]);
    const report = new CostAnalysisVisitor()
        .costAnalysis(ast);
    const summary = report
        .functionSemanticSummaryAnalysis
        .get("MITAD");

    assert.equal(summary.transparent, true);
    assert.equal(summary.complete, true);
    assert.deepEqual(summary.effectKinds, []);
    assert.equal(
        formatCostExpression(
            summary.returns[0].expression
        ),
        "PISO(x / 2)"
    );
    assert.equal(
        functionNode(report, "REDUCE").bigO,
        "O(log n)"
    );
});

test("los resúmenes se instancian de manera simultánea y se encadenan", () => {
    const ast = parse([
        "MITAD(x)",
        "    retornar PISO(x / 2)",
        "CUARTO(x)",
        "    retornar MITAD(MITAD(x))",
        "REDUCE(n)",
        "    i = n",
        "    mientras i > 1",
        "        i = CUARTO(i)"
    ]);
    const model = new FunctionSemanticSummaryService()
        .analyze(ast);
    const resolver = new SymbolicValueResolver(
        undefined,
        {
            functionSummaryResolver: model
        }
    );

    resolver.define("i");

    assert.equal(
        formatCostExpression(
            resolver.resolve(
                ast.statements[2]
                    .body.statements[1]
                    .body.statements[0]
                    .right
            )
        ),
        "PISO(PISO(i / 2) / 2)"
    );
    assert.equal(
        functionNode(
            new CostAnalysisVisitor()
                .costAnalysis(ast),
            "REDUCE"
        ).bigO,
        "O(log n)"
    );
});

test("los resúmenes conservan reducciones de recurrencia entre funciones", () => {
    const ast = parse([
        "MITAD(x)",
        "    retornar PISO(x / 2)",
        "DIVIDE(n)",
        "    si n > 1",
        "        retornar DIVIDE(MITAD(n))",
        "    retornar 0"
    ]);
    const report = new CostAnalysisVisitor()
        .costAnalysis(ast);
    const recursiveCall = report
        .recurrenceInputAnalysis
        .getFunction("TDIVIDE")
        .calls.find(call =>
            call.callee === "DIVIDE"
        );

    assert.equal(
        formatCostExpression(
            recursiveCall.arguments[0]
        ),
        "PISO(n / 2)"
    );
    assert.equal(
        functionNode(report, "DIVIDE").bigO,
        "O(log n)"
    );
});

test("las escrituras observables o de parámetros mantienen la llamada opaca", () => {
    const ast = parse([
        "MUTA(x)",
        "    x = PISO(x / 2)",
        "    retornar x",
        "REDUCE(n)",
        "    i = n",
        "    mientras i > 1",
        "        i = MUTA(i)"
    ]);
    const model = new FunctionSemanticSummaryService()
        .analyze(ast);
    const summary = model.get("MUTA");
    const resolver = new SymbolicValueResolver(
        undefined,
        {
            functionSummaryResolver: model
        }
    );

    resolver.define("i");

    assert.equal(summary.transparent, false);
    assert.deepEqual(
        summary.effectKinds,
        ["parameter-write"]
    );
    assert.equal(
        formatCostExpression(
            resolver.resolve(
                ast.statements[1]
                    .body.statements[1]
                    .body.statements[0]
                    .right
            )
        ),
        "MUTA(i)"
    );
});

test("un resumen no hereda como puro una dependencia con efectos", () => {
    const ast = parse([
        "RUIDOSA(x)",
        "    escribir x",
        "    retornar PISO(x / 2)",
        "ENVOLTURA(x)",
        "    retornar RUIDOSA(x)"
    ]);
    const model = new FunctionSemanticSummaryService()
        .analyze(ast);
    const resolver = new SymbolicValueResolver(
        undefined,
        {
            functionSummaryResolver: model
        }
    );

    resolver.define("i");

    assert.equal(
        model.get("RUIDOSA").transparent,
        false
    );
    assert.equal(
        model.get("ENVOLTURA").transparent,
        true
    );
    assert.equal(
        model.resolveCall(
            "ENVOLTURA",
            [resolver.getAbstract("i")]
        ),
        null
    );
});

function functionNode(report, name) {
    return report.statementsCost.find(node =>
        node.type === "FunctionDeclaration" &&
        node.location?.startLine ===
        report.functionSemanticSummaryAnalysis
            .get(name)
            .location?.startLine
    );
}

function parse(lines) {
    return parseSource(
        lines.join("\n")
    ).ast;
}
