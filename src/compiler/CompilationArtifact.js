import path from "node:path";
import { createJavaScriptProjectIdentity } from "./export/JavaScriptProjectDescriptor.js";
import { requireJavaScriptExportProfile } from "./export/JavaScriptExportProfile.js";

/**
 * Resultado inmutable de generar un programa JavaScript.
 */
export class CompilationArtifact {

    constructor({
        ast,
        sourcePath,
        temporary,
        userCode,
        generatedCode,
        requiredCapabilities = [],
        runtimeNodeCommand,
        guiBindingSpecifier,
        exportProfile,
        exportProject = false,
        programKey = globalThis.ProgramKey
    }) {
        const sourceFileName =
            path.basename(sourcePath);
        const extension =
            path.extname(sourceFileName);
        const baseOutputFileName =
            extension === ""
                ? sourceFileName + ".js"
                : sourceFileName.replace(
                    extension,
                    ".js"
                );
        let outputFileName =
            temporary
                ? `${programKey}_${baseOutputFileName}`
                : baseOutputFileName;
        // ESM explícito, incluso si el workspace del alumno declara type: commonjs.
        if (temporary && requiredCapabilities.includes("gui")) {
            outputFileName = outputFileName.replace(/\.js$/u, ".mjs");
        }
        let outputDirectory;
        if (temporary) {
            outputDirectory = ".";
        } else if (exportProject) {
            const identity = createJavaScriptProjectIdentity(sourcePath);
            outputFileName = identity.entryFile;
            outputDirectory = identity.projectDirectory;
        } else {
            outputDirectory = path.join(path.dirname(sourcePath), ".clrs", "js");
        }

        this.ast = ast;
        this.sourcePath = sourcePath;
        this.sourceFileName = sourceFileName;
        this.outputFileName = outputFileName;
        this.outputDirectory = outputDirectory;
        this.outputPath = path.join(
            outputDirectory,
            outputFileName
        );
        this.temporary = temporary;
        this.userCode = userCode;
        this.generatedCode = generatedCode;
        this.requiredCapabilities = Object.freeze([...requiredCapabilities]);
        if (exportProfile !== undefined) {
            if (temporary) { throw new TypeError("Un artefacto temporal no puede declarar un perfil de exportación."); }
            this.exportProfile = requireJavaScriptExportProfile(exportProfile);
        }
        if (runtimeNodeCommand) { this.runtimeNodeCommand = runtimeNodeCommand; }
        if (guiBindingSpecifier) { this.guiBindingSpecifier = guiBindingSpecifier; }

        Object.freeze(this);
    }
}
