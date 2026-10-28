import * as fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { GuiDependencyError } from "./GuiDependencyError.js";

export function inside(parent, target) {
    const relative = path.relative(parent, target);
    return relative !== "" && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

export class PrivateRuntimeLayout {
    constructor(extensionRoot) { this.extensionRoot = extensionRoot; }

    async prepare() {
        try {
            this.extensionRoot = await fs.realpath(this.extensionRoot);
            this.root = path.join(this.extensionRoot, ".runtime");
            this.packages = path.join(this.root, "packages");
            this.cache = path.join(this.root, "npm-cache");
            this.staging = path.join(this.root, "staging");
            this.locks = path.join(this.root, "locks");
            this.lock = path.join(this.locks, "node-gtk-4.1.1.lock");
            for (const directory of [this.root, this.cache, this.staging, this.locks]) {
                await this.assertSafe(directory);
                await fs.mkdir(directory, { recursive: true });
                await this.assertSafe(directory);
            }
            const probe = path.join(this.root, "write-" + randomUUID());
            const handle = await fs.open(probe, "wx");
            await handle.close(); await fs.unlink(probe);
        } catch (error) { throw new GuiDependencyError("CLRS_GUI_DEP_RUNTIME_NOT_WRITABLE", error); }
    }

    async assertSafe(target) {
        if (target !== this.root && !inside(this.root, path.resolve(target))) { throw new Error("Ruta fuera del runtime privado."); }
        const relative = path.relative(this.extensionRoot, target);
        let current = this.extensionRoot;
        for (const segment of relative.split(path.sep)) {
            current = path.join(current, segment);
            try {
                if ((await fs.lstat(current)).isSymbolicLink()) { throw new Error("Enlace simbólico en una ruta administrada."); }
            } catch (error) { if (error.code !== "ENOENT") { throw error; } }
        }
    }

    async createStage() {
        await this.assertSafe(this.staging);
        return fs.mkdtemp(path.join(this.staging, "packages-"));
    }

    async removeStage(target) {
        await this.assertSafe(target);
        if (path.dirname(target) !== this.staging || !/^(packages-|previous-)/u.test(path.basename(target))) {
            throw new Error("Sólo se pueden retirar artefactos transaccionales privados.");
        }
        await fs.rm(target, { recursive: true, force: true });
    }

    async publish(stage, validate) {
        await this.assertSafe(stage); await this.assertSafe(this.packages);
        const backup = path.join(this.staging, "previous-" + randomUUID());
        let backedUp = false, published = false;
        try {
            try { await fs.rename(this.packages, backup); backedUp = true; }
            catch (error) { if (error.code !== "ENOENT") { throw error; } }
            await fs.rename(stage, this.packages); published = true;
            const result = await validate(this.packages);
            if (backedUp) {
                // En Windows un proceso anterior puede conservar DLLs abiertas.
                await this.removeStage(backup).catch(() => {});
            }
            return result;
        } catch (error) {
            if (published) { await fs.rename(this.packages, stage); }
            if (backedUp) { await fs.rename(backup, this.packages); }
            throw error;
        }
    }
}
