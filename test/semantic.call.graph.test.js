import test from "node:test";
import assert from "node:assert/strict";

import {
    DirectedCallGraph
} from "../src/call-graph/index.js";
import {
    CompilationService
} from "../src/compiler/services/CompilationService.js";
import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    getSemanticCallGraph,
    SemanticCallVertexKind
} from "../src/semantic/SemanticCallGraph.js";

const SOURCE = [
    "dato = BASE(1)",
    "BASE(n)",
    "    retornar n",
    "PAR(n)",
    "    si n > 0",
    "        retornar IMPAR(n - 1)",
    "    retornar VERDAD",
    "IMPAR(n)",
    "    si n > 0",
    "        retornar PAR(n - 1)",
    "    retornar FALSO",
    "USA(q)",
    "    longitud = LONG(q)",
    "    retornar BASE(q) + PAR(q)"
].join("\n");

test("comparte una topología dirigida neutral y determinista", () => {
    const vertices = [
        Object.freeze({ id: "A" }),
        Object.freeze({ id: "B" }),
        Object.freeze({ id: "C" })
    ];
    const edges = [
        Object.freeze({ source: "A", target: "B" }),
        Object.freeze({ source: "B", target: "A" }),
        Object.freeze({ source: "C", target: "A" })
    ];
    const graph = new DirectedCallGraph({
        vertices,
        edges,
        getVertexId: vertex => vertex.id,
        getEdgeSource: edge => edge.source,
        getEdgeTarget: edge => edge.target
    });

    assert.equal(graph.getVertex("A"), vertices[0]);
    assert.equal(graph.outgoing("A")[0], edges[0]);
    assert.equal(graph.incoming("A").length, 2);
    assert.deepEqual(
        graph.getComponent("A").vertexIds,
        ["A", "B"]
    );
    assert.equal(
        graph.getComponent("A").recursive,
        true
    );
    assert.equal(
        graph.getComponent("A").mutual,
        true
    );
    assert.deepEqual(
        graph.evaluationOrder.map(
            component => component.vertexIds
        ),
        [["A", "B"], ["C"]]
    );
    assert.equal(Object.isFrozen(graph), true);
    assert.equal(
        Object.isFrozen(graph.edges),
        true
    );
});

test("deriva llamadas resueltas sin activar el análisis de costo", () => {
    const snapshot = analyzeSource();

    assert.equal(snapshot.ok, true);
    assert.equal(
        snapshot.hasCostAnalysis,
        false
    );

    const graph =
        getSemanticCallGraph(snapshot);

    assert.equal(
        getSemanticCallGraph(snapshot),
        graph
    );
    assert.equal(
        snapshot.hasCostAnalysis,
        false
    );
    assert.deepEqual(
        graph.vertices.map(vertex => [
            vertex.kind,
            vertex.name
        ]),
        [
            [
                SemanticCallVertexKind.PROGRAM,
                "<programa>"
            ],
            [
                SemanticCallVertexKind.FUNCTION,
                "BASE"
            ],
            [
                SemanticCallVertexKind.FUNCTION,
                "PAR"
            ],
            [
                SemanticCallVertexKind.FUNCTION,
                "IMPAR"
            ],
            [
                SemanticCallVertexKind.FUNCTION,
                "USA"
            ]
        ]
    );
    assert.deepEqual(
        graph.outgoing("<programa>")
            .map(edge => edge.calleeName),
        ["BASE"]
    );
    assert.deepEqual(
        graph.outgoing("USA")
            .map(edge => edge.calleeName),
        ["BASE", "PAR"]
    );
    assert.deepEqual(
        graph.incoming("BASE")
            .map(edge => edge.callerName),
        ["<programa>", "USA"]
    );
    assert.equal(
        graph.edges.some(
            edge => edge.calleeName === "LONG"
        ),
        false
    );

    const recursive =
        graph.recursiveComponents();

    assert.equal(recursive.length, 1);
    assert.deepEqual(
        recursive[0].vertices.map(
            vertex => vertex.name
        ),
        ["PAR", "IMPAR"]
    );
    assert.equal(recursive[0].mutual, true);
});

test("conserva rangos para definiciones y sitios de llamada", () => {
    const graph = getSemanticCallGraph(
        analyzeSource()
    );
    const call = graph.findCallAt({
        line: 10,
        column: 20
    });
    const definition = graph.findVertexAt({
        line: 4,
        column: 2
    });

    assert.ok(call);
    assert.equal(call.callerName, "IMPAR");
    assert.equal(call.calleeName, "PAR");
    assert.equal(call.location.startLine, 10);
    assert.equal(definition.name, "PAR");
    assert.equal(
        graph.getVertex(definition.symbol),
        definition
    );
    assert.deepEqual(
        graph.getVertex("USA").parameters
            .map(parameter => parameter.name),
        ["q"]
    );
});

test("produce un grafo vacío para snapshots sin análisis válido", () => {
    const graph = getSemanticCallGraph(null);

    assert.deepEqual(graph.vertices, []);
    assert.deepEqual(graph.edges, []);
    assert.deepEqual(graph.components, []);
    assert.equal(
        graph.findCallAt({
            line: 1,
            column: 1
        }),
        null
    );
});

test("registra llamadas anidadas en arreglos literales con sus ubicaciones", () => {
    const sourceCode = [
        "DUPLICA(valor)",
        "    retornar valor * 2",
        "PRINCIPAL()",
        "    datos = [DUPLICA(1), [DUPLICA(2)]]"
    ].join("\n");
    const graph = getSemanticCallGraph(
        analyzeSource(sourceCode)
    );
    const calls = graph.outgoing(
        "PRINCIPAL"
    );

    assert.deepEqual(
        calls.map(call => ({
            callee: call.calleeName,
            line:
                call.location.startLine,
            column:
                call.location.startColumn
        })),
        [
            {
                callee: "DUPLICA",
                line: 4,
                column: 14
            },
            {
                callee: "DUPLICA",
                line: 4,
                column: 27
            }
        ]
    );
    assert.equal(
        graph.findCallAt({
            line: 4,
            column: 30
        }).calleeName,
        "DUPLICA"
    );
});

function analyzeSource(sourceCode = SOURCE) {
    const compilationService =
        new CompilationService();
    const service =
        new DocumentAnalysisService({
            languageDiagnosticsService:
                new LanguageDiagnosticsService(),
            analyzeCost:
                ast =>
                    compilationService
                        .analyzeCostAST(ast)
        });

    return service.analyze({
        key: "file:///grafo.clrs",
        version: 1,
        sourceCode
    });
}
