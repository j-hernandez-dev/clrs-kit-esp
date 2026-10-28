import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getGuiRuntimeFactorySource } from "../../src/standard-library/gui/runtime/GuiRuntimeSource.js";
import { invokeGuiCallback, createGuiCallbackReference } from "../../src/compiler/gui/GuiCallbackBridge.js";
import { GUI_COMPONENTS } from "../../src/standard-library/gui/GuiComponentCatalog.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseSource } from "../../src/language/LanguageFrontend.js";
import { JavaScriptGenerator } from "../../src/compiler/JavaScriptGenerator.js";

const binding = await import(process.argv[2]);
const gi = binding.default;
const Gtk = gi.require("Gtk", "4.0");
const Gio = gi.require("Gio", "2.0");
const Gdk = gi.require("Gdk", "4.0");
const observed = [];
const hasFileDialogResources = !!Gio.SettingsSchemaSource.getDefault()?.lookup("org.gtk.gtk4.Settings.FileChooser", true);
const generatedChecks = [];
// Captura únicamente de ensayo; el runtime público nunca entrega estas referencias.
const nativeObjects = [];
const runtimeSource = getGuiRuntimeFactorySource();
const session = await Function(`return (${runtimeSource})`)()({ default: {
    ...gi,
    require(name, version) {
        const namespace = gi.require(name, version);
        if (name !== "Gtk" && name !== "Gio") { return namespace; }
        return new Proxy(namespace, { get(target, property) {
            const value = target[property];
            if (typeof value !== "function" || !/^[A-Z]/.test(property)) { return value; }
            return new Proxy(value, { construct(Type, args) { const instance = new Type(...args); nativeObjects.push(instance); return instance; } });
        } });
    }
} }, { invokeCallback: invokeGuiCallback });
const call = (name, ...args) => session.invoke(name, args);
const on = (id, event, callback = (...args) => observed.push([event, ...args]), sync = false) =>
    call("CONECTAR", id, event, createGuiCallbackReference(callback, sync, { line: 7, column: 1 }));
const pause = () => new Promise(resolve => setTimeout(resolve, 40));
try {
    call("VENTANA_APLICACION", "v", "CLRS: ensayo automático de eventos");
    const testApp = nativeObjects.find(object => object instanceof Gtk.Application);
    assert.equal(testApp.getWindows().length, 1);
    assert.ok(nativeObjects.find(object => object instanceof Gtk.ApplicationWindow).getApplication());
    call("CAJA", "box", "vertical", 2); call("CONTENER", "v", "box");
    call("BOTON", "b", "Acción"); call("ANEXAR", "box", "b");
    call("MOSTRAR", "v");
    const button = nativeObjects.find(object => object instanceof Gtk.Button);
    on("b", "clic", async id => {
        assert.equal(id, "b");
        assert.match(await readFile(new URL(import.meta.url), "utf8"), /readFile/);
        await pause(); observed.push(["io-completed"]);
    });
    button.emit("clicked"); await pause(); await pause();
    assert.ok(observed.some(row => row[0] === "io-completed"));
    on("b", "puntero_entro"); on("b", "presionado");
    on("b", "tecla_presionada", (id, key, code, modifiers) => {
        assert.equal(key, "a"); assert.equal(code, 38); assert.deepEqual(modifiers, ["shift", "control"]); return true;
    }, true);
    const motion = nativeObjects.find(object => object instanceof Gtk.EventControllerMotion);
    motion.emit("enter", 1.5, 2.5);
    const key = nativeObjects.find(object => object instanceof Gtk.EventControllerKey);
    assert.equal(key.emit("key-pressed", Gdk.KEY_a, 38, Gdk.ModifierType.SHIFT_MASK | Gdk.ModifierType.CONTROL_MASK), true);
    call("ENTRADA", "e"); on("e", "cambio"); call("ESTABLECER", "e", "texto", "España");
    call("CALENDARIO", "c"); on("c", "fecha_cambiada"); call("ESTABLECER", "c", "fecha", [2024, 2, 29]);
    call("LISTA_DESPLEGABLE", "d", ["A", "B"]); on("d", "seleccion_cambiada"); call("ESTABLECER", "d", "seleccion", -1);
    call("VISTA_COLUMNAS", "t", ["Letra"]); call("ESTABLECER", "t", "datos", [["A"], ["B"]]);
    on("t", "seleccion_cambiada"); call("ESTABLECER", "t", "modo_seleccion", "multiple");
    call("ESTABLECER", "t", "seleccion", [0, 1]);
    await pause();
    assert.ok(observed.some(row => JSON.stringify(row) === JSON.stringify(["seleccion_cambiada", "d", -1, null])));
    assert.ok(observed.some(row => JSON.stringify(row) === JSON.stringify(["seleccion_cambiada", "t", [0, 1]])));
    assert.ok(observed.some(row => JSON.stringify(row) === JSON.stringify(["fecha_cambiada", "c", [2024, 2, 29]])));
    // Conectar cada evento catalogado contra su tipo GTK real, no sólo contra dobles.
    const inputs = {
        Window: ["General"], ApplicationWindow: ["Aplicación"], Label: ["Etiqueta"], Entry: [], PasswordEntry: [],
        TextView: [], Button: ["Botón"], CheckButton: ["Casilla"], ToggleButton: ["Alternar"],
        LinkButton: ["https://example.invalid", "Enlace"], SpinButton: [0, 10, 1], Scale: ["horizontal", 0, 10, 1],
        ProgressBar: [], Spinner: [], DropDown: [["A", "B"]], Calendar: [], Image: [""],
        Box: ["vertical", 0], Grid: [], ScrolledWindow: [], ListBox: [], ColumnView: [["A"]]
    };
    let connectedEvents = 0;
    for (const [type, args] of Object.entries(inputs)) {
        call(GUI_COMPONENTS[type].factory.name, "all-" + type, ...args);
        for (const event of Object.keys(GUI_COMPONENTS[type].events)) {
            try { on("all-" + type, event, () => true, true); connectedEvents++; }
            catch (error) { console.error("Evento no conectado:", type, event); throw error; }
        }
    }
    call("DIALOGO_ALERTA", "alert", "Elección");
    call("ESTABLECER", "alert", "botones", ["No", "Sí"]);
    call("ESTABLECER", "alert", "boton_cancelar", 0);
    assert.deepEqual(call("OBTENER", "alert", "botones"), ["No", "Sí"]);
    const acceptedAlert = call("ELEGIR_ALERTA", "alert", "v");
    await pause();
    const toplevels = Gtk.Window.getToplevels();
    const alertWindow = Array.from({ length: toplevels.getNItems() }, (_, i) => toplevels.getItem(i))
        .find(window => window instanceof Gtk.Dialog && window.getTransientFor() !== null);
    assert.ok(alertWindow, "Gtk.AlertDialog debe crear un diálogo nativo para el ensayo de elección");
    alertWindow.response(1);
    assert.equal(await acceptedAlert, 1);
    call("DIALOGO_ARCHIVO", "files");
    call("ESTABLECER", "files", "filtros", [["Texto", ["*.txt", "*.clrs"]]]);
    call("ESTABLECER", "files", "filtro_predeterminado", 0);
    assert.deepEqual(call("OBTENER", "files", "filtros"), [["Texto", ["*.txt", "*.clrs"]]]);
    for (const [property, value] of [["detalle", "Información"], ["detalle", null], ["modal", false]]) {
        call("ESTABLECER", "alert", property, value); assert.deepEqual(call("OBTENER", "alert", property), value);
    }
    for (const [property, value] of [["titulo", "Selecciona un archivo"], ["titulo", null],
        ["archivo_inicial", process.execPath], ["carpeta_inicial", process.cwd()], ["nombre_inicial", "ensayo.txt"],
        ["etiqueta_aceptar", "Seleccionar"], ["etiqueta_aceptar", null]]) {
        call("ESTABLECER", "files", property, value); assert.deepEqual(call("OBTENER", "files", property), value);
    }
    for (const [action, empty] of [["ABRIR_ARCHIVO", null], ["ABRIR_ARCHIVOS", []], ["GUARDAR_ARCHIVO", null],
        ["ELEGIR_CARPETA", null], ["ELEGIR_CARPETAS", []]]) {
        if (!hasFileDialogResources) {
            assert.throws(() => call(action, "files", "v"), { code: "CLRS_GUI_DIALOG_RESOURCES_UNAVAILABLE" });
            continue;
        }
        const result = call(action, "files", "v");
        const cancel = nativeObjects.filter(object => object instanceof Gio.Cancellable).at(-1);
        setTimeout(() => cancel.cancel(), 80);
        assert.deepEqual(await result, empty, action);
    }
    const choice = call("ELEGIR_ALERTA", "alert", "v");
    await pause();
    call("CERRAR", "v");
    assert.equal(await choice, -1);
    // Cerrar las dos ventanas auxiliares; sus callbacks estaban vetando el cierre.
    for (const window of testApp.getWindows()) { window.destroy(); }
    await session.waitForIdle();
    call("MOSTRAR_ALERTA", "alert", null);
    const pendingOpen = hasFileDialogResources ? call("ABRIR_ARCHIVOS", "files", null) : null;
    await pause();
    await session.dispose();
    if (pendingOpen) { assert.deepEqual(await pendingOpen, []); }
    for (const [label, body, status, output] of [
        ["event-success", '    escribir texto\n    CERRAR("v")', 0, /CALLBACK_GENERATED_OK/],
        ["event-failure", '    LANZAR_ERROR("Fallo localizado del callback")', 70, /Fallo localizado del callback/]
    ]) {
        const source = `AL_CAMBIO(id, texto)\n${body}\nPRINCIPAL()\n    VENTANA_APLICACION("v", "Ensayo generado")\n    ENTRADA("e")\n    CONTENER("v", "e")\n    CONECTAR("e", "cambio", AL_CAMBIO)\n    MOSTRAR("v")\n    ESTABLECER("e", "texto", "CALLBACK_GENERATED_OK")`;
        // La resolución por nombre es la misma que usa el JS autónomo; sólo se
        // reutiliza la instalación privada ya existente para no descargar paquetes.
        const generated = new JavaScriptGenerator().generate(parseSource(source).ast, {
            runtimeContext: { gui: { moduleUrl: "node-gtk", factorySource: getGuiRuntimeFactorySource() } }
        });
        const child = spawnSync(process.execPath, ["--input-type=module"], {
            cwd: fileURLToPath(new URL("../../../", process.argv[2])), input: generated.generatedCode,
            encoding: "utf8", windowsHide: true, timeout: 10000
        });
        assert.equal(child.error, undefined, child.error?.message);
        assert.equal(child.status, status, child.stderr);
        assert.match(child.stdout + child.stderr, output);
        assert.doesNotMatch(child.stderr, /UnhandledPromiseRejection/);
        generatedChecks.push(label);
    }
    console.log(JSON.stringify({ ok: true, gtk: [Gtk.getMajorVersion(), Gtk.getMinorVersion(), Gtk.getMicroVersion()],
        node: process.versions.node, platform: process.platform, arch: process.arch,
        checks: ["all-181-catalogued-event-connections", "async-callback-node-io-and-timers", "motion-and-immediate-key",
            "text-calendar-and-selection-snapshots", "dialog-properties-and-filters", "native-alert-button-choice",
            hasFileDialogResources ? "five-file-dialog-cancellations" : "file-dialog-missing-resources-controlled-error",
            "application-window-parent-close-cancels-dialog", "dispose-drains-native-dialog-cancellations",
            "standalone-generated-event-success-and-localized-failure"],
        observed, connectedEvents, hasFileDialogResources, generatedChecks }));
} finally { await session.dispose(); }
