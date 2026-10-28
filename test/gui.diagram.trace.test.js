import test from "node:test";
import assert from "node:assert/strict";
import { guiDapHarness } from "./fixtures/gui/GuiDapHarness.js";
import { parseSource } from "../src/language/LanguageFrontend.js";
import { build } from "../frontend/src/visitor/DiagramVisitor.js";
import { generateDiagram } from "../frontend/src/builders/DiagramGenerator.js";
import { findDiagramNodeAtLocation, getDiagramNodes } from "../frontend/src/interaction/DiagramSelection.js";
import { highlightDiagramExecution } from "../frontend/src/interaction/DiagramDomInteraction.js";
import { createEmptyExecutionTrace, describeExecutionStep, reduceExecutionTrace } from "../frontend/src/execution/ExecutionTraceState.js";
import { ExecutionTraceService } from "../src/runtime/ExecutionTraceService.js";
import {
    createDiagramPlaybackTrace,
    findDiagramExecutionNode,
    projectDiagramExecutionEdges
} from "../frontend/src/execution/DiagramExecutionProjection.js";
import {
    DIAGRAM_NODE_ROLES,
    getDiagramEdges
} from "../frontend/src/visitor/DiagramEditableIdentity.js";

const base = ['PRINCIPAL()', '    VENTANA_APLICACION("v", "Traza")', '    ENTRADA("e")',
    '    CONTENER("v", "e")', '    MOSTRAR("v")', '    DIALOGO_ARCHIVO("f")', '    CONECTAR("e", "cambio", CAMBIO)'];
const flows = f => f.snapshot().steps.filter(step => step.flow);
const last = f => f.snapshot().steps.at(-1);
const waitKind = (f, kind) => f.wait(() => last(f)?.flow?.kind === kind);
async function close(f) { await f.action({ type: "close" }); const result = await f.completion; assert.equal(result.code, 0, result.stderr); }

function normalizePlayback(
    model,
    steps,
    status = "running",
    options = {}
) {
    const trace = createDiagramPlaybackTrace(
        model,
        {
            traceId: options.traceId ?? "test-trace",
            status,
            steps,
            truncated: options.truncated === true
        }
    );

    return {
        trace,
        nodes: trace.steps.map(step =>
            findDiagramExecutionNode(model, step)
        )
    };
}

function playbackLabels(model, trace) {
    return trace.steps.map(step =>
        findDiagramExecutionNode(model, step)
            ?.label ?? null
    );
}

function playbackContract(model, trace) {
    const edges = new Map(
        getDiagramEdges(model).map(edge => [
            edge.identity.modelId,
            edge
        ])
    );

    return trace.steps.map(step => ({
        nodeId: step.presentation.nodeId,
        label:
            findDiagramExecutionNode(model, step)
                ?.label ?? null,
        incoming:
            step.presentation.incomingTransition
                .edgeIds.map(modelId => {
                    const edge = edges.get(modelId);
                    return {
                        modelId,
                        relation:
                            edge?.identity?.relation ??
                            null,
                        label: edge?.label ?? null,
                        source: edge?.source ?? null,
                        target: edge?.target ?? null
                    };
                })
    }));
}

function playbackFrameContract(trace) {
    return trace.steps.map(step => ({
        nodeId: step.presentation.nodeId,
        kind: step.presentation.kind,
        contextId: step.presentation.contextId,
        frameId:
            step.presentation.frameId ?? null,
        parentFrameId:
            step.presentation.parentFrameId ?? null,
        originIndex:
            step.presentation.originIndex,
        edgeIds:
            step.presentation.incomingTransition
                .edgeIds
    }));
}

function svgFor(diagram) {
    const elements = getDiagramNodes(diagram).map(node => {
        const classes = new Set(["node"]);
        return { id: node.id, getAttribute: key => key === "data-id" ? node.id : null,
            classList: { add: (...values) => values.forEach(value => classes.add(value)),
                remove: (...values) => values.forEach(value => classes.delete(value)), contains: value => classes.has(value) } };
    });
    return { elements, querySelectorAll: selector => selector === ".node" ? elements : elements.filter(element =>
        selector.split(",").some(name => element.classList.contains(name.trim().slice(1)))) };
}

test("GUI diagramador: ejecución sin DAP conserva espera, entrada, retorno y reproducción sin figuras nuevas", { timeout: 15000 }, async t => {
    const source = ['AUX(valor)', '    retornar valor', 'CAMBIO(id, texto)', '    copia = AUX(texto)',
        '    ruta = ABRIR_ARCHIVO("f", "v")', '    escribir copia, ruta', ...base].join("\n");
    const model = build(parseSource(source).ast), before = JSON.stringify(model), mermaid = generateDiagram(model);
    const f = await guiDapHarness(source, { debug: false }); t.after(() => f.dispose());
    await waitKind(f, "idle");
    assert.equal(last(f).location, null);
    assert.match(describeExecutionStep(last(f)), /ventana permanece abierta/);
    await f.action({ type: "text", value: "evento" }); await waitKind(f, "wait");
    const wait = last(f);
    assert.equal(wait.location.startLine, 5);
    assert.equal(findDiagramNodeAtLocation(model, wait.location).type, "process");
    assert.match(describeExecutionStep(wait), /cuadro de diálogo/);
    const entry = flows(f).find(s => s.flow.kind === "enter" && s.flow.functionName === "CAMBIO");
    assert.equal(entry.location.startLine, 3);
    assert.ok(Number.isSafeInteger(entry.flow.frameId));
    const returned = flows(f).find(s => s.flow.kind === "return" && s.flow.functionName === "AUX");
    assert.equal(returned.location.startLine, 4, "El retorno vuelve a la llamada sintáctica, no a CONECTAR");
    const auxiliaryEntry = flows(f).find(s =>
        s.flow.kind === "enter" &&
        s.flow.functionName === "AUX"
    );
    assert.equal(
        auxiliaryEntry.flow.parentFrameId,
        entry.flow.frameId
    );
    assert.equal(
        returned.flow.frameId,
        auxiliaryEntry.flow.frameId
    );
    assert.equal(
        returned.flow.parentFrameId,
        entry.flow.frameId
    );
    await f.action({ type: "dialog", value: "/archivo.clrs" }); await waitKind(f, "idle");
    assert.ok(flows(f).some(s => s.flow.kind === "resume" && s.location.startLine === 5));
    await close(f);
    const trace = f.snapshot();
    const mainCall = getDiagramNodes(model).find(node => node.synthetic && node.reference?.name === "PRINCIPAL");
    const globalStart = getDiagramNodes(model).find(node =>
        node.type === "start" && node.label === "Inicio"
    );
    const playback = createDiagramPlaybackTrace(
        model,
        trace
    );
    const resolved = playback.steps.map(step =>
        findDiagramExecutionNode(model, step)
    );
    assert.ok(resolved.some(node => node?.id === mainCall.id), "La marca automática alcanza la llamada PRINCIPAL sintética");
    const mainEntry = trace.steps.find(step => step.flow?.kind === "enter" && step.flow.functionName === "PRINCIPAL");
    assert.equal(findDiagramExecutionNode(model, mainEntry).type, "start", "La entrada sigue señalando la declaración");
    assert.equal(trace.debug, null);
    const svgElement = svgFor(model);
    for (let activeIndex = 0; activeIndex < playback.steps.length; activeIndex++) {
        highlightDiagramExecution({ svgElement, diagram: model, steps: playback.steps,
            resolvedNodes: resolved, activeIndex, status: playback.status });
    }
    assert.ok(svgElement.elements.find(element => element.id === mainCall.id).classList.contains("clrs-diagram-execution-visited"));
    assert.ok(svgElement.elements.find(element => element.id === globalStart.id)
        .classList.contains("clrs-diagram-execution-visited"));
    assert.equal(JSON.stringify(model), before);
    assert.equal(generateDiagram(model), mermaid);
    assert.ok(getDiagramNodes(model).every(node => ["start", "return", "call", "process", "write"].includes(node.type)));
    const waitIndex = trace.steps.indexOf(
        trace.steps.find(s => s.flow?.kind === "wait")
    );
    const waiting = normalizePlayback(
        model,
        trace.steps.slice(0, waitIndex + 1)
    );
    const active = highlightDiagramExecution({ svgElement, diagram: model,
        steps: waiting.trace.steps, resolvedNodes: waiting.nodes,
        activeIndex: waiting.trace.steps.length - 1, status: "running",
        presentationState: waiting.trace.presentationState });
    assert.ok(svgElement.elements.find(e => e.id === active.id).classList.contains("clrs-diagram-execution-waiting"));
    assert.ok(!svgElement.elements.some(e => e.classList.contains("clrs-diagram-execution-live")));
    const idleIndex = trace.steps.findIndex(s => s.flow?.kind === "idle");
    const idle = normalizePlayback(
        model,
        trace.steps.slice(0, idleIndex + 1)
    );
    assert.equal(highlightDiagramExecution({ svgElement, diagram: model,
        steps: idle.trace.steps, resolvedNodes: idle.nodes,
        activeIndex: idle.trace.steps.length - 1,
        presentationState: idle.trace.presentationState }), null);
    assert.ok(!svgElement.elements.some(e => e.classList.contains("clrs-diagram-execution-active")));
    assert.ok(svgElement.elements.find(e => e.id === idle.nodes.at(-1).id)
        .classList.contains("clrs-diagram-execution-visited"));
    assert.doesNotMatch(JSON.stringify(trace.steps), /Gtk|GObject|provider|parameters|locals/);
});

test("diagramador: conexiones ejecutadas siguen la rama observada y las fusiones existentes", () => {
    const model = build(parseSource('x = 0\nPRINCIPAL()\n    x = 1\n    si x > 0\n        escribir "si"\n    sino\n        escribir "no"\n    escribir "fin"').ast);
    const before = JSON.stringify(model);
    const steps = [1, 2, 3, 4, 5, 8].map(startLine => ({ location: { startLine, startColumn: startLine < 3 ? 1 : 5 } }));
    const rawNodes = steps.map(step =>
        findDiagramExecutionNode(model, step)
    );
    assert.equal(rawNodes[1].synthetic, true);
    assert.equal(findDiagramNodeAtLocation(model, steps[1].location).type, "start", "La navegación al código conserva su prioridad");
    const { trace, nodes } = normalizePlayback(
        model,
        steps
    );
    const projection = projectDiagramExecutionEdges(
        model,
        trace.steps,
        nodes,
        trace.steps.length - 1
    );
    assert.equal(projection.activePath.length, 2, "Salida Sí → fusión → siguiente sentencia");
    const unvisited = getDiagramNodes(model).find(node => node.location?.startLine === 7);
    assert.ok(projection.visited.length > 0);
    assert.ok(projection.visited.every(edge => edge.source !== unvisited.id && edge.target !== unvisited.id));
    assert.equal(JSON.stringify(model), before);
    const rewound = projectDiagramExecutionEdges(
        model,
        trace.steps,
        nodes,
        1
    );
    assert.ok(rewound.visited.every(edge => !projection.activePath.includes(edge)));
});

test("diagramador: Inicio y Fin global pertenecen a la secuencia normalizada", () => {
    const model = build(parseSource('valor = 1').ast);
    const steps = [{ location: { startLine: 1, startColumn: 1 } }];
    const running = normalizePlayback(
        model,
        steps
    );
    const complete = normalizePlayback(
        model,
        steps,
        "correct"
    );

    assert.deepEqual(
        playbackLabels(model, running.trace),
        ["Inicio", "valor = 1"]
    );
    assert.deepEqual(
        playbackLabels(model, complete.trace),
        ["Inicio", "valor = 1", "Fin"]
    );
    const projection = projectDiagramExecutionEdges(
        model,
        complete.trace.steps,
        complete.nodes,
        complete.trace.steps.length - 1
    );
    const entry = complete.nodes[0];
    const terminal = complete.nodes.at(-1);

    assert.equal(projection.activeTargetId, terminal.id);
    assert.equal(projection.activeFocusId, terminal.id);
    assert.equal(projection.activePath.at(-1)?.target, terminal.id);
    assert.ok(projection.visited.some(edge =>
        edge.source === entry.id
    ));
    const svgElement = svgFor(model);
    highlightDiagramExecution({ svgElement, diagram: model,
        steps: complete.trace.steps, resolvedNodes: complete.nodes,
        activeIndex: complete.trace.steps.length - 1, status: "correct" });
    assert.ok(svgElement.elements.find(element => element.id === entry.id)
        .classList.contains("clrs-diagram-execution-visited"));
    assert.ok(svgElement.elements.find(element => element.id === terminal.id)
        .classList.contains("clrs-diagram-execution-active"));
    assert.equal(svgElement.elements.find(element => element.id === terminal.id)
        .classList.contains("clrs-diagram-execution-visited"), false);
});

test("diagramador: Inicio ocupa el primer paso presentado antes de la instrucción real", () => {
    const model = build(parseSource('valor = 1').ast);
    const runtimeTrace = {
        traceId: "inicio-presentado",
        status: "running",
        steps: [{ index: 0, location: { startLine: 1, startColumn: 1 } }]
    };
    const playbackTrace = createDiagramPlaybackTrace(model, runtimeTrace);
    const nodes = playbackTrace.steps.map(step => findDiagramExecutionNode(model, step));

    assert.equal(runtimeTrace.steps.length, 1, "La traza del runtime no se modifica");
    assert.equal(playbackTrace.steps.length, 2);
    assert.equal(playbackTrace.steps[0].presentation.kind, "entry");
    assert.equal(describeExecutionStep(playbackTrace.steps[0]), "Inicio del flujo");
    assert.equal(nodes[0].label, "Inicio");
    assert.equal(nodes[1].label, "valor = 1");

    const first = projectDiagramExecutionEdges(model, playbackTrace.steps, nodes, 0);
    const second = projectDiagramExecutionEdges(model, playbackTrace.steps, nodes, 1);
    assert.equal(first.activeFocusId, nodes[0].id);
    assert.ok(second.activePath.some(edge =>
        edge.source === nodes[0].id && edge.target === nodes[1].id
    ));
});

test("diagramador: el flujo global vacío normaliza exactamente Inicio → Fin", () => {
    const model = build(parseSource("").ast);
    const runtimeTrace = {
        traceId: null,
        status: "correct",
        steps: []
    };
    const playback = createDiagramPlaybackTrace(
        model,
        runtimeTrace
    );
    const globalStarts = getDiagramNodes(model)
        .filter(node =>
            node.identity?.role ===
                DIAGRAM_NODE_ROLES.GLOBAL_START
        );

    assert.equal(globalStarts.length, 1);
    assert.deepEqual(
        playbackContract(model, playback),
        [
            {
                nodeId: "N1",
                label: "Inicio",
                incoming: []
            },
            {
                nodeId: "N2",
                label: "Fin",
                incoming: [{
                    modelId: "E1",
                    relation: "exit",
                    label: null,
                    source: "N1",
                    target: "N2"
                }]
            }
        ]
    );
    assert.deepEqual(runtimeTrace.steps, []);
});

test("diagramador: Proceso, Entrada y Salida forman una secuencia lineal exacta", () => {
    const model = build(parseSource([
        "valor = 1",
        "leer dato",
        "escribir dato"
    ].join("\n")).ast);
    const playback = createDiagramPlaybackTrace(
        model,
        {
            traceId: "lineal",
            status: "correct",
            steps: [1, 2, 3].map((startLine, index) => ({
                index,
                location: {
                    startLine,
                    startColumn: 1
                }
            }))
        }
    );

    assert.deepEqual(
        playbackContract(model, playback),
        [
            { nodeId: "N1", label: "Inicio", incoming: [] },
            { nodeId: "N2", label: "valor = 1", incoming: [{
                modelId: "E1", relation: "sequence", label: null,
                source: "N1", target: "N2"
            }] },
            { nodeId: "N3", label: "Entrada dato", incoming: [{
                modelId: "E2", relation: "sequence", label: null,
                source: "N2", target: "N3"
            }] },
            { nodeId: "N4", label: "Salida dato", incoming: [{
                modelId: "E3", relation: "sequence", label: null,
                source: "N3", target: "N4"
            }] },
            { nodeId: "N5", label: "Fin", incoming: [{
                modelId: "E4", relation: "exit", label: null,
                source: "N4", target: "N5"
            }] }
        ]
    );
});

test("diagramador: un si recorre sólo la rama Sí y atraviesa su fusión", () => {
    const model = build(parseSource([
        "si verdadero",
        "    escribir \"sí\"",
        "sino",
        "    escribir \"no\"",
        "escribir \"continúa\""
    ].join("\n")).ast);
    const playback = normalizePlayback(
        model,
        [1, 2, 5].map((startLine, index) => ({
            index,
            location: {
                startLine,
                startColumn:
                    startLine === 1 ? 1 : 5
            }
        })),
        "correct"
    );

    assert.deepEqual(
        playbackContract(model, playback.trace),
        [
            { nodeId: "N1", label: "Inicio", incoming: [] },
            { nodeId: "N2", label: "verdadero", incoming: [{
                modelId: "E5", relation: "sequence", label: null,
                source: "N1", target: "N2"
            }] },
            { nodeId: "N3", label: "Salida \"sí\"", incoming: [{
                modelId: "E1", relation: "branch", label: "Sí",
                source: "N2", target: "N3"
            }] },
            { nodeId: "N6", label: "Salida \"continúa\"", incoming: [
                {
                    modelId: "E2", relation: "merge", label: null,
                    source: "N3", target: "N5"
                },
                {
                    modelId: "E6", relation: "sequence", label: null,
                    source: "N5", target: "N6"
                }
            ] },
            { nodeId: "N7", label: "Fin", incoming: [{
                modelId: "E7", relation: "exit", label: null,
                source: "N6", target: "N7"
            }] }
        ]
    );

    const untaken = getDiagramNodes(model)
        .find(node =>
            node.location?.startLine === 4
        );
    const projection = projectDiagramExecutionEdges(
        model,
        playback.trace.steps,
        playback.nodes,
        playback.trace.steps.length - 1
    );
    assert.ok(projection.visited.every(edge =>
        edge.source !== untaken.id &&
        edge.target !== untaken.id
    ));
});

test("diagramador: un si falso sin sino continúa sin inventar Fin local", () => {
    const model = build(parseSource([
        "si falso",
        "    escribir \"no ejecutada\"",
        "escribir \"continúa\""
    ].join("\n")).ast);
    const playback = normalizePlayback(
        model,
        [1, 3].map((startLine, index) => ({
            index,
            location: {
                startLine,
                startColumn: 1
            }
        })),
        "correct"
    );

    assert.deepEqual(
        playbackContract(model, playback.trace),
        [
            { nodeId: "N1", label: "Inicio", incoming: [] },
            { nodeId: "N2", label: "falso", incoming: [{
                modelId: "E4", relation: "sequence", label: null,
                source: "N1", target: "N2"
            }] },
            { nodeId: "N5", label: "Salida \"continúa\"", incoming: [
                {
                    modelId: "E3", relation: "branch", label: "No",
                    source: "N2", target: "N4"
                },
                {
                    modelId: "E5", relation: "sequence", label: null,
                    source: "N4", target: "N5"
                }
            ] },
            { nodeId: "N6", label: "Fin", incoming: [{
                modelId: "E6", relation: "exit", label: null,
                source: "N5", target: "N6"
            }] }
        ]
    );
    assert.equal(
        playback.trace.steps.some(step =>
            step.presentation.nodeId === "N3"
        ),
        false
    );
});

test("diagramador: un si falso con sino recorre sólo No y continúa", () => {
    const model = build(parseSource([
        "si falso",
        "    escribir \"sí\"",
        "sino",
        "    escribir \"no\"",
        "escribir \"continúa\""
    ].join("\n")).ast);
    const playback = normalizePlayback(
        model,
        [1, 4, 5].map((startLine, index) => ({
            index,
            location: {
                startLine,
                startColumn:
                    startLine === 1 ? 1 : 5
            }
        })),
        "correct"
    );
    const contract = playbackContract(
        model,
        playback.trace
    );

    assert.deepEqual(
        contract.map(step => step.nodeId),
        ["N1", "N2", "N4", "N6", "N7"]
    );
    assert.deepEqual(
        contract.map(step => step.label),
        [
            "Inicio",
            "falso",
            "Salida \"no\"",
            "Salida \"continúa\"",
            "Fin"
        ]
    );
    assert.deepEqual(
        contract.flatMap(step =>
            step.incoming.map(edge => [
                edge.modelId,
                edge.relation,
                edge.label
            ])
        ),
        [
            ["E5", "sequence", null],
            ["E3", "branch", "No"],
            ["E4", "merge", null],
            ["E6", "sequence", null],
            ["E7", "exit", null]
        ]
    );
    assert.equal(
        contract.some(step =>
            step.nodeId === "N3"
        ),
        false
    );
});

test("diagramador: un si final atraviesa la fusión y sólo entonces alcanza Fin", () => {
    const model = build(parseSource([
        "si verdadero",
        "    escribir \"sí\"",
        "sino",
        "    escribir \"no\""
    ].join("\n")).ast);
    const playback = normalizePlayback(
        model,
        [1, 2].map((startLine, index) => ({
            index,
            location: {
                startLine,
                startColumn:
                    startLine === 1 ? 1 : 5
            }
        })),
        "correct"
    );
    const contract = playbackContract(
        model,
        playback.trace
    );

    assert.deepEqual(
        contract.map(step => step.nodeId),
        ["N1", "N2", "N3", "N6"]
    );
    assert.deepEqual(
        contract.at(-1).incoming.map(edge => [
            edge.modelId,
            edge.relation,
            edge.source,
            edge.target
        ]),
        [
            ["E2", "merge", "N3", "N5"],
            ["E6", "exit", "N5", "N6"]
        ]
    );
    assert.equal(contract.at(-1).label, "Fin");
});

test("diagramador: los si anidados registran cada evaluación y sólo sus rutas observadas", () => {
    const model = build(parseSource([
        "si verdadero",
        "    si falso",
        "        escribir \"omitida\"",
        "    escribir \"interior\"",
        "escribir \"fin\""
    ].join("\n")).ast);
    const playback = normalizePlayback(
        model,
        [1, 2, 4, 5].map((startLine, index) => ({
            index,
            location: {
                startLine,
                startColumn:
                    [2, 4].includes(startLine)
                        ? 5
                        : 1
            }
        })),
        "correct"
    );
    const contract = playbackContract(
        model,
        playback.trace
    );

    assert.deepEqual(
        contract.map(step => [
            step.nodeId,
            step.label
        ]),
        [
            ["N1", "Inicio"],
            ["N2", "verdadero"],
            ["N3", "falso"],
            ["N6", "Salida \"interior\""],
            ["N8", "Salida \"fin\""],
            ["N9", "Fin"]
        ]
    );
    assert.deepEqual(
        contract.flatMap(step =>
            step.incoming.map(edge => [
                edge.modelId,
                edge.relation,
                edge.label
            ])
        ),
        [
            ["E8", "sequence", null],
            ["E5", "branch", "Sí"],
            ["E3", "branch", "No"],
            ["E4", "sequence", null],
            ["E6", "merge", null],
            ["E9", "sequence", null],
            ["E10", "exit", null]
        ]
    );
    assert.equal(
        contract.some(step =>
            step.nodeId === "N4"
        ),
        false
    );
});

test("diagramador: rebobinar un condicional elimina rama, fusión y Fin posteriores", () => {
    const model = build(parseSource([
        "si verdadero",
        "    escribir \"sí\"",
        "sino",
        "    escribir \"no\"",
        "escribir \"continúa\""
    ].join("\n")).ast);
    const playback = normalizePlayback(
        model,
        [1, 2, 5].map((startLine, index) => ({
            index,
            location: {
                startLine,
                startColumn:
                    startLine === 1 ? 1 : 5
            }
        })),
        "correct"
    );
    const rewound = projectDiagramExecutionEdges(
        model,
        playback.trace.steps,
        playback.nodes,
        1
    );

    assert.deepEqual(
        rewound.visited.map(edge =>
            edge.identity.modelId
        ),
        ["E5"]
    );
    assert.equal(
        rewound.activeTargetId,
        "N2"
    );
    assert.equal(
        rewound.visited.some(edge =>
            ["merge", "exit"].includes(
                edge.identity.relation
            )
        ),
        false
    );
});

test("diagramador: la terminal de cada función ocupa un paso y conserva estado ejecutado", () => {
    const model = build(parseSource([
        "AUX()",
        '    escribir "aux"',
        "PRINCIPAL()",
        "    AUX()"
    ].join("\n")).ast);
    const runtimeTrace = {
        traceId: "entradas-funcion",
        status: "running",
        steps: [
            { index: 0, location: { startLine: 3, startColumn: 1 } },
            { index: 1, location: { startLine: 3, startColumn: 1 },
                flow: { kind: "enter", contextId: 1, functionName: "PRINCIPAL" } },
            { index: 2, location: { startLine: 4, startColumn: 5 } },
            { index: 3, location: { startLine: 1, startColumn: 1 },
                flow: { kind: "enter", contextId: 1, functionName: "AUX" } },
            { index: 4, location: { startLine: 2, startColumn: 5 } }
        ]
    };
    const playbackTrace = createDiagramPlaybackTrace(model, runtimeTrace);
    const nodes = playbackTrace.steps.map(step =>
        findDiagramExecutionNode(model, step)
    );

    assert.equal(runtimeTrace.steps.length, 5, "La traza del runtime no se modifica");
    assert.deepEqual(
        playbackTrace.steps.map(step => step.presentation?.kind ?? "runtime"),
        ["entry", "runtime", "function-entry", "runtime", "function-entry", "runtime"]
    );
    assert.deepEqual(
        nodes.map(node => node?.label),
        ["Inicio", "PRINCIPAL()", "PRINCIPAL()", "AUX()", "AUX()", 'Salida "aux"']
    );
    assert.equal(describeExecutionStep(playbackTrace.steps[2]), "Entrada a PRINCIPAL");
    assert.equal(describeExecutionStep(playbackTrace.steps[4]), "Entrada a AUX");

    const principalEntry = projectDiagramExecutionEdges(
        model, playbackTrace.steps, nodes, 2
    );
    assert.equal(principalEntry.activeFocusId, nodes[2].id);
    const auxiliaryBody = projectDiagramExecutionEdges(
        model, playbackTrace.steps, nodes, 5
    );
    assert.ok(auxiliaryBody.visited.some(edge =>
        edge.source === nodes[4].id && edge.target === nodes[5].id
    ));

    const svgElement = svgFor(model);
    highlightDiagramExecution({
        svgElement,
        diagram: model,
        steps: playbackTrace.steps,
        resolvedNodes: nodes,
        activeIndex: 5,
        status: "running"
    });
    for (const terminal of [nodes[0], nodes[2], nodes[4]]) {
        assert.ok(svgElement.elements.find(element => element.id === terminal.id)
            .classList.contains("clrs-diagram-execution-visited"));
    }
});

test("diagramador: los finales naturales son pasos ordenados de la secuencia", () => {
    const source = ['AUX()', '    escribir "aux"', 'PRINCIPAL()', '    AUX()'].join("\n");
    const model = build(parseSource(source).ast);
    const at = (startLine, startColumn = 5) => ({ startLine, startColumn });
    const steps = [
        { location: at(3, 1) },
        { location: at(3, 1), flow: { kind: "enter", contextId: 1, functionName: "PRINCIPAL" } },
        { location: at(4) },
        { location: at(1, 1), flow: { kind: "enter", contextId: 1, functionName: "AUX" } },
        { location: at(2) },
        { location: at(4), flow: { kind: "return", contextId: 1, functionName: "AUX" } },
        { location: at(4), flow: { kind: "return", contextId: 1, functionName: "PRINCIPAL" } }
    ];
    const rawSteps = reduceExecutionTrace(createEmptyExecutionTrace(), {
        type: "execution-trace",
        trace: { traceId: "terminales", status: "correct", steps }
    }).steps;
    const auxiliary = normalizePlayback(
        model,
        rawSteps.slice(0, 6)
    );
    const complete = normalizePlayback(
        model,
        rawSteps,
        "correct"
    );

    assert.equal(
        auxiliary.trace.steps.at(-1)
            .presentation.kind,
        "function-end"
    );
    assert.deepEqual(
        playbackLabels(model, complete.trace),
        [
            "Inicio",
            "PRINCIPAL()",
            "PRINCIPAL()",
            "AUX()",
            "AUX()",
            'Salida "aux"',
            "Fin",
            "Fin",
            "Fin"
        ]
    );
    assert.deepEqual(
        complete.trace.steps
            .filter(step =>
                ["function-end", "end"]
                    .includes(
                        step.presentation.kind
                    )
            )
            .map(step =>
                step.presentation.kind
            ),
        ["function-end", "function-end", "end"]
    );

    const projection = projectDiagramExecutionEdges(
        model,
        complete.trace.steps,
        complete.nodes,
        complete.trace.steps.length - 1
    );
    assert.equal(
        projection.activePath.at(-1)?.target,
        complete.nodes.at(-1).id
    );
});

test("diagramador: retornar conserva su nodo real y no inventa un Fin adicional", () => {
    const source = ['AUX()', '    retornar 1', 'PRINCIPAL()', '    dato = AUX()'].join("\n");
    const model = build(parseSource(source).ast);
    const at = (startLine, startColumn = 5) => ({ startLine, startColumn });
    const steps = [
        { location: at(3, 1) },
        { location: at(3, 1), flow: { kind: "enter", contextId: 1, functionName: "PRINCIPAL" } },
        { location: at(4) },
        { location: at(1, 1), flow: { kind: "enter", contextId: 1, functionName: "AUX" } },
        { location: at(2) },
        { location: at(4), flow: { kind: "return", contextId: 1, functionName: "AUX" } }
    ];
    const playback = normalizePlayback(
        model,
        steps
    );
    const labels = playbackLabels(
        model,
        playback.trace
    );
    const returnIndex = labels.findIndex(label =>
        /^Retornar/u.test(label)
    );
    const projection = projectDiagramExecutionEdges(
        model,
        playback.trace.steps,
        playback.nodes,
        playback.trace.steps.length - 1
    );

    assert.ok(returnIndex >= 0);
    assert.ok(projection.visited.some(edge =>
        edge.target ===
            playback.nodes[returnIndex].id
    ));
    assert.equal(
        playback.trace.steps[returnIndex]
            .presentation.kind,
        "return"
    );
    assert.equal(
        playback.trace.steps.some(step =>
            step.presentation.kind ===
                "function-end" &&
            model.subgraphs.find(graph =>
                graph.id === "function_AUX"
            )?.nodes.some(node =>
                node.id ===
                    step.presentation.nodeId
            )
        ),
        false
    );
});

test("diagramador: una llamada, su entrada y su continuación conservan frames distintos", () => {
    const model = build(parseSource([
        "AUX()",
        '    escribir "aux"',
        "PRINCIPAL()",
        "    AUX()",
        '    escribir "despues"'
    ].join("\n")).ast);
    const at = (startLine, startColumn = 5) => ({
        startLine,
        startColumn
    });
    const playback = normalizePlayback(model, [
        { index: 0, location: at(3, 1) },
        { index: 1, location: at(3, 1), flow: {
            kind: "enter", contextId: 1,
            functionName: "PRINCIPAL", frameId: 1
        } },
        { index: 2, location: at(4), flow: {
            kind: "statement", contextId: 1,
            frameId: 1
        } },
        { index: 3, location: at(1, 1), flow: {
            kind: "enter", contextId: 1,
            functionName: "AUX", frameId: 2,
            parentFrameId: 1
        } },
        { index: 4, location: at(2), flow: {
            kind: "statement", contextId: 1,
            frameId: 2, parentFrameId: 1
        } },
        { index: 5, location: at(4), flow: {
            kind: "return", contextId: 1,
            functionName: "AUX", frameId: 2,
            parentFrameId: 1
        } },
        { index: 6, location: at(5), flow: {
            kind: "statement", contextId: 1,
            frameId: 1
        } },
        { index: 7, location: at(3, 1), flow: {
            kind: "return", contextId: 1,
            functionName: "PRINCIPAL", frameId: 1
        } }
    ], "correct");

    assert.deepEqual(
        playbackFrameContract(playback.trace),
        [
            { nodeId: "N8", kind: "entry", contextId: 0,
                frameId: null, parentFrameId: null, originIndex: null, edgeIds: [] },
            { nodeId: "N9", kind: "runtime", contextId: 0,
                frameId: null, parentFrameId: null, originIndex: 0, edgeIds: ["E6"] },
            { nodeId: "N4", kind: "function-entry", contextId: 1,
                frameId: 1, parentFrameId: null, originIndex: 1, edgeIds: [] },
            { nodeId: "N5", kind: "runtime", contextId: 1,
                frameId: 1, parentFrameId: null, originIndex: 2, edgeIds: ["E4"] },
            { nodeId: "N1", kind: "function-entry", contextId: 1,
                frameId: 2, parentFrameId: 1, originIndex: 3, edgeIds: [] },
            { nodeId: "N2", kind: "runtime", contextId: 1,
                frameId: 2, parentFrameId: 1, originIndex: 4, edgeIds: ["E1"] },
            { nodeId: "N3", kind: "function-end", contextId: 1,
                frameId: 2, parentFrameId: 1, originIndex: 5, edgeIds: ["E2"] },
            { nodeId: "N6", kind: "runtime", contextId: 1,
                frameId: 1, parentFrameId: null, originIndex: 6, edgeIds: ["E3"] },
            { nodeId: "N7", kind: "function-end", contextId: 1,
                frameId: 1, parentFrameId: null, originIndex: 7, edgeIds: ["E5"] },
            { nodeId: "N10", kind: "end", contextId: 0,
                frameId: null, parentFrameId: null, originIndex: null, edgeIds: ["E7"] }
        ]
    );
});

test("diagramador: dos sitios de llamada a la misma función regresan a su propio sucesor", () => {
    const model = build(parseSource([
        "AUX()",
        "    retornar 1",
        "PRINCIPAL()",
        "    AUX()",
        "    AUX()",
        '    escribir "fin"'
    ].join("\n")).ast);
    const at = (startLine, startColumn = 5) => ({
        startLine,
        startColumn
    });
    const steps = [
        { index: 0, location: at(3, 1) },
        { index: 1, location: at(3, 1), flow: {
            kind: "enter", contextId: 1,
            functionName: "PRINCIPAL", frameId: 10
        } },
        { index: 2, location: at(4) },
        { index: 3, location: at(1, 1), flow: {
            kind: "enter", contextId: 1,
            functionName: "AUX", frameId: 11,
            parentFrameId: 10
        } },
        { index: 4, location: at(2) },
        { index: 5, location: at(4), flow: {
            kind: "return", contextId: 1,
            functionName: "AUX", frameId: 11,
            parentFrameId: 10
        } },
        { index: 6, location: at(5) },
        { index: 7, location: at(1, 1), flow: {
            kind: "enter", contextId: 1,
            functionName: "AUX", frameId: 12,
            parentFrameId: 10
        } },
        { index: 8, location: at(2) },
        { index: 9, location: at(5), flow: {
            kind: "return", contextId: 1,
            functionName: "AUX", frameId: 12,
            parentFrameId: 10
        } },
        { index: 10, location: at(6) }
    ];
    const playback = normalizePlayback(model, steps);
    const contract = playbackFrameContract(
        playback.trace
    );
    const calls = getDiagramNodes(model).filter(node =>
        node.type === "call" &&
        node.reference?.name === "AUX"
    );

    assert.deepEqual(
        playbackLabels(model, playback.trace),
        [
            "Inicio", "PRINCIPAL()", "PRINCIPAL()",
            "AUX()", "AUX()", "Retornar 1",
            "AUX()", "AUX()", "Retornar 1",
            'Salida "fin"'
        ]
    );
    assert.deepEqual(
        contract.filter(step =>
            step.kind === "function-entry" &&
            step.frameId !== 10
        ).map(step => ({
            nodeId: step.nodeId,
            frameId: step.frameId,
            parentFrameId: step.parentFrameId,
            edgeIds: step.edgeIds
        })),
        [
            { nodeId: "N1", frameId: 11,
                parentFrameId: 10, edgeIds: [] },
            { nodeId: "N1", frameId: 12,
                parentFrameId: 10, edgeIds: [] }
        ]
    );
    assert.deepEqual(
        contract.filter(step =>
            calls.some(call => call.id === step.nodeId)
        ).map(step => step.nodeId),
        calls.map(call => call.id)
    );
    assert.equal(
        contract.at(-1).edgeIds.length,
        1
    );
});

test("diagramador: un retorno exterior se anota en su frame tras una llamada anidada", () => {
    const model = build(parseSource([
        "C()",
        "    retornar 1",
        "B()",
        "    retornar C()",
        "A()",
        "    retornar B()",
        "PRINCIPAL()",
        "    dato = A()",
        '    escribir "fin"'
    ].join("\n")).ast);
    const at = (startLine, startColumn = 5) => ({
        startLine,
        startColumn
    });
    const playback = normalizePlayback(model, [
        { index: 0, location: at(7, 1) },
        { index: 1, location: at(7, 1), flow: {
            kind: "enter", contextId: 1,
            functionName: "PRINCIPAL", frameId: 1
        } },
        { index: 2, location: at(8) },
        { index: 3, location: at(5, 1), flow: {
            kind: "enter", contextId: 1,
            functionName: "A", frameId: 2,
            parentFrameId: 1
        } },
        { index: 4, location: at(6) },
        { index: 5, location: at(3, 1), flow: {
            kind: "enter", contextId: 1,
            functionName: "B", frameId: 3,
            parentFrameId: 2
        } },
        { index: 6, location: at(4) },
        { index: 7, location: at(1, 1), flow: {
            kind: "enter", contextId: 1,
            functionName: "C", frameId: 4,
            parentFrameId: 3
        } },
        { index: 8, location: at(2) },
        { index: 9, location: at(4), flow: {
            kind: "return", contextId: 1,
            functionName: "C", frameId: 4,
            parentFrameId: 3
        } },
        { index: 10, location: at(6), flow: {
            kind: "return", contextId: 1,
            functionName: "B", frameId: 3,
            parentFrameId: 2
        } },
        { index: 11, location: at(8), flow: {
            kind: "return", contextId: 1,
            functionName: "A", frameId: 2,
            parentFrameId: 1
        } },
        { index: 12, location: at(9) }
    ]);
    const returns = playback.trace.steps.filter(step =>
        step.presentation.kind === "return"
    );

    assert.deepEqual(
        returns.map(step => ({
            nodeId: step.presentation.nodeId,
            frameId: step.presentation.frameId,
            stateOriginIndex:
                step.presentation.stateOriginIndex
        })),
        [
            { nodeId: "N6", frameId: 2,
                stateOriginIndex: 11 },
            { nodeId: "N4", frameId: 3,
                stateOriginIndex: 10 },
            { nodeId: "N2", frameId: 4,
                stateOriginIndex: 9 }
        ]
    );
    assert.equal(
        playback.trace.steps.at(-1)
            .presentation.frameId,
        1
    );
    assert.equal(
        playback.trace.steps.some(step =>
            step.presentation.kind ===
                "function-end"
        ),
        false
    );
});

test("diagramador: la recursión conserva el frame y la continuación de cada invocación", () => {
    const model = build(parseSource([
        "CONTAR(n)",
        "    si n > 0",
        "        CONTAR(n - 1)",
        "    escribir n",
        "PRINCIPAL()",
        "    CONTAR(1)",
        "    escribir fin"
    ].join("\n")).ast);
    const at = (
        index,
        startLine,
        startColumn = 5,
        flow = null
    ) => ({
        index,
        location: { startLine, startColumn },
        ...(flow ? { flow } : {})
    });
    const flow = (
        kind,
        functionName,
        frameId,
        parentFrameId = null
    ) => ({
        kind,
        contextId: 1,
        functionName,
        frameId,
        ...(parentFrameId != null
            ? { parentFrameId }
            : {})
    });
    const playback = normalizePlayback(model, [
        at(0, 5, 1),
        at(1, 5, 1, flow("enter", "PRINCIPAL", 1)),
        at(2, 6),
        at(3, 1, 1, flow("enter", "CONTAR", 2, 1)),
        at(4, 2),
        at(5, 3, 9),
        at(6, 1, 1, flow("enter", "CONTAR", 3, 2)),
        at(7, 2),
        at(8, 4),
        at(9, 3, 9, flow("return", "CONTAR", 3, 2)),
        at(10, 4),
        at(11, 6, 5, flow("return", "CONTAR", 2, 1)),
        at(12, 7),
        at(13, 5, 1, flow("return", "PRINCIPAL", 1))
    ], "correct");
    const contract = playbackFrameContract(
        playback.trace
    );

    assert.deepEqual(
        contract.map(step => [
            step.nodeId,
            step.kind,
            step.frameId,
            step.parentFrameId,
            step.originIndex,
            step.edgeIds
        ]),
        [
            ["N11", "entry", null, null, null, []],
            ["N12", "runtime", null, null, 0, ["E10"]],
            ["N7", "function-entry", 1, null, 1, []],
            ["N8", "runtime", 1, null, 2, ["E8"]],
            ["N1", "function-entry", 2, 1, 3, []],
            ["N2", "runtime", 2, 1, 4, ["E5"]],
            ["N3", "runtime", 2, 1, 5, ["E1"]],
            ["N1", "function-entry", 3, 2, 6, []],
            ["N2", "runtime", 3, 2, 7, ["E5"]],
            ["N5", "runtime", 3, 2, 8, ["E3", "E4"]],
            ["N6", "function-end", 3, 2, 9, ["E6"]],
            ["N5", "runtime", 2, 1, 10, ["E2", "E4"]],
            ["N6", "function-end", 2, 1, 11, ["E6"]],
            ["N9", "runtime", 1, null, 12, ["E7"]],
            ["N10", "function-end", 1, null, 13, ["E9"]],
            ["N13", "end", null, null, null, ["E11"]]
        ]
    );

    const innerEndIndex = contract.findIndex(step =>
        step.nodeId === "N6" &&
        step.frameId === 3
    );
    const rewound = projectDiagramExecutionEdges(
        model,
        playback.trace.steps,
        playback.nodes,
        innerEndIndex
    );

    assert.equal(rewound.activeTargetId, "N6");
    assert.equal(
        rewound.visited.some(edge =>
            ["E2", "E7", "E9", "E11"]
                .includes(edge.identity.modelId)
        ),
        false
    );
});

test("diagramador: una llamada dentro de mientras regresa a la misma iteración", () => {
    const model = build(parseSource([
        "AUX()",
        "    retornar 1",
        "PRINCIPAL()",
        "    i = 0",
        "    mientras i < 1",
        "        AUX()",
        "        i = i + 1",
        "    escribir fin"
    ].join("\n")).ast);
    const flow = (
        kind,
        functionName,
        frameId,
        parentFrameId = null
    ) => ({
        kind,
        contextId: 1,
        functionName,
        frameId,
        ...(parentFrameId != null
            ? { parentFrameId }
            : {})
    });
    const at = (
        index,
        startLine,
        startColumn = 5,
        executionFlow = null
    ) => ({
        index,
        location: { startLine, startColumn },
        ...(executionFlow
            ? { flow: executionFlow }
            : {})
    });
    const playback = normalizePlayback(model, [
        at(0, 3, 1),
        at(1, 3, 1, flow("enter", "PRINCIPAL", 1)),
        at(2, 4),
        at(3, 5),
        at(4, 6, 9),
        at(5, 1, 1, flow("enter", "AUX", 2, 1)),
        at(6, 2),
        at(7, 6, 9, flow("return", "AUX", 2, 1)),
        at(8, 7, 9),
        at(9, 5),
        at(10, 8),
        at(11, 3, 1, flow("return", "PRINCIPAL", 1))
    ], "correct");

    assert.deepEqual(
        playbackFrameContract(playback.trace)
            .map(step => [
                step.nodeId,
                step.frameId,
                step.originIndex,
                step.edgeIds
            ]),
        [
            ["N10", null, null, []],
            ["N11", null, 0, ["E9"]],
            ["N3", 1, 1, []],
            ["N4", 1, 2, ["E7"]],
            ["N5", 1, 3, ["E5"]],
            ["N6", 1, 4, ["E3"]],
            ["N1", 2, 5, []],
            ["N2", 2, 6, ["E1"]],
            ["N7", 1, 8, ["E2"]],
            ["N5", 1, 9, ["E4"]],
            ["N8", 1, 10, ["E6"]],
            ["N9", 1, 11, ["E8"]],
            ["N12", null, null, ["E10"]]
        ]
    );
    assert.equal(
        playback.trace.steps.filter(step =>
            step.presentation.nodeId === "N6"
        ).length,
        1,
        "la llamada no reaparece al regresar"
    );
});

test("diagramador: retornar dentro de si y para termina el frame sin continuaciones artificiales", () => {
    const cases = [
        {
            source: [
                "DETENER()",
                "    si verdadero",
                "        retornar 1",
                "    escribir omitida"
            ],
            raw: [
                [0, 1, 1, "enter"],
                [1, 2, 8],
                [2, 3, 9],
                [3, 3, 9, "return"]
            ],
            expected: [
                ["N7", "Inicio", []],
                ["N1", "DETENER()", []],
                ["N2", "verdadero", ["E4"]],
                ["N3", "Retornar 1", ["E1"]]
            ]
        },
        {
            source: [
                "DETENER()",
                "    para i = 0 hasta 1",
                "        retornar i",
                "    escribir omitida"
            ],
            raw: [
                [0, 1, 1, "enter"],
                [1, 2, 14],
                [2, 2, 22],
                [3, 3, 9],
                [4, 3, 9, "return"]
            ],
            expected: [
                ["N7", "Inicio", []],
                ["N1", "DETENER()", []],
                ["N2", "Para i = 0 hasta 1", ["E4"]],
                ["N3", "i <= 1", ["E1"]],
                ["N4", "Retornar i", ["E2"]]
            ]
        }
    ];

    for (const fixture of cases) {
        const model = build(parseSource(
            fixture.source.join("\n")
        ).ast);
        const steps = fixture.raw.map(([
            index,
            startLine,
            startColumn,
            kind
        ]) => ({
            index,
            location: { startLine, startColumn },
            ...(kind ? {
                flow: {
                    kind,
                    contextId: 1,
                    functionName: "DETENER",
                    frameId: 1
                }
            } : {})
        }));
        const playback = normalizePlayback(
            model,
            steps
        );

        assert.deepEqual(
            playbackContract(model, playback.trace)
                .map(step => [
                    step.nodeId,
                    step.label,
                    step.incoming.map(edge =>
                        edge.modelId
                    )
                ]),
            fixture.expected
        );
        assert.equal(
            playback.trace.steps.some(step =>
                step.presentation.kind ===
                    "function-end"
            ),
            false
        );
        assert.equal(
            playback.trace.steps.some(step =>
                step.presentation.nodeId === "N6"
            ),
            false
        );
    }
});

test("diagramador: error y cancelación no convierten una salida de frame en Fin natural", () => {
    const model = build(parseSource([
        "AUX()",
        "    escribir dato"
    ].join("\n")).ast);
    const steps = [
        {
            index: 0,
            location: {
                startLine: 1,
                startColumn: 1
            },
            flow: {
                kind: "enter",
                contextId: 1,
                functionName: "AUX",
                frameId: 4
            }
        },
        {
            index: 1,
            location: {
                startLine: 2,
                startColumn: 5
            }
        },
        {
            index: 2,
            location: {
                startLine: 1,
                startColumn: 1
            },
            flow: {
                kind: "return",
                contextId: 1,
                functionName: "AUX",
                frameId: 4
            }
        }
    ];

    for (const status of ["error", "cancelled"]) {
        const playback = normalizePlayback(
            model,
            steps,
            status
        );

        assert.deepEqual(
            playbackLabels(model, playback.trace),
            ["Inicio", "AUX()", "Salida dato"]
        );
        assert.equal(
            playback.trace.steps.some(step =>
                step.presentation.kind ===
                    "function-end"
            ),
            false
        );
    }
});

test("diagramador: una rama y la salida de un ciclo alcanzan Fin sin marcar rutas no tomadas", () => {
    const conditional = build(parseSource('si verdadero\n    escribir "sí"\nsino\n    escribir "no"').ast);
    const conditionalSteps = [1, 2].map(startLine => ({ location: { startLine, startColumn: startLine === 1 ? 1 : 5 } }));
    const conditionalPlayback = normalizePlayback(
        conditional,
        conditionalSteps,
        "correct"
    );
    const conditionalProjection = projectDiagramExecutionEdges(
        conditional,
        conditionalPlayback.trace.steps,
        conditionalPlayback.nodes,
        conditionalPlayback.trace.steps.length - 1
    );
    const untaken = getDiagramNodes(conditional).find(node => node.location?.startLine === 4);
    assert.equal(
        conditionalPlayback.nodes.at(-1).label,
        "Fin"
    );
    assert.ok(conditionalProjection.visited.every(edge =>
        edge.source !== untaken.id && edge.target !== untaken.id
    ));

    const loop = build(parseSource('i = 0\nmientras i < 1\n    i = i + 1').ast);
    const loopSteps = [1, 2, 3, 2].map(startLine => ({
        location: { startLine, startColumn: startLine === 3 ? 5 : 1 }
    }));
    const loopPlayback = normalizePlayback(
        loop,
        loopSteps,
        "correct"
    );
    const loopProjection = projectDiagramExecutionEdges(
        loop,
        loopPlayback.trace.steps,
        loopPlayback.nodes,
        loopPlayback.trace.steps.length - 1
    );
    assert.equal(
        loopPlayback.nodes.at(-1).label,
        "Fin"
    );
    assert.equal(loopProjection.activePath.at(-1)?.target, loopProjection.activeTargetId);
});

test("diagramador: para normaliza preparación, decisión y aristas por iteración", () => {
    const source = [
        "PRINCIPAL()",
        "    para i = 0 hasta 1",
        "        escribir i",
        '    escribir "fin"'
    ].join("\n");
    const model = build(
        parseSource(source).ast
    );
    const at = (
        startLine,
        startColumn
    ) => ({ startLine, startColumn });
    const rawSteps = [
        { index: 0, location: at(1, 1) },
        { index: 1, location: at(1, 1), flow: {
            kind: "enter", contextId: 1,
            functionName: "PRINCIPAL"
        } },
        { index: 2, location: at(2, 14) },
        { index: 3, location: at(2, 22) },
        { index: 4, location: at(3, 9) },
        { index: 5, location: at(2, 22) },
        { index: 6, location: at(2, 22) },
        { index: 7, location: at(3, 9) },
        { index: 8, location: at(2, 22) },
        { index: 9, location: at(2, 22) },
        { index: 10, location: at(4, 5) },
        { index: 11, location: at(4, 5), flow: {
            kind: "return", contextId: 1,
            functionName: "PRINCIPAL"
        } }
    ];
    const playback = normalizePlayback(
        model,
        rawSteps,
        "correct"
    );

    assert.deepEqual(
        playbackLabels(model, playback.trace),
        [
            "Inicio",
            "PRINCIPAL()",
            "PRINCIPAL()",
            "Para i = 0 hasta 1",
            "i <= 1",
            "Salida i",
            "Para i = 0 hasta 1",
            "i <= 1",
            "Salida i",
            "Para i = 0 hasta 1",
            "i <= 1",
            'Salida "fin"',
            "Fin",
            "Fin"
        ]
    );
    assert.deepEqual(
        playback.trace.steps
            .filter(step =>
                [
                    "for-preparation",
                    "loop-decision"
                ].includes(
                    step.presentation.kind
                )
            )
            .map(step =>
                step.presentation.kind
            ),
        [
            "for-preparation",
            "loop-decision",
            "for-preparation",
            "loop-decision",
            "for-preparation",
            "loop-decision"
        ]
    );

    const flow = model.subgraphs.find(
        graph =>
            graph.id ===
                "function_PRINCIPAL"
    );
    const relationById = new Map(
        flow.edges.map(edge => [
            edge.identity.modelId,
            edge.identity.relation
        ])
    );
    const traversedRelations =
        playback.trace.steps.flatMap(step =>
            step.presentation
                .incomingTransition.edgeIds
                .map(edgeId =>
                    relationById.get(edgeId)
                )
                .filter(Boolean)
        );

    assert.deepEqual(
        traversedRelations,
        [
            "entry",
            "sequence",
            "loop-entry",
            "loop-back",
            "sequence",
            "loop-entry",
            "loop-back",
            "sequence",
            "loop-exit",
            "exit"
        ]
    );
});

test("diagramador: mientras registra cada evaluación, vuelta y salida hacia la continuación", () => {
    const model = build(parseSource([
        "i = 0",
        "mientras i < 2",
        "    escribir i",
        "    i = i + 1",
        'escribir "fin"'
    ].join("\n")).ast);
    const playback = normalizePlayback(
        model,
        [1, 2, 3, 4, 2, 3, 4, 2, 5]
            .map((startLine, index) => ({
                index,
                location: {
                    startLine,
                    startColumn:
                        [3, 4].includes(startLine)
                            ? 5
                            : 1
                }
            })),
        "correct"
    );

    assert.deepEqual(
        playbackContract(model, playback.trace),
        [
            { nodeId: "N1", label: "Inicio", incoming: [] },
            { nodeId: "N2", label: "i = 0", incoming: [{
                modelId: "E1", relation: "sequence", label: null,
                source: "N1", target: "N2"
            }] },
            { nodeId: "N3", label: "i < 2", incoming: [{
                modelId: "E5", relation: "sequence", label: null,
                source: "N2", target: "N3"
            }] },
            { nodeId: "N4", label: "Salida i", incoming: [{
                modelId: "E3", relation: "loop-entry", label: "Sí",
                source: "N3", target: "N4"
            }] },
            { nodeId: "N5", label: "i = i + 1", incoming: [{
                modelId: "E2", relation: "sequence", label: null,
                source: "N4", target: "N5"
            }] },
            { nodeId: "N3", label: "i < 2", incoming: [{
                modelId: "E4", relation: "loop-back", label: null,
                source: "N5", target: "N3"
            }] },
            { nodeId: "N4", label: "Salida i", incoming: [{
                modelId: "E3", relation: "loop-entry", label: "Sí",
                source: "N3", target: "N4"
            }] },
            { nodeId: "N5", label: "i = i + 1", incoming: [{
                modelId: "E2", relation: "sequence", label: null,
                source: "N4", target: "N5"
            }] },
            { nodeId: "N3", label: "i < 2", incoming: [{
                modelId: "E4", relation: "loop-back", label: null,
                source: "N5", target: "N3"
            }] },
            { nodeId: "N6", label: 'Salida "fin"', incoming: [{
                modelId: "E6", relation: "loop-exit", label: "No",
                source: "N3", target: "N6"
            }] },
            { nodeId: "N7", label: "Fin", incoming: [{
                modelId: "E7", relation: "exit", label: null,
                source: "N6", target: "N7"
            }] }
        ]
    );
    assert.deepEqual(
        playback.trace.steps.map(step =>
            step.presentation.originIndex
        ),
        [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, null]
    );

    const rewound = projectDiagramExecutionEdges(
        model,
        playback.trace.steps,
        playback.nodes,
        5
    );
    assert.deepEqual(
        rewound.visited.map(edge =>
            edge.identity.modelId
        ),
        ["E1", "E5", "E3", "E2", "E4"]
    );
    assert.deepEqual(
        rewound.activePath.map(edge =>
            edge.identity.modelId
        ),
        ["E4"]
    );
    assert.equal(rewound.activeTargetId, "N3");
    assert.equal(
        rewound.visited.some(edge =>
            ["E6", "E7"].includes(
                edge.identity.modelId
            )
        ),
        false
    );
});

test("diagramador: mientras con cero iteraciones sale directamente a Fin", () => {
    const model = build(parseSource([
        "mientras falso",
        '    escribir "omitida"'
    ].join("\n")).ast);
    const playback = normalizePlayback(
        model,
        [{
            index: 0,
            location: {
                startLine: 1,
                startColumn: 10
            }
        }],
        "correct"
    );

    assert.deepEqual(
        playbackContract(model, playback.trace),
        [
            { nodeId: "N1", label: "Inicio", incoming: [] },
            { nodeId: "N2", label: "falso", incoming: [{
                modelId: "E3", relation: "sequence", label: null,
                source: "N1", target: "N2"
            }] },
            { nodeId: "N4", label: "Fin", incoming: [{
                modelId: "E4", relation: "loop-exit", label: "No",
                source: "N2", target: "N4"
            }] }
        ]
    );
    const projection = projectDiagramExecutionEdges(
        model,
        playback.trace.steps,
        playback.nodes,
        playback.trace.steps.length - 1
    );
    assert.deepEqual(
        projection.visited.map(edge =>
            edge.identity.modelId
        ),
        ["E3", "E4"]
    );
    assert.equal(
        playback.trace.steps.some(step =>
            step.presentation.nodeId === "N3"
        ),
        false
    );
});

test("diagramador: para ascendente separa inicialización, actualizaciones y evaluaciones", () => {
    const model = build(parseSource([
        "para i = 0 hasta 1",
        "    escribir i",
        'escribir "fin"'
    ].join("\n")).ast);
    const at = (
        index,
        startLine,
        startColumn
    ) => ({
        index,
        location: {
            startLine,
            startColumn
        }
    });
    const playback = normalizePlayback(
        model,
        [
            at(0, 1, 10),
            at(1, 1, 18),
            at(2, 2, 5),
            at(3, 1, 18),
            at(4, 1, 18),
            at(5, 2, 5),
            at(6, 1, 18),
            at(7, 1, 18),
            at(8, 3, 1)
        ],
        "correct"
    );

    assert.deepEqual(
        playbackContract(model, playback.trace),
        [
            { nodeId: "N1", label: "Inicio", incoming: [] },
            { nodeId: "N2", label: "Para i = 0 hasta 1", incoming: [{
                modelId: "E4", relation: "sequence", label: null,
                source: "N1", target: "N2"
            }] },
            { nodeId: "N3", label: "i <= 1", incoming: [{
                modelId: "E1", relation: "sequence", label: null,
                source: "N2", target: "N3"
            }] },
            { nodeId: "N4", label: "Salida i", incoming: [{
                modelId: "E2", relation: "loop-entry", label: "Sí",
                source: "N3", target: "N4"
            }] },
            { nodeId: "N2", label: "Para i = 0 hasta 1", incoming: [{
                modelId: "E3", relation: "loop-back", label: null,
                source: "N4", target: "N2"
            }] },
            { nodeId: "N3", label: "i <= 1", incoming: [{
                modelId: "E1", relation: "sequence", label: null,
                source: "N2", target: "N3"
            }] },
            { nodeId: "N4", label: "Salida i", incoming: [{
                modelId: "E2", relation: "loop-entry", label: "Sí",
                source: "N3", target: "N4"
            }] },
            { nodeId: "N2", label: "Para i = 0 hasta 1", incoming: [{
                modelId: "E3", relation: "loop-back", label: null,
                source: "N4", target: "N2"
            }] },
            { nodeId: "N3", label: "i <= 1", incoming: [{
                modelId: "E1", relation: "sequence", label: null,
                source: "N2", target: "N3"
            }] },
            { nodeId: "N5", label: 'Salida "fin"', incoming: [{
                modelId: "E5", relation: "loop-exit", label: "No",
                source: "N3", target: "N5"
            }] },
            { nodeId: "N6", label: "Fin", incoming: [{
                modelId: "E6", relation: "exit", label: null,
                source: "N5", target: "N6"
            }] }
        ]
    );
    assert.deepEqual(
        playback.trace.steps.map(step =>
            step.presentation.originIndex
        ),
        [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, null]
    );
    assert.deepEqual(
        playback.trace.steps
            .filter(step =>
                ["for-preparation", "loop-decision"]
                    .includes(step.presentation.kind)
            )
            .map(step => [
                step.presentation.kind,
                step.presentation.originIndex
            ]),
        [
            ["for-preparation", 0],
            ["loop-decision", 1],
            ["for-preparation", 3],
            ["loop-decision", 4],
            ["for-preparation", 6],
            ["loop-decision", 7]
        ]
    );
});

test("diagramador: para descendente conserva iteraciones separadas y termina por loop-exit", () => {
    const model = build(parseSource([
        "para i = 2 bajando 1",
        "    escribir i"
    ].join("\n")).ast);
    const at = (
        index,
        startLine,
        startColumn
    ) => ({
        index,
        location: {
            startLine,
            startColumn
        }
    });
    const playback = normalizePlayback(
        model,
        [
            at(0, 1, 10),
            at(1, 1, 20),
            at(2, 2, 5),
            at(3, 1, 20),
            at(4, 1, 20),
            at(5, 2, 5),
            at(6, 1, 20),
            at(7, 1, 20)
        ],
        "correct"
    );
    const contract = playbackContract(
        model,
        playback.trace
    );

    assert.deepEqual(
        contract.map(step => [
            step.nodeId,
            step.label
        ]),
        [
            ["N1", "Inicio"],
            ["N2", "Para i = 2 bajando 1"],
            ["N3", "i >= 1"],
            ["N4", "Salida i"],
            ["N2", "Para i = 2 bajando 1"],
            ["N3", "i >= 1"],
            ["N4", "Salida i"],
            ["N2", "Para i = 2 bajando 1"],
            ["N3", "i >= 1"],
            ["N5", "Fin"]
        ]
    );
    assert.deepEqual(
        contract.flatMap(step =>
            step.incoming.map(edge => [
                edge.modelId,
                edge.relation,
                edge.label
            ])
        ),
        [
            ["E4", "sequence", null],
            ["E1", "sequence", null],
            ["E2", "loop-entry", "Sí"],
            ["E3", "loop-back", null],
            ["E1", "sequence", null],
            ["E2", "loop-entry", "Sí"],
            ["E3", "loop-back", null],
            ["E1", "sequence", null],
            ["E5", "loop-exit", "No"]
        ]
    );
    assert.deepEqual(
        playback.trace.steps.map(step =>
            step.presentation.originIndex
        ),
        [null, 0, 1, 2, 3, 4, 5, 6, 7, null]
    );
});

test("diagramador: para con cero iteraciones no visita cuerpo ni loop-back", () => {
    const model = build(parseSource([
        "para i = 1 hasta 0",
        '    escribir "omitida"'
    ].join("\n")).ast);
    const playback = normalizePlayback(
        model,
        [
            {
                index: 0,
                location: {
                    startLine: 1,
                    startColumn: 10
                }
            },
            {
                index: 1,
                location: {
                    startLine: 1,
                    startColumn: 18
                }
            }
        ],
        "correct"
    );

    assert.deepEqual(
        playbackContract(model, playback.trace),
        [
            { nodeId: "N1", label: "Inicio", incoming: [] },
            { nodeId: "N2", label: "Para i = 1 hasta 0", incoming: [{
                modelId: "E4", relation: "sequence", label: null,
                source: "N1", target: "N2"
            }] },
            { nodeId: "N3", label: "i <= 0", incoming: [{
                modelId: "E1", relation: "sequence", label: null,
                source: "N2", target: "N3"
            }] },
            { nodeId: "N5", label: "Fin", incoming: [{
                modelId: "E5", relation: "loop-exit", label: "No",
                source: "N3", target: "N5"
            }] }
        ]
    );
    const projection = projectDiagramExecutionEdges(
        model,
        playback.trace.steps,
        playback.nodes,
        playback.trace.steps.length - 1
    );
    assert.deepEqual(
        projection.visited.map(edge =>
            edge.identity.modelId
        ),
        ["E4", "E1", "E5"]
    );
    assert.equal(
        playback.trace.steps.some(step =>
            step.presentation.nodeId === "N4"
        ),
        false
    );
    assert.equal(
        projection.visited.some(edge =>
            ["loop-entry", "loop-back"]
                .includes(
                    edge.identity.relation
                )
        ),
        false
    );
});

test("diagramador: retornar dentro de un ciclo corta la vuelta sin inventar preparación ni Fin", () => {
    const model = build(parseSource([
        "DETENER()",
        "    mientras verdadero",
        "        retornar 1",
        '        escribir "omitida"'
    ].join("\n")).ast);
    const playback = normalizePlayback(
        model,
        [
            {
                index: 0,
                location: {
                    startLine: 1,
                    startColumn: 1
                },
                flow: {
                    kind: "enter",
                    contextId: 1,
                    functionName: "DETENER"
                }
            },
            {
                index: 1,
                location: {
                    startLine: 2,
                    startColumn: 15
                }
            },
            {
                index: 2,
                location: {
                    startLine: 3,
                    startColumn: 9
                }
            },
            {
                index: 3,
                location: {
                    startLine: 3,
                    startColumn: 9
                },
                flow: {
                    kind: "return",
                    contextId: 1,
                    functionName: "DETENER"
                }
            }
        ]
    );

    assert.deepEqual(
        playbackContract(model, playback.trace),
        [
            { nodeId: "N6", label: "Inicio", incoming: [] },
            { nodeId: "N1", label: "DETENER()", incoming: [] },
            { nodeId: "N2", label: "verdadero", incoming: [{
                modelId: "E2", relation: "entry", label: null,
                source: "N1", target: "N2"
            }] },
            { nodeId: "N3", label: "Retornar 1", incoming: [{
                modelId: "E1", relation: "loop-entry", label: "Sí",
                source: "N2", target: "N3"
            }] }
        ]
    );
    assert.deepEqual(
        playback.trace.steps.at(-1).flow,
        {
            kind: "return",
            contextId: 1,
            functionName: "DETENER"
        }
    );
    assert.equal(
        playback.trace.steps.at(-1)
            .presentation.originIndex,
        2
    );
    assert.equal(
        playback.trace.steps.at(-1)
            .presentation.stateOriginIndex,
        3
    );
    assert.equal(
        playback.trace.steps.some(step =>
            ["N4", "N5", "N7"].includes(
                step.presentation.nodeId
            )
        ),
        false
    );
    assert.equal(
        playback.trace.steps.some(step =>
            step.presentation
                .incomingTransition.edgeIds
                .some(edgeId => edgeId === "E3")
        ),
        false
    );
});

test("diagramador: rebobinar reconstruye nodos y aristas desde el mismo prefijo", () => {
    const model = build(parseSource([
        "i = 0",
        "mientras i < 1",
        "    i = i + 1",
        "escribir i"
    ].join("\n")).ast);
    const rawSteps = [1, 2, 3, 2, 4]
        .map((startLine, index) => ({
            index,
            location: {
                startLine,
                startColumn:
                    startLine === 3
                        ? 5
                        : 1
            }
        }));
    const playback = normalizePlayback(
        model,
        rawSteps,
        "correct"
    );
    const complete = projectDiagramExecutionEdges(
        model,
        playback.trace.steps,
        playback.nodes,
        playback.trace.steps.length - 1
    );
    const rewindIndex = 2;
    const rewound = projectDiagramExecutionEdges(
        model,
        playback.trace.steps,
        playback.nodes,
        rewindIndex
    );
    const prefixEdgeIds = new Set(
        playback.trace.steps
            .slice(0, rewindIndex + 1)
            .flatMap(step =>
                step.presentation
                    .incomingTransition.edgeIds
            )
    );

    assert.deepEqual(
        new Set(rewound.visited.map(edge =>
            edge.identity.modelId
        )),
        prefixEdgeIds
    );
    assert.ok(
        complete.visited.length >
            rewound.visited.length
    );
    assert.equal(
        rewound.activeTargetId,
        playback.nodes[rewindIndex].id
    );
});

test("diagramador: error, cancelación y truncado no inventan finales", () => {
    const model = build(
        parseSource("valor = 1").ast
    );
    const steps = [{
        index: 0,
        location: {
            startLine: 1,
            startColumn: 1
        }
    }];

    for (const status of ["error", "cancelled"]) {
        const playback = normalizePlayback(
            model,
            steps,
            status
        );
        assert.deepEqual(
            playbackLabels(model, playback.trace),
            ["Inicio", "valor = 1"]
        );
    }

    const truncated = normalizePlayback(
        model,
        steps,
        "correct",
        { truncated: true }
    );
    assert.deepEqual(
        playbackLabels(model, truncated.trace),
        ["Inicio", "valor = 1"]
    );
});

test("diagramador: espera, reanudación, pausa e inactividad no aumentan el contador", () => {
    const model = build(
        parseSource("valor = 1").ast
    );
    const location = {
        startLine: 1,
        startColumn: 1
    };
    const semantic = {
        index: 0,
        location,
        flow: {
            kind: "statement",
            contextId: 1
        }
    };

    for (const [kind, stateLocation] of [
        ["wait", location],
        ["resume", location],
        ["paused", location],
        ["idle", null]
    ]) {
        const playback = normalizePlayback(
            model,
            [
                semantic,
                {
                    index: 1,
                    location: stateLocation,
                    flow: {
                        kind,
                        contextId: 1,
                        ...(kind === "wait"
                            ? { reason: "dialog" }
                            : {}),
                        ...(kind === "idle"
                            ? { reason: "windows" }
                            : {})
                    }
                }
            ]
        );

        assert.deepEqual(
            playbackLabels(model, playback.trace),
            ["Inicio", "valor = 1"]
        );
        assert.equal(
            playback.trace.presentationState
                .flow.kind,
            kind
        );
    }
});

test("diagramador: el cierre implícito de PRINCIPAL alcanza Fin después de un ciclo", () => {
    const source = [
        "PRINCIPAL()",
        "    continuar = \"s\"",
        "    mientras continuar == \"s\"",
        "        escribir \"Continuando...\"",
        "        continuar = \"n\""
    ].join("\n");
    const model = build(parseSource(source).ast);
    const steps = [
        { location: { startLine: 1, startColumn: 1 } },
        {
            location: { startLine: 1, startColumn: 1 },
            flow: {
                kind: "enter",
                contextId: 1,
                functionName: "PRINCIPAL"
            }
        },
        { location: { startLine: 2, startColumn: 5 } },
        { location: { startLine: 3, startColumn: 5 } },
        { location: { startLine: 4, startColumn: 9 } },
        { location: { startLine: 5, startColumn: 9 } },
        { location: { startLine: 3, startColumn: 5 } },
        {
            location: { startLine: 3, startColumn: 5 },
            flow: {
                kind: "return",
                contextId: 1,
                functionName: "PRINCIPAL"
            }
        }
    ];
    const playback = normalizePlayback(
        model,
        steps
    );
    const projection = projectDiagramExecutionEdges(
        model,
        playback.trace.steps,
        playback.nodes,
        playback.trace.steps.length - 1
    );
    const principal = model.subgraphs.find(
        graph =>
            graph.id === "function_PRINCIPAL"
    );
    const terminal = principal.nodes.find(
        node =>
            node.type === "return" &&
            node.label === "Fin"
    );

    assert.ok(terminal);
    assert.ok(
        playback.trace.steps.some(step =>
            step.presentation.nodeId ===
                terminal.id
        )
    );
    assert.equal(
        projection.activePath.at(-1)?.target,
        terminal.id
    );
    assert.equal(
        projection.activeFocusId,
        terminal.id
    );
});

test("diagramador: espera, retorno y cambio de contexto no inventan desplazamientos", () => {
    const model = build(parseSource('CAMBIO()\n    escribir "uno"\n    escribir "dos"').ast);
    const at = startLine => ({ startLine, startColumn: 5 });
    const steps = [
        { location: at(2), flow: { kind: "statement", contextId: 1 } },
        { location: at(3), flow: { kind: "statement", contextId: 2 } },
        { location: at(3), flow: { kind: "wait", contextId: 2 } },
        { location: null, flow: { kind: "idle", contextId: 2 } },
        { location: at(3), flow: { kind: "return", contextId: 1 } }
    ];
    const nodes = steps.map(step => findDiagramExecutionNode(model, step));
    assert.equal(projectDiagramExecutionEdges(model, steps, nodes, 4).visited.length, 0);
});

test("GUI diagramador: callback durante un diálogo devuelve el foco al flujo suspendido", { timeout: 15000 }, async t => {
    const source = ['CAMBIO(id, texto)', '    escribir texto', ...base,
        '    ruta = ABRIR_ARCHIVO("f", "v")', '    escribir "CONTINUADO"', '    CERRAR("v")'].join("\n");
    const f = await guiDapHarness(source, { debug: false }); t.after(() => f.dispose());
    await waitKind(f, "wait"); const suspended = last(f);
    await f.action({ type: "text", value: "durante" });
    await f.wait(() => f.stdout.includes("durante") && flows(f).some(s => s.flow.kind === "return" && s.flow.functionName === "CAMBIO"));
    await waitKind(f, "wait");
    assert.equal(last(f).flow.contextId, suspended.flow.contextId);
    assert.deepEqual(last(f).location, suspended.location);
    assert.equal(f.stdout.includes("CONTINUADO"), false);
    await f.action({ type: "dialog", value: "/seleccion" });
    assert.equal((await f.completion).code, 0);
    assert.match(f.stdout, /CONTINUADO/);
});

test("GUI diagramador: callbacks solapados reanudan su contexto y preservan la espera restante", { timeout: 15000 }, async t => {
    const source = ['CAMBIO(id, texto)', '    ruta = ABRIR_ARCHIVO("f", "v")', '    escribir texto, ruta', ...base].join("\n");
    const f = await guiDapHarness(source, { debug: false }); t.after(() => f.dispose());
    await waitKind(f, "idle");
    await f.action({ type: "text", value: "primero" }); await waitKind(f, "wait"); const first = last(f).flow.contextId;
    await f.action({ type: "text", value: "segundo" });
    await f.wait(() => last(f)?.flow?.kind === "wait" && last(f).flow.contextId !== first);
    const second = last(f).flow.contextId;
    await f.action({ type: "dialog", index: 1, value: "/segundo" });
    await f.wait(() => f.stdout.includes("segundo") && last(f)?.flow?.kind === "wait" && last(f).flow.contextId === first);
    assert.ok(flows(f).some(s => s.flow.kind === "resume" && s.flow.contextId === second));
    assert.equal(f.stdout.includes("primero"), false);
    await f.action({ type: "dialog", value: "/primero" }); await waitKind(f, "idle");
    await close(f);
});

test("GUI diagramador: pausa y reanudación DAP se conservan en el historial", { timeout: 15000 }, async t => {
    const f = await guiDapHarness(['CAMBIO(id, texto)', '    escribir texto', ...base].join("\n")); t.after(() => f.dispose());
    await waitKind(f, "idle"); f.request("pause"); await waitKind(f, "paused");
    assert.match(describeExecutionStep(last(f)), /depurador/);
    f.request("continue"); await waitKind(f, "idle");
    await close(f);
    assert.ok(flows(f).some(s => s.flow.kind === "paused"));
});

test("GUI diagramador: transporte incremental, snapshots, límites y datos mínimos de flujo", () => {
    assert.equal(describeExecutionStep({ flow: { kind: "enter", contextId: 1 } }), "Entrada a una función CLRS");
    assert.equal(describeExecutionStep({ flow: { kind: "return", contextId: 1 } }), "Retorno de una función CLRS");
    const service = new ExecutionTraceService({ maxSteps: 3 });
    let state = createEmptyExecutionTrace(); const batches = [];
    service.subscribe(event => { batches.push(event); state = reduceExecutionTrace(state, { type: "execution-event", event }); });
    const trace = service.start({ sourcePath: "gui.clrs" });
    const location = { startLine: 1, startColumn: 1 };
    assert.equal(service.accept(trace.traceId, { type: "gui-flow", location, flow: { kind: "inventado", contextId: 1 } }), false);
    service.accept(trace.traceId, { type: "location", location, flow: {
        kind: "statement", contextId: 1,
        frameId: 7, parentFrameId: 6,
        native: { Gtk: 1 }
    } });
    service.accept(trace.traceId, { type: "gui-flow", location, flow: { kind: "wait", contextId: 1, reason: "dialog" } });
    service.accept(trace.traceId, { type: "gui-flow", location: null, flow: { kind: "idle", contextId: 1, reason: "windows" } });
    service.accept(trace.traceId, { type: "gui-flow", location, flow: { kind: "resume", contextId: 1 } });
    assert.equal(state.truncated, true); assert.equal(state.steps.length, 3);
    assert.doesNotMatch(JSON.stringify(state), /native|Gtk/);
    assert.deepEqual(state.steps[0].flow, {
        kind: "statement",
        contextId: 1,
        frameId: 7,
        parentFrameId: 6
    });
    const snap = service.getSnapshot();
    assert.deepEqual(state.steps, reduceExecutionTrace(null, { type: "execution-trace", trace: snap }).steps);
    let batched = reduceExecutionTrace(null, { type: "execution-event", event: batches[0] });
    batched = reduceExecutionTrace(batched, { type: "execution-event", event: { type: "steps", traceId: trace.traceId, steps: snap.steps } });
    assert.deepEqual(batched.steps, state.steps);
    snap.steps[0].flow.contextId = 9;
    snap.steps[0].flow.frameId = 99;
    assert.equal(service.getSnapshot().steps[0].flow.contextId, 1);
    assert.equal(service.getSnapshot().steps[0].flow.frameId, 7);
    assert.equal(reduceExecutionTrace(state, { type: "execution-event", event: { type: "end", traceId: "vieja", status: "error" } }), state);
});

test("GUI diagramador: resaltado vence prioridades inline de Mermaid y restaura el tema al limpiar", () => {
    const model = build(parseSource('PRINCIPAL()\n    VENTANA("v", "Ejemplo")').ast);
    const svgElement = svgFor(model);
    const location = { startLine: 2, startColumn: 5 };
    const node = findDiagramNodeAtLocation(model, location);
    const element = svgElement.elements.find(candidate => candidate.id === node.id);
    const properties = new Map([["stroke", ["#454545", "important"]], ["stroke-width", ["2px", "important"]]]);
    const shape = { style: {
        getPropertyPriority: key => properties.get(key)?.[1] ?? "",
        getPropertyValue: key => properties.get(key)?.[0] ?? "",
        setProperty: (key, value, priority = "") => properties.set(key, [value, priority])
    } };
    element.querySelectorAll = () => [shape];
    const steps = [{ location, flow: { kind: "wait", contextId: 1 } }];
    highlightDiagramExecution({ svgElement, diagram: model, steps, activeIndex: 0, status: "running" });
    assert.deepEqual(properties.get("stroke"), ["var(--clrs-execution-stroke)", "important"]);
    assert.deepEqual(properties.get("stroke-width"), ["var(--clrs-execution-stroke-width)", "important"]);
    assert.ok(element.classList.contains("clrs-diagram-execution-waiting"));
    highlightDiagramExecution({ svgElement, diagram: model, steps, activeIndex: 0, status: "error" });
    assert.ok(element.classList.contains("clrs-diagram-execution-error"));
    assert.ok(!element.classList.contains("clrs-diagram-execution-waiting"));
    highlightDiagramExecution({ svgElement, diagram: model });
    assert.deepEqual(properties.get("stroke"), ["#454545", "important"]);
    assert.deepEqual(properties.get("stroke-width"), ["2px", "important"]);
});
