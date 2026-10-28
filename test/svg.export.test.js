import test from "node:test";
import assert from "node:assert/strict";

import {
    capturePreviewSvg,
    convertHtmlLabelsToSvgText,
    createStandaloneSvg,
    exportSvg,
    normalizeSvgTextEntities,
    setExportSource
} from "../frontend/src/renderer/SvgExporter.js";
import {
    createVSCodeTheme
} from "../frontend/src/themes/presets/VSCodeTheme.js";
import {
    CONNECTION_STYLES
} from "../frontend/src/config/ConnectionStyles.js";

test("la exportación vuelve a renderizar etiquetas SVG nativas", async () => {
    const initializations = [];

    setExportSource({
        diagram:
            "flowchart TB\n_A[\"n - 1\"]",
        themeConfig: {
            type: "custom",
            theme:
                createVSCodeTheme(
                    (name, fallback) =>
                        name ===
                        "--vscode-editor-background"
                            ? "rgb(250, 250, 250)"
                            : fallback
                )
        },
        connectionStyle:
            CONNECTION_STYLES.STRAIGHT
    });

    const svg = await exportSvg({
        initialize(
            themeConfig,
            options
        ) {
            initializations.push({
                themeConfig,
                options
            });
        },
        mermaidApi: {
            async render(id, diagram) {
                assert.match(
                    id,
                    /^diagram-export-/
                );
                assert.match(
                    diagram,
                    /n - 1/
                );

                return {
                    svg:
                        '<svg viewBox="0 0 240 120" ' +
                        'style="max-width: 240px;">' +
                        "<style>.label{fill:#111}</style>" +
                        "<text><tspan>" +
                        "&amp;quot;Cantidad&amp;quot; " +
                        "n - 1</tspan></text>" +
                        "</svg>"
                };
            }
        }
    });

    assert.deepEqual(
        initializations.map(
            entry =>
                entry.options.htmlLabels
        ),
        [false, true]
    );
    assert.deepEqual(
        initializations.map(
            entry =>
                entry.options
                    .connectionStyle
        ),
        [
            CONNECTION_STYLES.STRAIGHT,
            CONNECTION_STYLES.STRAIGHT
        ]
    );
    assert.match(
        svg,
        /^<\?xml version="1\.0"/
    );
    assert.match(
        svg,
        /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/
    );
    assert.match(
        svg,
        /width="240" height="120"/
    );
    assert.doesNotMatch(
        svg,
        /<rect[^>]+fill="#FAFAFA"/
    );
    assert.match(
        svg,
        /<tspan>&quot;Cantidad&quot; n - 1<\/tspan>/
    );
    assert.doesNotMatch(svg, /&amp;quot;/);
    assert.doesNotMatch(svg, /foreignObject/i);
    assert.doesNotMatch(svg, /max-width/i);
    assert.doesNotMatch(
        svg,
        /var\(|--vscode-/
    );
});

test("normaliza entidades XML sin alterar ampersands legítimos", () => {
    assert.equal(
        normalizeSvgTextEntities(
            "&amp;quot;A&amp;quot; " +
            "&amp;apos;B&amp;apos; " +
            "&amp;#241; &amp;"
        ),
        "&quot;A&quot; " +
        "&apos;B&apos; " +
        "&#241; &amp;"
    );
});

test("conserva la geometría del editor y convierte sus etiquetas a SVG", async () => {
    let renders = 0;

    setExportSource({
        diagram: "flowchart TB\n_A([\"Inicio\"])",
        themeConfig: {
            type: "custom",
            theme: createVSCodeTheme()
        },
        svgElement: {
            outerHTML:
                '<svg viewBox="0 0 320 180" style="width:100%;height:100%">' +
                '<g class="node node-start" transform="translate(160,40)">' +
                '<rect x="-48" y="-18" width="96" height="36" />' +
                '<g class="label"><foreignObject x="-48" y="-14" ' +
                'width="96" height="28"><div xmlns="http://www.w3.org/1999/xhtml">' +
                '<span class="nodeLabel"><p>&nbsp;&nbsp;Inicio&nbsp;&nbsp;</p></span>' +
                '</div></foreignObject></g></g>' +
                '<g class="edgeLabel" transform="translate(200,100)">' +
                '<foreignObject x="-12" y="-10" width="24" height="20">' +
                '<div xmlns="http://www.w3.org/1999/xhtml"><span>Sí</span></div>' +
                '</foreignObject></g></svg>',
            getBBox() {
                return {
                    x: 0,
                    y: 0,
                    width: 320,
                    height: 180
                };
            }
        },
        presentation: {
            fontFamily: '"JetBrains Mono"',
            fontSize: "16px"
        }
    });

    const svg = await exportSvg({
        mermaidApi: {
            async render() {
                renders += 1;
                return { svg: "" };
            }
        }
    });

    assert.equal(renders, 0);
    assert.match(
        svg,
        /<rect x="-48" y="-18" width="96" height="36"/u
    );
    assert.match(
        svg,
        /<text class="clrs-export-label"[^>]*>.*Inicio.*<\/text>/u
    );
    assert.match(
        svg,
        /\.edgeLabel \.clrs-export-label-background/u
    );
    assert.match(
        svg,
        /class="clrs-export-label-background"[^>]*rx="10"[^>]*ry="10"/u
    );
    assert.match(
        svg,
        /fill-opacity:1;stroke:none/u
    );
    assert.match(
        svg,
        /font-family:"JetBrains Mono",Consolas,"Courier New",monospace/u
    );
    assert.match(
        svg,
        /font-weight:400;stroke:none;stroke-width:0;paint-order:normal/u
    );
    assert.doesNotMatch(svg, /foreignObject/iu);
    assert.doesNotMatch(svg, /xhtml/iu);
});

test("deriva el viewBox real antes de que el zoom transforme el SVG", () => {
    const captured = capturePreviewSvg({
        outerHTML:
            '<svg width="100%" style="width:100%;height:100%">' +
            '<g transform="translate(20,30)"><rect width="200" height="100" /></g>' +
            "</svg>",
        getBBox() {
            return {
                x: 20,
                y: 30,
                width: 200,
                height: 100
            };
        }
    });

    assert.match(
        captured,
        /viewBox="12 22 216 116"/u
    );
    assert.doesNotMatch(
        captured,
        /svg-pan-zoom_viewport/u
    );
});

test("convierte etiquetas de varias líneas sin recalcular las figuras", () => {
    const source =
        '<svg viewBox="0 0 200 100">' +
        '<g class="node node-process"><rect width="120" height="36" />' +
        '<foreignObject x="0" y="0" width="120" height="36">' +
        '<div><p>Línea uno</p><p>Línea dos</p></div>' +
        '</foreignObject></g></svg>';
    const converted = convertHtmlLabelsToSvgText(
        source,
        {
            theme: createVSCodeTheme()
        },
        {
            fontSize: "16px"
        }
    );

    assert.match(
        converted,
        /<rect width="120" height="36"/u
    );
    assert.match(
        converted,
        /<tspan[^>]*>Línea uno<\/tspan><tspan[^>]*>Línea dos<\/tspan>/u
    );
    assert.doesNotMatch(
        converted,
        /foreignObject/iu
    );
});

test("el exportador rechaza SVG dependiente de HTML", () => {
    assert.throws(
        () => createStandaloneSvg(
            '<svg viewBox="0 0 10 10">' +
            "<foreignObject>" +
            '<div xmlns="http://www.w3.org/1999/xhtml">' +
            "texto</div></foreignObject></svg>"
        ),
        /browser-only HTML labels/
    );
});
