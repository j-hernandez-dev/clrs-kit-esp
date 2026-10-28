// Infraestructura exclusivamente de pruebas: el compilador usa su runtime real.
import { fakeGtk } from "./FakeGtk.js";
import { fakeDialogs } from "./FakeDialogs.js";

const native = fakeGtk();
const dialogs = fakeDialogs();
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
if (process.env.CLRS_GUI_TEST_MISSING_SCHEMAS === "1") {
    dialogs.Gio.SettingsSchemaSource.getDefault = () => null;
}
for (const type of [native.Gtk.AlertDialog, native.Gtk.FileDialog]) {
    const start = type.prototype.start;
    type.prototype.start = function(...args) {
        start.apply(this, args);
        const operation = dialogs.operations.at(-1);
        setTimeout(() => {
            if (operation.method === "choose") { operation.complete(null, 1); }
            else if (["openMultiple", "selectMultipleFolders"].includes(operation.method)) {
                operation.complete(null, dialogs.list([dialogs.file("/seleccion.txt")]));
            } else { operation.complete(null, dialogs.file("/seleccion.txt")); }
        }, 5);
    };
}
export default native.binding.default;
