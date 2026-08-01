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
            ["join", "basename"]
        );
    }

    async runProgram(extensionPath) {
        const document =
            this.host.getActiveDocument();

        if (!document) {
            return this.presentFailure(
                ApplicationError
                    .noActiveDocument()
            );
        }

        await document.save();

        const interpreterPath =
            this.path.join(
                extensionPath,
                "src",
                "compiler",
                "CliEntry.js"
            );

        this.host.runCli(
            interpreterPath,
            document.filePath
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
            this.host.getWorkspaceRoot();

        if (!workspaceRoot) {
            return this.presentFailure(
                ApplicationError
                    .noActiveDocument()
            );
        }

        this.presenter.info(
            "Generando código."
        );

        const sourcePath =
            this.path.join(
                workspaceRoot,
                this.path.basename(
                    document.filePath
                )
            );
        const result =
            await this
                .generateJavaScriptUseCase
                .execute({
                    sourceCode:
                        document.getText(),
                    sourcePath
                });

        if (!result.ok) {
            this.presenter.present(result);
            return result;
        }

        this.host.showGeneratedPath(
            result.value.outputPath
        );

        return result;
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
