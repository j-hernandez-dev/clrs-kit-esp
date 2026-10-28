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

export class DebugCommandController {

    constructor(options) {
        this.host = requirePort(
            options.host,
            "debugHost",
            [
                "getActiveDocument",
                "getWorkspaceFolder",
                "startDebugging"
            ]
        );
        this.presenter = requirePort(
            options.presenter,
            "notificationPresenter",
            ["present", "info"]
        );
        this.debugType = options.debugType;
        this.debugName = options.debugName;
    }

    async startDebugging() {
        const document =
            this.host.getActiveDocument();

        if (!document) {
            return this.presentFailure(
                ApplicationError.invalidRequest(
                    "Abre un archivo CLRS antes de iniciar la depuración."
                )
            );
        }

        const saved = await document.save();

        if (saved === false) {
            return applicationSuccess({
                cancelled: true
            });
        }

        const configuration = {
            type: this.debugType,
            request: "launch",
            name: this.debugName,
            program: document.filePath,
            stopOnEntry: true,
            __clrsDocumentVersion:
                document.version
        };
        const started =
            await this.host.startDebugging(
                this.host.getWorkspaceFolder(
                    document
                ),
                configuration
            );

        if (!started) {
            return this.presentFailure(
                ApplicationError.invalidRequest(
                    "VS Code no pudo iniciar la sesión de depuración CLRS."
                )
            );
        }

        this.presenter.info(
            "Sesión de depuración CLRS iniciada."
        );

        return applicationSuccess({
            started,
            configuration
        });
    }

    presentFailure(error) {
        const result =
            applicationFailure(error);

        this.presenter.present(result);

        return result;
    }
}
