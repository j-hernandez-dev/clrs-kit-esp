// Ensayo opt-in: resuelve un lock portable real sin instalar paquetes ni ejecutar scripts.
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPortableJavaScriptProjectDescriptor,
    validJavaScriptProjectLock } from "../../src/compiler/export/JavaScriptProjectDescriptor.js";
import { NpmPackageLockAdapter } from "../../src/compiler/export/NpmPackageLockAdapter.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "clrs portable lock real ñ-"));
const report = { ok: false, npm: process.env.npm_config_user_agent ?? null, node: process.versions.node, platform: process.platform,
    checks: [], notValidated: ["npm ci", "scripts nativos", "build con pkg", "carga GTK"] };
try {
    const descriptor = createPortableJavaScriptProjectDescriptor(path.join(root, "Programa Portable.clrs"));
    const manifestText = JSON.stringify(descriptor.manifest, null, 2) + "\n";
    await fs.writeFile(path.join(root, "package.json"), manifestText, "utf8");
    const adapter = new NpmPackageLockAdapter({ nodeCommand: process.execPath });
    await adapter.generate({ cwd: root });
    const lock = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"));
    assert.equal(validJavaScriptProjectLock(lock, descriptor.manifest), true);
    assert.equal(await fs.readFile(path.join(root, "package.json"), "utf8"), manifestText);
    assert.equal(lock.packages["node_modules/node-gtk"].version, "4.1.1");
    assert.match(lock.packages["node_modules/@yao-pkg/pkg"].version, /^6\./u);
    report.resolved = { nodeGtk: lock.packages["node_modules/node-gtk"].version,
        pkg: lock.packages["node_modules/@yao-pkg/pkg"].version, lockfileVersion: lock.lockfileVersion };
    await assert.rejects(fs.access(path.join(root, "node_modules")), error => error.code === "ENOENT");
    await assert.rejects(fs.access(path.join(root, descriptor.packableFile)), error => error.code === "ENOENT");
    await assert.rejects(fs.access(path.join(root, "dist")), error => error.code === "ENOENT");
    report.checks.push("manifest-portable-before-lock", "manifest-unchanged", "node-gtk-4.1.1", "yao-pkg-resolved",
        "no-node-modules", "no-install-scripts", "no-build-artifacts");
    report.ok = true;
} catch (error) {
    report.failure = { code: error.code, message: error.publicMessage ?? error.message };
    process.exitCode = 1;
} finally {
    await fs.rm(root, { recursive: true, force: true });
    report.cleaned = true;
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
