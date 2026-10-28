import assert from "node:assert/strict";
import { getGuiRuntimeFactorySource } from "../../src/standard-library/gui/runtime/GuiRuntimeSource.js";
import { GUI_COMPONENTS } from "../../src/standard-library/gui/GuiComponentCatalog.js";
import { invokeGuiCallback } from "../../src/compiler/gui/GuiCallbackBridge.js";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseSource } from "../../src/language/LanguageFrontend.js";
import { JavaScriptGenerator } from "../../src/compiler/JavaScriptGenerator.js";

const watchdog = setTimeout(() => { console.error("Controles: tiempo agotado"); process.exit(1); }, 20000);
// La preparación de fixtures no es código CLRS; la E/S con GTK activo se prueba en validate-events.
const temporary = await mkdtemp(path.join(tmpdir(), "clrs-gui-controls-"));
const imagePath = path.join(temporary, "imagen.png");
await writeFile(imagePath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"));
const binding = await import(process.argv[2]);
const Gtk = binding.default.require("Gtk", "4.0");
const factory = Function(`return (${getGuiRuntimeFactorySource()})`)();
if (process.env.CLRS_GUI_VALIDATION_TRACE === "1") { console.error("before-factory"); }
const session = await factory(binding, { programKey: "controls-native-validation", invokeCallback: invokeGuiCallback });
if (process.env.CLRS_GUI_VALIDATION_TRACE === "1") { console.error("after-factory"); }
const call = (name, ...args) => session.invoke(name, args);
const checks = [];
const recordCheck = name => { checks.push(name); if (process.env.CLRS_GUI_VALIDATION_TRACE === "1") { console.error(name); } };
try {
    const inputs = {
        Label: ["<b>Texto literal</b>"], Entry: [], PasswordEntry: [], TextView: [], Button: ["Aceptar"], CheckButton: ["Opción"],
        ToggleButton: ["Alternar"], LinkButton: ["https://example.invalid", "Enlace"], SpinButton: [0, 100, 1], Scale: ["horizontal", 0, 100, 1],
        ProgressBar: [], Spinner: [], DropDown: [["Uno", "Dos"]], Calendar: [], Image: [imagePath],
        ListBox: [], ColumnView: [["Nombre", "Edad", "Activo"]]
    };
    for (const [type, args] of Object.entries(inputs)) {
        if (process.env.CLRS_GUI_VALIDATION_TRACE === "1") { console.error("create:" + type); }
        call(GUI_COMPONENTS[type].factory.name, type, ...args);
        for (const [name, descriptor] of Object.entries(GUI_COMPONENTS[type].properties)) {
            if (!descriptor.read) { continue; }
            call("OBTENER", type, name);
        }
    }
    recordCheck("17-native-controls-and-readable-properties");
    const values = {
        Label: { texto: "<i>Literal</i>", seleccionable: true, modo_ajuste: "palabra_caracter", justificacion: "derecha", elipsis: "fin", ancho_caracteres: 10 },
        Entry: { texto: "Entrada ñ", marcador: "Pista", editable: false, longitud_maxima: 50, ancho_caracteres: 20, alineacion_texto: 0.5, marco: false },
        PasswordEntry: { texto: "dato-local-de-ensayo", marcador: "Clave", editable: true, mostrar_revelar: true, activar_predeterminado: true },
        TextView: { texto: "Línea 1\nLínea ñ", editable: false, modo_ajuste: "palabra", monoespaciado: true, acepta_tabulador: false, cursor_visible: false, sobrescritura: true },
        Button: { texto: "Nuevo", marco: false }, CheckButton: { texto: "Nueva", activo: true, indeterminado: true },
        ToggleButton: { texto: "Nuevo", marco: false, activo: true }, LinkButton: { texto: "Sin abrir", uri: "https://example.invalid/test", visitado: true, marco: false },
        SpinButton: { minimo: -10, maximo: 150, paso: 2, valor: 12, decimales: 2, solo_numeros: true, ajustar_saltos: false, ciclico: true },
        Scale: { minimo: -10, maximo: 150, paso: 2, valor: 12, decimales: 2, orientacion: "vertical", mostrar_valor: true,
            posicion_valor: "arriba", mostrar_origen: false, invertido: true },
        ProgressBar: { orientacion: "vertical", progreso: 0.5, texto: "Mitad", mostrar_texto: true, invertido: true, paso_pulso: 0.2 },
        DropDown: { busqueda: true, mostrar_flecha: false }, Calendar: { mostrar_dias_semana: false, mostrar_encabezado: false, mostrar_numeros_semana: true },
        Image: { tamano_pixel: 30 },
        ListBox: { activar_un_clic: false, separadores: true },
        ColumnView: { reordenable: false, separadores_filas: true, separadores_columnas: true, activar_un_clic: true, seleccion_arrastre: true }
    };
    for (const [type, properties] of Object.entries(values)) {
        for (const [name, value] of Object.entries(properties)) {
            call("ESTABLECER", type, name, value);
            assert.deepEqual(call("OBTENER", type, name), value, `${type}.${name}`);
        }
    }
    for (const [id, property] of [["PasswordEntry", "marcador"], ["Entry", "marcador"], ["ProgressBar", "texto"],
        ["Button", "icono"], ["ToggleButton", "icono"], ["LinkButton", "icono"], ["Image", "icono"]]) {
        call("ESTABLECER", id, property, null);
        assert.equal(call("OBTENER", id, property), null);
    }
    recordCheck("curated-properties-text-buffers-enums-and-null");
    call("LIMPIAR_IMAGEN", "Image");
    call("ESTABLECER", "Image", "archivo", imagePath);
    call("ESTABLECER", "Image", "tamano_pixel", 32);
    assert.equal(call("OBTENER", "Image", "tamano_pixel"), 32);
    recordCheck("image-file-clear-reload-without-media");
    call("ESTABLECER", "DropDown", "seleccion", 1);
    call("ESTABLECER", "DropDown", "opciones", ["Primera", "Segunda", "Tercera"]);
    assert.equal(call("OBTENER", "DropDown", "valor"), "Segunda");
    call("ESTABLECER", "DropDown", "opciones", ["Única"]);
    assert.equal(call("OBTENER", "DropDown", "seleccion"), -1);
    assert.equal(call("OBTENER", "DropDown", "valor"), null);
    call("ESTABLECER", "DropDown", "opciones", []);
    assert.deepEqual(call("OBTENER", "DropDown", "opciones"), []);
    call("ESTABLECER", "ColumnView", "datos", [["Ana", 24, true], ["Luis", null, false]]);
    for (const id of ["Label", "Button", "Entry"]) { call("ANEXAR", "ListBox", id); }
    for (const id of ["ListBox", "ColumnView"]) {
        for (const [mode, selection] of [["unica", 1], ["multiple", [0, 1]], ["explorar", 0], ["explorar", -1]]) {
            call("ESTABLECER", id, "modo_seleccion", mode); call("ESTABLECER", id, "seleccion", selection);
            assert.deepEqual(call("OBTENER", id, "seleccion"), selection, `${id}:${mode}`);
        }
        call("ESTABLECER", id, "modo_seleccion", "ninguno");
        assert.equal(call("OBTENER", id, "seleccion"), null);
    }
    call("QUITAR", "ListBox", "Button"); call("PREPONER", "ListBox", "Button");
    call("ESTABLECER", "ColumnView", "columnas", ["Persona", "Años", "Estado"]);
    call("ANEXAR_FILA", "ColumnView", ["Eva", 19, null]); call("QUITAR_FILA", "ColumnView", 0);
    assert.deepEqual(call("OBTENER", "ColumnView", "datos"), [["Luis", null, false], ["Eva", 19, null]]);
    assert.throws(() => call("ESTABLECER", "ColumnView", "columnas", ["No compatible"]), { code: "CLRS_GUI_INVALID_PROPERTY_VALUE" });
    recordCheck("real-string-models-selection-modes-row-width-and-listbox-wrapper");
    call("CASILLA", "otherCheck", "Otra");
    call("ESTABLECER", "otherCheck", "grupo", "CheckButton");
    call("ESTABLECER", "otherCheck", "activo", true);
    assert.equal(call("OBTENER", "CheckButton", "activo"), false);
    call("ESTABLECER", "otherCheck", "grupo", null);
    assert.equal(call("OBTENER", "otherCheck", "grupo"), null);
    call("ESTABLECER", "Calendar", "fecha", [2024, 2, 29]);
    assert.deepEqual(call("OBTENER", "Calendar", "fecha"), [2024, 2, 29]);
    call("MARCAR_DIA", "Calendar", 29); call("DESMARCAR_DIA", "Calendar", 29); call("LIMPIAR_MARCAS", "Calendar");
    call("INICIAR", "Spinner"); assert.equal(call("OBTENER", "Spinner", "activo"), true);
    call("PARAR", "Spinner"); assert.equal(call("OBTENER", "Spinner", "activo"), false);
    call("PULSAR_PROGRESO", "ProgressBar");
    call("DESLIZADOR", "equalRange", "horizontal", 5, 5, 1);
    assert.equal(call("OBTENER", "equalRange", "minimo"), 5);
    call("ENTRADA_NUMERICA", "equalSpin", 5, 5, 1);
    assert.equal(call("OBTENER", "equalSpin", "maximo"), 5);
    recordCheck("groups-calendar-actions-and-equal-range");
    call("VENTANA", "window", "CLRS · controles y modelos (cierre automático)");
    call("CAJA", "root", "vertical", 4); call("CONTENER", "window", "root");
    call("ANEXAR", "root", "ColumnView"); call("ANEXAR", "root", "ListBox");
    call("MOSTRAR", "window");
    await new Promise(resolve => setTimeout(resolve, 100));
    const rendered = [];
    const visit = widget => {
        if (widget.constructor.name === "GtkLabel") { rendered.push(widget.getText()); }
        for (let child = widget.getFirstChild(); child; child = child.getNextSibling()) { visit(child); }
    };
    const windows = Gtk.Window.getToplevels();
    for (let index = 0; index < windows.getNItems(); index++) { visit(windows.getItem(index)); }
    for (const text of ["Luis", "Eva", "NULO", "Falso", "19"]) { assert.ok(rendered.includes(text), `Celda nativa: ${text}`); }
    recordCheck("native-column-factories-render-and-node-timer");
    call("CERRAR", "window"); await session.waitForIdle();
} finally {
    await session.dispose(); clearTimeout(watchdog);
    await rm(temporary, { recursive: true, force: true });
}
const source = ["PRINCIPAL()", '    LISTA_DESPLEGABLE("opciones", ["Manzana", "Pera"])',
    '    ESTABLECER("opciones", "seleccion", 1)', '    escribir OBTENER("opciones", "valor")',
    '    VISTA_COLUMNAS("tabla", ["Nombre", "Edad"])', '    ANEXAR_FILA("tabla", ["Ana", 24])',
    '    ESTABLECER("tabla", "seleccion", 0)', '    escribir OBTENER("tabla", "seleccion")',
    '    AREA_TEXTO("editor")', '    ESTABLECER("editor", "texto", "GUI_GENERATED_CONTROLS_OK")',
    '    escribir OBTENER("editor", "texto")'].join("\n");
const generated = new JavaScriptGenerator().generate(parseSource(source).ast, {
    runtimeContext: { gui: { moduleUrl: process.argv[2], factorySource: getGuiRuntimeFactorySource() } }
});
const child = spawnSync(process.execPath, ["--input-type=module"], { input: generated.generatedCode,
    encoding: "utf8", windowsHide: true, timeout: 10000 });
assert.equal(child.error, undefined, child.error?.message); assert.equal(child.status, 0, child.stderr);
assert.match(child.stdout, /Pera/u); assert.match(child.stdout, /GUI_GENERATED_CONTROLS_OK/u);
recordCheck("generated-clrs-dropdown-table-and-textview");
console.log(JSON.stringify({ ok: true, node: process.versions.node, platform: process.platform, arch: process.arch,
    gtk: [Gtk.getMajorVersion(), Gtk.getMinorVersion(), Gtk.getMicroVersion()],
    checks }, null, 2));
