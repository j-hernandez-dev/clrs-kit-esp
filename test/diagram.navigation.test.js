import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    ALL_DIAGRAM_SCOPE,
    focusDiagram,
    getDiagramScopes,
    normalizeSearchIndex,
    searchDiagramNodes
} from "../frontend/src/navigation/DiagramNavigation.js";
import {
    DiagramViewportController,
    getVisibleDiagramRect
} from "../frontend/src/navigation/DiagramViewport.js";
import {
    calculateMinimapGeometry,
    minimapPointToDiagram,
    prepareMinimapSvgClone
} from "../frontend/src/navigation/DiagramMinimap.js";

const diagram = {
    nodes: [
        node("N1", "Flujo principal"),
        node("N2", "Llamar ORDENA")
    ],
    edges: [{ from: "N1", to: "N2" }],
    subgraphs: [
        {
            id: "top_level",
            title: "Global",
            nodes: [
                node("N3", "Preparación")
            ],
            edges: []
        },
        {
            id: "function_ORDENA",
            title: "ORDENA(A)",
            nodes: [
                {
                    ...node(
                        "N4",
                        "Función RÁPIDA"
                    ),
                    reference: {
                        name: "ORDENA"
                    }
                }
            ],
            edges: []
        }
    ]
};

test("ofrece ámbitos para el flujo principal, global y cada función", () => {
    assert.deepEqual(
        getDiagramScopes(diagram),
        [
            {
                id: ALL_DIAGRAM_SCOPE,
                label: "Diagrama completo",
                type: "all"
            },
            {
                id: "__main__",
                label: "Flujo principal",
                type: "main"
            },
            {
                id: "top_level",
                label: "Flujo global",
                type: "global"
            },
            {
                id: "function_ORDENA",
                label: "Función ORDENA(A)",
                type: "function"
            }
        ]
    );
});

test("aísla un flujo sin modificar el modelo completo", () => {
    const main = focusDiagram(
        diagram,
        "__main__"
    );
    const functionFlow = focusDiagram(
        diagram,
        "function_ORDENA"
    );

    assert.equal(
        focusDiagram(
            diagram,
            ALL_DIAGRAM_SCOPE
        ),
        diagram
    );
    assert.equal(main.nodes.length, 2);
    assert.deepEqual(main.subgraphs, []);
    assert.deepEqual(functionFlow.nodes, []);
    assert.deepEqual(functionFlow.edges, []);
    assert.deepEqual(
        functionFlow.subgraphs,
        [diagram.subgraphs[1]]
    );
    assert.equal(diagram.subgraphs.length, 2);
});

test("busca nodos sin distinguir mayúsculas ni diacríticos y recorre circularmente", () => {
    assert.deepEqual(
        searchDiagramNodes(
            diagram,
            "funcion rapida"
        ).map(item => item.id),
        ["N4"]
    );
    assert.deepEqual(
        searchDiagramNodes(
            diagram,
            "ordena"
        ).map(item => item.id),
        ["N2", "N4"]
    );
    assert.equal(
        normalizeSearchIndex(2, 2),
        0
    );
    assert.equal(
        normalizeSearchIndex(-1, 2),
        1
    );
    assert.equal(
        normalizeSearchIndex(8, 0),
        0
    );
});

test("el controlador centraliza ajuste, enfoque y limpieza del pan-zoom", () => {
    const panZoom = new FakePanZoom();
    const controller =
        new DiagramViewportController(
            panZoom,
            {}
        );
    const snapshots = [];
    const unsubscribe =
        controller.subscribe(snapshot =>
            snapshots.push(snapshot)
        );

    controller.fitAll();
    const focused = controller.focusNode({
        getBBox() {
            return {
                x: 100,
                y: 50,
                width: 100,
                height: 50
            };
        }
    });
    controller.panToPoint({
        x: 250,
        y: 125
    });
    unsubscribe();
    controller.dispose();
    controller.dispose();

    assert.equal(focused, true);
    assert.equal(panZoom.resizeCount, 2);
    assert.equal(panZoom.fitCount, 1);
    assert.equal(panZoom.centerCount, 1);
    assert.ok(panZoom.zoomCalls.length > 0);
    assert.deepEqual(
        panZoom.panCalls.at(-1),
        {
            x:
                400 -
                250 * panZoom.realZoom,
            y:
                300 -
                125 * panZoom.realZoom
        }
    );
    assert.equal(panZoom.destroyCount, 1);
    assert.ok(snapshots.length >= 4);
});

test("el encuadre inicial conserva un tamaÃ±o legible en diagramas grandes", () => {
    const panZoom = new FakePanZoom();
    const controller =
        new DiagramViewportController(
            panZoom,
            {}
        );

    panZoom.realZoom = 0.24;
    panZoom.zoomLevel = 1;

    controller.fitReadable(0.72);

    assert.equal(panZoom.resizeCount, 1);
    assert.equal(panZoom.fitCount, 1);
    assert.equal(panZoom.centerCount, 1);
    assert.deepEqual(
        panZoom.zoomCalls,
        [3]
    );

    controller.dispose();
});

test("el encuadre inicial no amplÃ­a un diagrama que ya es legible", () => {
    const panZoom = new FakePanZoom();
    const controller =
        new DiagramViewportController(
            panZoom,
            {}
        );

    panZoom.realZoom = 0.8;

    controller.fitReadable(0.72);

    assert.equal(panZoom.fitCount, 1);
    assert.equal(panZoom.centerCount, 1);
    assert.deepEqual(
        panZoom.zoomCalls,
        []
    );

    controller.dispose();
});

test("calcula el área visible y la navegación por minimapa", () => {
    const snapshot = {
        pan: {
            x: -200,
            y: -100
        },
        zoom: 1,
        sizes: {
            width: 400,
            height: 200,
            realZoom: 2,
            viewBox: {
                x: 0,
                y: 0,
                width: 400,
                height: 200
            }
        }
    };

    assert.deepEqual(
        getVisibleDiagramRect(snapshot),
        {
            x: 100,
            y: 50,
            width: 200,
            height: 100
        }
    );
    assert.deepEqual(
        calculateMinimapGeometry(
            snapshot,
            200,
            100
        ).viewport,
        {
            x: 50,
            y: 25,
            width: 100,
            height: 50
        }
    );
    assert.deepEqual(
        minimapPointToDiagram(
            snapshot,
            200,
            100,
            100,
            50
        ),
        {
            x: 200,
            y: 100
        }
    );
});

test("el minimapa resuelve estilos heredados sin reemplazar las geometrías SVG", () => {
    const shapes = [
        { tag: "polygon", points: "0,0 80,0 60,40 -20,40", transform: "translate(-30,-20)" },
        { tag: "polygon", points: "40,0 80,40 40,80 0,40" },
        { tag: "polygon", points: "10,0 70,0 80,20 70,40 10,40 0,20" },
        { tag: "polygon", points: "0,0 80,0 80,40 0,40 0,0 -8,0 88,0 88,40 -8,40 -8,0" },
        { tag: "path", d: "M20,0 H60 A20,20 0 0 1 60,40 H20 A20,20 0 0 1 20,0 Z" },
        { tag: "rect", width: "80", height: "40" },
        { tag: "circle", r: "4" }
    ];
    const copies = shapes.map(shape => ({
        ...shape,
        style: {
            values: new Map([
                ["stroke", "var(--clrs-execution-stroke)"]
            ]),
            setProperty(name, value, priority) {
                assert.equal(priority, "important");
                this.values.set(name, value);
            }
        }
    }));
    const resolved = {
        stroke: "rgb(115, 201, 145)",
        "stroke-width": "5px",
        "stroke-dasharray": "none",
        fill: "rgb(24, 24, 24)",
        rx: "8px",
        ry: "8px"
    };
    const source = {
        ownerDocument: { defaultView: {
            getComputedStyle(element) {
                assert.ok(shapes.includes(element));
                return { getPropertyValue: name => resolved[name] ?? "" };
            }
        } },
        querySelectorAll: () => shapes
    };
    const clone = {
        querySelector: () => null,
        querySelectorAll: selector => selector.startsWith("rect,") ? copies : [],
        removeAttribute() {},
        setAttribute() {}
    };

    prepareMinimapSvgClone(clone, null, source);

    for (const [index, copy] of copies.entries()) {
        const { style, ...geometry } = copy;
        assert.deepEqual(geometry, shapes[index]);
        for (const [property, value] of Object.entries(resolved)) {
            assert.equal(style.values.get(property), value);
        }
    }
});

test("el minimapa conserva geometría y omite etiquetas inestables", () => {
    const removed = [];
    const removedAttributes = [];
    const removedStyleProperties = [];
    const attributes = new Map();
    const viewport = {
        style: {
            removeProperty(name) {
                removedStyleProperties.push(
                    name
                );
            }
        },
        removeAttribute(name) {
            removedAttributes.push(name);
        }
    };
    const clone = {
        querySelector(selector) {
            assert.equal(
                selector,
                ".svg-pan-zoom_viewport"
            );
            return viewport;
        },
        querySelectorAll(selector) {
            assert.match(selector, /foreignObject/u);
            assert.match(selector, /\.node \.label/u);
            assert.match(selector, /\.edgeLabel/u);
            assert.match(
                selector,
                /\.clrs-diagram-edge-hit-target/u
            );
            return [
                { remove: () => removed.push("label") },
                { remove: () => removed.push("hit-target") }
            ];
        },
        removeAttribute(name) {
            removedAttributes.push(name);
        },
        setAttribute(name, value) {
            attributes.set(name, value);
        }
    };

    assert.equal(
        prepareMinimapSvgClone(
            clone,
            {
                x: -20,
                y: 10,
                width: 640,
                height: 360
            }
        ),
        clone
    );
    assert.deepEqual(
        removed,
        ["label", "hit-target"]
    );
    assert.deepEqual(
        removedAttributes,
        ["transform", "width", "height", "style"]
    );
    assert.deepEqual(
        removedStyleProperties,
        [
            "transform",
            "-webkit-transform",
            "-ms-transform"
        ]
    );
    assert.equal(
        attributes.get("preserveAspectRatio"),
        "xMidYMid meet"
    );
    assert.equal(
        attributes.get("overflow"),
        "hidden"
    );
    assert.equal(
        attributes.get("viewBox"),
        "-20 10 640 360"
    );
    assert.equal(
        attributes.get("width"),
        "640"
    );
    assert.equal(
        attributes.get("height"),
        "360"
    );

    const css = readFileSync(
        new URL(
            "../frontend/src/style.css",
            import.meta.url
        ),
        "utf8"
    );

    assert.match(
        css,
        /\.diagram-minimap\s*\{[\s\S]*?opacity:\s*1;/u
    );
});

test("centra un nodo Mermaid usando su posiciÃ³n transformada en pantalla", () => {
    const panZoom = new FakePanZoom();

    panZoom.panValue = {
        x: -200,
        y: -100
    };

    const controller =
        new DiagramViewportController(
            panZoom,
            {
                getBoundingClientRect() {
                    return {
                        left: 10,
                        top: 20,
                        width: 800,
                        height: 600
                    };
                }
            }
        );
    const centered = controller.centerNode({
        getBBox() {
            return {
                x: -50,
                y: -25,
                width: 100,
                height: 50
            };
        },
        getBoundingClientRect() {
            return {
                left: 210,
                top: 120,
                width: 200,
                height: 100
            };
        }
    });

    assert.equal(centered, true);
    assert.equal(panZoom.resizeCount, 1);
    assert.deepEqual(
        panZoom.panCalls.at(-1),
        {
            x: -100,
            y: 50
        }
    );

    controller.dispose();
});

test("sincroniza el viewport redimensionado antes de ajustar el nodo activo", () => {
    const panZoom = new FakePanZoom();

    panZoom.width = 320;
    panZoom.height = 240;
    panZoom.resizeEffect = () => {
        panZoom.width = 1000;
        panZoom.height = 800;
    };

    const controller =
        new DiagramViewportController(
            panZoom,
            {}
        );
    const focused = controller.focusNode({
        getBBox() {
            return {
                x: 100,
                y: 50,
                width: 100,
                height: 50
            };
        }
    });

    assert.equal(focused, true);
    assert.equal(panZoom.resizeCount, 1);
    assert.deepEqual(
        panZoom.panCalls.at(-1),
        {
            x: -125,
            y: 87.5
        }
    );

    controller.dispose();
});

function node(id, label) {
    return {
        id,
        type: "process",
        label
    };
}

class FakePanZoom {
    constructor() {
        this.zoomLevel = 1;
        this.realZoom = 2;
        this.width = 800;
        this.height = 600;
        this.panValue = { x: 0, y: 0 };
        this.resizeCount = 0;
        this.fitCount = 0;
        this.centerCount = 0;
        this.destroyCount = 0;
        this.zoomCalls = [];
        this.panCalls = [];
    }

    getSizes() {
        return {
            width: this.width,
            height: this.height,
            realZoom: this.realZoom,
            viewBox: {
                x: 0,
                y: 0,
                width: 1000,
                height: 800
            }
        };
    }

    getPan() {
        return { ...this.panValue };
    }

    getZoom() {
        return this.zoomLevel;
    }

    resize() {
        this.resizeCount += 1;
        this.resizeEffect?.();
    }

    fit() {
        this.fitCount += 1;
    }

    center() {
        this.centerCount += 1;
    }

    zoom(value) {
        this.zoomLevel = value;
        this.realZoom = value * 2;
        this.zoomCalls.push(value);
    }

    pan(value) {
        this.panValue = { ...value };
        this.panCalls.push(value);
    }

    destroy() {
        this.destroyCount += 1;
    }
}
