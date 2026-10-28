/** Integración cooperativa por APIs públicas: Node conserva I/O, timers y promesas. */
export function createGuiEventLoop(GLib, onError, afterTick = () => {}) {
    const context = GLib.MainContext.default();
    let stopped = false;
    let timer;
    const tick = () => {
        if (stopped) { return; }
        try {
            const deadline = Date.now() + 4;
            // Nunca bloquear Node ni drenar ilimitadamente una fuente GTK muy activa.
            for (let i = 0; i < 32 && Date.now() <= deadline && !stopped; i++) {
                if (!context.iteration(false)) { break; }
            }
            if (!stopped) { afterTick(); }
        } catch (error) { stopped = true; onError(error); }
        if (!stopped) { timer = setTimeout(tick, 10); }
    };
    timer = setTimeout(tick, 0);
    return () => { stopped = true; clearTimeout(timer); };
}
