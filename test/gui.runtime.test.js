import test from "node:test";
import assert from "node:assert/strict";
import { fakeGtk } from "./fixtures/gui/FakeGtk.js";
import { getGuiRuntimeFactorySource } from "../src/standard-library/gui/runtime/GuiRuntimeSource.js";
import { GuiRuntimePreparation } from "../src/compiler/gui/GuiRuntimePreparation.js";
import { createGuiCallbackReference, invokeGuiCallback } from "../src/compiler/gui/GuiCallbackBridge.js";
import { build } from "esbuild";
import { fakeModels } from "./fixtures/gui/FakeModels.js";
import { fakeDialogs } from "./fixtures/gui/FakeDialogs.js";

const factory = Function(`return (${getGuiRuntimeFactorySource()})`)();
async function setup(t) {
    const native = fakeGtk();
    const session = await factory(native.binding, { programKey: "private", invokeCallback: invokeGuiCallback });
    t.after(() => session.dispose());
    return { ...native, native, session, call: (name, ...args) => session.invoke(name, args) };
}

test("GUI base: fábrica autocontenida también después del bundling del Host", async () => {
    const result = await build({ entryPoints: ["src/standard-library/gui/runtime/GuiRuntimeSource.js"],
        bundle: true, platform: "node", format: "esm", target: "node22", minifySyntax: true, write: false });
    const bundled = await import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"));
    const native = fakeGtk();
    const models = fakeModels();
    const dialogs = fakeDialogs();
    Object.assign(native.Gtk, dialogs.Gtk);
    Object.assign(native.binding.default.require("Gio"), dialogs.Gio);
    native.binding.default.getGType = dialogs.gi.getGType;
    native.Gtk.DropDown = models.Gtk.DropDown; native.Gtk.StringList = models.Gtk.StringList;
    const session = await Function(`return (${bundled.getGuiRuntimeFactorySource()})`)()(native.binding, { invokeCallback: invokeGuiCallback });
    try {
        session.invoke("VENTANA", ["v", "Título"]);
        assert.equal(session.invoke("OBTENER", ["v", "titulo"]), "Título");
        session.invoke("LISTA_DESPLEGABLE", ["d", ["Uno", "Dos"]]);
        session.invoke("ESTABLECER", ["d", "seleccion", 1]);
        assert.equal(session.invoke("OBTENER", ["d", "valor"]), "Dos");
        assert.throws(() => session.invoke("VENTANA", ["v", ""]), { code: "CLRS_GUI_DUPLICATE_ID" });
        session.invoke("DIALOGO_ALERTA", ["a", "Mensaje"]);
        session.invoke("ESTABLECER", ["a", "botones", ["No", "Sí"]]);
        const chosen = session.invoke("ELEGIR_ALERTA", ["a", "v"]);
        dialogs.operations.at(-1).complete(null, 1);
        assert.equal(await chosen, 1);
        session.invoke("CONECTAR", ["v", "cerrar", createGuiCallbackReference(() => false, true)]);
        session.invoke("CERRAR", ["v"]);
    } finally { await session.dispose(); }
});

test("GUI base: fuente canónica disponible por defecto sin cargar GTK en el Host", async () => {
    const preparation = new GuiRuntimePreparation({ dependencyManager: { ensure: async () => ({ entryUrl: "file:///gtk.mjs" }) } });
    assert.deepEqual(await preparation.prepare({ semanticModel: {} }), {});
    const context = await preparation.prepare({ semanticModel: { gui: { usage: { requiresGui: true } } } });
    assert.equal(context.gui.factorySource, getGuiRuntimeFactorySource());
});

test("GUI base: dos clases de ventana, IDs únicos y registro privado por sesión", async t => {
    const { call, session, apps, Gtk } = await setup(t);
    call("VENTANA", "v", "General"); call("VENTANA_APLICACION", "app", "Integrada");
    assert.ok(apps[0].windows[0] instanceof Gtk.Window);
    assert.ok(apps[0].windows[1] instanceof Gtk.ApplicationWindow);
    assert.throws(() => call("CAJA", "v", "vertical", 0), { code: "CLRS_GUI_DUPLICATE_ID" });
    assert.deepEqual(Object.keys(session).sort(), ["dispose", "invoke", "waitForIdle"]);
    const other = await setup(t);
    assert.throws(() => other.call("MOSTRAR", "v"), { code: "CLRS_GUI_COMPONENT_NOT_FOUND" });
    other.call("VENTANA", "v", "Otro proceso");
    call("CERRAR", "v");
    assert.throws(() => call("MOSTRAR", "v"), { code: "CLRS_GUI_COMPONENT_NOT_FOUND" });
    assert.throws(() => call("VENTANA", "v", "Reuso"), { code: "CLRS_GUI_DUPLICATE_ID" });
});

test("GUI base: propiedades curadas, dominios, enums y tamaño solicitado", async t => {
    const { call, apps } = await setup(t);
    call("VENTANA", "v", "Título");
    call("ESTABLECER", "v", "ancho", 320);
    call("ESTABLECER", "v", "alto", 240);
    assert.deepEqual(apps[0].windows[0].requestedSize, [320, 240]);
    assert.equal(call("OBTENER", "v", "ancho"), 320);
    call("ESTABLECER", "v", "alineacion_horizontal", "rellenar");
    assert.equal(apps[0].windows[0].halign, 0);
    assert.equal(call("OBTENER", "v", "alineacion_horizontal"), "rellenar");
    assert.throws(() => call("ESTABLECER", "v", "activa", false), { code: "CLRS_GUI_PROPERTY_READ_ONLY" });
    assert.throws(() => call("ESTABLECER", "v", "opacidad", 2), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
    assert.throws(() => call("ESTABLECER", "v", "ancho", 2 ** 40), { code: "CLRS_GUI_INVALID_ARGUMENT" });
    for (const name of ["__proto__", "constructor", "application"]) {
        assert.throws(() => call("OBTENER", "v", name), { code: "CLRS_GUI_PROPERTY_NOT_FOUND" });
    }
    assert.equal(call("ENFOCAR", "v"), true);
    call("MAXIMIZAR", "v"); call("PANTALLA_COMPLETA", "v"); call("MINIMIZAR", "v");
    assert.equal(call("OBTENER", "v", "maximizada"), true);
    call("RESTAURAR", "v");
    assert.equal(call("OBTENER", "v", "maximizada"), false);
    assert.equal(call("OBTENER", "v", "pantalla_completa"), false);
});

test("GUI base: contención única/múltiple, orden, cuadrícula, ciclos y retiro explícito", async t => {
    const { call, all } = await setup(t);
    call("VENTANA", "v", ""); call("CAJA", "a", "vertical", 1);
    call("CAJA", "b", "horizontal", 0); call("CUADRICULA", "g");
    call("CONTENEDOR_DESPLAZABLE", "s");
    call("CONTENER", "v", "a"); call("ANEXAR", "a", "b"); call("PREPONER", "a", "g");
    assert.deepEqual(all[1].children, [all[3], all[2]]);
    assert.throws(() => call("CONTENER", "v", "s"), { code: "CLRS_GUI_PARENT_CONFLICT" });
    assert.throws(() => call("ANEXAR", "b", "a"), { code: "CLRS_GUI_PARENT_CONFLICT" });
    assert.throws(() => call("ANEXAR", "b", "b"), { code: "CLRS_GUI_PARENT_CONFLICT" });
    assert.throws(() => call("CONTENER", "s", "v"), { code: "CLRS_GUI_WRONG_COMPONENT_TYPE" });
    assert.throws(() => call("QUITAR", "s", "b"), { code: "CLRS_GUI_CHILD_NOT_FOUND" });
    call("QUITAR", "a", "b"); call("COLOCAR", "g", "b", -1, 2, 3, 4);
    assert.deepEqual(all[2].position, [-1, 2, 3, 4]);
    call("QUITAR", "g", "b"); call("CONTENER", "s", "b");
    call("QUITAR", "s", "b"); call("ANEXAR", "a", "b");
    call("CERRAR", "v");
    assert.throws(() => call("MOSTRAR", "b"), { code: "CLRS_GUI_COMPONENT_NOT_FOUND" });
});

test("GUI base: no impone tema; modo sistema restaura preferencia sin sustituir tema elegido", async t => {
    const { call, native, session } = await setup(t);
    assert.equal(native.writes, 0);
    assert.equal(call("OBTENER_TEMA"), "Tema inicial");
    assert.equal(call("OBTENER_MODO_TEMA"), "sistema");
    call("ESTABLECER_MODO_TEMA", "oscuro"); call("ESTABLECER_TEMA", "Tema elegido");
    call("ESTABLECER_MODO_TEMA", "claro"); call("ESTABLECER_MODO_TEMA", "sistema");
    assert.equal(native.theme.gtkApplicationPreferDarkTheme, false);
    assert.equal(call("OBTENER_TEMA"), "Tema elegido");
    assert.throws(() => call("ESTABLECER_TEMA", ""), { code: "CLRS_GUI_INVALID_THEME_NAME" });
    assert.throws(() => call("ESTABLECER_MODO_TEMA", "auto"), { code: "CLRS_GUI_INVALID_THEME_MODE" });
    await session.waitForIdle(); await session.dispose();
    assert.equal(native.theme.gtkThemeName, "Tema inicial");
});

test("GUI base: ocultar no destruye y sólo la última ventana permite terminar", async t => {
    const { call, session, apps } = await setup(t);
    call("VENTANA", "a", "A"); call("VENTANA", "b", "B");
    call("MOSTRAR", "a"); call("OCULTAR", "a");
    let ended = false;
    const idle = session.waitForIdle().then(() => { ended = true; });
    await Promise.resolve(); assert.equal(ended, false);
    call("CERRAR", "b"); await Promise.resolve(); assert.equal(ended, false);
    call("ESTABLECER", "a", "ocultar_al_cerrar", true); call("CERRAR", "a");
    assert.equal(apps[0].getWindows().length, 1);
    call("ESTABLECER", "a", "ocultar_al_cerrar", false); call("CERRAR", "a");
    await idle; assert.equal(ended, true);
});

test("GUI base: una ventana retirada por GTK fuera de CERRAR invalida también sus hijos", async t => {
    const { call, apps, session } = await setup(t);
    call("VENTANA_APLICACION", "v", ""); call("CAJA", "c", "vertical", 0); call("CONTENER", "v", "c");
    apps[0].windows[0].destroy();
    await session.waitForIdle();
    assert.throws(() => call("MOSTRAR", "c"), { code: "CLRS_GUI_COMPONENT_NOT_FOUND" });
});

test("GUI base: callback cerrar inmediato, rechazo de async y propagación del fallo", async t => {
    const { call, session, apps } = await setup(t);
    call("VENTANA", "v", "");
    assert.throws(() => call("CONECTAR", "v", "cerrar", createGuiCallbackReference(async () => false, false)),
        { code: "CLRS_GUI_CALLBACK_REQUIRES_SYNC" });
    let veto = true;
    const failure = new Error("Fallo de usuario");
    call("CONECTAR", "v", "cerrar", createGuiCallbackReference(id => {
        assert.equal(id, "v"); if (veto) { return true; } throw failure;
    }, true));
    call("CERRAR", "v"); assert.equal(apps[0].windows.length, 1);
    veto = false; call("CERRAR", "v");
    await assert.rejects(session.waitForIdle(), error => error === failure);
    await session.dispose();
    assert.equal(apps[0].windows.length, 0);
});

test("GUI base: limpieza idempotente sin tocar tema no modificado y sin señales retenidas", async t => {
    const { call, session, native } = await setup(t);
    call("VENTANA", "v", ""); call("CAJA", "b", "vertical", 0); call("CONTENER", "v", "b");
    call("CONECTAR", "v", "cerrar", createGuiCallbackReference(() => true, true));
    await session.dispose(); await session.dispose(); await session.waitForIdle();
    assert.equal(native.writes, 0);
    assert.equal(native.apps[0].holds, 0);
    assert.equal(native.apps[0].signals.size, 0);
    assert.ok(native.all.every(widget => widget.signals.size === 0));
    assert.equal(native.apps[0].quitCalled, true);
    assert.throws(() => call("OBTENER_TEMA"), { code: "CLRS_GUI_RUNTIME_CLOSED" });
});

test("GUI base: errores nativos sin filtrar objetos", async t => {
    const { call, apps } = await setup(t);
    call("VENTANA", "v", "");
    apps[0].windows[0].present = () => { throw new Error("private native details"); };
    assert.throws(() => call("MOSTRAR", "v"), error => error.code === "CLRS_GUI_NATIVE_OPERATION_FAILED"
        && !error.message.includes("private"));
});

test("GUI base: restricciones GTK se validan antes de modificar contención o tamaño", async t => {
    const { call } = await setup(t);
    call("CONTENEDOR_DESPLAZABLE", "s"); call("CUADRICULA", "g"); call("CAJA", "c", "vertical", 0);
    call("ESTABLECER", "s", "ancho_contenido_maximo", 100);
    assert.throws(() => call("ESTABLECER", "s", "ancho_contenido_minimo", 200), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
    assert.equal(call("OBTENER", "s", "ancho_contenido_minimo"), -1);
    call("ESTABLECER", "s", "ancho_contenido_minimo", 50);
    assert.throws(() => call("ESTABLECER", "s", "ancho_contenido_maximo", 30), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
    call("ESTABLECER", "s", "ancho_contenido_maximo", -1);
    assert.throws(() => call("COLOCAR", "g", "c", 2147483647, 0, 1, 1), { code: "CLRS_GUI_INVALID_ARGUMENT" });
    call("CONTENER", "s", "c"); // El rechazo previo no dejó un padre lógico fantasma.
});

test("GUI base: fallo de bootstrap usa el canal público sin exponer el binding", async () => {
    await assert.rejects(factory({ default: { require() { throw new Error("binding-private-location"); } } }, {}),
        error => error.name === "CLRSUserError" && error.code === "CLRS_GUI_NATIVE_OPERATION_FAILED"
            && !error.message.includes("private"));
});
