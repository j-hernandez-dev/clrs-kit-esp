import {
    CompilationArtifact
} from "./CompilationArtifact.js";
import {
    FileSystemEmitter
} from "./adapters/FileSystemEmitter.js";
import {
    JavaScriptGenerator
} from "./JavaScriptGenerator.js";

/**
 * Fachada histórica que añade rutas y persistencia al generador puro.
 */
export class Transpiler extends JavaScriptGenerator {

    /**
     * @param {string} absolutePath
     * @param {boolean} run
     * @param {{fileEmitter?: FileSystemEmitter}} [options]
     */
    constructor(
        absolutePath,
        run,
        options = {}
    ) {
        super(options);

        this.sourcePath = absolutePath;
        this.runProgram = run;
        this.fileEmitter =
            options.fileEmitter ??
            new FileSystemEmitter();
        this.lastArtifact = null;

        const paths = new CompilationArtifact({
            ast: null,
            sourcePath: absolutePath,
            temporary: run,
            userCode: "",
            generatedCode: ""
        });

        this.CLRSFile = paths.sourceFileName;
        this.JSFile = paths.outputFileName;
        this.JSDir = paths.outputDirectory;
    }

    /**
     * API histórica conservada.
     *
     * @param {number} milliseconds
     */
    freezeThread(milliseconds) {
        const start = Date.now();

        while (Date.now() - start < milliseconds) {
            // Espera activa conservada por compatibilidad.
        }
    }

    /**
     * Ensambla y escribe el programa JavaScript.
     *
     * @param {import("../ast/core/ASTTypes.js").ProgramNode} ast
     * @returns {Promise<CompilationArtifact>}
     */
    async transpile(ast) {
        const artifact = this.createArtifact(ast);

        await this.fileEmitter
            .writeArtifact(artifact);

        this.lastArtifact = artifact;

        return artifact;
    }

    /**
     * @param {import("../ast/core/ASTTypes.js").ProgramNode} ast
     * @returns {CompilationArtifact}
     */
    createArtifact(ast) {
        const {
            userCode,
            generatedCode
        } = this.generate(ast);

        return new CompilationArtifact({
            ast,
            sourcePath: this.sourcePath,
            temporary: this.runProgram,
            userCode,
            generatedCode
        });
    }
}
