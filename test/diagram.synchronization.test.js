import test from "node:test";
import assert from "node:assert/strict";
import {
    createDiagramPlaybackAnimation,
    DIAGRAM_PLAYBACK_ARRIVAL_MS,
    getDiagramPlaybackDuration
} from "../frontend/src/execution/DiagramPlaybackAnimation.js";
import {
    getDiagramPlaybackNavigation,
    moveDiagramPlaybackIndex
} from "../frontend/src/execution/DiagramPlaybackNavigation.js";
import {
    readFileSync
} from "node:fs";

import {
    bindDiagramInteractions,
    findEdgeElement,
    highlightDiagramCoverage,
    highlightDiagramDiagnostics,
    highlightDiagramEntitySelection,
    highlightDiagramExecution,
    highlightDiagramLocation,
    highlightDiagramSearch
} from "../frontend/src/interaction/DiagramDomInteraction.js";
import {
    attachDiagramIdentity
} from "../frontend/src/visitor/DiagramEditableIdentity.js";
import {
    createDiagramNodeDeleteIntent,
    createDiagramNodeDeletionPreview,
    createDiagramNodeEditIntent,
    createDiagramNodeEditorDraft,
    updateDiagramNodeEditorDraft,
    validateDiagramNodeEditorDraft
} from "../frontend/src/editor/DiagramNodeEditorModel.js";
import {
    findDiagramNodeAtLocation,
    localizeSourceLocation,
    shiftSourceLocation
} from "../frontend/src/interaction/DiagramSelection.js";
import {
    DiagramDocumentSession,
    VSCodeDiagramHost
} from "../extension/adapters/VSCodeDiagramHost.js";

const diagram = {
    nodes: [
        {
            ...node(
                "N4",
                "PRINCIPAL()",
                location(1, 1, 1, 11)
            ),
            synthetic: true
        }
    ],
    edges: [],
    subgraphs: [{
        id: "function_PRINCIPAL",
        nodes: [
            node(
                "N1",
                "PRINCIPAL()",
                location(1, 1, 1, 11)
            ),
            node(
                "N2",
                "dato = 1",
                location(2, 5, 2, 13)
            ),
            node(
                "N3",
                "Salida dato",
                location(3, 5, 3, 18)
            )
        ],
        edges: []
    }]
};

test("el host del diagrama conserva el Webview al ocultarlo o moverlo", () => {
    const revealCalls = [];
    const panel = {
        viewColumn: 7,
        webview: {
            html: "",
            postMessage() {},
            onDidReceiveMessage() {
                return disposable();
            }
        },
        onDidDispose() {
            return disposable();
        },
        reveal(...args) {
            revealCalls.push(args);
        },
        dispose() {}
    };
    let panelOptions = null;
    const vscodeApi = {
        ViewColumn: {
            Beside: 2
        },
        Uri: {
            joinPath(base, ...segments) {
                return {
                    path: [
                        base.path,
                        ...segments
                    ].join("/")
                };
            }
        },
        window: {
            createWebviewPanel(
                viewType,
                title,
                viewColumn,
                options
            ) {
                panelOptions = {
                    viewType,
                    title,
                    viewColumn,
                    options
                };
                return panel;
            }
        }
    };
    const host = new VSCodeDiagramHost(
        vscodeApi,
        () => "<html></html>",
        {
            diagramViewType: "clrsDiagram",
            diagramTitlePrefix:
                "Diagrama de flujo"
        }
    );
    const linkedPanel = host.createPanel(
        {
            extensionUri: {
                path: "/extension"
            }
        },
        {
            fileName: "programa.clrs"
        }
    );

    linkedPanel.reveal();

    assert.equal(
        panelOptions.options
            .retainContextWhenHidden,
        true
    );
    assert.equal(
        panelOptions.options
            .enableCommandUris,
        false
    );
    assert.deepEqual(
        panelOptions.options.portMapping,
        []
    );
    assert.deepEqual(revealCalls, [[7, true]]);
});

test("la sesión del diagrama sigue al editor visible del mismo documento", async () => {
    const uri = {
        fsPath: "C:/workspace/programa.clrs",
        toString: () =>
            "file:///C:/workspace/programa.clrs"
    };
    const document = createTextDocument(uri);
    const originalEditor = createTextEditor(
        document,
        1,
        0
    );
    const movedEditor = createTextEditor(
        document,
        4,
        8
    );
    const showCalls = [];
    const vscodeApi = {
        Range: FakeRange,
        Selection: FakeSelection,
        TextEditorRevealType: {
            InCenterIfOutsideViewport:
                "center"
        },
        window: {
            visibleTextEditors: [movedEditor],
            async showTextDocument(
                selectedDocument,
                options
            ) {
                showCalls.push({
                    selectedDocument,
                    options
                });
                return movedEditor;
            }
        }
    };
    const session = new DiagramDocumentSession(
        vscodeApi,
        originalEditor,
        { wholeDocument: true }
    );

    assert.deepEqual(
        session.getSelection(),
        location(9, 1, 9, 1)
    );

    await session.revealLocation(
        location(2, 3, 2, 5)
    );

    assert.equal(
        showCalls[0].selectedDocument,
        document
    );
    assert.equal(
        showCalls[0].options.viewColumn,
        4
    );
    assert.equal(
        movedEditor.selection.start.line,
        1
    );
    assert.equal(
        movedEditor.selection.start.character,
        2
    );
});

test("la sesión aplica únicamente offsets y texto esperados de la versión enlazada", async () => {
    const uri = {
        fsPath: "C:/workspace/programa.clrs",
        toString: () =>
            "file:///C:/workspace/programa.clrs"
    };
    const document =
        createMutableTextDocument(
            uri,
            "PRINCIPAL()\n    dato = 1",
            4
        );
    const editor = createTextEditor(
        document,
        1,
        0
    );
    const vscodeApi = {
        WorkspaceEdit: FakeWorkspaceEdit,
        Range: FakePositionRange,
        workspace: {
            async applyEdit(workspaceEdit) {
                for (
                    const edit
                    of workspaceEdit.edits
                        .toReversed()
                ) {
                    document.replace(
                        document.offsetAt(
                            edit.range.start
                        ),
                        document.offsetAt(
                            edit.range.end
                        ),
                        edit.newText
                    );
                }

                document.version += 1;
                return true;
            }
        },
        window: {
            visibleTextEditors: [editor]
        }
    };
    const session =
        new DiagramDocumentSession(
            vscodeApi,
            editor,
            { wholeDocument: true }
        );
    const startOffset =
        document.getText()
            .indexOf("dato = 1");
    const applied = await session.applyEdits({
        expectedDocumentVersion: 4,
        edits: [{
            startOffset,
            endOffset:
                startOffset +
                "dato = 1".length,
            expectedText: "dato = 1",
            newText: "dato = 2"
        }]
    });

    assert.equal(applied, true);
    assert.equal(
        document.getText(),
        "PRINCIPAL()\n    dato = 2"
    );
    assert.equal(
        await session.applyEdits({
            expectedDocumentVersion: 4,
            edits: [{
                startOffset,
                endOffset:
                    startOffset + 8,
                expectedText: "dato = 2",
                newText: "dato = 3"
            }]
        }),
        false
    );
});

test("selecciona el nodo más específico para el cursor del editor", () => {
    assert.equal(
        findDiagramNodeAtLocation(
            diagram,
            location(2, 8, 2, 8)
        )?.id,
        "N2"
    );
    assert.equal(
        findDiagramNodeAtLocation(
            diagram,
            location(3, 1, 3, 1)
        )?.id,
        "N3"
    );
    assert.equal(
        findDiagramNodeAtLocation(
            diagram,
            location(1, 8, 1, 8)
        )?.id,
        "N1"
    );
    assert.equal(
        findDiagramNodeAtLocation(
            diagram,
            location(8, 1, 8, 1)
        ),
        null
    );
});

test("traslada únicamente la primera columna de un fragmento seleccionado", () => {
    assert.deepEqual(
        shiftSourceLocation(
            location(1, 1, 2, 9),
            {
                startLine: 7,
                startColumn: 5
            }
        ),
        location(7, 5, 8, 9)
    );
    assert.deepEqual(
        localizeSourceLocation(
            location(7, 5, 8, 9),
            {
                startLine: 7,
                startColumn: 5
            }
        ),
        location(1, 1, 2, 9)
    );
});

test("enlaza clic y teclado y resalta el nodo activo del SVG", () => {
    const elements = [
        new FakeNodeElement(
            "flowchart-_N1-0",
            "_N1"
        ),
        new FakeNodeElement(
            "flowchart-_N2-0",
            "_N2"
        ),
        new FakeNodeElement(
            "flowchart-_N3-0",
            "_N3"
        )
    ];
    const svgElement =
        new FakeSvg(elements);
    const selected = [];
    const binding =
        bindDiagramInteractions({
            svgElement,
            diagram,
            onNodeSelect(nodeItem) {
                selected.push(nodeItem.id);
            }
        });

    elements[1].dispatch("click");
    elements[2].dispatch(
        "keydown",
        { key: "Enter" }
    );
    elements[0].dispatch(
        "keydown",
        { key: "Escape" }
    );

    const active =
        highlightDiagramLocation({
            svgElement,
            diagram,
            location:
                location(2, 5, 2, 5)
        });

    assert.deepEqual(
        selected,
        ["N2", "N3"]
    );
    assert.equal(active.id, "N2");
    assert.equal(
        elements[1].classList
            .contains(
                "clrs-diagram-node-active"
            ),
        true
    );
    assert.equal(
        elements[1].attributes
            .get("aria-current"),
        "location"
    );

    binding.dispose();

    assert.equal(
        elements[1].listenerCount,
        0
    );
});

test("el foco editable usa la geometría de la figura sin un rectángulo nativo", () => {
    const css = readFileSync(
        new URL(
            "../frontend/src/style.css",
            import.meta.url
        ),
        "utf8"
    );

    assert.match(
        css,
        /\.node\.clrs-diagram-node-interactive\s*\{[\s\S]*?outline:\s*none;/u
    );
    assert.match(
        css,
        /\.node\.clrs-diagram-entity-editable\.clrs-diagram-entity-selected[^{]*\{[^}]*animation:\s*diagram-selection-ants[^}]*filter:\s*drop-shadow/u
    );
});

test("el hover conserva el grosor y color de las flechas ejecutadas sin demorar el brillo", () => {
    const css = readFileSync(new URL("../frontend/src/style.css", import.meta.url), "utf8");
    assert.match(css, /--clrs-edge-stroke-width:\s*6px/u);
    assert.match(css, /stroke-width:\s*var\(--clrs-edge-stroke-width, 3px\)/u);
    assert.match(css, /filter 180ms linear;\s*transition-delay:\s*0s/u);
    assert.match(css, /stroke:\s*var\(--clrs-edge-stroke\)/u);
});

test("el pulso y el destello respetan la duración visual seleccionada", async () => {
    const fixture = playbackFixture();
    const controller = createDiagramPlaybackAnimation(fixture.svg);
    const completion = controller.play(fixture.edges, "arrival", 650);
    assert.equal(getDiagramPlaybackDuration(900), 650);
    assert.equal(getDiagramPlaybackDuration(500), 450);
    assert.equal(getDiagramPlaybackDuration(250), 250);
    assert.deepEqual(fixture.animations.map(a => a.timing), [
        { duration: 220, delay: 0, easing: "linear" },
        { duration: 330, delay: 220, easing: "linear" }
    ]);
    assert.deepEqual(fixture.pulses.map(p => [p.getAttribute("d"), p.getAttribute("transform")]),
        fixture.paths.map(p => [p.getAttribute("d"), p.getAttribute("transform")]));
    assert.ok(fixture.pulses.every(p => p.getAttribute("id") === null &&
        p.getAttribute("marker-end") === null && p.getAttribute("data-clrs-transient") === "true"));
    fixture.animations.slice().forEach(a => a.finish());
    await new Promise(resolve => setImmediate(resolve));
    const arrival = fixture.animations.at(-1);
    assert.equal(arrival.timing.duration, DIAGRAM_PLAYBACK_ARRIVAL_MS);
    arrival.finish();
    await completion;
    assert.ok(fixture.pulses.every(p => p.removed));
    assert.match(arrival.frames[1].filter, /#73c991/u);
    assert.equal(550 + arrival.timing.duration, 650);

    for (const [speed, expected] of [[500, 450], [250, 250]]) {
        const variant = playbackFixture();
        const variantCompletion = createDiagramPlaybackAnimation(variant.svg)
            .play(variant.edges, "arrival", getDiagramPlaybackDuration(speed));
        assert.equal(
            variant.animations.reduce((sum, animation) => sum + animation.timing.duration, 0),
            expected - DIAGRAM_PLAYBACK_ARRIVAL_MS
        );
        variant.animations.slice().forEach(animation => animation.finish());
        await new Promise(resolve => setImmediate(resolve));
        const variantArrival = variant.animations.at(-1);
        assert.equal(variantArrival.timing.duration, DIAGRAM_PLAYBACK_ARRIVAL_MS);
        variantArrival.finish();
        await variantCompletion;
    }
});

test("la reproducción manual y automática consultan la misma velocidad visual", () => {
    const preview = readFileSync(new URL("../frontend/src/preview/DiagramPreview.jsx", import.meta.url), "utf8");
    assert.match(preview, /play\([\s\S]*?getDiagramPlaybackDuration\(executionSpeed\)/u);
    assert.match(preview, /executionSpeed, followExecution/u);
});

test("cancelar el recorrido elimina pulsos pendientes sin destello ni promesas rechazadas", async () => {
    const fixture = playbackFixture();
    const controller = createDiagramPlaybackAnimation(fixture.svg);
    const completion = controller.play(fixture.edges, "arrival");
    controller.cancel();
    await completion;
    assert.equal(fixture.animations.length, 2);
    assert.ok(fixture.animations.every(a => a.cancelled));
    assert.ok(fixture.pulses.every(p => p.removed));
});

test("un salto entre ámbitos destella el destino sin inventar una flecha", async () => {
    const fixture = playbackFixture();
    const controller = createDiagramPlaybackAnimation(
        fixture.svg
    );
    const completion = controller.play(
        [],
        "arrival"
    );

    assert.equal(fixture.pulses.length, 0);
    assert.equal(fixture.animations.length, 1);
    assert.equal(
        fixture.animations[0].timing.duration,
        DIAGRAM_PLAYBACK_ARRIVAL_MS
    );
    fixture.animations[0].finish();
    await completion;
});

test("un avance rápido cancela la animación del prefijo anterior", async () => {
    const fixture = playbackFixture();
    const controller = createDiagramPlaybackAnimation(
        fixture.svg
    );
    const first = controller.play(
        fixture.edges,
        "arrival"
    );
    const second = controller.play(
        [],
        "arrival"
    );

    assert.equal(fixture.animations.length, 3);
    assert.ok(
        fixture.animations.slice(0, 2)
            .every(animation => animation.cancelled)
    );
    assert.ok(fixture.pulses.every(pulse => pulse.removed));
    fixture.animations[2].finish();
    await Promise.all([first, second]);
});

test("contador y navegación comparten los límites de una sola secuencia", () => {
    assert.deepEqual(
        getDiagramPlaybackNavigation(0, 99),
        {
            stepCount: 0,
            stepIndex: -1,
            displayedStep: 0,
            hasSteps: false,
            canGoBackward: false,
            canGoForward: false
        }
    );
    assert.deepEqual(
        getDiagramPlaybackNavigation(4, 2),
        {
            stepCount: 4,
            stepIndex: 2,
            displayedStep: 3,
            hasSteps: true,
            canGoBackward: true,
            canGoForward: true
        }
    );
    assert.deepEqual(
        [
            ["first", 3],
            ["previous", 2],
            ["next", 2],
            ["latest", 0],
            ["replay", 3]
        ].map(([action, index]) =>
            moveDiagramPlaybackIndex(
                4,
                index,
                action
            )
        ),
        [0, 1, 3, 3, 0]
    );
    assert.equal(
        moveDiagramPlaybackIndex(0, 0, "next"),
        -1
    );
});

test("movimiento reducido y conexiones sin geometría no crean animaciones", async () => {
    const fixture = playbackFixture(true);
    await createDiagramPlaybackAnimation(fixture.svg).play(fixture.edges, "arrival");
    assert.equal(fixture.animations.length, 0);
    const normal = playbackFixture();
    await createDiagramPlaybackAnimation(normal.svg).play([{ identity: { modelId: "ausente" } }], "arrival");
    assert.equal(normal.animations.length, 0);
});

function playbackFixture(reducedMotion = false) {
    const animations = [], pulses = [];
    const animate = (frames, timing) => {
        let finish, reject;
        const finished = new Promise((resolve, fail) => { finish = resolve; reject = fail; });
        const animation = { frames, timing, finished, finish, cancelled: false,
            cancel() { this.cancelled = true; reject(new Error("cancelado")); } };
        animations.push(animation);
        return animation;
    };
    const paths = [40, 60].map((length, index) => {
        const path = new FakeNodeElement(`E${index}`, null, ["flowchart-link"]);
        path.setAttribute("d", `M${index},0 L${index},${length}`);
        path.setAttribute("transform", "translate(3 7)");
        path.setAttribute("marker-end", "url(#punta)");
        path.animate = animate;
        path.getTotalLength = () => length;
        path.cloneNode = () => {
            const attrs = new Map(path.attributes);
            return {
                get attributes() { return [...attrs.keys()].map(name => ({ name })); },
                getAttribute: name => attrs.get(name) ?? null,
                setAttribute: (name, value) => attrs.set(name, value),
                removeAttribute: name => attrs.delete(name),
                style: {}, animate, removed: false,
                remove() { this.removed = true; }
            };
        };
        return path;
    });
    const target = new FakeNodeElement("arrival");
    target.querySelectorAll = () => [{ animate }];
    const svg = new FakeSvg([target], paths);
    svg.edgeParent.appendChild = pulse => pulses.push(pulse);
    svg.ownerDocument = { defaultView: {
        matchMedia: () => ({ matches: reducedMotion }),
        getComputedStyle: () => ({ filter: "none", getPropertyValue: () => "#73c991" })
    } };
    return { svg, paths, pulses, animations, edges: paths.map((_, i) => ({ identity: { modelId: `E${i}` } })) };
}

test("el resaltado alcanza la geometría anidada de las terminales Mermaid", () => {
    const css = readFileSync(
        new URL(
            "../frontend/src/style.css",
            import.meta.url
        ),
        "utf8"
    );

    assert.match(
        css,
        /\.node\.clrs-diagram-execution-active\s*>\s*g\s*>\s*:is\(rect, polygon, path, circle, ellipse\)/u
    );
    assert.match(
        css,
        /\.clrs-diagram-diagnostic-error[\s\S]*?>\s*g\s*>\s*:is\(rect, polygon, path, circle, ellipse\)/u
    );
});

test("anima sutilmente los editores y respeta movimiento reducido", () => {
    const css = readFileSync(
        new URL(
            "../frontend/src/style.css",
            import.meta.url
        ),
        "utf8"
    );
    const presence = readFileSync(
        new URL(
            "../frontend/src/preview/DiagramEditorPresence.jsx",
            import.meta.url
        ),
        "utf8"
    );

    assert.match(
        css,
        /@keyframes diagram-editor-appear/u
    );
    assert.match(
        css,
        /@keyframes diagram-editor-disappear/u
    );
    assert.match(
        css,
        /prefers-reduced-motion:[\s\S]*?diagram-editor-presence-closing[\s\S]*?display:\s*none;/u
    );
    assert.match(
        presence,
        /EXIT_DURATION_MS\s*=\s*130/u
    );
});

test("selecciona figuras y flechas editables sin navegar al código", () => {
    const editableNode = node(
        "N2",
        "dato = 1",
        location(2, 5, 2, 13)
    );
    const editableEdge = {
        source: "N2",
        target: "N3",
        label: null
    };

    attachDiagramIdentity(
        editableNode,
        {
            schemaVersion: 1,
            entityType: "node",
            id: "node:main/body/statement:0",
            modelId: "N2",
            editable: true,
            deletable: true,
            figure: "assignment",
            source: {
                type: "Assignment",
                location: editableNode.location
            }
        }
    );
    attachDiagramIdentity(
        editableEdge,
        {
            schemaVersion: 1,
            entityType: "edge",
            id: "edge:E1",
            modelId: "E1",
            editable: true,
            relation: "sequence",
            insertion: {
                scopeId: "__main__",
                containerId: "__main__/body",
                branch: "body",
                index: 1,
                position: "between"
            }
        }
    );

    const nodeElement = new FakeNodeElement(
        "flowchart-_N2-0",
        "_N2"
    );
    const edgeElement = new FakeNodeElement(
        "_E1",
        null,
        ["flowchart-link"]
    );
    edgeElement.setAttribute(
        "marker-end",
        "url(#diagram-pointEnd)"
    );
    const svgElement = new FakeSvg(
        [nodeElement],
        [edgeElement]
    );
    const sourceMarker = new FakeNodeElement(
        "diagram-pointEnd",
        null,
        ["marker"]
    );
    const editableMarkers = [];
    const markerParent = {
        appendChild(marker) {
            marker.parentNode = markerParent;
            marker.remove = () => {
                marker.removed = true;
            };
            editableMarkers.push(marker);
        }
    };
    const querySelectorAll =
        svgElement.querySelectorAll
            .bind(svgElement);

    sourceMarker.parentNode = markerParent;
    svgElement.querySelectorAll = selector => {
        if (selector === "marker") {
            return [
                sourceMarker,
                ...editableMarkers.filter(
                    marker => !marker.removed
                )
            ];
        }

        if (
            selector ===
            ".clrs-diagram-edge-marker-selected"
        ) {
            return editableMarkers.filter(
                marker =>
                    !marker.removed &&
                    marker.classList.contains(
                        "clrs-diagram-edge-marker-selected"
                    )
            );
        }

        return querySelectorAll(selector);
    };
    const selections = [];
    const navigations = [];
    const editableDiagram = {
        nodes: [editableNode],
        edges: [editableEdge],
        subgraphs: []
    };
    const binding = bindDiagramInteractions({
        svgElement,
        diagram: editableDiagram,
        onNodeSelect(item) {
            navigations.push(item.id);
        },
        onEntitySelect(item) {
            selections.push(
                item?.identity?.id ?? null
            );
        }
    });

    nodeElement.dispatch("click");
    edgeElement.dispatch(
        "keydown",
        { key: "Enter" }
    );

    assert.deepEqual(
        selections,
        [
            "node:main/body/statement:0",
            "edge:E1"
        ]
    );
    assert.deepEqual(navigations, []);
    assert.equal(
        nodeElement.classList.contains(
            "clrs-diagram-entity-editable"
        ),
        true
    );
    assert.equal(
        edgeElement.classList.contains(
            "clrs-diagram-edge-editable"
        ),
        true
    );
    assert.equal(
        edgeElement.attributes.get("tabindex"),
        "0"
    );
    assert.equal(
        findEdgeElement(svgElement, "E1"),
        edgeElement
    );
    const hitTarget =
        svgElement.edgeHitTargets[0];

    assert.ok(hitTarget);
    assert.equal(
        hitTarget.classList.contains(
            "clrs-diagram-edge-hitbox"
        ),
        true
    );
    assert.equal(
        hitTarget.attributes.get("aria-hidden"),
        "true"
    );
    const editableMarker = editableMarkers[0];

    assert.ok(editableMarker);
    assert.match(
        edgeElement.getAttribute("marker-end"),
        /-clrs-edge-E1-/u
    );
    hitTarget.dispatch("pointerenter");
    assert.equal(
        editableMarker.classList.contains(
            "clrs-diagram-edge-marker-active"
        ),
        true
    );
    hitTarget.dispatch("pointerleave");
    assert.equal(
        editableMarker.classList.contains(
            "clrs-diagram-edge-marker-active"
        ),
        false
    );
    hitTarget.dispatch("click");
    assert.equal(
        selections.at(-1),
        "edge:E1"
    );

    assert.equal(
        highlightDiagramEntitySelection({
            svgElement,
            diagram: editableDiagram,
            identityId: "edge:E1"
        }),
        editableEdge
    );
    assert.equal(
        edgeElement.classList.contains(
            "clrs-diagram-entity-selected"
        ),
        true
    );
    assert.equal(
        edgeElement.attributes.get(
            "aria-pressed"
        ),
        "true"
    );
    assert.equal(
        editableMarker.classList.contains(
            "clrs-diagram-edge-marker-selected"
        ),
        true
    );

    edgeElement.dispatch(
        "keydown",
        { key: "Escape" }
    );
    svgElement.dispatch("click");

    assert.deepEqual(
        selections.slice(-2),
        [null, null]
    );

    binding.dispose();

    assert.equal(nodeElement.listenerCount, 0);
    assert.equal(edgeElement.listenerCount, 0);
    assert.equal(hitTarget.listenerCount, 0);
    assert.equal(hitTarget.removed, true);
    assert.equal(editableMarker.removed, true);
    assert.equal(
        edgeElement.getAttribute("marker-end"),
        "url(#diagram-pointEnd)"
    );
    assert.equal(svgElement.listenerCount, 0);
});

test("mantiene editable un Fin sintético sin ubicación y no lo hace eliminable", () => {
    const finish = {
        id: "N9",
        type: "return",
        label: "Fin",
        synthetic: true
    };

    attachDiagramIdentity(
        finish,
        {
            schemaVersion: 1,
            entityType: "node",
            id: "node:function_AUX/structure:N9",
            modelId: "N9",
            editable: true,
            deletable: false,
            figure: "return",
            editor: {
                expression: ""
            },
            materialization: {
                kind: "implicit-return",
                relation: "exit",
                insertion: {
                    scopeId: "function_AUX",
                    containerId:
                        "function_AUX/body",
                    branch: "body",
                    index: 1,
                    position: "end"
                }
            },
            source: {
                type: "ReturnStatement",
                location: null
            }
        }
    );

    const element = new FakeNodeElement(
        "flowchart-_N9-0",
        "_N9"
    );
    const svgElement = new FakeSvg([element]);
    const selections = [];
    const binding = bindDiagramInteractions({
        svgElement,
        diagram: {
            nodes: [],
            edges: [],
            subgraphs: [{
                id: "function_AUX",
                nodes: [finish],
                edges: []
            }]
        },
        onEntitySelect(item) {
            selections.push(
                item?.identity?.id ?? null
            );
        }
    });

    element.dispatch("click");

    assert.deepEqual(selections, [
        "node:function_AUX/structure:N9"
    ]);
    assert.equal(
        element.classList.contains(
            "clrs-diagram-entity-editable"
        ),
        true
    );
    assert.match(
        element.attributes.get("aria-label"),
        /Sin instrucción asociada todavía/u
    );
    assert.throws(
        () => createDiagramNodeDeleteIntent(
            finish
        ),
        /cannot be deleted/u
    );

    const emptyDraft =
        createDiagramNodeEditorDraft(finish);
    assert.equal(
        emptyDraft.fields[0].required,
        false
    );
    assert.equal(
        validateDiagramNodeEditorDraft(
            emptyDraft
        ).valid,
        true
    );
    assert.equal(
        createDiagramNodeEditIntent(emptyDraft),
        null
    );

    const draft = updateDiagramNodeEditorDraft(
        createDiagramNodeEditorDraft(finish),
        "expression",
        "resultado"
    );
    assert.equal(
        createDiagramNodeEditIntent(draft)
            .operation,
        "insert-node"
    );

    binding.dispose();
    assert.equal(element.listenerCount, 0);
});

test("presenta la creación como subproceso y centra las etiquetas terminales", () => {
    const editor = readFileSync(
        new URL(
            "../frontend/src/preview/DiagramFunctionEditor.jsx",
            import.meta.url
        ),
        "utf8"
    );
    const css = readFileSync(
        new URL(
            "../frontend/src/style.css",
            import.meta.url
        ),
        "utf8"
    );

    assert.match(editor, />\s*Crear subproceso\s*</u);
    assert.doesNotMatch(editor, />\s*Crear función\s*</u);
    assert.match(
        css,
        /\.nodeLabel p,[\s\S]*?foreignObject > div[\s\S]*?text-align:\s*center\s*!important;/u
    );
    assert.match(
        css,
        /\.nodeLabel\s+\*[\s\S]*?text-align-last:\s*center\s*!important;/u
    );
});

test("expone la ejecución directa junto al estado con un icono distinto de la reproducción", () => {
    const toolbar = readFileSync(
        new URL(
            "../frontend/src/preview/ExecutionToolbar.jsx",
            import.meta.url
        ),
        "utf8"
    );
    const app = readFileSync(
        new URL(
            "../frontend/src/App.jsx",
            import.meta.url
        ),
        "utf8"
    );
    const previewToolbar = readFileSync(
        new URL(
            "../frontend/src/preview/PreviewToolbar.jsx",
            import.meta.url
        ),
        "utf8"
    );

    assert.match(
        toolbar,
        /"Detener ejecución de código CLRS"/u
    );
    assert.match(
        toolbar,
        /isRunning \? "■" : "▷"/u
    );
    assert.match(
        toolbar,
        /isPlaying \? "Ⅱ" : "▶"/u
    );
    assert.match(
        app,
        /bridge\.requestCodeExecution\(\)/u
    );
    assert.match(
        app,
        /bridge\.requestCodeStop\(\)/u
    );
    assert.match(
        previewToolbar,
        /aria-label="Exportar diagrama de flujo"[\s\S]*?⤒/u
    );
});

test("construye un borrador editable e intenciones tipadas desde la identidad AST", () => {
    const editableNode = node(
        "N2",
        "dato = origen + 1",
        location(2, 5, 2, 22)
    );

    attachDiagramIdentity(
        editableNode,
        {
            schemaVersion: 1,
            entityType: "node",
            id: "node:main/body/statement:0",
            modelId: "N2",
            editable: true,
            deletable: true,
            figure: "assignment",
            editor: {
                target: "dato",
                expression: "origen + 1"
            },
            scopeId: "function_PRINCIPAL",
            containerId:
                "function_PRINCIPAL/body",
            branch: "body",
            statementIndex: 0,
            source: {
                type: "Assignment",
                location: editableNode.location
            }
        }
    );

    const initial =
        createDiagramNodeEditorDraft(
            editableNode
        );
    const invalid =
        updateDiagramNodeEditorDraft(
            initial,
            "target",
            ""
        );
    const updated =
        updateDiagramNodeEditorDraft(
            initial,
            "expression",
            "origen * 2"
        );
    const editIntent =
        createDiagramNodeEditIntent(updated);
    const deleteIntent =
        createDiagramNodeDeleteIntent(
            editableNode
        );

    assert.equal(
        initial.title,
        "Proceso · asignación"
    );
    assert.deepEqual(
        initial.values,
        {
            target: "dato",
            expression: "origen + 1"
        }
    );
    assert.equal(
        validateDiagramNodeEditorDraft(
            invalid
        ).valid,
        false
    );
    assert.equal(
        editIntent.operation,
        "update-node"
    );
    assert.equal(
        editIntent.values.expression,
        "origen * 2"
    );
    assert.equal(
        editIntent.context.statementIndex,
        0
    );
    assert.equal(
        deleteIntent.operation,
        "delete-node"
    );
    assert.equal(deleteIntent.values, null);
    assert.deepEqual(
        deleteIntent.confirmation,
        {
            acknowledged: true,
            impact: "statement"
        }
    );
    assert.equal(
        createDiagramNodeDeletionPreview(
            editableNode
        ).title,
        "Eliminar instrucción"
    );
    assert.equal(
        Object.isFrozen(editIntent),
        true
    );
});

test("resalta todas las coincidencias y distingue el resultado activo", () => {
    const elements = [
        new FakeNodeElement(
            "flowchart-_N1-0",
            "_N1"
        ),
        new FakeNodeElement(
            "flowchart-_N2-0",
            "_N2"
        ),
        new FakeNodeElement(
            "flowchart-_N3-0",
            "_N3"
        )
    ];
    const svgElement =
        new FakeSvg(elements);

    const active =
        highlightDiagramSearch({
            svgElement,
            matches: [
                diagram.subgraphs[0].nodes[0],
                diagram.subgraphs[0].nodes[2]
            ],
            activeNodeId: "N3"
        });

    assert.equal(active.id, "N3");
    assert.equal(
        elements[0].classList.contains(
            "clrs-diagram-search-match"
        ),
        true
    );
    assert.equal(
        elements[2].classList.contains(
            "clrs-diagram-search-active"
        ),
        true
    );

    highlightDiagramSearch({
        svgElement,
        matches: []
    });

    assert.equal(
        elements[0].classList.contains(
            "clrs-diagram-search-match"
        ),
        false
    );
    assert.equal(
        elements[2].classList.contains(
            "clrs-diagram-search-active"
        ),
        false
    );
});

test("muestra nodos visitados y distingue el paso de ejecución activo", () => {
    const elements = [
        new FakeNodeElement(
            "flowchart-_N1-0",
            "_N1"
        ),
        new FakeNodeElement(
            "flowchart-_N2-0",
            "_N2"
        ),
        new FakeNodeElement(
            "flowchart-_N3-0",
            "_N3"
        )
    ];
    const svgElement =
        new FakeSvg(elements);

    const active =
        highlightDiagramExecution({
            svgElement,
            diagram,
            steps: [
                {
                    location:
                        location(2, 5, 2, 5)
                },
                {
                    location:
                        location(3, 5, 3, 5)
                }
            ],
            activeIndex: 1,
            status: "error"
        });

    assert.equal(active.id, "N3");
    assert.equal(
        elements[1].classList.contains(
            "clrs-diagram-execution-visited"
        ),
        true
    );
    assert.equal(
        elements[2].classList.contains(
            "clrs-diagram-execution-active"
        ),
        true
    );
    assert.equal(
        elements[2].classList.contains(
            "clrs-diagram-execution-visited"
        ),
        false,
        "el paso actual no se vuelve visitado por su propia aparición"
    );
    assert.equal(
        elements[2].classList.contains(
            "clrs-diagram-execution-error"
        ),
        true
    );

    highlightDiagramExecution({
        svgElement,
        diagram,
        steps: [],
        activeIndex: -1
    });

    assert.equal(
        elements[2].classList.contains(
            "clrs-diagram-execution-active"
        ),
        false
    );

    const running =
        highlightDiagramExecution({
            svgElement,
            diagram,
            steps: [{
                location:
                    location(2, 5, 2, 5)
            }],
            activeIndex: 0,
            status: "running"
        });

    assert.equal(running.id, "N2");
    assert.equal(
        elements[1].classList.contains(
            "clrs-diagram-execution-live"
        ),
        true
    );
    assert.equal(
        elements[1].classList.contains(
            "clrs-diagram-execution-visited"
        ),
        false
    );

    const waitingElsewhere = highlightDiagramExecution({
        svgElement,
        diagram,
        steps: [{
            location: location(2, 5, 2, 5)
        }],
        activeIndex: 0,
        status: "running",
        presentationState: {
            flow: { kind: "wait" },
            nodeId: "N3"
        }
    });
    assert.equal(waitingElsewhere.id, "N3");
    assert.equal(
        elements[1].classList.contains(
            "clrs-diagram-execution-visited"
        ),
        true,
        "el estado vivo no borra el último paso ya ejecutado"
    );
    assert.equal(
        elements[2].classList.contains(
            "clrs-diagram-execution-waiting"
        ),
        true
    );

    highlightDiagramExecution({
        svgElement,
        diagram,
        steps: [
            { location: location(2, 5, 2, 5) },
            { location: location(3, 5, 3, 5) },
            { location: location(2, 5, 2, 5) }
        ],
        activeIndex: 2
    });
    assert.equal(
        elements[1].classList.contains(
            "clrs-diagram-execution-active"
        ),
        true
    );
    assert.equal(
        elements[1].classList.contains(
            "clrs-diagram-execution-visited"
        ),
        true,
        "una reevaluación conserva la visita anterior y además queda activa"
    );

    highlightDiagramExecution({
        svgElement,
        diagram,
        steps: [
            { location: location(2, 5, 2, 5) },
            { location: location(3, 5, 3, 5) },
            { location: location(2, 5, 2, 5) }
        ],
        activeIndex: 0
    });
    assert.equal(
        elements[1].classList.contains(
            "clrs-diagram-execution-visited"
        ),
        false
    );
    assert.equal(
        elements[2].classList.contains(
            "clrs-diagram-execution-visited"
        ),
        false,
        "rebobinar reconstruye clases exclusivamente desde el prefijo"
    );
});

test("resalta con error las figuras asociadas a diagnósticos localizables", () => {
    const elements = [
        new FakeNodeElement(
            "flowchart-_N1-0",
            "_N1"
        ),
        new FakeNodeElement(
            "flowchart-_N2-0",
            "_N2"
        ),
        new FakeNodeElement(
            "flowchart-_N3-0",
            "_N3"
        )
    ];
    const svgElement = new FakeSvg(elements);

    const highlighted =
        highlightDiagramDiagnostics({
            svgElement,
            diagram,
            diagnostics: [
                {
                    phase: "parser",
                    location:
                        location(2, 8, 2, 8)
                },
                {
                    phase: "semantic",
                    location:
                        location(3, 10, 3, 10)
                },
                {
                    phase: "parser",
                    location:
                        location(20, 1, 20, 1)
                }
            ]
        });

    assert.deepEqual(
        highlighted,
        ["N2", "N3"]
    );
    assert.equal(
        elements[1].classList.contains(
            "clrs-diagram-diagnostic-error"
        ),
        true
    );
    assert.equal(
        elements[1].attributes.get(
            "aria-invalid"
        ),
        "true"
    );
    assert.equal(
        elements[2].classList.contains(
            "clrs-diagram-diagnostic-error"
        ),
        true
    );

    highlightDiagramDiagnostics({
        svgElement,
        diagram,
        diagnostics: []
    });

    assert.equal(
        elements[1].classList.contains(
            "clrs-diagram-diagnostic-error"
        ),
        false
    );
    assert.equal(
        elements[1].attributes.has(
            "aria-invalid"
        ),
        false
    );
});

test("proyecta cobertura completa, parcial y ausente sobre las figuras", () => {
    const elements = [
        new FakeNodeElement(
            "flowchart-_N1-0",
            "_N1"
        ),
        new FakeNodeElement(
            "flowchart-_N2-0",
            "_N2"
        ),
        new FakeNodeElement(
            "flowchart-_N3-0",
            "_N3"
        )
    ];
    const svgElement = new FakeSvg(elements);
    const highlighted =
        highlightDiagramCoverage({
            svgElement,
            diagram,
            coverage: {
                complete: true,
                truncated: false,
                points: [
                    coveragePoint(
                        "function",
                        1,
                        1,
                        3
                    ),
                    coveragePoint(
                        "statement",
                        2,
                        4
                    ),
                    coveragePoint(
                        "branch",
                        3,
                        2,
                        0
                    )
                ]
            }
        });

    assert.deepEqual(
        highlighted.map(item => [
            item.nodeId,
            item.status
        ]),
        [
            ["N1", "covered"],
            ["N2", "covered"],
            ["N3", "partial"]
        ]
    );
    assert.equal(
        elements[2].classList.contains(
            "clrs-diagram-coverage-partial"
        ),
        true
    );

    const uncovered =
        highlightDiagramCoverage({
            svgElement,
            diagram,
            coverage: {
                complete: true,
                truncated: false,
                points: [coveragePoint(
                    "statement",
                    2,
                    0
                )]
            }
        });

    assert.equal(
        uncovered[0].status,
        "uncovered"
    );
    assert.equal(
        elements[1].attributes.get(
            "data-clrs-coverage"
        ),
        "uncovered"
    );

    const unknown = highlightDiagramCoverage({
        svgElement,
        diagram,
        coverage: {
            complete: false,
            truncated: true,
            points: [coveragePoint(
                "statement",
                2,
                0
            )]
        }
    });

    assert.equal(unknown[0].status, "unknown");

    highlightDiagramCoverage({
        svgElement,
        diagram,
        coverage: null
    });
    assert.equal(
        elements[1].attributes.has(
            "data-clrs-coverage"
        ),
        false
    );
});

function node(id, label, nodeLocation) {
    return {
        id,
        type: "process",
        label,
        location: nodeLocation
    };
}

function coveragePoint(
    kind,
    line,
    hitCount,
    falseOutcomes = 0
) {
    return {
        pointId: `${kind}:${line}`,
        kind,
        location: location(
            line,
            5,
            line,
            12
        ),
        hitCount,
        outcomeCounts: {
            true:
                kind === "branch" ||
                kind === "loop"
                    ? hitCount
                    : 0,
            false: falseOutcomes
        }
    };
}

function location(
    startLine,
    startColumn,
    endLine,
    endColumn
) {
    return {
        startLine,
        startColumn,
        endLine,
        endColumn
    };
}

function disposable() {
    return {
        dispose() {}
    };
}

function createTextDocument(uri) {
    const text = [
        "PRINCIPAL()",
        "    dato = 1"
    ].join("\n");

    return {
        uri,
        fileName: uri.fsPath,
        version: 1,
        getText() {
            return text;
        },
        offsetAt(position) {
            const lines = text.split("\n");
            let offset = 0;

            for (
                let index = 0;
                index < position.line;
                index += 1
            ) {
                offset += lines[index].length + 1;
            }

            return offset + position.character;
        },
        positionAt(offset) {
            const before = text.slice(0, offset);
            const lines = before.split("\n");

            return {
                line: lines.length - 1,
                character:
                    lines.at(-1).length
            };
        },
        validateRange(range) {
            return range;
        }
    };
}

function createMutableTextDocument(
    uri,
    initialText,
    version
) {
    let text = initialText;

    return {
        uri,
        fileName: uri.fsPath,
        version,
        getText(range = null) {
            if (!range) {
                return text;
            }

            return text.slice(
                this.offsetAt(range.start),
                this.offsetAt(range.end)
            );
        },
        offsetAt(position) {
            const lines = text.split("\n");
            let offset = 0;

            for (
                let index = 0;
                index < position.line;
                index += 1
            ) {
                offset +=
                    lines[index].length + 1;
            }

            return offset + position.character;
        },
        positionAt(offset) {
            const before = text.slice(0, offset);
            const lines = before.split("\n");

            return {
                line: lines.length - 1,
                character:
                    lines.at(-1).length
            };
        },
        replace(start, end, newText) {
            text =
                text.slice(0, start) +
                newText +
                text.slice(end);
        },
        validateRange(range) {
            return range;
        }
    };
}

function createTextEditor(
    document,
    viewColumn,
    activeLine
) {
    const active = {
        line: activeLine,
        character: 0
    };

    return {
        document,
        viewColumn,
        selection: {
            start: active,
            end: active,
            active,
            isEmpty: true
        },
        revealRange() {}
    };
}

class FakeRange {

    constructor(
        startLine,
        startColumn,
        endLine,
        endColumn
    ) {
        this.start = {
            line: startLine,
            character: startColumn
        };
        this.end = {
            line: endLine,
            character: endColumn
        };
    }
}

class FakeSelection {

    constructor(start, end) {
        this.start = start;
        this.end = end;
        this.active = end;
        this.isEmpty =
            start.line === end.line &&
            start.character === end.character;
    }
}

class FakePositionRange {

    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
}

class FakeWorkspaceEdit {

    constructor() {
        this.edits = [];
    }

    replace(uri, range, newText) {
        this.edits.push({
            uri,
            range,
            newText
        });
    }
}

class FakeSvg {

    constructor(elements, edgeElements = []) {
        this.elements = elements;
        this.edgeElements = edgeElements;
        this.edgeHitTargets = [];
        this.listeners = new Map();
        this.edgeParent = {
            insertBefore: (
                element,
                reference
            ) => {
                assert.equal(
                    this.edgeElements.includes(
                        reference
                    ),
                    true
                );
                element.parentNode =
                    this.edgeParent;
                element.remove = () => {
                    element.removed = true;
                    const index =
                        this.edgeHitTargets
                            .indexOf(element);

                    if (index >= 0) {
                        this.edgeHitTargets.splice(
                            index,
                            1
                        );
                    }
                };
                this.edgeHitTargets.push(
                    element
                );
            }
        };

        for (const element of edgeElements) {
            element.parentNode = this.edgeParent;
        }
    }

    get listenerCount() {
        return [...this.listeners.values()]
            .reduce(
                (count, listeners) =>
                    count + listeners.size,
                0
            );
    }

    querySelectorAll(selector) {
        if (selector === ".node") {
            return this.elements;
        }

        if (
            selector ===
            ".flowchart-link, .edgePath"
        ) {
            return this.edgeElements;
        }

        const classNames =
            selector.split(",")
                .map(value =>
                    value.trim()
                )
                .map(value =>
                    value.startsWith(".")
                        ? value.slice(1)
                        : value
                );

        return [
            ...this.elements,
            ...this.edgeElements
        ].filter(
            element =>
                classNames.some(className =>
                    element.classList
                        .contains(className)
                )
        );
    }

    addEventListener(type, listener) {
        const listeners =
            this.listeners.get(type) ??
            new Set();

        listeners.add(listener);
        this.listeners.set(type, listeners);
    }

    removeEventListener(type, listener) {
        this.listeners.get(type)
            ?.delete(listener);
    }

    dispatch(type) {
        const event = { target: this };

        for (
            const listener
            of this.listeners.get(type) ?? []
        ) {
            listener(event);
        }
    }
}

class FakeNodeElement {

    constructor(
        id,
        dataId,
        classes = ["node"]
    ) {
        this.attributes = new Map(
            [
                ["id", id],
                ["data-id", dataId]
            ].filter(([, value]) =>
                value != null
            )
        );
        this.classList =
            new FakeClassList(classes);
        this.listeners = new Map();
        this.ownerDocument = null;
        this.parentNode = null;
        this.removed = false;
    }

    get listenerCount() {
        return [...this.listeners.values()]
            .reduce(
                (count, listeners) =>
                    count + listeners.size,
                0
            );
    }

    getAttribute(name) {
        return this.attributes.get(name) ??
            null;
    }

    setAttribute(name, value) {
        this.attributes.set(
            name,
            String(value)
        );
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    cloneNode() {
        const clone = new FakeNodeElement(
            null,
            null,
            [...this.classList.values]
        );

        clone.attributes = new Map(
            this.attributes
        );

        return clone;
    }

    addEventListener(type, listener) {
        const listeners =
            this.listeners.get(type) ??
            new Set();

        listeners.add(listener);
        this.listeners.set(type, listeners);
    }

    removeEventListener(type, listener) {
        this.listeners.get(type)
            ?.delete(listener);
    }

    dispatch(type, options = {}) {
        const event = {
            key: options.key,
            preventDefault() {},
            stopPropagation() {}
        };

        for (
            const listener
            of this.listeners.get(type) ?? []
        ) {
            listener(event);
        }
    }
}

class FakeClassList {

    constructor(values = []) {
        this.values = new Set(values);
    }

    add(...values) {
        for (const value of values) {
            this.values.add(value);
        }
    }

    remove(...values) {
        for (const value of values) {
            this.values.delete(value);
        }
    }

    contains(value) {
        return this.values.has(value);
    }

    toggle(value, force) {
        const enabled = force ??
            !this.values.has(value);

        if (enabled) {
            this.values.add(value);
        } else {
            this.values.delete(value);
        }

        return enabled;
    }
}
