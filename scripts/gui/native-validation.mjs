import assert from "node:assert/strict";
import { NODE_GTK_RUNTIME_DEPENDENCY } from "../../src/standard-library/gui/GuiContract.js";

// Sólo se ejecuta explícitamente, en un proceso de prueba separado del Host.
const entryPoint = process.argv[2];
assert.equal(new URL(entryPoint).protocol, "file:");
assert.ok(NODE_GTK_RUNTIME_DEPENDENCY.supportedNodeMajors.includes(Number(process.versions.node.split(".")[0])));
const namespace = await import(entryPoint);
const gi = namespace.default;
assert.equal(namespace.require, gi.require);
const Gtk = gi.require("Gtk", "4.0");
const Gio = gi.require("Gio", "2.0");
const GLib = gi.require("GLib", "2.0");
const Gdk = gi.require("Gdk", "4.0");
const gtk = [Gtk.getMajorVersion(), Gtk.getMinorVersion(), Gtk.getMicroVersion()];
assert.ok(gtk[0] === 4 && gtk[1] >= 10);
const checks = [];
const record = name => { checks.push(name); console.error("[GTK] " + name); };
const app = new Gtk.Application("org.clrs.gui.validation", Gio.ApplicationFlags.NON_UNIQUE);
let window;
let settle;
const completion = new Promise(resolve => { settle = resolve; });
const timeout = setTimeout(() => { console.error("La prueba GTK excedió 15 segundos."); process.exit(1); }, 15000);
let failure = null;
const loop = GLib.MainLoop.new(null, false);

app.on("activate", () => {
    console.error("[GTK] activate");
    void (async () => {
        try {
            window = new Gtk.ApplicationWindow(app);
            window.setTitle("CLRS · Validación técnica GTK");
            window.setDefaultSize(360, 130);
            const button = new Gtk.Button({ label: "Prueba automática" });
            window.setChild(button);
            window.present();
            record("application-window-present");
            const plainWindow = new Gtk.Window();
            app.addWindow(plainWindow);
            assert.ok(plainWindow instanceof Gtk.Window);
            assert.ok(window instanceof Gtk.ApplicationWindow);
            plainWindow.destroy();
            record("window-and-application-window");

            let idSeen;
            let asyncFinished = false;
            button.on("clicked", () => {
                void (async id => {
                    await new Promise(resolve => setTimeout(resolve, 10));
                    idSeen = id;
                    asyncFinished = true;
                })("boton original").catch(error => { failure = error; });
            });
            button.emit("clicked");
            await new Promise(resolve => setTimeout(resolve, 30));
            assert.equal(asyncFinished, true);
            assert.equal(idSeen, "boton original");
            record("esm-loop-timers-and-async-callback");

            window.on("close-request", () => true);
            assert.equal(window.emit("close-request"), true);
            assert.equal(window.getVisible(), true);
            const link = new Gtk.LinkButton("https://example.invalid");
            link.on("activate-link", () => true);
            assert.equal(link.emit("activate-link"), true);
            const key = new Gtk.EventControllerKey();
            button.addController(key);
            key.on("key-pressed", () => true);
            assert.equal(key.emit("key-pressed", Gdk.KEY_a, 38, 0), true);
            record("synchronous-close-link-key-return");

            const alert = new Gtk.AlertDialog({ message: "Validación" });
            const file = new Gtk.FileDialog();
            assert.equal(alert instanceof Gtk.Widget, false);
            assert.equal(file instanceof Gtk.Widget, false);
            const cancelled = new Gio.Cancellable();
            let alertCancelled = false;
            await new Promise((resolve, reject) => {
                console.error("[GTK] alert.choose");
                setTimeout(() => alert.choose(window, cancelled, (_source, result) => {
                    console.error("[GTK] alert callback");
                    try { alert.chooseFinish(result); reject(new Error("Se esperaba cancelación.")); }
                    catch (error) {
                        if (!/cancel|dismiss/iu.test(error.message)) { reject(error); return; }
                        alertCancelled = true; resolve();
                    }
                }), 0);
                setTimeout(() => { cancelled.cancel(); console.error("[GTK] cancel requested"); }, 20);
            });
            assert.equal(alertCancelled, true);
            record("alert-cancelled");
            let fileCancelled = false;
            const fileCancellation = new Gio.Cancellable();
            await new Promise((resolve, reject) => {
                console.error("[GTK] file.open");
                setTimeout(() => file.open(window, fileCancellation, (_source, result) => {
                    console.error("[GTK] file callback");
                    try { file.openFinish(result); reject(new Error("Se esperaba cancelación.")); }
                    catch (error) {
                        if (!/cancel|dismiss/iu.test(error.message)) { reject(error); return; }
                        fileCancelled = true; resolve();
                    }
                }), 0);
                setTimeout(() => fileCancellation.cancel(), 50);
            });
            assert.equal(fileCancelled, true);
            record("alert-file-dialog-async-cancellation");
            const settings = Gtk.Settings.getDefault();
            assert.equal(typeof settings.gtkThemeName, "string");
            assert.equal(typeof settings.gtkApplicationPreferDarkTheme, "boolean");
            record("gtk-settings-theme-baseline");
        } catch (error) { failure = error; }
        finally {
            window?.destroy();
            loop.quit();
            app.quit();
            clearTimeout(timeout);
            settle();
        }
    })();
    loop.run();
});
console.error("[GTK] run");
app.run([]);
await completion;
if (failure) { throw failure; }
console.log(JSON.stringify({ ok: true, node: process.versions.node, abi: process.versions.modules,
    platform: process.platform, arch: process.arch, binding: NODE_GTK_RUNTIME_DEPENDENCY.version,
    gtk, checks, nativeModuleInHost: false }));
