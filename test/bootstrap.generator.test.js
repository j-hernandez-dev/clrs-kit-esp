import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { GUI_BINDING_LOAD_PROTOCOL } from "../src/compiler/gui/GuiBindingLoadSource.js";
import { createBootstrapScript } from "../src/compiler/export/BootstrapScriptBuilder.js";
import { createJavaScriptProjectIdentity } from "../src/compiler/export/JavaScriptProjectDescriptor.js";

const require = createRequire(import.meta.url);

async function temporaryProject(t, name = "Inventario ñ.clrs") {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clrs bootstrap ñ-"));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const identity = createJavaScriptProjectIdentity(path.join(root, name));
    await fs.mkdir(identity.projectDirectory, { recursive: true });
    await fs.writeFile(identity.bootstrapPath, createBootstrapScript(identity), "utf8");
    return { root, identity, bootstrap: require(identity.bootstrapPath) };
}

async function fakeNodeGtk(root, options = {}) {
    const packageRoot = path.join(root, "fake-node-gtk");
    const packageJsonPath = path.join(packageRoot, "package.json");
    const bindingName = `node-v${process.versions.modules}-${process.platform}-${process.arch}`;
    const sourceRuntime = path.join(packageRoot, "lib", "binding", bindingName);
    await fs.mkdir(path.join(sourceRuntime, "girepository-1.0"), { recursive: true });
    await fs.mkdir(path.join(sourceRuntime, "share", "glib-2.0", "schemas"), { recursive: true });
    await fs.mkdir(path.join(sourceRuntime, "lib", "gdk-pixbuf-2.0", "2.10.0"), { recursive: true });
    await fs.mkdir(path.join(sourceRuntime, "bin"), { recursive: true });
    await fs.writeFile(packageJsonPath, JSON.stringify({ name: "node-gtk", version: options.version ?? "4.1.1" }), "utf8");
    await fs.writeFile(path.join(sourceRuntime, "node_gtk.node"), "addon", "utf8");
    await fs.writeFile(path.join(sourceRuntime, "girepository-1.0", "Gtk-4.0.typelib"), "typelib", "utf8");
    await fs.writeFile(path.join(sourceRuntime, "share", "glib-2.0", "schemas", "gschemas.compiled"), "schemas", "utf8");
    await fs.writeFile(path.join(sourceRuntime, "lib", "gdk-pixbuf-2.0", "2.10.0", "loaders.cache"), "cache", "utf8");
    await fs.writeFile(path.join(sourceRuntime, "bin", "gtk-runtime.bin"), "runtime", "utf8");
    return { packageRoot, packageJsonPath, bindingName, sourceRuntime };
}

async function fakeProcess(root, overrides = {}) {
    const keep = path.join(root, "keep-path");
    await fs.mkdir(keep, { recursive: true });
    const delimiter = process.platform === "win32" ? ";" : ":";
    const snapshot = process.platform === "win32" ? "C:\\snapshot\\programa" : "/snapshot/programa";
    const calls = [], output = [];
    return { calls, output, snapshot, value: {
        platform: overrides.platform ?? process.platform,
        arch: overrides.arch ?? process.arch,
        versions: { modules: overrides.modules ?? process.versions.modules },
        pid: 31415,
        execPath: path.join(root, process.platform === "win32" ? "programa.exe" : "programa"),
        env: {
            PATH: `${snapshot}${delimiter}${keep}`,
            GI_TYPELIB_PATH: snapshot,
            XDG_DATA_DIRS: snapshot,
            GSETTINGS_SCHEMA_DIR: snapshot,
            GDK_PIXBUF_MODULE_FILE: path.join(snapshot, "loaders.cache")
        },
        dlopen(...args) { calls.push(args); return args; },
        stdout: { write(value) { output.push(value); } }
    } };
}

test("bootstrap: identidad dinámica y fábrica CJS determinista sin nombres particulares", async t => {
    const { identity } = await temporaryProject(t);
    assert.equal(identity.portableName, "inventario-n");
    assert.equal(identity.bootstrapFile, "bootstrap.cjs");
    assert.equal(identity.bootstrapPath, path.join(identity.projectDirectory, "bootstrap.cjs"));
    assert.equal(identity.runtimeMarker, ".inventario-n-runtime");
    const source = createBootstrapScript(identity);
    assert.equal(source, createBootstrapScript(identity));
    assert.match(source, /inventario-n\.packable\.js/u);
    assert.match(source, /\.inventario-n-runtime/u);
    assert.match(source, /require\("node-gtk"\)/u);
    assert.match(source, /__CLRS_PACKAGED_NODE_GTK_LOADER__/u);
    assert.match(source, /new AsyncFunction\("require", source\)/u);
    assert.doesNotMatch(source, /return import\(/u);
    assert.doesNotMatch(source, /puntoventa|punto-venta|clrs-kit-esp-gpt/iu);
    const syntax = spawnSync(process.execPath, ["--check", identity.bootstrapPath], { encoding: "utf8", windowsHide: true });
    assert.equal(syntax.status, 0, syntax.stderr);
});

test("bootstrap: materializa, configura y reutiliza únicamente un runtime físico válido", async t => {
    const { root, identity, bootstrap } = await temporaryProject(t);
    const dependency = await fakeNodeGtk(root);
    const processDouble = await fakeProcess(identity.projectDirectory);
    const options = { appDirectory: identity.projectDirectory, packageJsonPath: dependency.packageJsonPath,
        processObject: processDouble.value };
    const first = bootstrap.preparePortableRuntime(options);
    assert.equal(first.reused, false);
    assert.equal(first.bindingName, dependency.bindingName);
    assert.equal(first.runtimeDirectory, path.join(identity.projectDirectory, "bin", dependency.bindingName));
    assert.equal(await fs.readFile(first.addonPath, "utf8"), "addon");
    assert.equal(JSON.parse(await fs.readFile(first.markerPath, "utf8")).projectId, identity.portableName);
    assert.ok(processDouble.value.env.PATH.startsWith(first.runtimeDirectory));
    for (const key of ["PATH", "GI_TYPELIB_PATH", "XDG_DATA_DIRS", "GSETTINGS_SCHEMA_DIR", "GDK_PIXBUF_MODULE_FILE"]) {
        assert.doesNotMatch(processDouble.value.env[key] ?? "", /[\\/]snapshot[\\/]/iu);
    }

    const requestedAddon = path.join(processDouble.snapshot, "node_modules", "node-gtk", "node_gtk.node");
    processDouble.value.dlopen({}, requestedAddon, 7);
    processDouble.value.dlopen({}, path.join(processDouble.snapshot, "otro.node"), 8);
    processDouble.value.dlopen({}, path.join(identity.projectDirectory, "node_gtk.node"), 9);
    assert.equal(processDouble.calls[0][1], first.addonPath);
    assert.match(processDouble.calls[1][1], /otro\.node$/u);
    assert.equal(processDouble.calls[2][1], path.join(identity.projectDirectory, "node_gtk.node"));

    const second = bootstrap.preparePortableRuntime(options);
    assert.equal(second.reused, true);
    await fs.rm(path.join(second.runtimeDirectory, "girepository-1.0"), { recursive: true });
    await fs.writeFile(path.join(dependency.sourceRuntime, "runtime-new.bin"), "nuevo", "utf8");
    const repaired = bootstrap.preparePortableRuntime(options);
    assert.equal(repaired.reused, false);
    assert.equal(await fs.readFile(path.join(repaired.runtimeDirectory, "runtime-new.bin"), "utf8"), "nuevo");
    processDouble.value.pkg = {};
    const resolvedFromExecutable = bootstrap.preparePortableRuntime({
        packageJsonPath: dependency.packageJsonPath, processObject: processDouble.value
    });
    assert.equal(resolvedFromExecutable.appDirectory, identity.projectDirectory);
    assert.equal(resolvedFromExecutable.reused, true);
    assert.deepEqual((await fs.readdir(path.join(identity.projectDirectory, "bin"))).sort(), [dependency.bindingName]);
});

test("bootstrap: registra el loader antes de evaluar la variante y reutiliza el binding", async t => {
    const { root, identity, bootstrap } = await temporaryProject(t, "Punto Venta.clrs");
    const dependency = await fakeNodeGtk(root);
    const processDouble = await fakeProcess(identity.projectDirectory);
    await fs.writeFile(path.join(identity.projectDirectory, "package.json"), JSON.stringify({ type: "module" }), "utf8");
    await fs.writeFile(identity.packablePath, `
const first = await globalThis.${GUI_BINDING_LOAD_PROTOCOL.packagedLoaderProperty}();
const second = await globalThis.${GUI_BINDING_LOAD_PROTOCOL.packagedLoaderProperty}();
globalThis.__clrsBootstrapEvidence = { same: first === second, id: first.id };
`, "utf8");
    let loads = 0;
    try {
        const result = await bootstrap.start({ appDirectory: identity.projectDirectory,
            packageJsonPath: dependency.packageJsonPath, processObject: processDouble.value,
            globalObject: globalThis, loadBinding() { loads += 1; return { id: "binding-controlado" }; }, quiet: true });
        assert.equal(result, undefined);
        assert.deepEqual(globalThis.__clrsBootstrapEvidence, { same: true, id: "binding-controlado" });
        assert.equal(loads, 1);
        assert.deepEqual(processDouble.output, []);
    } finally {
        delete globalThis[GUI_BINDING_LOAD_PROTOCOL.packagedLoaderProperty];
        delete globalThis.__clrsBootstrapEvidence;
    }
});

test("bootstrap: rechaza plataforma, dependencia, runtime e identidades incompatibles", async t => {
    const { root, identity, bootstrap } = await temporaryProject(t, "Programa.clrs");
    const dependency = await fakeNodeGtk(root);
    const unsupported = await fakeProcess(identity.projectDirectory, { platform: "aix" });
    assert.throws(() => bootstrap.preparePortableRuntime({ appDirectory: identity.projectDirectory,
        packageJsonPath: dependency.packageJsonPath, processObject: unsupported.value }),
    { code: "CLRS_GUI_BOOTSTRAP_UNSUPPORTED_PLATFORM" });

    const wrong = await fakeNodeGtk(path.join(root, "wrong"), { version: "0.0.0" });
    const processDouble = await fakeProcess(identity.projectDirectory);
    assert.throws(() => bootstrap.preparePortableRuntime({ appDirectory: identity.projectDirectory,
        packageJsonPath: wrong.packageJsonPath, processObject: processDouble.value }),
    { code: "CLRS_GUI_BOOTSTRAP_DEPENDENCY_INVALID" });

    await fs.rm(path.join(dependency.sourceRuntime, "girepository-1.0"), { recursive: true });
    assert.throws(() => bootstrap.preparePortableRuntime({ appDirectory: identity.projectDirectory,
        packageJsonPath: dependency.packageJsonPath, processObject: processDouble.value }),
    { code: "CLRS_GUI_BOOTSTRAP_RUNTIME_SOURCE_INVALID" });
    await fs.mkdir(path.join(dependency.sourceRuntime, "girepository-1.0"));
    await assert.rejects(bootstrap.start({ appDirectory: identity.projectDirectory,
        packageJsonPath: dependency.packageJsonPath, processObject: processDouble.value,
        globalObject: {}, loadBinding() { return {}; }, quiet: true }),
    { code: "CLRS_GUI_BOOTSTRAP_PACKABLE_NOT_FOUND" });

    for (const candidate of [
        { portableName: "../programa", packableFile: "programa.packable.js", bootstrapFile: "bootstrap.cjs", runtimeMarker: ".programa-runtime" },
        { portableName: "programa", packableFile: "otro.packable.js", bootstrapFile: "bootstrap.cjs", runtimeMarker: ".programa-runtime" },
        { portableName: "programa", packableFile: "programa.packable.js", bootstrapFile: "otro.cjs", runtimeMarker: ".programa-runtime" },
        { portableName: "programa", packableFile: "programa.packable.js", bootstrapFile: "bootstrap.cjs", runtimeMarker: ".otro-runtime" }
    ]) { assert.throws(() => createBootstrapScript(candidate), TypeError); }
});
