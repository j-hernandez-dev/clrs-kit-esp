/** Doble determinista de Gio/GTK; no sustituye la validación de firmas nativas. */
export function fakeDialogs() {
    const operations = [];
    const instances = [];
    class Cancellable {
        cancelled = false;
        cancel() {
            this.cancelled = true;
            for (const operation of operations) {
                if (operation.cancellable === this && !operation.completed) {
                    queueMicrotask(() => operation.complete(new Error("Cancelled by application")));
                }
            }
        }
        isCancelled() { return this.cancelled; }
    }
    class Dialog {
        constructor(properties = {}) { Object.assign(this, properties); instances.push(this); }
        start(method, parent, cancellable, callback) {
            const native = this;
            const operation = { method, native, parent, cancellable, completed: false,
                complete(error, value) {
                    if (this.completed) { return; }
                    this.completed = true;
                    callback(native, { error, value });
                } };
            operations.push(operation);
        }
        finish(result) { if (result.error) { throw result.error; } return result.value; }
    }
    for (const name of ["Message", "Detail", "Buttons", "CancelButton", "DefaultButton", "Modal", "Title",
        "AcceptLabel", "InitialFile", "InitialFolder", "InitialName", "Filters", "DefaultFilter"]) {
        Dialog.prototype["set" + name] = function(value) { this[name] = value; };
        Dialog.prototype["get" + name] = function() { return this[name] ?? null; };
    }
    for (const method of ["choose", "open", "openMultiple", "save", "selectFolder", "selectMultipleFolders"]) {
        Dialog.prototype[method] = function(...args) { this.start(method, ...args); };
        Dialog.prototype[method + "Finish"] = Dialog.prototype.finish;
    }
    class FileFilter { setName(value) { this.name = value; } addPattern(value) { (this.patterns ??= []).push(value); } }
    const list = values => ({ values: [...values], getNItems() { return this.values.length; }, getItem(i) { return this.values[i]; }, append(value) { this.values.push(value); } });
    const file = path => ({ getPath: () => path });
    return { operations, instances, list, file,
        gi: { getGType: value => value },
        Gtk: { AlertDialog: class extends Dialog {}, FileDialog: class extends Dialog {}, FileFilter,
            dialogErrorQuark: () => 10, DialogError: { FAILED: 0, CANCELLED: 1, DISMISSED: 2 } },
        Gio: { Cancellable, File: { newForPath: file }, ListStore: { new: () => list([]) },
            SettingsSchemaSource: { getDefault: () => ({ lookup: () => ({}) }) },
            ioErrorQuark: () => 20, IOErrorEnum: { CANCELLED: 19 } } };
}
