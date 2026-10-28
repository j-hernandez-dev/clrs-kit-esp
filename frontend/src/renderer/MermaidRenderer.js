import mermaid from "mermaid";
import svgPanZoom from "svg-pan-zoom";
import {
    setExportSource
} from "./SvgExporter.js";
import {
    DiagramViewportController
} from "../navigation/DiagramViewport.js";
import {
    styleDiagramSvg
} from "./DiagramSvgStyler.js";
import {
    initializeMermaid
} from "./MermaidInitializer.js";

/**
 * Renderiza un diagrama Mermaid.
 */
export async function renderMermaid({

    container,

    diagram,

    themeConfig,

    connectionStyle,

    direction

}) {

    if (!container || !diagram) {

        return null;

    }

    container.replaceChildren();

    const id = `diagram-${crypto.randomUUID()}`;

    try {

        await startRender(container);

        // Mermaid conserva su configuraciÃ³n en un singleton. Inicializar
        // aquÃ­, inmediatamente antes de renderizar, evita que un cambio de
        // tema deje subgrafos y conectores con la configuraciÃ³n anterior.
        initializeMermaid(
            themeConfig,
            {
                connectionStyle,
                direction
            }
        );

        const svgElement =
            await renderSvg({

                container,

                id,

                diagram

            });

        if (!svgElement) {
            finishRender(container);
            return null;
        }

        styleDiagramSvg(
            svgElement,
            themeConfig
        );

        const viewport =
            initializePanZoom(svgElement);

        setExportSource({
            diagram,
            themeConfig,
            connectionStyle,
            direction,
            svgElement,
            presentation:
                readDiagramPresentation(
                    svgElement
                )
        });

        finishRender(container);

        return {
            svgElement,
            viewport
        };

    }

    catch (error) {

        console.error(

            "Error rendering Mermaid diagram:",

            error

        );

        finishRender(container);

        return null;

    }

}


/**
 * Inicia la animación de render.
 */
async function startRender(container) {

    container.classList.add("rendering");

    const fonts =
        container.ownerDocument
            ?.fonts;

    if (fonts?.ready) {
        await fonts.ready;
    }

    await new Promise(resolve =>

        setTimeout(resolve, 300)

    );

}

/**
 * Genera el SVG Mermaid.
 */
async function renderSvg({
    container,
    id,
    diagram
}) {

    const { svg } = await mermaid.render(id, diagram);

    container.innerHTML = svg;

    const svgElement = container.querySelector("svg");

    return svgElement;
}


/**
 * Inicializa svg-pan-zoom.
 */
function initializePanZoom(svgElement) {

    let viewport = null;

    const panZoom = svgPanZoom(

        svgElement,

        {

            zoomEnabled: true,

            panEnabled: true,

            controlIconsEnabled: false,

            fit: true,

            center: true,

            mouseWheelZoomEnabled: true,

            minZoom: 0.05,

            maxZoom: 24,

            onPan() {
                viewport?.notify();
            },

            onZoom() {
                viewport?.notify();
            }

        }

    );

    viewport =
        new DiagramViewportController(
            panZoom,
            svgElement
        );

    setTimeout(() => {

        if (!viewport.disposed) {
            viewport.fitReadable();
        }

    }, 50);

    return viewport;

}

function readDiagramPresentation(
    svgElement
) {

    const document =
        svgElement?.ownerDocument;
    const view =
        document?.defaultView;
    const label =
        svgElement?.querySelector(
            ".nodeLabel"
        );
    const labelStyle =
        label && view
            ? view.getComputedStyle(label)
            : null;
    const svgStyle =
        view
            ? view.getComputedStyle(
                svgElement
            )
            : null;

    return {
        fontFamily:
            labelStyle?.fontFamily ||
            svgStyle?.fontFamily ||
            null,
        fontSize:
            labelStyle?.fontSize ||
            svgStyle?.fontSize ||
            null
    };

}


/**
 * Finaliza la animación de render.
 */
function finishRender(container) {

    const requestFrame =
        container.ownerDocument
            ?.defaultView
            ?.requestAnimationFrame
            ?.bind(
                container.ownerDocument
                    .defaultView
            ) ??
        (callback =>
            setTimeout(callback, 0));

    requestFrame(() => {

        container.classList.remove("rendering");

    });

}

export {
    exportSvg
} from "./SvgExporter.js";
