import assert from "node:assert/strict";
import test from "node:test";

import { validCliJavaScriptProjectLock,
    validCliJavaScriptProjectSnapshot } from "../src/compiler/export/CliJavaScriptProjectValidator.js";
import { createCliJavaScriptProjectDescriptor } from "../src/compiler/export/JavaScriptProjectDescriptor.js";
import { NPM_PACKAGE_LOCK_FLAGS, NpmPackageLockAdapter } from "../src/compiler/export/NpmPackageLockAdapter.js";

const integrity = seed => `sha512-${Buffer.alloc(64, seed).toString("base64")}`;

test("lock CLI estricto: acepta un grafo npm v3 cerrado, íntegro y exclusivamente de desarrollo", () => {
    const descriptor = createCliJavaScriptProjectDescriptor("Herramienta.clrs");
    const lock = canonicalLock(descriptor.manifest);
    const before = structuredClone(lock);

    assert.equal(validCliJavaScriptProjectLock(lock, descriptor.manifest), true);
    assert.deepEqual(lock, before);
    assert.equal(Object.keys(lock.packages).length, 6);
    assert.equal(lock.packages["node_modules/@yao-pkg/pkg"].dev, true);
    assert.equal(lock.packages["node_modules/pkg-fetch"].dev, true);

    const withoutOptional = canonicalLock(descriptor.manifest);
    delete withoutOptional.packages["node_modules/optional-helper"];
    assert.equal(validCliJavaScriptProjectLock(withoutOptional, descriptor.manifest), true);
});

test("lock CLI estricto: rechaza versiones, raíz, pkg, integridad y transportes divergentes", () => {
    const descriptor = createCliJavaScriptProjectDescriptor("Herramienta.clrs");
    const changes = [
        lock => { lock.lockfileVersion = 2; },
        lock => { lock.requires = false; },
        lock => { lock.dependencies = {}; },
        lock => { lock.name = "otro"; },
        lock => { lock.packages[""].dependencies = { "node-gtk": "4.1.1" }; },
        lock => { lock.packages[""].devDependencies.extra = "1.0.0"; },
        lock => { lock.packages[""].bin = { herramienta: "bootstrap.cjs" }; },
        lock => { lock.packages[""].engines.node = ">=22"; },
        lock => { delete lock.packages["node_modules/@yao-pkg/pkg"]; },
        lock => { lock.packages["node_modules/@yao-pkg/pkg"].version = "7.0.0"; },
        lock => { lock.packages["node_modules/@yao-pkg/pkg"].dev = false; },
        lock => { lock.packages["node_modules/pkg-fetch"].integrity = "sha512-YWJj"; },
        lock => { lock.packages["node_modules/pkg-fetch"].resolved = "http://registry.example/pkg.tgz"; },
        lock => { lock.packages["node_modules/pkg-fetch"].resolved = "file:///privado/pkg.tgz"; },
        lock => { lock.packages["node_modules/pkg-fetch"].resolved = "https://token:secret@registry.example/pkg.tgz"; },
        lock => { lock.packages["node_modules/pkg-fetch"].resolved += "?token=secret"; },
        lock => { lock.packages["node_modules/pkg-fetch"].link = true; },
        lock => { lock.packages["node_modules/pkg-fetch"].version = "latest"; }
    ];
    for (const change of changes) {
        const lock = canonicalLock(descriptor.manifest);
        change(lock);
        assert.equal(validCliJavaScriptProjectLock(lock, descriptor.manifest), false);
    }
});

test("lock CLI estricto: exige dependencias alcanzables y prohíbe paquetes huérfanos o GUI", () => {
    const descriptor = createCliJavaScriptProjectDescriptor("Herramienta.clrs");
    const changes = [
        lock => { lock.packages["node_modules/pkg-fetch"].dependencies.faltante = "1.0.0"; },
        lock => { lock.packages["node_modules/orphan"] = packageEntry("orphan", 10); },
        lock => { lock.packages["node_modules/node-gtk"] = packageEntry("node-gtk", 11); },
        lock => { lock.packages["node_modules/pkg-fetch"].dependencies["node-gtk"] = "4.1.1"; },
        lock => { lock.packages["node_modules/pkg-fetch"].dev = false; },
        lock => { lock.packages["node_modules/pkg-fetch/../../escape"] = packageEntry("escape", 12); },
        lock => { lock.packages["node_modules/pkg-fetch"].dependencies["../escape"] = "1.0.0"; }
    ];
    for (const change of changes) {
        const lock = canonicalLock(descriptor.manifest);
        change(lock);
        assert.equal(validCliJavaScriptProjectLock(lock, descriptor.manifest), false);
    }
});

test("proyecto CLI estricto: liga byte a byte JS y manifest con el lock validado", () => {
    const descriptor = createCliJavaScriptProjectDescriptor("Herramienta.clrs");
    const generatedCode = "console.log('CLRS');\n";
    const manifestText = JSON.stringify(descriptor.manifest, null, 2) + "\n";
    const lockText = JSON.stringify(canonicalLock(descriptor.manifest), null, 2) + "\n";
    const snapshot = { descriptor, generatedCode, entryText: generatedCode, manifestText, lockText };
    assert.equal(validCliJavaScriptProjectSnapshot(snapshot), true);
    assert.equal(validCliJavaScriptProjectSnapshot({ ...snapshot, entryText: generatedCode + "// cambio" }), false);
    assert.equal(validCliJavaScriptProjectSnapshot({ ...snapshot,
        manifestText: JSON.stringify(descriptor.manifest) }), false);
    assert.equal(validCliJavaScriptProjectSnapshot({ ...snapshot, lockText: "{}" }), false);
    assert.equal(validCliJavaScriptProjectSnapshot({ ...snapshot, lockText: "no-json" }), false);
});

test("generador de lock: usa una receta npm inmutable, sin instalación ni scripts", async () => {
    const calls = [];
    const adapter = new NpmPackageLockAdapter({ cache: "C:/cache-clrs", findCli: async () => "C:/npm/npm-cli.js",
        inspector: { async inspect() { return { executable: process.execPath }; } },
        processAdapter: { environment: {}, async run(executable, args, options) {
            calls.push({ executable, args, options });
            return { code: 0 };
        } } });
    await adapter.generate({ cwd: "C:/proyecto-stage" });

    assert.equal(Object.isFrozen(NPM_PACKAGE_LOCK_FLAGS), true);
    assert.deepEqual(calls, [{ executable: process.execPath,
        args: ["C:/npm/npm-cli.js", "install", ...NPM_PACKAGE_LOCK_FLAGS,
            "--prefix", "C:/proyecto-stage", "--cache", "C:/cache-clrs"],
        options: { cwd: "C:/proyecto-stage", signal: undefined, timeoutMs: 120_000 } }]);
    for (const flag of ["--package-lock-only", "--ignore-scripts", "--include=dev",
        "--install-strategy=hoisted", "--global=false", "--workspaces=false"]) {
        assert.ok(NPM_PACKAGE_LOCK_FLAGS.includes(flag));
    }
    assert.equal(calls[0].args.includes("ci"), false);
    assert.equal(calls[0].args.includes("node_modules"), false);
});

function canonicalLock(manifest) {
    return { name: manifest.name, version: manifest.version, lockfileVersion: 3, requires: true, packages: {
        "": { name: manifest.name, version: manifest.version,
            devDependencies: { ...manifest.devDependencies }, engines: { ...manifest.engines },
            bin: { [manifest.name]: manifest.bin.replace(/^\.\//u, "") } },
        "node_modules/@yao-pkg/pkg": { ...packageEntry("pkg", 1),
            dependencies: { "pkg-fetch": "^3.0.0", semver: "^7.0.0" },
            optionalDependencies: { "optional-helper": "^1.0.0" },
            peerDependencies: { "peer-helper": "^1.0.0" } },
        "node_modules/pkg-fetch": { ...packageEntry("pkg-fetch", 2),
            dependencies: { semver: "^7.0.0" } },
        "node_modules/semver": packageEntry("semver", 3),
        "node_modules/optional-helper": packageEntry("optional-helper", 4),
        "node_modules/peer-helper": packageEntry("peer-helper", 5)
    } };
}

function packageEntry(name, seed) {
    return { version: name === "pkg" ? "6.22.0" : "1.2.3",
        resolved: `https://registry.npmjs.org/${name}/-/${name}-1.2.3.tgz`,
        integrity: integrity(seed), dev: true };
}
