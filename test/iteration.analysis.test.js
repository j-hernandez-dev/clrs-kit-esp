import test from "node:test";
import assert from "node:assert/strict";

import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
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
    parseSource
} from "../src/language/LanguageFrontend.js";

test("los ciclos para ascendentes y descendentes obtienen límites simbólicos", () => {
    const ast =
        parse([
            "RECORRE(n)",
            "    para i <- 0 hasta n - 1",
            "        escribir i",
            "    para j <- n bajando 1",
            "        escribir j"
        ]);
    const loops =
        ast.statements[0]
            .body.statements;
    const model =
        new IterationAnalysisService()
            .analyze(ast);

    for (const loop of loops) {
        const analysis =
            model.get(loop);

        assert.equal(
            analysis.kind,
            IterationAnalysisKind.SYMBOLIC
        );
        assert.equal(
            analysis.progression,
            IterationProgression.ADDITIVE
        );
        assert.equal(
            formatCostExpression(
                analysis.iterations
            ),
            "max(0, n)"
        );
        assert.equal(
            analysis.variable,
            loop.initializer.left.name
        );
        assert.equal(
            analysis.exact,
            false
        );
    }
});

test("los límites numéricos producen una cantidad exacta", () => {
    const ast =
        parse([
            "CONSTANTES()",
            "    para i <- 2 hasta 5",
            "        escribir i",
            "    para j <- 5 bajando 2",
            "        escribir j"
        ]);
    const model =
        new IterationAnalysisService()
            .analyze(ast);
    const analyses =
        ast.statements[0]
            .body.statements
            .map(loop =>
                model.get(loop)
            );

    assert.deepEqual(
        analyses.map(
            analysis => ({
                kind: analysis.kind,
                iterations:
                    formatCostExpression(
                        analysis.iterations
                    ),
                exact: analysis.exact
            })
        ),
        [
            {
                kind:
                    IterationAnalysisKind
                        .CONSTANT,
                iterations: "4",
                exact: true
            },
            {
                kind:
                    IterationAnalysisKind
                        .CONSTANT,
                iterations: "4",
                exact: true
            }
        ]
    );
});

test("mientras sigue asignaciones y reconoce una progresión lineal", () => {
    const ast =
        parse([
            "LINEAL(n)",
            "    limite <- n",
            "    i <- 1",
            "    mientras i <= limite",
            "        escribir i",
            "        i <- i + 1"
        ]);
    const loop =
        ast.statements[0]
            .body.statements[2];
    const analysis =
        new IterationAnalysisService()
            .analyze(ast)
            .get(loop);

    assert.equal(
        analysis.kind,
        IterationAnalysisKind.SYMBOLIC
    );
    assert.equal(
        analysis.progression,
        IterationProgression.ADDITIVE
    );
    assert.equal(
        formatCostExpression(
            analysis.iterations
        ),
        "max(0, n)"
    );
    assert.equal(
        analysis.variable,
        "i"
    );
});

test("mientras reconoce divisiones constantes como costo logarítmico", () => {
    const ast =
        parse([
            "REDUCE(n)",
            "    i <- n",
            "    mientras i > 1",
            "        i <- i / 2"
        ]);
    const loop =
        ast.statements[0]
            .body.statements[1];
    const analysis =
        new IterationAnalysisService()
            .analyze(ast)
            .get(loop);

    assert.equal(
        analysis.kind,
        IterationAnalysisKind.LOGARITHMIC
    );
    assert.equal(
        analysis.progression,
        IterationProgression.MULTIPLICATIVE
    );
    assert.equal(
        formatCostExpression(
            analysis.iterations
        ),
        "max(0, ceil(log_2 n))"
    );
    assert.equal(
        analysis.exact,
        false
    );
    assert.deepEqual(
        analysis.assumptions,
        [
            "Los valores inicial y límite son positivos."
        ]
    );
});

test("los límites polinómicos y ciclos anidados permanecen simbólicos", () => {
    const ast =
        parse([
            "ANIDA(n)",
            "    i <- 0",
            "    mientras i < n",
            "        para j <- 0 hasta i",
            "            escribir j",
            "        i <- i + 1",
            "    para k <- 1 hasta n ^ 2",
            "        escribir k"
        ]);
    const outerWhile =
        ast.statements[0]
            .body.statements[1];
    const nestedFor =
        outerWhile.body
            .statements[0];
    const polynomialFor =
        ast.statements[0]
            .body.statements[2];
    const model =
        new IterationAnalysisService()
            .analyze(ast);

    assert.equal(
        formatCostExpression(
            model.get(nestedFor)
                .iterations
        ),
        "max(0, i + 1)"
    );
    assert.equal(
        formatCostExpression(
            model.get(polynomialFor)
                .iterations
        ),
        "max(0, n^2)"
    );
    assert.equal(
        model.get(outerWhile)
            .kind,
        IterationAnalysisKind.SYMBOLIC
    );
});

test("los casos no demostrables conservan un motivo estructurado", () => {
    const noUpdateAst =
        parse([
            "SIN_CAMBIO(n)",
            "    mientras H(n)",
            "        escribir n"
        ]);
    const wrongDirectionAst =
        parse([
            "DIRECCION(n)",
            "    i <- 0",
            "    mientras i < n",
            "        i <- i - 1"
        ]);
    const changingBoundAst =
        parse([
            "LIMITE_MUTABLE(n)",
            "    i <- 0",
            "    mientras i < n",
            "        i <- i + 1",
            "        n <- n + 1"
        ]);
    const changingStepAst =
        parse([
            "PASO_MUTABLE(n)",
            "    paso <- 1",
            "    i <- 0",
            "    mientras i < n",
            "        i <- i + paso",
            "        paso <- paso + 1"
        ]);
    const zeroBoundAst =
        parse([
            "LIMITE_CERO(n)",
            "    i <- n",
            "    mientras i > 0",
            "        i <- i / 2"
        ]);
    const cases = [
        [
            noUpdateAst,
            "CLRS_ITERATION_UPDATE_NOT_FOUND"
        ],
        [
            wrongDirectionAst,
            "CLRS_ITERATION_DIRECTION_MISMATCH"
        ],
        [
            changingBoundAst,
            "CLRS_ITERATION_BOUND_MUTATED"
        ],
        [
            changingStepAst,
            "CLRS_ITERATION_STEP_MUTATED"
        ],
        [
            zeroBoundAst,
            "CLRS_ITERATION_NON_TERMINATING"
        ]
    ];

    for (const [ast, code] of cases) {
        const statements =
            ast.statements[0]
                .body.statements;
        const loop =
            statements.find(
                statement =>
                    statement.type ===
                    "WhileStatement"
            );
        const analysis =
            new IterationAnalysisService()
                .analyze(ast)
                .get(loop);

        assert.equal(
            analysis.kind,
            IterationAnalysisKind.UNKNOWN
        );
        assert.equal(
            analysis.code,
            code
        );
        assert.match(
            analysis.message,
            /\S/
        );
        assert.equal(
            formatCostExpression(
                analysis.iterations
            ),
            "?"
        );
    }
});

test("CostAnalysisVisitor usa el conteo y adjunta el análisis sin alterar JSON", () => {
    const ast =
        parse([
            "REDUCE(n)",
            "    i <- n",
            "    mientras i > 1",
            "        i <- i / 2"
        ]);
    const report =
        new CostAnalysisVisitor()
            .costAnalysis(ast);
    const whileBlock =
        report.statementsCost[0]
            .instructions[1];
    const whileStatement =
        whileBlock.instructions[0];

    assert.equal(
        whileBlock.expression,
        "c + max(0, ceil(log_2 n))(c + (c))"
    );
    assert.equal(
        whileBlock.iterationAnalysis
            .kind,
        IterationAnalysisKind.LOGARITHMIC
    );
    assert.equal(
        whileStatement
            .iterationAnalysis,
        whileBlock.iterationAnalysis
    );
    assert.equal(
        report.iterationAnalysis
            .get(
                ast.statements[0]
                    .body.statements[1]
            ),
        whileBlock.iterationAnalysis
    );
    assert.deepEqual(
        Object.keys(report),
        ["statementsCost"]
    );
    assert.equal(
        Object.keys(whileBlock)
            .includes(
                "iterationAnalysis"
            ),
        false
    );
    assert.equal(
        JSON.stringify(whileBlock)
            .includes(
                "iterationAnalysis"
            ),
        false
    );
});

test("mientras interpreta redondeos estándar sobre progresiones geométricas", () => {
    for (
        const functionName
        of ["PISO", "REDONDEA"]
    ) {
        const ast =
            parse([
                "REDUCE(n)",
                "    i <- n",
                "    mientras i > 1",
                `        i <- ${functionName}(i / 2)`
            ]);
        const loop =
            ast.statements[0]
                .body.statements[1];
        const analysis =
            new IterationAnalysisService()
                .analyze(ast)
                .get(loop);

        assert.equal(
            analysis.kind,
            IterationAnalysisKind
                .LOGARITHMIC
        );
        assert.equal(
            analysis.progression,
            IterationProgression
                .MULTIPLICATIVE
        );
        assert.equal(
            formatCostExpression(
                analysis.iterations
            ),
            "max(0, ceil(log_2 n))"
        );
    }
});

test("el análisis compuesto obtiene n log n con PISO", () => {
    const ast =
        parse([
            "PROCESA(A)",
            "    n <- LONG(A)",
            "    para i <- 0 hasta n - 1",
            "        j <- n",
            "        mientras j > 1",
            "            escribir A[i]",
            "            j <- PISO(j / 2)"
        ]);
    const report =
        new CostAnalysisVisitor()
            .costAnalysis(ast);

    assert.equal(
        report.statementsCost[0]
            .bigO,
        "O(n log n)"
    );
});

test("ABS sólo se interpreta cuando el dominio evita cambios de signo", () => {
    const safeAst =
        parse([
            "SEGURO(n)",
            "    i <- n",
            "    mientras i > 1",
            "        i <- ABS(i - 1)"
        ]);
    const unsafeAst =
        parse([
            "INSEGURO(n)",
            "    i <- n",
            "    mientras i > -1",
            "        i <- ABS(i - 1)"
        ]);
    const safeLoop =
        safeAst.statements[0]
            .body.statements[1];
    const unsafeLoop =
        unsafeAst.statements[0]
            .body.statements[1];

    assert.equal(
        new IterationAnalysisService()
            .analyze(safeAst)
            .get(safeLoop)
            .kind,
        IterationAnalysisKind.SYMBOLIC
    );
    assert.equal(
        new IterationAnalysisService()
            .analyze(unsafeAst)
            .get(unsafeLoop)
            .kind,
        IterationAnalysisKind.UNKNOWN
    );
});

test("una función sin efecto simbólico declarado permanece desconocida", () => {
    const ast =
        parse([
            "DESCONOCIDO(n)",
            "    i <- n",
            "    mientras i > 1",
            "        i <- AJUSTA(i / 2)"
        ]);
    const loop =
        ast.statements[0]
            .body.statements[1];
    const analysis =
        new IterationAnalysisService()
            .analyze(ast)
            .get(loop);

    assert.equal(
        analysis.kind,
        IterationAnalysisKind.UNKNOWN
    );
    assert.equal(
        analysis.code,
        "CLRS_ITERATION_UPDATE_NOT_FOUND"
    );
});

function parse(lines) {
    return parseSource(
        lines.join("\n")
    ).ast;
}
