import test from "node:test";
import assert from "node:assert/strict";
import { createGuiModelsAdapter } from "../src/standard-library/gui/runtime/GuiModelsAdapter.js";
import { createGuiControlsAdapter } from "../src/standard-library/gui/runtime/GuiControlsAdapter.js";
import { GuiContractError } from "../src/standard-library/gui/GuiErrors.js";
import { getGuiRuntimeFactorySource } from "../src/standard-library/gui/runtime/GuiRuntimeSource.js";
import { fakeModels } from "./fixtures/gui/FakeModels.js";
import { fakeGtk } from "./fixtures/gui/FakeGtk.js";

const fail = code => { throw new GuiContractError(code); };
function setup() {
    const fake = fakeModels();
    const adapter = createGuiModelsAdapter({ ...fake, fail });
    const make = (type, args) => ({ type, id: type, children: new Set(["a", "b", "c"]),
        ...adapter.create(type, [type, ...args]) });
    return { ...fake, adapter, make,
        read: (record, name) => adapter.property(record, name, undefined, false).value,
        write: (record, name, value) => adapter.property(record, name, value, true),
        action: (record, name, ...args) => adapter.action(record, name, [record.id, ...args]) };
}

test("GUI controles: DropDown conserva opciones e índices públicos con selección vacía real", () => {
    const { make, read, write } = setup();
    const options = ["", "Pera", "Uva"];
    const record = make("DropDown", [options]);
    options[1] = "Cambio externo";
    assert.deepEqual(read(record, "opciones"), ["", "Pera", "Uva"]);
    assert.equal(read(record, "seleccion"), 0);
    assert.equal(read(record, "valor"), "");
    write(record, "seleccion", 2); assert.equal(read(record, "valor"), "Uva");
    write(record, "seleccion", -1);
    assert.equal(read(record, "seleccion"), -1); assert.equal(read(record, "valor"), null);
    assert.equal(record.native.getSelected(), 0); // Fila privada en GTK, no una selección ficticia en CLRS.
    assert.throws(() => write(record, "seleccion", 3), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
    write(record, "seleccion", 1); write(record, "opciones", ["A", "B"]);
    assert.equal(read(record, "valor"), "B");
    write(record, "opciones", ["A"]); assert.equal(read(record, "seleccion"), -1);
    write(record, "opciones", []); assert.deepEqual(read(record, "opciones"), []);
    assert.equal(read(record, "valor"), null);
});

test("GUI controles: ColumnView copia filas, valida ancho antes de mutar y usa factories reales", () => {
    const { make, read, write, subscriptions } = setup();
    const record = make("ColumnView", [["Texto", "Valor", "Estado"]]);
    const rows = [["<b>Sin markup</b>", null, true]];
    write(record, "datos", rows); rows[0][0] = "Mutación externa";
    const result = read(record, "datos"); result[0][0] = "Mutación devuelta";
    assert.equal(read(record, "datos")[0][0], "<b>Sin markup</b>");
    assert.throws(() => write(record, "datos", [[1]]), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
    assert.throws(() => write(record, "columnas", ["Una"]), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
    assert.deepEqual(read(record, "columnas"), ["Texto", "Valor", "Estado"]);
    for (const [index, expected] of ["<b>Sin markup</b>", "NULO", "Verdadero"].entries()) {
        const factory = record.native.columns[index].factory;
        const item = { setChild(child) { this.child = child; }, getChild() { return this.child; },
            getItem: () => ({ getString: () => record.state.model.getString(0) }) };
        [...factory.callbacks.get("setup")][0](item); [...factory.callbacks.get("bind")][0](item);
        assert.equal(item.child.text, expected);
    }
    const previous = record.native.columns.map(column => column.factory);
    write(record, "columnas", ["A", "B", "C"]);
    assert.equal(subscriptions.size, 6);
    assert.ok(previous.every(factory => [...factory.callbacks.values()].every(set => set.size === 0)));
});

for (const type of ["ColumnView", "ListBox"]) {
    test(`GUI controles: ${type} adapta modos y rechaza selección inválida sin perder la anterior`, () => {
        const { make, read, write } = setup();
        const record = make(type, type === "ColumnView" ? [["Número"]] : []);
        if (type === "ColumnView") { write(record, "datos", [[1], [2], [3]]); }
        write(record, "seleccion", 1);
        assert.throws(() => write(record, "seleccion", 3), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
        assert.equal(read(record, "seleccion"), 1);
        write(record, "modo_seleccion", "multiple"); assert.deepEqual(read(record, "seleccion"), [1]);
        write(record, "seleccion", [2, 0, 2]); assert.deepEqual(read(record, "seleccion"), [0, 2]);
        assert.throws(() => write(record, "seleccion", 0), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
        write(record, "modo_seleccion", "explorar"); write(record, "seleccion", -1);
        assert.equal(read(record, "seleccion"), -1);
        write(record, "modo_seleccion", "ninguno"); assert.equal(read(record, "seleccion"), null);
        assert.throws(() => write(record, "seleccion", 0), { code: "CLRS_GUI_ACTION_NOT_SUPPORTED" });
    });
}

test("GUI controles: acciones de tabla no recrean columnas y limpieza suelta señales/modelos", () => {
    const { make, read, write, action, adapter, subscriptions } = setup();
    const record = make("ColumnView", [["N"]]);
    write(record, "datos", [[1], [2], [3]]); write(record, "seleccion", 2);
    write(record, "datos", [[4]]); assert.equal(read(record, "seleccion"), -1);
    const columns = [...record.native.columns];
    const row = [5]; action(record, "ANEXAR_FILA", row); row[0] = 9;
    assert.deepEqual(read(record, "datos"), [[4], [5]]);
    assert.throws(() => action(record, "ANEXAR_FILA", [1, 2]), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
    assert.throws(() => action(record, "QUITAR_FILA", 2), { code: "CLRS_GUI_INVALID_ARGUMENT" });
    action(record, "QUITAR_FILA", 0); assert.deepEqual(read(record, "datos"), [[5]]);
    action(record, "LIMPIAR_FILAS"); assert.deepEqual(read(record, "datos"), []);
    assert.deepEqual(record.native.columns, columns);
    adapter.dispose(); adapter.dispose();
    assert.equal(subscriptions.size, 0); assert.equal(record.native.model, null);
});

test("GUI controles: QUITAR libera GtkListBoxRow antes de reutilizar el hijo", () => {
    const { make, adapter } = setup();
    const parent = make("ListBox", []);
    const row = { setChild(value) { this.child = value; } };
    adapter.detachListChild(parent, { native: { getParent: () => row } });
    assert.equal(parent.native.removed, row); assert.equal(row.child, null);
});

function controlsSetup() {
    const { Gtk, binding } = fakeGtk();
    const records = new Map();
    const adapter = createGuiControlsAdapter({ Gtk, gi: binding.default, GLib: {}, fail,
        get: id => records.get(id) ?? fail("CLRS_GUI_COMPONENT_NOT_FOUND"),
        createModels: () => ({ property: () => null, action: () => false, release() {}, dispose() {} }) });
    return { adapter, records, read: (record, name) => adapter.property(record, name, undefined, false).value,
        write: (record, name, value) => adapter.property(record, name, value, true) };
}

test("GUI controles: grupos homogéneos, unión transitiva y retirada sin IDs muertos", () => {
    const { adapter, records, read, write } = controlsSetup();
    for (const id of ["a", "b", "c", "d"]) {
        records.set(id, { id, type: id === "d" ? "ToggleButton" : "CheckButton", native: { setGroup(value) { this.group = value; } } });
    }
    const [a, b, c] = ["a", "b", "c"].map(id => records.get(id));
    write(b, "grupo", "a"); write(c, "grupo", "b");
    assert.equal(read(b, "grupo"), "a");
    assert.throws(() => write(a, "grupo", "d"), { code: "CLRS_GUI_WRONG_COMPONENT_TYPE" });
    assert.throws(() => write(a, "grupo", "a"), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
    adapter.release(a); assert.equal(read(b, "grupo"), "c");
    write(b, "grupo", null); assert.equal(read(c, "grupo"), null); assert.equal(read(b, "grupo"), null);
});

test("GUI controles: límites de rango coherentes antes de mutar y precisión nativa", () => {
    const { read, write } = controlsSetup();
    const native = { lower: 0, upper: 10, step: 1, page: 5, getAdjustment() { return this; },
        getLower() { return this.lower; }, getUpper() { return this.upper; }, getStepIncrement() { return this.step; },
        getPageIncrement() { return this.page; }, setRange(a, b) { this.lower = a; this.upper = b; },
        setIncrements(step, page) { this.step = step; this.page = page; } };
    const record = { type: "Scale", native };
    write(record, "minimo", 10); assert.equal(read(record, "minimo"), 10);
    assert.throws(() => write(record, "maximo", 9), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
    assert.equal(read(record, "maximo"), 10);
    write(record, "paso", 0.5); assert.equal(native.page, 5); assert.equal(read(record, "paso"), 0.5);
    assert.throws(() => write(record, "decimales", 65), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
    assert.throws(() => write({ type: "SpinButton", native }, "decimales", 21), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
});

test("GUI controles: TextView usa su buffer y conserva saltos, Unicode y texto literal", () => {
    const { read, write } = controlsSetup();
    const buffer = { text: "", setText(text, size) { this.text = text; assert.equal(size, -1); },
        getBounds: () => ["start", "end"], getText(start, end, hidden) {
            assert.deepEqual([start, end, hidden], ["start", "end", true]); return this.text;
        } };
    const record = { type: "TextView", native: { getBuffer: () => buffer } };
    write(record, "texto", "<b>á</b>\nSegunda línea"); assert.equal(read(record, "texto"), "<b>á</b>\nSegunda línea");
});

test("GUI controles: error inicial del adaptador libera hold y loop sin exponer detalles", async () => {
    const native = fakeGtk();
    const requireNative = native.binding.default.require;
    native.binding.default.require = (name, version) => {
        if (name === "Pango") { throw new Error("private-path"); }
        return requireNative(name, version);
    };
    const factory = Function(`return (${getGuiRuntimeFactorySource()})`)();
    await assert.rejects(factory(native.binding, {}), error => error.code === "CLRS_GUI_NATIVE_OPERATION_FAILED"
        && !error.message.includes("private"));
    assert.equal(native.apps[0].holds, 0); assert.equal(native.apps[0].quitCalled, true);
    assert.equal(native.apps[0].signals.size, 0);
});
