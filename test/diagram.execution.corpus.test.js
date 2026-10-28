import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    createDiagramPlaybackTrace,
    findDiagramExecutionNode,
    projectDiagramExecutionEdges
} from "../frontend/src/execution/DiagramExecutionProjection.js";
import { generateDiagram } from "../frontend/src/builders/DiagramGenerator.js";
import {
    DIAGRAM_NODE_ROLES,
    getDiagramEdges
} from "../frontend/src/visitor/DiagramEditableIdentity.js";
import { build } from "../frontend/src/visitor/DiagramVisitor.js";
import { getDiagramNodes } from "../frontend/src/interaction/DiagramSelection.js";
import { parseSource } from "../src/language/LanguageFrontend.js";
import { SemanticAnalyzer } from "../src/semantic/SemanticAnalyzer.js";

const corpus = json(
    "./fixtures/diagram-execution-corpus.v1.json"
);

test("el corpus visual A-Q es versionado, completo y parte del cierre de release", () => {
    assert.equal(corpus.schemaVersion, 1);
    assert.equal(
        corpus.suite,
        "CLRS diagram visual execution A-Q regression corpus"
    );
    assert.deepEqual(
        corpus.cases.map(fixture => fixture.id),
        corpus.requiredCases
    );
    assert.deepEqual(
        corpus.compatibilityEvidence.map(item => item.id),
        corpus.requiredCompatibility
    );
    assert.equal(
        new Set(corpus.requiredCases).size,
        17
    );

    const manifest = json("../package.json");
    const unitScript = manifest.scripts["test:unit"];
    const diagramScript =
        manifest.scripts["test:diagram:corpus"];

    assert.match(
        unitScript,
        /test\/diagram\.execution\.corpus\.test\.js/u
    );
    assert.match(
        diagramScript,
        /test\/diagram\.editing\.corpus\.test\.js/u
    );
    assert.match(
        diagramScript,
        /test\/diagram\.execution\.corpus\.test\.js/u
    );
    assert.match(
        manifest.scripts["test:all"],
        /npm run test:unit/u
    );

    for (const area of corpus.compatibilityEvidence) {
        assert.ok(
            area.evidence.length > 0,
            area.id
        );

        for (const [relativePath, testNeedle]
            of area.evidence) {
            const source = readFileSync(
                new URL(
                    `../${relativePath}`,
                    import.meta.url
                ),
                "utf8"
            );

            assert.equal(
                source.includes(testNeedle),
                true,
                `${area.id}:${testNeedle}`
            );
            assert.equal(
                unitScript.includes(
                    relativePath.split("/").at(-1)
                ),
                true,
                `${area.id}:${relativePath}`
            );
        }
    }
});

for (const fixture of corpus.cases) {
    test(`recorrido visual ${fixture.id}: ${fixture.name}`, () => {
        const source = fixture.source.join("\n");
        const { ast } = parseSource(source);

        new SemanticAnalyzer().analyze(ast);
        const diagram = build(ast);
        const modelBefore = JSON.stringify(diagram);
        const mermaidBefore = generateDiagram(diagram);
        const rawSteps = fixture.runtime.map(
            (row, index) => runtimeStep(row, index)
        );
        const runtimeBefore = JSON.stringify(rawSteps);
        const playback = createDiagramPlaybackTrace(
            diagram,
            {
                traceId: `corpus-${fixture.id}`,
                status: fixture.status ?? "correct",
                truncated: false,
                steps: rawSteps
            }
        );
        const nodes = playback.steps.map(step =>
            findDiagramExecutionNode(diagram, step)
        );
        const edgeById = new Map(
            getDiagramEdges(diagram).map(edge => [
                edge.identity.modelId,
                edge
            ])
        );
        const actual = playback.steps.map(
            (step, index) => [
                nodes[index]?.id ?? null,
                nodes[index]?.label ?? null,
                step.presentation.kind,
                step.presentation.frameId ?? null,
                step.presentation.incomingTransition
                    .edgeIds.map(modelId => {
                        const edge = edgeById.get(modelId);
                        return [
                            modelId,
                            edge?.identity?.relation ?? null,
                            edge?.label ?? null
                        ];
                    })
            ]
        );

        assert.deepEqual(actual, fixture.expected);
        assert.equal(
            JSON.stringify(rawSteps),
            runtimeBefore,
            "la normalización no modifica la traza real"
        );
        assert.equal(
            JSON.stringify(diagram),
            modelBefore,
            "la reproducción no modifica el modelo editable"
        );
        assert.equal(
            generateDiagram(diagram),
            mermaidBefore,
            "la proyección no modifica la salida Mermaid/SVG"
        );
        assert.equal(
            getDiagramNodes(diagram).filter(node =>
                node.identity?.role ===
                    DIAGRAM_NODE_ROLES.GLOBAL_START
            ).length,
            1,
            "cada programa conserva un único Inicio global"
        );
        assert.ok(
            getDiagramNodes(diagram).every(node =>
                typeof node.identity?.modelId === "string"
            )
        );
        assert.ok(
            getDiagramEdges(diagram).every(edge =>
                typeof edge.identity?.modelId === "string" &&
                typeof edge.identity?.relation === "string"
            )
        );

        assertAbsentNodes(
            diagram,
            nodes,
            fixture.absentLines ?? []
        );
        assertPrefixes(
            diagram,
            playback.steps,
            nodes,
            fixture.expected
        );

        const traversedRelations = actual.flatMap(row =>
            row[4].map(edge => edge[1])
        );
        for (const relation
            of fixture.absentRelations ?? []) {
            assert.equal(
                traversedRelations.includes(relation),
                false,
                `no debe recorrerse ${relation}`
            );
        }
    });
}

function assertPrefixes(
    diagram,
    steps,
    nodes,
    expected
) {
    const expectedVisited = [];
    const expectedVisitedNodes = [];

    for (let index = 0; index < steps.length; index += 1) {
        if (
            index > 0 &&
            !expectedVisitedNodes.includes(
                expected[index - 1][0]
            )
        ) {
            expectedVisitedNodes.push(
                expected[index - 1][0]
            );
        }

        for (const [modelId] of expected[index][4]) {
            if (!expectedVisited.includes(modelId)) {
                expectedVisited.push(modelId);
            }
        }

        const projection = projectDiagramExecutionEdges(
            diagram,
            steps,
            nodes,
            index
        );

        assert.equal(
            projection.activeTargetId,
            expected[index][0],
            `destino activo del paso ${index}`
        );
        assert.deepEqual(
            projection.activePath.map(edge =>
                edge.identity.modelId
            ),
            expected[index][4].map(edge => edge[0]),
            `aristas de llegada del paso ${index}`
        );
        assert.deepEqual(
            projection.visited.map(edge =>
                edge.identity.modelId
            ),
            expectedVisited,
            `prefijo recorrido hasta el paso ${index}`
        );
        assert.deepEqual(
            projection.visitedNodeIds,
            expectedVisitedNodes,
            `figuras visitadas hasta el paso ${index}`
        );
    }
}

function assertAbsentNodes(
    diagram,
    resolvedNodes,
    absentLines
) {
    const visitedIds = new Set(
        resolvedNodes.map(node => node?.id)
    );

    for (const line of absentLines) {
        const forbidden = getDiagramNodes(diagram)
            .filter(node =>
                node.location?.startLine === line
            );

        assert.ok(
            forbidden.length > 0,
            `la línea ausente ${line} debe identificar una figura`
        );
        assert.ok(
            forbidden.every(node =>
                !visitedIds.has(node.id)
            ),
            `la línea ${line} no debe formar parte del recorrido`
        );
    }
}

function runtimeStep(row, index) {
    const [
        startLine,
        startColumn,
        kind,
        functionName,
        frameId,
        parentFrameId
    ] = row;
    const flow = kind ? {
        kind,
        contextId: 1,
        functionName,
        frameId,
        ...(parentFrameId == null
            ? {}
            : { parentFrameId })
    } : null;

    return {
        index,
        location: { startLine, startColumn },
        ...(flow ? { flow } : {})
    };
}

function json(relativePath) {
    return JSON.parse(
        readFileSync(
            new URL(relativePath, import.meta.url),
            "utf8"
        )
    );
}
