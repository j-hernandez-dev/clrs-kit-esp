import mermaid from "mermaid";
import svgPanZoom from "svg-pan-zoom";
import {
    setExportSource
} from "./SvgExporter.js";

/**
 * Renderiza un diagrama Mermaid.
 */
export async function renderMermaid({

    container,

    diagram,

    themeConfig

}) {

    if (!container || !diagram) {

        return;

    }

    container.replaceChildren();

    const id = `diagram-${crypto.randomUUID()}`;

    try {

        await startRender(container);

        const svgElement =
            await renderSvg({

                container,

                id,

                diagram

            });

        if (svgElement) {

            styleSvg(svgElement);

            initializePanZoom(svgElement);

            setExportSource({
                diagram,
                themeConfig
            });

        }

        finishRender(container);

    }

    catch (error) {

        console.error(

            "Error rendering Mermaid diagram:",

            error

        );

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
 * Aplica estilos al SVG generado.
 */
function styleSvg(svgElement) {

    svgElement.style.width = "100%";

    svgElement.style.height = "100%";

    svgElement

        .querySelectorAll(".edgePath path, .flowchart-link")

        .forEach(path => {

            path.style.strokeWidth = "2px";

        });

}


/**
 * Inicializa svg-pan-zoom.
 */
function initializePanZoom(svgElement) {

    const panZoom = svgPanZoom(

        svgElement,

        {

            zoomEnabled: true,

            panEnabled: true,

            controlIconsEnabled: false,

            fit: true,

            center: true,

            mouseWheelZoomEnabled: true

        }

    );

    setTimeout(() => {

        panZoom.resize();

        panZoom.fit();

        panZoom.center();

    }, 50);

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
