import test from "node:test";
import assert from "node:assert/strict";

import {
    createStandaloneSvg,
    exportSvg,
    normalizeSvgTextEntities,
    setExportSource
} from "../flow/src/renderer/SvgExporter.js";
import {
    createVSCodeTheme
} from "../flow/src/themes/presets/VSCodeTheme.js";

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
        }
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
    assert.match(
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
