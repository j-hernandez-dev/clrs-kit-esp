import { access, realpath } from "node:fs/promises";
import path from "node:path";
import { GuiDependencyError, checkGuiCancellation } from "./GuiDependencyError.js";
import { checkGuiRuntimeCompatibility } from "../../standard-library/gui/runtime/GuiEnvironmentProbe.js";

export class NodeRuntimeInspector {
    constructor(processAdapter, command = "node") {
        this.process = processAdapter;
        this.command = command;
    }

    async inspect({ signal } = {}) {
        let runtime;
        try {
            const result = await this.process.run(this.command, ["-p", "JSON.stringify({executable:process.execPath,version:process.versions.node,abi:process.versions.modules,platform:process.platform,arch:process.arch,electron:!!process.versions.electron})"], { signal });
            if (result.code !== 0) { throw new Error("Node no inició."); }
            runtime = JSON.parse(result.stdout);
        } catch (error) {
            checkGuiCancellation(signal);
            throw new GuiDependencyError("CLRS_GUI_DEP_NODE_UNSUPPORTED", error);
        }
        const compatibility = checkGuiRuntimeCompatibility({ versions: { node: runtime.version },
            platform: runtime.platform, arch: runtime.arch });
        if (runtime.electron || !path.isAbsolute(runtime.executable) || !runtime.abi || !compatibility.ok) {
            throw new GuiDependencyError("CLRS_GUI_DEP_NODE_UNSUPPORTED");
        }
        return Object.freeze(runtime);
    }
}

/** Usa el CLI JavaScript de npm con el Node seleccionado, también en Windows. */
export async function findNpmCli(runtime, environment = process.env) {
    const bin = path.dirname(runtime.executable);
    const candidates = [path.join(bin, "node_modules/npm/bin/npm-cli.js"),
        path.resolve(bin, "../lib/node_modules/npm/bin/npm-cli.js")];
    const envPath = Object.entries(environment).find(([key]) => key.toUpperCase() === "PATH")?.[1] ?? "";
    for (const directory of envPath.split(path.delimiter).filter(Boolean)) {
        candidates.push(path.join(directory, "node_modules/npm/bin/npm-cli.js"));
        if (process.platform !== "win32") { candidates.push(path.join(directory, "npm")); }
    }
    for (const candidate of candidates) {
        try {
            const resolved = await realpath(candidate);
            if (path.basename(resolved) !== "npm-cli.js") { continue; }
            await access(resolved);
            return resolved;
        } catch { /* Buscar otra instalación pública de npm. */ }
    }
    throw new GuiDependencyError("CLRS_GUI_DEP_NPM_NOT_FOUND");
}
