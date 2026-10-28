import * as fs from "node:fs/promises";
import path from "node:path";
import { createJavaScriptProjectDescriptor, validJavaScriptProjectLock,
    validPortableJavaScriptProjectManifest } from "./JavaScriptProjectDescriptor.js";
import { createPackablePreparationScript } from "./PackablePreparationScriptBuilder.js";
import { createBootstrapScript } from "./BootstrapScriptBuilder.js";
import { JavaScriptExportError, checkExportCancellation } from "./JavaScriptExportError.js";
import { JavaScriptExportProfiles } from "./JavaScriptExportProfile.js";
import { JavaScriptProjectTransaction } from "./JavaScriptProjectTransaction.js";
import { NpmPackageLockAdapter } from "./NpmPackageLockAdapter.js";

export class JavaScriptProjectExporter {
    constructor(options = {}) {
        this.fs = options.fs ?? fs;
        this.lockGenerator = options.lockGenerator ?? new NpmPackageLockAdapter(options);
        this.transaction = options.transaction ?? new JavaScriptProjectTransaction(options);
        this.createPrepareScript = options.createPrepareScript ?? createPackablePreparationScript;
        this.createBootstrapScript = options.createBootstrapScript ?? createBootstrapScript;
    }

    async export(artifact, { signal } = {}) {
        checkExportCancellation(signal);
        if (artifact.exportProfile !== JavaScriptExportProfiles.GUI
            || !artifact.requiredCapabilities?.includes("gui") || artifact.temporary || artifact.runtimeNodeCommand
            || artifact.guiBindingSpecifier !== "node-gtk") {
            throw new JavaScriptExportError("PRIVATE_PATH_LEAK");
        }
        const descriptor = createJavaScriptProjectDescriptor(artifact.sourcePath);
        const files = [descriptor.entryFile, descriptor.preparePackableFile, descriptor.bootstrapFile,
            "package.json", "package-lock.json"];
        const manifestText = JSON.stringify(descriptor.manifest, null, 2) + "\n";
        let prepareText, bootstrapText;
        return this.transaction.publish({ artifact, descriptor, files, signal,
            writeStage: async stage => {
                prepareText = this.createPrepareScript(descriptor);
                bootstrapText = this.createBootstrapScript(descriptor);
                await this.fs.writeFile(path.join(stage, descriptor.entryFile), artifact.generatedCode, { flag: "wx" });
                await this.fs.writeFile(path.join(stage, descriptor.preparePackableFile), prepareText, { flag: "wx" });
                await this.fs.writeFile(path.join(stage, descriptor.bootstrapFile), bootstrapText, { flag: "wx" });
                await this.fs.writeFile(path.join(stage, "package.json"), manifestText, { flag: "wx" });
                await this.lockGenerator.generate({ cwd: stage, signal });
            },
            validateStage: async stage => {
                const parsedManifest = JSON.parse(await this.fs.readFile(path.join(stage, "package.json"), "utf8"));
                const parsedLock = JSON.parse(await this.fs.readFile(path.join(stage, "package-lock.json"), "utf8"));
                return await this.fs.readFile(path.join(stage, "package.json"), "utf8") === manifestText
                    && await this.fs.readFile(path.join(stage, descriptor.entryFile), "utf8") === artifact.generatedCode
                    && await this.fs.readFile(path.join(stage, descriptor.preparePackableFile), "utf8") === prepareText
                    && await this.fs.readFile(path.join(stage, descriptor.bootstrapFile), "utf8") === bootstrapText
                    && validPortableJavaScriptProjectManifest(parsedManifest, descriptor)
                    && validJavaScriptProjectLock(parsedLock, descriptor.manifest);
            } });
    }
}
