import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { JavaScriptGenerator } from "../src/compiler/JavaScriptGenerator.js";
import { parseSource } from "../src/language/LanguageFrontend.js";
import { SemanticAnalyzer } from "../src/semantic/SemanticAnalyzer.js";
import { getGuiRuntimeFactorySource } from "../src/standard-library/gui/runtime/GuiRuntimeSource.js";
import { checkGuiRuntimeCompatibility, guiEnvironmentMessage, probeGuiEnvironment } from "../src/standard-library/gui/runtime/GuiEnvironmentProbe.js";
import { GUI_COMPONENTS, GUI_ERROR_MESSAGES } from "../src/standard-library/index.js";
import { GUI_FUNCTION_DEFINITIONS } from "../src/standard-library/gui/GuiFunctionCatalog.js";

const corpus = JSON.parse(await source("test/fixtures/gui/acceptance-corpus.v1.json"));
const binding = new URL("./fixtures/gui/binding-testing-stub.mjs", import.meta.url).href;
const forbidden = /GuiMediaAdapter|Gtk\.Video|GStreamer|gui\.video|GSTREAMER_|\bGst\b/u;

test("GUI corpus: todas las áreas y evidencias forman parte del cierre de publicación", async () => {
    assert.equal(corpus.schemaVersion, 1);
    assert.equal(Object.keys(GUI_COMPONENTS).length, corpus.components);
    assert.equal(Object.keys(GUI_FUNCTION_DEFINITIONS).length, corpus.functions);
    assert.deepEqual(Object.keys(corpus.areas), ["contract-semantics", "private-environment", "runtime-controls",
        "events-dialogs", "debugging", "editor-diagram", "costs", "testing-broker95", "standalone-export", "cross-platform"]);
    const { scripts } = JSON.parse(await source("package.json"));
    const visited = new Set(), commands = [];
    function visit(name) {
        if (visited.has(name)) { return; }
        visited.add(name);
        assert.equal(typeof scripts[name], "string", name);
        if (scripts[`pre${name}`]) { visit(`pre${name}`); }
        commands.push(scripts[name]);
        for (const match of scripts[name].matchAll(/npm run ([\w:-]+)/gu)) { visit(match[1]); }
    }
    visit("release:check");
    const executed = new Set(commands.join(" ").match(/test\/[\w.-]+\.test\.js/gu));
    for (const files of Object.values(corpus.areas)) {
        assert.ok(files.length);
        for (const file of files) {
            assert.ok(executed.has(file), `Evidencia fuera del release: ${file}`);
            assert.match(await source(file), /\btest\(/u);
        }
    }
    assert.doesNotMatch(commands.join(" "), /scripts\/gui\/validate-|internal\/gui-media/u);
});

for (const scenario of corpus.scenarios) {
    test(`GUI corpus: ${scenario.id}, LF/CRLF y equivalencia de ejecución con binding privado o local`, async t => {
        const root = await mkdtemp(path.join(tmpdir(), "clrs corpus José # "));
        t.after(() => rm(root, { recursive: true, force: true }));
        const input = await source(`test/fixtures/gui/scenarios/${scenario.file}`);
        const dependency = path.join(root, "node_modules/node-gtk");
        if (scenario.gui) {
            await mkdir(dependency, { recursive: true });
            await writeFile(path.join(dependency, "package.json"), JSON.stringify({ name: "node-gtk", version: "4.1.1", type: "module", exports: "./index.js" }));
            // Sólo se sustituye GTK. Semántica, runtime generado y proceso Node son reales.
            await writeFile(path.join(dependency, "index.js"), `export { default } from ${JSON.stringify(binding)};`);
        }
        for (const separator of ["\n", "\r\n"]) {
            const ast = parseSource(input.replace(/\r?\n/gu, separator)).ast;
            const semanticModel = new SemanticAnalyzer().analyze(ast);
            assert.equal(semanticModel.gui.usage.requiresGui, scenario.gui);
            for (const moduleUrl of [binding, "node-gtk"]) {
                const result = new JavaScriptGenerator().generate(ast, { semanticModel,
                    runtimeContext: scenario.gui ? { gui: { moduleUrl, factorySource: getGuiRuntimeFactorySource() } } : undefined });
                assert.doesNotMatch(result.generatedCode, forbidden);
                if (!scenario.gui) { assert.doesNotMatch(result.generatedCode, /node-gtk|checkGuiEnvironment|createGuiBaseRuntime/u); }
                const entry = path.join(root, "programa.mjs");
                await writeFile(entry, result.generatedCode);
                const child = spawnSync(process.execPath, [entry], { cwd: tmpdir(), encoding: "utf8", timeout: 15_000, windowsHide: true });
                assert.equal(child.error, undefined);
                assert.equal(child.status, 0, child.stderr);
                assert.equal(child.stdout.replace(/\r\n/gu, "\n"), scenario.stdout);
                assert.doesNotMatch(child.stderr, /UnhandledPromise|Gtk.*CRITICAL/u);
            }
        }
    });
}

test("GUI corpus: política de plataforma y fallos de GTK/GSettings sin gestores nativos", async () => {
    for (const platform of ["win32", "linux", "darwin"]) {
        for (const major of [22, 24, 26]) {
            for (const arch of ["x64", "arm64"]) {
                assert.equal(checkGuiRuntimeCompatibility({ versions: { node: `${major}.0.0` }, platform, arch }).ok, true);
            }
        }
        assert.equal(checkGuiRuntimeCompatibility({ versions: { node: "20.0.0" }, platform, arch: "x64" }).ok, false);
        const message = guiEnvironmentMessage("CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE", GUI_ERROR_MESSAGES, platform);
        assert.match(message, new RegExp({ win32: "Windows", linux: "Linux", darwin: "macOS" }[platform], "u"));
        assert.doesNotMatch(message, /GStreamer|Development|SDK/u);
        if (platform === "win32") { assert.match(message, /privada/u); }
        else { assert.match(message, /no modifica los paquetes del sistema/u); }
    }
    for (const failure of ["gtk", "version", "schemas"]) {
        const calls = [];
        const report = await probeGuiEnvironment("fixture", ["gui"], async () => ({ default: { require(name) {
            calls.push(name);
            if (failure === "gtk") { throw new Error("private native detail"); }
            if (name === "Gtk") { return { getMajorVersion: () => 4, getMinorVersion: () => failure === "version" ? 8 : 10, getMicroVersion: () => 0 }; }
            return { SettingsSchemaSource: { getDefault: () => ({ lookup: () => null }) } };
        } } }));
        assert.equal(report.code, { gtk: "CLRS_GUI_DEP_GTK_NOT_FOUND", version: "CLRS_GUI_DEP_GTK_TOO_OLD", schemas: "CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE" }[failure]);
        assert.ok(calls.every(name => ["Gtk", "Gio"].includes(name)));
    }
});

function source(file) { return readFile(new URL(`../${file}`, import.meta.url), "utf8"); }
