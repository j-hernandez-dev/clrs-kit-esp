import * as fs from "node:fs/promises";
import path from "node:path";

import { createCliJavaScriptProjectDescriptor } from "./JavaScriptProjectDescriptor.js";
import { validCliJavaScriptProjectSnapshot } from "./CliJavaScriptProjectValidator.js";
import { JavaScriptExportError, checkExportCancellation } from "./JavaScriptExportError.js";
import { JavaScriptExportProfiles } from "./JavaScriptExportProfile.js";
import { JavaScriptProjectTransaction } from "./JavaScriptProjectTransaction.js";
import { NpmPackageLockAdapter } from "./NpmPackageLockAdapter.js";

/** Exporta un CLI como proyecto Node mínimo, reproducible y transaccional. */
export class CliJavaScriptProjectExporter {
    constructor(options = {}) {
        this.fs = options.fs ?? fs;
        this.lockGenerator = options.lockGenerator ?? new NpmPackageLockAdapter(options);
        this.transaction = options.transaction ?? new JavaScriptProjectTransaction(options);
    }

    async export(artifact, { signal } = {}) {
        checkExportCancellation(signal);
        if (artifact.exportProfile !== JavaScriptExportProfiles.CLI
            || artifact.requiredCapabilities?.includes("gui") || artifact.temporary
            || artifact.runtimeNodeCommand || artifact.guiBindingSpecifier) {
            throw new JavaScriptExportError("PRIVATE_PATH_LEAK");
        }
        const descriptor = createCliJavaScriptProjectDescriptor(artifact.sourcePath);
        const files = [descriptor.entryFile, "package.json", "package-lock.json"];
        const manifestText = JSON.stringify(descriptor.manifest, null, 2) + "\n";

        return this.transaction.publish({ artifact, descriptor, files, signal,
            writeStage: async stage => {
                await this.fs.writeFile(path.join(stage, descriptor.entryFile), artifact.generatedCode, { flag: "wx" });
                await this.fs.writeFile(path.join(stage, "package.json"), manifestText, { flag: "wx" });
                await this.lockGenerator.generate({ cwd: stage, signal });
            },
            validateStage: async stage => {
                const entryText = await this.fs.readFile(path.join(stage, descriptor.entryFile), "utf8");
                const storedManifest = await this.fs.readFile(path.join(stage, "package.json"), "utf8");
                const lockText = await this.fs.readFile(path.join(stage, "package-lock.json"), "utf8");
                return validCliJavaScriptProjectSnapshot({ descriptor, generatedCode: artifact.generatedCode,
                    entryText, manifestText: storedManifest, lockText });
            } });
    }
}
