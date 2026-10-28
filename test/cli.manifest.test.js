import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createCliJavaScriptProjectDescriptor, createPortableJavaScriptProjectDescriptor,
    validCliJavaScriptProjectManifest } from "../src/compiler/export/JavaScriptProjectDescriptor.js";
import { validCliJavaScriptProjectLock } from "../src/compiler/export/CliJavaScriptProjectValidator.js";
import { PORTABLE_PACKAGING_CONTRACT, createCliBuildScripts,
    createPortableNodeEngineRange } from "../src/compiler/export/PortablePackagingContract.js";

const expectedEngine = ">=22 <23 || >=24 <25 || >=26 <27";
const strongIntegrity = `sha512-${Buffer.alloc(64, 1).toString("base64")}`;

test("manifest CLI: reutiliza la identidad portable para nombres dinámicos", () => {
    const cases = [
        ["ventas.clrs", "ventas"],
        ["Punto Venta.clrs", "punto-venta"],
        ["ÁRBOL-Útil.clrs", "arbol-util"],
        ["mi_app-final.clrs", "mi_app-final"],
        ["CON.clrs", "clrs-con"],
        ["a%PATH%?.clrs", "a-path"],
        ["漢字.clrs", "clrs-exported-program"]
    ];

    for (const [source, name] of cases) {
        const descriptor = createCliJavaScriptProjectDescriptor(path.join("proyecto", source));
        assert.equal(descriptor.name, name);
        assert.equal(descriptor.directoryName, name);
        assert.equal(descriptor.entryFile, `${name}.js`);
        assert.equal(descriptor.projectDirectory, path.resolve("proyecto", "app", name));
        assert.equal(descriptor.entryPath, path.resolve("proyecto", "app", name, `${name}.js`));
        assert.equal(descriptor.manifest.name, name);
        assert.equal(descriptor.manifest.bin, `./${name}.js`);
        assert.equal(Object.isFrozen(descriptor), true);
        assert.equal(Object.isFrozen(descriptor.manifest), true);
    }
});

test("manifest CLI: define ejecución y build directo desde el único JavaScript fuente", () => {
    const descriptor = createCliJavaScriptProjectDescriptor("Punto Venta.clrs");
    const { manifest } = descriptor;

    assert.deepEqual(Object.keys(manifest),
        ["name", "version", "private", "type", "bin", "scripts", "engines", "devDependencies"]);
    assert.deepEqual(manifest, {
        name: "punto-venta",
        version: "1.0.0",
        private: true,
        type: "module",
        bin: "./punto-venta.js",
        scripts: {
            start: "node ./punto-venta.js",
            "build:win": "pkg . --targets host --output ./dist/punto-venta.exe",
            "build:unix": "pkg . --targets host --output ./dist/punto-venta"
        },
        engines: { node: expectedEngine },
        devDependencies: { "@yao-pkg/pkg": "^6.22.0" }
    });
    assert.equal(validCliJavaScriptProjectManifest(manifest, descriptor), true);
    assert.equal(Object.isFrozen(manifest.scripts), true);
    assert.equal(Object.isFrozen(manifest.engines), true);
    assert.equal(Object.isFrozen(manifest.devDependencies), true);
});

test("manifest CLI: omite por contrato toda infraestructura exclusiva de GUI", () => {
    const descriptor = createCliJavaScriptProjectDescriptor("Consola.clrs");
    const serialized = JSON.stringify(descriptor);

    for (const property of ["dependencies", "allowScripts", "pkg"]) {
        assert.equal(Object.hasOwn(descriptor.manifest, property), false);
    }
    for (const property of ["packableFile", "preparePackableFile", "bootstrapFile", "runtimeMarker",
        "packablePath", "preparePackablePath", "bootstrapPath"]) {
        assert.equal(Object.hasOwn(descriptor, property), false);
    }
    assert.doesNotMatch(serialized, /node-gtk|bootstrap\.cjs|prepare-packable\.cjs|\.packable\.js|gtk|binding/iu);
});

test("manifest CLI: el validador estricto rechaza residuos y divergencias", () => {
    const descriptor = createCliJavaScriptProjectDescriptor("Inventario.clrs");
    const changes = [
        manifest => { manifest.bin = "./bootstrap.cjs"; },
        manifest => { manifest.scripts.start = "node ./app.js"; },
        manifest => { manifest.scripts["build:win"] = "pkg . --targets node22-win-x64 --output ./dist/inventario.exe"; },
        manifest => { manifest.scripts["build:unix"] = "pkg . --targets host --output ./dist/inventario/inventario"; },
        manifest => { manifest.engines.node = ">=22"; },
        manifest => { manifest.devDependencies["@yao-pkg/pkg"] = "latest"; },
        manifest => { manifest.dependencies = { "node-gtk": "4.1.1" }; },
        manifest => { manifest.allowScripts = { "node-gtk@4.1.1": true }; },
        manifest => { manifest.pkg = { assets: ["node_modules/node-gtk/lib/binding/**/*"] }; }
    ];

    for (const change of changes) {
        const manifest = structuredClone(descriptor.manifest);
        change(manifest);
        assert.equal(validCliJavaScriptProjectManifest(manifest, descriptor), false);
    }
    assert.equal(validCliJavaScriptProjectManifest(null, descriptor), false);
    assert.equal(validCliJavaScriptProjectManifest(descriptor.manifest, { ...descriptor,
        entryFile: "otro.js" }), false);
});

test("manifest CLI: pkg, host, dist y Node proceden de autoridades compartidas", () => {
    assert.deepEqual(PORTABLE_PACKAGING_CONTRACT.dependency,
        { name: "@yao-pkg/pkg", version: "^6.22.0", cli: "pkg" });
    assert.deepEqual(PORTABLE_PACKAGING_CONTRACT.node.supportedMajors, [22, 24, 26]);
    assert.equal(PORTABLE_PACKAGING_CONTRACT.target, "host");
    assert.equal(PORTABLE_PACKAGING_CONTRACT.outputDirectory, "dist");
    assert.equal(createPortableNodeEngineRange(), expectedEngine);
    assert.throws(() => createCliBuildScripts({ name: "programa", portableName: "../programa",
        entryFile: "programa.js" }), TypeError);
    assert.throws(() => createCliBuildScripts({ name: "programa", portableName: "programa",
        entryFile: "app.js" }), TypeError);
});

test("manifest CLI: la definición GUI conserva su infraestructura especializada", () => {
    const descriptor = createPortableJavaScriptProjectDescriptor("Interfaz.clrs");
    assert.equal(descriptor.manifest.bin, "./bootstrap.cjs");
    assert.equal(descriptor.manifest.dependencies["node-gtk"], "4.1.1");
    assert.match(descriptor.manifest.scripts["build:win"], /^node \.\/prepare-packable\.cjs && pkg /u);
    assert.deepEqual(descriptor.manifest.engines, { node: expectedEngine });
    assert.ok(descriptor.manifest.pkg.assets.includes(descriptor.packableFile));
});

test("lock CLI: valida pkg resuelto y rechaza dependencias o artefactos GUI", () => {
    const descriptor = createCliJavaScriptProjectDescriptor("Consola.clrs");
    const createLock = () => ({ name: descriptor.manifest.name, version: descriptor.manifest.version,
        lockfileVersion: 3, requires: true, packages: {
            "": { name: descriptor.manifest.name, version: descriptor.manifest.version,
                devDependencies: { ...descriptor.manifest.devDependencies },
                engines: { ...descriptor.manifest.engines }, bin: { consola: "consola.js" } },
            "node_modules/@yao-pkg/pkg": { version: "6.22.0",
                resolved: "https://registry.npmjs.org/@yao-pkg/pkg/-/pkg-6.22.0.tgz",
                integrity: strongIntegrity, dev: true }
        } });
    assert.equal(validCliJavaScriptProjectLock(createLock(), descriptor.manifest), true);

    const changes = [
        lock => { lock.name = "otro"; },
        lock => { lock.packages[""].dependencies = { "node-gtk": "4.1.1" }; },
        lock => { lock.packages[""].bin = { consola: "bootstrap.cjs" }; },
        lock => { lock.packages[""].engines.node = ">=22"; },
        lock => { delete lock.packages["node_modules/@yao-pkg/pkg"]; },
        lock => { lock.packages["node_modules/@yao-pkg/pkg"].version = "7.0.0"; },
        lock => { lock.packages["node_modules/@yao-pkg/pkg"].dev = false; },
        lock => { lock.packages["node_modules/@yao-pkg/pkg"].resolved = "file:///privado/pkg.tgz"; },
        lock => { lock.packages["node_modules/node-gtk"] = { version: "4.1.1",
            resolved: "https://registry.npmjs.org/node-gtk/-/node-gtk-4.1.1.tgz", integrity: strongIntegrity, dev: true }; }
    ];
    for (const change of changes) {
        const lock = createLock();
        change(lock);
        assert.equal(validCliJavaScriptProjectLock(lock, descriptor.manifest), false);
    }
});
