import mermaid from "mermaid";
import svgPanZoom from "svg-pan-zoom";
import { toPng } from "html-to-image";

/**
 * Renderiza un diagrama Mermaid.
 */
export async function renderMermaid({

    container,

    diagram

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

    await new Promise(resolve =>

        setTimeout(resolve, 300)

    );

}

let currentSvg = "";

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

    currentSvg = svgElement;

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

    requestAnimationFrame(() => {

        container.classList.remove("rendering");

    });

}


export async function exportPng() {

    if (!currentSvg) {

        throw new Error(
            "No diagram rendered."
        );

    }

    const dataUrl = await toPng(currentSvg, {

        pixelRatio: 5

    });

    return dataUrl;
}