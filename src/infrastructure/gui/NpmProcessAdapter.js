import path from "node:path";
import { findNpmCli, NodeRuntimeInspector } from "./NodeRuntimeInspector.js";
import { requireProcessSuccess } from "./GuiProcessAdapter.js";
import { inside } from "./PrivateRuntimeLayout.js";
import { GuiDependencyError, checkGuiCancellation } from "./GuiDependencyError.js";

export class NpmProcessAdapter {
    constructor(processAdapter, options = {}) {
        this.process = processAdapter;
        this.inspector = options.inspector ?? new NodeRuntimeInspector(this.process, options.nodeCommand);
        this.findCli = options.findCli ?? findNpmCli;
        this.timeoutMs = options.timeoutMs ?? 300_000;
    }

    async install({ packages, cache, runtime, locked, signal }) {
        const npm = await this.findCli(runtime, this.process.environment);
        checkGuiCancellation(signal);
        try {
            requireProcessSuccess(await this.process.run(runtime.executable, [npm, locked ? "ci" : "install",
                "--ignore-scripts", "--no-audit", "--no-fund", "--cache", cache],
            { cwd: packages, signal, timeoutMs: this.timeoutMs }), "CLRS_GUI_DEP_INSTALL_FAILED");

            // El install publicado de node-gtk habilita fallback-to-build. No lo ejecutamos.
            // Localizamos el bin público del instalador oficial y exigimos un precompilado.
            const result = requireProcessSuccess(await this.process.run(runtime.executable, ["--input-type=module", "-e", `
                import {createRequire} from 'node:module';
                import {readFile} from 'node:fs/promises';
                import {fileURLToPath} from 'node:url';
                import path from 'node:path';
                const manifestUrl=import.meta.resolve('node-gtk/package.json');
                const resolver=createRequire(manifestUrl);
                const helperManifest=resolver.resolve('@mapbox/node-pre-gyp/package.json');
                const helper=JSON.parse(await readFile(helperManifest,'utf8'));
                const bin=typeof helper.bin==='string'?helper.bin:helper.bin['node-pre-gyp'];
                console.log(JSON.stringify({root:path.dirname(fileURLToPath(manifestUrl)),bin:path.resolve(path.dirname(helperManifest),bin)}));
            `], { cwd: packages, signal }), "CLRS_GUI_DEP_INSTALL_FAILED");
            const helper = JSON.parse(result.stdout);
            if (!inside(path.join(packages, "node_modules"), helper.root) || !inside(path.join(packages, "node_modules"), helper.bin)) {
                throw new Error("Instalador fuera de la carpeta privada.");
            }
            requireProcessSuccess(await this.process.run(runtime.executable, [helper.bin, "install",
                "--fallback-to-build=false", "--build-from-source=false", "--runtime=node",
                `--target=${runtime.version}`, `--target_arch=${runtime.arch}`],
            { cwd: helper.root, signal, timeoutMs: this.timeoutMs }), "CLRS_GUI_DEP_INSTALL_FAILED");
        } catch (error) {
            checkGuiCancellation(signal);
            if (error instanceof GuiDependencyError) { throw error; }
            throw new GuiDependencyError("CLRS_GUI_DEP_INSTALL_FAILED", error);
        }
    }
}
