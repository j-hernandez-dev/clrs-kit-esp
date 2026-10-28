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
import { getGuiRuntimeFactorySource } from "../../standard-library/gui/runtime/GuiRuntimeSource.js";
import { JavaScriptExportProfiles, classifyJavaScriptExportProfile } from "../export/JavaScriptExportProfile.js";
import { JavaScriptProjectExportRouter } from "../export/JavaScriptProjectExportRouter.js";
import { checkExportCancellation } from "../export/JavaScriptExportError.js";

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
        this.runtimePreparation = options.runtimePreparation ?? null;
        this.runtimeSignal = options.runtimeSignal;
        this.projectExporter = options.projectExporter ?? new JavaScriptProjectExportRouter();
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
            generatedCode,
            requiredCapabilities
        } = generator.generate(ast, {
            semanticModel:
                options.semanticModel,
            runtimeContext: options.runtimeContext
        });

        return new CompilationArtifact({
            ast,
            sourcePath,
            temporary:
                options.temporary ?? false,
            userCode,
            generatedCode,
            requiredCapabilities,
            exportProfile: options.exportProfile,
            exportProject: options.exportProject === true,
            guiBindingSpecifier: options.runtimeContext?.gui?.moduleUrl,
            runtimeNodeCommand: options.runtimeContext?.gui?.nodeExecutable
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
        const semanticModel =
            this.analyzeSemantics(ast);

        let runtimeContext = options.runtimeContext;
        // Sólo «Generar código JavaScript» solicita un proyecto npm. Las demás
        // superficies de compilación conservan su contrato de artefacto único.
        const exportProfile = options.exportProject === true && !options.temporary
            ? classifyJavaScriptExportProfile(semanticModel) : undefined;
        const exportGui = exportProfile === JavaScriptExportProfiles.GUI;
        if (exportGui) {
            // Exportar nunca aprovisiona ni arrastra la instalación privada del editor.
            runtimeContext = { gui: { moduleUrl: "node-gtk", factorySource: getGuiRuntimeFactorySource() } };
        }
        if (options.prepareRuntime && semanticModel.gui?.usage.requiresGui && !runtimeContext?.gui && this.runtimePreparation) {
            runtimeContext = await this.runtimePreparation.prepare({ semanticModel, signal: options.signal });
        }
        if (options.signal?.aborted) {
            if (exportGui) { checkExportCancellation(options.signal); }
            throw new LanguageError("La ejecución fue cancelada.", "RuntimeExecutionError", null, {
                phase: "runtime", code: semanticModel.gui?.usage.requiresGui ? "CLRS_GUI_DEP_CANCELLED" : "CLRS_RUNTIME_CANCELLED"
            });
        }

        const artifact = this.createArtifact(
            ast,
            sourcePath,
            {
                ...options,
                semanticModel,
                runtimeContext,
                exportProfile
            }
        );

        if (exportProfile) { return this.projectExporter.export(artifact, { signal: options.signal }); }
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

    async runSource(sourceCode, sourcePath, options = {}) {
        const signal = options.signal ?? this.runtimeSignal;
        const artifact = await this.compileSource(
            sourceCode,
            sourcePath,
            { ...options, signal, temporary: true, prepareRuntime: true }
        );
        const execution =
            await this.runArtifact(artifact, { signal });

        return {
            artifact,
            execution
        };
    }

    async runArtifact(artifact, { signal } = {}) {
        return this.programRunner.run({
            ...(signal ? { signal } : {}),
            ...(artifact.runtimeNodeCommand ? { command: artifact.runtimeNodeCommand, gui: true } : {}),
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

        return this.analyzeCostAST(ast);
    }

    /**
     * Calcula el costo de un AST que ya superó el frontend y la semántica.
     * Permite que consumidores interactivos reutilicen un snapshot previo.
     */
    analyzeCostAST(ast) {
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
        sourcePath,
        options = {}
    ) {
        return this.tryOperation(
            () => this.runSource(
                sourceCode,
                sourcePath,
                options
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
