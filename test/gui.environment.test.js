import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { probeGuiEnvironment, guiEnvironmentMessage, decodeGuiProbeResult, getGuiEnvironmentSource, checkGuiRuntimeCompatibility,
    checkGuiEnvironmentIsolated } from "../src/standard-library/gui/runtime/GuiEnvironmentProbe.js";
import { GUI_ERROR_MESSAGES } from "../src/standard-library/gui/GuiErrors.js";
import { GUI_COMPONENTS } from "../src/standard-library/gui/GuiComponentCatalog.js";
import { GUI_FUNCTION_DEFINITIONS } from "../src/standard-library/gui/GuiFunctionCatalog.js";
import { getStandardLibraryContract, getStandardLibraryContractHelp } from "../src/standard-library/index.js";
import { parseSource } from "../src/language/LanguageFrontend.js";
import { SemanticAnalyzer } from "../src/semantic/SemanticAnalyzer.js";
import { JavaScriptGenerator } from "../src/compiler/JavaScriptGenerator.js";
import { getGuiRuntimeFactorySource } from "../src/standard-library/gui/runtime/GuiRuntimeSource.js";
import { GuiRuntimePreparation } from "../src/compiler/gui/GuiRuntimePreparation.js";
import { fakeGtk } from "./fixtures/gui/FakeGtk.js";

const forbidden = /GuiMediaAdapter|Gtk[.]?Video|Gtk[.]?Media(?:File|Stream)|\bGst\b|GStreamer|gui\.video|CLRS_GUI_MEDIA_|playbin|GST_PLUGIN_|GSTREAMER_|probe\.wav|\.avi/;
const analyze = source => { const ast = parseSource(source).ast; return { ast, semanticModel: new SemanticAnalyzer().analyze(ast) }; };
function nativeDouble() {
    const calls = [];
    const Gtk = new Proxy({ getMajorVersion: () => 4, getMinorVersion: () => 10, getMicroVersion: () => 0 }, {
        get(target, name) { assert.ok(Object.hasOwn(target, name), String(name)); return target[name]; }
    });
    const load = async () => { calls.push("load"); return { default: { require(name) {
        calls.push(name);
        if (name === "Gio") { return { SettingsSchemaSource: { getDefault: () => ({ lookup(id, recursive) {
            assert.equal(id, "org.gtk.gtk4.Settings.FileChooser"); assert.equal(recursive, true); return {};
        } }) } }; }
        assert.equal(name, "Gtk"); return Gtk;
    } } }; };
    return { Gtk, load, calls };
}

test("GUI público: 24 componentes, sin función, ayuda ni errores multimedia", () => {
    assert.equal(Object.keys(GUI_COMPONENTS).length, 24);
    assert.equal(Object.keys(GUI_FUNCTION_DEFINITIONS).length, 61);
    for (const name of ["VIDEO", "REPRODUCIR", "PAUSAR"]) {
        assert.equal(getStandardLibraryContract(name), null);
        assert.equal(getStandardLibraryContractHelp(name), null);
    }
    assert.doesNotMatch(JSON.stringify([GUI_COMPONENTS, GUI_FUNCTION_DEFINITIONS, GUI_ERROR_MESSAGES]), forbidden);
    for (const definition of Object.values(GUI_FUNCTION_DEFINITIONS)) { assert.deepEqual(definition.capabilities, ["gui"]); }
    assert.deepEqual(GUI_FUNCTION_DEFINITIONS.PARAR.componentTypes, ["Spinner"]);
});

test("GUI semántica: VIDEO es una función inexistente salvo declaración de usuario", () => {
    for (const name of ["NO_EXISTE", "VIDEO"]) {
        assert.throws(() => analyze(name + '("v", "x")'), { code: "CLRS_UNDEFINED_IDENTIFIER" });
    }
    for (const source of ['escribir "VIDEO(a,b)"', 'VIDEO(a,b)\n    retornar a\nPRINCIPAL()\n    escribir VIDEO(1,2)']) {
        assert.deepEqual(analyze(source).semanticModel.gui.usage.capabilities, []);
    }
    assert.deepEqual(analyze('BOTON("b","x")').semanticModel.gui.usage.capabilities, ["gui"]);
});

test("GUI entorno: sin GUI no carga nada; GUI comprueba binding, versión GTK y GSettings", async () => {
    const fake = nativeDouble();
    assert.equal((await probeGuiEnvironment("binding", [], fake.load)).ok, true);
    assert.deepEqual(fake.calls, []);
    assert.equal((await checkGuiEnvironmentIsolated("inexistente", [], GUI_ERROR_MESSAGES)).ok, true);
    assert.equal((await probeGuiEnvironment("binding", ["gui"], fake.load)).ok, true);
    assert.deepEqual(fake.calls, ["load", "Gtk", "Gio"]);
    assert.doesNotMatch(getGuiEnvironmentSource(), forbidden);
});

test("GUI entorno: el proyecto exportado rechaza Node o plataforma fuera del contrato antes del addon", async () => {
    for (const runtime of [{ versions: { node: "20.0.0" }, platform: "win32", arch: "x64" },
        { versions: { node: "24.1.0" }, platform: "freebsd", arch: "x64" }, { versions: {}, platform: "linux", arch: "x64" },
        { versions: { node: "24.1.0" }, platform: "linux", arch: "ia32" }]) {
        assert.deepEqual(checkGuiRuntimeCompatibility(runtime), {
            ok: false, code: "CLRS_GUI_DEP_NODE_UNSUPPORTED", phase: "node",
            detail: `Node ${runtime.versions.node ?? "desconocido"} / ${runtime.platform} / ${runtime.arch}`
        });
    }
    assert.deepEqual(checkGuiRuntimeCompatibility({ versions: { node: "24.1.0" }, platform: "win32", arch: "x64" }), { ok: true });
});

test("GUI entorno: distingue binding, GTK ausente, GTK antiguo y terminación nativa", async () => {
    const fake = nativeDouble();
    assert.equal((await probeGuiEnvironment("binding", ["gui"], async () => { throw new Error("ABI"); })).code, "CLRS_GUI_DEP_NATIVE_LOAD_FAILED");
    assert.equal((await probeGuiEnvironment("binding", ["gui"], async () => ({ require() { throw new Error("typelib"); } }))).code, "CLRS_GUI_DEP_GTK_NOT_FOUND");
    fake.Gtk.getMinorVersion = () => 8;
    assert.equal((await probeGuiEnvironment("binding", ["gui"], fake.load)).code, "CLRS_GUI_DEP_GTK_TOO_OLD");
    assert.equal(decodeGuiProbeResult({ code: 134, stdout: '{"phase":"gtk"}', stderr: "private" }).code, "CLRS_GUI_DEP_GTK_NOT_FOUND");
});

test("GUI diagnósticos: orientación GTK por plataforma sin recomendaciones multimedia", () => {
    const message = platform => guiEnvironmentMessage("CLRS_GUI_DEP_GTK_NOT_FOUND", GUI_ERROR_MESSAGES, platform);
    assert.match(message("win32"), /empaquetadas/); assert.doesNotMatch(message("win32"), /Instala GTK/);
    assert.match(message("linux"), /gestor de paquetes de tu distribución/);
    assert.match(message("darwin"), /macOS/);
    for (const code of Object.keys(GUI_ERROR_MESSAGES)) {
        for (const platform of ["win32", "linux", "darwin"]) { assert.doesNotMatch(guiEnvironmentMessage(code, GUI_ERROR_MESSAGES, platform), forbidden); }
    }
});

test("GUI GSettings: fuente nula, ID ausente, excepción y terminación son errores de recursos", async () => {
    for (const source of [null, { lookup: () => null }, { lookup() { throw new Error("privado"); } }]) {
        const fake = nativeDouble();
        const result = await probeGuiEnvironment("binding", ["gui"], async () => ({ require(name) {
            return name === "Gtk" ? fake.Gtk : { SettingsSchemaSource: { getDefault: () => source } };
        } }));
        assert.equal(result.code, "CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE");
        assert.equal(result.phase, "schemas");
    }
    assert.equal(decodeGuiProbeResult({ code: 134, stdout: '{"phase":"schemas"}', stderr: "native" }).code,
        "CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE");
    const message = platform => guiEnvironmentMessage("CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE", GUI_ERROR_MESSAGES, platform);
    assert.match(message("win32"), /distribución privada/);
    for (const platform of ["linux", "darwin"]) {
        assert.doesNotMatch(message(platform), /distribución privada|CLRS intentará|MSVC/);
    }
});

test("GUI Windows: probe configura sólo su entorno privado y no acepta rutas externas heredadas", { skip: process.platform !== "win32" }, async t => {
    const root = await mkdtemp(path.join(tmpdir(), "clrs-schema-env-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const lib = path.join(root, "lib");
    const bundle = path.join(lib, "binding", `node-v${process.versions.modules}-win32-${process.arch}`);
    const share = path.join(bundle, "share");
    await mkdir(path.join(bundle, "girepository-1.0"), { recursive: true });
    const entry = path.join(lib, "index.mjs");
    await writeFile(entry, `import assert from 'node:assert/strict';
        assert.equal(process.env.XDG_DATA_DIRS, ${JSON.stringify(share)});
        assert.equal(process.env.GSETTINGS_SCHEMA_DIR, ${JSON.stringify(path.join(share, "glib-2.0/schemas"))});
        export default {require(name) {return name==='Gtk'
            ? {getMajorVersion:()=>4,getMinorVersion:()=>10,getMicroVersion:()=>0}
            : {SettingsSchemaSource:{getDefault:()=>({lookup:()=>({})})}}}};`);
    const { pathToFileURL } = await import("node:url");
    const { guiProbeSource } = await import("../src/standard-library/gui/runtime/GuiEnvironmentProbe.js");
    const before = { schema: process.env.GSETTINGS_SCHEMA_DIR, xdg: process.env.XDG_DATA_DIRS };
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", guiProbeSource(pathToFileURL(entry).href, ["gui"])], {
        env: { ...process.env, GSETTINGS_SCHEMA_DIR: "external-schema", XDG_DATA_DIRS: "external-data" },
        encoding: "utf8", windowsHide: true, timeout: 10000
    });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(decodeGuiProbeResult(child).ok, true);
    assert.deepEqual({ schema: process.env.GSETTINGS_SCHEMA_DIR, xdg: process.env.XDG_DATA_DIRS }, before);
});

test("GUI preparación: sólo provisiona npm y GTK sin comprobaciones adicionales", async () => {
    const calls = [];
    const preparation = new GuiRuntimePreparation({ dependencyManager: {
        async ensure() { calls.push("ensure"); return { entryUrl: "file:///binding.js" }; },
        async checkCapabilities() { assert.fail("No debe comprobar otras capacidades"); }
    }, getFactorySource: () => "factory" });
    await preparation.prepare(analyze("escribir 1")); assert.deepEqual(calls, []);
    await preparation.prepare(analyze('BOTON("b","x")')); assert.deepEqual(calls, ["ensure"]);
});

test("GUI runtime: IMAGEN y PARAR funcionan sin adaptador multimedia", async () => {
    const native = fakeGtk();
    const images = [];
    native.Gtk.Image = class extends native.Gtk.Box {
        static newFromFile(file) { const image = new this(); image.file = file; images.push(image); return image; }
        setFromFile(file) { this.file = file; }
        setPixelSize(size) { this.size = size; }
        getPixelSize() { return this.size; }
        clear() { this.file = null; }
    };
    native.Gtk.Spinner = class extends native.Gtk.Box {
        start() { this.active = true; }
        stop() { this.active = false; }
        getSpinning() { return this.active; }
    };
    const original = native.binding.default.require;
    native.binding.default.require = (name, version) => { assert.notEqual(name, "Gst"); return original(name, version); };
    for (const key of ["Video", "MediaFile", "MediaStream"]) {
        Object.defineProperty(native.Gtk, key, { get() { assert.fail("Acceso multimedia"); } });
    }
    const runtime = getGuiRuntimeFactorySource(); assert.doesNotMatch(runtime, forbidden);
    const session = await Function("return (" + runtime + ")")()(native.binding, {});
    try {
        assert.throws(() => session.invoke("VIDEO", ["id", "x"]));
        session.invoke("IMAGEN", ["id", "imagen.png"]);
        session.invoke("ESTABLECER", ["id", "tamano_pixel", 24]);
        assert.equal(session.invoke("OBTENER", ["id", "tamano_pixel"]), 24);
        session.invoke("LIMPIAR_IMAGEN", ["id"]);
        assert.equal(images[0].file, null);
        session.invoke("ESTABLECER", ["id", "archivo", "otra.png"]);
        assert.equal(images[0].file, "otra.png");
        session.invoke("INDICADOR_CARGA", ["carga"]);
        session.invoke("INICIAR", ["carga"]); session.invoke("PARAR", ["carga"]);
        assert.equal(session.invoke("OBTENER", ["carga", "activo"]), false);
    } finally { await session.dispose(); }
});

test("GUI generación y bundling: grafo productivo sin archivos ni código multimedia", async () => {
    const result = await build({ entryPoints: ["src/compiler/gui/GuiJavaScriptAssembly.js", "src/compiler/gui/GuiRuntimePreparation.js"],
        outdir: "unused-output", bundle: true, write: false, metafile: true, platform: "node", format: "esm", logLevel: "silent" });
    assert.doesNotMatch(JSON.stringify(Object.keys(result.metafile.inputs)), /internal[/]gui-media|GuiMediaAdapter/);
    for (const output of result.outputFiles) { assert.doesNotMatch(output.text, forbidden); }
    const source = 'PRINCIPAL()\n    IMAGEN("imagen", "foto.png")\n    LIMPIAR_IMAGEN("imagen")';
    const generator = new JavaScriptGenerator();
    const generated = generator.generate(analyze(source).ast, { runtimeContext: { gui: { moduleUrl: "node-gtk", factorySource: getGuiRuntimeFactorySource() } } }).generatedCode;
    assert.doesNotMatch(generated, forbidden);
    assert.doesNotMatch(generator.generate(analyze("escribir 1").ast).generatedCode, /node-gtk|probeGuiEnvironment|createGuiBaseRuntime/);
});

test("GUI exportada: GTK a stderr sin VS Code ni multimedia y única dependencia node-gtk", async t => {
    const root = await mkdtemp(path.join(tmpdir(), "clrs-export-environment-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ private: true, type: "module", scripts: { start: "node programa.js" }, dependencies: { "node-gtk": "4.1.1" } }));
    const dependency = path.join(root, "node_modules/node-gtk"); await mkdir(dependency, { recursive: true });
    await writeFile(path.join(dependency, "package.json"), '{"name":"node-gtk","version":"4.1.1","type":"module","exports":"./index.js"}');
    await writeFile(path.join(dependency, "index.js"), 'export default {require(){throw new Error("private GTK typelib")}}');
    const generated = new JavaScriptGenerator().generate(analyze('BOTON("b","x")').ast, { runtimeContext: { gui: { moduleUrl: "node-gtk", factorySource: getGuiRuntimeFactorySource() } } }).generatedCode;
    assert.doesNotMatch(generated, forbidden);
    await writeFile(path.join(root, "programa.js"), generated);
    const result = spawnSync(process.execPath, ["programa.js"], { cwd: root, encoding: "utf8", windowsHide: true, timeout: 15000 });
    assert.equal(result.status, 70, result.stderr); assert.match(result.stderr, /CLRS_GUI_DEP_GTK_NOT_FOUND/);
    assert.doesNotMatch(result.stderr, /private GTK|at probeGuiEnvironment|UnhandledPromise/);
    assert.doesNotMatch(result.stderr, forbidden);
    assert.deepEqual(JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).dependencies, { "node-gtk": "4.1.1" });
});
