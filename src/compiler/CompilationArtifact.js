import path from "node:path";

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
        const outputFileName =
            temporary
                ? `${programKey}_${baseOutputFileName}`
                : baseOutputFileName;
        const outputDirectory =
            temporary
                ? "."
                : path.join(
                    path.dirname(sourcePath),
                    ".clrs",
                    "js"
                );

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

        Object.freeze(this);
    }
}
