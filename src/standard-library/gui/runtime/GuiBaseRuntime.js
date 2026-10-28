/** Autocontenida: se serializa, no captura módulos ni carga GTK en el Extension Host. */
export async function createGuiBaseRuntime(binding, options, contract) {
    const { GUI_COMPONENTS, GuiContractError, assertGuiArgumentDomains, assertGuiNewIdentifier,
        requireGuiProperty, assertGuiPropertyDomain, requireGuiEvent, requireGuiAction, isGuiValueInDomain } = contract;
    const runtimeError = code => {
        const error = new GuiContractError(code);
        error.name = "CLRSUserError";
        return error;
    };
    const fail = code => { throw runtimeError(code); };
    const gi = binding.default ?? binding;
    const Gtk = gi.require("Gtk", "4.0");
    const Gio = gi.require("Gio", "2.0");
    const GLib = gi.require("GLib", "2.0");
    let app = new Gtk.Application({ applicationId: "org.clrs.gui.runtime", flags: Gio.ApplicationFlags.NON_UNIQUE });
    let stopLoop;
    const records = new Map();
    const liveWindows = new Set();
    const connections = [];
    let disposed = false;
    let mainFinished = false;
    let held = false;
    let failure = null;
    let resolveIdle;
    let rejectIdle;
    let idlePromise;
    let themeMode = "sistema";
    let themeBaseline;
    let controls;
    let events;
    let dialogs;
    const pending = new Set();
    const settings = () => Gtk.Settings.getDefault() ?? fail("CLRS_GUI_NATIVE_OPERATION_FAILED");
    const rememberTheme = () => {
        themeBaseline ??= { name: settings().gtkThemeName, dark: settings().gtkApplicationPreferDarkTheme };
    };
    const checkIdle = () => {
        if (!mainFinished || !resolveIdle) { return; }
        if (failure) { rejectIdle(failure); }
        else if (disposed || (app.getWindows().length === 0 && pending.size === 0)) { resolveIdle(); }
    };
    const reportFailure = error => {
        failure ??= error;
        // Desbloquear un PRINCIPAL que estuviera esperando un diálogo cuando
        // falla otro callback. El primer error conserva su ubicación y prioridad.
        try { dialogs?.cancelAll(); } catch { /* Se conserva el error original. */ }
        checkIdle();
    };
    const track = (promise, background = false) => {
        pending.add(promise);
        // Adjuntar siempre ambos handlers: una señal GTK nunca deja un rechazo huérfano.
        promise.then(() => { pending.delete(promise); checkIdle(); }, error => {
            pending.delete(promise);
            if (background) { reportFailure(error); }
            checkIdle();
        });
        return promise;
    };
    const dispatch = (reference, record, args, immediate) => {
        if (disposed || failure || !record.live) { return immediate; }
        if (immediate) { return options.invokeCallback(reference, record.id, args, true); }
        track(Promise.resolve().then(() => {
            if (!disposed && record.live && !failure) { return options.invokeCallback(reference, record.id, args, false); }
        }), true);
        return false;
    };
    const connect = (object, signal, callback, after = false) => {
        const token = object.connect(signal, callback, after);
        const entry = [object, token];
        connections.push(entry);
        return () => {
            const index = connections.indexOf(entry);
            if (index === -1) { return; }
            try { object.disconnect(token); } finally { connections.splice(index, 1); }
        };
    };
    const deactivate = record => {
        if (!record?.live) { return; }
        record.live = false;
        liveWindows.delete(record);
        record.stopWindow?.(); record.stopWindow = null;
        try { events?.release(record); } catch { reportFailure(runtimeError("CLRS_GUI_NATIVE_OPERATION_FAILED")); }
        try { dialogs?.cancelParent(record); } catch { reportFailure(runtimeError("CLRS_GUI_NATIVE_OPERATION_FAILED")); }
        try { controls?.release(record); } catch { failure ??= runtimeError("CLRS_GUI_NATIVE_OPERATION_FAILED"); }
        for (const id of record.children) { deactivate(records.get(id)); }
        record.children.clear(); record.native = null; record.state = null;
    };
    const sweepWindows = () => {
        if (disposed) { return; }
        // El depurador también recibe órdenes mientras CLRS espera eventos/diálogos.
        // En pausa no se itera GTK: no hay reentrada ni callbacks adelantados.
        try { options.pollDebug?.(); } catch (error) { reportFailure(error); }
        // El estado nativo es autoridad, sin depender de identidad de wrappers
        // ni del orden en que GTK notifica la retirada de una ventana.
        for (const record of liveWindows) {
            if (record.native.getApplication() == null) { deactivate(record); }
        }
        checkIdle();
    };
    const dispose = async () => {
        if (disposed) { return; }
        disposed = true;
        // Desconectar antes de destruir evita reentradas y permite cerrar aun si un callback veta el cierre.
        let cleanupError;
        const safely = action => { try { action(); } catch { cleanupError ??= runtimeError("CLRS_GUI_NATIVE_OPERATION_FAILED"); } };
        safely(() => events?.dispose());
        try { await dialogs?.dispose(); } catch { cleanupError ??= runtimeError("CLRS_GUI_NATIVE_OPERATION_FAILED"); }
        for (const [object, token] of connections.splice(0)) { safely(() => object.disconnect(token)); }
        safely(() => controls?.dispose());
        controls = null;
        for (const window of app.getWindows()) { safely(() => window.destroy()); }
        records.clear();
        liveWindows.clear();
        if (themeBaseline) {
            safely(() => { settings().gtkThemeName = themeBaseline.name; });
            safely(() => { settings().gtkApplicationPreferDarkTheme = themeBaseline.dark; });
        }
        themeBaseline = undefined;
        themeMode = "sistema";
        if (held) { held = false; safely(() => app.release()); }
        safely(() => stopLoop?.());
        safely(() => app.quit());
        checkIdle();
        app = null;
        pending.clear();
        if (cleanupError && !failure) { throw cleanupError; }
    };
    try {
        // register emite startup e inicializa GtkApplication. No anidar app.run/MainLoop:
        // en Windows ese patrón bloqueaba I/O de Node durante callbacks con await.
        if (!app.register(null)) { fail("CLRS_GUI_RUNTIME_NOT_READY"); }
        app.hold(); held = true;
        stopLoop = contract.createEventLoop(GLib, () => reportFailure(runtimeError("CLRS_GUI_NATIVE_OPERATION_FAILED")), sweepWindows);
    } catch (error) {
        failure = error;
        await dispose();
        throw error instanceof GuiContractError ? error : runtimeError("CLRS_GUI_NATIVE_OPERATION_FAILED");
    }

    const get = id => {
        const record = records.get(id);
        if (!record?.live) { fail("CLRS_GUI_COMPONENT_NOT_FOUND"); }
        return record;
    };
    const nativeInteger = value => {
        if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
            fail("CLRS_GUI_INVALID_ARGUMENT");
        }
        return value;
    };
    const orientation = { horizontal: Gtk.Orientation.HORIZONTAL, vertical: Gtk.Orientation.VERTICAL };
    const alignment = { inicio: Gtk.Align.START, centro: Gtk.Align.CENTER, fin: Gtk.Align.END, rellenar: Gtk.Align.FILL };
    const policy = { automatico: Gtk.PolicyType.AUTOMATIC, siempre: Gtk.PolicyType.ALWAYS, nunca: Gtk.PolicyType.NEVER };
    const enums = { orientacion: orientation, alineacion_horizontal: alignment, alineacion_vertical: alignment,
        politica_horizontal: policy, politica_vertical: policy };
    // Lista cerrada: nunca se transforma una propiedad recibida en una ruta arbitraria de GObject.
    const properties = {
        visible: "visible", habilitado: "sensitive", opacidad: "opacity", ancho_minimo: "widthRequest",
        alto_minimo: "heightRequest", expandir_horizontal: "hexpand", expandir_vertical: "vexpand",
        alineacion_horizontal: "halign", alineacion_vertical: "valign", margen_superior: "marginTop",
        margen_inferior: "marginBottom", margen_inicio: "marginStart", margen_fin: "marginEnd",
        ayuda: "tooltipText", enfocable: "focusable", titulo: "title", redimensionable: "resizable",
        modal: "modal", decorada: "decorated", cerrable: "deletable", ocultar_al_cerrar: "hideOnClose",
        activa: "isActive", maximizada: "maximized", pantalla_completa: "fullscreened",
        orientacion: "orientation", separacion: "spacing", homogeneo: "homogeneous",
        separacion_filas: "rowSpacing", separacion_columnas: "columnSpacing",
        filas_homogeneas: "rowHomogeneous", columnas_homogeneas: "columnHomogeneous",
        politica_horizontal: "hscrollbarPolicy", politica_vertical: "vscrollbarPolicy",
        desplazamiento_cinetico: "kineticScrolling", desplazamiento_superpuesto: "overlayScrolling",
        marco: "hasFrame", ancho_contenido_minimo: "minContentWidth", alto_contenido_minimo: "minContentHeight",
        ancho_contenido_maximo: "maxContentWidth", alto_contenido_maximo: "maxContentHeight"
    };
    const factories = {
        Window: args => { const window = new Gtk.Window(); app.addWindow(window); window.setTitle(args[1]); return window; },
        ApplicationWindow: args => { const window = new Gtk.ApplicationWindow(); app.addWindow(window); window.setTitle(args[1]); return window; },
        Box: args => new Gtk.Box({ orientation: orientation[args[1]], spacing: nativeInteger(args[2]) }),
        Grid: () => new Gtk.Grid(),
        ScrolledWindow: () => new Gtk.ScrolledWindow()
    };
    try {
        controls = contract.createControls({ Gtk, Gio, GLib, gi, get, fail,
            createModels: contract.createModels,
            connect(object, signal, callback) {
                return connect(object, signal, (...args) => {
                    try { return callback(...args); }
                    catch (error) { failure ??= error instanceof GuiContractError ? error : runtimeError("CLRS_GUI_NATIVE_OPERATION_FAILED"); checkIdle(); }
                });
            }
        });
    } catch (error) {
        failure = error;
        await dispose();
        throw error instanceof GuiContractError ? error : runtimeError("CLRS_GUI_NATIVE_OPERATION_FAILED");
    }
    const property = (record, name, value, write) => {
        const descriptor = requireGuiProperty(record.type, name, write ? "write" : "read");
        if (write) {
            assertGuiPropertyDomain(record.type, name, value);
            if (descriptor.domain.integer) { nativeInteger(value); }
        }
        const adapted = dialogs.property(record, name, value, write) ?? controls.property(record, name, value, write);
        if (adapted) {
            if (!write) { assertGuiPropertyDomain(record.type, name, adapted.value, "read"); }
            return adapted.value;
        }
        if (name === "ancho" || name === "alto") {
            if (!write) { return record[name]; }
            record.native.setDefaultSize(name === "ancho" ? value : record.ancho, name === "alto" ? value : record.alto);
            record[name] = value;
            return;
        }
        if (name === "ayuda") {
            if (write) { record.native.setTooltipText(value); return; }
            const result = record.native.getTooltipText();
            assertGuiPropertyDomain(record.type, name, result, "read");
            return result;
        }
        const nativeName = Object.hasOwn(properties, name) ? properties[name] : null;
        if (!nativeName) { fail("CLRS_GUI_RUNTIME_UNSUPPORTED"); }
        const mapping = Object.hasOwn(enums, name) ? enums[name] : null;
        if (write) {
            if (record.type === "ScrolledWindow") {
                const limits = {
                    ancho_contenido_minimo: [value, record.native.maxContentWidth],
                    ancho_contenido_maximo: [record.native.minContentWidth, value],
                    alto_contenido_minimo: [value, record.native.maxContentHeight],
                    alto_contenido_maximo: [record.native.minContentHeight, value]
                };
                if (Object.hasOwn(limits, name)) {
                    const [minimum, maximum] = limits[name];
                    if (minimum !== -1 && maximum !== -1 && minimum > maximum) {
                        fail("CLRS_GUI_INVALID_PROPERTY_VALUE");
                    }
                }
            }
            record.native[nativeName] = mapping ? mapping[value] : value;
            return;
        }
        const stateGetters = { activa: "isActive", maximizada: "isMaximized", pantalla_completa: "isFullscreen" };
        let result = Object.hasOwn(stateGetters, name) ? record.native[stateGetters[name]]() : record.native[nativeName];
        if (mapping) { result = Object.keys(mapping).find(key => mapping[key] === result); }
        assertGuiPropertyDomain(record.type, name, result, "read");
        return result;
    };
    const contain = (name, parent, args) => {
        const child = get(args[1]);
        if (name === "QUITAR") {
            if (child.parent !== parent.id) { fail("CLRS_GUI_CHILD_NOT_FOUND"); }
            if (GUI_COMPONENTS[parent.type].containment === "single") { parent.native.setChild(null); }
            else if (parent.type === "ListBox") { controls.detachListChild(parent, child); }
            else { parent.native.remove(child.native); }
            parent.children.delete(child.id); child.parent = null;
            return;
        }
        if (!GUI_COMPONENTS[child.type].widget || GUI_COMPONENTS[child.type].toplevel) {
            fail("CLRS_GUI_WRONG_COMPONENT_TYPE");
        }
        if (child.parent !== null || child.native.getParent() !== null
            || (GUI_COMPONENTS[parent.type].containment === "single" && parent.children.size)) {
            fail("CLRS_GUI_PARENT_CONFLICT");
        }
        for (let ancestor = parent; ancestor; ancestor = ancestor.parent === null ? null : get(ancestor.parent)) {
            if (ancestor === child) { fail("CLRS_GUI_PARENT_CONFLICT"); }
        }
        if (name === "CONTENER") { parent.native.setChild(child.native); }
        else if (name === "ANEXAR") { parent.native.append(child.native); }
        else if (name === "PREPONER") { parent.native.prepend(child.native); }
        else {
            const position = args.slice(2).map(nativeInteger);
            nativeInteger(position[0] + position[2]); nativeInteger(position[1] + position[3]);
            parent.native.attach(child.native, ...position);
        }
        parent.children.add(child.id); child.parent = parent.id;
    };
    const invoke = (name, args) => {
        if (failure) { throw failure; }
        if (disposed) { fail("CLRS_GUI_RUNTIME_CLOSED"); }
        const definition = assertGuiArgumentDomains(name, args, {
            isFunctionReference: value => value !== null && typeof value === "object"
                && typeof value.callback === "function" && typeof value.synchronous === "boolean"
        });
        if (definition.kind === "factory") {
            assertGuiNewIdentifier(args[0], records);
            const created = Object.hasOwn(factories, definition.componentType)
                ? { native: factories[definition.componentType](args), state: {} }
                : dialogs.create(definition.componentType, args) ?? controls.create(definition.componentType, args);
            if (!created) { fail("CLRS_GUI_RUNTIME_UNSUPPORTED"); }
            const { native, state } = created;
            const record = { id: args[0], type: definition.componentType, native,
                state, live: true, parent: null, children: new Set(), ancho: -1, alto: -1 };
            records.set(args[0], record);
            if (GUI_COMPONENTS[record.type].toplevel) {
                liveWindows.add(record);
                record.stopWindow = connect(native, "notify::application", () => {
                    if (native.getApplication() == null) { deactivate(record); checkIdle(); }
                });
            }
            return;
        }
        if (definition.kind === "theme") {
            if (name === "OBTENER_TEMA") { return settings().gtkThemeName; }
            if (name === "OBTENER_MODO_TEMA") { return themeMode; }
            rememberTheme();
            if (name === "ESTABLECER_TEMA") { settings().gtkThemeName = args[0]; }
            else {
                settings().gtkApplicationPreferDarkTheme = args[0] === "sistema" ? themeBaseline.dark : args[0] === "oscuro";
                themeMode = args[0];
            }
            return;
        }
        const record = get(args[0]);
        if (name === "ESTABLECER" || name === "OBTENER") { return property(record, args[1], args[2], name === "ESTABLECER"); }
        if (name === "CONECTAR") {
            events.connect(record, args[1], args[2], requireGuiEvent(record.type, args[1]));
            return;
        }
        requireGuiAction(record.type, name);
        const dialogResult = dialogs.action(record, name, args);
        if (dialogResult) { return dialogResult.value; }
        if (["CONTENER", "QUITAR", "ANEXAR", "PREPONER", "COLOCAR"].includes(name)) { return contain(name, record, args); }
        if (controls.action(record, name, args)) { return; }
        switch (name) {
            case "MOSTRAR": if (GUI_COMPONENTS[record.type].toplevel) { record.native.present(); } else { record.native.show(); } return;
            case "OCULTAR": record.native.hide(); return;
            case "ENFOCAR": return record.native.grabFocus();
            case "CERRAR": record.native.close(); sweepWindows(); return;
            case "MAXIMIZAR": record.native.maximize(); return;
            case "MINIMIZAR": record.native.minimize(); return;
            case "PANTALLA_COMPLETA": record.native.fullscreen(); return;
            case "RESTAURAR": record.native.unfullscreen(); record.native.unmaximize(); record.native.unminimize(); return;
            default: fail("CLRS_GUI_RUNTIME_UNSUPPORTED");
        }
    };
    try {
        dialogs = contract.createDialogs({ Gtk, Gio, gi, get, fail, track });
        events = contract.createEvents({ Gtk, gi, connect, read: (record, name) => property(record, name, undefined, false),
            fail, dispatch, reportFailure, isGuiValueInDomain });
    } catch (error) { await dispose(); throw error; }
    return Object.freeze({
        invoke(name, args) {
            events.begin();
            try { return invoke(name, args); }
            catch (error) {
                if (error === failure) { throw error; }
                if (error instanceof GuiContractError) { error.name = "CLRSUserError"; throw error; }
                if (error.name === "CLRSUserError") { throw error; }
                throw runtimeError("CLRS_GUI_NATIVE_OPERATION_FAILED");
            }
            finally { events.end(); }
        },
        waitForIdle() {
            mainFinished = true;
            options.onWaitForIdle?.({ windows: app.getWindows().length, pending: pending.size });
            idlePromise ??= new Promise((resolve, reject) => { resolveIdle = resolve; rejectIdle = reject; });
            checkIdle();
            return idlePromise;
        },
        dispose
    });
}
