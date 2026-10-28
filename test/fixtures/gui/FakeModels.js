// Dobles de frontera: no sustituyen los ensayos GTK nativos.
export function fakeModels() {
    const invalid = 0xffffffff;
    const subscriptions = new Set();
    const connect = (object, signal, callback) => {
        const entry = { object, signal, callback };
        subscriptions.add(entry);
        if (!object.callbacks) { object.callbacks = new Map(); }
        const listeners = object.callbacks.get(signal) ?? new Set();
        listeners.add(callback); object.callbacks.set(signal, listeners);
        return () => { subscriptions.delete(entry); listeners.delete(callback); };
    };
    class StringList {
        static new(values) { return new StringList(values); }
        constructor(values) { this.values = [...values]; }
        getNItems() { return this.values.length; }
        getString(i) { return this.values[i]; }
        splice(start, count, values) { this.values.splice(start, count, ...values); }
        append(value) { this.values.push(value); }
        remove(i) { this.values.splice(i, 1); }
    }
    class Selection {
        static new(model) { return new this(model); }
        constructor(model) { this.model = model; this.selected = model.getNItems() ? 0 : invalid; this.indices = new Set(); }
        setAutoselect(value) { this.auto = value; }
        setCanUnselect(value) { this.canUnselect = value; }
        setSelected(index) { this.selected = index; }
        getSelected() { return this.selected; }
        isSelected(index) { return this.indices.has(index); }
        selectItem(index) { this.indices.add(index); }
        unselectAll() { this.indices.clear(); }
    }
    class ColumnView {
        static new(model) { const view = new ColumnView(); view.setModel(model); return view; }
        columns = [];
        setModel(model) { this.model = model; }
        appendColumn(column) { this.columns.push(column); }
        removeColumn(column) { this.columns.splice(this.columns.indexOf(column), 1); }
    }
    class DropDown {
        static new(model) { const view = new DropDown(); view.model = model; view.selected = 0; return view; }
        // GTK 4.22 no deselecciona el SingleSelection interno con INVALID.
        setSelected(index) { if (index < this.model.getNItems()) { this.selected = index; } }
        getSelected() { return this.selected; }
    }
    class ListBox {
        mode = 1;
        selected = new Set();
        rows = [0, 1, 2].map(index => ({ getIndex: () => index }));
        getSelectionMode() { return this.mode; }
        setSelectionMode(mode) { this.mode = mode; }
        getSelectedRows() { return [...this.selected].map(i => this.rows[i]); }
        getSelectedRow() { return this.getSelectedRows()[0] ?? null; }
        getRowAtIndex(i) { return this.rows[i]; }
        unselectAll() { if (this.mode !== 2) { this.selected.clear(); } }
        selectRow(row) { if (this.mode !== 3) { this.selected.clear(); } this.selected.add(row.getIndex()); }
        remove(row) { this.removed = row; }
    }
    class Label { setText(text) { this.text = text; } }
    return {
        Gtk: {
            INVALID_LIST_POSITION: invalid, SelectionMode: { NONE: 0, SINGLE: 1, BROWSE: 2, MULTIPLE: 3 },
            StringList, SingleSelection: Selection, MultiSelection: Selection, NoSelection: Selection,
            ColumnView, DropDown, ListBox, Label,
            SignalListItemFactory: class {}, ColumnViewColumn: { new: (title, factory) => ({ title, factory }) }
        },
        Gio: { File: { newForPath: path => ({ path, read: () => ({ close() {} }) }) } },
        connect, subscriptions
    };
}
