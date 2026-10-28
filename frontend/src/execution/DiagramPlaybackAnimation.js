import { findEdgeElement, findNodeElement } from "../interaction/DiagramDomInteraction.js";

export const DIAGRAM_PLAYBACK_DURATIONS = Object.freeze({
    900: 650,
    500: 450,
    250: 250
});
export const DIAGRAM_PLAYBACK_ARRIVAL_MS = 100;

export function getDiagramPlaybackDuration(speed) {
    return DIAGRAM_PLAYBACK_DURATIONS[speed] ??
        DIAGRAM_PLAYBACK_DURATIONS[500];
}

/** Animaciones de presentación: nunca bloquean ni reprograman la traza. */
export function createDiagramPlaybackAnimation(svgElement) {
    const pending = new Set();
    const reducedMotion = () => svgElement?.ownerDocument?.defaultView
        ?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    function track(animation, cleanup = () => {}) {
        const cancel = () => { animation.cancel(); cleanup(); pending.delete(cancel); };
        pending.add(cancel);
        return animation.finished.then(() => {
            pending.delete(cancel); cleanup(); return true;
        }, () => { pending.delete(cancel); cleanup(); return false; });
    }
    return {
        async play(edges, targetId, totalDuration = DIAGRAM_PLAYBACK_DURATIONS[500]) {
            // Un nuevo avance sustituye por completo la presentación del
            // anterior. Así, varios clics rápidos no dejan pulsos o destellos
            // pertenecientes a un prefijo que ya no es el activo.
            for (const cancel of [...pending]) { cancel(); }
            if (reducedMotion()) { return; }
            const paths = edges.map(edge => findEdgeElement(svgElement, edge.identity?.modelId));
            if (paths.some(path => !path?.animate || !path?.getTotalLength)) { return; }
            if (paths.length > 0) {
                const lengths = paths.map(path => path.getTotalLength());
                const total = lengths.reduce((sum, length) => sum + length, 0);
                if (!Number.isFinite(total) || total <= 0) { return; }
                // Todos los segmentos se programan juntos. Cancelar durante
                // una espera o un cambio de traza también cancela los aún no
                // iniciados.
                const pulseDuration = Math.max(1, totalDuration - DIAGRAM_PLAYBACK_ARRIVAL_MS);
                let delay = 0;
                const completions = paths.map((path, index) => {
                    const pulse = path.cloneNode(false), length = lengths[index];
                    for (const attribute of [...pulse.attributes]) {
                        if (!["d", "transform"].includes(attribute.name)) { pulse.removeAttribute(attribute.name); }
                    }
                    pulse.setAttribute("class", "clrs-diagram-playback-pulse");
                    pulse.setAttribute("data-clrs-transient", "true");
                    pulse.setAttribute("aria-hidden", "true");
                    const dash = Math.max(1, length * 0.15);
                    pulse.style.strokeDasharray = `${dash} ${length + dash}`;
                    pulse.style.opacity = "0";
                    path.parentNode.appendChild(pulse);
                    const duration = pulseDuration * length / total;
                    const animation = pulse.animate([
                        { strokeDashoffset: String(dash), opacity: 0 },
                        { opacity: 1, offset: 0.12 },
                        { opacity: 1, offset: 0.88 },
                        { strokeDashoffset: String(-length), opacity: 0 }
                    ], { duration, delay, easing: "linear" });
                    delay += duration;
                    return track(animation, () => pulse.remove());
                });
                if (!(await Promise.all(completions)).every(Boolean)) { return; }
            }

            // Los saltos entre ámbitos pertenecen a la secuencia visual pero
            // deliberadamente no inventan una flecha Mermaid. Aun sin aristas,
            // el destino recibe el mismo destello inequívoco de llegada.
            const target = findNodeElement(svgElement, targetId);
            const view = svgElement.ownerDocument?.defaultView;
            const color = view?.getComputedStyle?.(svgElement)
                .getPropertyValue("--vscode-testing-iconPassed").trim() || "#73c991";
            const arrivals = [];
            for (const shape of target?.querySelectorAll?.(
                ":scope > :is(rect, polygon, path, circle, ellipse), :scope > g:not(.label) > :is(rect, polygon, path, circle, ellipse)"
            ) ?? []) {
                if (!shape.animate) { continue; }
                const filter = view?.getComputedStyle?.(shape).filter || "none";
                arrivals.push(track(shape.animate([
                    { filter }, { filter: `drop-shadow(0 0 10px ${color})`, offset: 0.3 }, { filter }
                ], { duration: DIAGRAM_PLAYBACK_ARRIVAL_MS, easing: "ease-out" })));
            }
            await Promise.all(arrivals);
        },
        cancel() { for (const cancel of [...pending]) { cancel(); } }
    };
}
