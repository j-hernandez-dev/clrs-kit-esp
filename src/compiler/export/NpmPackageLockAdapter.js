import { GuiProcessAdapter } from "../../infrastructure/gui/GuiProcessAdapter.js";
import { findNpmCli, NodeRuntimeInspector } from "../../infrastructure/gui/NodeRuntimeInspector.js";
import { GuiDependencyError } from "../../infrastructure/gui/GuiDependencyError.js";
import { JavaScriptExportError, checkExportCancellation } from "./JavaScriptExportError.js";

export const NPM_PACKAGE_LOCK_FLAGS = Object.freeze([
    "--package-lock-only",
    "--ignore-scripts",
    "--include=dev",
    "--install-strategy=hoisted",
    "--no-audit",
    "--no-fund",
    "--global=false",
    "--workspaces=false",
    "--package-lock=true"
]);

/** Sólo metadatos npm: no instala node_modules, addons ni dependencias del SO. */
export class NpmPackageLockAdapter {
    constructor(options = {}) {
        this.process = options.processAdapter ?? new GuiProcessAdapter();
        this.nodeCommand = options.nodeCommand ?? "node";
        this.inspector = options.inspector ?? new NodeRuntimeInspector(this.process, this.nodeCommand);
        this.findCli = options.findCli ?? findNpmCli;
        this.cache = options.cache;
    }
    async generate({ cwd, signal }) {
        checkExportCancellation(signal);
        let runtime, cli;
        try {
            runtime = await this.inspector.inspect({ signal });
            cli = await this.findCli(runtime, this.process.environment);
        } catch (cause) {
            checkExportCancellation(signal);
            if (cause instanceof GuiDependencyError && cause.code === "CLRS_GUI_DEP_NODE_UNSUPPORTED") { throw cause; }
            throw new JavaScriptExportError("NPM_NOT_FOUND", cause);
        }
        try {
            const result = await this.process.run(runtime.executable, [cli, "install", ...NPM_PACKAGE_LOCK_FLAGS, "--prefix", cwd,
                ...(this.cache ? ["--cache", this.cache] : [])], { cwd, signal, timeoutMs: 120_000 });
            checkExportCancellation(signal);
            // No adjuntar stdout/stderr de npm: podrían incluir credenciales del registry.
            if (result.code !== 0) { throw new Error("npm no pudo generar el lock"); }
        } catch (cause) { checkExportCancellation(signal); throw new JavaScriptExportError("LOCK_FAILED", cause); }
    }
}
