import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { parseSource } from "../src/language/LanguageFrontend.js";
import { SemanticAnalyzer } from "../src/semantic/SemanticAnalyzer.js";
import { JavaScriptGenerator } from "../src/compiler/JavaScriptGenerator.js";
import { GUI_BINDING_LOAD_PROTOCOL, GuiPackableSourceError,
    createPackableGuiJavaScript } from "../src/compiler/gui/GuiBindingLoadSource.js";

function fakeRuntime() {
    return {
        invoke(name) { if (name === "MOSTRAR") { console.log("NORMAL"); } },
        async waitForIdle() {},
        async dispose() {}
    };
}

function packagedRuntime(binding) {
    if (binding?.packaged !== true) { throw new Error("El bootstrap no entregó el binding esperado."); }
    return {
        invoke(name) { if (name === "MOSTRAR") { console.log("PACKAGED"); } },
        async waitForIdle() {},
        async dispose() {}
    };
}

function generate(source, runtimeContext) {
    const ast = parseSource(source).ast;
    const semanticModel = new SemanticAnalyzer().analyze(ast);
    return new JavaScriptGenerator().generate(ast, { semanticModel, runtimeContext }).generatedCode;
}

function execute(source) {
    return spawnSync(process.execPath, ["--input-type=module"], {
        input: source,
        encoding: "utf8",
        windowsHide: true,
        timeout: 5_000
    });
}

function executePackable(source, bootstrap = "") {
    return execute(`
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
${bootstrap}
const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
await new AsyncFunction("require", ${JSON.stringify(source)})(require);
`);
}

const guiSource = 'PRINCIPAL()\n    VENTANA("v", "Prueba")\n    MOSTRAR("v")';
const normalContext = { gui: {
    moduleUrl: new URL("./fixtures/gui/binding-stub.mjs", import.meta.url).href,
    factorySource: fakeRuntime.toString()
} };

test("GUI pkg: el JavaScript normal expone una sola región v1 y conserva su ejecución Node", () => {
    const source = generate(guiSource, normalContext);
    assert.equal(GUI_BINDING_LOAD_PROTOCOL.version, 1);
    assert.equal(source.split(GUI_BINDING_LOAD_PROTOCOL.startMarker).length - 1, 1);
    assert.equal(source.split(GUI_BINDING_LOAD_PROTOCOL.endMarker).length - 1, 1);
    assert.equal(source.split(GUI_BINDING_LOAD_PROTOCOL.bindingDeclaration).length - 1, 1);
    assert.equal(source.includes(GUI_BINDING_LOAD_PROTOCOL.packagedLoaderProperty), false);
    assert.match(source, /import\.meta\.resolve/u);
    assert.match(source, /checkGuiEnvironmentIsolated/u);
    assert.match(source, /configureGuiPrivateEnvironment/u);
    const result = execute(source);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /NORMAL/u);
});

test("GUI pkg: la variante usa exclusivamente el loader del bootstrap", () => {
    const source = generate(guiSource, { gui: { moduleUrl: "node-gtk", factorySource: packagedRuntime.toString() } });
    const before = source;
    const packable = createPackableGuiJavaScript(source);
    assert.equal(source, before);
    assert.equal(packable.split(`globalThis.${GUI_BINDING_LOAD_PROTOCOL.packagedLoaderProperty}`).length - 1, 1);
    assert.doesNotMatch(packable, /import\.meta\.resolve|^\s*import\s+.*from/mu);
    assert.match(packable, /CLRS_GUI_PACKAGED_LOADER_MISSING/u);
    const bootstrap = `globalThis.${GUI_BINDING_LOAD_PROTOCOL.packagedLoaderProperty} = async () => ({ packaged: true });\n`;
    const result = executePackable(packable, bootstrap);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PACKAGED/u);
    assert.doesNotMatch(result.stderr, /CLRS_GUI_DEP_RESOLUTION_FAILED/u);
});

test("GUI pkg: la variante rechaza ejecución sin bootstrap", () => {
    const source = generate(guiSource, normalContext);
    const result = executePackable(createPackableGuiJavaScript(source));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CLRS_GUI_PACKAGED_LOADER_MISSING/u);
});

test("GUI pkg: la adaptación es determinista y no confunde literales del usuario con el protocolo", () => {
    const literal = `${GUI_BINDING_LOAD_PROTOCOL.startMarker} ${GUI_BINDING_LOAD_PROTOCOL.packagedLoaderProperty}`;
    const source = generate(`${guiSource}\n    escribir ${JSON.stringify(literal)}`, normalContext);
    assert.equal(createPackableGuiJavaScript(source), createPackableGuiJavaScript(source));
    const crlf = source.replaceAll("\n", "\r\n");
    const crlfPackable = createPackableGuiJavaScript(crlf);
    assert.equal(crlfPackable.includes("\r\n"), true);
    assert.doesNotMatch(crlfPackable.replaceAll("\r\n", ""), /\n/u);
});

test("GUI pkg: rechaza regiones ausentes, duplicadas, bindings duplicados y fuentes ya adaptadas", () => {
    const source = generate(guiSource, normalContext);
    const cases = [
        ["escribir 1", "CLRS_GUI_PACKABLE_INVALID_REGION"],
        [source.replace(GUI_BINDING_LOAD_PROTOCOL.endMarker,
            `${GUI_BINDING_LOAD_PROTOCOL.endMarker}\n${GUI_BINDING_LOAD_PROTOCOL.endMarker}`), "CLRS_GUI_PACKABLE_INVALID_REGION"],
        [source.replace(GUI_BINDING_LOAD_PROTOCOL.bindingDeclaration,
            `${GUI_BINDING_LOAD_PROTOCOL.bindingDeclaration}\n${GUI_BINDING_LOAD_PROTOCOL.bindingDeclaration}`), "CLRS_GUI_PACKABLE_INVALID_BINDING"],
        [createPackableGuiJavaScript(source), "CLRS_GUI_PACKABLE_ALREADY_ADAPTED"]
    ];
    for (const [candidate, code] of cases) {
        assert.throws(() => createPackableGuiJavaScript(candidate), error =>
            error instanceof GuiPackableSourceError && error.code === code);
    }
    assert.throws(() => createPackableGuiJavaScript(null), { code: "CLRS_GUI_PACKABLE_INVALID_SOURCE" });
});
