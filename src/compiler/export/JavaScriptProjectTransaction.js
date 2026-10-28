import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import path from "node:path";

import { acquirePrivateRuntimeLock } from "../../infrastructure/gui/PrivateRuntimeLock.js";
import { JavaScriptExportError, checkExportCancellation } from "./JavaScriptExportError.js";

/** Publicación atómica compartida por los perfiles CLI y GUI. */
export class JavaScriptProjectTransaction {
    constructor(options = {}) {
        this.fs = options.fs ?? fs;
        this.acquireLock = options.acquireLock ?? acquirePrivateRuntimeLock;
    }

    async publish({ artifact, descriptor, files, writeStage, validateStage, signal }) {
        requireTransactionRequest({ artifact, descriptor, files, writeStage, validateStage });
        checkExportCancellation(signal);
        const parent = descriptor.exportRoot;
        const target = descriptor.projectDirectory;
        let stage, backup, release, published = false, phase = "WRITE_FAILED";
        const assertSafe = async candidate => {
            if (path.dirname(candidate) !== parent) { throw new JavaScriptExportError("INVALID_TARGET"); }
            try {
                if ((await this.fs.lstat(candidate)).isSymbolicLink()) {
                    throw new JavaScriptExportError("INVALID_TARGET");
                }
            } catch (error) {
                if (error.code !== "ENOENT") { throw error; }
            }
        };

        try {
            for (const directory of [path.dirname(parent), parent]) {
                try {
                    if ((await this.fs.lstat(directory)).isSymbolicLink()) {
                        throw new JavaScriptExportError("INVALID_TARGET");
                    }
                } catch (error) {
                    if (error.code !== "ENOENT") { throw error; }
                }
                await this.fs.mkdir(directory, { recursive: true });
            }
            await assertSafe(target);
            release = await this.acquireLock({
                lock: path.join(parent, `.${descriptor.name}.export.lock`), assertSafe
            }, { signal });
            checkExportCancellation(signal);
            stage = await this.fs.mkdtemp(path.join(parent, `.${descriptor.name}.stage-`));
            await writeStage(stage);
            checkExportCancellation(signal);

            phase = "LOCK_INVALID";
            const actual = await this.fs.readdir(stage);
            if (actual.length !== files.length || files.some(file => !actual.includes(file))) {
                throw new JavaScriptExportError("LOCK_INVALID");
            }
            for (const file of files) {
                if (!(await this.fs.lstat(path.join(stage, file))).isFile()) {
                    throw new JavaScriptExportError("LOCK_INVALID");
                }
            }
            if (await validateStage(stage) !== true) { throw new JavaScriptExportError("LOCK_INVALID"); }
            checkExportCancellation(signal);

            phase = "PUBLISH_FAILED";
            await assertSafe(target);
            try {
                const previous = await this.fs.lstat(target);
                if (!previous.isDirectory()) { throw new JavaScriptExportError("INVALID_TARGET"); }
                backup = path.join(parent, `.${descriptor.name}.backup-${randomUUID()}`);
                await this.fs.rename(target, backup);
            } catch (error) {
                if (error.code !== "ENOENT") { throw error; }
            }
            try {
                await this.fs.rename(stage, target);
                stage = null;
                published = true;
            } catch (error) {
                if (backup) {
                    await this.fs.rename(backup, target);
                    backup = null;
                }
                throw error;
            }

            return Object.freeze({ ...artifact, kind: "node-project", projectDirectory: target,
                outputDirectory: target, outputFileName: descriptor.entryFile, outputPath: descriptor.entryPath,
                files: Object.freeze(files.map(file => path.join(target, file))), backupPath: backup });
        } catch (cause) {
            if (cause instanceof JavaScriptExportError || cause?.code === "CLRS_GUI_DEP_NODE_UNSUPPORTED") {
                throw cause;
            }
            if (!published) { checkExportCancellation(signal); }
            throw new JavaScriptExportError(phase, cause);
        } finally {
            try {
                if (stage) {
                    await assertSafe(stage);
                    await this.fs.rm(stage, { recursive: true, force: true });
                }
            } finally {
                await release?.();
            }
        }
    }
}

function requireTransactionRequest({ artifact, descriptor, files, writeStage, validateStage }) {
    const validFiles = Array.isArray(files) && files.length > 0 && new Set(files).size === files.length
        && files.every(file => typeof file === "string" && file.length > 0 && path.basename(file) === file);
    if (!artifact || !descriptor || typeof descriptor.name !== "string"
        || typeof descriptor.exportRoot !== "string" || typeof descriptor.projectDirectory !== "string"
        || typeof descriptor.entryFile !== "string" || !validFiles
        || typeof writeStage !== "function" || typeof validateStage !== "function") {
        throw new TypeError("La solicitud de publicación JavaScript no es válida.");
    }
}
