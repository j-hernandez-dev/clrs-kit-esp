import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { NodeGtkDependencyManager } from "../../src/infrastructure/gui/NodeGtkDependencyManager.js";

// Opt-in: descarga oficial por npm en una raíz temporal, nunca en el workspace.
const root = await fs.mkdtemp(path.join(os.tmpdir(), "clrs-gui-private-validation-"));
if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("clrs-gui-private-validation-")) {
    throw new Error("Directorio de ensayo inesperado.");
}
const extensionRoot = path.join(root, "José Pérez # extensión");
await fs.mkdir(extensionRoot);
const states = [];
const manager = new NodeGtkDependencyManager({ extensionRoot, nodeCommand: process.execPath,
    onState: state => { states.push(state); console.error("[GUI privada] " + state); } });
try {
    const first = await manager.ensure();
    const second = await manager.ensure();
    assert.equal(states.filter(state => state === "INSTALLING").length, 1);
    assert.equal(first.entryUrl, second.entryUrl);
    assert.ok(!first.entryUrl.includes("/staging/"));
    assert.deepEqual(await fs.readdir(path.join(extensionRoot, ".runtime/locks")), []);
    assert.deepEqual(await fs.readdir(path.join(extensionRoot, ".runtime/staging")), []);
    console.log(JSON.stringify({ ok: true, binding: first.version, gtk: first.gtkVersion,
        node: first.nodeVersion, abi: first.nodeAbi, platform: process.platform, arch: process.arch,
        checks: ["private-npm-install", "prebuilt-only", "public-esm-resolution", "nonvisual-child-probe",
            "transactional-publish", "reuse-without-install", "spaces-unicode-hash-path", "lock-and-staging-cleanup"] }));
} finally { await fs.rm(root, { recursive: true, force: true }); }
