// Doble GTK opt-in para el corpus DAP. Sólo el proceso depurado lo importa.
import { readFileSync } from "node:fs";
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
let sequence = 0;
// No se despachan eventos automáticamente: la prueba decide su orden exacto.
const timer = setInterval(() => {
    try {
        const action = JSON.parse(readFileSync(process.env.CLRS_GUI_TEST_ACTION_FILE, "utf8"));
        if (action.sequence <= sequence) { return; }
        if (action.type === "text") { native.all.find(x => x instanceof native.Gtk.Entry).setText(action.value); }
        if (action.type === "dialog") {
            const operation = dialogs.operations.filter(x => !x.completed)[action.index ?? 0];
            operation.complete(action.error ? new Error(action.error) : null, dialogs.file(action.value ?? "/seleccion.clrs"));
        }
        if (action.type === "close") { native.apps[0].getWindows()[0].close(); }
        sequence = action.sequence;
    } catch { /* El archivo de acciones puede estar escribiéndose o aún no existir. */ }
}, 10);
timer.unref();
const quit = native.Gtk.Application.prototype.quit;
native.Gtk.Application.prototype.quit = function() {
    console.log("GUI_TEST_CLEANUP", JSON.stringify({ windows: this.getWindows().length,
        pendingDialogs: dialogs.operations.filter(x => !x.completed).length }));
    clearInterval(timer); quit.call(this);
};
export default native.binding.default;
