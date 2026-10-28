// Ensayo opt-in: npm y GTK reales, exclusivamente en carpetas temporales propias.
import assert from "node:assert/strict";
import { mkdtemp, cp, lstat, rm, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { CompilationService } from "../../src/compiler/services/CompilationService.js";
import { JavaScriptProjectExporter } from "../../src/compiler/export/JavaScriptProjectExporter.js";
import { NpmPackageLockAdapter } from "../../src/compiler/export/NpmPackageLockAdapter.js";
import { GuiProcessAdapter } from "../../src/infrastructure/gui/GuiProcessAdapter.js";
import { findNpmCli } from "../../src/infrastructure/gui/NodeRuntimeInspector.js";
import { getGuiRuntimeFactorySource } from "../../src/standard-library/gui/runtime/GuiRuntimeSource.js";
import { parseSource } from "../../src/language/LanguageFrontend.js";
import { JavaScriptGenerator } from "../../src/compiler/JavaScriptGenerator.js";

const origin = await mkdtemp(path.join(os.tmpdir(), "clrs-export-origen ñ-"));
const destination = await mkdtemp(path.join(os.tmpdir(), "clrs-export-autonomo ñ-"));
const processes = new GuiProcessAdapter();
const checks = [];
const report = { ok: false, platform: process.platform, arch: process.arch, node: process.versions.node,
    abi: process.versions.modules, npm: null, binding: "4.1.1", checks, notValidated: [
        "build real con pkg", "ejecutable portable", "extracción o reutilización de bin/",
        "otras plataformas/arquitecturas/versiones de Node", "GTK exactamente 4.10",
        "interacción manual o apariencia visual", "selección manual de archivos"
    ] };
const source = 'CAMBIO(id, texto)\n    escribir texto\nPRINCIPAL()\n    VENTANA("v", "Exportación autónoma")\n    ENTRADA("e")\n    CONTENER("v", "e")\n    CONECTAR("e", "cambio", CAMBIO)\n    ESTABLECER("e", "texto", "hola exportado")\n    ESTABLECER_MODO_TEMA("oscuro")\n    escribir OBTENER_MODO_TEMA()\n    MOSTRAR("v")\n    CERRAR("v")';
async function run(command, args, options) {
    const result = await processes.run(command, args, { timeoutMs: 300_000, ...options });
    assert.equal(result.code, 0, result.stderr.slice(-4000));
    return result;
}
async function missing(target) {
    await assert.rejects(lstat(target), error => error.code === "ENOENT");
}
async function regularFile(target, label) {
    const info = await lstat(target);
    assert.equal(info.isFile(), true, `${label} debe ser un archivo regular.`);
    assert.equal(info.isSymbolicLink(), false, `${label} no debe ser un enlace.`);
}
try {
    const lockGenerator = new NpmPackageLockAdapter({ nodeCommand: process.execPath });
    const service = new CompilationService({ projectExporter: new JavaScriptProjectExporter({ lockGenerator }),
        runtimePreparation: { prepare() { throw new Error("Exportación intentó preparar GUI privada"); } } });
    const artifact = await service.compileSource(source, path.join(origin, "Programa autónomo.clrs"), { exportProject: true });
    assert.equal((await readdir(artifact.projectDirectory)).length, 5);
    checks.push("real-npm-lock-without-node-modules-or-private-gtk");
    await cp(artifact.projectDirectory, destination, { recursive: true });
    await rm(origin, { recursive: true, force: true });
    const npm = await findNpmCli({ executable: process.execPath });
    const npmVersion = await run(process.execPath, [npm, "--version"], { cwd: destination });
    report.npm = npmVersion.stdout.trim();
    const manifest = JSON.parse(await readFile(path.join(destination, "package.json"), "utf8"));
    assert.deepEqual(manifest.dependencies, { "node-gtk": "4.1.1" });
    assert.deepEqual(manifest.allowScripts, { "node-gtk@4.1.1": true });
    assert.deepEqual(manifest.devDependencies, { "@yao-pkg/pkg": "^6.22.0" });
    assert.equal(manifest.scripts.start, `node ./${artifact.outputFileName}`);
    assert.doesNotMatch(manifest.scripts.start, /bootstrap|packable|pkg/u);
    checks.push("exact-node-gtk-install-authorization-and-normal-start-script");
    const entry = path.join(destination, artifact.outputFileName);
    const prepare = path.join(destination, "prepare-packable.cjs");
    const bootstrap = path.join(destination, "bootstrap.cjs");
    const lockPath = path.join(destination, "package-lock.json");
    const original = {
        entry: await readFile(entry, "utf8"), prepare: await readFile(prepare, "utf8"),
        bootstrap: await readFile(bootstrap, "utf8"), lock: await readFile(lockPath, "utf8")
    };
    const packable = path.join(destination, artifact.outputFileName.replace(/\.js$/u, ".packable.js"));
    for (const target of [path.join(destination, "node_modules"), packable,
        path.join(destination, "dist"), path.join(destination, "bin")]) { await missing(target); }
    console.log("Lock real generado y proyecto trasladado. Instalando dependencias locales con npm ci…");
    const installed = await run(process.execPath, [npm, "ci", "--no-audit", "--no-fund"], { cwd: destination });
    const installOutput = `${installed.stdout}\n${installed.stderr}`;
    assert.doesNotMatch(installOutput,
        /install scripts? blocked|blocked because .*allowScripts|node-gtk@4\.1\.1[^\r\n]*blocked/iu);
    assert.equal(await readFile(lockPath, "utf8"), original.lock);
    checks.push("npm-ci-in-relocated-project-without-origin");
    checks.push("npm-ci-no-unapproved-node-gtk-script-and-lock-unchanged");
    const nodeGtkManifest = JSON.parse(await readFile(path.join(destination,
        "node_modules", "node-gtk", "package.json"), "utf8"));
    const pkgManifest = JSON.parse(await readFile(path.join(destination,
        "node_modules", "@yao-pkg", "pkg", "package.json"), "utf8"));
    assert.equal(nodeGtkManifest.version, "4.1.1");
    assert.match(pkgManifest.version, /^6\./u);
    const bindingName = `node-v${process.versions.modules}-${process.platform}-${process.arch}`;
    const nativeAddon = path.join(destination, "node_modules", "node-gtk", "lib", "binding",
        bindingName, "node_gtk.node");
    await regularFile(nativeAddon, "node_gtk.node");
    const pkgBinRelative = typeof pkgManifest.bin === "string" ? pkgManifest.bin : pkgManifest.bin?.pkg;
    assert.equal(typeof pkgBinRelative, "string");
    const pkgBin = path.resolve(destination, "node_modules", "@yao-pkg", "pkg", pkgBinRelative);
    assert.equal(pkgBin.startsWith(path.join(destination, "node_modules", "@yao-pkg", "pkg") + path.sep), true);
    await regularFile(pkgBin, "CLI de @yao-pkg/pkg");
    const pkgVersion = await run(process.execPath, [pkgBin, "--version"], { cwd: destination });
    assert.equal(pkgVersion.stdout.trim(), pkgManifest.version);
    report.resolved = { nodeGtk: nodeGtkManifest.version, pkg: pkgManifest.version, bindingName };
    checks.push("node-gtk-native-binding-installed", "yao-pkg-cli-available");
    const resolved = await run(process.execPath, ["--input-type=module", "-e", "console.log(import.meta.resolve('node-gtk'))"], { cwd: destination });
    const version = await run(process.execPath, ["--input-type=module", "-e", "const gi=(await import('node-gtk')).default;const Gtk=gi.require('Gtk','4.0');console.log([Gtk.getMajorVersion(),Gtk.getMinorVersion(),Gtk.getMicroVersion()].join('.'));"], { cwd: destination });
    report.gtk = version.stdout.trim();
    for (const target of [packable, path.join(destination, "dist"), path.join(destination, "bin")]) {
        await missing(target);
    }
    const started = await run(process.execPath, [npm, "start"], { cwd: destination, timeoutMs: 60_000 });
    assert.match(started.stdout, /hola exportado\r?\noscuro/);
    assert.doesNotMatch(`${started.stdout}\n${started.stderr}`,
        /Variante empaquetable generada|Runtime GTK portable|Iniciando aplicación empaquetada/iu);
    assert.equal(await readFile(entry, "utf8"), original.entry);
    assert.equal(await readFile(prepare, "utf8"), original.prepare);
    assert.equal(await readFile(bootstrap, "utf8"), original.bootstrap);
    assert.equal(await readFile(lockPath, "utf8"), original.lock);
    for (const target of [packable, path.join(destination, "dist"), path.join(destination, "bin")]) {
        await missing(target);
    }
    checks.push("native-npm-start-normal-entry-without-portable-build-side-effects");
    const direct = await run(process.execPath, [entry], { cwd: os.tmpdir() });
    assert.equal(direct.stdout, "hola exportado\noscuro\n");
    checks.push("native-node-entry-independent-of-cwd");
    const temporaryCode = new JavaScriptGenerator().generate(parseSource(source).ast, { runtimeContext: { gui: {
        moduleUrl: resolved.stdout.trim(), factorySource: getGuiRuntimeFactorySource()
    } } }).generatedCode;
    const temporary = path.join(destination, "comparison.mjs");
    await writeFile(temporary, temporaryCode);
    const managed = await run(process.execPath, [temporary], { cwd: destination });
    assert.equal(managed.stdout, direct.stdout);
    checks.push("native-semantic-equivalence-private-binding-and-npm-binding");
    report.ok = true;
} catch (error) {
    report.failure = { code: error.code, message: error.publicMessage ?? error.message };
    process.exitCode = 1;
} finally {
    // Exclusivamente directorios mkdtemp propios: nunca el runtime privado del desarrollador.
    await rm(origin, { recursive: true, force: true });
    await rm(destination, { recursive: true, force: true });
    report.cleaned = true;
    if (process.argv[2]) {
        const evidencePath = path.resolve(process.argv[2]);
        const repository = fileURLToPath(new URL("../../", import.meta.url));
        if (!evidencePath.startsWith(repository)) { throw new Error("La evidencia debe guardarse dentro del repositorio."); }
        await writeFile(evidencePath, JSON.stringify(report, null, 2) + "\n");
    }
    console.log(JSON.stringify(report, null, 2));
}
