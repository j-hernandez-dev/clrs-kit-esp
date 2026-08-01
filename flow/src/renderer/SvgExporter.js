import mermaid from "mermaid";

import {
    initializeMermaid
} from "./MermaidInitializer.js";

let exportSource = null;

/**
 * Conserva la fuente lógica del diagrama. La exportación vuelve a
 * renderizarla con etiquetas SVG nativas para no incluir HTML.
 */
export function setExportSource(source) {

    exportSource =
        source?.diagram
            ? {
                diagram: source.diagram,
                themeConfig:
                    source.themeConfig ?? null
            }
            : null;

}

/**
 * Genera un SVG autónomo, apto para visores de imágenes.
 */
export async function exportSvg(options = {}) {

    if (!exportSource) {
        throw new Error(
            "No rendered diagram is available for SVG export."
        );
    }

    const mermaidApi =
        options.mermaidApi ?? mermaid;
    const initialize =
        options.initialize ??
        initializeMermaid;
    const {
        diagram,
        themeConfig
    } = exportSource;

    try {
        initialize(themeConfig, {
            htmlLabels: false
        });

        const id =
            `diagram-export-${createId()}`;
        const { svg } =
            await mermaidApi.render(
                id,
                diagram
            );

        return createStandaloneSvg(svg, {
            background:
                getCanvasBackground(
                    themeConfig
                )
        });
    } finally {
        // Mermaid es un singleton. Restauramos la configuración usada
        // por la vista previa después de la exportación.
        initialize(themeConfig, {
            htmlLabels: true
        });
    }

}

/**
 * Completa dimensiones, namespace y fondo sin introducir elementos HTML.
 */
export function createStandaloneSvg(
    source,
    options = {}
) {

    const svg = String(source ?? "").trim();

    if (!/^<svg\b/i.test(svg)) {
        throw new Error(
            "Mermaid did not produce a valid SVG document."
        );
    }

    if (
        /<foreignObject\b/i.test(svg) ||
        /xmlns=["']http:\/\/www\.w3\.org\/1999\/xhtml["']/i
            .test(svg)
    ) {
        throw new Error(
            "SVG export contains browser-only HTML labels."
        );
    }

    const openingTag =
        svg.match(/^<svg\b[^>]*>/i)?.[0];
    const viewBox =
        openingTag?.match(
            /\bviewBox=["']([^"']+)["']/i
        )?.[1];

    if (!openingTag || !viewBox) {
        throw new Error(
            "SVG export is missing its viewBox."
        );
    }

    const dimensions =
        parseViewBox(viewBox);
    let standaloneTag =
        openingTag
            .replace(
                /\sstyle=["'][^"']*["']/i,
                ""
            )
            .replace(
                /\swidth=["'][^"']*["']/i,
                ""
            )
            .replace(
                /\sheight=["'][^"']*["']/i,
                ""
            );

    if (!/\sxmlns=/.test(standaloneTag)) {
        standaloneTag =
            standaloneTag.replace(
                /<svg\b/i,
                '<svg xmlns="http://www.w3.org/2000/svg"'
            );
    }

    standaloneTag =
        standaloneTag.replace(
            />$/,
            ` width="${dimensions.width}"` +
            ` height="${dimensions.height}"` +
            ' version="1.1">'
        );

    const background =
        escapeXmlAttribute(
            options.background ?? "#FFFFFF"
        );
    const backgroundRect =
        `<rect x="${dimensions.x}" ` +
        `y="${dimensions.y}" ` +
        `width="${dimensions.width}" ` +
        `height="${dimensions.height}" ` +
        `fill="${background}"/>`;
    const content =
        normalizeSvgTextEntities(
            svg.slice(openingTag.length)
        );

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        standaloneTag +
        backgroundRect +
        content
    );

}

/**
 * Mermaid deja algunas entidades de etiquetas HTML codificadas una
 * segunda vez cuando cambia a texto SVG nativo. Las normalizamos a
 * entidades XML válidas para que el visor muestre el carácter real.
 */
export function normalizeSvgTextEntities(
    content
) {

    return String(content)
        .replace(
            /&amp;(quot|apos);/gi,
            "&$1;"
        )
        .replace(
            /&amp;#(x[0-9a-f]+|\d+);/gi,
            "&#$1;"
        );

}

function parseViewBox(viewBox) {

    const values =
        viewBox
            .trim()
            .split(/[\s,]+/)
            .map(Number);

    if (
        values.length !== 4 ||
        values.some(value =>
            !Number.isFinite(value)
        ) ||
        values[2] <= 0 ||
        values[3] <= 0
    ) {
        throw new Error(
            "SVG export has an invalid viewBox."
        );
    }

    return {
        x: values[0],
        y: values[1],
        width: values[2],
        height: values[3]
    };

}

function getCanvasBackground(themeConfig) {

    return (
        themeConfig?.theme
            ?.canvas?.background ??
        "#FFFFFF"
    );

}

function escapeXmlAttribute(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

}

function createId() {

    return (
        globalThis.crypto
            ?.randomUUID?.() ??
        `${Date.now()}-${Math.random()
            .toString(16)
            .slice(2)}`
    );

}
