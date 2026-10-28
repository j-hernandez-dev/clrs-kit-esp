import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CompilationService } from "../src/compiler/services/CompilationService.js";
import { CompilationArtifact } from "../src/compiler/CompilationArtifact.js";
import { CliJavaScriptProjectExporter } from "../src/compiler/export/CliJavaScriptProjectExporter.js";
import { JavaScriptProjectExporter } from "../src/compiler/export/JavaScriptProjectExporter.js";
import { JavaScriptProjectExportRouter } from "../src/compiler/export/JavaScriptProjectExportRouter.js";
import { NpmPackageLockAdapter } from "../src/compiler/export/NpmPackageLockAdapter.js";
import { JAVASCRIPT_EXPORT_ROOT_DIRECTORY, createJavaScriptProjectDescriptor,
    createJavaScriptProjectIdentity, validJavaScriptProjectLock } from "../src/compiler/export/JavaScriptProjectDescriptor.js";
import { JavaScriptExportError } from "../src/compiler/export/JavaScriptExportError.js";
import { GuiDependencyError } from "../src/infrastructure/gui/GuiDependencyError.js";
import { getGuiRuntimeFactorySource } from "../src/standard-library/gui/runtime/GuiRuntimeSource.js";
import { VSCodeCodeHost } from "../extension/adapters/VSCodeCodeHost.js";
import { CodeCommandController } from "../extension/controllers/CodeCommandController.js";
import { GenerateJavaScriptUseCase } from "../src/application/usecases/GenerateJavaScriptUseCase.js";

const strongIntegrity = `sha512-${Buffer.alloc(64, 3).toString("base64")}`;

// Dobles explícitos de transacción, no locks publicables. El ensayo opt-in usa npm real.
function lockDouble(manifest) {
    const packages = {
        "": { name: manifest.name, version: manifest.version, dependencies: { ...manifest.dependencies },
            devDependencies: { ...manifest.devDependencies }, engines: { ...manifest.engines },
            bin: { [manifest.name]: manifest.bin.replace(/^\.\//u, "") } },
        "node_modules/@yao-pkg/pkg": { version: "6.22.0", resolved: "https://registry.npmjs.org/@yao-pkg/pkg/-/pkg-6.22.0.tgz",
            integrity: strongIntegrity, dev: true }
    };
    if (manifest.dependencies?.["node-gtk"]) {
        packages["node_modules/node-gtk"] = { version: "4.1.1",
            resolved: "https://registry.npmjs.org/node-gtk/-/node-gtk-4.1.1.tgz", integrity: strongIntegrity };
    }
    return { name: manifest.name, version: manifest.version, lockfileVersion: 3, requires: true, packages };
}
const lockGenerator = { async generate({ cwd }) {
    const manifest = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8"));
    await fs.writeFile(path.join(cwd, "package-lock.json"), JSON.stringify(lockDouble(manifest)));
} };
async function workspace(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clrs export ñ-"));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    return root;
}
const source = 'CAMBIO(id, texto)\n    escribir texto\nPRINCIPAL()\n    VENTANA("v", "Prueba")\n    ENTRADA("e")\n    CONECTAR("e", "cambio", CAMBIO)\n    ESTABLECER("e", "texto", "hola")\n    ESTABLECER_MODO_TEMA("oscuro")\n    escribir OBTENER_MODO_TEMA()\n    CERRAR("v")';
const makeService = options => new CompilationService({ projectExporter: new JavaScriptProjectExportRouter({
    cliExporter: new CliJavaScriptProjectExporter({ lockGenerator, ...options }),
    guiExporter: new JavaScriptProjectExporter({ lockGenerator, ...options }) }),
    runtimePreparation: { prepare() { assert.fail("Exportar no provisiona GTK"); } } });
const exportGui = (service, sourceCode, sourcePath, options = {}) =>
    service.compileSource(sourceCode, sourcePath, { ...options, exportProject: true });

test("GUI exportación: manifest determinista, seguro y versión canónica", () => {
    for (const base of ["programa", "Mi Programa", "áé 漢字", "CON", "npm", "a&calc", "a%PATH%", "A", "a"]) {
        const descriptor = createJavaScriptProjectDescriptor(base + ".clrs");
        assert.deepEqual(descriptor, createJavaScriptProjectDescriptor(base + ".clrs"));
        assert.match(descriptor.entryFile, /^[a-z0-9][a-z0-9_-]*\.js$/u);
        assert.equal(descriptor.entryFile, `${descriptor.directoryName}.js`);
        assert.equal(descriptor.name, descriptor.directoryName);
        assert.doesNotMatch(descriptor.directoryName, /-[a-f0-9]{10}$/u);
        assert.deepEqual(descriptor.manifest.dependencies, { "node-gtk": "4.1.1" });
        assert.deepEqual(descriptor.manifest.allowScripts, { "node-gtk@4.1.1": true });
        assert.equal(Object.hasOwn(descriptor.manifest.allowScripts, "node-gtk"), false);
        assert.equal(descriptor.manifest.engines.node, ">=22 <23 || >=24 <25 || >=26 <27");
        assert.equal(descriptor.manifest.private, true); assert.equal(descriptor.manifest.type, "module");
        assert.equal(descriptor.manifest.scripts.start, "node ./" + descriptor.entryFile);
        assert.equal(descriptor.manifest.bin, "./bootstrap.cjs");
        assert.match(descriptor.manifest.scripts["build:win"], /node \.\/prepare-packable\.cjs && pkg \. --targets host/u);
        assert.match(descriptor.manifest.scripts["build:unix"], /node \.\/prepare-packable\.cjs && pkg \. --targets host/u);
        assert.deepEqual(descriptor.manifest.devDependencies, { "@yao-pkg/pkg": "^6.22.0" });
        assert.deepEqual(descriptor.manifest.pkg.assets,
            ["node_modules/node-gtk/lib/binding/**/*", descriptor.packableFile]);
        assert.equal(descriptor.exportRoot, path.join(descriptor.sourceDirectory, "app"));
        assert.equal(descriptor.projectDirectory, path.join(descriptor.exportRoot, descriptor.name));
        assert.equal(descriptor.entryPath, path.join(descriptor.projectDirectory, descriptor.entryFile));
    }
});

test("JavaScript exportación: identidad canónica reserva app sin afectar temporales ni salida histórica", () => {
    const sourcePath = path.join("proyecto", "Mi Programa.clrs");
    const identity = createJavaScriptProjectIdentity(sourcePath);
    assert.equal(JAVASCRIPT_EXPORT_ROOT_DIRECTORY, "app");
    assert.equal(identity.name, "mi-programa");
    assert.equal(identity.directoryName, identity.name);
    assert.equal(identity.entryFile, "mi-programa.js");
    assert.equal(identity.projectDirectory, path.join(identity.sourceDirectory, "app", "mi-programa"));
    assert.equal(identity.entryPath, path.join(identity.projectDirectory, "mi-programa.js"));
    assert.equal(Object.isFrozen(identity), true);

    const temporary = new CompilationArtifact({ ast: null, sourcePath, temporary: true,
        exportProject: true, programKey: "prueba", userCode: "", generatedCode: "" });
    assert.equal(temporary.outputDirectory, ".");
    assert.equal(temporary.outputFileName, "prueba_Mi Programa.js");

    const historical = new CompilationArtifact({ ast: null, sourcePath, temporary: false,
        exportProject: false, userCode: "", generatedCode: "" });
    assert.equal(historical.outputDirectory, path.join("proyecto", ".clrs", "js"));
});

test("GUI exportación: publica cinco archivos portables sin preparar GTK ni rutas privadas", async t => {
    const root = await workspace(t), service = makeService();
    const artifact = await exportGui(service, source, path.join(root, "Programa ñ.clrs"), {
        runtimeContext: { gui: { moduleUrl: "file:///private/.runtime/node-gtk/index.js", factorySource: "incorrecta", nodeExecutable: "private-node" } }
    });
    assert.equal(artifact.kind, "node-project");
    assert.equal(artifact.guiBindingSpecifier, "node-gtk");
    assert.equal(artifact.runtimeNodeCommand, undefined);
    assert.equal(artifact.generatedCode.includes(getGuiRuntimeFactorySource()), true);
    assert.doesNotMatch(artifact.generatedCode, /file:\/\/\/private|vscode|GStreamer|GuiMediaAdapter|Gtk\.Video|gi:Gtk/);
    assert.equal(artifact.generatedCode.includes(root), false);
    assert.equal(artifact.projectDirectory, path.join(root, "app", "programa-n"));
    assert.equal(artifact.outputFileName, "programa-n.js");
    assert.deepEqual((await fs.readdir(artifact.projectDirectory)).sort(),
        [artifact.outputFileName, "prepare-packable.cjs", "bootstrap.cjs", "package-lock.json", "package.json"].sort());
    await assert.rejects(fs.access(path.join(root, "dist")), error => error.code === "ENOENT");
    await assert.rejects(fs.access(path.join(artifact.projectDirectory, "programa-n.packable.js")), error => error.code === "ENOENT");
    await assert.rejects(fs.access(path.join(artifact.projectDirectory, "node_modules")), error => error.code === "ENOENT");
    const exportedManifest = JSON.parse(await fs.readFile(path.join(artifact.projectDirectory, "package.json"), "utf8"));
    assert.deepEqual(exportedManifest.dependencies, { "node-gtk": "4.1.1" });
    assert.deepEqual(exportedManifest.allowScripts, { "node-gtk@4.1.1": true });
    assert.equal(Object.hasOwn(exportedManifest.allowScripts, "node-gtk"), false);
    assert.equal(exportedManifest.bin, "./bootstrap.cjs");
    assert.deepEqual(exportedManifest.devDependencies, { "@yao-pkg/pkg": "^6.22.0" });
    assert.deepEqual(exportedManifest.pkg.assets,
        ["node_modules/node-gtk/lib/binding/**/*", "programa-n.packable.js"]);
    const exportedLock = JSON.parse(await fs.readFile(path.join(artifact.projectDirectory, "package-lock.json"), "utf8"));
    assert.equal(exportedLock.packages["node_modules/node-gtk"].version, "4.1.1");
    assert.equal(exportedLock.packages["node_modules/@yao-pkg/pkg"].version, "6.22.0");
    assert.equal(spawnSync(process.execPath, ["--check", artifact.outputPath], { encoding: "utf8", windowsHide: true }).status, 0);
    assert.equal(spawnSync(process.execPath, ["--check", path.join(artifact.projectDirectory, "prepare-packable.cjs")],
        { encoding: "utf8", windowsHide: true }).status, 0);
    assert.equal(spawnSync(process.execPath, ["--check", path.join(artifact.projectDirectory, "bootstrap.cjs")],
        { encoding: "utf8", windowsHide: true }).status, 0);
    assert.equal(artifact.files.length, 5);
    const prepare = spawnSync(process.execPath, [path.join(artifact.projectDirectory, "prepare-packable.cjs")],
        { cwd: os.tmpdir(), encoding: "utf8", windowsHide: true });
    assert.equal(prepare.status, 0, prepare.stderr);
    assert.equal(await fs.readFile(artifact.outputPath, "utf8"), artifact.generatedCode);
    assert.match(await fs.readFile(path.join(artifact.projectDirectory, "programa-n.packable.js"), "utf8"),
        /__CLRS_PACKAGED_NODE_GTK_LOADER__/u);
});

test("GUI exportación: helpers y manifest preceden al lock y cualquier fallo conserva la transacción", async t => {
    const root = await workspace(t), sourcePath = path.join(root, "Inventario.clrs");
    let inspected = false;
    const observingLock = { async generate({ cwd }) {
        assert.deepEqual((await fs.readdir(cwd)).sort(),
            ["inventario.js", "prepare-packable.cjs", "bootstrap.cjs", "package.json"].sort());
        const manifest = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8"));
        assert.equal(manifest.bin, "./bootstrap.cjs");
        assert.deepEqual(manifest.devDependencies, { "@yao-pkg/pkg": "^6.22.0" });
        inspected = true;
        await fs.writeFile(path.join(cwd, "package-lock.json"), JSON.stringify(lockDouble(manifest)));
    } };
    const first = await exportGui(makeService({ lockGenerator: observingLock }), source, sourcePath);
    assert.equal(inspected, true);
    const prepare = await fs.readFile(path.join(first.projectDirectory, "prepare-packable.cjs"), "utf8");
    const bootstrap = await fs.readFile(path.join(first.projectDirectory, "bootstrap.cjs"), "utf8");
    assert.match(prepare, /inventario\.js/u); assert.match(prepare, /inventario\.packable\.js/u);
    assert.match(bootstrap, /inventario\.packable\.js/u); assert.match(bootstrap, /\.inventario-runtime/u);
    assert.doesNotMatch(prepare + bootstrap, /puntoventa|file:\/\/\/private|\.runtime[\\/]packages/iu);

    const result = await makeService({ createBootstrapScript() { throw new Error("fallo helper simulado"); } })
        .tryCompileSource(source.replace('"hola"', '"nuevo"'), sourcePath, { exportProject: true });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "CLRS_JS_EXPORT_WRITE_FAILED");
    assert.equal(await fs.readFile(first.outputPath, "utf8"), first.generatedCode);
    assert.ok((await fs.readdir(path.dirname(first.projectDirectory))).every(name => !name.includes(".stage-") && !name.includes(".lock")));
});

test("GUI exportación: conserva consola, homónimos y datos de rutas del usuario", async t => {
    const root = await workspace(t), service = makeService();
    const consoleArtifact = await service.compileSource('BOTON(x)\n    retornar x\nPRINCIPAL()\n    escribir BOTON(1)', path.join(root, "consola.clrs"));
    assert.equal(consoleArtifact.kind, undefined);
    assert.equal(consoleArtifact.outputPath, path.join(root, ".clrs/js/consola.js"));
    assert.doesNotMatch(consoleArtifact.generatedCode, /node-gtk|checkGuiEnvironment/);
    const gui = await exportGui(service, 'PRINCIPAL()\n    IMAGEN("i", "C:/datos/foto.png")', path.join(root, "imagen.clrs"));
    assert.match(gui.generatedCode, /C:\/datos\/foto.png/);
    assert.equal((await fs.readdir(gui.projectDirectory)).length, 5);
});

test("GUI exportación: lock inválido, npm fallido y cancelación preservan destino previo", async t => {
    const root = await workspace(t), sourcePath = path.join(root, "programa.clrs");
    const old = await exportGui(makeService(), source, sourcePath);
    for (const reason of ["invalid", "offline", "cancel"]) {
        const controller = new AbortController();
        const service = makeService({ lockGenerator: { async generate({ cwd }) {
            if (reason === "offline") { throw new JavaScriptExportError("LOCK_FAILED"); }
            if (reason === "cancel") { controller.abort(); return; }
            await fs.writeFile(path.join(cwd, "package-lock.json"), "{}");
        } } });
        const result = await service.tryCompileSource(source, sourcePath, { exportProject: true, signal: controller.signal });
        assert.equal(result.ok, false);
        assert.match(result.errors[0].code, /^CLRS_JS_EXPORT_(LOCK_INVALID|LOCK_FAILED|CANCELLED)$/u);
        assert.equal(await fs.readFile(old.outputPath, "utf8"), old.generatedCode);
        assert.deepEqual(await fs.readdir(path.dirname(old.projectDirectory)), ["programa"]);
    }
});

test("GUI exportación: conserva el diagnóstico de Node no compatible", async t => {
    const root = await workspace(t), sourcePath = path.join(root, "programa.clrs");
    const service = makeService({ lockGenerator: { async generate() {
        throw new GuiDependencyError("CLRS_GUI_DEP_NODE_UNSUPPORTED");
    } } });
    const result = await service.tryCompileSource(source, sourcePath, { exportProject: true });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "CLRS_GUI_DEP_NODE_UNSUPPORTED");
});

test("GUI exportación: reemplazo conserva copia anterior y revierte publicación fallida", async t => {
    const root = await workspace(t), sourcePath = path.join(root, "programa.clrs");
    const first = await exportGui(makeService(), source, sourcePath);
    await fs.writeFile(path.join(first.projectDirectory, "nota-personal.txt"), "conservar");
    const second = await exportGui(makeService(), source.replace('"hola"', '"nuevo"'), sourcePath);
    assert.equal(await fs.readFile(path.join(second.backupPath, "nota-personal.txt"), "utf8"), "conservar");
    assert.equal(await fs.readFile(path.join(second.backupPath, first.outputFileName), "utf8"), first.generatedCode);
    const brokenFs = { ...fs, async rename(from, to) {
        if (path.basename(from).includes(".stage-")) { throw new Error("fallo de publicación simulado"); }
        return fs.rename(from, to);
    } };
    await assert.rejects(exportGui(makeService({ fs: brokenFs }), source, sourcePath), error => error.code === "CLRS_JS_EXPORT_PUBLISH_FAILED");
    assert.equal(await fs.readFile(second.outputPath, "utf8"), second.generatedCode);
    assert.ok((await fs.readdir(path.dirname(second.projectDirectory))).every(name => !name.includes(".stage-") && !name.includes(".lock")));
});

test("GUI exportación: serializa el mismo destino y no mezcla manifests", async t => {
    const root = await workspace(t), sourcePath = path.join(root, "programa.clrs");
    let active = 0, maximum = 0;
    const concurrentLock = { async generate(request) {
        active++; maximum = Math.max(maximum, active);
        await lockGenerator.generate(request); active--;
    } };
    await Promise.all([1, 2].map(() => exportGui(makeService({ lockGenerator: concurrentLock }), source, sourcePath)));
    assert.equal(maximum, 1);
    assert.ok((await fs.readdir(path.join(root, "app"))).every(name => !name.includes(".stage-") && !name.includes(".lock")));
});

test("GUI exportación: rechaza enlaces y artefactos ligados al binding privado", async t => {
    const root = await workspace(t), elsewhere = await workspace(t);
    await fs.symlink(elsewhere, path.join(root, "app"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(exportGui(makeService(), source, path.join(root, "programa.clrs")), error => error.code === "CLRS_JS_EXPORT_INVALID_TARGET");
    assert.deepEqual(await fs.readdir(elsewhere), []);
    await assert.rejects(new JavaScriptProjectExporter().export({ requiredCapabilities: ["gui"], guiBindingSpecifier: "file:///private/index.js" }),
        error => error.code === "CLRS_JS_EXPORT_PRIVATE_PATH_LEAK");
});

test("GUI exportación: valida versiones y rechaza locks locales o con credenciales", () => {
    const manifest = createJavaScriptProjectDescriptor("programa.clrs").manifest;
    assert.ok(validJavaScriptProjectLock(lockDouble(manifest), manifest));
    for (const patch of [{ version: "4.1.2" }, { resolved: "file:///private/package.tgz" }, { resolved: "https://secret:token@example.com/a.tgz" },
        { resolved: "https://registry.example/a.tgz?access_token=secret" }, { resolved: "https://registry.example/a.tgz#secret" },
        { integrity: "x" }, { link: true }]) {
        const lock = lockDouble(manifest); Object.assign(lock.packages["node_modules/node-gtk"], patch);
        assert.equal(validJavaScriptProjectLock(lock, manifest), false);
    }
});

test("GUI exportación: npm sólo resuelve metadatos y no filtra credenciales", async () => {
    const calls = [];
    const adapter = new NpmPackageLockAdapter({ findCli: async () => "/npm/npm-cli.js", inspector: { async inspect() { return { executable: process.execPath }; } }, processAdapter: { async run(...args) {
        calls.push(args); return { code: 0 };
    } } });
    await adapter.generate({ cwd: "/project" });
    assert.ok(calls[0][1].includes("--package-lock-only")); assert.ok(calls[0][1].includes("--ignore-scripts"));
    assert.equal(calls[0][0], process.execPath); assert.equal(calls[0][2].cwd, "/project");
    adapter.findCli = async () => { throw new Error("https://secret:token@example.com"); };
    await assert.rejects(adapter.generate({ cwd: "/project" }), error => error.code === "CLRS_JS_EXPORT_NPM_NOT_FOUND" && !error.publicMessage.includes("secret"));
});

test("GUI exportación: el perfil CLI atraviesa el router y publica sólo su proyecto mínimo", async t => {
    const root = await workspace(t);
    const service = makeService();
    const artifact = await service.compileSource("PRINCIPAL()\n    escribir 1", path.join(root, "consola.clrs"), { exportProject: true });
    assert.equal(artifact.kind, "node-project");
    assert.equal(artifact.exportProfile, "cli");
    assert.equal(artifact.outputPath, path.join(root, "app", "consola", "consola.js"));
    assert.equal(await fs.readFile(artifact.outputPath, "utf8"), artifact.generatedCode);
    assert.deepEqual((await fs.readdir(path.join(root, "app", "consola"))).sort(),
        ["consola.js", "package-lock.json", "package.json"]);
    await assert.rejects(fs.access(path.join(root, "dist")), error => error.code === "ENOENT");
});

test("GUI exportación: proyecto trasladado conserva callbacks, temas y diálogos sin CLRS", async t => {
    const root = await workspace(t), destination = await workspace(t);
    const dialogSource = source + '\n    DIALOGO_ARCHIVO("f")\n    ruta = ABRIR_ARCHIVO("f", NULO)\n    escribir ruta == NULO';
    const artifact = await exportGui(makeService(), dialogSource, path.join(root, "programa.clrs"));
    await fs.cp(artifact.projectDirectory, destination, { recursive: true });
    const binding = path.join(destination, "node_modules/node-gtk"); await fs.mkdir(binding, { recursive: true });
    for (const file of ["FakeGtk.js", "FakeDialogs.js", "binding-testing-stub.mjs"]) {
        await fs.copyFile(new URL("./fixtures/gui/" + file, import.meta.url), path.join(binding, file));
    }
    await fs.writeFile(path.join(binding, "package.json"), JSON.stringify({ name: "node-gtk", version: "4.1.1", type: "module", exports: "./binding-testing-stub.mjs" }));
    await fs.rm(root, { recursive: true, force: true });
    for (let execution = 0; execution < 2; execution++) {
        const result = spawnSync(process.execPath, [path.join(destination, artifact.outputFileName)], { cwd: os.tmpdir(), encoding: "utf8", windowsHide: true, timeout: 10000 });
        assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, "hola\noscuro\ntrue\n");
    }
});

test("GUI exportación: paquete ausente se diagnostica a stderr sin VS Code", async t => {
    const root = await workspace(t);
    const artifact = await exportGui(makeService(), source, path.join(root, "programa.clrs"));
    const result = spawnSync(process.execPath, [artifact.outputPath], { encoding: "utf8", windowsHide: true, timeout: 10000 });
    assert.equal(result.status, 70);
    assert.match(result.stderr, /CLRS_GUI_DEP_RESOLUTION_FAILED/);
    assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND|at Module|node:internal/);
});

test("GUI exportación: Generar código JavaScript decide proyecto o archivo y propaga cancelación", async t => {
    const root = await workspace(t), service = makeService();
    let text = source, shown, progressCalls = 0;
    const abort = new AbortController();
    const host = { getActiveDocument: () => ({ filePath: path.join(root, "programa.clrs"), getText: () => text }),
        getWorkspaceRoot: documentPath => { assert.equal(documentPath, path.join(root, "programa.clrs")); return root; }, runCli() { assert.fail("Exportar no ejecuta el programa"); }, stopExecution() {}, writeClipboard() {},
        showGeneratedPath(...args) { shown = args; }, async withExportProgress(operation) { progressCalls++; return operation(abort.signal); } };
    const controller = new CodeCommandController({ host, path, presenter: { info() {}, present() {} },
        generateJavaScriptUseCase: new GenerateJavaScriptUseCase({ compilationService: service }) });
    assert.equal((await controller.generateJavaScript()).ok, true);
    assert.equal(shown[1].kind, "node-project");
    assert.equal(shown[1].exportProfile, "gui");
    text = "escribir 1";
    assert.equal((await controller.generateJavaScript()).ok, true);
    assert.equal(shown[0], path.join(root, "app", "programa", "programa.js"));
    assert.equal(shown[1].kind, "node-project");
    assert.equal(shown[1].exportProfile, "cli");
    text = source; abort.abort(); shown = null;
    const cancelled = await controller.generateJavaScript();
    assert.equal(cancelled.errors[0].code, "CLRS_JS_EXPORT_CANCELLED");
    assert.equal(shown, null); assert.equal(progressCalls, 3);
});

test("GUI exportación: progreso cancelable y salida VS Code no requieren una webview", async () => {
    let cancel, disposed = 0;
    const lines = [];
    const host = new VSCodeCodeHost({ ProgressLocation: { Notification: 1 }, window: {
        withProgress: async (options, operation) => {
            assert.equal(options.cancellable, true);
            return operation({}, { isCancellationRequested: false, onCancellationRequested(callback) {
                cancel = callback; return { dispose() { disposed++; } };
            } });
        }, createOutputChannel: () => ({ clear() {}, show() {}, appendLine(line) { lines.push(line); } })
    } }, { outputChannelName: "CLRS" });
    await host.withExportProgress(async signal => { assert.equal(signal.aborted, false); cancel(); assert.equal(signal.aborted, true); });
    assert.equal(disposed, 1);
    host.showGeneratedPath("/proyecto/programa.js", { kind: "node-project", exportProfile: "gui",
        projectDirectory: "/proyecto", backupPath: "/respaldo" });
    assert.deepEqual(lines, [
        "El código se generó en: /proyecto/programa.js",
        "Proyecto JavaScript: /proyecto",
        "",
        "Para preparar el proyecto:",
        "  npm ci",
        "",
        "Para ejecutarlo:",
        "  npm start",
        "",
        "Para generar un ejecutable distribuible:",
        "  Windows:      npm run build:win",
        "  Linux/macOS:  npm run build:unix",
        "",
        "Requiere Node compatible y GTK 4.10 o superior según tu sistema.",
        "Los recursos externos no se copian automáticamente.",
        "",
        "La exportación anterior se conservó en: /respaldo"
    ]);
});

test("GUI exportación: documentos homónimos conservan carpetas separadas", async t => {
    const root = await workspace(t), service = makeService();
    const left = path.join(root, "uno", "programa.clrs"), right = path.join(root, "dos", "programa.clrs");
    const [first, second] = await Promise.all([exportGui(service, source, left), exportGui(service, source, right)]);
    assert.notEqual(first.projectDirectory, second.projectDirectory);
    assert.match(first.projectDirectory, /uno[\\/]app[\\/]programa$/u);
    assert.match(second.projectDirectory, /dos[\\/]app[\\/]programa$/u);
});

test("GUI exportación: cancelación esperando el lock no publica ni deja temporales", async t => {
    const root = await workspace(t), sourcePath = path.join(root, "programa.clrs");
    let unlock, entered;
    const active = new Promise(resolve => { entered = resolve; });
    const first = exportGui(makeService({ lockGenerator: { async generate(request) {
        await new Promise(resolve => { unlock = resolve; entered(); }); await lockGenerator.generate(request);
    } } }), source, sourcePath);
    await active;
    const abort = new AbortController();
    const second = exportGui(makeService(), source, sourcePath, { signal: abort.signal });
    abort.abort();
    await assert.rejects(second, error => error.code === "CLRS_JS_EXPORT_CANCELLED");
    unlock(); await first;
    assert.deepEqual(await fs.readdir(path.join(root, "app")), ["programa"]);
});
