// Aceptación nativa opt-in. El coordinador sólo provisiona npm privado;
// cada prueba carga GTK en un hijo aislado con tiempo límite.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeGtkDependencyManager } from "../../src/infrastructure/gui/NodeGtkDependencyManager.js";
import { GuiProcessAdapter } from "../../src/infrastructure/gui/GuiProcessAdapter.js";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const parent = path.join(repository, ".runtime");
const evidenceDirectory = path.join(repository, "test/fixtures/gui");
const output = path.resolve(process.argv[2] ?? path.join(evidenceDirectory,
    `acceptance.${process.platform}-${process.arch}.node${process.versions.node.split(".")[0]}.json`));
assert.equal(path.dirname(output), evidenceDirectory, "La evidencia debe estar en test/fixtures/gui.");
await mkdir(parent, { recursive: true });
const root = await mkdtemp(path.join(parent, "corpus-validation-"));
const processes = new GuiProcessAdapter();
const states = [];
const report = { ok: false, platform: process.platform, arch: process.arch, node: process.versions.node,
    binding: "4.1.1", checks: [], cases: {}, notValidated: [
        "Otras plataformas, arquitecturas y versiones de Node/GTK no se certifican por este ensayo.",
        "Selección manual de una ruta real y apariencia visual.",
        "GTK exactamente 4.10."
    ] };
try {
    const manager = new NodeGtkDependencyManager({ extensionRoot: root, nodeCommand: process.execPath,
        onState(state) { states.push(state); console.error("GUI corpus:", state); } });
    const runtime = await manager.ensure();
    const reused = await manager.ensure();
    assert.equal(runtime.entryUrl, reused.entryUrl);
    assert.equal(states.filter(state => state === "INSTALLING").length, 1);
    report.gtk = runtime.gtkVersion;
    report.checks.push("isolated-private-install-schema-probe-and-reuse");
    for (const [name, file] of [
        ["base", "native-base-runtime-validation.mjs"],
        ["controls", "native-controls-validation.mjs"],
        ["events", "native-events-validation.mjs"],
        ["file-dialog", "native-file-dialog-validation.mjs"]
    ]) {
        console.error("GUI corpus:", name);
        const result = await processes.run(runtime.nodeExecutable,
            [fileURLToPath(new URL(file, import.meta.url)), runtime.entryUrl],
            { cwd: root, timeoutMs: 90_000 });
        assert.equal(result.code, 0, `${name}: ${result.stderr.slice(-4000)}`);
        const lines = result.stdout.split(/\r?\n/u);
        let evidence;
        for (let index = lines.length - 1; index >= 0 && !evidence; index--) {
            if (!lines[index].startsWith("{")) { continue; }
            try { evidence = JSON.parse(lines.slice(index).join("\n")); } catch { /* Salida previa al informe. */ }
        }
        assert.ok(evidence?.checks?.length, `${name}: falta evidencia estructurada.`);
        if (name === "events") { assert.equal(evidence.hasFileDialogResources, true); }
        if (name === "file-dialog") { assert.equal(evidence.schemaResolved, true); }
        report.cases[name] = evidence;
        report.checks.push(`native-${name}`);
    }
    for (const directory of ["staging", "locks"]) {
        assert.deepEqual(await readdir(path.join(root, ".runtime", directory)), []);
    }
    report.checks.push("private-staging-and-locks-clean");
    report.ok = true;
} catch (error) {
    report.failure = { code: error.code, message: error.publicMessage ?? error.message };
    process.exitCode = 1;
} finally {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith("corpus-validation-"));
    await rm(root, { recursive: true, force: true });
    report.isolatedRuntimeRemoved = true;
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
