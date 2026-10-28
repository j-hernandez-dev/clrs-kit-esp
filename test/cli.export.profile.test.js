import assert from "node:assert/strict";
import test from "node:test";

import { CompilationArtifact } from "../src/compiler/CompilationArtifact.js";
import { JavaScriptExportProfiles, classifyJavaScriptExportProfile,
    requireJavaScriptExportProfile } from "../src/compiler/export/JavaScriptExportProfile.js";
import { JavaScriptProjectExportRouter } from "../src/compiler/export/JavaScriptProjectExportRouter.js";
import { CompilationService } from "../src/compiler/services/CompilationService.js";
import { getGuiRuntimeFactorySource } from "../src/standard-library/gui/runtime/GuiRuntimeSource.js";

const cliSource = [
    "PRINCIPAL()",
    "    escribir \"VENTANA BOTON node-gtk Gtk\""
].join("\n");
const guiSource = [
    "ventana = \"principal\"",
    "PRINCIPAL()",
    "    VENTANA(ventana, \"Perfil GUI\")",
    "    MOSTRAR(ventana)"
].join("\n");

test("perfil de exportación: clasifica sólo desde la decisión semántica", () => {
    assert.equal(classifyJavaScriptExportProfile({ gui: { usage: { requiresGui: false } } }),
        JavaScriptExportProfiles.CLI);
    assert.equal(classifyJavaScriptExportProfile({ gui: { usage: { requiresGui: true } } }),
        JavaScriptExportProfiles.GUI);
    for (const invalid of [undefined, {}, { gui: {} }, { gui: { usage: { requiresGui: "false" } } }]) {
        assert.throws(() => classifyJavaScriptExportProfile(invalid), TypeError);
    }
    assert.equal(requireJavaScriptExportProfile("cli"), "cli");
    assert.equal(requireJavaScriptExportProfile("gui"), "gui");
    assert.throws(() => requireJavaScriptExportProfile("console"), TypeError);
    assert.equal(Object.isFrozen(JavaScriptExportProfiles), true);
});

test("perfil de exportación: CompilationService enruta CLI y GUI por el mismo puerto", async () => {
    const routed = [];
    let emitted = 0;
    const service = new CompilationService({
        projectExporter: { async export(artifact) { routed.push(artifact); return artifact; } },
        fileEmitter: { async writeArtifact() { emitted++; } },
        runtimePreparation: { async prepare() { assert.fail("Exportar no prepara el runtime privado."); } }
    });

    const cli = await service.compileSource(cliSource, "proyecto/Consola.clrs", { exportProject: true });
    const gui = await service.compileSource(guiSource, "proyecto/Interfaz.clrs", { exportProject: true });

    assert.deepEqual(routed, [cli, gui]);
    assert.equal(emitted, 0);
    assert.equal(cli.exportProfile, JavaScriptExportProfiles.CLI);
    assert.deepEqual(cli.requiredCapabilities, []);
    assert.equal(cli.guiBindingSpecifier, undefined);
    assert.equal(cli.runtimeNodeCommand, undefined);
    assert.equal(gui.exportProfile, JavaScriptExportProfiles.GUI);
    assert.deepEqual(gui.requiredCapabilities, ["gui"]);
    assert.equal(gui.guiBindingSpecifier, "node-gtk");
    assert.equal(gui.runtimeNodeCommand, undefined);
    assert.equal(Object.isFrozen(cli), true);
    assert.equal(Object.isFrozen(gui), true);
});

test("perfil de exportación: temporales no declaran perfil ni atraviesan el exportador", async () => {
    const emitted = [], executed = [], prepared = [];
    const service = new CompilationService({
        projectExporter: { async export() { assert.fail("Un temporal no se exporta como proyecto."); } },
        fileEmitter: { async writeArtifact(artifact) { emitted.push(artifact); return artifact; } },
        runtimePreparation: { async prepare() {
            prepared.push("gui");
            return { gui: { moduleUrl: "file:///private/node-gtk/index.js",
                nodeExecutable: "private-node", factorySource: getGuiRuntimeFactorySource() } };
        } },
        programRunner: { async run(request) { executed.push(request); return { ok: true, exitCode: 0 }; } }
    });

    const cli = await service.runSource(cliSource, "Consola.clrs", { exportProject: true });
    const gui = await service.runSource(guiSource, "Interfaz.clrs", { exportProject: true });

    assert.equal(cli.artifact.exportProfile, undefined);
    assert.equal(gui.artifact.exportProfile, undefined);
    assert.deepEqual(prepared, ["gui"]);
    assert.deepEqual(emitted, [cli.artifact, gui.artifact]);
    assert.equal(executed.length, 2);
    assert.equal(executed[0].cleanupPath, cli.artifact.outputPath);
    assert.equal(executed[1].cleanupPath, gui.artifact.outputPath);
    assert.equal(executed[1].command, "private-node");
});

test("perfil de exportación: el router mantiene separadas las implementaciones CLI y GUI", async () => {
    const calls = [];
    const router = new JavaScriptProjectExportRouter({
        cliExporter: { async export(artifact, options) { calls.push(["cli", artifact, options]);
            return Object.freeze({ ...artifact, kind: "node-project" }); } },
        guiExporter: { async export(artifact, options) { calls.push(["gui", artifact, options]);
            return Object.freeze({ ...artifact, kind: "node-project" }); } }
    });
    const cli = artifact("cli", []);
    const gui = artifact("gui", ["gui"], { guiBindingSpecifier: "node-gtk" });
    const signal = new AbortController().signal;

    const cliResult = await router.export(cli, { signal });
    assert.equal(cliResult.kind, "node-project");
    const guiResult = await router.export(gui, { signal });
    assert.equal(guiResult.kind, "node-project");
    assert.deepEqual(calls, [["cli", cli, { signal }], ["gui", gui, { signal }]]);
    await assert.rejects(router.export(artifact("cli", ["gui"])), hasCode("CLRS_JS_EXPORT_PRIVATE_PATH_LEAK"));
    await assert.rejects(router.export(artifact("gui", [])), hasCode("CLRS_JS_EXPORT_INVALID_PROFILE"));
    await assert.rejects(router.export({ temporary: false, requiredCapabilities: [] }),
        hasCode("CLRS_JS_EXPORT_INVALID_PROFILE"));
});

test("perfil de exportación: el artefacto rechaza perfiles desconocidos o temporales", () => {
    assert.throws(() => artifact("otro", []), TypeError);
    assert.throws(() => new CompilationArtifact({ ast: null, sourcePath: "programa.clrs", temporary: true,
        exportProject: true, exportProfile: "cli", userCode: "", generatedCode: "" }), TypeError);
});

function artifact(exportProfile, requiredCapabilities, extra = {}) {
    return new CompilationArtifact({ ast: null, sourcePath: "programa.clrs", temporary: false,
        exportProject: true, exportProfile, userCode: "", generatedCode: "", requiredCapabilities, ...extra });
}

function hasCode(code) {
    return error => error?.code === code;
}
