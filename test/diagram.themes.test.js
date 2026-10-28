import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
    DEFAULT_THEME_ID,
    getAvailableThemes,
    getTheme
} from "../frontend/src/themes/ThemeManager.js";
import {
    createDocumentColorResolver,
    createVSCodeTheme,
    getColorAppearance
} from "../frontend/src/themes/presets/VSCodeTheme.js";
import {
    styleDiagramSvg
} from "../frontend/src/renderer/DiagramSvgStyler.js";
import {
    buildMermaidThemeVariables
} from "../frontend/src/themes/MermaidThemeVariables.js";
import {
    createFlowchartConfig,
    FLOWCHART_CONFIG
} from "../frontend/src/renderer/MermaidInitializer.js";
import {
    CONNECTION_STYLES,
    DEFAULT_CONNECTION_STYLE,
    getMermaidCurve
} from "../frontend/src/config/ConnectionStyles.js";

test("el hover conserva el color temático de cada contorno sin cambiar su geometría", () => {
    const shapes = ["rgb(120, 40, 170)", "rgb(35, 150, 90)"].map(stroke => ({
        stroke,
        style: { setProperty(name, value) { this[name] = value; } }
    }));
    const svg = {
        style: {},
        ownerDocument: { defaultView: {
            getComputedStyle: shape => ({ stroke: shape.stroke })
        } },
        querySelectorAll: selector => selector.includes("g:not(.label)") ? shapes : []
    };
    styleDiagramSvg(svg, {});
    for (const shape of shapes) {
        assert.equal(shape.style["--clrs-node-outline-color"], shape.stroke);
        assert.equal(shape.style.stroke, undefined);
        assert.equal(shape.style.fill, undefined);
        assert.equal(shape.style.transform, undefined);
    }
});

test("la selección anima sólo el contorno y cede prioridad a la ejecución", () => {
    const css = readFileSync(new URL("../frontend/src/style.css", import.meta.url), "utf8");
    const selection = css.match(/\.node\.clrs-diagram-entity-editable\.clrs-diagram-entity-selected[^{}]+\{([^}]+)\}/u);
    assert.ok(selection);
    assert.match(selection[0], /:not\(\.clrs-diagram-execution-active\)/u);
    assert.match(selection[1], /stroke-dasharray:\s*4 4 !important/u);
    assert.match(selection[1], /animation:\s*diagram-selection-ants/u);
    assert.doesNotMatch(selection[1], /(?:fill|transform|stroke-width):/u);
    assert.match(css, /@keyframes diagram-selection-ants\s*\{\s*from \{ stroke-dashoffset: 0; \}\s*to \{ stroke-dashoffset: -8; \}\s*\}/u);

    const hover = css.match(/\.node:hover[^{}]+\{([^}]+)\}/u);
    assert.ok(hover);
    assert.match(hover[0], /:not\(\.clrs-diagram-execution-active\):not\(\.clrs-diagram-entity-selected\)/u);
    assert.match(hover[1], /drop-shadow/u);
    assert.doesNotMatch(hover[1], /(?:fill|stroke|stroke-width|transform):/u);
    const waiting = css.match(/\.node\.clrs-diagram-execution-waiting >[^{}]+\{([^}]+)\}/u);
    assert.ok(waiting);
    assert.match(waiting[1], /stroke-dasharray:\s*none !important/u);
    assert.match(waiting[1], /animation:\s*none/u);
    assert.match(css, /\.node:is\(\.node-start, \.node-return\)\.clrs-diagram-entity-selected:not\(\.clrs-diagram-execution-active\)[^{]+path\[fill="none"\]\s*\{\s*stroke-opacity: 0;\s*animation: none;/u);
});

test("alterna conexiones curvas, lineales y ortogonales sin cambiar el modelo", () => {
    const curved = createFlowchartConfig({
        connectionStyle:
            CONNECTION_STYLES.CURVED
    });
    const straight = createFlowchartConfig({
        connectionStyle:
            CONNECTION_STYLES.STRAIGHT
    });
    const verticalOrthogonal = createFlowchartConfig({
        connectionStyle:
            CONNECTION_STYLES.ORTHOGONAL,
        direction: "TB"
    });
    const horizontalOrthogonal = createFlowchartConfig({
        connectionStyle:
            CONNECTION_STYLES.ORTHOGONAL,
        direction: "LR"
    });

    assert.equal(
        DEFAULT_CONNECTION_STYLE,
        CONNECTION_STYLES.CURVED
    );
    assert.equal(curved.curve, "basis");
    assert.equal(straight.curve, "linear");
    assert.equal(
        verticalOrthogonal.curve,
        "stepAfter"
    );
    assert.equal(
        horizontalOrthogonal.curve,
        "stepBefore"
    );
    assert.equal(FLOWCHART_CONFIG.curve, "basis");
    assert.throws(
        () => getMermaidCurve("unknown"),
        /Unknown diagram connection style/u
    );
});

test("coloca el selector de conexiones después de la dirección y vuelve a renderizar", () => {
    const toolbar = readFileSync(
        new URL(
            "../frontend/src/preview/PreviewToolbar.jsx",
            import.meta.url
        ),
        "utf8"
    );
    const preview = readFileSync(
        new URL(
            "../frontend/src/preview/DiagramPreview.jsx",
            import.meta.url
        ),
        "utf8"
    );
    const directionSelector =
        toolbar.indexOf(
            'aria-label="Dirección del diagrama"'
        );
    const connectionSelector =
        toolbar.indexOf(
            'aria-label="Estilo de conexiones"'
        );
    const scopeSelector = toolbar.indexOf(
        'aria-label="Flujo visible"'
    );

    assert.ok(directionSelector >= 0);
    assert.ok(
        connectionSelector > directionSelector
    );
    assert.ok(scopeSelector > connectionSelector);
    assert.match(toolbar, /↷ Curvo/u);
    assert.match(toolbar, /↘ Lineal/u);
    assert.match(toolbar, /↴ Ortogonal/u);
    assert.match(
        preview,
        /renderMermaid\(\{[\s\S]*?connectionStyle[\s\S]*?\}\)/u
    );
    assert.match(
        preview,
        /onConnectionStyleChange=\{[\s\S]*?setConnectionStyle/u
    );
});

test("compensa la altura de figuras y compacta el rombo", () => {
    const stylesheet = readFileSync(
        new URL(
            "../frontend/src/style.css",
            import.meta.url
        ),
        "utf8"
    );

    assert.equal(
        FLOWCHART_CONFIG.padding,
        8
    );
    assert.match(
        stylesheet,
        /\.node-process[\s\S]*?min-height:\s*20px/u
    );
    assert.match(
        stylesheet,
        /\.node-call[\s\S]*?\.node-write[\s\S]*?min-height:\s*28px/u
    );
});

test("el tema de VS Code es el predeterminado y aparece primero", () => {
    const available =
        getAvailableThemes();
    const configuration =
        getTheme();

    assert.equal(
        DEFAULT_THEME_ID,
        "vscode"
    );
    assert.equal(
        available[0].id,
        DEFAULT_THEME_ID
    );
    assert.equal(
        configuration.theme.id,
        DEFAULT_THEME_ID
    );
});

test("resuelve colores de VS Code a literales Mermaid portátiles", () => {
    const colors = {
        "--vscode-editor-background":
            "rgb(250, 250, 250)",
        "--vscode-editor-foreground":
            "#202020",
        "--vscode-contrastBorder":
            "rgba(1, 2, 3, 0.5)",
        "--vscode-contrastActiveBorder":
            "#123",
        "--vscode-symbolIcon-variableForeground":
            "rgb(10, 20, 30)",
        "--vscode-symbolIcon-functionForeground":
            "#456789",
        "--vscode-editorWarning-foreground":
            "#AA5500",
        "--vscode-textLink-foreground":
            "#0066CC"
    };
    const theme =
        createVSCodeTheme(
            (name, fallback) =>
                colors[name] ??
                fallback
        );

    assert.equal(
        theme.canvas.background,
        "#FAFAFA"
    );
    assert.equal(
        theme.appearance,
        "light"
    );
    assert.equal(
        theme.subgraph.stroke,
        "#01020380"
    );
    assert.equal(
        theme.subgraph.fill,
        theme.canvas.background
    );
    assert.equal(
        theme.nodes.process.stroke,
        "#0A141E"
    );
    assert.equal(
        theme.nodes.call.stroke,
        "#456789"
    );
    assert.equal(
        theme.nodes.decision.stroke,
        "#AA5500"
    );
    assert.equal(
        theme.nodes.write.stroke,
        "#0066CC"
    );
    assert.equal(
        containsCssVariable(theme),
        false
    );
    assert.equal(
        containsColorWithComma(theme),
        false
    );
});

test("fija el color temÃ¡tico en lÃ­neas y puntas de flecha", () => {
    const links = [
        { style: {} },
        { style: {} }
    ];
    const markers = [
        { style: {} },
        { style: {} }
    ];
    const clusters = [
        { style: {} },
        { style: {} }
    ];
    const clusterLabels = [
        { style: {} }
    ];
    const edgeLabelRects = [
        {
            style: {},
            attributes: {},
            setAttribute(name, value) {
                this.attributes[name] = value;
            }
        }
    ];
    const edgeLabelHtml = [
        { style: {} },
        { style: {} }
    ];
    const svgElement = {
        style: {},
        querySelectorAll(selector) {
            if (selector.includes("marker")) {
                return markers;
            }

            if (
                selector ===
                    ".cluster rect"
            ) {
                return clusters;
            }

            if (
                selector.includes(
                    ".cluster-label"
                )
            ) {
                return clusterLabels;
            }

            if (
                selector ===
                    ".edgeLabel rect"
            ) {
                return edgeLabelRects;
            }

            if (
                selector.includes(
                    ".edgeLabel .labelBkg"
                )
            ) {
                return edgeLabelHtml;
            }

            return links;
        }
    };

    styleDiagramSvg(
        svgElement,
        {
            theme: {
                arrow: {
                    color: "#D4D4D4"
                },
                subgraph: {
                    fill: "#1E1E1E",
                    stroke: "#454545",
                    text: "#D4D4D4"
                }
            }
        }
    );

    assert.equal(
        svgElement.style.width,
        "100%"
    );
    assert.deepEqual(
        links.map(link => link.style),
        [
            {
                strokeWidth: "2px",
                fill: "none",
                stroke: "#D4D4D4"
            },
            {
                strokeWidth: "2px",
                fill: "none",
                stroke: "#D4D4D4"
            }
        ]
    );
    assert.deepEqual(
        markers.map(marker =>
            marker.style
        ),
        [
            {
                fill: "#D4D4D4",
                stroke: "#D4D4D4"
            },
            {
                fill: "#D4D4D4",
                stroke: "#D4D4D4"
            }
        ]
    );
    assert.deepEqual(
        clusters.map(cluster =>
            cluster.style
        ),
        [
            {
                fill: "#1E1E1E",
                stroke: "#454545"
            },
            {
                fill: "#1E1E1E",
                stroke: "#454545"
            }
        ]
    );
    assert.deepEqual(
        clusterLabels[0].style,
        {
            fill: "#D4D4D4",
            color: "#D4D4D4"
        }
    );
    assert.deepEqual(
        edgeLabelRects[0].style,
        {
            fill: "#1E1E1E",
            fillOpacity: "1",
            stroke: "none",
            rx: "999px",
            ry: "999px"
        }
    );
    assert.deepEqual(
        edgeLabelRects[0].attributes,
        {
            rx: "999",
            ry: "999"
        }
    );
    assert.deepEqual(
        edgeLabelHtml.map(label =>
            label.style
        ),
        [
            {
                backgroundColor:
                    "#1E1E1E",
                backgroundImage:
                    "none",
                borderRadius: "999px",
                opacity: "1"
            },
            {
                backgroundColor:
                    "#1E1E1E",
                backgroundImage:
                    "none",
                borderRadius: "999px",
                opacity: "1"
            }
        ]
    );
});

test("usa el fondo del subgrafo para las etiquetas de conexiones", () => {
    const variables =
        buildMermaidThemeVariables({
            canvas: {
                background: "#FFFFFF"
            },
            arrow: {
                color: "#111111",
                colorLabel: "#FF00FF"
            },
            subgraph: {
                fill: "#F3F4F6",
                stroke: "#6B7280",
                text: "#111827"
            },
            nodes: {
                process: {
                    fill: "#FFFFFF",
                    stroke: "#111111",
                    text: "#111111"
                },
                call: {
                    fill: "#FFFFFF",
                    stroke: "#111111",
                    text: "#111111"
                },
                decision: {
                    fill: "#FFFFFF",
                    stroke: "#111111",
                    text: "#111111"
                }
            }
        });

    assert.equal(
        variables.edgeLabelBackground,
        "#F3F4F6"
    );
});

test("el resolvedor documental usa variables efectivas y fallbacks", () => {
    const resolver =
        createDocumentColorResolver({
            documentElement: {},
            defaultView: {
                getComputedStyle() {
                    return {
                        getPropertyValue(name) {
                            return (
                                name ===
                                "--vscode-editor-background"
                                    ? " #F0F0F0 "
                                    : ""
                            );
                        }
                    };
                }
            }
        });

    assert.equal(
        resolver(
            "--vscode-editor-background",
            "#000000"
        ),
        "#F0F0F0"
    );
    assert.equal(
        resolver(
            "--vscode-missing",
            "#ABCDEF"
        ),
        "#ABCDEF"
    );
});

test("clasifica fondos claros y oscuros", () => {
    assert.equal(
        getColorAppearance("#1E1E1E"),
        "dark"
    );
    assert.equal(
        getColorAppearance(
            "rgb(245, 245, 245)"
        ),
        "light"
    );
});

function containsCssVariable(value) {
    return allStrings(value)
        .some(text =>
            text.includes("var(") ||
            text.includes("--vscode-")
        );
}

function containsColorWithComma(value) {
    return allStrings(value)
        .some(text =>
            /^(?:rgb|hsl)a?\(/i
                .test(text)
        );
}

function allStrings(value) {
    if (typeof value === "string") {
        return [value];
    }

    if (
        !value ||
        typeof value !== "object"
    ) {
        return [];
    }

    return Object.values(value)
        .flatMap(allStrings);
}
