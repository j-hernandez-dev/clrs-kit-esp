/** Traducción cerrada de señales GTK a valores CLRS; no expone objetos nativos. */
export function createGuiEventsAdapter({ Gtk, gi, connect, read, fail, dispatch, reportFailure, isGuiValueInDomain }) {
    const subscriptions = new Map();
    const dirty = new Set();
    let mutationDepth = 0;
    const copy = value => Array.isArray(value) ? value.map(copy) : value;
    const release = record => {
        let failure;
        for (const subscription of subscriptions.get(record) ?? []) {
            dirty.delete(subscription);
            try { subscription.stop(); } catch (error) { failure ??= error; }
        }
        subscriptions.delete(record);
        if (failure) { throw failure; }
    };
    return {
        begin() { mutationDepth++; },
        end() {
            if (--mutationDepth !== 0) { return; }
            for (const entry of [...dirty]) { dirty.delete(entry); entry.send(); }
        },
        connect(record, name, reference, descriptor) {
            const immediate = descriptor.returnPolicy === "synchronous-boolean";
            if (immediate && !reference.synchronous) { fail("CLRS_GUI_CALLBACK_REQUIRES_SYNC"); }
            const stops = [];
            let controller;
            let previous;
            const stateEvent = ["cambio", "alternado", "valor_cambiado", "seleccion_cambiada", "fecha_cambiada"].includes(name);
            let normalize = () => [];
            const subscription = {
                stop() {
                    let failure;
                    for (const stop of stops.splice(0)) { try { stop(); } catch (error) { failure ??= error; } }
                    if (controller) {
                        try { record.native.removeController(controller); } catch (error) { failure ??= error; }
                        controller = null;
                    }
                    if (failure) { throw failure; }
                },
                send(...nativeArgs) {
                    if (!record.live) { return immediate ? false : undefined; }
                    try {
                        const args = normalize(...nativeArgs).map(copy);
                        if (args.length !== descriptor.parameters.length - 1 || args.some((value, index) =>
                            !isGuiValueInDomain(value, descriptor.parameters[index + 1].domain))) {
                            fail("CLRS_GUI_NATIVE_OPERATION_FAILED");
                        }
                        if (stateEvent) {
                            const current = JSON.stringify(args);
                            if (current === previous) { return; }
                            previous = current;
                        }
                        const result = dispatch(reference, record, args, immediate);
                        return immediate ? result : undefined;
                    } catch (error) { reportFailure(error); return immediate ? true : undefined; }
                }
            };
            const changed = (...args) => {
                if (stateEvent && mutationDepth) { dirty.add(subscription); return; }
                return subscription.send(...args);
            };
            const wire = (object, signal, after = false) => { stops.push(connect(object, signal, changed, after)); };
            try {
                const kind = descriptor.backend.kind;
                if (kind === "event-controller-motion" || kind === "gesture-click" || kind === "event-controller-key") {
                    controller = kind === "event-controller-motion" ? new Gtk.EventControllerMotion()
                        : kind === "gesture-click" ? new Gtk.GestureClick() : new Gtk.EventControllerKey();
                    if (kind === "event-controller-key") {
                        const Gdk = gi.require("Gdk", "4.0");
                        const modifiers = ["shift", "lock", "control", "alt", "button1", "button2", "button3", "button4", "button5", "super", "hyper", "meta"];
                        normalize = (keyval, code, flags) => [Gdk.keyvalName(keyval) ?? null, code,
                            modifiers.filter(key => (flags & Gdk.ModifierType[key.toUpperCase() + "_MASK"]) !== 0)];
                    } else if (kind === "gesture-click") {
                        controller.setButton(0);
                        normalize = (count, x, y) => [count, x, y, controller.getCurrentButton()];
                    } else { normalize = name === "puntero_salio" ? () => [] : (x, y) => [x, y]; }
                    record.native.addController(controller);
                    wire(controller, descriptor.backend.members[0]);
                } else {
                    if (name === "cambio" || (["Entry", "PasswordEntry"].includes(record.type) && name === "activar")) {
                        normalize = () => [read(record, "texto")];
                    } else if (name === "alternado") { normalize = () => [read(record, "activo")]; }
                    else if (name === "valor_cambiado" || (record.type === "SpinButton" && name === "activar")) {
                        normalize = () => [read(record, "valor")];
                    } else if (name === "activar_enlace") { normalize = () => [read(record, "uri")]; }
                    else if (name === "fecha_cambiada") { normalize = () => [read(record, "fecha")]; }
                    else if (name === "seleccion_cambiada") {
                        normalize = () => record.type === "DropDown"
                            ? [read(record, "seleccion"), read(record, "valor")] : [read(record, "seleccion")];
                    } else if (name === "fila_activada") {
                        normalize = record.type === "ListBox" ? row => [row.getIndex()]
                            : index => [index, read(record, "datos")[index]];
                    } else if (name === "borde_alcanzado" || name === "borde_excedido") {
                        const positions = { izquierda: Gtk.PositionType.LEFT, derecha: Gtk.PositionType.RIGHT,
                            arriba: Gtk.PositionType.TOP, abajo: Gtk.PositionType.BOTTOM };
                        normalize = value => [Object.keys(positions).find(key => positions[key] === value)];
                    }
                    if (kind === "buffer-signal") { wire(record.native.getBuffer(), "changed"); }
                    else if (kind === "selection-model-signal") {
                        let stopSelection;
                        const attach = () => {
                            stopSelection?.();
                            const model = record.native.getModel();
                            stopSelection = model ? connect(model, "selection-changed", changed) : null;
                            changed();
                        };
                        stops.push(() => stopSelection?.());
                        stops.push(connect(record.native, "notify::model", attach));
                        const model = record.native.getModel();
                        if (model) { stopSelection = connect(model, "selection-changed", changed); }
                    } else {
                        for (const signal of descriptor.backend.members) {
                            wire(record.native, kind === "notify" ? "notify::" + signal : signal,
                                kind === "synthesized-signals");
                        }
                    }
                    if (stateEvent) { previous = JSON.stringify(normalize()); }
                }
                if (!subscriptions.has(record)) { subscriptions.set(record, new Set()); }
                subscriptions.get(record).add(subscription);
            } catch (error) { subscription.stop(); throw error; }
        },
        release,
        dispose() {
            let failure;
            for (const record of [...subscriptions.keys()]) {
                try { release(record); } catch (error) { failure ??= error; }
            }
            dirty.clear();
            if (failure) { throw failure; }
        }
    };
}
