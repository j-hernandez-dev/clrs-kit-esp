/** Modelos GTK reales; copias de valores CLRS, sin widgets de celda públicos. */
export function createGuiModelsAdapter({ Gtk, fail, connect }) {
    const invalid = Gtk.INVALID_LIST_POSITION ?? 0xffffffff;
    const modes = { ninguno: Gtk.SelectionMode.NONE, unica: Gtk.SelectionMode.SINGLE,
        explorar: Gtk.SelectionMode.BROWSE, multiple: Gtk.SelectionMode.MULTIPLE };
    const cloneRows = rows => rows.map(row => [...row]);
    const validateRows = (rows, width) => {
        if (rows.some(row => row.length !== width)) { fail("CLRS_GUI_INVALID_PROPERTY_VALUE"); }
    };
    const states = new Set();
    const release = state => {
        if (!states.has(state)) { return; }
        state.native.setModel(null);
        for (const entry of state.columns) { entry.unsubscribe.forEach(stop => stop()); }
        state.columns = []; state.model = null; state.selection = null;
        states.delete(state);
    };
    const modeOf = record => record.type === "ListBox"
        ? Object.keys(modes).find(key => modes[key] === record.native.getSelectionMode()) : record.state.mode;
    const count = record => record.type === "ListBox" ? record.children.size : record.state.model.getNItems();
    const readSelection = record => {
        const mode = modeOf(record);
        if (mode === "ninguno") { return null; }
        if (record.type === "ListBox") {
            if (mode === "multiple") { return record.native.getSelectedRows().map(row => row.getIndex()).sort((a, b) => a - b); }
            return record.native.getSelectedRow()?.getIndex() ?? -1;
        }
        const selection = record.state.selection;
        if (mode !== "multiple") { const index = selection.getSelected(); return index === invalid ? -1 : index; }
        const indices = [];
        for (let index = 0; index < count(record); index++) { if (selection.isSelected(index)) { indices.push(index); } }
        return indices;
    };
    const writeSelection = (record, value) => {
        const mode = modeOf(record);
        if (mode === "ninguno") { fail("CLRS_GUI_ACTION_NOT_SUPPORTED"); }
        if (mode === "multiple" ? !Array.isArray(value) : !Number.isInteger(value)) { fail("CLRS_GUI_INVALID_PROPERTY_VALUE"); }
        const indices = mode === "multiple" ? [...new Set(value)] : value === -1 ? [] : [value];
        if (indices.some(index => !Number.isInteger(index) || index < 0 || index >= count(record))) {
            fail("CLRS_GUI_INVALID_PROPERTY_VALUE");
        }
        if (record.type === "ListBox") {
            if (mode === "explorar" && indices.length === 0) { record.native.setSelectionMode(modes.unica); }
            record.native.unselectAll();
            for (const index of indices) { record.native.selectRow(record.native.getRowAtIndex(index)); }
            if (mode === "explorar" && indices.length === 0) { record.native.setSelectionMode(modes.explorar); }
        } else if (mode !== "multiple") { record.state.selection.setSelected(indices[0] ?? invalid); }
        else {
            record.state.selection.unselectAll();
            for (const index of indices) { record.state.selection.selectItem(index, false); }
        }
    };
    const buildSelection = (model, mode) => {
        if (mode === "ninguno") { return Gtk.NoSelection.new(model); }
        if (mode === "multiple") { return Gtk.MultiSelection.new(model); }
        const selection = Gtk.SingleSelection.new(model);
        selection.setAutoselect(false);
        selection.setCanUnselect(true); // El contrato CLRS acepta -1 también en explorar.
        if (mode === "unica") { selection.setSelected(invalid); }
        return selection;
    };
    const rebuildColumns = (state, titles) => {
        const next = titles.map((title, index) => {
            const factory = new Gtk.SignalListItemFactory();
            const unsubscribe = [
                connect(factory, "setup", item => item.setChild(new Gtk.Label())),
                connect(factory, "bind", item => {
                    const row = JSON.parse(item.getItem().getString());
                    const value = row[index];
                    // La proyección textual mantiene valores escalares, no interpreta markup.
                    item.getChild().setText(value === null ? "NULO" : typeof value === "boolean"
                        ? value ? "Verdadero" : "Falso" : String(value));
                })
            ];
            return { column: Gtk.ColumnViewColumn.new(title, factory), unsubscribe };
        });
        for (const previous of state.columns) {
            state.native.removeColumn(previous.column);
            previous.unsubscribe.forEach(stop => stop());
        }
        for (const entry of next) { state.native.appendColumn(entry.column); }
        state.columns = next;
        state.titles = [...titles];
    };
    return {
        create(type, args) {
            if (type === "ListBox") { return { native: new Gtk.ListBox(), state: {} }; }
            // GtkDropDown no permite deseleccionar su SingleSelection interno en GTK 4.22.
            // La fila vacía privada ofrece ese estado sin alterar opciones/índices públicos.
            const model = Gtk.StringList.new(type === "DropDown" ? ["", ...args[1]] : []);
            if (type === "DropDown") {
                const native = Gtk.DropDown.new(model, null);
                native.setSelected(args[1].length ? 1 : 0);
                return { native, state: { model } };
            }
            const selection = buildSelection(model, "unica");
            const native = Gtk.ColumnView.new(selection);
            const state = { model, selection, native, mode: "unica", columns: [], titles: [] };
            states.add(state);
            rebuildColumns(state, args[1]);
            return { native, state };
        },
        property(record, name, value, write) {
            const { native, state } = record;
            if (record.type === "DropDown") {
                if (name === "opciones") {
                    if (!write) { return { value: Array.from({ length: state.model.getNItems() - 1 }, (_, i) => state.model.getString(i + 1)) }; }
                    const previous = native.getSelected();
                    state.model.splice(0, state.model.getNItems(), ["", ...value]);
                    native.setSelected(previous <= value.length ? previous : 0);
                } else if (name === "seleccion") {
                    if (!write) { return { value: native.getSelected() === invalid ? -1 : native.getSelected() - 1 }; }
                    if (value < -1 || value >= state.model.getNItems() - 1) { fail("CLRS_GUI_INVALID_PROPERTY_VALUE"); }
                    native.setSelected(value + 1);
                } else if (name === "valor") {
                    const index = native.getSelected();
                    return { value: index === invalid || index === 0 ? null : state.model.getString(index) };
                } else { return null; }
                return { value: undefined };
            }
            if (name === "seleccion") {
                if (!write) { return { value: readSelection(record) }; }
                writeSelection(record, value);
            } else if (name === "modo_seleccion") {
                if (!write) { return { value: modeOf(record) }; }
                const old = readSelection(record);
                if (record.type === "ListBox") { native.setSelectionMode(modes[value]); }
                else {
                    const replacement = buildSelection(state.model, value);
                    native.setModel(replacement); state.selection = replacement; state.mode = value;
                }
                if (value !== "ninguno") {
                    const previous = (Array.isArray(old) ? old : old === null || old === -1 ? [] : [old]).filter(i => i < count(record));
                    writeSelection(record, value === "multiple" ? previous : previous[0] ?? -1);
                }
            } else if (record.type === "ColumnView" && name === "datos") {
                if (!write) { return { value: Array.from({ length: state.model.getNItems() }, (_, i) => JSON.parse(state.model.getString(i))) }; }
                validateRows(value, state.titles.length);
                const previous = readSelection(record);
                state.model.splice(0, state.model.getNItems(), cloneRows(value).map(row => JSON.stringify(row)));
                if (state.mode !== "ninguno") {
                    writeSelection(record, state.mode === "multiple" ? previous.filter(i => i < value.length)
                        : previous < value.length ? previous : -1);
                }
            } else if (record.type === "ColumnView" && name === "columnas") {
                if (!write) { return { value: [...state.titles] }; }
                for (let i = 0; i < state.model.getNItems(); i++) {
                    validateRows([JSON.parse(state.model.getString(i))], value.length);
                }
                rebuildColumns(state, value);
            } else { return null; }
            return { value: undefined };
        },
        action(record, name, args) {
            if (record.type !== "ColumnView") { return false; }
            const state = record.state;
            if (name === "ANEXAR_FILA") {
                validateRows([args[1]], state.titles.length); state.model.append(JSON.stringify([...args[1]]));
            } else if (name === "QUITAR_FILA") {
                if (args[1] >= state.model.getNItems()) { fail("CLRS_GUI_INVALID_ARGUMENT"); }
                state.model.remove(args[1]);
            } else if (name === "LIMPIAR_FILAS") { state.model.splice(0, state.model.getNItems(), []); }
            else { return false; }
            return true;
        },
        detachListChild(parent, child) {
            // GtkListBoxRow se retira primero; después se libera su hijo para poder reanexarlo.
            const row = child.native.getParent();
            parent.native.remove(row);
            row.setChild(null);
        },
        release(record) { if (record.type === "ColumnView") { release(record.state); } },
        dispose() { for (const state of states) { release(state); } }
    };
}
