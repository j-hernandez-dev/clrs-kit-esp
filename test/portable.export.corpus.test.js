import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CompilationArtifact } from "../src/compiler/CompilationArtifact.js";
import { CliJavaScriptProjectExporter } from "../src/compiler/export/CliJavaScriptProjectExporter.js";
import { JavaScriptExportError } from "../src/compiler/export/JavaScriptExportError.js";
import { createJavaScriptProjectDescriptor } from "../src/compiler/export/JavaScriptProjectDescriptor.js";
import { JavaScriptProjectExporter } from "../src/compiler/export/JavaScriptProjectExporter.js";
import { CompilationService } from "../src/compiler/services/CompilationService.js";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const corpus = await readJson("test/fixtures/gui/portable-export-corpus.v1.json");
const consoleSource = await read(corpus.sources.console);
const guiSource = await read(corpus.sources.gui);
const strongIntegrity = `sha512-${Buffer.alloc(64, 4).toString("base64")}`;

test("corpus portable: el contrato versionado cubre sus fronteras y forma parte del release", async () => {
    assert.equal(corpus.schemaVersion, 1);
    assert.deepEqual(corpus.areas, ["identity", "console-boundary", "gui-transaction", "normal-start",
        "packable-preparation", "failure-atomicity", "native-boundary"]);
    assert.equal(new Set(corpus.identityCases.map(item => item.name)).size, corpus.identityCases.length);
    assert.deepEqual(corpus.nativeChecks, ["npm ci with node-gtk install script", "host pkg build",
        "native GTK startup", "first-run runtime extraction", "second-run runtime reuse"]);
    const manifest = await readJson("package.json");
    assert.equal(manifest.scripts["test:gui:portable-corpus"], "node --test test/portable.export.corpus.test.js");
    assert.match(manifest.scripts["test:corpus:integrity"], /test\/portable\.export\.corpus\.test\.js/u);
    assert.equal(manifest.scripts["test:gui:portable-lock:native"], "node scripts/gui/validate-portable-lock.mjs");
    assert.equal(manifest.scripts["test:gui:portable-install:native"], "node scripts/gui/validate-export.mjs");
    assert.equal(manifest.scripts["test:gui:portable-build:native"], "node scripts/gui/validate-portable-build.mjs");
    assert.equal(manifest.scripts["test:gui:export:native"], "node scripts/gui/validate-export.mjs");
    assert.doesNotMatch(manifest.scripts["test:gui:portable-corpus"], /npm ci|validate-|pkg /u);
    const nativeInstallation = await read("scripts/gui/validate-export.mjs");
    assert.match(nativeInstallation, /\[npm, "ci", "--no-audit", "--no-fund"\]/u);
    assert.match(nativeInstallation, /\[npm, "start"\]/u);
    assert.doesNotMatch(nativeInstallation, /npm, "ci"[^\n]+--ignore-scripts/u);
    for (const evidence of ["npm-ci-no-unapproved-node-gtk-script-and-lock-unchanged",
        "node-gtk-native-binding-installed", "yao-pkg-cli-available",
        "native-npm-start-normal-entry-without-portable-build-side-effects"]) {
        assert.match(nativeInstallation, new RegExp(escapeRegExp(evidence), "u"));
    }
    const nativeBuild = await read("scripts/gui/validate-portable-build.mjs");
    for (const evidence of ["five-file-export-with-dynamic-normalized-name",
        "real-npm-ci-before-host-build", "host-build-created-packable-with-normal-entry-intact",
        "host-executable-in-dist-dynamic-project-directory",
        "first-run-extracted-native-runtime-and-started-gtk",
        "second-run-reused-byte-identical-runtime"]) {
        assert.match(nativeBuild, new RegExp(escapeRegExp(evidence), "u"));
    }
    assert.match(nativeBuild, /process\.platform === "win32" \? "build:win" : "build:unix"/u);
    assert.match(nativeBuild, /process\.platform === "win32" \? "\.exe" : ""/u);
    assert.doesNotMatch(manifest.scripts["test:corpus:integrity"], /portable-build|validate-portable-build/u);
    const workflow = await read(".github/workflows/integral-corpus.yml");
    assert.match(workflow, /portable_build_native:/u);
    assert.match(workflow, /portable-build-native:/u);
    assert.match(workflow, /npm run test:gui:portable-build:native/u);
    assert.match(workflow, /xvfb-run -a npm run test:gui:portable-build:native/u);
    for (const operatingSystem of ["windows-latest", "ubuntu-latest", "macos-latest"]) {
        assert.match(workflow, new RegExp(`- ${operatingSystem}`, "u"));
    }
});

for (const scenario of corpus.identityCases) {
    test(`corpus portable: identidad ${scenario.file}`, () => {
        const descriptor = createJavaScriptProjectDescriptor(path.join("proyecto", scenario.file));
        assertIdentity(descriptor, scenario.name);
        assert.deepEqual(createJavaScriptProjectDescriptor(path.join("proyecto", scenario.file)), descriptor);
    });
}

test("corpus portable: un programa de consola publica la unidad transaccional mínima", async t => {
    const root = await temporaryWorkspace(t);
    const service = new CompilationService({ projectExporter: new CliJavaScriptProjectExporter({
        lockGenerator: deterministicLock
    }) });
    const artifact = await service.compileSource(consoleSource, path.join(root, "Punto Venta.clrs"), {
        exportProject: true
    });
    const projectFiles = await fs.readdir(artifact.outputDirectory);
    assert.equal(artifact.outputDirectory, path.join(root, "app", "punto-venta"));
    assert.equal(artifact.outputFileName, "punto-venta.js");
    assert.equal(artifact.exportProfile, "cli");
    assert.deepEqual(projectFiles.sort(), corpus.cliFiles.map(file => file.replace("<program>", "punto-venta")).sort());
    assert.doesNotMatch(artifact.generatedCode, /node-gtk|@yao-pkg\/pkg|bootstrap\.cjs|prepare-packable\.cjs/u);

    const temporary = new CompilationArtifact({ ast: null, sourcePath: path.join(root, "Punto Venta.clrs"),
        temporary: true, programKey: "private-key", userCode: "", generatedCode: "",
        requiredCapabilities: ["gui"] });
    assert.equal(temporary.outputDirectory, ".");
    assert.equal(temporary.outputFileName, "private-key_Punto Venta.mjs");
});

test("corpus portable: varios proyectos GUI publican cinco archivos coherentes y sin contaminación", async t => {
    const root = await temporaryWorkspace(t);
    const results = [];
    for (const scenario of corpus.identityCases.slice(0, 3)) {
        const artifact = await exportGui(guiSource, path.join(root, scenario.file));
        results.push(artifact);
        const descriptor = createJavaScriptProjectDescriptor(path.join(root, scenario.file));
        assertIdentity(descriptor, scenario.name);
        assert.deepEqual((await fs.readdir(artifact.projectDirectory)).sort(), corpus.guiFiles
            .map(file => file.replace("<program>", scenario.name)).sort());
        for (const absent of corpus.initiallyAbsent) {
            await assert.rejects(fs.access(path.join(artifact.projectDirectory,
                absent.replace("<program>", scenario.name))), error => error.code === "ENOENT");
        }
        const manifest = await readJson(path.join(artifact.projectDirectory, "package.json"));
        const lock = await readJson(path.join(artifact.projectDirectory, "package-lock.json"));
        assert.deepEqual(manifest, descriptor.manifest);
        assert.equal(manifest.dependencies["node-gtk"], corpus.manifest.nodeGtk);
        assert.deepEqual(manifest.allowScripts, { [`node-gtk@${corpus.manifest.nodeGtk}`]: true });
        assert.equal(manifest.devDependencies["@yao-pkg/pkg"], corpus.manifest.pkg);
        assert.deepEqual(manifest.pkg.assets, [corpus.manifest.asset,
            corpus.manifest.generatedAsset.replace("<program>", scenario.name)]);
        assert.match(manifest.scripts["build:win"], new RegExp(`--targets ${corpus.manifest.target} `, "u"));
        assert.match(manifest.scripts["build:unix"], new RegExp(`--targets ${corpus.manifest.target} `, "u"));
        assert.equal(lock.packages["node_modules/node-gtk"].version, corpus.manifest.nodeGtk);
        assert.equal(lock.packages["node_modules/@yao-pkg/pkg"].version, "6.22.0");
        for (const file of [descriptor.entryFile, descriptor.preparePackableFile, descriptor.bootstrapFile]) {
            const syntax = spawnSync(process.execPath, ["--check", path.join(artifact.projectDirectory, file)], {
                encoding: "utf8", windowsHide: true
            });
            assert.equal(syntax.status, 0, syntax.stderr);
        }
    }
    for (let index = 0; index < results.length; index++) {
        const infrastructure = await Promise.all(["prepare-packable.cjs", "bootstrap.cjs", "package.json"]
            .map(file => fs.readFile(path.join(results[index].projectDirectory, file), "utf8")));
        assert.equal(infrastructure.join("\n").includes(root), false);
        assert.doesNotMatch(infrastructure.join("\n"), /\.runtime[\\/]packages|file:\/\/\/private/iu);
        for (let other = 0; other < results.length; other++) {
            if (other !== index) {
                assert.doesNotMatch(infrastructure.join("\n"), new RegExp(escapeRegExp(results[other].outputFileName), "u"));
            }
        }
    }
});

test("corpus portable: npm start queda ligado al JavaScript normal", async t => {
    const root = await temporaryWorkspace(t);
    const artifact = await exportGui(guiSource, path.join(root, "Inicio Normal.clrs"));
    const manifest = await readJson(path.join(artifact.projectDirectory, "package.json"));
    assert.equal(manifest.scripts.start, `node ./${artifact.outputFileName}`);
    assert.doesNotMatch(manifest.scripts.start, /bootstrap|packable|pkg/u);
    await installBindingDouble(artifact.projectDirectory);
    const execution = spawnSync(process.execPath, [artifact.outputPath], {
        cwd: artifact.projectDirectory, encoding: "utf8", windowsHide: true, timeout: 10_000
    });
    assert.equal(execution.status, 0, execution.stderr);
    assert.equal(execution.stdout.replace(/\r\n/gu, "\n"), "oscuro\n");
    assert.equal(await exists(path.join(artifact.projectDirectory, "inicio-normal.packable.js")), false);
    assert.equal(await exists(path.join(artifact.projectDirectory, "bin")), false);
});

test("corpus portable: el preparador es reproducible y nunca modifica el entry normal", async t => {
    const root = await temporaryWorkspace(t);
    const artifact = await exportGui(guiSource, path.join(root, "Preparación Ágil.clrs"));
    const descriptor = createJavaScriptProjectDescriptor(path.join(root, "Preparación Ágil.clrs"));
    const sourceBefore = await fs.readFile(artifact.outputPath, "utf8");
    assert.doesNotMatch(sourceBefore, /__CLRS_PACKAGED_NODE_GTK_LOADER__/u);
    let previous;
    for (let attempt = 0; attempt < 2; attempt++) {
        const execution = spawnSync(process.execPath, [descriptor.preparePackablePath], {
            cwd: os.tmpdir(), encoding: "utf8", windowsHide: true
        });
        assert.equal(execution.status, 0, execution.stderr);
        const packable = await fs.readFile(descriptor.packablePath, "utf8");
        assert.match(packable, /__CLRS_PACKAGED_NODE_GTK_LOADER__/u);
        if (previous !== undefined) { assert.equal(packable, previous); }
        previous = packable;
    }
    assert.equal(await fs.readFile(artifact.outputPath, "utf8"), sourceBefore);
    assert.equal((previous.match(/__CLRS_PACKAGED_NODE_GTK_LOADER__/gu) ?? []).length > 0, true);
    assert.equal(await exists(path.join(artifact.projectDirectory, "dist")), false);
    assert.equal(await exists(path.join(artifact.projectDirectory, "bin")), false);
});

test("corpus portable: los fallos deterministas preservan la publicación anterior", async t => {
    const root = await temporaryWorkspace(t);
    const sourcePath = path.join(root, "Transacción.clrs");
    const published = await exportGui(guiSource, sourcePath);
    for (const scenario of corpus.failureCases) {
        const controller = new AbortController();
        const options = failureOptions(scenario.id, controller);
        const service = createService(options);
        if (scenario.id === "cancellation") { controller.abort(); }
        const result = await service.tryCompileSource(guiSource, sourcePath, {
            exportProject: true, signal: controller.signal
        });
        assert.equal(result.ok, false, scenario.id);
        assert.equal(result.errors[0].code, scenario.code, scenario.id);
        assert.equal(await fs.readFile(published.outputPath, "utf8"), published.generatedCode);
        assert.deepEqual(await fs.readdir(path.join(root, "app")), ["transaccion"]);
    }
});

function assertIdentity(descriptor, name) {
    assert.equal(descriptor.name, name);
    assert.equal(descriptor.programName, name);
    assert.equal(descriptor.portableName, name);
    assert.equal(descriptor.packageName, name);
    assert.equal(descriptor.entryFile, `${name}.js`);
    assert.equal(descriptor.packableFile, `${name}.packable.js`);
    assert.equal(descriptor.runtimeMarker, `.${name}-runtime`);
    assert.match(descriptor.manifest.scripts["build:win"], new RegExp(`/dist/${escapeRegExp(name)}/${escapeRegExp(name)}\\.exe$`, "u"));
    assert.match(descriptor.manifest.scripts["build:unix"], new RegExp(`/dist/${escapeRegExp(name)}/${escapeRegExp(name)}$`, "u"));
}

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

const deterministicLock = { async generate({ cwd }) {
    const manifest = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8"));
    await fs.writeFile(path.join(cwd, "package-lock.json"), JSON.stringify(lockDouble(manifest)));
} };

function createService(options = {}) {
    return new CompilationService({
        projectExporter: new JavaScriptProjectExporter({ lockGenerator: deterministicLock, ...options }),
        runtimePreparation: { prepare() { assert.fail("La exportación no prepara el runtime privado."); } }
    });
}

function exportGui(source, sourcePath) {
    return createService().compileSource(source, sourcePath, { exportProject: true });
}

function failureOptions(id, controller) {
    if (id === "prepare-factory") { return { createPrepareScript() { throw new Error("prepare"); } }; }
    if (id === "bootstrap-factory") { return { createBootstrapScript() { throw new Error("bootstrap"); } }; }
    if (id === "lock-generation") { return { lockGenerator: { async generate() {
        throw new JavaScriptExportError("LOCK_FAILED");
    } } }; }
    if (id === "lock-validation") { return { lockGenerator: { async generate({ cwd }) {
        await fs.writeFile(path.join(cwd, "package-lock.json"), "{}");
    } } }; }
    if (id === "cancellation") { return { lockGenerator: { async generate() { controller.abort(); } } }; }
    throw new Error(`Fallo de corpus desconocido: ${id}`);
}

async function installBindingDouble(projectDirectory) {
    const dependency = path.join(projectDirectory, "node_modules", "node-gtk");
    await fs.mkdir(dependency, { recursive: true });
    for (const file of ["FakeGtk.js", "FakeDialogs.js", "binding-testing-stub.mjs"]) {
        await fs.copyFile(path.join(projectRoot, "test", "fixtures", "gui", file), path.join(dependency, file));
    }
    await fs.writeFile(path.join(dependency, "package.json"), JSON.stringify({
        name: "node-gtk", version: "4.1.1", type: "module", exports: "./binding-testing-stub.mjs"
    }));
}

async function temporaryWorkspace(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clrs portable corpus José # "));
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

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
