import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
    CLRS_STANDARD_LIBRARY, CLRS_STANDARD_LIBRARY_NAMES, getStandardLibraryDefinition,
    CLRS_STANDARD_LIBRARY_CONTRACTS, CLRS_STANDARD_LIBRARY_CONTRACT_NAMES,
    getStandardLibraryContract, getStandardLibraryCapability,
    getStandardLibraryContractHelp, CLRS_STANDARD_LIBRARY_CONTRACT_HELP,
    GUI_COMPONENTS, GUI_CONTRACT, GUI_DOMAINS as D, GUI_ENUMS,
    NODE_GTK_RUNTIME_DEPENDENCY, GUI_ERROR_MESSAGES, GuiContractError
} from "../src/standard-library/index.js";
import { GUI_FUNCTION_DEFINITIONS } from "../src/standard-library/gui/GuiFunctionCatalog.js";
import { GUI_WIDGET_PROPERTIES, GUI_WIDGET_EVENTS } from "../src/standard-library/gui/GuiComponentCatalog.js";
import {
    assertGuiIdentifier, assertGuiNewIdentifier, assertGuiArgumentDomains,
    requireGuiProperty, assertGuiPropertyDomain, requireGuiEvent, requireGuiAction,
    isGuiValueInDomain
} from "../src/standard-library/gui/GuiContractValidation.js";

// Expectativas independientes extraídas de docs/gui/api-catalog.md, no del catálogo JS.
const factories = {
    VENTANA: ["Window", ["principal", "Título"]],
    VENTANA_APLICACION: ["ApplicationWindow", ["principal", "Título"]],
    ETIQUETA: ["Label", ["etiqueta", "Texto"]],
    ENTRADA: ["Entry", ["entrada"]],
    ENTRADA_CONTRASENA: ["PasswordEntry", ["secreto"]],
    AREA_TEXTO: ["TextView", ["texto"]],
    BOTON: ["Button", ["boton", "Aceptar"]],
    CASILLA: ["CheckButton", ["casilla", "Activo"]],
    BOTON_ALTERNABLE: ["ToggleButton", ["alternar", "Alternar"]],
    BOTON_ENLACE: ["LinkButton", ["enlace", "https://example.com", "Visitar"]],
    ENTRADA_NUMERICA: ["SpinButton", ["numero", -5, 10, 0.5]],
    DESLIZADOR: ["Scale", ["escala", "vertical", -5, 10, 0.5]],
    BARRA_PROGRESO: ["ProgressBar", ["progreso"]],
    INDICADOR_CARGA: ["Spinner", ["cargando"]],
    LISTA_DESPLEGABLE: ["DropDown", ["opciones", ["Uno", "Dos"]]],
    CALENDARIO: ["Calendar", ["calendario"]],
    IMAGEN: ["Image", ["foto", "imagen.png"]],
    CAJA: ["Box", ["contenido", "vertical", 10]],
    CUADRICULA: ["Grid", ["cuadricula"]],
    CONTENEDOR_DESPLAZABLE: ["ScrolledWindow", ["desplazable"]],
    LISTA_VISUAL: ["ListBox", ["lista"]],
    VISTA_COLUMNAS: ["ColumnView", ["tabla", ["Nombre", "Edad"]]],
    DIALOGO_ALERTA: ["AlertDialog", ["alerta", "Mensaje"]],
    DIALOGO_ARCHIVO: ["FileDialog", ["archivo"]]
};
const specificProperties = {
    Window: "titulo ancho alto redimensionable modal decorada cerrable ocultar_al_cerrar maximizada pantalla_completa activa",
    ApplicationWindow: "titulo ancho alto redimensionable modal decorada cerrable ocultar_al_cerrar maximizada pantalla_completa activa",
    Label: "texto seleccionable ajuste_linea modo_ajuste justificacion elipsis ancho_caracteres",
    Entry: "texto marcador editable longitud_maxima ancho_caracteres alineacion_texto marco",
    PasswordEntry: "texto marcador editable mostrar_revelar activar_predeterminado",
    TextView: "texto editable modo_ajuste monoespaciado acepta_tabulador cursor_visible sobrescritura",
    Button: "texto icono marco",
    CheckButton: "texto activo indeterminado grupo",
    ToggleButton: "texto icono marco activo grupo",
    LinkButton: "texto icono marco uri visitado",
    SpinButton: "valor minimo maximo paso decimales solo_numeros ajustar_saltos ciclico",
    Scale: "orientacion valor minimo maximo paso decimales mostrar_valor posicion_valor mostrar_origen invertido",
    ProgressBar: "orientacion progreso texto mostrar_texto invertido paso_pulso",
    Spinner: "activo",
    DropDown: "opciones seleccion valor busqueda mostrar_flecha",
    Calendar: "fecha mostrar_dias_semana mostrar_encabezado mostrar_numeros_semana",
    Image: "archivo icono tamano_pixel",
    Box: "orientacion separacion homogeneo",
    Grid: "separacion_filas separacion_columnas filas_homogeneas columnas_homogeneas",
    ScrolledWindow: "politica_horizontal politica_vertical desplazamiento_cinetico desplazamiento_superpuesto marco ancho_contenido_minimo alto_contenido_minimo ancho_contenido_maximo alto_contenido_maximo",
    ListBox: "modo_seleccion activar_un_clic separadores seleccion",
    ColumnView: "columnas datos modo_seleccion seleccion reordenable separadores_filas separadores_columnas activar_un_clic seleccion_arrastre",
    AlertDialog: "mensaje detalle botones boton_cancelar boton_predeterminado modal",
    FileDialog: "titulo etiqueta_aceptar modal archivo_inicial carpeta_inicial nombre_inicial filtros filtro_predeterminado"
};
const specificEvents = {
    Window: "cerrar", ApplicationWindow: "cerrar", Label: "", Entry: "cambio activar",
    PasswordEntry: "cambio activar", TextView: "cambio", Button: "clic activar",
    CheckButton: "alternado activar", ToggleButton: "clic alternado", LinkButton: "clic activar_enlace",
    SpinButton: "valor_cambiado activar", Scale: "valor_cambiado", ProgressBar: "", Spinner: "",
    DropDown: "seleccion_cambiada activar", Calendar: "fecha_cambiada", Image: "",
    Box: "", Grid: "",
    ScrolledWindow: "borde_alcanzado borde_excedido", ListBox: "fila_activada seleccion_cambiada",
    ColumnView: "fila_activada seleccion_cambiada", AlertDialog: "", FileDialog: ""
};
const actions = {
    MOSTRAR: "widget", OCULTAR: "widget", ENFOCAR: "widget",
    CONTENER: "Window ApplicationWindow ScrolledWindow",
    QUITAR: "Window ApplicationWindow Box Grid ScrolledWindow ListBox",
    ANEXAR: "Box ListBox", PREPONER: "Box ListBox", COLOCAR: "Grid",
    CERRAR: "Window ApplicationWindow", MAXIMIZAR: "Window ApplicationWindow",
    MINIMIZAR: "Window ApplicationWindow", PANTALLA_COMPLETA: "Window ApplicationWindow",
    RESTAURAR: "Window ApplicationWindow", PULSAR_PROGRESO: "ProgressBar", INICIAR: "Spinner",
    PARAR: "Spinner", MARCAR_DIA: "Calendar",
    DESMARCAR_DIA: "Calendar", LIMPIAR_MARCAS: "Calendar", LIMPIAR_IMAGEN: "Image",
    ANEXAR_FILA: "ColumnView", QUITAR_FILA: "ColumnView", LIMPIAR_FILAS: "ColumnView",
    MOSTRAR_ALERTA: "AlertDialog", ELEGIR_ALERTA: "AlertDialog", ABRIR_ARCHIVO: "FileDialog",
    ABRIR_ARCHIVOS: "FileDialog", GUARDAR_ARCHIVO: "FileDialog", ELEGIR_CARPETA: "FileDialog",
    ELEGIR_CARPETAS: "FileDialog"
};
const split = text => text ? text.split(" ") : [];
const sorted = values => [...values].sort();
const fails = (code, fn) => assert.throws(fn, error => error instanceof GuiContractError && error.code === code);

test("GUI: catálogo común conserva la proyección ejecutable y declara 61 contratos GUI", () => {
    assert.equal(Object.keys(GUI_COMPONENTS).length, 24);
    assert.equal(Object.keys(GUI_FUNCTION_DEFINITIONS).length, 61);
    assert.equal(CLRS_STANDARD_LIBRARY_CONTRACT_NAMES.length, CLRS_STANDARD_LIBRARY_NAMES.length + 61);
    assert.deepEqual(Object.keys(CLRS_STANDARD_LIBRARY_CONTRACT_HELP), CLRS_STANDARD_LIBRARY_CONTRACT_NAMES);
    for (const name of CLRS_STANDARD_LIBRARY_NAMES) {
        assert.equal(CLRS_STANDARD_LIBRARY_CONTRACTS[name], CLRS_STANDARD_LIBRARY[name]);
    }
    for (const [name, definition] of Object.entries(GUI_FUNCTION_DEFINITIONS)) {
        assert.equal(getStandardLibraryDefinition(name), null, "No publicar funciones aún sin runtime");
        assert.equal(getStandardLibraryContract(name), definition);
        assert.equal(getStandardLibraryCapability(name), "gui");
        assert.equal(definition.requiresGui, true);
        assert.equal(definition.availability, "semantic-and-codegen");
        assert.ok(definition.cost.kind, "Cada función declara un modelo de costo GUI");
        assert.equal(definition.costStatus, "modeled");
        assert.equal(definition.symbolicEffect.kind, "opaque");
        assert.equal(getStandardLibraryContractHelp(name).parameterDetails, definition.parameters);
        assert.equal(getStandardLibraryContractHelp(name).returns, definition.returns);
        assert.match(definition.documentation, /[a-záéíóúñ]/u);
        assert.match(name, /^[A-Z][A-Z0-9_]*$/u);
        for (const code of definition.errors) { assert.ok(GUI_ERROR_MESSAGES[code], `${name}: ${code}`); }
    }
});

test("GUI: todas las factories tienen firma, tipo, dominio e identidad canónicos", async t => {
    assert.deepEqual(sorted(Object.values(GUI_COMPONENTS).map(component => component.factory.name)), sorted(Object.keys(factories)));
    for (const [name, [type, args]] of Object.entries(factories)) {
        await t.test(name, () => {
            const descriptor = assertGuiArgumentDomains(name, args);
            assert.equal(descriptor.componentType, type);
            assert.equal(GUI_COMPONENTS[type].gtkClass, `Gtk.${type}`);
            assert.equal(descriptor.returns.type, "void");
            assert.equal(descriptor.returnType, "void");
            assert.equal(descriptor.parameters[0].domain.type, "string");
            assert.equal(descriptor.parameters[0].domain.role, "component-id");
            fails("CLRS_GUI_INVALID_ID", () => assertGuiArgumentDomains(name, [5, ...args.slice(1)]));
            fails("CLRS_GUI_INVALID_ID", () => assertGuiArgumentDomains(name, ["", ...args.slice(1)]));
            fails("CLRS_GUI_INVALID_ARGUMENT", () => assertGuiArgumentDomains(name, args.slice(1)));
            fails("CLRS_GUI_INVALID_ARGUMENT", () => assertGuiArgumentDomains(name, [...args, 1]));
        });
    }
});

test("GUI: propiedades, eventos y acciones coinciden con las 24 fichas normativas", () => {
    for (const [type, component] of Object.entries(GUI_COMPONENTS)) {
        const commonProperties = component.widget ? Object.keys(GUI_WIDGET_PROPERTIES) : [];
        const commonEvents = component.widget ? Object.keys(GUI_WIDGET_EVENTS) : [];
        assert.deepEqual(sorted(Object.keys(component.properties)), sorted([...commonProperties, ...split(specificProperties[type])]), type);
        assert.deepEqual(sorted(Object.keys(component.events)), sorted([...commonEvents, ...split(specificEvents[type])]), type);
        for (const [name, property] of Object.entries(component.properties)) {
            assert.match(name, /^[a-z][a-z_]*$/u);
            assert.equal(property.read, property.access !== "W");
            assert.equal(property.write, property.access !== "R");
            assert.ok(property.gtk);
            assert.ok(property.domain);
        }
    }
    assert.deepEqual(sorted(Object.values(GUI_FUNCTION_DEFINITIONS).filter(definition => definition.kind === "action").map(definition => definition.name)), sorted(Object.keys(actions)));
    for (const [name, types] of Object.entries(actions)) {
        const expected = types === "widget" ? Object.keys(GUI_COMPONENTS).filter(type => !["AlertDialog", "FileDialog"].includes(type)) : split(types);
        assert.deepEqual(sorted(getStandardLibraryContract(name).componentTypes), sorted(expected), name);
        for (const type of Object.keys(GUI_COMPONENTS)) {
            if (expected.includes(type)) { assert.ok(requireGuiAction(type, name)); }
            else { fails("CLRS_GUI_ACTION_NOT_SUPPORTED", () => requireGuiAction(type, name)); }
        }
    }
});

test("GUI: capacidades no se infieren de nombres GTK, prototipos ni prefijos de IDs", () => {
    for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty", {}, null]) {
        assert.equal(getStandardLibraryContract(name), null);
        assert.equal(getStandardLibraryContractHelp(name), null);
        fails("CLRS_GUI_PROPERTY_NOT_FOUND", () => requireGuiProperty("Button", name));
        fails("CLRS_GUI_EVENT_NOT_FOUND", () => requireGuiEvent("Button", name));
        fails("CLRS_GUI_ACTION_NOT_SUPPORTED", () => requireGuiAction("Button", name));
    }
    for (const name of ["has-frame", "color_fondo", "css", "child"]) {
        fails("CLRS_GUI_PROPERTY_NOT_FOUND", () => requireGuiProperty("Button", name));
    }
    fails("CLRS_GUI_WRONG_COMPONENT_TYPE", () => requireGuiProperty("constructor", "texto"));
    const sessionA = new Set(["principal"]);
    const sessionB = new Set();
    fails("CLRS_GUI_DUPLICATE_ID", () => assertGuiNewIdentifier("principal", sessionA));
    assert.equal(assertGuiNewIdentifier("principal", sessionB), "principal");
    for (const value of ["boton principal", "x", "window-uno", "__proto__", " "]) {
        assert.equal(assertGuiIdentifier(value), value, "No recortar ni imponer nomenclatura");
    }
    for (const value of [null, undefined, 1, true, {}, [], ""]) {
        fails("CLRS_GUI_INVALID_ID", () => assertGuiIdentifier(value));
    }
    assert.equal(GUI_CONTRACT.identity.inferTypeFromId, false);
});

test("GUI: dominios locales validan sin coerciones, arreglos dispersos ni objetos nativos", () => {
    const cases = [
        [D.unit, [0, 0.5, 1], [-0.1, 1.1, "0", NaN, Infinity]],
        [D.naturalOrUnset, [-1, 0, 4], [-2, 0.5, "4"]],
        [D.boolean, [true, false], [0, 1, "VERDADERO", null]],
        [D.strings, [[], ["a", ""]], [[1], [null], new Array(2)]],
        [D.date, [[2024, 2, 29], [2026, 9, 9]], [[2026, 2, 29], [2026, 0, 9], [2026, 4, 31], [2026, 9]]],
        [D.filters, [[], [["Texto", ["*.txt"]]]], [["Texto", ["*.txt"]], [["Texto", [1]]], [["Texto", [], "extra"]]]],
        [D.rows, [[], [["Ana", 24, true, null]]], [[{}], [[[1]]], [[undefined]]]],
        [D.selectionValue, [-1, 0, [0, 2]], [null, [-1], "unica", 1.5]],
        [D.selection, ["ninguno", "multiple"], [-1, [0], "single"]]
    ];
    for (const [domain, positives, negatives] of cases) {
        for (const value of positives) { assert.equal(isGuiValueInDomain(value, domain), true, JSON.stringify(value)); }
        for (const value of negatives) { assert.equal(isGuiValueInDomain(value, domain), false, JSON.stringify(value)); }
    }
    const cyclic = []; cyclic.push(cyclic);
    assert.equal(isGuiValueInDomain(cyclic, D.value), false);
    assert.equal(isGuiValueInDomain({ gtk: true }, D.value), false);
    const shared = [1];
    assert.equal(isGuiValueInDomain([shared, shared], D.value), true);
    fails("CLRS_GUI_INVALID_ARGUMENT", () => assertGuiArgumentDomains("ENTRADA_NUMERICA", ["n", 10, 0, 1]));
    fails("CLRS_GUI_INVALID_ARGUMENT", () => assertGuiArgumentDomains("DESLIZADOR", ["n", "horizontal", 0, 10, 0]));
    assertGuiArgumentDomains("COLOCAR", ["g", "hijo", -1, -1, 1, 1]);
    fails("CLRS_GUI_INVALID_ARGUMENT", () => assertGuiArgumentDomains("COLOCAR", ["g", "hijo", 0, 0, 0, 1]));
});

test("GUI: lectura, escritura y reglas contextuales se distinguen del dominio local", () => {
    fails("CLRS_GUI_PROPERTY_READ_ONLY", () => assertGuiPropertyDomain("Spinner", "activo", true));
    fails("CLRS_GUI_PROPERTY_WRITE_ONLY", () => requireGuiProperty("Image", "archivo"));
    fails("CLRS_GUI_PROPERTY_NOT_FOUND", () => requireGuiProperty("Button", "progreso"));
    assertGuiPropertyDomain("ProgressBar", "progreso", 0.5);
    fails("CLRS_GUI_INVALID_PROPERTY_VALUE", () => assertGuiPropertyDomain("ProgressBar", "progreso", 2));
    assertGuiPropertyDomain("ListBox", "seleccion", null, "read");
    fails("CLRS_GUI_INVALID_PROPERTY_VALUE", () => assertGuiPropertyDomain("ListBox", "seleccion", null));
    assert.deepEqual(requireGuiProperty("CheckButton", "grupo").domain.oneOf[0].componentTypes, ["CheckButton"]);
    assert.deepEqual(requireGuiProperty("ToggleButton", "grupo").domain.oneOf[0].componentTypes, ["ToggleButton"]);
    assert.equal(requireGuiProperty("PasswordEntry", "texto").sensitive, true);
    assert.equal(GUI_COMPONENTS.Window.containment, "single");
    assert.equal(GUI_COMPONENTS.ScrolledWindow.containment, "single");
    assert.equal(GUI_COMPONENTS.Box.containment, "multiple");
    assert.equal(getStandardLibraryContract("ANEXAR").constraints[0].noImplicitReparent, true);
    assert.ok(GUI_COMPONENTS.ColumnView.constraints.some(rule => rule.kind === "row-width"));
    assert.ok(GUI_COMPONENTS.ListBox.constraints.some(rule => rule.kind === "selection-by-mode"));
    assert.ok(GUI_COMPONENTS.DropDown.constraints.some(rule => rule.kind === "model-index"));
    assert.ok(GUI_COMPONENTS.AlertDialog.constraints.some(rule => rule.property === "boton_cancelar"));
    assert.ok(GUI_COMPONENTS.FileDialog.constraints.some(rule => rule.property === "filtro_predeterminado"));
});

test("GUI: callbacks declaran normalización, mecanismo real y retorno síncrono", () => {
    for (const component of Object.values(GUI_COMPONENTS)) {
        for (const [name, event] of Object.entries(component.events)) {
            assert.equal(event.parameters[0].domain.role, "component-id");
            assert.equal(event.connectOnDemand, true);
            assert.ok(event.backend.members.length);
            assert.equal(event.allowsAsyncCallback, !["cerrar", "activar_enlace", "tecla_presionada"].includes(name));
        }
    }
    assert.equal(requireGuiEvent("TextView", "cambio").backend.kind, "buffer-signal");
    assert.equal(requireGuiEvent("DropDown", "seleccion_cambiada").backend.kind, "notify");
    assert.equal(requireGuiEvent("Calendar", "fecha_cambiada").backend.kind, "synthesized-signals");
    assert.equal(requireGuiEvent("ColumnView", "seleccion_cambiada").backend.kind, "selection-model-signal");
    assert.equal(requireGuiEvent("Button", "presionado").backend.kind, "gesture-click");
    assert.equal(requireGuiEvent("Window", "cerrar").returnPolicy, "synchronous-boolean");
    for (const value of ["AL_CLIC", () => {}, null, { name: "AL_CLIC" }]) {
        fails("CLRS_GUI_INVALID_CALLBACK", () => assertGuiArgumentDomains("CONECTAR", ["b", "clic", value]));
    }
    const resolvedSymbol = {};
    assertGuiArgumentDomains("CONECTAR", ["b", "clic", resolvedSymbol], {
        isFunctionReference: value => value === resolvedSymbol
    });
    assert.equal(D.functionReference.specialArgumentOnly, true);
    assert.equal(GUI_CONTRACT.callback.firstClassFunctions, false);
});

test("GUI: diálogos no heredan widgets y cancelación no es error ni acceso al filesystem", () => {
    for (const type of ["AlertDialog", "FileDialog"]) {
        assert.equal(GUI_COMPONENTS[type].widget, false);
        assert.deepEqual(GUI_COMPONENTS[type].events, {});
        fails("CLRS_GUI_PROPERTY_NOT_FOUND", () => requireGuiProperty(type, "visible"));
        fails("CLRS_GUI_ACTION_NOT_SUPPORTED", () => requireGuiAction(type, "MOSTRAR"));
    }
    for (const [name, value] of [["ELEGIR_ALERTA", -1], ["ABRIR_ARCHIVO", null], ["GUARDAR_ARCHIVO", null],
        ["ELEGIR_CARPETA", null], ["ABRIR_ARCHIVOS", []], ["ELEGIR_CARPETAS", []]]) {
        const definition = getStandardLibraryContract(name);
        assert.equal(definition.asynchronous, true);
        assert.deepEqual(definition.cancellation.value, value);
        assert.equal(isGuiValueInDomain(value, definition.returns), true);
        assert.equal(definition.fileSystemEffect, "none");
        assertGuiArgumentDomains(name, ["dialogo", null]);
        assert.deepEqual(definition.parameters[1].domain.oneOf[0].componentTypes, ["Window", "ApplicationWindow"]);
    }
    assert.equal(getStandardLibraryContract("MOSTRAR_ALERTA").asynchronous, false);
    assert.deepEqual(requireGuiAction("Spinner", "PARAR"), ["GtkSpinner.stop"]);
});

test("GUI: tema global, dependencias fijadas y contratos profundamente inmutables", () => {
    assert.equal(NODE_GTK_RUNTIME_DEPENDENCY.version, "4.1.1");
    assert.equal(NODE_GTK_RUNTIME_DEPENDENCY.minimumGtkVersion, "4.10");
    assert.deepEqual(NODE_GTK_RUNTIME_DEPENDENCY.supportedNodeMajors, [22, 24, 26]);
    assert.equal(NODE_GTK_RUNTIME_DEPENDENCY.installSystemPackages, false);
    assert.equal(GUI_CONTRACT.theme.overrideGtkByDefault, false);
    assert.equal(GUI_CONTRACT.theme.systemMode, "restore-initial-preference");
    assert.equal(GUI_CONTRACT.theme.preserveExplicitThemeName, true);
    assert.equal(GUI_CONTRACT.theme.publicCss, false);
    for (const mode of GUI_ENUMS.themeMode) { assertGuiArgumentDomains("ESTABLECER_MODO_TEMA", [mode]); }
    assertGuiArgumentDomains("ESTABLECER_TEMA", ["Tema nuevo sin enum"]);
    fails("CLRS_GUI_INVALID_THEME_MODE", () => assertGuiArgumentDomains("ESTABLECER_MODO_TEMA", ["dark"]));
    fails("CLRS_GUI_INVALID_THEME_NAME", () => assertGuiArgumentDomains("ESTABLECER_TEMA", [""]));
    fails("CLRS_GUI_INVALID_THEME_NAME", () => assertGuiArgumentDomains("ESTABLECER_TEMA", [5]));
    const visit = value => {
        if (value && typeof value === "object") {
            assert.equal(Object.isFrozen(value), true);
            Object.values(value).forEach(visit);
        }
    };
    [GUI_CONTRACT, GUI_COMPONENTS, GUI_FUNCTION_DEFINITIONS, GUI_ENUMS, D,
        NODE_GTK_RUNTIME_DEPENDENCY, GUI_ERROR_MESSAGES, CLRS_STANDARD_LIBRARY_CONTRACT_HELP].forEach(visit);
});

test("GUI: códigos estables en español y pruebas incluidas sin instalar GTK", async () => {
    for (const code of Object.keys(GUI_ERROR_MESSAGES)) {
        const error = new GuiContractError(code);
        assert.equal(error.code, code);
        assert.match(error.message, /[a-záéíóúñ]/u);
        assert.equal(error.message.includes("node_modules"), false);
    }
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    assert.ok(packageJson.scripts["test:unit"].includes("test/gui.contract.test.js"));
    assert.equal(packageJson.dependencies?.["node-gtk"], undefined);
    assert.equal(packageJson.devDependencies?.["node-gtk"], undefined);
});

test("GUI: trazabilidad de las cuatro fuentes conserva contrato y alcance de las evidencias", async () => {
    const matrix = JSON.parse(await readFile(new URL("./fixtures/gui/contract-traceability.v1.json", import.meta.url), "utf8"));
    const suite = await readFile(new URL("./gui.contract.test.js", import.meta.url), "utf8");
    assert.equal(matrix.schemaVersion, 1);
    assert.equal(matrix.hashNormalization, "utf8-lf");
    assert.deepEqual(matrix.sources.map(source => source.name), [
        "docs/gui/architecture.md", "docs/gui/runtime-pipeline.md", "docs/gui/javascript-export.md", "docs/gui/api-catalog.md"
    ]);
    for (const source of matrix.sources) {
        assert.match(source.sha256, /^[a-f0-9]{64}$/u);
        const contents = await readFile(new URL(`../${source.name}`, import.meta.url), "utf8");
        assert.equal(
            createHash("sha256").update(contents.replace(/\r\n/gu, "\n")).digest("hex"),
            source.sha256,
            source.name
        );
    }
    const ids = new Set();
    for (const requirement of matrix.requirements) {
        assert.equal(ids.has(requirement.id), false);
        ids.add(requirement.id);
        assert.ok(matrix.sources.some(source => source.name === requirement.source));
        assert.ok(requirement.sections.length > 0);
        if (["contract-tested", "compiler-tested", "dependency-tested", "runtime-tested"].includes(requirement.status)) {
            const source = requirement.testFile
                ? await readFile(new URL(`../${requirement.testFile}`, import.meta.url), "utf8") : suite;
            assert.ok(source.includes(`test("${requirement.test}"`), requirement.id);
            await readFile(new URL(`../${requirement.implementation}`, import.meta.url));
            if (requirement.status === "runtime-tested") {
                const evidence = JSON.parse(await readFile(new URL(`../${requirement.evidence}`, import.meta.url), "utf8"));
                assert.equal(evidence.ok, true);
                assert.ok(evidence.notValidated.length > 0);
                assert.ok(requirement.evidenceCheck);
                assert.ok(evidence.checks.includes(requirement.evidenceCheck));
            }
        } else if (requirement.status === "native-validated") {
            await readFile(new URL(`../${requirement.implementation}`, import.meta.url));
            const evidence = JSON.parse(await readFile(new URL(`../${requirement.evidence}`, import.meta.url), "utf8"));
            assert.equal(evidence.native.ok, true);
            assert.equal(evidence.generated.ok, true);
            assert.equal(evidence.native.binding, NODE_GTK_RUNTIME_DEPENDENCY.version);
            assert.ok(evidence.native.checks.includes("synchronous-close-link-key-return"));
            assert.ok(evidence.notValidated.length > 0);
        } else {
            assert.equal(requirement.status, "deferred");
            assert.ok(requirement.blocks.every(block => block > 1 && block <= 14));
            assert.ok(requirement.reason.length > 0);
        }
    }
});
