// Ensayo opt-in: instalación npm y ejecución normal de un proyecto CLI trasladado.
import assert from "node:assert/strict";
import { cp, lstat, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CompilationService } from "../../src/compiler/services/CompilationService.js";
import { CliJavaScriptProjectExporter } from "../../src/compiler/export/CliJavaScriptProjectExporter.js";
import { validCliJavaScriptProjectLock } from "../../src/compiler/export/CliJavaScriptProjectValidator.js";
import { NpmPackageLockAdapter } from "../../src/compiler/export/NpmPackageLockAdapter.js";
import { GuiProcessAdapter } from "../../src/infrastructure/gui/GuiProcessAdapter.js";
import { findNpmCli } from "../../src/infrastructure/gui/NodeRuntimeInspector.js";

const origin = await mkdtemp(path.join(os.tmpdir(), "clrs-cli-export-origin-ñ-"));
const destinationRoot = await mkdtemp(path.join(os.tmpdir(), "clrs-cli-export-relocated-ñ-"));
const destination = path.join(destinationRoot, "proyecto-cli");
const processes = new GuiProcessAdapter();
const checks = [];
const report = { ok: false, platform: process.platform, arch: process.arch, node: process.versions.node,
    npm: null, checks, notValidated: ["build real con pkg", "ejecutable portable", "stdin interactivo",
        "stderr", "argumentos", "códigos de salida", "otras plataformas o versiones de Node"] };
const source = [
    "DOBLE(valor)",
    "    retornar valor * 2",
    "",
    "PRINCIPAL()",
    "    escribir \"CLI normal\"",
    "    escribir DOBLE(21)"
].join("\n");

try {
    const lockGenerator = new NpmPackageLockAdapter({ nodeCommand: process.execPath });
    const service = new CompilationService({
        projectExporter: new CliJavaScriptProjectExporter({ lockGenerator }),
        runtimePreparation: { prepare() { assert.fail("Un CLI exportado no prepara runtime GUI privado."); } }
    });
    const artifact = await service.compileSource(source, path.join(origin, "Programa CLI Normal.clrs"), {
        exportProject: true
    });
    assert.equal(artifact.exportProfile, "cli");
    assert.deepEqual((await readdir(artifact.projectDirectory)).sort(),
        ["package-lock.json", "package.json", "programa-cli-normal.js"]);
    checks.push("three-file-cli-export-with-real-npm-lock");

    await cp(artifact.projectDirectory, destination, { recursive: true });
    await rm(origin, { recursive: true, force: true });
    checks.push("relocated-project-after-origin-removal");

    const npm = await findNpmCli({ executable: process.execPath });
    const npmVersion = await run(process.execPath, [npm, "--version"], { cwd: destination });
    report.npm = npmVersion.stdout.trim();
    const entry = path.join(destination, artifact.outputFileName);
    const manifestPath = path.join(destination, "package.json");
    const lockPath = path.join(destination, "package-lock.json");
    const original = { entry: await readFile(entry, "utf8"), manifest: await readFile(manifestPath, "utf8"),
        lock: await readFile(lockPath, "utf8") };
    const manifest = JSON.parse(original.manifest), lock = JSON.parse(original.lock);
    assert.equal(validCliJavaScriptProjectLock(lock, manifest), true);
    assert.equal(manifest.bin, `./${artifact.outputFileName}`);
    assert.equal(manifest.scripts.start, `node ./${artifact.outputFileName}`);
    assert.deepEqual(manifest.devDependencies, { "@yao-pkg/pkg": "^6.22.0" });
    for (const field of ["dependencies", "allowScripts", "pkg"]) {
        assert.equal(Object.hasOwn(manifest, field), false);
    }
    await assertAbsentProjectResidue(destination, artifact.outputFileName);

    const installed = await run(process.execPath, [npm, "ci", "--no-audit", "--no-fund"], {
        cwd: destination, timeoutMs: 300_000
    });
    assert.doesNotMatch(`${installed.stdout}\n${installed.stderr}`, /node-gtk|GTK|install scripts? blocked/iu);
    assert.equal(await readFile(entry, "utf8"), original.entry);
    assert.equal(await readFile(manifestPath, "utf8"), original.manifest);
    assert.equal(await readFile(lockPath, "utf8"), original.lock);
    await assert.rejects(lstat(path.join(destination, "node_modules", "node-gtk")),
        error => error.code === "ENOENT");
    checks.push("npm-ci-lock-unchanged-without-gui-dependencies");

    const pkgManifest = JSON.parse(await readFile(path.join(destination,
        "node_modules", "@yao-pkg", "pkg", "package.json"), "utf8"));
    assert.match(pkgManifest.version, /^6\./u);
    const pkgBinRelative = typeof pkgManifest.bin === "string" ? pkgManifest.bin : pkgManifest.bin?.pkg;
    assert.equal(typeof pkgBinRelative, "string");
    const pkgBin = path.resolve(destination, "node_modules", "@yao-pkg", "pkg", pkgBinRelative);
    assert.equal(pkgBin.startsWith(path.join(destination, "node_modules", "@yao-pkg", "pkg") + path.sep), true);
    await regularFile(pkgBin, "CLI de @yao-pkg/pkg");
    const pkgVersion = await run(process.execPath, [pkgBin, "--version"], { cwd: destination });
    assert.equal(pkgVersion.stdout.trim(), pkgManifest.version);
    report.resolved = { pkg: pkgManifest.version, lockfileVersion: lock.lockfileVersion };
    checks.push("yao-pkg-cli-available");

    const started = await run(process.execPath, [npm, "start"], { cwd: destination, timeoutMs: 60_000 });
    assert.match(normalize(started.stdout), /CLI normal\n42\n$/u);
    assert.doesNotMatch(`${started.stdout}\n${started.stderr}`,
        /Variante empaquetable|Runtime GTK|Iniciando aplicación empaquetada|bootstrap/iu);
    assert.equal(await readFile(entry, "utf8"), original.entry);
    assert.equal(await readFile(manifestPath, "utf8"), original.manifest);
    assert.equal(await readFile(lockPath, "utf8"), original.lock);
    await assertAbsentProjectResidue(destination, artifact.outputFileName);
    checks.push("npm-start-normal-entry-without-build-side-effects");

    const direct = await run(process.execPath, [entry], { cwd: os.tmpdir() });
    assert.equal(normalize(direct.stdout), "CLI normal\n42\n");
    checks.push("direct-node-entry-independent-of-cwd");
    report.ok = true;
} catch (error) {
    report.failure = { code: error.code, message: error.publicMessage ?? error.message };
    process.exitCode = 1;
} finally {
    await rm(origin, { recursive: true, force: true });
    await rm(destinationRoot, { recursive: true, force: true });
    report.cleaned = true;
    if (process.argv[2]) {
        const evidencePath = path.resolve(process.argv[2]);
        const repository = fileURLToPath(new URL("../../", import.meta.url));
        if (!evidencePath.startsWith(repository)) {
            throw new Error("La evidencia debe guardarse dentro del repositorio.");
        }
        await writeFile(evidencePath, JSON.stringify(report, null, 2) + "\n");
    }
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

async function run(command, args, options) {
    const result = await processes.run(command, args, { timeoutMs: 300_000, ...options });
    assert.equal(result.code, 0, result.stderr.slice(-4000));
    return result;
}

async function regularFile(target, label) {
    const info = await lstat(target);
    assert.equal(info.isFile(), true, `${label} debe ser un archivo regular.`);
    assert.equal(info.isSymbolicLink(), false, `${label} no debe ser un enlace.`);
}

async function assertAbsentProjectResidue(directory, entryFile) {
    const packable = entryFile.replace(/\.js$/u, ".packable.js");
    for (const target of ["bootstrap.cjs", "prepare-packable.cjs", packable, "dist", "bin"]) {
        await assert.rejects(lstat(path.join(directory, target)), error => error.code === "ENOENT");
    }
}

function normalize(value) {
    return value.replace(/\r\n/gu, "\n");
}
