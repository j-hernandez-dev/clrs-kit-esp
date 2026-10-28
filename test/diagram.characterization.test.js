import test from "node:test";
import assert from "node:assert/strict";

import {
    generateDiagram
} from "../frontend/src/builders/DiagramGenerator.js";
import {
    buildNode
} from "../frontend/src/builders/NodeBuilder.js";
import {
    build
} from "../frontend/src/visitor/DiagramVisitor.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

const simpleSource = [
    "dato = -1e2",
    "escribir dato"
].join("\n");

const NBSP = "\u00a0";

const complexSource = [
    "SUMA(a, b)",
    "    si a > b",
    "        retornar a",
    "    sino",
    "        retornar b",
    "PRINCIPAL()",
    "    i = 0",
    "    mientras i < 2",
    "        escribir i",
    "        i = i + 1",
    "    para j = 2 bajando 0",
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
            `_N1([\"${NBSP.repeat(3)}Inicio${NBSP.repeat(3)}\"])`,
            `_N2[\"dato = -100${NBSP}\"]`,
            `_N3[/\"Salida dato${NBSP}\"/]`,
            `_N4([\"${NBSP.repeat(4)}Fin${NBSP.repeat(5)}\"])`,
            "_N1 _E1@--> _N2",
            "_N2 _E2@--> _N3",
            "_N3 _E3@--> _N4",
            "",
            "class _N1 node-start",
            "class _N2 node-process",
            "class _N3 node-write",
            "class _N4 node-return"
        ].join("\n")
    );
});

test("normaliza el tamaño mínimo sin alterar los rombos", () => {
    assert.equal(
        buildNode({
            id: "FIN",
            type: "return",
            label: "Fin"
        }),
        `_FIN([\"${NBSP.repeat(4)}Fin${NBSP.repeat(5)}\"])`
    );
    assert.equal(
        buildNode({
            id: "CONDICION",
            type: "decision",
            label: "x"
        }),
        '_CONDICION{"x"}'
    );

    assert.equal(
        buildNode({
            id: "INICIO_FUNCION",
            type: "start",
            label: "PRINCIPAL(args)"
        }),
        '_INICIO_FUNCION(["PRINCIPAL(args)"])'
    );
    assert.equal(
        buildNode({
            id: "RETORNO",
            type: "return",
            label: "Retornar resultado"
        }),
        '_RETORNO(["Retornar resultado"])'
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

    const assignment =
        diagram.subgraphs[1].nodes[1];

    assert.deepEqual(
        assignment.location,
        {
            startLine: 7,
            startColumn: 5,
            endLine: 7,
            endColumn: 9
        }
    );
    assert.equal(
        Object.keys(assignment)
            .includes("location"),
        false
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
    assert.deepEqual(
        collectIdentities(second),
        collectIdentities(first)
    );
});

test("identifica nodos editables y puntos de inserción de flechas", () => {
    const source = [
        "AUX(valor)",
        "    retornar valor",
        "PRINCIPAL()",
        "    dato = 0",
        "    leer dato",
        "    escribir dato",
        "    si dato == 0",
        "        escribir dato",
        "    sino",
        "        leer dato",
        "    mientras dato < 1",
        "        dato = dato + 1",
        "    para i = 0 hasta 1",
        "        escribir i",
        "    para j = 1 bajando 0",
        "        escribir j",
        "    AUX(dato)",
        "    retornar dato"
    ].join("\n");
    const diagram = build(
        parseSource(source).ast
    );
    const identities = collectIdentities(
        diagram
    );
    const nodes = identities.filter(
        identity =>
            identity.entityType === "node"
    );
    const edges = identities.filter(
        identity =>
            identity.entityType === "edge"
    );
    const editableFigures = new Set(
        nodes
            .filter(identity =>
                identity.editable
            )
            .map(identity => identity.figure)
    );

    assert.deepEqual(
        editableFigures,
        new Set([
            "return",
            "assignment",
            "read",
            "write",
            "if",
            "while",
            "for-to",
            "for-downto",
            "function-call",
            "function-declaration"
        ])
    );
    const declarationNodes = nodes.filter(
        identity =>
            identity.figure ===
                "function-declaration"
    );
    assert.equal(
        declarationNodes
            .filter(identity =>
                identity.id.endsWith(
                    "/declaration"
                )
            )
            .every(identity =>
                identity.deletable === true
            ),
        true
    );
    assert.equal(
        nodes.some(identity =>
            identity.figure ===
                "function-call" &&
            identity.deletable === false &&
            identity.source?.type ===
                "FunctionDeclaration"
        ),
        true
    );
    assert.ok(
        nodes
            .filter(identity =>
                identity.editable
            )
            .every(identity =>
                identity.editor != null &&
                Object.isFrozen(
                    identity.editor
                )
            )
    );
    assert.deepEqual(
        nodes.find(identity =>
            identity.figure === "assignment" &&
            identity.editor?.target === "dato"
        )?.editor,
        {
            target: "dato",
            expression: "0"
        }
    );
    assert.deepEqual(
        nodes.find(identity =>
            identity.figure === "for-to"
        )?.editor,
        {
            variable: "i",
            initialValue: "0",
            finalValue: "1"
        }
    );
    assert.ok(
        nodes.some(identity =>
            !identity.editable &&
            identity.figure == null
        )
    );
    assert.ok(
        edges.every(identity =>
            identity.id.startsWith("edge:E")
        )
    );
    assert.equal(
        new Set(
            identities.map(identity =>
                identity.id
            )
        ).size,
        identities.length
    );

    const thenArrow = edges.find(identity =>
        identity.relation === "branch" &&
        identity.insertion?.branch === "then"
    );
    const loopBack = edges.find(identity =>
        identity.relation === "loop-back"
    );

    assert.deepEqual(
        thenArrow.insertion,
        {
            scopeId: "function_PRINCIPAL",
            containerId:
                "function_PRINCIPAL/body/" +
                "statement:3/then",
            branch: "then",
            index: 0,
            position: "start"
        }
    );
    assert.equal(loopBack.editable, true);
    assert.equal(
        loopBack.insertion.position,
        "end"
    );
    assert.ok(
        identities.every(Object.isFrozen)
    );

    const editableNode = [
        ...diagram.subgraphs
            .flatMap(item => item.nodes)
    ].find(node =>
        node.identity?.editable
    );

    assert.equal(
        Object.keys(editableNode)
            .includes("identity"),
        false
    );
});

test("caracteriza lectura, arreglos, lógica y sino-si", () => {
    const source = [
        "PRINCIPAL(A[])",
        "    leer A[i]",
        "    si no (A[i] == 0) y VERDAD o FALSO",
        "        escribir A[i], F(A[i])",
        "    sino si A[i] < 0",
        "        A[i] = -A[i]",
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
                "PRINCIPAL(A[])"
            ],
            ["read", "Entrada A[i]"],
            [
                "decision",
                "no (A[i] == 0) y VERDAD o FALSO"
            ],
            [
                "write",
                "Salida A[i], F(A[i])"
            ],
            ["decision", "A[i] < 0"],
            [
                "process",
                "A[i] = -A[i]"
            ],
            [
                "return",
                "Retornar FALSO"
            ],
            ["merge", ""],
            ["return", "Fin"]
        ]
    );
});

test("no crea un cruce huérfano cuando las ramas anidadas retornan", () => {
    const source = [
        "CALCULAR(a, b, operacion)",
        "    si operacion == \"+\"",
        "        retornar a + b",
        "    sino si operacion == \"-\"",
        "        retornar a - b",
        "    sino si operacion == \"*\"",
        "        retornar a * b",
        "    sino si operacion == \"/\"",
        "        si b == 0",
        "            escribir \"No se puede dividir entre 0\"",
        "            retornar 0",
        "        sino",
        "            retornar a / b",
        "    sino si operacion == \"%\"",
        "        si b == 0",
        "            escribir \"No se puede dividir entre 0\"",
        "            retornar 0",
        "        sino",
        "            retornar a % b",
        "    sino",
        "        escribir \"Operación no válida\"",
        "        retornar 0",
        "PRINCIPAL()",
        "    resultado = CALCULAR(8, 2, \"/\")",
        "    escribir resultado"
    ].join("\n");
    const diagram = build(
        parseSource(source).ast
    );
    const functionDiagram =
        diagram.subgraphs.find(
            subgraph =>
                subgraph.id ===
                    "function_CALCULAR"
        );

    assert.ok(functionDiagram);
    assert.equal(
        functionDiagram.nodes.some(
            node => node.type === "merge"
        ),
        false
    );
    assert.equal(
        functionDiagram.nodes.filter(
            node => node.type === "return"
        ).length,
        8
    );
    assert.ok(
        functionDiagram.edges.every(
            edge => edge.source && edge.target
        )
    );
});

test("proyecta literales de arreglo en etiquetas y editores sincronizados", () => {
    const source = [
        "DUPLICA(valor)",
        "    retornar valor * 2",
        "PRINCIPAL()",
        "    datos = [1, [2, 3], DUPLICA(4)]",
        "    escribir datos"
    ].join("\n");
    const diagram = build(
        parseSource(source).ast
    );
    const principal =
        diagram.subgraphs.find(
            subgraph =>
                subgraph.id ===
                    "function_PRINCIPAL"
        );
    const assignment =
        principal.nodes.find(
            node =>
                node.type === "process"
        );

    assert.equal(
        assignment.label,
        "datos = [1, [2, 3], DUPLICA(4)]"
    );
    assert.deepEqual(
        assignment.identity.editor,
        {
            target: "datos",
            expression:
                "[1, [2, 3], DUPLICA(4)]"
        }
    );
    assert.deepEqual(
        assignment.location,
        {
            startLine: 4,
            startColumn: 5,
            endLine: 4,
            endColumn: 35
        }
    );
});

test("conserva completa una cota compuesta y escapa comillas", () => {
    const source = [
        "PROCESA(A)",
        "    n = LONG(A)",
        "    para i = 0 hasta n - 1",
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
        "Para i = 0 hasta n - 1"
    );
    assert.match(
        mermaid,
        /Para i = 0 hasta n - 1/
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
                        label: "SUMA(a, b)"
                    },
                    {
                        id: "N2",
                        type: "decision",
                        label: "a > b"
                    },
                    {
                        id: "N3",
                        type: "return",
                        label: "Retornar a"
                    },
                    {
                        id: "N4",
                        type: "return",
                        label: "Retornar b"
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
                        label: "PRINCIPAL()"
                    },
                    {
                        id: "N6",
                        type: "process",
                        label: "i = 0"
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
                        label: "i = i + 1"
                    },
                    {
                        id: "N10",
                        type: "preparation",
                        label: "Para j = 2 bajando 0"
                    },
                    {
                        id: "N11",
                        type: "decision",
                        label: "j >= 0"
                    },
                    {
                        id: "N12",
                        type: "write",
                        label: "Salida j"
                    },
                    {
                        id: "N13",
                        type: "call",
                        label: "SUMA(i, 2)",
                        reference: {
                            type: "function",
                            name: "SUMA",
                            subgraphId:
                                "function_SUMA"
                        }
                    },
                    {
                        id: "N14",
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
                    edge("N10", "N11"),
                    edge("N11", "N12", "Sí"),
                    edge("N11", "N13", "No"),
                    edge("N12", "N10"),
                    edge("N13", "N14")
                ]
            },
            {
                id: "top_level",
                title: "Flujo global",
                nodes: [
                    {
                        id: "N15",
                        type: "start",
                        label: "Inicio"
                    },
                    {
                        id: "N16",
                        type: "call",
                        label: "PRINCIPAL()",
                        reference: {
                            type: "function",
                            name: "PRINCIPAL",
                            subgraphId:
                                "function_PRINCIPAL"
                        }
                    },
                    {
                        id: "N17",
                        type: "return",
                        label: "Fin"
                    }
                ],
                edges: [
                    edge("N15", "N16"),
                    edge("N16", "N17")
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

function collectIdentities(diagram) {
    return [
        ...(diagram.nodes ?? []),
        ...(diagram.edges ?? []),
        ...(diagram.subgraphs ?? [])
            .flatMap(subgraph => [
                ...(subgraph.nodes ?? []),
                ...(subgraph.edges ?? [])
            ])
    ].map(entity => entity.identity);
}
