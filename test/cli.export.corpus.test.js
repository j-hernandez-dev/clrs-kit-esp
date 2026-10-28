import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createJavaScriptProjectOutputLines } from "../extension/presentation/JavaScriptProjectOutput.js";
import { CliJavaScriptProjectExporter } from "../src/compiler/export/CliJavaScriptProjectExporter.js";
import { validCliJavaScriptProjectLock } from "../src/compiler/export/CliJavaScriptProjectValidator.js";
import { createCliJavaScriptProjectDescriptor, createJavaScriptProjectDescriptor,
    validCliJavaScriptProjectManifest } from "../src/compiler/export/JavaScriptProjectDescriptor.js";
import { JavaScriptProjectExporter } from "../src/compiler/export/JavaScriptProjectExporter.js";
import { JavaScriptProjectExportRouter } from "../src/compiler/export/JavaScriptProjectExportRouter.js";
import { CompilationService } from "../src/compiler/services/CompilationService.js";
import { getGuiRuntimeFactorySource } from "../src/standard-library/gui/runtime/GuiRuntimeSource.js";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const corpus = await readJson("test/fixtures/cli/export-corpus.v1.json");
const strongIntegrity = `sha512-${Buffer.alloc(64, 7).toString("base64")}`;

test("corpus CLI: el contrato versionado cubre estructura, aislamiento y frontera temporal", async () => {
    assert.equal(corpus.schemaVersion, 1);
    assert.deepEqual(corpus.areas, ["minimum-program", "dynamic-identity", "clean-lock",
        "profile-isolation", "gui-non-regression", "temporary-execution-boundary"]);
    assert.equal(new Set(corpus.cases.map(item => item.id)).size, corpus.cases.length);
    assert.equal(new Set(corpus.cases.map(item => item.name)).size, corpus.cases.length);
    for (const scenario of corpus.cases) {
        await fs.access(path.join(projectRoot, ...scenario.source.split("/")));
    }

    const manifest = await readJson("package.json");
    assert.equal(manifest.scripts["test:cli:export-corpus"], "node --test test/cli.export.corpus.test.js");
    assert.match(manifest.scripts["test:corpus:integrity"], /test\/cli\.export\.corpus\.test\.js/u);
    assert.doesNotMatch(manifest.scripts["test:cli:export-corpus"], /npm ci|pkg |validate-|native/iu);
});

for (const scenario of corpus.cases) {
    test(`corpus CLI: ${scenario.id} publica tres archivos reproducibles y sin infraestructura GUI`, async t => {
        const root = await temporaryWorkspace(t);
        const source = await read(scenario.source);
        const first = await exportProject(source, path.join(root, "primero", scenario.file));
        const second = await exportProject(source, path.join(root, "segundo", scenario.file));

        for (const result of [first, second]) {
            const descriptor = createCliJavaScriptProjectDescriptor(result.sourcePath);
            assert.equal(result.exportProfile, "cli");
            assert.equal(descriptor.name, scenario.name);
            assert.equal(result.outputFileName, `${scenario.name}.js`);
            assert.deepEqual((await fs.readdir(result.projectDirectory)).sort(),
                corpus.cliFiles.map(file => file.replace("<program>", scenario.name)).sort());

            const manifestText = await fs.readFile(path.join(result.projectDirectory, "package.json"), "utf8");
            const lockText = await fs.readFile(path.join(result.projectDirectory, "package-lock.json"), "utf8");
            const manifest = JSON.parse(manifestText), lock = JSON.parse(lockText);
            assert.equal(validCliJavaScriptProjectManifest(manifest, descriptor), true);
            assert.equal(validCliJavaScriptProjectLock(lock, manifest), true);
            assert.equal(manifest.bin, `./${scenario.name}.js`);
            assert.equal(manifest.scripts.start, `node ./${scenario.name}.js`);
            assert.match(manifest.scripts["build:win"], new RegExp(`pkg \\. --targets host --output \\.\\/dist\\/${scenario.name}\\.exe$`, "u"));
            assert.match(manifest.scripts["build:unix"], new RegExp(`pkg \\. --targets host --output \\.\\/dist\\/${scenario.name}$`, "u"));
            for (const field of corpus.cliForbiddenManifestFields) {
                assert.equal(Object.hasOwn(manifest, field), false, `${scenario.id}: ${field}`);
            }
            for (const entry of corpus.cliForbiddenEntries) {
                assert.equal(await exists(path.join(result.projectDirectory,
                    entry.replace("<program>", scenario.name))), false, `${scenario.id}: ${entry}`);
            }
            const structure = [JSON.stringify((await fs.readdir(result.projectDirectory)).sort()),
                manifestText, lockText].join("\n");
            for (const forbidden of corpus.cliForbiddenInfrastructure) {
                assert.equal(structure.toLowerCase().includes(forbidden.toLowerCase()), false,
                    `${scenario.id}: ${forbidden}`);
            }
            const syntax = spawnSync(process.execPath, ["--check", result.outputPath], {
                encoding: "utf8", windowsHide: true
            });
            assert.equal(syntax.status, 0, syntax.stderr);
            assert.doesNotMatch(createJavaScriptProjectOutputLines(result.outputPath, result).join("\n"),
                /GTK|node-gtk|runtime gráfico|bootstrap|packable/iu);
        }

        assert.deepEqual(await snapshot(first.projectDirectory), await snapshot(second.projectDirectory));
    });
}

test("corpus CLI/GUI: cada perfil conserva exclusivamente su infraestructura", async t => {
    const root = await temporaryWorkspace(t);
    const cli = await exportProject(await read(corpus.cases.at(-1).source),
        path.join(root, "Consola con palabras GUI.clrs"));
    const gui = await exportProject(await read(corpus.guiSource), path.join(root, "Interfaz.clrs"));
    const cliManifest = await readJson(path.join(cli.projectDirectory, "package.json"));
    const guiManifest = await readJson(path.join(gui.projectDirectory, "package.json"));
    const guiDescriptor = createJavaScriptProjectDescriptor(gui.sourcePath);

    assert.equal(cli.exportProfile, "cli");
    assert.equal(gui.exportProfile, "gui");
    assert.deepEqual((await fs.readdir(cli.projectDirectory)).sort(),
        corpus.cliFiles.map(file => file.replace("<program>", "consola-con-palabras-gui")).sort());
    assert.deepEqual((await fs.readdir(gui.projectDirectory)).sort(),
        corpus.guiFiles.map(file => file.replace("<program>", "interfaz")).sort());
    assert.equal(cliManifest.bin, "./consola-con-palabras-gui.js");
    assert.doesNotMatch(cliManifest.scripts["build:win"], /prepare-packable|bootstrap/iu);
    assert.equal(guiManifest.bin, "./bootstrap.cjs");
    assert.equal(guiManifest.dependencies["node-gtk"], "4.1.1");
    assert.match(guiManifest.scripts["build:win"], /^node \.\/prepare-packable\.cjs && pkg /u);
    assert.ok(guiManifest.pkg.assets.includes(guiDescriptor.packableFile));
    assert.match(createJavaScriptProjectOutputLines(gui.outputPath, gui).join("\n"), /GTK 4\.10/u);
    assert.equal((await fs.readFile(cli.outputPath, "utf8")).includes("node-gtk"), true,
        "Las palabras GUI son datos del usuario y no deben reclasificar la estructura CLI.");
});

test("corpus CLI/GUI: ejecutar temporalmente no crea proyectos npm ni usa el router", async t => {
    const root = await temporaryWorkspace(t);
    const writes = [], runs = [], prepared = [];
    const service = new CompilationService({
        projectExporter: { async export() { assert.fail("La ejecución temporal no exporta proyectos."); } },
        fileEmitter: { async writeArtifact(artifact) { writes.push(artifact); return artifact; } },
        runtimePreparation: { async prepare() {
            prepared.push("gui");
            return { gui: { moduleUrl: "file:///private/node-gtk/index.js", nodeExecutable: "private-node",
                factorySource: getGuiRuntimeFactorySource() } };
        } },
        programRunner: { async run(request) { runs.push(request); return { ok: true, exitCode: 0 }; } }
    });
    const cli = await service.runSource(await read(corpus.cases[0].source), path.join(root, "Consola.clrs"), {
        exportProject: true
    });
    const gui = await service.runSource(await read(corpus.guiSource), path.join(root, "Interfaz.clrs"), {
        exportProject: true
    });

    assert.equal(cli.artifact.exportProfile, undefined);
    assert.equal(gui.artifact.exportProfile, undefined);
    assert.deepEqual(prepared, ["gui"]);
    assert.deepEqual(writes, [cli.artifact, gui.artifact]);
    assert.equal(runs.length, 2);
    assert.equal(runs[0].command, undefined);
    assert.equal(runs[1].command, "private-node");
    assert.equal(await exists(path.join(root, "app")), false);
    for (const artifact of writes) {
        assert.equal(artifact.temporary, true);
        assert.equal(path.dirname(artifact.outputPath), ".");
    }
});

function createService() {
    return new CompilationService({ projectExporter: new JavaScriptProjectExportRouter({
        cliExporter: new CliJavaScriptProjectExporter({ lockGenerator: deterministicLock }),
        guiExporter: new JavaScriptProjectExporter({ lockGenerator: deterministicLock })
    }), runtimePreparation: { prepare() { assert.fail("Exportar no prepara el runtime privado."); } } });
}

function exportProject(source, sourcePath) {
    return createService().compileSource(source, sourcePath, { exportProject: true });
}

function lockDouble(manifest) {
    const root = { name: manifest.name, version: manifest.version,
        devDependencies: { ...manifest.devDependencies }, engines: { ...manifest.engines },
        bin: { [manifest.name]: manifest.bin.replace(/^\.\//u, "") } };
    const packages = { "": root,
        "node_modules/@yao-pkg/pkg": { version: "6.22.0",
            resolved: "https://registry.npmjs.org/@yao-pkg/pkg/-/pkg-6.22.0.tgz",
            integrity: strongIntegrity, dev: true } };
    if (manifest.dependencies?.["node-gtk"]) {
        root.dependencies = { ...manifest.dependencies };
        packages["node_modules/node-gtk"] = { version: "4.1.1",
            resolved: "https://registry.npmjs.org/node-gtk/-/node-gtk-4.1.1.tgz", integrity: strongIntegrity };
    }
    return { name: manifest.name, version: manifest.version, lockfileVersion: 3, requires: true, packages };
}

const deterministicLock = { async generate({ cwd }) {
    const manifest = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8"));
    await fs.writeFile(path.join(cwd, "package-lock.json"), JSON.stringify(lockDouble(manifest), null, 2) + "\n");
} };

async function snapshot(directory) {
    const result = {};
    for (const file of (await fs.readdir(directory)).sort()) {
        result[file] = await fs.readFile(path.join(directory, file), "utf8");
    }
    return result;
}

async function temporaryWorkspace(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clrs cli corpus José # "));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    return root;
}

async function exists(target) {
    try { await fs.access(target); return true; }
    catch (error) { if (error.code === "ENOENT") { return false; } throw error; }
}

function read(relativePath) {
    const target = path.isAbsolute(relativePath) ? relativePath : path.join(projectRoot, ...relativePath.split("/"));
    return fs.readFile(target, "utf8");
}

async function readJson(relativePath) {
    return JSON.parse(await read(relativePath));
}
