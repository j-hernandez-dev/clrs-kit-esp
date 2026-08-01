import {
    appendFile,
    mkdir,
    unlink,
    writeFile
} from "node:fs/promises";
import path from "node:path";

import {
    CompilationIOError
} from "../../errors/CompilationIOError.js";

/**
 * Adaptador de persistencia para artefactos de compilación.
 */
export class FileSystemEmitter {

    constructor(options = {}) {
        this.mkdir = options.mkdir ?? mkdir;
        this.writeFile =
            options.writeFile ?? writeFile;
        this.appendFile =
            options.appendFile ?? appendFile;
        this.unlink = options.unlink ?? unlink;
    }

    async writeArtifact(artifact) {
        await this.write(
            artifact.generatedCode,
            artifact.outputPath
        );

        return artifact;
    }

    async write(content, outputPath) {
        try {
            await this.ensureDirectory(outputPath);
            await this.writeFile(
                outputPath,
                content,
                "utf8"
            );

            return outputPath;
        } catch (error) {
            throw CompilationIOError.from(
                error,
                "write",
                outputPath
            );
        }
    }

    async append(content, outputPath) {
        try {
            await this.ensureDirectory(outputPath);
            await this.appendFile(
                outputPath,
                String(content),
                "utf8"
            );

            return outputPath;
        } catch (error) {
            throw CompilationIOError.from(
                error,
                "append",
                outputPath
            );
        }
    }

    async remove(
        outputPath,
        options = {}
    ) {
        const ignoreMissing =
            options.ignoreMissing ?? true;

        try {
            await this.unlink(outputPath);

            return true;
        } catch (error) {
            if (
                ignoreMissing &&
                error?.code === "ENOENT"
            ) {
                return false;
            }

            throw CompilationIOError.from(
                error,
                "delete",
                outputPath
            );
        }
    }

    async ensureDirectory(outputPath) {
        await this.mkdir(
            path.dirname(outputPath),
            { recursive: true }
        );
    }
}
