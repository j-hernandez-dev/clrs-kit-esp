// Sólo proceso hijo de ensayo; los diálogos visibles pertenecen a esta prueba.
import assert from "node:assert/strict";
import { configureGuiPrivateEnvironment } from "../../src/standard-library/gui/runtime/GuiEnvironmentProbe.js";
import { getGuiRuntimeFactorySource } from "../../src/standard-library/gui/runtime/GuiRuntimeSource.js";
await configureGuiPrivateEnvironment(process.argv[2]);
const { default: gi } = await import(process.argv[2]);
const Gtk = gi.require("Gtk", "4.0"), Gio = gi.require("Gio", "2.0");
assert.ok(Gio.SettingsSchemaSource.getDefault()?.lookup("org.gtk.gtk4.Settings.FileChooser", true));
const cancellables = [], dialogs = [];
const session = await Function(`return (${getGuiRuntimeFactorySource()})`)()({ default: {
    ...gi, require(name, version) {
        const namespace = gi.require(name, version);
        return new Proxy(namespace, { get(target, key) {
            const value = target[key];
            if (!((name === "Gio" && key === "Cancellable") || (name === "Gtk" && key === "FileDialog"))) { return value; }
            return new Proxy(value, { construct(Type, args) {
                const object = new Type(...args);
                (name === "Gio" ? cancellables : dialogs).push(object); return object;
            } });
        } });
    }
} }, {});
const call = (name, ...args) => session.invoke(name, args);
const checks = [];
try {
    call("VENTANA_APLICACION", "parent", "CLRS: validación de selector de archivos");
    call("MOSTRAR", "parent");
    call("DIALOGO_ARCHIVO", "files");
    // Carpeta inicial válida evita que el backend reciba una ruta nula.
    call("ESTABLECER", "files", "carpeta_inicial", process.cwd());
    for (const [action, expected] of [["ABRIR_ARCHIVO", null], ["ABRIR_ARCHIVOS", []],
        ["GUARDAR_ARCHIVO", null], ["ELEGIR_CARPETA", null], ["ELEGIR_CARPETAS", []]]) {
        const pending = call(action, "files", "parent");
        assert.ok(dialogs.at(-1) instanceof Gtk.FileDialog);
        const cancel = cancellables.at(-1);
        const timer = setTimeout(() => cancel.cancel(), 350);
        try { assert.deepEqual(await pending, expected); } finally { clearTimeout(timer); }
        checks.push(action);
    }
    const pending = call("ABRIR_ARCHIVOS", "files", "parent");
    await new Promise(resolve => setTimeout(resolve, 200));
    await session.dispose();
    assert.deepEqual(await pending, []);
    checks.push("dispose-cancels-pending-dialog");
} finally { await session.dispose(); }
console.log(JSON.stringify({ ok: true, schemaResolved: true, realDialogsCreated: dialogs.length,
    checks, selectionOfRealPathVerified: false }));
