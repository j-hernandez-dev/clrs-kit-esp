import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { parseSource } from "../src/language/LanguageFrontend.js";
import { SemanticAnalyzer } from "../src/semantic/SemanticAnalyzer.js";
import { detectGuiUsage } from "../src/semantic/gui/GuiUsageDetector.js";
import { JavaScriptGenerator } from "../src/compiler/JavaScriptGenerator.js";
import { CompilationService } from "../src/compiler/services/CompilationService.js";
import { createGuiCallbackReference, invokeGuiCallback } from "../src/compiler/gui/GuiCallbackBridge.js";
import { standartLibrary, dependencies, endProgram } from "../src/compiler/StandartLibrary.js";
import { SYNCHRONOUS_STANDARD_FUNCTIONS } from "../src/standard-library/StandardLibraryInvocation.js";
import { getGuiRuntimeFactorySource } from "../src/standard-library/gui/runtime/GuiRuntimeSource.js";

function analyze(source) {
    const ast = parseSource(source).ast;
    return { ast, semanticModel: new SemanticAnalyzer().analyze(ast) };
}
function code(source, options = {}) {
    const { ast, semanticModel } = analyze(source);
    return new JavaScriptGenerator().generate(ast, { semanticModel, ...options });
}
function hasCode(error, code) { return error.code === code || error.diagnostics?.some(diagnostic => diagnostic.code === code); }

// Puerto de prueba del futuro runtime, no implementación de la API gráfica.
function fakeRuntime(_binding, { invokeCallback, programKey }) {
    const listeners = [];
    const pending = [];
    return {
        invoke(name, args) {
            if (name === "CONECTAR") { listeners.push(args); }
            if (name === "MOSTRAR") {
                for (const [id, event, reference] of listeners) {
                    const result = invokeCallback(reference, id, [], event === "cerrar");
                    if (result && typeof result.then === "function") { pending.push(result); }
                    else { console.log("RETORNO", result); }
                }
            }
            if (name === "ABRIR_ARCHIVO") { return Promise.resolve("ruta-local"); }
            if (name === "OBTENER") { return true; }
        },
        async waitForIdle() { await Promise.all(pending); console.log("IDLE", programKey); },
        dispose() { console.log("DISPOSE"); }
    };
}
const runtimeContext = { gui: {
    moduleUrl: new URL("./fixtures/gui/binding-stub.mjs", import.meta.url).href,
    factorySource: fakeRuntime.toString()
} };
function execute(generatedCode) {
    const result = spawnSync(process.execPath, ["--input-type=module"], {
        input: generatedCode, encoding: "utf8", timeout: 5000, windowsHide: true
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
}

test("GUI semántica: nombres estándar, aridad y dominios sin cambios al AST", () => {
    const ast = parseSource('PRINCIPAL()\n    BOTON("b", "Aceptar")\n    ESTABLECER_MODO_TEMA("oscuro")').ast;
    const before = JSON.stringify(ast);
    const model = new SemanticAnalyzer().analyze(ast);
    assert.equal(JSON.stringify(ast), before);
    assert.deepEqual(model.gui.usage.functionNames, ["BOTON", "ESTABLECER_MODO_TEMA"]);
    for (const [source, error] of [
        ['BOTON("b")', "CLRS_GUI_INVALID_ARGUMENT"], ['BOTON(1, "b")', "CLRS_GUI_INVALID_ID"],
        ['ESTABLECER_MODO_TEMA("dark")', "CLRS_GUI_INVALID_THEME_MODE"],
        ['ESTABLECER_TEMA(3)', "CLRS_GUI_INVALID_THEME_NAME"],
        ['CAJA("c", "horizontal", -1)', "CLRS_GUI_INVALID_ARGUMENT"],
        ['ENTRADA_NUMERICA("e", 10, 1, 1)', "CLRS_GUI_INVALID_ARGUMENT"]
    ]) { assert.throws(() => analyze(source), failure => hasCode(failure, error)); }
    assert.doesNotThrow(() => analyze('CONFIGURA(id, tema)\n    BOTON(id, "a")\n    ESTABLECER_TEMA(tema)'));
});

test("GUI detección: sólo llamadas estándar resueltas, no texto, alias ni símbolos homónimos", () => {
    for (const source of [
        'escribir "BOTON(123)"', '// VENTANA("v", "x")\nescribir 1',
        'BOTON(a)\n    retornar a\nPRINCIPAL()\n    BOTON(1)',
        'PRUEBA(BOTON)\n    BOTON(1)',
        'OTRA()\n    BOTON = 1\n    escribir BOTON'
    ]) {
        const { ast, semanticModel } = analyze(source);
        assert.equal(detectGuiUsage(ast, semanticModel).requiresGui, false, source);
    }
    const unreachable = analyze('NO_USADA()\n    BOTON("b", "a")');
    assert.equal(unreachable.semanticModel.gui.usage.requiresGui, true);
    assert.equal(analyze('tema = OBTENER_TEMA()').semanticModel.gui.usage.requiresGui, true);
    const nested = analyze('PRINCIPAL()\n    valores = [[OBTENER("b", "texto")]]');
    assert.deepEqual(nested.semanticModel.gui.usage.functionNames, ["OBTENER"]);
    assert.throws(() => analyze('alias = BOTON'), error => hasCode(error, "CLRS_GUI_FUNCTION_REFERENCE_NOT_ALLOWED"));
    assert.throws(() => analyze('lista = [BOTON]'), error => hasCode(error, "CLRS_GUI_FUNCTION_REFERENCE_NOT_ALLOWED"));
});

test("GUI callbacks: sólo identificador de función CLRS en la posición especial de CONECTAR", () => {
    const prefix = 'AL_CLIC(id)\n    retornar VERDAD\n';
    for (const expression of ['"AL_CLIC"', 'AL_CLIC("b")', '1', '[AL_CLIC]', 'LONG']) {
        assert.throws(() => analyze(prefix + `CONECTAR("b", "clic", ${expression})`), error => hasCode(error, "CLRS_GUI_INVALID_CALLBACK"));
    }
    assert.throws(() => analyze('REGISTRA(callback)\n    CONECTAR("b", "clic", callback)'), error => hasCode(error, "CLRS_GUI_INVALID_CALLBACK"));
    assert.throws(() => analyze(prefix + 'AL_CLIC = 2\nCONECTAR("b", "clic", AL_CLIC)'), error => hasCode(error, "CLRS_GUI_INVALID_CALLBACK"));
    assert.doesNotThrow(() => analyze(prefix + 'CONECTAR("b", "clic", AL_CLIC)'));
    // Una función del usuario llamada CONECTAR no adquiere reglas GUI.
    assert.equal(analyze('CONECTAR(x)\n    retornar x\nPRINCIPAL()\n    CONECTAR(2)').semanticModel.gui.usage.requiresGui, false);
});

test("GUI callbacks: propaga suspensión transitiva, recursión y eventos dinámicos", () => {
    const prefix = 'LEE()\n    a = 0\n    leer a\nAL_CERRAR(id)\n    LEE()\n    retornar VERDAD\n';
    assert.throws(() => analyze(prefix + 'CONECTAR("v", "cerrar", AL_CERRAR)'), error => hasCode(error, "CLRS_GUI_CALLBACK_REQUIRES_SYNC"));
    const dynamic = analyze(prefix + 'REGISTRA(evento)\n    CONECTAR("v", evento, AL_CERRAR)');
    assert.equal(dynamic.semanticModel.gui.synchronousFunctions.size, 0);
    const recursion = analyze('A(n)\n    si n > 0\n        retornar A(n - 1)\n    retornar VERDAD\nAL_CERRAR(id)\n    retornar A(2)\nCONECTAR("v", "cerrar", AL_CERRAR)');
    assert.equal(recursion.semanticModel.gui.synchronousFunctions.size, 2);
    assert.throws(() => analyze('AL_CERRAR(id)\n    retornar ABRIR_ARCHIVO("d", "v")\nCONECTAR("v", "cerrar", AL_CERRAR)'), error => hasCode(error, "CLRS_GUI_CALLBACK_REQUIRES_SYNC"));
});

test("GUI generación: callbacks síncronos conservan llamadas, closures y nombres higiénicos", () => {
    const result = code('AYUDA(texto)\n    retornar LONG(texto) > 0\nAL_CERRAR(id)\n    retornar AYUDA(id)\nPRINCIPAL()\n    VENTANA("v", "Prueba")\n    CONECTAR("v", "cerrar", AL_CERRAR)\n    MOSTRAR("v")', { runtimeContext });
    assert.deepEqual(result.requiredCapabilities, ["gui"]);
    assert.match(result.userCode, /\$clrs\$gui\$callback\(\$clrs\$/u);
    assert.match(result.generatedCode, /\nfunction LONG\(/u);
    assert.match(result.userCode, /return LONG\(/u);
    const output = execute(result.generatedCode);
    assert.match(output, /RETORNO true/u);
    assert.match(output, /IDLE .+\nDISPOSE/u);
    const second = execute(result.generatedCode);
    assert.notEqual(output.match(/IDLE (.+)/u)[1], second.match(/IDLE (.+)/u)[1]);
});

test("GUI generación: callback informativo permite await de diálogos y espera antes de finalizar", () => {
    const result = code('AL_CLIC(id)\n    ruta = ABRIR_ARCHIVO("d", "v")\n    escribir ruta\nPRINCIPAL()\n    BOTON("b", "Prueba")\n    CONECTAR("b", "clic", AL_CLIC)\n    MOSTRAR("b")', { runtimeContext });
    assert.match(result.userCode, /await ABRIR_ARCHIVO/u);
    assert.match(execute(result.generatedCode), /ruta-local\nIDLE .+\nDISPOSE/u);
});

test("GUI generación: callback anidado conserva la closure tras regresar su función contenedora", () => {
    const result = code('REGISTRA()\n    esperado = "ventana original"\n    AL_CERRAR(id)\n        retornar id == esperado y LONG(id) > 0\n    CONECTAR(esperado, "cerrar", AL_CERRAR)\nPRINCIPAL()\n    VENTANA("ventana original", "Prueba")\n    REGISTRA()\n    MOSTRAR("ventana original")', { runtimeContext });
    assert.match(execute(result.generatedCode), /RETORNO true/u);
});

test("GUI generación: error limpia la sesión y no filtra rechazos sin manejar", () => {
    const result = code('AL_CLIC(id)\n    LANZAR_ERROR("Fallo localizado")\nPRINCIPAL()\n    BOTON("b", "Prueba")\n    CONECTAR("b", "clic", AL_CLIC)\n    MOSTRAR("b")', { runtimeContext });
    const child = spawnSync(process.execPath, ["--input-type=module"], { input: result.generatedCode, encoding: "utf8", timeout: 5000, windowsHide: true });
    assert.equal(child.status, 70);
    assert.match(child.stdout, /DISPOSE/u);
    assert.match(child.stderr, /Fallo localizado/u);
    assert.doesNotMatch(child.stderr, /UnhandledPromiseRejection/u);
});

test("GUI generación: sin contexto falla antes de escribir y sin GUI conserva el ensamblado histórico", async () => {
    let writes = 0;
    const service = new CompilationService({ fileEmitter: { writeArtifact() { writes += 1; } } });
    const result = await service.tryCompileSource('BOTON("b", "a")', 'prueba.clrs', { temporary: true });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "CLRS_GUI_RUNTIME_NOT_READY");
    assert.equal(writes, 0);
    const pure = code('PRINCIPAL()\n    escribir LONG("abc")');
    assert.equal(pure.generatedCode, dependencies + standartLibrary + pure.userCode + endProgram);
    assert.doesNotMatch(pure.generatedCode, /node-gtk|\$clrs\$gui/u);
    assert.deepEqual(pure.requiredCapabilities, []);
    const artifact = await service.compileSource('BOTON("b", "a")', 'prueba.clrs', { temporary: true, runtimeContext });
    assert.deepEqual(artifact.requiredCapabilities, ["gui"]);
    assert.equal(writes, 1);
    assert.throws(() => code('BOTON("b", "a")', { runtimeContext: { gui: { ...runtimeContext.gui, moduleUrl: "https://example.com/a.js" } } }), error => error.code === "CLRS_GUI_DEP_RESOLUTION_FAILED");
});

test("GUI bridge: no invoca callbacks async para retornos inmediatos ni convierte Promises a booleano", async () => {
    let ran = false;
    const ref = createGuiCallbackReference(async () => { ran = true; return true; }, false, { startLine: 2 });
    assert.throws(() => invokeGuiCallback(ref, "v", [], true), error => error.code === "CLRS_GUI_CALLBACK_REQUIRES_SYNC");
    assert.equal(ran, false);
    assert.equal(await invokeGuiCallback(ref, "v", []), true);
    for (const value of [Promise.resolve(true), 1, "true"]) {
        assert.throws(() => invokeGuiCallback(createGuiCallbackReference(() => value, true, null), "v", [], true));
    }
    assert.equal(invokeGuiCallback(createGuiCallbackReference(() => undefined, true, null), "v", [], true), false);
    assert.equal(invokeGuiCallback(createGuiCallbackReference(id => id === "original", true, null), "original", [], true), true);
});

test("GUI bridge: capacidades síncronas estándar no incluyen implementaciones que usan await", () => {
    for (const name of SYNCHRONOUS_STANDARD_FUNCTIONS) {
        const match = standartLibrary.match(new RegExp(`(?:async )?function ${name}\\([^]*?(?=\\n(?:async )?function |$)`, "u"));
        assert.ok(match, name);
        assert.doesNotMatch(match[0], /\bawait\b/u, name);
    }
});

const completeRuntimeContext = { gui: {
    moduleUrl: new URL("./fixtures/gui/binding-events-stub.mjs", import.meta.url).href,
    factorySource: getGuiRuntimeFactorySource()
} };

test("GUI bloque 7: JavaScript generado ejecuta callback, await de diálogo y cierre con runtime canónico", () => {
    const result = code([
        "AL_CAMBIO(id, texto)", '    archivo = ABRIR_ARCHIVO("f", "v")', "    escribir texto, archivo", '    CERRAR("v")',
        "PRINCIPAL()", '    VENTANA_APLICACION("v", "Prueba")', '    ENTRADA("e")', '    DIALOGO_ARCHIVO("f")',
        '    CONTENER("v", "e")', '    CONECTAR("e", "cambio", AL_CAMBIO)', '    MOSTRAR("v")',
        '    ESTABLECER("e", "texto", "CALLBACK")'
    ].join("\n"), { runtimeContext: completeRuntimeContext });
    assert.match(execute(result.generatedCode), /CALLBACK.*\/seleccion.txt/);
    assert.doesNotMatch(result.generatedCode, /GuiMediaAdapter|GStreamer|Gtk\.Video|gui\.video/);
});

test("GUI bloque 7: JavaScript generado espera diálogos sin ventana y retorna valores CLRS", () => {
    const result = code([
        "PRINCIPAL()", '    DIALOGO_ALERTA("a", "Elige")', '    ESTABLECER("a", "botones", ["No", "Sí"])',
        '    eleccion = ELEGIR_ALERTA("a", NULO)', "    escribir eleccion", '    DIALOGO_ARCHIVO("f")',
        '    rutas = ABRIR_ARCHIVOS("f", NULO)', "    escribir rutas[0]"
    ].join("\n"), { runtimeContext: completeRuntimeContext });
    assert.match(execute(result.generatedCode), /1[\s\S]*\/seleccion.txt/);
});

test("GUI bloque 7: errores async y recursos nativos ausentes salen por el canal CLRS", () => {
    const sources = [
        ['AL_CAMBIO(id, texto)\n    LANZAR_ERROR("Callback fallido")\nPRINCIPAL()\n    ENTRADA("e")\n    CONECTAR("e", "cambio", AL_CAMBIO)\n    ESTABLECER("e", "texto", "x")', /Callback fallido/, {}],
        ['PRINCIPAL()\n    DIALOGO_ARCHIVO("f")\n    archivo = ABRIR_ARCHIVO("f", NULO)', /recursos de configuración/, { CLRS_GUI_TEST_MISSING_SCHEMAS: "1" }]
    ];
    for (const [source, message, env] of sources) {
        const result = code(source, { runtimeContext: completeRuntimeContext });
        const child = spawnSync(process.execPath, ["--input-type=module"], { input: result.generatedCode,
            encoding: "utf8", windowsHide: true, timeout: 5000, env: { ...process.env, ...env } });
        assert.equal(child.error, undefined);
        assert.equal(child.status, 70, child.stderr);
        assert.match(child.stderr, message);
        assert.doesNotMatch(child.stderr, /UnhandledPromiseRejection|TypeError|node_modules/);
    }
});
