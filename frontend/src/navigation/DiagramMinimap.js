import {
    getVisibleDiagramRect
} from "./DiagramViewport.js";

export function createDiagramMinimap({
    container,
    svgElement,
    viewport
}) {
    if (
        !container ||
        !svgElement ||
        !viewport
    ) {
        return null;
    }

    const ownerDocument =
        container.ownerDocument;
    const image =
        ownerDocument.createElement("img");
    const viewportIndicator =
        ownerDocument.createElement("div");
    let currentSnapshot =
        viewport.getSnapshot();

    container.replaceChildren();
    container.setAttribute(
        "aria-label",
        "Minimapa del diagrama"
    );
    container.setAttribute(
        "title",
        "Haz clic para desplazar el diagrama"
    );

    image.className = "diagram-minimap-image";
    image.alt = "";
    image.draggable = false;
    image.src = createSvgDataUrl(
        svgElement,
        currentSnapshot.sizes.viewBox
    );

    viewportIndicator.className =
        "diagram-minimap-viewport";
    viewportIndicator.setAttribute(
        "aria-hidden",
        "true"
    );

    container.append(
        image,
        viewportIndicator
    );

    const update = snapshot => {
        currentSnapshot = snapshot;

        const geometry =
            calculateMinimapGeometry(
                snapshot,
                container.clientWidth,
                container.clientHeight
            );

        Object.assign(
            viewportIndicator.style,
            {
                left: `${geometry.viewport.x}px`,
                top: `${geometry.viewport.y}px`,
                width:
                    `${geometry.viewport.width}px`,
                height:
                    `${geometry.viewport.height}px`
            }
        );
    };
    const unsubscribe =
        viewport.subscribe(update);
    const handleClick = event => {
        const bounds =
            container.getBoundingClientRect();
        const point =
            minimapPointToDiagram(
                currentSnapshot,
                bounds.width,
                bounds.height,
                event.clientX - bounds.left,
                event.clientY - bounds.top
            );

        viewport.panToPoint(point);
    };

    container.addEventListener(
        "click",
        handleClick
    );

    const ResizeObserverClass =
        ownerDocument.defaultView
            ?.ResizeObserver;
    const resizeObserver =
        ResizeObserverClass
            ? new ResizeObserverClass(
                () => update(currentSnapshot)
            )
            : null;

    resizeObserver?.observe(container);
    image.addEventListener(
        "load",
        () => update(currentSnapshot),
        { once: true }
    );
    update(currentSnapshot);

    return {
        dispose() {
            unsubscribe();
            resizeObserver?.disconnect();
            container.removeEventListener(
                "click",
                handleClick
            );
            container.replaceChildren();
        }
    };
}

export function calculateMinimapGeometry(
    snapshot,
    width,
    height
) {
    const viewBox =
        normalizeViewBox(
            snapshot.sizes.viewBox
        );
    const scale = Math.min(
        Math.max(0, width) / viewBox.width,
        Math.max(0, height) / viewBox.height
    );
    const safeScale =
        Number.isFinite(scale)
            ? scale
            : 0;
    const offsetX =
        (width - viewBox.width * safeScale) /
        2;
    const offsetY =
        (height - viewBox.height * safeScale) /
        2;
    const visible =
        getVisibleDiagramRect(snapshot);
    const left = clamp(
        visible.x,
        viewBox.x,
        viewBox.x + viewBox.width
    );
    const top = clamp(
        visible.y,
        viewBox.y,
        viewBox.y + viewBox.height
    );
    const right = clamp(
        visible.x + visible.width,
        viewBox.x,
        viewBox.x + viewBox.width
    );
    const bottom = clamp(
        visible.y + visible.height,
        viewBox.y,
        viewBox.y + viewBox.height
    );

    return {
        scale: safeScale,
        offsetX,
        offsetY,
        viewport: {
            x:
                offsetX +
                (left - viewBox.x) *
                    safeScale,
            y:
                offsetY +
                (top - viewBox.y) *
                    safeScale,
            width:
                Math.max(0, right - left) *
                safeScale,
            height:
                Math.max(0, bottom - top) *
                safeScale
        }
    };
}

export function minimapPointToDiagram(
    snapshot,
    width,
    height,
    x,
    y
) {
    const viewBox =
        normalizeViewBox(
            snapshot.sizes.viewBox
        );
    const geometry =
        calculateMinimapGeometry(
            snapshot,
            width,
            height
        );
    const scale = Math.max(
        geometry.scale,
        Number.EPSILON
    );

    return {
        x: clamp(
            viewBox.x +
                (x - geometry.offsetX) /
                    scale,
            viewBox.x,
            viewBox.x + viewBox.width
        ),
        y: clamp(
            viewBox.y +
                (y - geometry.offsetY) /
                    scale,
            viewBox.y,
            viewBox.y + viewBox.height
        )
    };
}

function createSvgDataUrl(
    svgElement,
    viewBox
) {
    const clone =
        svgElement.cloneNode(true);

    prepareMinimapSvgClone(
        clone,
        viewBox,
        svgElement
    );

    const Serializer =
        svgElement.ownerDocument
            ?.defaultView
            ?.XMLSerializer ??
        globalThis.XMLSerializer;
    const source =
        new Serializer()
            .serializeToString(clone);

    return (
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(source)
    );
}

export function prepareMinimapSvgClone(
    clone,
    viewBox = null,
    source = null
) {
    // La imagen SVG vive fuera del documento: no hereda sus variables CSS
    // (por ejemplo, los bordes de ejecución). Conservamos la apariencia
    // resuelta, sin reconstruir figuras ni tocar sus puntos/transformaciones.
    const view = source?.ownerDocument?.defaultView;
    if (view?.getComputedStyle) {
        const selector = "rect, polygon, path, circle, ellipse, line, polyline";
        const originals = source.querySelectorAll(selector);
        const copies = clone.querySelectorAll(selector);
        originals.forEach((element, index) => {
            const style = view.getComputedStyle(element);
            for (const property of [
                "fill", "fill-opacity", "fill-rule",
                "stroke", "stroke-width", "stroke-opacity",
                "stroke-dasharray", "stroke-dashoffset",
                "stroke-linecap", "stroke-linejoin", "stroke-miterlimit",
                "opacity", "visibility", "display", "paint-order",
                "vector-effect", "rx", "ry"
            ]) {
                copies[index].style.setProperty(
                    property,
                    style.getPropertyValue(property),
                    "important"
                );
            }
        });
    }

    const viewportGroup =
        clone.querySelector(
            ".svg-pan-zoom_viewport"
        );

    viewportGroup?.removeAttribute(
        "transform"
    );
    [
        "transform",
        "-webkit-transform",
        "-ms-transform"
    ].forEach(property =>
        viewportGroup?.style
            ?.removeProperty?.(property)
    );
    clone.removeAttribute("width");
    clone.removeAttribute("height");
    clone.removeAttribute("style");

    if (viewBox) {
        const normalizedViewBox =
            normalizeViewBox(viewBox);

        clone.setAttribute(
            "viewBox",
            [
                normalizedViewBox.x,
                normalizedViewBox.y,
                normalizedViewBox.width,
                normalizedViewBox.height
            ].join(" ")
        );
        clone.setAttribute(
            "width",
            String(normalizedViewBox.width)
        );
        clone.setAttribute(
            "height",
            String(normalizedViewBox.height)
        );
    }

    clone.setAttribute(
        "preserveAspectRatio",
        "xMidYMid meet"
    );
    clone.setAttribute("overflow", "hidden");

    clone.querySelectorAll(
        [
            "foreignObject",
            "text",
            ".node .label",
            ".edgeLabel",
            ".cluster-label",
            ".labelBkg",
            ".clrs-diagram-edge-hit-target",
            ".clrs-diagram-edge-hitbox",
            "[data-clrs-transient]"
        ].join(",")
    ).forEach(element => element.remove());

    return clone;
}

function normalizeViewBox(viewBox) {
    return {
        x: Number(viewBox?.x) || 0,
        y: Number(viewBox?.y) || 0,
        width: Math.max(
            Number(viewBox?.width) || 1,
            Number.EPSILON
        ),
        height: Math.max(
            Number(viewBox?.height) || 1,
            Number.EPSILON
        )
    };
}

function clamp(value, minimum, maximum) {
    return Math.min(
        maximum,
        Math.max(minimum, value)
    );
}
