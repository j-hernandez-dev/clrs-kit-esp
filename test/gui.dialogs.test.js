import test from "node:test";
import assert from "node:assert/strict";
import { fakeDialogs } from "./fixtures/gui/FakeDialogs.js";
import { fakeGtk } from "./fixtures/gui/FakeGtk.js";
import { getGuiRuntimeFactorySource } from "../src/standard-library/gui/runtime/GuiRuntimeSource.js";
import { invokeGuiCallback, createGuiCallbackReference } from "../src/compiler/gui/GuiCallbackBridge.js";

async function setup(t) {
    const native = fakeGtk();
    const dialogs = fakeDialogs();
    Object.assign(native.Gtk, dialogs.Gtk);
    Object.assign(native.binding.default.require("Gio"), dialogs.Gio);
    native.binding.default.getGType = dialogs.gi.getGType;
    const session = await Function(`return (${getGuiRuntimeFactorySource()})`)()(native.binding, { invokeCallback: invokeGuiCallback });
    t.after(() => session.dispose());
    return { ...dialogs, native, session, call: (name, ...args) => session.invoke(name, args) };
}

test("GUI diálogos: 24 componentes; configuración, copias, índices y padre de misma sesión", async t => {
    const { call, operations } = await setup(t);
    call("DIALOGO_ALERTA", "a", "Mensaje"); call("DIALOGO_ARCHIVO", "f");
    assert.throws(() => call("MOSTRAR", "a"), { code: "CLRS_GUI_ACTION_NOT_SUPPORTED" });
    assert.throws(() => call("OBTENER", "f", "visible"), { code: "CLRS_GUI_PROPERTY_NOT_FOUND" });
    assert.throws(() => call("ESTABLECER", "a", "boton_cancelar", 0), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
    const buttons = ["No", "Sí"];
    call("ESTABLECER", "a", "botones", buttons); buttons[0] = "Alterado";
    call("ESTABLECER", "a", "boton_cancelar", 1);
    assert.throws(() => call("ESTABLECER", "a", "botones", []), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
    assert.deepEqual(call("OBTENER", "a", "botones"), ["No", "Sí"]);
    call("ESTABLECER", "f", "filtros", [["Texto", ["*.txt"]]]);
    call("ESTABLECER", "f", "filtro_predeterminado", 0);
    const filters = call("OBTENER", "f", "filtros"); filters[0][1].push("*");
    assert.deepEqual(call("OBTENER", "f", "filtros"), [["Texto", ["*.txt"]]]);
    assert.throws(() => call("ABRIR_ARCHIVO", "f", "ajena"), { code: "CLRS_GUI_COMPONENT_NOT_FOUND" });
    assert.throws(() => call("ABRIR_ARCHIVO", "f", "a"), { code: "CLRS_GUI_WRONG_COMPONENT_TYPE" });
    assert.equal(operations.length, 0);
});

for (const [action, method, multiple, empty] of [
    ["ABRIR_ARCHIVO", "open", false, null], ["ABRIR_ARCHIVOS", "openMultiple", true, []],
    ["GUARDAR_ARCHIVO", "save", false, null], ["ELEGIR_CARPETA", "selectFolder", false, null],
    ["ELEGIR_CARPETAS", "selectMultipleFolders", true, []]
]) {
    test(`GUI diálogos: ${action} devuelve rutas/cancelación y rechaza recursos remotos`, async t => {
        const { call, operations, file, list } = await setup(t);
        call("DIALOGO_ARCHIVO", "f");
        const selected = call(action, "f", null);
        assert.equal(operations.at(-1).method, method);
        operations.at(-1).complete(null, multiple ? list([file("C:/á/a.txt"), file("/b")]) : file("/a"));
        assert.deepEqual(await selected, multiple ? ["C:/á/a.txt", "/b"] : "/a");
        for (const error of [new Error("Dismissed by user"), Object.assign(new Error("Traducido"), { domain: 10, code: 2 })]) {
            const dismissed = call(action, "f", null); operations.at(-1).complete(error);
            assert.deepEqual(await dismissed, empty);
        }
        const remote = call(action, "f", null);
        operations.at(-1).complete(null, multiple ? list([file(null)]) : file(null));
        await assert.rejects(remote, { code: "CLRS_GUI_FILE_NOT_LOCAL" });
        const failure = call(action, "f", null);
        operations.at(-1).complete(new Error("Failed to cancel private-uri"));
        await assert.rejects(failure, error => error.code === "CLRS_GUI_NATIVE_OPERATION_FAILED" && !error.message.includes("private"));
    });
}

test("GUI diálogos: alertas esperan elección; MOSTRAR no espera pero conserva vida sin ventanas", async t => {
    const { call, session, operations } = await setup(t);
    call("DIALOGO_ALERTA", "a", "Mensaje");
    call("ESTABLECER", "a", "botones", ["No", "Sí"]);
    const selected = call("ELEGIR_ALERTA", "a", null);
    operations.at(-1).complete(null, 1); assert.equal(await selected, 1);
    const cancel = call("ELEGIR_ALERTA", "a", null);
    operations.at(-1).complete(new Error("Dismissed by user")); assert.equal(await cancel, -1);
    assert.equal(call("MOSTRAR_ALERTA", "a", null), undefined);
    let finished = false;
    const idle = session.waitForIdle().then(() => { finished = true; });
    await Promise.resolve(); assert.equal(finished, false);
    operations.at(-1).complete(null, 0);
    await idle; assert.equal(finished, true);
});

test("GUI diálogos: operaciones concurrentes aisladas y cancelación al destruir padre", async t => {
    const { call, session, operations } = await setup(t);
    call("VENTANA", "v", "Padre"); call("DIALOGO_ALERTA", "a", "Original");
    const first = call("ELEGIR_ALERTA", "a", "v");
    call("ESTABLECER", "a", "mensaje", "Modificado");
    const second = call("ELEGIR_ALERTA", "a", "v");
    assert.notEqual(operations[0].native, operations[1].native);
    assert.equal(operations[0].native.Message, "Original");
    assert.equal(operations[1].native.Message, "Modificado");
    call("CERRAR", "v");
    assert.deepEqual(await Promise.all([first, second]), [-1, -1]);
    await session.waitForIdle();
    assert.ok(operations.every(operation => operation.cancellable.cancelled && operation.completed));
});

test("GUI diálogos: dispose cancela pendientes y los errores de alertas sin espera se observan", async t => {
    const { call, session, operations } = await setup(t);
    call("DIALOGO_ALERTA", "a", "Mensaje"); call("MOSTRAR_ALERTA", "a", null);
    operations.at(-1).complete(new Error("private native error"));
    await assert.rejects(session.waitForIdle(), { code: "CLRS_GUI_NATIVE_OPERATION_FAILED" });
    const other = await setup(t);
    other.call("DIALOGO_ARCHIVO", "f");
    const result = other.call("ABRIR_ARCHIVOS", "f", null);
    await other.session.dispose(); await other.session.dispose();
    assert.deepEqual(await result, []);
    assert.ok(other.operations.every(operation => operation.cancellable.cancelled));
});

test("GUI diálogos: esquemas GTK ausentes fallan antes de abrir, sin afectar alertas ni controles", async t => {
    const { call, native, operations } = await setup(t);
    native.binding.default.require("Gio").SettingsSchemaSource.getDefault = () => null;
    call("VENTANA", "v", "Título"); call("DIALOGO_ARCHIVO", "f"); call("DIALOGO_ALERTA", "a", "Mensaje");
    for (const action of ["ABRIR_ARCHIVO", "ABRIR_ARCHIVOS", "GUARDAR_ARCHIVO", "ELEGIR_CARPETA", "ELEGIR_CARPETAS"]) {
        assert.throws(() => call(action, "f", null), { code: "CLRS_GUI_DIALOG_RESOURCES_UNAVAILABLE" });
    }
    assert.equal(operations.length, 0);
    const result = call("ELEGIR_ALERTA", "a", "v");
    operations.at(-1).complete(null, 0); assert.equal(await result, 0);
});

test("GUI diálogos: fallo de callback desbloquea la espera principal y conserva el primer error", async t => {
    const { call, native, session } = await setup(t);
    native.Gtk.Button = class extends native.Gtk.Box {};
    call("VENTANA", "v", "Título"); call("BOTON", "b", "Falla"); call("DIALOGO_ALERTA", "a", "Mensaje");
    const error = new Error("Fallo del usuario");
    call("CONECTAR", "b", "clic", createGuiCallbackReference(async () => { throw error; }, false));
    const awaited = call("ELEGIR_ALERTA", "a", "v");
    native.all[1].emit("clicked");
    assert.equal(await awaited, -1);
    await assert.rejects(session.waitForIdle(), thrown => thrown === error);
    assert.throws(() => call("OBTENER_TEMA"), thrown => thrown === error);
});
