import {
    LanguageError
} from "../../errors/LanguageError.js";
import {
    TranspilerError
} from "../../errors/TranspilerError.js";
import {
    parseSource
} from "../../language/LanguageFrontend.js";
import {
    CostAnalysisVisitor
} from "../../complex/CostAnalysisVisitor.js";
import {
    CompilationArtifact
} from "../CompilationArtifact.js";
import {
    JavaScriptGenerator
} from "../JavaScriptGenerator.js";
import {
    FileSystemEmitter
} from "../adapters/FileSystemEmitter.js";
import {
    NodeProgramRunner
} from "../adapters/NodeProgramRunner.js";
import {
    SemanticAnalyzer
} from "../../semantic/SemanticAnalyzer.js";

/**
 * Coordina frontend, generación, persistencia, ejecución y costo.
 */
export class CompilationService {

    constructor(options = {}) {
        this.generator =
            options.generator ??
            new JavaScriptGenerator();
        this.fileEmitter =
            options.fileEmitter ??
            new FileSystemEmitter();
        this.programRunner =
            options.programRunner ??
            new NodeProgramRunner({
                fileEmitter: this.fileEmitter
            });
        this.costAnalyzerFactory =
            options.costAnalyzerFactory ??
            (() => new CostAnalysisVisitor());
        this.semanticAnalyzer =
            options.semanticAnalyzer ??
            new SemanticAnalyzer();
    }

    /**
     * Construye un artefacto sin escribir en el sistema de archivos.
     */
    createArtifact(
        ast,
        sourcePath,
        options = {}
    ) {
        const generator =
            options.generator ??
            this.generator;
        const {
            userCode,
            generatedCode
        } = generator.generate(ast);

        return new CompilationArtifact({
            ast,
            sourcePath,
            temporary:
                options.temporary ?? false,
            userCode,
            generatedCode
        });
    }

    /**
     * Genera y persiste un AST.
     */
    async compileAST(
        ast,
        sourcePath,
        options = {}
    ) {
        this.analyzeSemantics(ast);

        const artifact = this.createArtifact(
            ast,
            sourcePath,
            options
        );

        await this.writeArtifact(artifact);

        return artifact;
    }

    /**
     * Ejecuta frontend, generación y persistencia.
     */
    async compileSource(
        sourceCode,
        sourcePath,
        options = {}
    ) {
        const { ast } = parseSource(sourceCode);

        return this.compileAST(
            ast,
            sourcePath,
            options
        );
    }

    async writeArtifact(artifact) {
        return this.fileEmitter
            .writeArtifact(artifact);
    }

    async runSource(sourceCode, sourcePath) {
        const artifact = await this.compileSource(
            sourceCode,
            sourcePath,
            { temporary: true }
        );
        const execution =
            await this.runArtifact(artifact);

        return {
            artifact,
            execution
        };
    }

    async runArtifact(artifact) {
        return this.programRunner.run({
            displayName:
                artifact.sourceFileName,
            programPath:
                artifact.outputPath,
            cleanupPath:
                artifact.temporary
                    ? artifact.outputPath
                    : null
        });
    }

    analyzeAST(ast) {
        this.analyzeSemantics(ast);

        return this.costAnalyzerFactory()
            .costAnalysis(ast);
    }

    analyzeSemantics(ast) {
        return this.semanticAnalyzer
            .analyze(ast);
    }

    analyzeSource(sourceCode) {
        const { ast } = parseSource(sourceCode);

        return this.analyzeAST(ast);
    }

    async tryCompileSource(
        sourceCode,
        sourcePath,
        options = {}
    ) {
        return this.tryOperation(
            () => this.compileSource(
                sourceCode,
                sourcePath,
                options
            )
        );
    }

    async tryRunSource(
        sourceCode,
        sourcePath
    ) {
        return this.tryOperation(
            () => this.runSource(
                sourceCode,
                sourcePath
            )
        );
    }

    async tryOperation(operation) {
        try {
            return {
                ok: true,
                value: await operation(),
                errors: []
            };
        } catch (error) {
            return {
                ok: false,
                value: null,
                errors: [
                    normalizeCompilationError(
                        error
                    )
                ]
            };
        }
    }
}

function normalizeCompilationError(error) {
    if (error instanceof LanguageError) {
        return error;
    }

    return new TranspilerError(
        error instanceof Error
            ? error.message
            : "Unknown compilation error.",
        null,
        { cause: error }
    );
}
