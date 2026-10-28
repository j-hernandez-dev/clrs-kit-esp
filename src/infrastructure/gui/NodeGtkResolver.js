import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { NODE_GTK_RUNTIME_DEPENDENCY as dependency } from "../../standard-library/gui/GuiContract.js";
import { inside } from "./PrivateRuntimeLayout.js";
import { GuiDependencyError, checkGuiCancellation } from "./GuiDependencyError.js";

export class NodeGtkResolver {
    constructor(processAdapter) { this.process = processAdapter; }

    async resolve(packages, runtime, { signal } = {}) {
        try {
            const result = await this.process.run(runtime.executable, ["--input-type=module", "-e", `
                import { readFile } from 'node:fs/promises';
                const entryUrl = import.meta.resolve('node-gtk');
                const manifestUrl = import.meta.resolve('node-gtk/package.json');
                const manifest = JSON.parse(await readFile(new URL(manifestUrl), 'utf8'));
                console.log(JSON.stringify({entryUrl, manifestUrl, version:manifest.version}));
            `], { cwd: packages, signal });
            if (result.code !== 0) { throw new Error("La resolución pública ESM falló."); }
            const resolved = JSON.parse(result.stdout);
            const root = await realpath(packages);
            const entry = await realpath(fileURLToPath(resolved.entryUrl));
            const manifest = await realpath(fileURLToPath(resolved.manifestUrl));
            if (resolved.version !== dependency.version || !inside(path.join(root, "node_modules"), entry) ||
                !inside(path.join(root, "node_modules"), manifest)) { throw new Error("La dependencia no pertenece a la instalación privada fijada."); }
            return Object.freeze({ ...resolved, packageRoot: path.dirname(manifest) });
        } catch (error) {
            checkGuiCancellation(signal);
            throw new GuiDependencyError("CLRS_GUI_DEP_RESOLUTION_FAILED", error);
        }
    }
}
