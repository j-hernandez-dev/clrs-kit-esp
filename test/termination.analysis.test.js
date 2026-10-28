import test from "node:test";
import assert from "node:assert/strict";

import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    formatCostExpression
} from "../src/complex/algebra/CostExpressionFormatter.js";
import {
    IterationAnalysisKind
} from "../src/complex/iteration/IterationAnalysis.js";
import {
    IterationAnalysisService
} from "../src/complex/iteration/IterationAnalysisService.js";
import {
    IterationPathOutcome
} from "../src/complex/iteration/IterationPathAnalysis.js";
import {
    TerminationAnalysisStatus
} from "../src/complex/iteration/TerminationAnalysis.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("publica una función de ranking para ciclos demostrables", () => {
    const ast = parse([
        "RECORRE(n)",
        "    i = 0",
        "    mientras i < n",
        "        i = i + 1"
    ]);
    const loop = loopOf(ast);
    const model =
        new IterationAnalysisService()
            .analyze(ast);
    const analysis = model.get(loop);
    const termination =
        model.getTermination(loop);

    assert.equal(
        termination.status,
        TerminationAnalysisStatus.TERMINATES
    );
    assert.equal(termination.guaranteed, true);
    assert.equal(
        termination.rankingKind,
        "linear-distance"
    );
    assert.equal(
        formatCostExpression(
            termination.rankingFunction
        ),
        "max(0, n)"
    );
    assert.equal(
        model.getPathAnalysis(loop),
        analysis.pathAnalysis
    );
    assert.equal(
        model.getTransition(loop),
        analysis.transition
    );
    assert.equal(
        model.getInvariants(loop),
        analysis.invariants
    );
    assert.equal(
        analysis.transition.condition.operator,
        "<"
    );
    assert.equal(
        analysis.transition.update.amount,
        1
    );
    assert.equal(analysis.invariants.proven, true);
    assert.equal(
        formatCostExpression(
            analysis.invariants.rankingFunction
        ),
        "max(0, n - i)"
    );
    assert.equal(
        termination.transition,
        analysis.transition
    );
    assert.equal(
        termination.invariants,
        analysis.invariants
    );
});

test("demuestra terminación de igualdad mediante integridad y paso unitario", () => {
    const ast = parse([
        "RECORRE(A)",
        "    n = LONG(A)",
        "    i = 0",
        "    mientras i != n",
        "        i = i + 1"
    ]);
    const loop = loopOf(ast);
    const analysis = new IterationAnalysisService()
        .analyze(ast)
        .get(loop);
    const report = new CostAnalysisVisitor()
        .costAnalysis(ast);

    assert.equal(
        formatCostExpression(analysis.iterations),
        "max(0, LONG(A))"
    );
    assert.equal(analysis.exact, true);
    assert.equal(analysis.transition.condition.operator, "!=");
    assert.equal(analysis.invariants.proven, true);
    assert.equal(
        analysis.termination.status,
        TerminationAnalysisStatus.TERMINATES
    );
    assert.equal(report.statementsCost[0].bigO, "O(n)");
});

test("la igualdad sin dominio entero ni orientación demostrada permanece conservadora", () => {
    const analysis = analyzeLoop([
        "RECORRE(n)",
        "    i = 0",
        "    mientras i != n",
        "        i = i + 1"
    ]);

    assert.equal(
        analysis.code,
        "CLRS_ITERATION_DIRECTION_MISMATCH"
    );
    assert.equal(
        analysis.termination.status,
        TerminationAnalysisStatus.MAY_TERMINATE
    );
    assert.equal(analysis.transition != null, true);
    assert.equal(analysis.invariants.proven, true);
});

test("resuelve condiciones inicialmente falsas", () => {
    const analysis = analyzeLoop([
        "OMITE()",
        "    mientras FALSO",
        "        escribir 1"
    ]);

    assert.equal(
        analysis.kind,
        IterationAnalysisKind.CONSTANT
    );
    assert.equal(
        formatCostExpression(
            analysis.iterations
        ),
        "0"
    );
    assert.equal(
        analysis.termination.status,
        TerminationAnalysisStatus.TERMINATES
    );
});

test("demuestra no terminación para una condición verdadera sin salida", () => {
    const ast = parse([
        "INFINITO()",
        "    mientras VERDAD",
        "        escribir 1"
    ]);
    const analysis =
        new IterationAnalysisService()
            .analyze(ast)
            .get(loopOf(ast));
    const report =
        new CostAnalysisVisitor()
            .costAnalysis(ast);

    assert.equal(
        analysis.code,
        "CLRS_ITERATION_NON_TERMINATING"
    );
    assert.equal(
        analysis.termination.status,
        TerminationAnalysisStatus
            .NON_TERMINATING
    );
    assert.equal(
        report.statementsCost[0].bigO,
        "O(?)"
    );
});

test("un retorno en todos los caminos acota el ciclo a una iteración", () => {
    const analysis = analyzeLoop([
        "SALE(continuar)",
        "    mientras continuar",
        "        retornar 1"
    ]);

    assert.equal(
        formatCostExpression(
            analysis.iterations
        ),
        "1"
    );
    assert.equal(
        analysis.pathAnalysis.allPathsExit,
        true
    );
    assert.equal(
        analysis.pathAnalysis.paths[0]
            .outcome,
        IterationPathOutcome.RETURN
    );
    assert.equal(
        analysis.termination.guaranteed,
        true
    );
});

test("distingue una salida condicional dentro de un ciclo infinito", () => {
    const analysis = analyzeLoop([
        "QUIZA(flag)",
        "    mientras VERDAD",
        "        si flag",
        "            retornar 1",
        "        sino",
        "            escribir 1"
    ]);

    assert.equal(
        analysis.code,
        "CLRS_ITERATION_TERMINATION_CONDITIONAL"
    );
    assert.equal(
        analysis.termination.status,
        TerminationAnalysisStatus
            .MAY_TERMINATE
    );
    assert.equal(
        analysis.pathAnalysis.exitPaths,
        1
    );
    assert.equal(
        analysis.pathAnalysis.continuingPaths,
        1
    );
});

test("combina salidas anticipadas con caminos que reducen el ranking", () => {
    const ast = parse([
        "BUSCA(n, encontrado)",
        "    i = 0",
        "    mientras i < n",
        "        si encontrado",
        "            retornar i",
        "        sino",
        "            i = i + 1"
    ]);
    const analysis =
        new IterationAnalysisService()
            .analyze(ast)
            .get(loopOf(ast));
    const report =
        new CostAnalysisVisitor()
            .costAnalysis(ast);

    assert.equal(
        analysis.termination.status,
        TerminationAnalysisStatus.TERMINATES
    );
    assert.equal(
        analysis.pathAnalysis.exitPaths,
        1
    );
    assert.equal(
        analysis.pathAnalysis.continuingPaths,
        1
    );
    assert.equal(
        report.statementsCost[0].bigO,
        "O(n)"
    );
});

test("descarta ramas imposibles mediante condiciones constantes", () => {
    const trueBranch = analyzeLoop([
        "AVANZA(n)",
        "    i = 0",
        "    mientras i < n",
        "        si VERDAD",
        "            i = i + 1"
    ]);
    const falseBranch = analyzeLoop([
        "AVANZA(n)",
        "    i = 0",
        "    mientras i < n",
        "        si FALSO",
        "            i = i - 1",
        "        sino",
            "            i = i + 1"
    ]);
    const assignedBoolean = analyzeLoop([
        "AVANZA(n)",
        "    activo = VERDAD",
        "    i = 0",
        "    mientras i < n",
        "        si activo",
        "            i = i + 1"
    ]);

    for (
        const analysis
        of [
            trueBranch,
            falseBranch,
            assignedBoolean
        ]
    ) {
        assert.equal(
            formatCostExpression(
                analysis.iterations
            ),
            "max(0, n)"
        );
        assert.equal(
            analysis.pathAnalysis.totalPaths,
            1
        );
        assert.equal(
            analysis.termination.guaranteed,
            true
        );
    }
});

test("los ciclos para conservan las salidas anticipadas como cota", () => {
    const ast = parse([
        "PRIMERO(n)",
        "    para i = 0 hasta n - 1",
        "        retornar i"
    ]);
    const loop =
        ast.statements[0]
            .body.statements[0];
    const analysis =
        new IterationAnalysisService()
            .analyze(ast)
            .get(loop);

    assert.equal(
        formatCostExpression(
            analysis.iterations
        ),
        "1"
    );
    assert.equal(analysis.boundKind, "upper");
    assert.equal(
        analysis.pathAnalysis.allPathsExit,
        true
    );
});

test("una dirección divergente queda clasificada como terminación posible", () => {
    const analysis = analyzeLoop([
        "DIVERGE(n)",
        "    i = 0",
        "    mientras i < n",
        "        i = i - 1"
    ]);

    assert.equal(
        analysis.code,
        "CLRS_ITERATION_DIRECTION_MISMATCH"
    );
    assert.equal(
        analysis.termination.status,
        TerminationAnalysisStatus
            .MAY_TERMINATE
    );
});

test("los modelos de terminación permanecen fuera del JSON histórico", () => {
    const ast = parse([
        "RECORRE(n)",
        "    i = 0",
        "    mientras i < n",
        "        i = i + 1"
    ]);
    const report =
        new CostAnalysisVisitor()
            .costAnalysis(ast);

    assert.equal(
        JSON.stringify(report).includes(
            "termination-analysis"
        ),
        false
    );
    assert.equal(
        JSON.stringify(report).includes(
            "iteration-path-analysis"
        ),
        false
    );
    assert.equal(
        JSON.stringify(report).includes(
            "loop-transition"
        ),
        false
    );
    assert.equal(
        JSON.stringify(report).includes(
            "loop-invariant-analysis"
        ),
        false
    );
});

function analyzeLoop(lines) {
    const ast = parse(lines);

    return new IterationAnalysisService()
        .analyze(ast)
        .get(loopOf(ast));
}

function loopOf(ast) {
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
