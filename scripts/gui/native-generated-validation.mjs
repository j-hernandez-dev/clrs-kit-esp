import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { parseSource } from "../../src/language/LanguageFrontend.js";
import { JavaScriptGenerator } from "../../src/compiler/JavaScriptGenerator.js";

// Adaptador mínimo de ensayo: no forma parte de la implementación productiva GUI.
async function nativeFixture(binding, { invokeCallback }) {
    const Gtk = binding.default.require("Gtk", "4.0");
    const GLib = binding.default.require("GLib", "2.0");
    const Gio = binding.default.require("Gio", "2.0");
    const app = new Gtk.Application("org.clrs.gui.generatedvalidation", Gio.ApplicationFlags.NON_UNIQUE);
    const loop = GLib.MainLoop.new(null, false);
    const widgets = new Map();
    let activate;
    let failure;
    const ready = new Promise(resolve => { activate = resolve; });
    app.on("activate", () => { activate(); loop.run(); });
    app.run([]);
    await ready;
    return {
        invoke(name, args) {
            switch (name) {
                case "VENTANA_APLICACION": {
                    const window = new Gtk.ApplicationWindow(app);
                    window.setTitle(args[1]); window.setDefaultSize(340, 100);
                    widgets.set(args[0], window); return;
                }
                case "BOTON": widgets.set(args[0], new Gtk.Button({ label: args[1] })); return;
                case "CONTENER": widgets.get(args[0]).setChild(widgets.get(args[1])); return;
                case "OBTENER": return widgets.get(args[0]).getVisible();
                case "CONECTAR":
                    widgets.get(args[0]).on("close-request", () => {
                        try { return invokeCallback(args[2], args[0], [], true); }
                        catch (error) { failure = error; return true; }
                    });
                    return;
                case "MOSTRAR": {
                    const window = widgets.get(args[0]); window.present();
                    if (window.emit("close-request") !== true) { throw new Error("El callback generado no devolvió un booleano síncrono."); }
                    console.log("GTK_GENERATED_CALLBACK_OK"); return;
                }
                default: throw new Error("Operación fuera del adaptador mínimo de prueba.");
            }
        },
        async waitForIdle() {
            await new Promise(resolve => setTimeout(resolve, 75));
            if (failure) { throw failure; }
        },
        dispose() {
            for (const widget of widgets.values()) { if (widget instanceof Gtk.Window) { widget.destroy(); } }
            loop.quit(); app.quit();
        }
    };
}

const source = [
    "AL_CERRAR(id)",
    '    retornar LONG(id) > 0 y OBTENER(id, "visible")',
    "PRINCIPAL()",
    '    VENTANA_APLICACION("principal", "CLRS generado · GTK")',
    '    BOTON("b", "Prueba generada")',
    '    CONTENER("principal", "b")',
    '    CONECTAR("principal", "cerrar", AL_CERRAR)',
    '    MOSTRAR("principal")'
].join("\n");
const ast = parseSource(source).ast;
const generated = new JavaScriptGenerator().generate(ast, {
    runtimeContext: { gui: { moduleUrl: process.argv[2], factorySource: nativeFixture.toString() } }
});
const child = spawnSync(process.execPath, ["--input-type=module"], {
    input: generated.generatedCode, encoding: "utf8", windowsHide: true, timeout: 12000
});
assert.equal(child.error, undefined, child.error?.message);
assert.equal(child.status, 0, child.stderr);
assert.match(child.stdout, /GTK_GENERATED_CALLBACK_OK/u);
console.log(JSON.stringify({ ok: true, check: "clrs-generated-esm-native-callback", capabilities: generated.requiredCapabilities }));
