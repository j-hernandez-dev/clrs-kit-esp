import {
    ApplicationError
} from "../../src/errors/ApplicationError.js";
import {
    applicationFailure,
    applicationSuccess
} from "../../src/application/ApplicationResult.js";
import {
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

export class CodeCommandController {

    constructor(options) {
        this.host = requirePort(
            options.host,
            "codeHost",
            [
                "getActiveDocument",
                "getWorkspaceRoot",
                "runCli",
                "stopExecution",
                "writeClipboard",
                "showGeneratedPath"
            ]
        );
        this.presenter = requirePort(
            options.presenter,
            "notificationPresenter",
            ["present", "info"]
        );
        this.generateJavaScriptUseCase =
            requirePort(
                options
                    .generateJavaScriptUseCase,
                "generateJavaScriptUseCase",
                ["execute"]
            );
        this.path = requirePort(
            options.path,
            "path",
            ["join"]
        );
        this.cliEntryRelativePath =
            options.cliEntryRelativePath ??
            this.path.join(
                "src",
                "compiler",
                "CliEntry.js"
            );
    }

    async runProgram(extensionPath) {
        const document =
            this.host.getActiveDocument();

        return this.runDocument(
            extensionPath,
            document
        );
    }

    async runDocument(
        extensionPath,
        document
    ) {

        if (!document) {
            return this.presentFailure(
                ApplicationError
                    .noActiveDocument()
            );
        }

        const saved = await document.save();

        if (saved === false) {
            return applicationSuccess({
                cancelled: true
            });
        }

        const interpreterPath =
            this.path.join(
                extensionPath,
                this.cliEntryRelativePath
            );

        this.host.runCli(
            interpreterPath,
            document.filePath,
            {
                documentVersion:
                    document.version
            }
        );
        this.presenter.info(
            "Ejecutando código.",
            3000
        );

        return applicationSuccess({
            interpreterPath,
            sourcePath:
                document.filePath
        });
    }

    async generateJavaScript() {
        const document =
            this.host.getActiveDocument();

        if (!document) {
            return this.presentFailure(
                ApplicationError
                    .noActiveDocument()
            );
        }

        const workspaceRoot =
            this.host.getWorkspaceRoot(
                document.filePath
            );

        if (!workspaceRoot) {
            return this.presentFailure(
                ApplicationError
                    .noActiveDocument()
            );
        }

        this.presenter.info(
            "Generando código."
        );

        // Preserva la carpeta del documento para evitar colisiones entre
        // archivos homónimos de subcarpetas o workspaces múltiples.
        const sourcePath = document.filePath;
        const sourceCode = document.getText();
        const generate = signal => this.generateJavaScriptUseCase.execute({ sourceCode, sourcePath,
            ...(signal ? { signal } : {}) });
        const result = this.host.withExportProgress
            ? await this.host.withExportProgress(generate) : await generate();

        if (!result.ok) {
            this.presenter.present(result);
            return result;
        }

        // El host conserva el artefacto y presenta requisitos específicos
        // cuando identifica un proyecto persistente CLI o GUI.
        this.host.showGeneratedPath(
            result.value.outputPath,
            result.value
        );

        return result;
    }

    stopProgram() {
        const stopped =
            this.host.stopExecution();

        this.presenter.info(
            stopped
                ? "Ejecución de código CLRS detenida."
                : "No hay ninguna ejecución de código CLRS activa.",
            3000
        );

        return applicationSuccess({
            stopped
        });
    }

    async copyCostExpression(text) {
        await this.host.writeClipboard(text);
        this.presenter.info(
            "Expresión copiada al portapapeles",
            3000
        );

        return applicationSuccess({
            text
        });
    }

    toggleCost(
        viewState,
        codeLensProvider,
        updateDecorations
    ) {
        viewState.showCost =
            !viewState.showCost;

        this.presenter.info(
            viewState.showCost
                ? "Mostrando costo algorítmico."
                : "Ocultando costo algorítmico.",
            3000
        );
        codeLensProvider.refresh();
        updateDecorations();

        return applicationSuccess({
            showCost: viewState.showCost
        });
    }

    presentFailure(error) {
        const result =
            applicationFailure(error);

        this.presenter.present(result);

        return result;
    }
}
