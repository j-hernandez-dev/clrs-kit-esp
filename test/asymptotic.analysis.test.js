import test from "node:test";
import assert from "node:assert/strict";

import {
    CostExpressionFactory as Cost
} from "../src/complex/algebra/CostExpressionFactory.js";
import {
    AsymptoticAnalysisStatus,
    createAsymptoticAnalysis
} from "../src/complex/asymptotic/AsymptoticAnalysis.js";
import {
    AsymptoticClassifier
} from "../src/complex/asymptotic/AsymptoticClassifier.js";
import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

const C = Cost.symbol("c");
const N = Cost.symbol("n");

test("clasifica constantes, polinomios y productos logarítmicos", () => {
    const cases = [
        [
            Cost.sum([
                C,
                Cost.constant(10)
            ]),
            "O(1)"
        ],
        [
            Cost.sum([
                N,
                Cost.power(
                    N,
                    Cost.constant(2)
                )
            ]),
            "O(n^2)"
        ],
        [
            Cost.product([
                N,
                Cost.logarithm(N)
            ]),
            "O(n log n)"
        ],
        [
            Cost.maximum([
                Cost.logarithm(N),
                N
            ]),
            "O(n)"
        ],
        [
            Cost.quotient(
                Cost.power(
                    N,
                    Cost.constant(2)
                ),
                N
            ),
            "O(n)"
        ]
    ];

    for (
        const [expression, notation]
        of cases
    ) {
        assert.equal(
            analyzeExpression(
                expression
            ).notation,
            notation
        );
    }
});

test("clasifica exponenciales, factoriales y logaritmos de órdenes conocidos", () => {
    const exponential =
        Cost.power(
            Cost.constant(2),
            N
        );
    const cases = [
        [
            exponential,
            "O(2^n)"
        ],
        [
            Cost.factorial(N),
            "O(n!)"
        ],
        [
            Cost.logarithm(
                exponential
            ),
            "O(n)"
        ],
        [
            Cost.logarithm(
                Cost.factorial(N)
            ),
            "O(n log n)"
        ],
        [
            Cost.sum([
                exponential,
                Cost.power(
                    N,
                    Cost.constant(100)
                )
            ]),
            "O(2^n)"
        ],
        [
            Cost.sum([
                Cost.factorial(N),
                exponential
            ]),
            "O(n!)"
        ],
        [
            Cost.power(
                N,
                Cost.symbol("k")
            ),
            "O(n^k)"
        ]
    ];

    for (
        const [expression, notation]
        of cases
    ) {
        assert.equal(
            analyzeExpression(
                expression
            ).notation,
            notation
        );
    }
});

test("conserva términos incomparables de problemas multivariables", () => {
    const result =
        analyzeExpression(
            Cost.sum([
                Cost.symbol("n"),
                Cost.symbol("m")
            ])
        );

    assert.equal(
        result.notation,
        "O(n + m)"
    );
    assert.equal(
        result.status,
        AsymptoticAnalysisStatus
            .DETERMINED
    );
});

test("clasifica programas constantes, lineales, cuadráticos y logarítmicos", () => {
    const cases = [
        [
            [
                "CONSTANTE()",
                "    escribir 1"
            ],
            "O(1)"
        ],
        [
            [
                "LINEAL(n)",
                "    para i <- 0 hasta n - 1",
                "        escribir i"
            ],
            "O(n)"
        ],
        [
            [
                "CUADRATICO(n)",
                "    para i <- 0 hasta n - 1",
                "        para j <- 0 hasta i",
                "            escribir j"
            ],
            "O(n^2)"
        ],
        [
            [
                "LOGARITMICO(n)",
                "    i <- n",
                "    mientras i > 1",
                "        i <- i / 2"
            ],
            "O(log n)"
        ],
        [
            [
                "LINEAL_LOGARITMICO(n)",
                "    para i <- 0 hasta n - 1",
                "        j <- n",
                "        mientras j > 1",
                "            j <- j / 2"
            ],
            "O(n log n)"
        ]
    ];

    for (
        const [lines, notation]
        of cases
    ) {
        const report =
            analyzeSource(lines);

        assert.equal(
            report.statementsCost[0]
                .bigO,
            notation
        );
    }
});

test("resuelve llamadas entre funciones no recursivas", () => {
    const report =
        analyzeSource([
            "AYUDA(n)",
            "    para i <- 0 hasta n - 1",
            "        escribir i",
            "USA(n)",
            "    retornar AYUDA(n)"
        ]);
    const [
        helper,
        consumer
    ] = report.statementsCost;

    assert.equal(
        helper.bigO,
        "O(n)"
    );
    assert.equal(
        consumer.bigO,
        "O(n)"
    );
});

test("normaliza LONG de parámetros estructurales sin alterar la función de costo", () => {
    const report =
        analyzeSource([
            "RECORRE(A, B)",
            "    para i <- 0 hasta LONG(A) - 1",
            "        escribir A[i]",
            "    para j <- 0 hasta LONG(B) - 1",
            "        escribir B[j]",
            "PRINCIPAL()",
            "    RECORRE(A, B)"
        ]);
    const [
        functionNode,
        principal
    ] = report.statementsCost;

    assert.match(
        functionNode.expression,
        /^TRECORRE\(A, B\) = /
    );
    assert.match(
        principal.expression,
        /^TPRINCIPAL\(\) = TRECORRE\(A, B\)$/
    );
    assert.equal(
        functionNode.bigO,
        "O(n + m)"
    );
    assert.equal(
        principal.bigO,
        "O(n + m)"
    );
});

test("presenta el tamaño de un arreglo como n en ciclos anidados", () => {
    const bubble =
        analyzeSource([
            "BURBUJA(A)",
            "    n <- LONG(A)",
            "    para i <- 0 hasta n - 2",
            "        para j <- 0 hasta n - i - 2",
            "            si A[j] > A[j + 1]",
            "                escribir A[j]",
            "    retornar A"
        ]).statementsCost[0];
    const outerLoop =
        bubble.instructions[1]
            .instructions[0];
    const innerLoop =
        outerLoop.instructions[0]
            .instructions[0];

    assert.match(
        bubble.expression,
        /^TBURBUJA\(A\) = /
    );
    assert.equal(
        bubble.bigO,
        "O(n^2)"
    );
    assert.equal(
        outerLoop.bigO,
        "O(n^2)"
    );
    assert.equal(
        innerLoop.bigO,
        "O(n)"
    );
});

test("evita colisiones entre parámetros escalares y tamaños normalizados", () => {
    const functionNode =
        analyzeSource([
            "COMBINA(n, A)",
            "    para i <- 0 hasta n - 1",
            "        escribir i",
            "    para j <- 0 hasta LONG(A) - 1",
            "        escribir A[j]"
        ]).statementsCost[0];

    assert.equal(
        functionNode.bigO,
        "O(n + m)"
    );
});

test("resuelve recurrencias demostrables y conserva costos indeterminados", () => {
    const recursive =
        analyzeSource([
            "RECURSIVA(n)",
            "    si n > 0",
            "        retornar RECURSIVA(n - 1)",
            "    retornar 0"
        ]).statementsCost[0];
    const unknownLoop =
        analyzeSource([
            "H(n)",
            "    retornar VERDAD",
            "DESCONOCIDO(n)",
            "    mientras H(n)",
            "        escribir n"
        ]).statementsCost[1];

    assert.equal(
        recursive.bigO,
        "O(n)"
    );
    assert.equal(
        recursive.recurrenceAnalysis
            .method,
        "substitution"
    );
    assert.equal(
        unknownLoop.bigO,
        "O(?)"
    );
    assert.equal(
        unknownLoop.asymptoticAnalysis
            .code,
        "CLRS_ASYMPTOTIC_UNKNOWN_COST"
    );
});

test("adjunta resultados consultables sin modificar el contrato JSON", () => {
    const report =
        analyzeSource([
            "LINEAL(n)",
            "    para i <- 0 hasta n - 1",
            "        escribir i"
        ]);
    const functionNode =
        report.statementsCost[0];
    const analysis =
        report.asymptoticAnalysis
            .get(functionNode);

    assert.equal(
        analysis,
        functionNode
            .asymptoticAnalysis
    );
    assert.equal(
        analysis.notation,
        "O(n)"
    );
    assert.equal(
        Object.keys(functionNode)
            .includes("bigO"),
        false
    );
    assert.equal(
        Object.keys(report)
            .includes(
                "asymptoticAnalysis"
            ),
        false
    );
    assert.equal(
        JSON.stringify(report)
            .includes("bigO"),
        false
    );
});

function analyzeExpression(expression) {
    const classifier =
        new AsymptoticClassifier();

    return createAsymptoticAnalysis(
        classifier.classify(
            expression
        )
    );
}

function analyzeSource(lines) {
    const { ast } =
        parseSource(
            lines.join("\n")
        );

    return new CostAnalysisVisitor()
        .costAnalysis(ast);
}
