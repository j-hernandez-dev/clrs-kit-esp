/** Diálogos GTK 4.10: configuración CLRS y operaciones independientes cancelables. */
export function createGuiDialogsAdapter({ Gtk, Gio, gi, get, fail, track }) {
    const pending = new Set();
    const completions = new Set();
    let disposed = false;
    const copy = value => Array.isArray(value) ? value.map(copy) : value;
    const types = new Set(["AlertDialog", "FileDialog"]);
    const setters = {
        mensaje: "setMessage", detalle: "setDetail", botones: "setButtons", boton_cancelar: "setCancelButton",
        boton_predeterminado: "setDefaultButton", modal: "setModal", titulo: "setTitle",
        etiqueta_aceptar: "setAcceptLabel", nombre_inicial: "setInitialName"
    };
    const apply = (native, name, value) => {
        // Estos setters GI no aceptan null; una instancia nueva conserva su valor GTK por defecto.
        if (value === null && (name === "detalle" || name === "titulo")) { return; }
        if (Object.hasOwn(setters, name)) { native[setters[name]](value); }
        else if (name === "archivo_inicial" || name === "carpeta_inicial") {
            native[name === "archivo_inicial" ? "setInitialFile" : "setInitialFolder"](value === null ? null : Gio.File.newForPath(value));
        } else if (name === "filtros") {
            const model = Gio.ListStore.new(gi.getGType(Gtk.FileFilter));
            for (const [label, patterns] of value) {
                const filter = new Gtk.FileFilter();
                filter.setName(label);
                patterns.forEach(pattern => filter.addPattern(pattern));
                model.append(filter);
            }
            native.setFilters(model);
        } else if (name === "filtro_predeterminado") {
            native.setDefaultFilter(value === -1 ? null : native.getFilters().getItem(value));
        }
    };
    const construct = (type, values) => {
        const native = type === "AlertDialog" ? new Gtk.AlertDialog({ message: values.mensaje }) : new Gtk.FileDialog();
        for (const [name, value] of Object.entries(values)) { apply(native, name, value); }
        return native;
    };
    const cancelled = (error, cancellable) => {
        if (cancellable.isCancelled()) { return true; }
        if (typeof error?.matches === "function") {
            return error.matches(Gtk.dialogErrorQuark(), Gtk.DialogError.CANCELLED)
                || error.matches(Gtk.dialogErrorQuark(), Gtk.DialogError.DISMISSED)
                || error.matches(Gio.ioErrorQuark(), Gio.IOErrorEnum.CANCELLED);
        }
        if (error?.domain !== undefined || error?.code !== undefined) {
            return (error.domain === Gtk.dialogErrorQuark()
                && [Gtk.DialogError.CANCELLED, Gtk.DialogError.DISMISSED].includes(error.code))
                || (error.domain === Gio.ioErrorQuark() && error.code === Gio.IOErrorEnum.CANCELLED);
        }
        // node-gtk 4.1.1 convierte GError en Error(message), sin domain/code.
        // Literales NO traducibles de GTK 4.10 gtk{alert,file}dialog.c. No usar
        // regex de "cancel" ni aceptar mensajes desconocidos como cancelaciones.
        return error?.message === "Dismissed by user" || error?.message === "Cancelled by application";
    };
    const methods = {
        MOSTRAR_ALERTA: ["choose", "chooseFinish", "alert"],
        ELEGIR_ALERTA: ["choose", "chooseFinish", "alert"],
        ABRIR_ARCHIVO: ["open", "openFinish", "single"],
        ABRIR_ARCHIVOS: ["openMultiple", "openMultipleFinish", "multiple"],
        GUARDAR_ARCHIVO: ["save", "saveFinish", "single"],
        ELEGIR_CARPETA: ["selectFolder", "selectFolderFinish", "single"],
        ELEGIR_CARPETAS: ["selectMultipleFolders", "selectMultipleFoldersFinish", "multiple"]
    };
    const localPath = file => {
        const path = file?.getPath();
        if (typeof path !== "string" || path.length === 0) { fail("CLRS_GUI_FILE_NOT_LOCAL"); }
        return path;
    };
    return {
        create(type, args) {
            if (!types.has(type)) { return null; }
            const values = type === "AlertDialog"
                ? { mensaje: args[1], detalle: null, botones: [], boton_cancelar: -1, boton_predeterminado: -1, modal: true }
                : { titulo: null, etiqueta_aceptar: null, modal: true, archivo_inicial: null,
                    carpeta_inicial: null, nombre_inicial: null, filtros: [], filtro_predeterminado: -1 };
            return { native: construct(type, values), state: { values } };
        },
        property(record, name, value, write) {
            if (!types.has(record.type)) { return null; }
            const values = record.state.values;
            if (!write) { return { value: copy(values[name]) }; }
            if (typeof value === "string" && value.includes("\0")) { fail("CLRS_GUI_INVALID_PROPERTY_VALUE"); }
            const indices = record.type === "AlertDialog" ? ["boton_cancelar", "boton_predeterminado"] : ["filtro_predeterminado"];
            const model = record.type === "AlertDialog" ? "botones" : "filtros";
            for (const index of indices) {
                const candidate = name === index ? value : values[index];
                if (candidate !== -1 && candidate >= (name === model ? value : values[model]).length) {
                    fail("CLRS_GUI_INVALID_PROPERTY_VALUE");
                }
            }
            // Construir antes de publicar: índices/filtros y llamadas nativas son transaccionales.
            const next = { ...values, [name]: copy(value) };
            const native = construct(record.type, next);
            record.native = native;
            record.state.values = next;
            return { value: undefined };
        },
        action(record, name, args) {
            if (!Object.hasOwn(methods, name)) { return null; }
            if (disposed) { fail("CLRS_GUI_RUNTIME_CLOSED"); }
            const parent = args[1] === null ? null : get(args[1]);
            if (parent && !["Window", "ApplicationWindow"].includes(parent.type)) { fail("CLRS_GUI_WRONG_COMPONENT_TYPE"); }
            const [start, finish, kind] = methods[name];
            if (kind !== "alert") {
                // GtkFileChooser puede recurrir al selector GTK aun en Windows.
                // g_settings_new aborta el proceso si falta este esquema: comprobar
                // con lookup (no aborta) antes de abrir, sin instalar nada ni imponer
                // el requisito a ventanas, controles o alertas.
                const source = Gio.SettingsSchemaSource.getDefault();
                if (!source?.lookup("org.gtk.gtk4.Settings.FileChooser", true)) {
                    fail("CLRS_GUI_DIALOG_RESOURCES_UNAVAILABLE");
                }
            }
            // Una instantánea por operación permite reusar/configurar el ID sin alterar un diálogo abierto.
            const native = construct(record.type, record.state.values);
            const cancellable = new Gio.Cancellable();
            const fallback = () => kind === "multiple" ? [] : kind === "alert" ? -1 : null;
            const operation = { parent, native, cancellable, finish, settled: false };
            let completeNative;
            const completion = new Promise(resolve => { completeNative = resolve; });
            completions.add(completion);
            const finished = () => { completions.delete(completion); completeNative(); };
            const promise = new Promise((resolve, reject) => {
                operation.settle = (error, value) => {
                    if (operation.settled) { return; }
                    operation.settled = true;
                    pending.delete(operation);
                    operation.parent = operation.native = operation.cancellable = null;
                    operation.settle = null;
                    if (error) { reject(error); } else { resolve(value); }
                };
                pending.add(operation);
                try {
                    native[start](parent?.native ?? null, cancellable, (_source, result) => {
                        try {
                            const value = native[finish](result);
                            const converted = kind === "alert" ? value : kind === "multiple"
                                ? Array.from({ length: value.getNItems() }, (_, i) => localPath(value.getItem(i))) : localPath(value);
                            operation.settle?.(null, converted);
                        } catch (error) {
                            operation.settle?.(cancelled(error, cancellable) ? null : error, fallback());
                        } finally { finished(); }
                    });
                } catch (error) { operation.settle(error); finished(); }
            });
            // MOSTRAR_ALERTA no espera ni devuelve selección; choose permite liberar/cancelar
            // el mismo diálogo nativo, incluso sin ventana principal (show no expone cierre).
            const normalized = promise.catch(error => {
                if (error?.code === "CLRS_GUI_FILE_NOT_LOCAL") { throw error; }
                fail("CLRS_GUI_NATIVE_OPERATION_FAILED");
            });
            track(normalized, name === "MOSTRAR_ALERTA");
            return { value: name === "MOSTRAR_ALERTA" ? undefined : normalized };
        },
        cancelParent(record) {
            for (const operation of pending) { if (operation.parent === record) { operation.cancellable.cancel(); } }
        },
        cancelAll() {
            for (const operation of pending) { operation.cancellable.cancel(); }
        },
        async dispose() {
            disposed = true;
            let cancellationFailed = false;
            for (const operation of [...pending]) {
                try { operation.cancellable.cancel(); }
                catch { cancellationFailed = true; }
            }
            // El loop sigue vivo mientras GTK finaliza las cancelaciones. No
            // detenerlo dejando callbacks GI con referencias nativas pendientes.
            let timeout;
            try {
                await Promise.race([Promise.all([...completions]), new Promise((_, reject) => {
                    timeout = setTimeout(() => { try { fail("CLRS_GUI_NATIVE_OPERATION_FAILED"); } catch (error) { reject(error); } }, 2000);
                })]);
            } finally {
                clearTimeout(timeout);
                for (const operation of [...pending]) {
                    operation.settle?.(null, operation.finish === "chooseFinish" ? -1
                        : operation.finish.includes("Multiple") ? [] : null);
                }
            }
            if (cancellationFailed) { fail("CLRS_GUI_NATIVE_OPERATION_FAILED"); }
        }
    };
}
