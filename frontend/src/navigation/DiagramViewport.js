export class DiagramViewportController {

    constructor(panZoom, svgElement) {
        this.panZoom = panZoom;
        this.svgElement = svgElement;
        this.listeners = new Set();
        this.disposed = false;
    }

    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getSnapshot());

        return () => {
            this.listeners.delete(listener);
        };
    }

    notify() {
        if (this.disposed) {
            return;
        }

        const snapshot = this.getSnapshot();

        for (const listener of this.listeners) {
            listener(snapshot);
        }
    }

    getSnapshot() {
        const sizes =
            this.panZoom.getSizes();

        return {
            pan: this.panZoom.getPan(),
            zoom: this.panZoom.getZoom(),
            sizes: {
                width: sizes.width,
                height: sizes.height,
                realZoom: sizes.realZoom,
                viewBox: {
                    ...sizes.viewBox
                }
            }
        };
    }

    fitAll() {
        this.panZoom.resize();
        this.panZoom.fit();
        this.panZoom.center();
        this.notify();
    }

    /**
     * Ajusta el flujo sin reducirlo por debajo de un tamaÃ±o legible.
     *
     * Los diagramas con varias funciones pueden ser mucho mÃ¡s anchos que
     * el Webview. `svg-pan-zoom.fit()` intenta mostrarlos completos y, en
     * esos casos, convierte cada nodo en una miniatura. El encuadre inicial
     * conserva la panorÃ¡mica cuando ya es legible y amplÃ­a el resultado
     * cuando el ajuste automÃ¡tico queda por debajo del umbral.
     */
    fitReadable(
        minimumRealZoom =
            DEFAULT_MINIMUM_READABLE_REAL_ZOOM
    ) {
        this.panZoom.resize();
        this.panZoom.fit();

        const sizes =
            this.panZoom.getSizes();
        const fittedRealZoom =
            Number(sizes.realZoom);
        const safeMinimumRealZoom =
            normalizeMinimumRealZoom(
                minimumRealZoom
            );

        if (
            Number.isFinite(fittedRealZoom) &&
            fittedRealZoom > 0 &&
            fittedRealZoom <
                safeMinimumRealZoom
        ) {
            const currentZoom =
                Number(
                    this.panZoom.getZoom()
                );

            if (
                Number.isFinite(currentZoom) &&
                currentZoom > 0
            ) {
                this.panZoom.zoom(
                    clamp(
                        currentZoom *
                            safeMinimumRealZoom /
                            fittedRealZoom,
                        MINIMUM_ZOOM,
                        MAXIMUM_ZOOM
                    )
                );
            }
        }

        this.panZoom.center();
        this.notify();
    }

    centerNode(element) {
        return this.focusNode(
            element,
            { resize: false }
        );
    }

    focusNode(
        element,
        options = {}
    ) {
        if (!element) {
            return false;
        }

        // VS Code puede redimensionar el Webview sin que svg-pan-zoom haya
        // actualizado todavía el tamaño de su viewport. Sin esta
        // sincronización, el centro se calcula con dimensiones antiguas y el
        // usuario sólo obtiene el resultado correcto después de `fitAll()`.
        this.panZoom.resize();

        const sizes =
            this.panZoom.getSizes();
        const box = getElementDiagramBox(
            element,
            this.svgElement,
            {
                pan: this.panZoom.getPan(),
                realZoom: sizes.realZoom
            }
        );

        if (!box) {
            return false;
        }

        if (options.resize !== false) {
            const padding =
                options.padding ?? 2.4;
            const desiredRealZoom =
                Math.min(
                    sizes.width /
                        Math.max(
                            1,
                            box.width * padding
                        ),
                    sizes.height /
                        Math.max(
                            1,
                            box.height * padding
                        )
                );
            const desiredZoom =
                clamp(
                    this.panZoom.getZoom() *
                    desiredRealZoom /
                    Math.max(
                        sizes.realZoom,
                        Number.EPSILON
                    ),
                    0.05,
                    24
                );

            this.panZoom.zoom(desiredZoom);
        }

        const nextSizes =
            this.panZoom.getSizes();
        const centerX =
            box.x + box.width / 2;
        const centerY =
            box.y + box.height / 2;

        this.panZoom.pan({
            x:
                nextSizes.width / 2 -
                centerX *
                    nextSizes.realZoom,
            y:
                nextSizes.height / 2 -
                centerY *
                    nextSizes.realZoom
        });
        this.notify();

        return true;
    }

    panToPoint(point) {
        const sizes =
            this.panZoom.getSizes();

        this.panZoom.pan({
            x:
                sizes.width / 2 -
                point.x * sizes.realZoom,
            y:
                sizes.height / 2 -
                point.y * sizes.realZoom
        });
        this.notify();
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.listeners.clear();
        this.panZoom.destroy?.();
    }
}

export function getVisibleDiagramRect(snapshot) {
    const {
        pan,
        sizes
    } = snapshot;
    const realZoom = Math.max(
        sizes.realZoom,
        Number.EPSILON
    );

    return {
        x: -pan.x / realZoom,
        y: -pan.y / realZoom,
        width: sizes.width / realZoom,
        height: sizes.height / realZoom
    };
}

function clamp(value, minimum, maximum) {
    return Math.min(
        maximum,
        Math.max(minimum, value)
    );
}

function normalizeMinimumRealZoom(value) {
    const number = Number(value);

    return Number.isFinite(number) &&
        number > 0
        ? number
        : DEFAULT_MINIMUM_READABLE_REAL_ZOOM;
}

export const DEFAULT_MINIMUM_READABLE_REAL_ZOOM =
    0.72;

const MINIMUM_ZOOM = 0.05;
const MAXIMUM_ZOOM = 24;

function getElementDiagramBox(
    element,
    svgElement,
    viewport
) {
    const elementRect =
        element.getBoundingClientRect?.();
    const svgRect =
        svgElement?.getBoundingClientRect?.();
    const realZoom = Math.max(
        viewport.realZoom,
        Number.EPSILON
    );

    if (
        isValidRect(elementRect) &&
        isValidRect(svgRect)
    ) {
        return {
            x:
                (elementRect.left -
                    svgRect.left -
                    viewport.pan.x) /
                realZoom,
            y:
                (elementRect.top -
                    svgRect.top -
                    viewport.pan.y) /
                realZoom,
            width:
                elementRect.width /
                realZoom,
            height:
                elementRect.height /
                realZoom
        };
    }

    if (
        typeof element.getBBox ===
            "function"
    ) {
        const box = element.getBBox();

        return isValidRect(box)
            ? box
            : null;
    }

    return null;
}

function isValidRect(rect) {
    return Boolean(
        rect &&
        Number.isFinite(rect.x ?? rect.left) &&
        Number.isFinite(rect.y ?? rect.top) &&
        Number.isFinite(rect.width) &&
        Number.isFinite(rect.height)
    );
}
