// Smoke test opt-in: npm, pkg y GTK reales, exclusivamente en temporales propios.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CompilationService } from "../../src/compiler/services/CompilationService.js";
import { JavaScriptProjectExporter } from "../../src/compiler/export/JavaScriptProjectExporter.js";
import { NpmPackageLockAdapter } from "../../src/compiler/export/NpmPackageLockAdapter.js";
import { GuiProcessAdapter } from "../../src/infrastructure/gui/GuiProcessAdapter.js";
import { findNpmCli } from "../../src/infrastructure/gui/NodeRuntimeInspector.js";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const origin = await fs.mkdtemp(path.join(os.tmpdir(), "clrs portable build origen ñ-"));
const portable = await fs.mkdtemp(path.join(os.tmpdir(), "clrs portable ejecutable ñ-"));
const processes = new GuiProcessAdapter();
const checks = [];
const report = { ok: false, platform: process.platform, arch: process.arch, node: process.versions.node,
    abi: process.versions.modules, npm: null, checks, notValidated: [
        "cross-compilation", "otros hosts, arquitecturas o ABI", "firma y distribución del ejecutable",
        "GTK exactamente 4.10", "interacción manual o apariencia visual"
    ] };
const source = 'PRINCIPAL()\n    ESTABLECER_TEMA("Adwaita")\n    ESTABLECER_MODO_TEMA("oscuro")\n    VENTANA("v", "Smoke portable")\n    ETIQUETA("e", "Portable")\n    CONTENER("v", "e")\n    MOSTRAR("v")\n    escribir "portable-ok"\n    escribir OBTENER_MODO_TEMA()\n    CERRAR("v")';

async function run(command, args, options = {}) {
    const result = await processes.run(command, args, { timeoutMs: 300_000, ...options });
    assert.equal(result.code, 0, result.stderr.slice(-8000));
    return result;
}

async function regularFile(target, label) {
    const info = await fs.lstat(target);
    assert.equal(info.isFile(), true, `${label} debe ser un archivo regular.`);
    assert.equal(info.isSymbolicLink(), false, `${label} no debe ser un enlace.`);
}

async function plainDirectory(target, label) {
    const info = await fs.lstat(target);
    assert.equal(info.isDirectory(), true, `${label} debe ser un directorio regular.`);
    assert.equal(info.isSymbolicLink(), false, `${label} no debe ser un enlace.`);
}

async function treeDigest(root) {
    const hash = createHash("sha256");
    async function visit(current, relative) {
        const entries = await fs.readdir(current, { withFileTypes: true });
        entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
        for (const entry of entries) {
            assert.equal(entry.isSymbolicLink(), false, `El runtime contiene un enlace: ${entry.name}`);
            const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
            const child = path.join(current, entry.name);
            hash.update(`${entry.isDirectory() ? "d" : "f"}:${childRelative}\0`);
            if (entry.isDirectory()) { await visit(child, childRelative); }
            else if (entry.isFile()) { hash.update(await fs.readFile(child)); }
            else { assert.fail(`Tipo no portable: ${childRelative}`); }
        }
    }
    await visit(root, "");
    return hash.digest("hex");
}

try {
    assert.ok(["win32", "linux", "darwin"].includes(process.platform), "Plataforma host no contemplada.");
    const service = new CompilationService({
        projectExporter: new JavaScriptProjectExporter({
            lockGenerator: new NpmPackageLockAdapter({ nodeCommand: process.execPath })
        }),
        runtimePreparation: { prepare() { assert.fail("El build exportado no usa el runtime privado de CLRS."); } }
    });
    const artifact = await service.compileSource(source, path.join(origin, "Punto Venta Ágil.clrs"), {
        exportProject: true
    });
    const name = "punto-venta-agil";
    assert.equal(artifact.outputFileName, `${name}.js`);
    assert.deepEqual((await fs.readdir(artifact.projectDirectory)).sort(), [
        `${name}.js`, "prepare-packable.cjs", "bootstrap.cjs", "package.json", "package-lock.json"
    ].sort());
    checks.push("five-file-export-with-dynamic-normalized-name");

    const npm = await findNpmCli({ executable: process.execPath });
    report.npm = (await run(process.execPath, [npm, "--version"], { cwd: artifact.projectDirectory })).stdout.trim();
    await run(process.execPath, [npm, "ci", "--no-audit", "--no-fund"], { cwd: artifact.projectDirectory });
    checks.push("real-npm-ci-before-host-build");

    const entryBefore = await fs.readFile(artifact.outputPath, "utf8");
    const buildScript = process.platform === "win32" ? "build:win" : "build:unix";
    const built = await run(process.execPath, [npm, "run", buildScript], {
        cwd: artifact.projectDirectory, timeoutMs: 600_000
    });
    assert.match(built.stdout + built.stderr, /pkg|Targets not specified|node/iu);
    const packable = path.join(artifact.projectDirectory, `${name}.packable.js`);
    await regularFile(packable, "Variante packable");
    assert.equal(await fs.readFile(artifact.outputPath, "utf8"), entryBefore);
    assert.match(await fs.readFile(packable, "utf8"), /__CLRS_PACKAGED_NODE_GTK_LOADER__/u);
    checks.push("host-build-created-packable-with-normal-entry-intact");

    const extension = process.platform === "win32" ? ".exe" : "";
    const builtExecutable = path.join(artifact.projectDirectory, "dist", name, `${name}${extension}`);
    await regularFile(builtExecutable, "Ejecutable host");
    const portableExecutable = path.join(portable, `${name}${extension}`);
    await fs.copyFile(builtExecutable, portableExecutable);
    if (process.platform !== "win32") { await fs.chmod(portableExecutable, 0o755); }
    await regularFile(portableExecutable, "Copia independiente del ejecutable");
    report.executable = { name: path.basename(portableExecutable), size: (await fs.stat(portableExecutable)).size,
        buildScript };
    checks.push("host-executable-in-dist-dynamic-project-directory");

    await fs.rm(origin, { recursive: true, force: true });
    const bindingName = `node-v${process.versions.modules}-${process.platform}-${process.arch}`;
    const runtime = path.join(portable, "bin", bindingName);
    const first = await run(portableExecutable, [], { cwd: os.tmpdir(), timeoutMs: 90_000 });
    assert.match(first.stdout, new RegExp(`\\[${name}\\] Runtime GTK portable preparado\\.`, "u"));
    assert.match(first.stdout, new RegExp(`\\[${name}\\] Iniciando aplicación empaquetada\\.`, "u"));
    assert.match(first.stdout, /portable-ok\r?\noscuro/u);
    await regularFile(path.join(runtime, "node_gtk.node"), "Binding extraído");
    await plainDirectory(path.join(runtime, "girepository-1.0"), "Typelibs extraídos");
    const markerPath = path.join(runtime, `.${name}-runtime`);
    await regularFile(markerPath, "Marcador de runtime");
    assert.deepEqual(JSON.parse(await fs.readFile(markerPath, "utf8")), {
        schemaVersion: 1, projectId: name, dependency: "node-gtk", version: "4.1.1", bindingName
    });
    const firstDigest = await treeDigest(runtime);
    assert.ok((await fs.readdir(path.join(portable, "bin"))).every(item => !item.includes(".stage-")));
    checks.push("first-run-extracted-native-runtime-and-started-gtk");

    const second = await run(portableExecutable, [], { cwd: portable, timeoutMs: 90_000 });
    assert.match(second.stdout, new RegExp(`\\[${name}\\] Runtime GTK portable reutilizado\\.`, "u"));
    assert.doesNotMatch(second.stdout, /Runtime GTK portable preparado\./u);
    assert.match(second.stdout, /portable-ok\r?\noscuro/u);
    assert.equal(await treeDigest(runtime), firstDigest);
    assert.ok((await fs.readdir(path.join(portable, "bin"))).every(item => !item.includes(".stage-")));
    checks.push("second-run-reused-byte-identical-runtime");

    report.runtime = { bindingName, marker: path.basename(markerPath), digest: firstDigest };
    report.gtk = "loaded-by-packaged-application";
    report.ok = true;
} catch (error) {
    report.failure = { code: error.code, message: error.publicMessage ?? error.message };
    process.exitCode = 1;
} finally {
    await fs.rm(origin, { recursive: true, force: true });
    await fs.rm(portable, { recursive: true, force: true });
    report.cleaned = true;
    if (process.argv[2]) {
        const evidencePath = path.resolve(process.argv[2]);
        const relative = path.relative(repository, evidencePath);
        if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
            throw new Error("La evidencia debe guardarse dentro del repositorio.");
        }
        await fs.writeFile(evidencePath, JSON.stringify(report, null, 2) + "\n");
    }
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
