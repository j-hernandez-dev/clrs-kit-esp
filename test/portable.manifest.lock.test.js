import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPortableJavaScriptProjectDescriptor,
    validJavaScriptProjectLock, validPortableJavaScriptProjectManifest } from "../src/compiler/export/JavaScriptProjectDescriptor.js";
import { NpmPackageLockAdapter } from "../src/compiler/export/NpmPackageLockAdapter.js";
import { PORTABLE_PACKAGING_CONTRACT, createPortableBuildScripts } from "../src/compiler/export/PortablePackagingContract.js";

function lockDouble(manifest, version = "6.22.0") {
    return { name: manifest.name, version: manifest.version, lockfileVersion: 3, packages: {
        "": { name: manifest.name, version: manifest.version, dependencies: { ...manifest.dependencies },
            devDependencies: { ...manifest.devDependencies } },
        "node_modules/node-gtk": { version: "4.1.1", resolved: "https://registry.npmjs.org/node-gtk/-/node-gtk-4.1.1.tgz",
            integrity: "sha512-YWJj" },
        "node_modules/@yao-pkg/pkg": { version, resolved: `https://registry.npmjs.org/@yao-pkg/pkg/-/pkg-${version}.tgz`,
            integrity: "sha512-YWJj", dev: true }
    } };
}

test("manifest portable: identidad, scripts, bin, dependencias y assets son canónicos", () => {
    for (const source of ["programa.clrs", "Mi Programa.clrs", "Árbol & Caja.clrs", "CON.clrs", "a%PATH%.clrs"]) {
        const descriptor = createPortableJavaScriptProjectDescriptor(source);
        const { manifest } = descriptor;
        assert.deepEqual(descriptor, createPortableJavaScriptProjectDescriptor(source));
        assert.equal(manifest.name, descriptor.portableName);
        assert.equal(manifest.bin, "./bootstrap.cjs");
        assert.equal(manifest.scripts.start, `node ./${descriptor.entryFile}`);
        const prefix = "node ./prepare-packable.cjs && pkg . --targets host --output";
        assert.equal(manifest.scripts["build:win"], `${prefix} ./dist/${descriptor.name}/${descriptor.name}.exe`);
        assert.equal(manifest.scripts["build:unix"], `${prefix} ./dist/${descriptor.name}/${descriptor.name}`);
        assert.deepEqual(manifest.dependencies, { "node-gtk": "4.1.1" });
        assert.deepEqual(manifest.allowScripts, { "node-gtk@4.1.1": true });
        assert.deepEqual(manifest.devDependencies, { "@yao-pkg/pkg": "^6.22.0" });
        assert.deepEqual(manifest.pkg,
            { assets: ["node_modules/node-gtk/lib/binding/**/*", descriptor.packableFile] });
        assert.equal(validPortableJavaScriptProjectManifest(manifest, descriptor), true);
        assert.equal(Object.isFrozen(manifest), true);
        assert.equal(Object.isFrozen(manifest.scripts), true);
        assert.doesNotMatch(JSON.stringify(manifest), /corregir-|puntoventa|AppData|Program Files/iu);
    }
    assert.deepEqual(PORTABLE_PACKAGING_CONTRACT.supportedPlatforms, ["win32", "linux", "darwin"]);
    assert.throws(() => createPortableBuildScripts({ portableName: "../programa",
        entryFile: "programa.js", preparePackableFile: "prepare-packable.cjs" }), TypeError);
});

test("manifest portable: la validación detecta cualquier divergencia del contrato", () => {
    const descriptor = createPortableJavaScriptProjectDescriptor("Inventario.clrs");
    const changes = [
        manifest => { manifest.bin = "./inventario.js"; },
        manifest => { manifest.scripts.start = "node ./inventario.packable.js"; },
        manifest => { manifest.scripts["build:win"] = manifest.scripts["build:win"].replace("prepare-packable", "corregir-inventario"); },
        manifest => { manifest.devDependencies["@yao-pkg/pkg"] = "latest"; },
        manifest => { manifest.pkg.assets = []; },
        manifest => { manifest.allowScripts = { "node-gtk": true }; }
    ];
    for (const change of changes) {
        const manifest = structuredClone(descriptor.manifest);
        change(manifest);
        assert.equal(validPortableJavaScriptProjectManifest(manifest, descriptor), false);
    }
});

test("lock portable: valida dependencias de ejecución y desarrollo resueltas por npm", () => {
    const descriptor = createPortableJavaScriptProjectDescriptor("Inventario.clrs");
    assert.equal(validJavaScriptProjectLock(lockDouble(descriptor.manifest), descriptor.manifest), true);
    assert.equal(validJavaScriptProjectLock(lockDouble(descriptor.manifest, "6.99.1"), descriptor.manifest), true);
    for (const mutate of [
        lock => { delete lock.packages[""].devDependencies; },
        lock => { lock.packages[""].devDependencies["@yao-pkg/pkg"] = "latest"; },
        lock => { lock.packages["node_modules/@yao-pkg/pkg"].version = "7.0.0"; },
        lock => { lock.packages["node_modules/@yao-pkg/pkg"].version = "6.21.9"; },
        lock => { lock.packages["node_modules/@yao-pkg/pkg"].dev = false; },
        lock => { lock.packages["node_modules/@yao-pkg/pkg"].resolved = "file:///private/pkg.tgz"; },
        lock => { delete lock.packages["node_modules/@yao-pkg/pkg"]; }
    ]) {
        const lock = lockDouble(descriptor.manifest);
        mutate(lock);
        assert.equal(validJavaScriptProjectLock(lock, descriptor.manifest), false);
    }
});

test("lock portable: npm recibe el manifest completo antes de resolver sólo metadatos", async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clrs portable lock ñ-"));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const descriptor = createPortableJavaScriptProjectDescriptor(path.join(root, "Punto Venta.clrs"));
    await fs.writeFile(path.join(root, "package.json"), JSON.stringify(descriptor.manifest, null, 2) + "\n", "utf8");
    const calls = [];
    const adapter = new NpmPackageLockAdapter({
        findCli: async () => path.join(root, "npm-cli.js"),
        inspector: { async inspect() { return { executable: process.execPath }; } },
        processAdapter: { environment: {}, async run(executable, args, options) {
            calls.push({ executable, args, options, manifest: JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8")) });
            return { code: 0 };
        } }
    });
    await adapter.generate({ cwd: root });
    assert.equal(calls.length, 1);
    assert.equal(validPortableJavaScriptProjectManifest(calls[0].manifest, descriptor), true);
    for (const flag of ["--package-lock-only", "--ignore-scripts", "--include=dev", "--no-audit", "--no-fund"]) {
        assert.ok(calls[0].args.includes(flag));
    }
    assert.equal(calls[0].args.includes("npm ci"), false);
    assert.equal(calls[0].options.cwd, root);
    await assert.rejects(fs.access(path.join(root, "node_modules")), error => error.code === "ENOENT");
});
