// Ensayo opt-in: instala exclusivamente npm privado dentro de .runtime/.
// Nunca carga el addon en este coordinador ni altera una instalación existente.
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeGtkDependencyManager } from "../../src/infrastructure/gui/NodeGtkDependencyManager.js";
import { NpmProcessAdapter } from "../../src/infrastructure/gui/NpmProcessAdapter.js";
import { GuiProcessAdapter } from "../../src/infrastructure/gui/GuiProcessAdapter.js";
import { NodeGtkProbe } from "../../src/infrastructure/gui/NodeGtkProbe.js";
import { NodeRuntimeInspector } from "../../src/infrastructure/gui/NodeRuntimeInspector.js";

assert.equal(process.platform, "win32", "Este ensayo de reparación del bundle está dirigido a Windows.");
const parent = fileURLToPath(new URL("../../.runtime/", import.meta.url));
await fs.mkdir(parent, { recursive: true });
const root = await fs.mkdtemp(path.join(parent, "schema-validation-"));
const processes = new GuiProcessAdapter();
const npm = new NpmProcessAdapter(processes);
const probe = new NodeGtkProbe(processes);
const runtime = await new NodeRuntimeInspector(processes, process.execPath).inspect();
let installations = 0;
const states = [], checks = [];
const manager = new NodeGtkDependencyManager({ extensionRoot: root, nodeCommand: process.execPath,
    processAdapter: processes, onState(state) { states.push(state); console.log("STATE", state); },
    npm: { async install(request) { installations++; return npm.install(request); } },
    probe: { async check(resolved, info, options) { checks.push(resolved.entryUrl); return probe.check(resolved, info, options); } }
});
let report;
try {
    const first = await manager.ensure();
    const bundle = path.join(path.dirname(fileURLToPath(first.entryUrl)), "binding",
        `node-v${runtime.abi}-win32-${runtime.arch}`);
    const schemas = path.join(bundle, "share/glib-2.0/schemas");
    const compiled = path.join(schemas, "gschemas.compiled");
    assert.ok(compiled.startsWith(root + path.sep));
    await fs.access(path.join(schemas, "org.gtk.gtk4.Settings.FileChooser.gschema.xml"));
    await fs.access(compiled);
    console.log("VALID_BASELINE", JSON.stringify(first.gtkVersion));
    await fs.unlink(compiled); // Sólo el recurso de esta instalación aislada.
    await assert.rejects(probe.check(first, runtime), { code: "CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE" });
    // Demuestra que el criterio anterior aún pasaría, sin inicializar selectores.
    const oldCheck = await processes.run(runtime.executable, ["--input-type=module", "-e",
        `const {default:gi}=await import(${JSON.stringify(first.entryUrl)}); const Gtk=gi.require('Gtk','4.0');
        console.log(JSON.stringify([Gtk.getMajorVersion(),Gtk.getMinorVersion(),Gtk.getMicroVersion()]));`]);
    assert.equal(oldCheck.code, 0, oldCheck.stderr);
    assert.deepEqual(JSON.parse(oldCheck.stdout), first.gtkVersion);
    const before = installations; states.length = 0; checks.length = 0;
    const repaired = await manager.ensure();
    assert.equal(installations - before, 1);
    assert.deepEqual(states, ["CHECKING", "BROKEN", "INSTALLING", "CHECKING", "READY"]);
    assert.equal(checks.length, 3);
    await probe.check(repaired, runtime);
    for (const dir of ["staging", "locks"]) { assert.deepEqual(await fs.readdir(path.join(root, ".runtime", dir)), []); }
    console.log("REPAIR_VERIFIED", JSON.stringify({ repairs: installations - before, checks: checks.length }));
    const native = await processes.run(runtime.executable, [fileURLToPath(new URL("./native-file-dialog-validation.mjs", import.meta.url)), repaired.entryUrl], { timeoutMs: 30000 });
    console.log("FILE_DIALOG", native.stdout); if (native.stderr) { console.error(native.stderr); }
    assert.equal(native.code, 0, native.stderr);
    report = { ok: true, node: runtime.version, abi: runtime.abi, gtk: repaired.gtkVersion,
        damagedCopyRejected: true, oldGtkOnlyCheckPassed: true, repairs: installations - before,
        states, native: JSON.parse(native.stdout.trim().split(/\r?\n/).at(-1)) };
} finally {
    // El único árbol eliminable es el mkdtemp creado directamente bajo .runtime.
    assert.equal(path.dirname(root), path.resolve(parent));
    assert.ok(path.basename(root).startsWith("schema-validation-"));
    await fs.rm(root, { recursive: true, force: true });
}
console.log(JSON.stringify({ ...report, isolatedInstallationRemoved: true }));
