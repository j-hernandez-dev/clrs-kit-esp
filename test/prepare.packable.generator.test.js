import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseSource } from "../src/language/LanguageFrontend.js";
import { SemanticAnalyzer } from "../src/semantic/SemanticAnalyzer.js";
import { JavaScriptGenerator } from "../src/compiler/JavaScriptGenerator.js";
import { GUI_BINDING_LOAD_PROTOCOL } from "../src/compiler/gui/GuiBindingLoadSource.js";
import { createJavaScriptProjectIdentity } from "../src/compiler/export/JavaScriptProjectDescriptor.js";
import { PACKABLE_SUPPORTED_PLATFORMS, assertPackablePlatform,
    createPackablePreparationScript } from "../src/compiler/export/PackablePreparationScriptBuilder.js";

function generatedGuiSource() {
    const ast = parseSource('PRINCIPAL()\n    VENTANA("v", "Prueba")\n    MOSTRAR("v")').ast;
    const semanticModel = new SemanticAnalyzer().analyze(ast);
    return new JavaScriptGenerator().generate(ast, { semanticModel, runtimeContext: { gui: {
        moduleUrl: "node-gtk",
        factorySource: "function(){return {invoke(){},async waitForIdle(){},async dispose(){}}}"
    } } }).generatedCode;
}

async function temporaryProject(t, name = "Inventario ñ.clrs") {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clrs prepare packable ñ-"));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const identity = createJavaScriptProjectIdentity(path.join(root, name));
    await fs.mkdir(identity.projectDirectory, { recursive: true });
    return { root, identity };
}

test("prepare-packable: identidad deriva nombres y la fábrica produce CJS determinista sin hardcodes", () => {
    const inventory = createJavaScriptProjectIdentity("Inventario.clrs");
    const sales = createJavaScriptProjectIdentity("Punto Venta.clrs");
    assert.equal(inventory.packableFile, "inventario.packable.js");
    assert.equal(inventory.preparePackableFile, "prepare-packable.cjs");
    assert.equal(inventory.packablePath, path.join(inventory.projectDirectory, inventory.packableFile));
    assert.equal(inventory.preparePackablePath, path.join(inventory.projectDirectory, inventory.preparePackableFile));
    const first = createPackablePreparationScript(inventory);
    assert.equal(first, createPackablePreparationScript(inventory));
    assert.match(first, /inventario\.js/u);
    assert.match(first, /inventario\.packable\.js/u);
    assert.doesNotMatch(first, /puntoventa|punto-venta/u);
    assert.match(createPackablePreparationScript(sales), /punto-venta\.packable\.js/u);
    assert.deepEqual(PACKABLE_SUPPORTED_PLATFORMS, ["win32", "linux", "darwin"]);
    for (const platform of PACKABLE_SUPPORTED_PLATFORMS) { assert.equal(assertPackablePlatform(platform), platform); }
    assert.throws(() => assertPackablePlatform("aix"), { code: "CLRS_GUI_PACKABLE_UNSUPPORTED_PLATFORM" });
});

test("prepare-packable: genera siempre una variante nueva sin modificar el JavaScript fuente", async t => {
    const { root, identity } = await temporaryProject(t);
    const source = generatedGuiSource();
    const helper = createPackablePreparationScript(identity);
    await fs.writeFile(identity.entryPath, source, "utf8");
    await fs.writeFile(identity.preparePackablePath, helper, "utf8");
    const syntax = spawnSync(process.execPath, ["--check", identity.preparePackablePath], { encoding: "utf8", windowsHide: true });
    assert.equal(syntax.status, 0, syntax.stderr);

    const first = spawnSync(process.execPath, [identity.preparePackablePath], {
        cwd: os.tmpdir(), encoding: "utf8", windowsHide: true
    });
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /inventario-n\.packable\.js/u);
    const packable = await fs.readFile(identity.packablePath, "utf8");
    assert.equal(await fs.readFile(identity.entryPath, "utf8"), source);
    assert.equal(packable.split(`globalThis.${GUI_BINDING_LOAD_PROTOCOL.packagedLoaderProperty}`).length - 1, 1);
    assert.doesNotMatch(packable, /import\.meta\.resolve|^\s*import\s+.*from/mu);
    assert.match(packable, /CLRS_GUI_PACKAGED_LOADER_MISSING/u);

    await fs.writeFile(identity.packablePath, "contenido anterior", "utf8");
    const second = spawnSync(process.execPath, [identity.preparePackablePath], { encoding: "utf8", windowsHide: true });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(await fs.readFile(identity.packablePath, "utf8"), packable);
    assert.equal(await fs.readFile(identity.entryPath, "utf8"), source);
    assert.deepEqual((await fs.readdir(identity.projectDirectory)).sort(),
        [identity.entryFile, identity.packableFile, identity.preparePackableFile].sort());
    await assert.rejects(fs.access(path.join(root, "dist")), error => error.code === "ENOENT");
});

test("prepare-packable: rechaza plataforma, fuente ausente o región inválida sin publicar variante", async t => {
    const { identity } = await temporaryProject(t, "Programa.clrs");
    await fs.writeFile(identity.preparePackablePath, createPackablePreparationScript(identity), "utf8");
    const unsupported = spawnSync(process.execPath, ["-e",
        "const helper=require(process.argv[1]);try{helper.preparePackable({platform:'aix'});}catch(error){process.stdout.write(error.code);}",
        identity.preparePackablePath], { encoding: "utf8", windowsHide: true });
    assert.equal(unsupported.status, 0, unsupported.stderr);
    assert.equal(unsupported.stdout, "CLRS_GUI_PACKABLE_UNSUPPORTED_PLATFORM");

    const missing = spawnSync(process.execPath, [identity.preparePackablePath], { encoding: "utf8", windowsHide: true });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /CLRS_GUI_PACKABLE_SOURCE_NOT_FOUND/u);
    await fs.writeFile(identity.entryPath, "console.log('sin región');\n", "utf8");
    const invalid = spawnSync(process.execPath, [identity.preparePackablePath], { encoding: "utf8", windowsHide: true });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /CLRS_GUI_PACKABLE_INVALID_REGION/u);
    await assert.rejects(fs.access(identity.packablePath), error => error.code === "ENOENT");
});

test("prepare-packable: la fábrica rechaza nombres inseguros antes de escribir archivos", () => {
    for (const identity of [
        { entryFile: "../programa.js", packableFile: "programa.packable.js" },
        { entryFile: "programa.js", packableFile: "carpeta/programa.packable.js" },
        { entryFile: "programa.txt", packableFile: "programa.packable.js" },
        { entryFile: "programa.js", packableFile: "programa.js" },
        { entryFile: "programa.js", packableFile: "otro.packable.js" }
    ]) {
        assert.throws(() => createPackablePreparationScript(identity), TypeError);
    }
});
