import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CompilationArtifact } from "../src/compiler/CompilationArtifact.js";
import { CliJavaScriptProjectExporter } from "../src/compiler/export/CliJavaScriptProjectExporter.js";
import { validCliJavaScriptProjectLock } from "../src/compiler/export/CliJavaScriptProjectValidator.js";
import { JavaScriptExportError } from "../src/compiler/export/JavaScriptExportError.js";
import { createCliJavaScriptProjectDescriptor,
    validCliJavaScriptProjectManifest } from "../src/compiler/export/JavaScriptProjectDescriptor.js";

const strongIntegrity = `sha512-${Buffer.alloc(64, 2).toString("base64")}`;

test("exportación CLI: publica atómicamente JS, manifest y lock como una sola unidad", async t => {
    const root = await workspace(t);
    const sourcePath = path.join(root, "Punto Venta.clrs");
    const observed = [];
    const exporter = new CliJavaScriptProjectExporter({ lockGenerator: {
        async generate({ cwd, signal }) {
            assert.equal(signal?.aborted, false);
            observed.push((await fs.readdir(cwd)).sort());
            const manifest = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8"));
            await fs.writeFile(path.join(cwd, "package-lock.json"), JSON.stringify(lockDouble(manifest)));
        }
    } });
    const input = artifact(sourcePath, "console.log('venta');\n");
    const result = await exporter.export(input, { signal: new AbortController().signal });
    const descriptor = createCliJavaScriptProjectDescriptor(sourcePath);

    assert.deepEqual(observed, [["package.json", "punto-venta.js"]]);
    assert.equal(result.kind, "node-project");
    assert.equal(result.exportProfile, "cli");
    assert.equal(result.projectDirectory, descriptor.projectDirectory);
    assert.equal(result.outputPath, descriptor.entryPath);
    assert.equal(result.backupPath, undefined);
    assert.deepEqual((await fs.readdir(result.projectDirectory)).sort(),
        ["package-lock.json", "package.json", "punto-venta.js"]);
    assert.equal(await fs.readFile(result.outputPath, "utf8"), input.generatedCode);
    const manifest = JSON.parse(await fs.readFile(path.join(result.projectDirectory, "package.json"), "utf8"));
    const lock = JSON.parse(await fs.readFile(path.join(result.projectDirectory, "package-lock.json"), "utf8"));
    assert.equal(validCliJavaScriptProjectManifest(manifest, descriptor), true);
    assert.equal(validCliJavaScriptProjectLock(lock, manifest), true);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.files), true);
    for (const absent of ["node_modules", "dist", "bootstrap.cjs", "prepare-packable.cjs",
        "punto-venta.packable.js"]) {
        await assert.rejects(fs.access(path.join(result.projectDirectory, absent)), error => error.code === "ENOENT");
    }
});

test("exportación CLI: reemplaza el proyecto completo y conserva intacto el anterior", async t => {
    const root = await workspace(t);
    const sourcePath = path.join(root, "Inventario.clrs");
    const exporter = new CliJavaScriptProjectExporter({ lockGenerator: deterministicLock });
    const first = await exporter.export(artifact(sourcePath, "console.log('anterior');\n"));
    await fs.writeFile(path.join(first.projectDirectory, "nota-personal.txt"), "conservar", "utf8");

    const second = await exporter.export(artifact(sourcePath, "console.log('actual');\n"));
    assert.match(path.basename(second.backupPath), /^\.inventario\.backup-/u);
    assert.equal(await fs.readFile(second.outputPath, "utf8"), "console.log('actual');\n");
    assert.equal(await fs.readFile(path.join(second.backupPath, "inventario.js"), "utf8"),
        "console.log('anterior');\n");
    assert.equal(await fs.readFile(path.join(second.backupPath, "nota-personal.txt"), "utf8"), "conservar");
    assert.deepEqual((await fs.readdir(second.projectDirectory)).sort(),
        ["inventario.js", "package-lock.json", "package.json"]);
});

test("exportación CLI: npm fallido, lock inválido y cancelación no publican parciales", async t => {
    const root = await workspace(t);
    const sourcePath = path.join(root, "Transacción.clrs");
    const baseline = await new CliJavaScriptProjectExporter({ lockGenerator: deterministicLock })
        .export(artifact(sourcePath, "console.log('válido');\n"));
    const expected = await fs.readFile(baseline.outputPath, "utf8");
    const scenarios = [
        ["CLRS_JS_EXPORT_LOCK_FAILED", () => ({ async generate() {
            throw new JavaScriptExportError("LOCK_FAILED");
        } })],
        ["CLRS_JS_EXPORT_LOCK_INVALID", () => ({ async generate({ cwd }) {
            await fs.writeFile(path.join(cwd, "package-lock.json"), "{}");
        } })],
        ["CLRS_JS_EXPORT_CANCELLED", controller => ({ async generate({ cwd }) {
            await deterministicLock.generate({ cwd });
            controller.abort();
        } })]
    ];

    for (const [code, createLockGenerator] of scenarios) {
        const controller = new AbortController();
        const exporter = new CliJavaScriptProjectExporter({ lockGenerator: createLockGenerator(controller) });
        await assert.rejects(exporter.export(artifact(sourcePath, "console.log('inválido');\n"), {
            signal: controller.signal
        }), error => error.code === code);
        assert.equal(await fs.readFile(baseline.outputPath, "utf8"), expected);
        const appEntries = await fs.readdir(path.join(root, "app"));
        assert.deepEqual(appEntries, ["transaccion"]);
    }
});

test("exportación CLI: rechaza temporales y cualquier contaminación GUI antes del staging", async () => {
    const exporter = new CliJavaScriptProjectExporter({ lockGenerator: {
        async generate() { assert.fail("Un perfil inválido no genera lock."); }
    } });
    for (const input of [
        artifact("programa.clrs", "", { requiredCapabilities: ["gui"] }),
        artifact("programa.clrs", "", { guiBindingSpecifier: "node-gtk" }),
        artifact("programa.clrs", "", { runtimeNodeCommand: "private-node" }),
        new CompilationArtifact({ ast: null, sourcePath: "programa.clrs", temporary: false,
            exportProject: true, exportProfile: "gui", userCode: "", generatedCode: "",
            requiredCapabilities: ["gui"], guiBindingSpecifier: "node-gtk" })
    ]) {
        await assert.rejects(exporter.export(input), error => error.code === "CLRS_JS_EXPORT_PRIVATE_PATH_LEAK");
    }
});

function artifact(sourcePath, generatedCode, extra = {}) {
    return new CompilationArtifact({ ast: null, sourcePath, temporary: false, exportProject: true,
        exportProfile: "cli", userCode: generatedCode, generatedCode, requiredCapabilities: [], ...extra });
}

function lockDouble(manifest) {
    return { name: manifest.name, version: manifest.version, lockfileVersion: 3, requires: true, packages: {
        "": { name: manifest.name, version: manifest.version,
            devDependencies: { ...manifest.devDependencies }, engines: { ...manifest.engines },
            bin: { [manifest.name]: manifest.bin.replace(/^\.\//u, "") } },
        "node_modules/@yao-pkg/pkg": { version: "6.22.0",
            resolved: "https://registry.npmjs.org/@yao-pkg/pkg/-/pkg-6.22.0.tgz",
            integrity: strongIntegrity, dev: true }
    } };
}

const deterministicLock = { async generate({ cwd }) {
    const manifest = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8"));
    await fs.writeFile(path.join(cwd, "package-lock.json"), JSON.stringify(lockDouble(manifest)));
} };

async function workspace(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clrs cli transaction José # "));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    return root;
}
