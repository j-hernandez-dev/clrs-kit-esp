import test from "node:test";
import assert from "node:assert/strict";

import {
    generateDiagram
} from "../flow/src/builders/DiagramGenerator.js";
import {
    build
} from "../flow/src/visitor/DiagramVisitor.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

const simpleSource = [
    "dato <- -1e2",
    "escribir dato"
].join("\n");

const complexSource = [
    "SUMA(a, b)",
    "    si a > b",
    "        retornar a",
    "    sino",
    "        retornar b",
    "PRINCIPAL()",
    "    i <- 0",
    "    mientras i < 2",
    "        escribir i",
    "        i <- i + 1",
    "    para j <- 2 bajando 0",
    "        escribir j",
    "    SUMA(i, 2)"
].join("\n");

test("caracteriza el Mermaid del flujo global", () => {
    const diagram = build(
        parseSource(simpleSource).ast
    );

    assert.equal(
        generateDiagram(diagram),
        [
            "flowchart TB",
            "",
            "_N1([\"Inicio\"])",
            "_N2[\"dato &lt;- -100\"]",
            "_N3[/\"Salida dato\"/]",
            "_N4([\"Fin\"])",
            "_N1 --> _N2",
            "_N2 --> _N3",
            "_N3 --> _N4",
            "",
            "class _N1 node-start",
            "class _N2 node-process",
            "class _N3 node-write",
            "class _N4 node-return"
        ].join("\n")
    );
});

test("caracteriza funciones, decisiones y ciclos", () => {
    const diagram = build(
        parseSource(complexSource).ast
    );

    assert.deepEqual(
        diagram,
        expectedComplexDiagram()
    );
});

test("dos generaciones consecutivas conservan IDs deterministas", () => {
    const first = build(
        parseSource(complexSource).ast
    );

    build(parseSource(simpleSource).ast);

    const second = build(
        parseSource(complexSource).ast
    );

    assert.deepEqual(second, first);
});

test("caracteriza lectura, arreglos, lógica y sino-si", () => {
    const source = [
        "PRINCIPAL(A[])",
        "    leer A[i]",
        "    si no (A[i] = 0) y VERDAD",
        "        escribir A[i], F(A[i])",
        "    sino si A[i] < 0",
        "        A[i] <- -A[i]",
        "    sino",
        "        retornar FALSO"
    ].join("\n");
    const diagram = build(
        parseSource(source).ast
    );
    const functionDiagram =
        diagram.subgraphs.find(
            subgraph =>
                subgraph.id ===
                "function_PRINCIPAL"
        );

    assert.deepEqual(
        functionDiagram.nodes.map(
            node => [
                node.type,
                node.label
            ]
        ),
        [
            [
                "start",
                "Inicio\nPRINCIPAL(A[])"
            ],
            ["read", "Entrada A[i]"],
            [
                "decision",
                "No (A[i] = 0) Y Verdadero"
            ],
            [
                "write",
                "Salida A[i], F(A[i])"
            ],
            ["decision", "A[i] < 0"],
            [
                "process",
                "A[i] <- -A[i]"
            ],
            [
                "return",
                "Retornar\nFalso"
            ],
            ["merge", ""],
            ["return", "Fin"]
        ]
    );
});

test("conserva completa una cota compuesta y escapa comillas", () => {
    const source = [
        "PROCESA(A)",
        "    n <- LONG(A)",
        "    para i <- 0 hasta n - 1",
        '        escribir "Elemento", A[i]'
    ].join("\n");
    const diagram = build(
        parseSource(source).ast
    );
    const functionDiagram =
        diagram.subgraphs[0];
    const preparation =
        functionDiagram.nodes.find(
            node =>
                node.type ===
                "preparation"
        );
    const mermaid =
        generateDiagram(diagram);

    assert.equal(
        preparation.label,
        "Para i <- 0 hasta n - 1"
    );
    assert.match(
        mermaid,
        /Para i &lt;- 0 hasta n - 1/
    );
    assert.match(
        mermaid,
        /Salida &quot;Elemento&quot;, A\[i\]/
    );
});

function expectedComplexDiagram() {
    return {
        direction: "TB",
        nodes: [],
        edges: [],
        subgraphs: [
            {
                id: "function_SUMA",
                title: "SUMA",
                nodes: [
                    {
                        id: "N1",
                        type: "start",
                        label: "Inicio\nSUMA(a, b)"
                    },
                    {
                        id: "N2",
                        type: "decision",
                        label: "a > b"
                    },
                    {
                        id: "N3",
                        type: "return",
                        label: "Retornar\na"
                    },
                    {
                        id: "N4",
                        type: "return",
                        label: "Retornar\nb"
                    }
                ],
                edges: [
                    {
                        source: "N1",
                        target: "N2",
                        label: null
                    },
                    {
                        source: "N2",
                        target: "N3",
                        label: "Sí"
                    },
                    {
                        source: "N2",
                        target: "N4",
                        label: "No"
                    }
                ]
            },
            {
                id: "function_PRINCIPAL",
                title: "PRINCIPAL",
                nodes: [
                    {
                        id: "N5",
                        type: "start",
                        label: "Inicio\nPRINCIPAL()"
                    },
                    {
                        id: "N6",
                        type: "process",
                        label: "i <- 0"
                    },
                    {
                        id: "N7",
                        type: "decision",
                        label: "i < 2"
                    },
                    {
                        id: "N8",
                        type: "write",
                        label: "Salida i"
                    },
                    {
                        id: "N9",
                        type: "process",
                        label: "i <- i + 1"
                    },
                    {
                        id: "N10",
                        type: "preparation",
                        label: "Para j <- 2 bajando 0"
                    },
                    {
                        id: "N11",
                        type: "write",
                        label: "Salida j"
                    },
                    {
                        id: "N12",
                        type: "call",
                        label: "SUMA(i, 2)",
                        reference: {
                            type: "function",
                            name: "SUMA",
                            subgraphId: undefined
                        }
                    },
                    {
                        id: "N13",
                        type: "return",
                        label: "Fin"
                    }
                ],
                edges: [
                    edge("N5", "N6"),
                    edge("N6", "N7"),
                    edge("N7", "N8", "Sí"),
                    edge("N7", "N10", "No"),
                    edge("N8", "N9"),
                    edge("N9", "N7"),
                    edge("N10", "N11", "No"),
                    edge("N10", "N12", "Sí"),
                    edge("N11", "N10"),
                    edge("N12", "N13")
                ]
            },
            {
                id: "top_level",
                title: "Flujo global",
                nodes: [
                    {
                        id: "N14",
                        type: "start",
                        label: "Inicio"
                    },
                    {
                        id: "N15",
                        type: "call",
                        label: "PRINCIPAL()",
                        reference: {
                            type: "function",
                            name: "PRINCIPAL",
                            subgraphId: undefined
                        }
                    },
                    {
                        id: "N16",
                        type: "return",
                        label: "Fin"
                    }
                ],
                edges: [
                    edge("N14", "N15"),
                    edge("N15", "N16")
                ]
            }
        ]
    };
}

function edge(
    source,
    target,
    label = null
) {
    return {
        source,
        target,
        label
    };
}
