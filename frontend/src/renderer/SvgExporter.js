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
                    source.themeConfig ?? null,
                connectionStyle:
                    source.connectionStyle ??
                    null,
                direction:
                    source.direction ?? null,
                // La instantánea se toma antes de que svg-pan-zoom añada su
                // viewport. Así conserva exactamente el layout que Mermaid
                // calculó para el editor, sin exportar el paneo, el zoom ni
                // las capas interactivas del diagramador.
                previewSvg:
                    capturePreviewSvg(
                        source.svgElement
                    ),
                presentation: {
                    fontFamily:
                        source.presentation
                            ?.fontFamily ?? null,
                    fontSize:
                        source.presentation
                            ?.fontSize ?? null
                }
            }
            : null;

}

/**
 * Captura el SVG antes de inicializar svg-pan-zoom. Mermaid puede omitir el
 * viewBox en el elemento insertado en el DOM porque el visor interactivo
 * calcula sus límites por su cuenta. Un archivo autónomo sí lo necesita, de
 * modo que lo derivamos del bbox real sin modificar el SVG visible.
 */
export function capturePreviewSvg(
    svgElement,
    margin = 8
) {

    const source =
        svgElement?.outerHTML ?? null;

    if (!source) {
        return null;
    }

    const openingTag =
        source.match(/^<svg\b[^>]*>/i)?.[0];

    if (
        !openingTag ||
        /\bviewBox=["'][^"']+["']/i
            .test(openingTag)
    ) {
        return source;
    }

    const bounds = readSvgBounds(
        svgElement
    );

    if (!bounds) {
        return source;
    }

    const safeMargin =
        Number.isFinite(margin) &&
        margin >= 0
            ? margin
            : 8;
    const viewBox = [
        bounds.x - safeMargin,
        bounds.y - safeMargin,
        bounds.width + safeMargin * 2,
        bounds.height + safeMargin * 2
    ]
        .map(formatNumber)
        .join(" ");
    const standaloneOpeningTag =
        openingTag.replace(
            />$/,
            ` viewBox="${viewBox}">`
        );

    return (
        standaloneOpeningTag +
        source.slice(openingTag.length)
    );

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
        themeConfig,
        connectionStyle,
        direction,
        previewSvg,
        presentation
    } = exportSource;

    // El SVG mostrado en el editor ya contiene la geometría correcta para
    // etiquetas, figuras y conectores. La reutilizamos y sustituimos sus
    // foreignObject por texto SVG nativo para obtener un archivo autónomo.
    if (previewSvg) {
        return createStandaloneSvg(
            convertHtmlLabelsToSvgText(
                previewSvg,
                themeConfig,
                presentation
            )
        );
    }

    try {
        initialize(themeConfig, {
            htmlLabels: false,
            connectionStyle,
            direction
        });

        const id =
            `diagram-export-${createId()}`;
        const { svg } =
            await mermaidApi.render(
                id,
                diagram
            );

        return createStandaloneSvg(svg);
    } finally {
        // Mermaid es un singleton. Restauramos la configuración usada
        // por la vista previa después de la exportación.
        initialize(themeConfig, {
            htmlLabels: true,
            connectionStyle,
            direction
        });
    }

}

/**
 * Convierte las etiquetas HTML del SVG de vista previa a primitivas SVG.
 * No vuelve a ejecutar el layout: las coordenadas y dimensiones del
 * foreignObject se reutilizan para conservar la apariencia del editor.
 */
export function convertHtmlLabelsToSvgText(
    source,
    themeConfig,
    presentation = {}
) {

    const svg = String(source ?? "");
    const foreignObjects =
        [...svg.matchAll(
            /<foreignObject\b([^>]*)>([\s\S]*?)<\/foreignObject>/gi
        )];

    if (foreignObjects.length === 0) {
        return svg;
    }

    const fontSize =
        normalizeFontSize(
            presentation?.fontSize
        );
    const lineHeight = fontSize * 1.2;
    let converted = svg.replace(
        /<foreignObject\b([^>]*)>([\s\S]*?)<\/foreignObject>/gi,
        (_foreignObject, attributes, html) => {
            const x = readNumericAttribute(
                attributes,
                "x",
                0
            );
            const y = readNumericAttribute(
                attributes,
                "y",
                0
            );
            const width = readNumericAttribute(
                attributes,
                "width",
                0
            );
            const height = readNumericAttribute(
                attributes,
                "height",
                fontSize
            );
            const capsuleRadius =
                Math.max(0, height / 2);
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            const lines = extractHtmlLabelLines(
                html
            );
            const firstY =
                centerY -
                ((lines.length - 1) *
                    lineHeight) / 2;
            const tspans = lines
                .map((line, index) =>
                    `<tspan x="${formatNumber(centerX)}" ` +
                    `y="${formatNumber(
                        firstY +
                        index * lineHeight
                    )}">${line}</tspan>`
                )
                .join("");

            return (
                '<g class="clrs-export-native-label">' +
                '<rect class="clrs-export-label-background" ' +
                `x="${formatNumber(x)}" ` +
                `y="${formatNumber(y)}" ` +
                `width="${formatNumber(width)}" ` +
                `height="${formatNumber(height)}" ` +
                `rx="${formatNumber(capsuleRadius)}" ` +
                `ry="${formatNumber(capsuleRadius)}" />` +
                '<text class="clrs-export-label" ' +
                `x="${formatNumber(centerX)}" ` +
                `y="${formatNumber(centerY)}" ` +
                'text-anchor="middle" ' +
                'dominant-baseline="middle">' +
                tspans +
                "</text></g>"
            );
        }
    );

    const styles = createExportLabelStyles(
        themeConfig,
        presentation,
        fontSize
    );

    converted = converted.replace(
        /<\/svg>\s*$/i,
        `${styles}</svg>`
    );

    return converted;

}

/**
 * Completa dimensiones y namespace sin introducir elementos HTML.
 * El lienzo permanece transparente; los fondos propios de los
 * subgrafos continúan siendo parte del contenido generado por Mermaid.
 */
export function createStandaloneSvg(
    source
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

    const content =
        normalizeSvgTextEntities(
            svg.slice(openingTag.length)
        );

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        standaloneTag +
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
            /&nbsp;/gi,
            "&#160;"
        )
        .replace(
            /&amp;(quot|apos);/gi,
            "&$1;"
        )
        .replace(
            /&amp;#(x[0-9a-f]+|\d+);/gi,
            "&#$1;"
        );

}

function createExportLabelStyles(
    themeConfig,
    presentation,
    fontSize
) {

    const theme =
        themeConfig?.theme ??
        themeConfig ?? {};
    const fontFamily =
        normalizeFontFamily(
            presentation?.fontFamily
        );
    const edgeText = safeColor(
        theme?.arrow?.color,
        "#D4D4D4"
    );
    const edgeBackground = safeColor(
        theme?.subgraph?.fill ??
            theme?.arrow?.colorLabel ??
            theme?.canvas?.background,
        "#1E1E1E"
    );
    const subgraphText = safeColor(
        theme?.subgraph?.text,
        edgeText
    );
    const nodeRules = [
        ["merge", theme?.nodes?.merge?.text],
        ["process", theme?.nodes?.process?.text],
        ["call", theme?.nodes?.call?.text],
        ["start", theme?.nodes?.start?.text],
        ["return", theme?.nodes?.return?.text],
        ["decision", theme?.nodes?.decision?.text],
        ["preparation", theme?.nodes?.preparation?.text],
        ["read", theme?.nodes?.read?.text],
        ["write", theme?.nodes?.write?.text]
    ]
        .map(([type, color]) =>
            `.node-${type} .clrs-export-label{` +
            `fill:${safeColor(color, edgeText)}}`
        )
        .join("");

    return (
        "<style>" +
        ".clrs-export-label{" +
        `font-family:${fontFamily};` +
        `font-size:${formatNumber(fontSize)}px;` +
        // Las clases Mermaid de figura aplican también su stroke al grupo
        // de etiqueta. El texto SVG nativo debe neutralizar explícitamente
        // esa herencia; de otro modo cada glifo se dibuja con un contorno de
        // 2 px y parece una tipografía distinta o dañada.
        "font-weight:400;stroke:none;" +
        "stroke-width:0;paint-order:normal;fill:" +
        `${edgeText};}` +
        ".clrs-export-label-background{" +
        "display:none;stroke:none;}" +
        ".edgeLabel .clrs-export-label-background{" +
        `display:inline;fill:${edgeBackground};` +
        "fill-opacity:1;stroke:none;}" +
        ".edgeLabel .clrs-export-label{" +
        `fill:${edgeText};}` +
        ".cluster-label .clrs-export-label{" +
        `fill:${subgraphText};}` +
        nodeRules +
        "</style>"
    );

}

function readSvgBounds(svgElement) {

    try {
        const bounds =
            svgElement.getBBox?.();

        if (
            bounds &&
            Number.isFinite(bounds.x) &&
            Number.isFinite(bounds.y) &&
            Number.isFinite(bounds.width) &&
            Number.isFinite(bounds.height) &&
            bounds.width > 0 &&
            bounds.height > 0
        ) {
            return bounds;
        }
    } catch {
        // Un SVG todavía desconectado puede no implementar getBBox. El
        // fallback conserva la fuente para que la ruta histórica de Mermaid
        // pueda informar un error estructurado en vez de inventar medidas.
    }

    return null;

}

function extractHtmlLabelLines(html) {

    const withBreaks = String(html)
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<\/p\s*>/gi, "\n")
        .replace(/<\/div\s*>/gi, "\n")
        .replace(/<\/li\s*>/gi, "\n")
        .replace(/<[^>]+>/g, "");
    const lines = withBreaks
        .split(/\r?\n/)
        .map(line =>
            line
                .replace(
                    /^(?:(?:&nbsp;|&#160;)|\s)+|(?:(?:&nbsp;|&#160;)|\s)+$/gi,
                    ""
                )
        )
        .filter(Boolean);

    return lines.length > 0
        ? lines
        : [""];

}

function readNumericAttribute(
    attributes,
    name,
    fallback
) {

    const escapedName =
        name.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
    const match = String(attributes).match(
        new RegExp(
            `\\b${escapedName}=["']([^"']+)["']`,
            "i"
        )
    );
    const value = Number.parseFloat(
        match?.[1]
    );

    return Number.isFinite(value)
        ? value
        : fallback;

}

function normalizeFontSize(value) {

    const size = Number.parseFloat(value);

    return Number.isFinite(size) &&
        size >= 8 &&
        size <= 72
        ? size
        : 16;

}

function normalizeFontFamily(value) {

    const family = String(value ?? "")
        .replace(/[{};<>]/g, "")
        .trim();
    const portableFallback =
        'Consolas,"Courier New",monospace';

    // La fuente calculada dentro del Webview puede existir únicamente en
    // Chromium o en la configuración del editor. Un visor SVG externo no
    // necesariamente la conoce y algunos sustituyen una familia ausente por
    // una tipografía decorativa ilegible. Conservamos la preferencia del
    // editor, pero siempre serializamos alternativas monoespaciadas comunes
    // y, finalmente, la familia genérica estándar.
    return family
        ? `${family},${portableFallback}`
        : portableFallback;

}

function safeColor(value, fallback) {

    const color = String(value ?? "").trim();

    return /^(?:#[\da-f]{3,8}|rgba?\([\d\s.,%]+\))$/i
        .test(color)
        ? color
        : fallback;

}

function formatNumber(value) {

    return Number(value.toFixed(3))
        .toString();

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

function createId() {

    return (
        globalThis.crypto
            ?.randomUUID?.() ??
        `${Date.now()}-${Math.random()
            .toString(16)
            .slice(2)}`
    );

}
