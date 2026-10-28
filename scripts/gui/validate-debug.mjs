// Ensayo DAP + GTK real, opt-in. Reutiliza el pipeline de dependencias y el
// adaptador DAP; ni este coordinador ni el Extension Host cargan node-gtk.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeGtkDependencyManager } from "../../src/infrastructure/gui/NodeGtkDependencyManager.js";
import { guiDapHarness } from "../../test/fixtures/gui/GuiDapHarness.js";
const parent = fileURLToPath(new URL("../../.runtime/", import.meta.url));
await mkdir(parent, { recursive: true });
const root = await mkdtemp(path.join(parent, "debug-validation-"));
const checks = [];
const stops = f => f.events.filter(e => e.type === "stopped");
async function stopped(f, count) { await f.wait(() => stops(f).length >= count); return stops(f)[count - 1]; }
let runtime;
try {
    runtime = await new NodeGtkDependencyManager({ extensionRoot: root, nodeCommand: process.execPath,
        onState: state => console.log("STATE", state) }).ensure();
    const base = ['PRINCIPAL()', '    VENTANA_APLICACION("v", "CLRS: validación DAP GTK")',
        '    ENTRADA("e")', '    CONTENER("v", "e")', '    MOSTRAR("v")'];
    const options = { parent: root, moduleUrl: runtime.entryUrl };
    let f = await guiDapHarness(['AL_CERRAR(id)', '    permitido = VERDAD', '    retornar no permitido',
        ...base, '    CONECTAR("v", "cerrar", AL_CERRAR)', '    CERRAR("v")', '    escribir "FIN_DAP_GTK"'].join("\n"),
    { ...options, breakpoints: [{ line: 10 }] });
    try {
        assert.equal((await stopped(f, 1)).location.startLine, 10);
        f.request("stepIn"); assert.equal((await stopped(f, 2)).location.startLine, 2);
        assert.equal(f.request("stackTrace").stackFrames[0].name, "AL_CERRAR");
        f.request("stepOut"); assert.equal((await stopped(f, 3)).location.startLine, 11);
        f.request("continue"); const result = await f.completion;
        assert.equal(result.code, 0, result.stderr); assert.match(result.stdout, /FIN_DAP_GTK/);
        checks.push("native-close-callback-step-in-out-and-normal-termination");
    } finally { await f.dispose(); }
    f = await guiDapHarness(['AL_CAMBIO(id, texto)', '    copia = texto', '    ruta = ABRIR_ARCHIVO("f", "v")',
        '    escribir "DESPUES_DEL_DIALOGO"', ...base, '    DIALOGO_ARCHIVO("f")',
        `    ESTABLECER("f", "carpeta_inicial", ${JSON.stringify(root.replaceAll("\\", "/"))})`,
        '    CONECTAR("e", "cambio", AL_CAMBIO)', '    ESTABLECER("e", "texto", "GTK_REAL")'].join("\n"),
    { ...options, breakpoints: [{ line: 3 }] });
    try {
        const event = await stopped(f, 1);
        assert.equal(event.state.frames.length, 1);
        assert.equal(event.state.frames[0].name, "AL_CAMBIO");
        assert.equal(event.state.frames[0].locals.find(v => v.name === "copia").value, '"GTK_REAL"');
        assert.doesNotMatch(JSON.stringify(event.state), /Gtk[A-Z]|GObject/);
        f.request("next");
        await new Promise(resolve => setTimeout(resolve, 600)); // Permite abrir Gtk.FileDialog real.
        assert.equal(stops(f).length, 1, "Step Over aún espera al diálogo");
        const waiting = f.snapshot().steps.at(-1);
        assert.equal(waiting.flow.kind, "wait");
        assert.equal(waiting.flow.functionName, "ABRIR_ARCHIVO");
        assert.equal(waiting.location.startLine, 3);
        f.request("pause"); assert.equal((await stopped(f, 2)).reason, "pause");
        assert.equal(f.snapshot().steps.at(-1).flow.kind, "paused");
        f.request("terminate"); const result = await f.completion;
        assert.equal(result.code, 0, result.stderr);
        assert.equal(f.events.at(-1).status, "cancelled");
        assert.doesNotMatch(result.stdout, /DESPUES_DEL_DIALOGO/);
        if (result.stderr) { console.error(result.stderr); }
        checks.push("native-change-callback-locals-and-file-dialog-step-over-pause-terminate");
        checks.push("native-gui-dialog-wait-flow-and-dap-pause");
    } finally { await f.dispose(); }
    for (const directory of ["staging", "locks"]) { assert.deepEqual(await readdir(path.join(root, ".runtime", directory)), []); }
} finally {
    assert.equal(path.dirname(root), path.resolve(parent));
    assert.ok(path.basename(root).startsWith("debug-validation-"));
    await rm(root, { recursive: true, force: true });
}
console.log(JSON.stringify({ ok: true, platform: process.platform, arch: process.arch, node: process.versions.node,
    gtk: runtime.gtkVersion, nodeGtk: runtime.version, checks, isolatedRuntimeRemoved: true }));
