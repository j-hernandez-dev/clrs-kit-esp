import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** Parte del archivo CLI instalado, nunca de cwd ni del programa del usuario. */
export function resolveCliExtensionRoot(entryUrl) {
    let directory = path.dirname(fileURLToPath(entryUrl));
    while (true) {
        try {
            const manifest = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"));
            if (manifest.name === "clrs-kit-esp" && manifest.publisher === "j-hernandez-dev") { return directory; }
        } catch { /* El entry puede ser fuente o bundle. */ }
        const parent = path.dirname(directory);
        if (parent === directory) { throw new Error("No se encontró la raíz instalada de CLRS."); }
        directory = parent;
    }
}
