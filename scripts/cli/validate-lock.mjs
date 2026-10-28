import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { validCliJavaScriptProjectLock } from "../../src/compiler/export/CliJavaScriptProjectValidator.js";
import { createCliJavaScriptProjectDescriptor } from "../../src/compiler/export/JavaScriptProjectDescriptor.js";
import { NpmPackageLockAdapter } from "../../src/compiler/export/NpmPackageLockAdapter.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "clrs-cli-lock-native-"));
try {
    const descriptor = createCliJavaScriptProjectDescriptor(path.join(root, "Validación CLI.clrs"));
    const manifestText = JSON.stringify(descriptor.manifest, null, 2) + "\n";
    await fs.writeFile(path.join(root, "package.json"), manifestText, "utf8");
    await new NpmPackageLockAdapter().generate({ cwd: root });

    const lock = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"));
    if (!validCliJavaScriptProjectLock(lock, descriptor.manifest)) {
        throw new Error("El package-lock.json real de npm no cumple el contrato CLI.");
    }
    await assertAbsent(path.join(root, "node_modules"));
    const files = (await fs.readdir(root)).sort();
    if (JSON.stringify(files) !== JSON.stringify(["package-lock.json", "package.json"])) {
        throw new Error(`npm dejó artefactos inesperados: ${files.join(", ")}`);
    }
    process.stdout.write(JSON.stringify({ evidence: "real-npm-v3-lock-without-install",
        lockfileVersion: lock.lockfileVersion, packages: Object.keys(lock.packages).length }) + "\n");
} finally {
    await fs.rm(root, { recursive: true, force: true });
}

async function assertAbsent(target) {
    try {
        await fs.access(target);
        throw new Error(`No debe existir ${target}`);
    } catch (error) {
        if (error.code !== "ENOENT") { throw error; }
    }
}
