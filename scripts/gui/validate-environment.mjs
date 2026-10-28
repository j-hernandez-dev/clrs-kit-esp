import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { NodeGtkProbe } from "../../src/infrastructure/gui/NodeGtkProbe.js";
import { GuiProcessAdapter } from "../../src/infrastructure/gui/GuiProcessAdapter.js";

// Read-only native integration. Never install npm or operating-system packages here.
if (!process.argv[2]) { throw new Error("Indica la carpeta aislada con node-gtk instalado."); }
const resolver = createRequire(join(resolve(process.argv[2]), "package.json"));
const entryUrl = pathToFileURL(resolver.resolve("node-gtk")).href;
const probe = new NodeGtkProbe(new GuiProcessAdapter());
for (const capabilities of [["gui"]]) {
    try {
        const gtkVersion = await probe.check({ entryUrl }, { executable: process.execPath, platform: process.platform }, { capabilities });
        console.log(JSON.stringify({ capabilities, ok: true, gtkVersion }));
    } catch (error) {
        console.log(JSON.stringify({ capabilities, ok: false, code: error.code, message: error.message, detail: error.cause?.message }));
    }
}
