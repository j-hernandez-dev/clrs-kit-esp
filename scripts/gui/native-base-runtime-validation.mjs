import assert from "node:assert/strict";
import { getGuiRuntimeFactorySource } from "../../src/standard-library/gui/runtime/GuiRuntimeSource.js";
import { createGuiCallbackReference, invokeGuiCallback } from "../../src/compiler/gui/GuiCallbackBridge.js";
import { spawnSync } from "node:child_process";
import { parseSource } from "../../src/language/LanguageFrontend.js";
import { JavaScriptGenerator } from "../../src/compiler/JavaScriptGenerator.js";

const watchdog = setTimeout(() => { console.error("Runtime base: tiempo agotado"); process.exit(1); }, 15000);
const namespace = await import(process.argv[2]);
const Gtk = namespace.default.require("Gtk", "4.0");
const original = Gtk.Settings.getDefault();
// El compilador incorpora exactamente esta fábrica, no una simulación de widgets.
const factory = Function(`return (${getGuiRuntimeFactorySource()})`)();
const session = await factory(namespace, { programKey: "native-base-validation", invokeCallback: invokeGuiCallback });
const call = (name, ...args) => session.invoke(name, args);
const checks = [];
try {
    const theme = call("OBTENER_TEMA");
    const dark = Gtk.Settings.getDefault().gtkApplicationPreferDarkTheme;
    assert.equal(call("OBTENER_MODO_TEMA"), "sistema");
    call("ESTABLECER_MODO_TEMA", "oscuro");
    assert.equal(Gtk.Settings.getDefault().gtkApplicationPreferDarkTheme, true);
    call("ESTABLECER_TEMA", theme);
    call("ESTABLECER_MODO_TEMA", "sistema");
    assert.equal(Gtk.Settings.getDefault().gtkApplicationPreferDarkTheme, dark);
    checks.push("theme-baseline-mode-and-name");
    call("VENTANA", "v1", "CLRS runtime base · cierre automático");
    call("VENTANA_APLICACION", "v2", "CLRS runtime base · segunda ventana");
    call("CAJA", "box", "vertical", 4);
    call("CUADRICULA", "grid");
    call("CONTENEDOR_DESPLAZABLE", "scroll");
    call("CONTENER", "v1", "scroll");
    call("CONTENER", "scroll", "box");
    call("ANEXAR", "box", "grid");
    call("QUITAR", "box", "grid");
    call("PREPONER", "box", "grid");
    call("QUITAR", "scroll", "box");
    call("CONTENER", "scroll", "box");
    assert.throws(() => call("CONTENER", "v2", "box"), { code: "CLRS_GUI_PARENT_CONFLICT" });
    checks.push("native-containment-and-private-viewport-detach");
    call("ESTABLECER", "v1", "ancho", 420);
    call("ESTABLECER", "v1", "alto", 160);
    assert.equal(call("OBTENER", "v1", "ancho"), 420);
    for (const [id, property, value] of [["box", "alineacion_horizontal", "rellenar"],
        ["box", "orientacion", "horizontal"], ["box", "margen_inicio", 8], ["grid", "separacion_filas", 6],
        ["scroll", "politica_horizontal", "siempre"], ["scroll", "marco", true], ["v1", "titulo", "CLRS base"]]) {
        call("ESTABLECER", id, property, value);
        assert.equal(call("OBTENER", id, property), value);
    }
    for (const property of ["activa", "maximizada", "pantalla_completa"]) {
        assert.equal(typeof call("OBTENER", "v1", property), "boolean");
    }
    checks.push("curated-properties-enums-and-requested-size");
    for (const [id, values] of [
        ["box", { visible: true, habilitado: true, opacidad: 1, ancho_minimo: 50, alto_minimo: 20,
            expandir_horizontal: true, expandir_vertical: true, alineacion_vertical: "centro",
            margen_superior: 3, margen_inferior: 3, margen_inicio: 3, margen_fin: 3, ayuda: "Ayuda",
            enfocable: true, separacion: 4, homogeneo: true }],
        ["grid", { separacion_columnas: 4, filas_homogeneas: true, columnas_homogeneas: true }],
        ["scroll", { politica_vertical: "automatico", desplazamiento_cinetico: true, desplazamiento_superpuesto: false,
            ancho_contenido_minimo: 50, alto_contenido_minimo: 30, ancho_contenido_maximo: 200, alto_contenido_maximo: 150 }],
        ["v1", { redimensionable: true, modal: false, decorada: true, cerrable: true, ocultar_al_cerrar: false }]
    ]) {
        for (const [name, value] of Object.entries(values)) {
            call("ESTABLECER", id, name, value);
            assert.equal(call("OBTENER", id, name), value, `${id}.${name}`);
        }
    }
    call("ESTABLECER", "box", "ayuda", null);
    assert.equal(call("OBTENER", "box", "ayuda"), null);
    call("ESTABLECER_MODO_TEMA", "claro");
    assert.equal(call("OBTENER", "v1", "ancho"), 420);
    checks.push("all-base-properties-and-theme-after-widget-creation");
    let veto = true;
    let seen;
    call("CONECTAR", "v1", "cerrar", createGuiCallbackReference(id => { seen = id; return veto; }, true));
    call("MOSTRAR", "v1"); call("MOSTRAR", "v2");
    await new Promise(resolve => setTimeout(resolve, 30));
    call("CERRAR", "v1");
    assert.equal(seen, "v1");
    assert.equal(call("OBTENER", "v1", "visible"), true);
    call("ESTABLECER", "v2", "ocultar_al_cerrar", true);
    call("CERRAR", "v2");
    assert.equal(call("OBTENER", "v2", "visible"), false);
    let ended = false;
    const idle = session.waitForIdle().then(() => { ended = true; });
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(ended, false);
    call("MOSTRAR", "v2");
    call("ESTABLECER", "v2", "ocultar_al_cerrar", false);
    call("CERRAR", "v2");
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(ended, false);
    veto = false;
    call("CERRAR", "v1");
    await idle;
    checks.push("close-veto-hide-not-destroy-and-last-window-lifetime");
} finally {
    await session.dispose();
    clearTimeout(watchdog);
}
assert.ok(original === null || typeof original === "object");
for (const [source, status, expected] of [
    ['PRINCIPAL()\n    escribir OBTENER_MODO_TEMA()', 0, /sistema/u],
    [["AL_CERRAR(id)", '    retornar LONG(id) == 0', "PRINCIPAL()",
        '    VENTANA_APLICACION("v", "CLRS generado · cierre automático")', '    CAJA("c", "vertical", 0)',
        '    CONTENER("v", "c")', '    CONECTAR("v", "cerrar", AL_CERRAR)',
        '    MOSTRAR("v")', '    CERRAR("v")', '    escribir "GUI_GENERATED_BASE_OK"'].join("\n"), 0, /GUI_GENERATED_BASE_OK/u],
    ['PRINCIPAL()\n    VENTANA("v", "")\n    CUADRICULA("v")', 70, /Ya existe un componente/u]
]) {
    const generated = new JavaScriptGenerator().generate(parseSource(source).ast, {
        runtimeContext: { gui: { moduleUrl: process.argv[2], factorySource: getGuiRuntimeFactorySource() } }
    });
    const child = spawnSync(process.execPath, ["--input-type=module"], { input: generated.generatedCode,
        encoding: "utf8", windowsHide: true, timeout: 10000 });
    assert.equal(child.error, undefined, child.error?.message);
    assert.equal(child.status, status, child.stderr);
    assert.match(child.stdout + child.stderr, expected);
}
checks.push("generated-clrs-theme-only-window-callback-and-localized-error");
console.log(JSON.stringify({ node: process.versions.node, platform: process.platform, arch: process.arch,
    gtk: [Gtk.getMajorVersion(), Gtk.getMinorVersion(), Gtk.getMicroVersion()], checks }, null, 2));
