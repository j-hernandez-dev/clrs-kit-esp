import test from "node:test";
import assert from "node:assert/strict";

import {
    CostExpressionKind
} from "../src/complex/algebra/CostExpression.js";
import {
    CostExpressionFactory as Cost
} from "../src/complex/algebra/CostExpressionFactory.js";
import {
    formatCostExpression
} from "../src/complex/algebra/CostExpressionFormatter.js";
import {
    simplifyCostExpression
} from "../src/complex/algebra/CostExpressionSimplifier.js";
import {
    costSubstitution,
    substitution
} from "../src/complex/LibrarySubstitution.js";
import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    ComplexAnalysisError
} from "../src/errors/ComplexAnalysisError.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

const C = Cost.symbol("c");
const N = Cost.symbol("n");

test("el álgebra de costos es inmutable y conserva el formato histórico", () => {
    const expression =
        Cost.sum([
            C,
            Cost.product([
                Cost.group(
                    Cost.sum([
                        N,
                        Cost.constant(1)
                    ])
                ),
                Cost.group(C)
            ])
        ]);

    assert.equal(
        formatCostExpression(
            expression
        ),
        "c + (n + 1)(c)"
    );
    assert.equal(
        Object.isFrozen(expression),
        true
    );
    assert.equal(
        Object.isFrozen(
            expression.terms
        ),
        true
    );
    assert.throws(
        () => Cost.sum(["c"]),
        error =>
            error instanceof
                ComplexAnalysisError &&
            error.code ===
                "CLRS_INVALID_COST_EXPRESSION"
    );
});

test("el simplificador aplica sólo identidades algebraicas seguras", () => {
    const expression =
        Cost.sum([
            C,
            C,
            Cost.constant(0),
            Cost.product([
                Cost.constant(2),
                C
            ]),
            Cost.product([
                N,
                N
            ])
        ]);
    const simplified =
        simplifyCostExpression(
            expression
        );

    assert.equal(
        formatCostExpression(
            simplified
        ),
        "4c + n^2"
    );
    assert.equal(
        simplified.kind,
        CostExpressionKind.SUM
    );
    assert.equal(
        Object.isFrozen(simplified),
        true
    );

    const groupedProduct =
        simplifyCostExpression(
            Cost.product([
                Cost.group(
                    Cost.sum([
                        N,
                        Cost.constant(1)
                    ])
                ),
                C
            ])
        );

    assert.equal(
        formatCostExpression(
            groupedProduct
        ),
        "(n + 1)c"
    );
});

test("las sustituciones de biblioteca ofrecen modelo y fachada textual", () => {
    const medianCost =
        costSubstitution("MED");

    assert.equal(
        medianCost.kind,
        CostExpressionKind.GROUP
    );
    assert.equal(
        formatCostExpression(
            medianCost
        ),
        "(n log n)"
    );
    assert.equal(
        substitution("MED"),
        "(n log n)"
    );
    assert.equal(
        costSubstitution("DESCONOCIDA"),
        null
    );
});

test("diferencias y cocientes conservan precedencia y simplificación", () => {
    const difference =
        Cost.difference(
            N,
            Cost.sum([
                C,
                Cost.constant(1)
            ])
        );
    const quotient =
        Cost.quotient(
            Cost.sum([
                N,
                Cost.constant(1)
            ]),
            Cost.product([
                Cost.constant(2),
                C
            ])
        );

    assert.equal(
        formatCostExpression(
            difference
        ),
        "n - (c + 1)"
    );
    assert.equal(
        formatCostExpression(
            quotient
        ),
        "(n + 1) / (2c)"
    );
    assert.equal(
        formatCostExpression(
            simplifyCostExpression(
                Cost.difference(
                    N,
                    N
                )
            )
        ),
        "0"
    );
    assert.equal(
        formatCostExpression(
            simplifyCostExpression(
                Cost.quotient(
                    N,
                    N
                )
            )
        ),
        "1"
    );
});

test("el visitante conserva expresiones de condicionales y ciclos", () => {
    const conditionalNodes =
        analyzeAndFlatten([
            "EVALUA(a,b)",
            "    si F(a)",
            "        escribir a",
            "    sino si G(b)",
            "        escribir b",
            "    sino",
            "        escribir 0"
        ].join("\n"));
    const loopNodes =
        analyzeAndFlatten([
            "CICLOS(n)",
            "    mientras H(n)",
            "        escribir n",
            "    para i <- 0 hasta n",
            "        escribir i"
        ].join("\n"));

    assert.deepEqual(
        conditionalNodes.map(
            node => [
                node.type,
                node.expression
            ]
        ),
        [
            [
                "FunctionDeclaration",
                "TEVALUA(a, b) = max(c + TF(a) + (c), 2c + TF(a) + TG(b) + (c), 2c + TF(a) + TG(b) + (c))"
            ],
            [
                "IfBlock",
                "max(c + TF(a) + (c), 2c + TF(a) + TG(b) + (c), 2c + TF(a) + TG(b) + (c))"
            ],
            [
                "IfStatement",
                "c + TF(a) + (c)"
            ],
            [
                "WriteStatement",
                "c"
            ],
            [
                "ElseIfStatement",
                "2c + TF(a) + TG(b) + (c)"
            ],
            [
                "WriteStatement",
                "c"
            ],
            [
                "ElseStatement",
                "2c + TF(a) + TG(b) + (c)"
            ],
            [
                "WriteStatement",
                "c"
            ]
        ]
    );
    assert.deepEqual(
        loopNodes.map(
            node => [
                node.type,
                node.expression
            ]
        ),
        [
            [
                "FunctionDeclaration",
                "TCICLOS(n) = c + TH(n) + ? (c + TH(n) + (c)) + c + (max(0, n + 1) + 1)(c) + max(0, n + 1)(c + (c))"
            ],
            [
                "WhileBlock",
                "c + TH(n) + ? (c + TH(n) + (c))"
            ],
            [
                "WhileStatement",
                "c + TH(n) + ? (c + TH(n) + (c))"
            ],
            [
                "WriteStatement",
                "c"
            ],
            [
                "ForBlock",
                "c + (max(0, n + 1) + 1)(c) + max(0, n + 1)(c + (c))"
            ],
            [
                "ForStatement",
                "c + (max(0, n + 1) + 1)(c) + max(0, n + 1)(c + (c))"
            ],
            [
                "WriteStatement",
                "c"
            ]
        ]
    );
});

test("el visitante estructura costos de biblioteca sin alterar su salida", () => {
    const [functionNode] =
        analyzeAndFlatten([
            "PROCESA(datos)",
            "    x <- MED(datos)",
            "    escribir VAR(datos), ORDENA(datos), ABS(x)"
        ].join("\n"));

    assert.equal(
        functionNode.expression,
        "TPROCESA(datos) = c + (n log n) + c + (2n) + (n log n) + c"
    );
    assert.equal(
        functionNode.costExpression.kind,
        CostExpressionKind.EQUATION
    );
    assert.equal(
        formatCostExpression(
            functionNode.costExpression
        ),
        functionNode.expression
    );
    assert.equal(
        formatCostExpression(
            functionNode
                .simplifiedCostExpression
        ),
        functionNode
            .simplifiedExpression
    );
    assert.deepEqual(
        Object.keys(functionNode),
        [
            "type",
            "location",
            "expression",
            "instructions"
        ]
    );
    assert.equal(
        Object.hasOwn(
            JSON.parse(
                JSON.stringify(
                    functionNode
                )
            ),
            "costExpression"
        ),
        false
    );
});

function analyzeAndFlatten(source) {
    const { ast } =
        parseSource(source);
    const report =
        new CostAnalysisVisitor()
            .costAnalysis(ast);

    return report.statementsCost
        .flatMap(flattenCostNode);
}

function flattenCostNode(node) {
    return [
        node,
        ...(node.instructions ?? [])
            .flatMap(flattenCostNode)
    ];
}
