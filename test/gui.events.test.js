import test from "node:test";
import assert from "node:assert/strict";
import { GUI_COMPONENTS } from "../src/standard-library/gui/GuiComponentCatalog.js";
import { isGuiValueInDomain } from "../src/standard-library/gui/GuiContractValidation.js";
import { GuiContractError } from "../src/standard-library/gui/GuiErrors.js";
import { createGuiEventsAdapter } from "../src/standard-library/gui/runtime/GuiEventsAdapter.js";
import { createGuiEventLoop } from "../src/standard-library/gui/runtime/GuiEventLoop.js";
import { createGuiCallbackReference, invokeGuiCallback } from "../src/compiler/gui/GuiCallbackBridge.js";
import { fakeGtk } from "./fixtures/gui/FakeGtk.js";
import { getGuiRuntimeFactorySource } from "../src/standard-library/gui/runtime/GuiRuntimeSource.js";

class Signals {
    listeners = new Map();
    connect(name, callback) {
        const token = Symbol(); this.listeners.set(token, { name, callback }); return token;
    }
    disconnect(token) { this.listeners.delete(token); }
    emit(name, ...args) {
        let value;
        for (const entry of [...this.listeners.values()]) {
            if (entry.name === name) { value = entry.callback(...args); if (value === true) { break; } }
        }
        return value;
    }
    controllers = [];
    addController(controller) { this.controllers.push(controller); }
    removeController(controller) { this.controllers.splice(this.controllers.indexOf(controller), 1); }
    setButton(button) { this.button = button; }
    getCurrentButton() { return 3; }
    getBuffer() { return this.buffer ??= new Signals(); }
    getModel() { return this.model ??= new Signals(); }
}
function infrastructure() {
    const results = [], failures = [], connected = [];
    const Gtk = { EventControllerMotion: Signals, GestureClick: Signals, EventControllerKey: Signals,
        PositionType: { LEFT: 0, RIGHT: 1, TOP: 2, BOTTOM: 3 } };
    const Gdk = { keyvalName: key => key === 97 ? "a" : null, ModifierType: { SHIFT_MASK: 1, CONTROL_MASK: 4, ALT_MASK: 8 } };
    const adapter = createGuiEventsAdapter({ Gtk, gi: { require: () => Gdk },
        connect(object, signal, callback) {
            const token = object.connect(signal, callback); connected.push({ object, signal });
            return () => object.disconnect(token);
        },
        read: (record, name) => record.values[name],
        fail: code => { throw new GuiContractError(code); },
        dispatch(_reference, record, args, immediate) { results.push([record.id, ...args]); return immediate; },
        reportFailure: error => failures.push(error), isGuiValueInDomain
    });
    const record = type => ({ type, id: "original", native: new Signals(), live: true,
        values: { texto: "Hola", activo: false, valor: 5, uri: "https://example.invalid", fecha: [2024, 2, 29],
            seleccion: type === "DropDown" ? -1 : [0, 2], datos: [[1, "a"], [false, null]] } });
    const on = (r, name, sync = true) => adapter.connect(r, name, createGuiCallbackReference(() => {}, sync), GUI_COMPONENTS[r.type].events[name]);
    return { adapter, results, failures, connected, record, on };
}

test("GUI eventos: todos los eventos del catálogo tienen conexión implementada y limpieza", () => {
    for (const [type, component] of Object.entries(GUI_COMPONENTS)) {
        for (const name of Object.keys(component.events)) {
            const { adapter, on, record, failures, connected } = infrastructure();
            const r = record(type);
            on(r, name);
            assert.ok(connected.length > 0, `${type}.${name}`);
            assert.deepEqual(failures, []);
            adapter.dispose();
            assert.equal(r.native.controllers.length, 0);
            for (const { object } of connected) { assert.equal(object.listeners.size, 0, `${type}.${name}`); }
        }
    }
});

test("GUI eventos: normaliza puntero, gestos, teclas y bordes sin entregar objetos GTK", () => {
    const { record, on, results, failures } = infrastructure();
    const r = record("ScrolledWindow");
    on(r, "puntero_entro"); on(r, "presionado"); on(r, "tecla_presionada"); on(r, "borde_alcanzado");
    assert.equal(r.native.controllers[0].emit("enter", 1.5, 2), undefined);
    assert.equal(r.native.controllers[1].button, 0);
    assert.equal(r.native.controllers[1].emit("pressed", 2, 4, 5), undefined);
    assert.equal(r.native.controllers[2].emit("key-pressed", 97, 38, 5), true);
    r.native.emit("edge-reached", 3);
    assert.deepEqual(results, [["original", 1.5, 2], ["original", 2, 4, 5, 3],
        ["original", "a", 38, ["shift", "control"]], ["original", "abajo"]]);
    assert.deepEqual(failures, []);
});

test("GUI eventos: los tres eventos inmediatos rechazan callbacks async antes de conectar", () => {
    for (const [type, event] of [["Window", "cerrar"], ["LinkButton", "activar_enlace"], ["Entry", "tecla_presionada"]]) {
        const { record, on, connected } = infrastructure();
        assert.throws(() => on(record(type), event, false), { code: "CLRS_GUI_CALLBACK_REQUIRES_SYNC" });
        assert.equal(connected.length, 0);
    }
});

test("GUI eventos: modelo, buffer, fecha y filas producen instantáneas y eliminan avisos duplicados", () => {
    const { record, on, results, adapter, failures } = infrastructure();
    const text = record("TextView"); on(text, "cambio");
    text.values.texto = "Nuevo"; text.native.getBuffer().emit("changed");
    const calendar = record("Calendar"); on(calendar, "fecha_cambiada");
    calendar.values.fecha = [2025, 1, 1]; calendar.native.emit("next-year"); calendar.native.emit("day-selected");
    calendar.values.fecha[0] = 9999;
    const list = record("ListBox"); on(list, "seleccion_cambiada"); on(list, "fila_activada");
    adapter.begin(); list.values.seleccion = []; list.native.emit("row-selected", null);
    list.values.seleccion = [1]; list.native.emit("selected-rows-changed"); adapter.end();
    list.native.emit("row-activated", { getIndex: () => 1 });
    const table = record("ColumnView"); on(table, "fila_activada"); on(table, "seleccion_cambiada");
    table.native.emit("activate", 1); table.values.datos[1][0] = true;
    const previous = table.native.getModel(); table.native.model = new Signals();
    table.values.seleccion = []; table.native.emit("notify::model");
    assert.equal(previous.listeners.size, 0);
    table.values.seleccion = [1]; table.native.model.emit("selection-changed", 0, 2);
    assert.deepEqual(results, [["original", "Nuevo"], ["original", [2025, 1, 1]], ["original", [1]],
        ["original", 1], ["original", 1, [false, null]], ["original", []], ["original", [1]]]);
    assert.deepEqual(failures, []);
});

test("GUI callbacks: vida pendiente tras cerrar ventana, errores localizados y sin unhandledRejection", async t => {
    const native = fakeGtk();
    native.Gtk.Button = class extends native.Gtk.Box { getLabel() { return this.label; } };
    const session = await Function(`return (${getGuiRuntimeFactorySource()})`)()(native.binding, { invokeCallback: invokeGuiCallback });
    t.after(() => session.dispose());
    const call = (name, ...args) => session.invoke(name, args);
    call("VENTANA", "v", ""); call("BOTON", "b", "Acción"); call("CONTENER", "v", "b");
    let resume, entered;
    const started = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { resume = resolve; });
    const error = new Error("Fallo del programa");
    const location = { line: 17, column: 3 };
    call("CONECTAR", "b", "clic", createGuiCallbackReference(async () => { entered(); await gate; throw error; }, false, location));
    native.all[1].emit("clicked"); await started;
    call("CERRAR", "v");
    let ended = false;
    const idle = session.waitForIdle(); idle.then(() => { ended = true; }, () => { ended = true; });
    await Promise.resolve(); assert.equal(ended, false);
    resume(); await assert.rejects(idle, thrown => thrown === error && thrown.location === location);
    assert.equal(native.all[1].signals.size, 0);
});

test("GUI loop: iteración no bloqueante acotada y sin fuentes después de detener", async () => {
    let iterations = 0;
    const stop = createGuiEventLoop({ MainContext: { default: () => ({ iteration(block) {
        assert.equal(block, false); iterations++; return true;
    } }) } }, assert.fail);
    await new Promise(resolve => setTimeout(resolve, 3));
    stop();
    assert.ok(iterations > 0 && iterations <= 32);
    const count = iterations;
    await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(iterations, count);
});
