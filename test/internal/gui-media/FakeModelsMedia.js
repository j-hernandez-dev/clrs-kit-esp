// Dobles de frontera: no sustituyen los ensayos GTK nativos.
export function fakeModelsMedia() {
    const invalid = 0xffffffff;
    const subscriptions = new Set();
    class Signals {
        callbacks = new Map();
        connect(signal, callback) { return connect(this, signal, callback); }
        disconnect(disconnect) { disconnect(); }
        emit(name) { for (const callback of this.callbacks.get(name) ?? []) { callback(); } }
    }
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
    class Media extends Signals {
        prepared = false; seekable = true; timestamp = 0n; duration = 3000000n;
        error = null; playing = false; ended = false; volume = 1; muted = false; loop = false;
        writes = [];
        prepare() { this.prepared = true; this.emit("notify::prepared"); }
        isPrepared() { return this.prepared; }
        isSeekable() { return this.seekable; }
        getTimestamp() { return this.timestamp; }
        getDuration() { return this.duration; }
        getError() { return this.error; }
        getPlaying() { return this.playing; }
        getEnded() { return this.ended; }
        getVolume() { return this.volume; }
        getMuted() { return this.muted; }
        setVolume(value) { this.writes.push("volume"); this.volume = value; }
        setMuted(value) { this.writes.push("muted"); this.muted = value; }
        setLoop(value) { this.writes.push("loop"); this.loop = value; }
        play() { this.playing = true; }
        pause() { this.playing = false; }
        seek(micros) { this.timestamp = micros; }
    }
    const videos = [];
    class Video extends Signals {
        constructor() { super(); videos.push(this); }
        loop = false; autoplay = false; media = null;
        setFile(file) { this.file = file; this.media = file ? new Media() : null; this.emit("notify::media-stream"); }
        getMediaStream() { return this.media; }
        getLoop() { return this.loop; }
        setLoop(value) { this.loop = value; }
        setAutoplay(value) { this.autoplay = value; }
        getAutoplay() { return this.autoplay; }
    }
    class GtkGstMediaFileBuiltin {}
    const backend = { available: true, imports: 0 };
    const Gst = { initCheck: () => [true, []], ElementFactory: { find: () => backend.available ? {} : null } };
    return {
        Gtk: {
            INVALID_LIST_POSITION: invalid, SelectionMode: { NONE: 0, SINGLE: 1, BROWSE: 2, MULTIPLE: 3 },
            StringList, SingleSelection: Selection, MultiSelection: Selection, NoSelection: Selection,
            ColumnView, DropDown, ListBox, Label, Video, MediaFile: { new: () => new GtkGstMediaFileBuiltin() },
            SignalListItemFactory: class {}, ColumnViewColumn: { new: (title, factory) => ({ title, factory }) }
        },
        Gio: { File: { newForPath: path => ({ path, read: () => ({ close() {} }) }) } },
        verifyMedia() {
            if (backend.checked) { return; }
            backend.imports++;
            if (!backend.available) { throw Object.assign(new Error("Backend no disponible"), { code: "CLRS_GUI_MEDIA_BACKEND_UNAVAILABLE" }); }
            backend.checked = true;
        },
        gi: { require(name) { if (name !== "Gst") { throw new Error(name); } backend.imports++; return Gst; } },
        connect, subscriptions, backend, videos
    };
}
