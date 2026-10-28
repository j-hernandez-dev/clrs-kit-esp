import test from "node:test";
import assert from "node:assert/strict";

import {
    CostExpressionFactory as Cost
} from "../src/complex/algebra/CostExpressionFactory.js";
import {
    formatCostExpression
} from "../src/complex/algebra/CostExpressionFormatter.js";
import {
    normalizePolynomialExpression,
    polynomialToCostExpression
} from "../src/complex/algebra/NormalizedPolynomial.js";
import {
    simplifyCostExpression
} from "../src/complex/algebra/CostExpressionSimplifier.js";
import {
    AsymptoticClassifier
} from "../src/complex/asymptotic/AsymptoticClassifier.js";
import {
    createAsymptoticAnalysis
} from "../src/complex/asymptotic/AsymptoticAnalysis.js";
import {
    orderDominates
} from "../src/complex/asymptotic/AsymptoticOrder.js";
import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    ComplexityReportBuilder
} from "../src/complex/report/ComplexityReportBuilder.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

const N = Cost.symbol("n");
const M = Cost.symbol("m");

test("la forma normal distribuye y cancela polinomios equivalentes", () => {
    const expandedSquare = Cost.sum([
        Cost.power(N, Cost.constant(2)),
        Cost.product([
            Cost.constant(2),
            N
        ]),
        Cost.constant(1)
    ]);
    const difference = Cost.difference(
        Cost.power(
            Cost.sum([
                N,
                Cost.constant(1)
            ]),
            Cost.constant(2)
        ),
        expandedSquare
    );
    const polynomial =
        normalizePolynomialExpression(
            difference
        );

    assert.equal(polynomial.isZero(), true);
    assert.equal(
        formatCostExpression(
            polynomialToCostExpression(
                polynomial
            )
        ),
        "0"
    );
    assert.equal(
        formatCostExpression(
            simplifyCostExpression(
                Cost.difference(
                    Cost.sum([N, M]),
                    N
                )
            )
        ),
        "m"
    );
});

test("el dominio distingue cancelación, signo y cota superior", () => {
    const cases = [
        {
            expression: Cost.difference(
                Cost.sum([
                    N,
                    Cost.constant(1)
                ]),
                N
            ),
            notation: "O(1)",
            boundKind: "tight"
        },
        {
            expression: Cost.difference(
                Cost.power(
                    N,
                    Cost.constant(2)
                ),
                N
            ),
            notation: "O(n^2)",
            boundKind: "tight"
        },
        {
            expression: Cost.difference(
                N,
                M
            ),
            notation: "O(n + m)",
            boundKind: "upper"
        },
        {
            expression: Cost.maximum([
                Cost.constant(0),
                Cost.difference(
                    Cost.constant(1),
                    N
                )
            ]),
            notation: "O(1)",
            boundKind: "tight"
        }
    ];

    for (const expected of cases) {
        const analysis = analyzeExpression(
            expected.expression
        );

        assert.equal(
            analysis.notation,
            expected.notation
        );
        assert.equal(
            analysis.boundKind,
            expected.boundKind
        );
    }
});

test("la jerarquía asintótica satisface propiedades metamórficas", () => {
    const classifier =
        new AsymptoticClassifier();
    const iteratedLog = Cost.logarithm(
        Cost.logarithm(N)
    );
    const hierarchy = [
        Cost.constant(1),
        iteratedLog,
        Cost.logarithm(N),
        Cost.power(
            N,
            Cost.constant(0.1)
        ),
        N,
        Cost.product([
            N,
            Cost.logarithm(N)
        ]),
        Cost.power(
            N,
            Cost.constant(2)
        ),
        Cost.power(
            Cost.constant(2),
            N
        ),
        Cost.factorial(N)
    ].map(expression =>
        classifier.classify(expression)
    );

    for (
        let index = 1;
        index < hierarchy.length;
        index++
    ) {
        assert.equal(
            orderDominates(
                hierarchy[index],
                hierarchy[index - 1]
            ),
            true,
            `jerarquía ${index - 1} < ${index}`
        );
    }

    const sum = classifier.classify(
        Cost.sum([
            iteratedLog,
            Cost.power(
                N,
                Cost.constant(100)
            )
        ])
    );

    assert.equal(
        orderDominates(
            sum,
            classifier.classify(
                iteratedLog
            )
        ),
        true
    );
    assert.equal(
        createAsymptoticAnalysis(
            classifier.classify(
                Cost.minimum([
                    iteratedLog,
                    Cost.power(
                        N,
                        Cost.constant(100)
                    )
                ])
            )
        ).notation,
        "O(log log n)"
    );
});

test("un rango multivariable no se presenta como Theta sin relación probada", () => {
    const { ast } = parseSource([
        "RANGO(n, m)",
        "    para i = m hasta n",
        "        escribir i"
    ].join("\n"));
    const report = new CostAnalysisVisitor()
        .costAnalysis(ast);
    const node = report.statementsCost[0];
    const built = new ComplexityReportBuilder()
        .build(report)
        .functions[0]
        .worst;

    assert.equal(node.bigO, "O(n + m)");
    assert.equal(
        node.asymptoticAnalysis.boundKind,
        "upper"
    );
    assert.equal(
        node.scenarioAsymptoticAnalysis
            .confidence.worst,
        "upper-bound"
    );
    assert.equal(
        built.conclusion.kind,
        "upper-bound"
    );
    assert.equal(
        built.conclusion.operator,
        "O"
    );
});

test("conserva el costo de llamadas anidadas en literales de arreglo", () => {
    const { ast } = parseSource([
        "DUPLICA(valor)",
        "    retornar valor + valor",
        "PRINCIPAL()",
        "    datos = [1, DUPLICA(2), [DUPLICA(3), 4]]",
        "    escribir LONG(datos)"
    ].join("\n"));
    const report = new CostAnalysisVisitor()
        .costAnalysis(ast);
    const principal = report.statementsCost[1];
    const assignment = principal.instructions[0];

    assert.equal(
        assignment.expression,
        "c + TDUPLICA(2) + TDUPLICA(3)"
    );
    assert.equal(assignment.bigO, "O(1)");
    assert.equal(principal.bigO, "O(1)");
});

test("un rango con extremos afines equivalentes conserva costo constante", () => {
    const { ast } = parseSource([
        "CERCA(n)",
        "    para i = n hasta n + 1",
        "        escribir i"
    ].join("\n"));
    const node = new CostAnalysisVisitor()
        .costAnalysis(ast)
        .statementsCost[0];

    assert.equal(node.bigO, "O(1)");
    assert.equal(
        node.asymptoticAnalysis.boundKind,
        "tight"
    );
});

function analyzeExpression(expression) {
    return createAsymptoticAnalysis(
        new AsymptoticClassifier()
            .classify(expression)
    );
}
