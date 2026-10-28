import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

if (!process.argv[2]) { throw new Error("Indica una carpeta aislada con node-gtk ya instalado."); }
const resolution = spawnSync(process.execPath, ["--input-type=module", "-e", "console.log(import.meta.resolve('node-gtk'))"],
    { cwd: resolve(process.argv[2]), encoding: "utf8", windowsHide: true, timeout: 10000 });
if (resolution.error || resolution.status !== 0) { throw new Error("No se pudo resolver node-gtk."); }
const result = spawnSync(process.execPath, [fileURLToPath(new URL("./native-events-validation.mjs", import.meta.url)),
    resolution.stdout.trim()], { encoding: "utf8", windowsHide: true, timeout: 30000 });
process.stdout.write(result.stdout ?? ""); process.stderr.write(result.stderr ?? "");
if (result.error) { console.error(result.error); }
process.exitCode = result.status === 0 && !result.error ? 0 : 1;
