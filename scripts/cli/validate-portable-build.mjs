// Smoke test opt-in: npm y pkg reales, exclusivamente en temporales propios.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CompilationService } from "../../src/compiler/services/CompilationService.js";
import { CliJavaScriptProjectExporter } from "../../src/compiler/export/CliJavaScriptProjectExporter.js";
import { NpmPackageLockAdapter } from "../../src/compiler/export/NpmPackageLockAdapter.js";
import { GuiProcessAdapter } from "../../src/infrastructure/gui/GuiProcessAdapter.js";
import { findNpmCli } from "../../src/infrastructure/gui/NodeRuntimeInspector.js";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const origin = await fs.mkdtemp(path.join(os.tmpdir(), "clrs cli build origin ñ-"));
const isolated = await fs.mkdtemp(path.join(os.tmpdir(), "clrs cli executable ñ-"));
const processes = new GuiProcessAdapter();
const checks = [];
const report = { ok: false, platform: process.platform, arch: process.arch, node: process.versions.node,
    npm: null, checks, notValidated: ["cross-compilation", "other hosts or architectures",
        "code signing and distribution", "interactive terminal appearance"] };
const source = [
    "PRINCIPAL()",
    "    dato = NULO",
    "    leer dato",
    "    escribir \"stdout:\", dato"
].join("\n");

try {
    assert.ok(["win32", "linux", "darwin"].includes(process.platform), "Plataforma host no contemplada.");
    const service = new CompilationService({
        projectExporter: new CliJavaScriptProjectExporter({
            lockGenerator: new NpmPackageLockAdapter({ nodeCommand: process.execPath })
        }),
        runtimePreparation: { prepare() { assert.fail("El build CLI no usa el runtime privado de CLRS."); } }
    });
    const artifact = await service.compileSource(source, path.join(origin, "Prueba CLI Portátil.clrs"), {
        exportProject: true
    });
    const name = "prueba-cli-portatil";
    assert.equal(artifact.exportProfile, "cli");
    assert.equal(artifact.outputFileName, `${name}.js`);
    assert.deepEqual((await fs.readdir(artifact.projectDirectory)).sort(),
        [`${name}.js`, "package.json", "package-lock.json"].sort());
    checks.push("three-file-cli-export-with-dynamic-normalized-name");

    const npm = await findNpmCli({ executable: process.execPath });
    report.npm = (await run(process.execPath, [npm, "--version"], {
        cwd: artifact.projectDirectory
    })).stdout.trim();
    const lockPath = path.join(artifact.projectDirectory, "package-lock.json");
    const manifestPath = path.join(artifact.projectDirectory, "package.json");
    const originalLock = await fs.readFile(lockPath, "utf8");
    const originalManifest = await fs.readFile(manifestPath, "utf8");
    await run(process.execPath, [npm, "ci", "--no-audit", "--no-fund"], {
        cwd: artifact.projectDirectory, timeoutMs: 300_000
    });
    assert.equal(await fs.readFile(lockPath, "utf8"), originalLock);
    assert.equal(await fs.readFile(manifestPath, "utf8"), originalManifest);
    await assert.rejects(fs.lstat(path.join(artifact.projectDirectory, "node_modules", "node-gtk")),
        error => error.code === "ENOENT");
    checks.push("real-npm-ci-lock-unchanged-without-gui-dependencies");

    const entryBeforeProbe = await fs.readFile(artifact.outputPath, "utf8");
    const entryWithProbe = addProcessInterfaceProbe(entryBeforeProbe);
    await fs.writeFile(artifact.outputPath, entryWithProbe, "utf8");
    const manifest = JSON.parse(originalManifest);
    assert.equal(manifest.bin, `./${name}.js`);
    assert.equal(manifest.scripts.start, `node ./${name}.js`);
    assert.doesNotMatch(JSON.stringify(manifest), /node-gtk|bootstrap|prepare-packable|\.packable\.js/iu);
    checks.push("process-interface-probe-in-direct-javascript-entry");

    const buildScript = process.platform === "win32" ? "build:win" : "build:unix";
    await run(process.execPath, [npm, "run", buildScript], {
        cwd: artifact.projectDirectory, timeoutMs: 600_000
    });
    const extension = process.platform === "win32" ? ".exe" : "";
    const builtExecutable = path.join(artifact.projectDirectory, "dist", `${name}${extension}`);
    await regularFile(builtExecutable, "Ejecutable CLI host");
    assert.deepEqual((await fs.readdir(path.join(artifact.projectDirectory, "dist"))).sort(),
        [`${name}${extension}`]);
    for (const forbidden of ["bootstrap.cjs", "prepare-packable.cjs", `${name}.packable.js`, "bin"]) {
        await assert.rejects(fs.lstat(path.join(artifact.projectDirectory, forbidden)),
            error => error.code === "ENOENT");
    }
    checks.push("host-build-created-single-executable-without-gui-residue");

    const portableExecutable = path.join(isolated, `${name}${extension}`);
    await fs.copyFile(builtExecutable, portableExecutable);
    if (process.platform !== "win32") { await fs.chmod(portableExecutable, 0o755); }
    await regularFile(portableExecutable, "Copia aislada del ejecutable CLI");
    const executableBytes = await fs.readFile(portableExecutable);
    report.executable = { name: path.basename(portableExecutable), size: executableBytes.length,
        sha256: createHash("sha256").update(executableBytes).digest("hex"), buildScript };
    checks.push("host-executable-copied-outside-project");

    await fs.rm(origin, { recursive: true, force: true });
    const args = ["primero", "dos espacios", "23"];
    const executed = await runInteractive(portableExecutable, args, {
        cwd: os.tmpdir(), stdin: "entrada smoke\n", timeoutMs: 90_000,
        environment: { ...process.env, PATH: "", CLRS_TEST_MODE: "1" }
    });
    assert.equal(executed.code, 23);
    assert.equal(normalize(executed.stdout), "stdout: entrada smoke\n");
    assert.equal(normalize(executed.stderr), "stderr:primero|dos espacios|23\n");
    checks.push("isolated-executable-preserves-stdin-stdout-stderr-argv-and-exit-code");
    assert.deepEqual(await fs.readdir(isolated), [`${name}${extension}`]);
    checks.push("runtime-created-no-bootstrap-packable-or-gtk-files");
    report.ok = true;
} catch (error) {
    report.failure = { code: error.code, message: error.publicMessage ?? error.message };
    process.exitCode = 1;
} finally {
    await fs.rm(origin, { recursive: true, force: true });
    await fs.rm(isolated, { recursive: true, force: true });
    report.cleaned = true;
    if (process.argv[2]) {
        const evidencePath = path.resolve(process.argv[2]);
        const relative = path.relative(repository, evidencePath);
        if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`)
            || path.isAbsolute(relative)) {
            throw new Error("La evidencia debe guardarse dentro del repositorio.");
        }
        await fs.writeFile(evidencePath, JSON.stringify(report, null, 2) + "\n");
    }
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

function addProcessInterfaceProbe(sourceText) {
    const marker = '("correct");\nprocess.exit(0);';
    assert.equal(sourceText.split(marker).length, 2, "El cierre correcto del runtime CLRS debe ser único.");
    const probe = [
        '("correct");',
        "const __clrsSmokeArgs = process.argv.slice(2);",
        'process.stderr.write(`stderr:${__clrsSmokeArgs.join("|")}\\n`);',
        "const __clrsSmokeExit = Number(__clrsSmokeArgs.at(-1));",
        "process.exitCode = Number.isInteger(__clrsSmokeExit) ? __clrsSmokeExit : 0;"
    ].join("\n");
    return sourceText.replace(marker, probe);
}

async function run(command, args, options = {}) {
    const result = await processes.run(command, args, { timeoutMs: 300_000, ...options });
    assert.equal(result.code, 0, result.stderr.slice(-8000));
    return result;
}

function runInteractive(command, args, { cwd, stdin, environment, timeoutMs }) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd, env: environment, shell: false, windowsHide: true,
            stdio: ["pipe", "pipe", "pipe"] });
        let stdout = "", stderr = "", settled = false;
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
            reject(Object.assign(new Error("Tiempo del ejecutable agotado."), { code: "ETIMEDOUT" }));
        }, timeoutMs);
        child.stdout.on("data", chunk => { stdout += chunk; });
        child.stderr.on("data", chunk => { stderr += chunk; });
        child.once("error", error => {
            if (settled) { return; }
            settled = true; clearTimeout(timer); reject(error);
        });
        child.once("close", code => {
            if (settled) { return; }
            settled = true; clearTimeout(timer); resolve({ code, stdout, stderr });
        });
        child.stdin.end(stdin);
    });
}

async function regularFile(target, label) {
    const info = await fs.lstat(target);
    assert.equal(info.isFile(), true, `${label} debe ser un archivo regular.`);
    assert.equal(info.isSymbolicLink(), false, `${label} no debe ser un enlace.`);
}

function normalize(value) {
    return value.replace(/\r\n/gu, "\n");
}
