import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// El paquete ya debe estar instalado en una carpeta aislada. Este script no instala nada.
const packageRoot = process.argv[2];
if (!packageRoot) { throw new Error("Indica la carpeta aislada que contiene package.json y node-gtk."); }
const resolution = spawnSync(process.execPath, ["--input-type=module", "-e",
    "console.log(import.meta.resolve('node-gtk'))"], {
    cwd: resolve(packageRoot), encoding: "utf8", windowsHide: true, timeout: 10000
});
if (resolution.error || resolution.status !== 0) {
    throw new Error("No se pudo resolver la entrada ESM pública de node-gtk.", { cause: resolution.error });
}
const native = spawnSync(process.execPath, [fileURLToPath(new URL("./native-validation.mjs", import.meta.url)),
    resolution.stdout.trim()], { encoding: "utf8", windowsHide: true, timeout: 20000 });
process.stdout.write(native.stdout ?? "");
process.stderr.write(native.stderr ?? "");
if (native.error) { console.error(native.error.message); }
process.exitCode = native.status === 0 && !native.error ? 0 : 1;
if (process.exitCode === 0) {
    const generated = spawnSync(process.execPath, [fileURLToPath(new URL("./native-generated-validation.mjs", import.meta.url)),
        resolution.stdout.trim()], { encoding: "utf8", windowsHide: true, timeout: 15000 });
    process.stdout.write(generated.stdout ?? "");
    process.stderr.write(generated.stderr ?? "");
    if (generated.error) { console.error(generated.error.message); }
    process.exitCode = generated.status === 0 && !generated.error ? 0 : 1;
}
