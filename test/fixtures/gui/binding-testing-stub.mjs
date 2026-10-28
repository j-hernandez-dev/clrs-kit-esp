// GTK doble exclusivo del corpus: el runtime, el generador y Node son reales.
import { fakeGtk } from "./FakeGtk.js";
import { fakeDialogs } from "./FakeDialogs.js";
const native = fakeGtk(), dialogs = fakeDialogs();
Object.assign(native.Gtk, dialogs.Gtk, {
    getMajorVersion: () => 4, getMinorVersion: () => 10, getMicroVersion: () => 0,
    Entry: class extends native.Gtk.Box {
        text = "";
        getText() { return this.text; }
        setText(value) { this.text = value; this.emit("changed"); }
    }
});
Object.assign(native.binding.default.require("Gio"), dialogs.Gio);
native.binding.default.getGType = dialogs.gi.getGType;
// Cancelación determinista vía la API del doble, no interacción inventada en CLRS.
const start = native.Gtk.FileDialog.prototype.start;
native.Gtk.FileDialog.prototype.start = function(...args) {
    start.apply(this, args);
    if (this.Title === "pendiente") { return; }
    const operation = dialogs.operations.at(-1);
    queueMicrotask(() => operation.complete(Object.assign(new Error("cancelado"), { domain: 10, code: 2 })));
};
const quit = native.Gtk.Application.prototype.quit;
native.Gtk.Application.prototype.quit = function() {
    if (this.getWindows().length || dialogs.operations.some(operation => !operation.completed)) {
        throw new Error("Recursos de la prueba GUI retenidos");
    }
    quit.call(this);
};
export default native.binding.default;
