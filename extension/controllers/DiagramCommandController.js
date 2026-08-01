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

export class DiagramCommandController {

    constructor(options) {
        this.host = requirePort(
            options.host,
            "diagramHost",
            [
                "getActiveDocument",
                "createPanel",
                "schedule",
                "onDocumentChange",
                "onSelectionChange",
                "saveSvg"
            ]
        );
        this.presenter = requirePort(
            options.presenter,
            "notificationPresenter",
            ["present", "info"]
        );
        this.initialSourceDelay =
            options.initialSourceDelay;

        if (
            !Number.isFinite(
                this.initialSourceDelay
            ) ||
            this.initialSourceDelay < 0
        ) {
            throw ApplicationError
                .configuration(
                    "initialSourceDelay",
                    "un número mayor o igual que cero"
                );
        }

        this.panel = null;
        this.panelResources = [];
    }

    async toggleDiagram(context) {
        const document =
            this.host.getActiveDocument();

        if (!document) {
            return this.presentFailure(
                ApplicationError
                    .noActiveDocument()
            );
        }

        this.disposePanel();

        const panel =
            this.host.createPanel(
                context,
                document
            );

        this.panel = panel;

        this.panelResources.push(
            panel.onMessage(
                message =>
                    this.handlePanelMessage(
                        message
                    )
            ),
            this.host.schedule(
                () =>
                    this.postSource(
                        panel,
                        document
                    ),
                this.initialSourceDelay
            ),
            this.host.onDocumentChange(
                document,
                () =>
                    this.postSource(
                        panel,
                        document
                    )
            ),
            this.host.onSelectionChange(
                document,
                () =>
                    this.postSource(
                        panel,
                        document
                    )
            )
        );

        this.panelResources.push(
            panel.onDispose(() => {
                this.disposePanelResources();

                if (this.panel === panel) {
                    this.panel = null;
                }
            })
        );

        return applicationSuccess({
            panel,
            document
        });
    }

    async exportSvg() {
        if (!this.panel) {
            return this.presentFailure(
                ApplicationError
                    .invalidRequest(
                        "No hay ningún diagrama abierto."
                    )
            );
        }

        await this.panel.postMessage({
            type: "export-svg"
        });

        return applicationSuccess({
            requested: true
        });
    }

    async handlePanelMessage(message) {
        if (message?.type !== "svg") {
            return applicationSuccess({
                ignored: true
            });
        }

        try {
            const saved =
                await this.host
                    .saveSvg(message.svg);

            if (saved) {
                this.presenter.info(
                    "Diagrama exportado correctamente."
                );
            }

            return applicationSuccess({
                saved
            });
        } catch (error) {
            return this.presentFailure(
                error,
                "Error al exportar"
            );
        }
    }

    postSource(panel, document) {
        return panel.postMessage({
            type: "source",
            source:
                document.getSource()
        });
    }

    dispose() {
        this.disposePanel();
    }

    disposePanel() {
        const panel = this.panel;

        this.panel = null;
        this.disposePanelResources();
        panel?.dispose?.();
    }

    disposePanelResources() {
        for (
            const resource
            of this.panelResources
        ) {
            resource?.dispose?.();
        }

        this.panelResources = [];
    }

    presentFailure(
        error,
        fallbackTitle = null
    ) {
        const result =
            applicationFailure(error);

        this.presenter.present(result, {
            fallbackTitle
        });

        return result;
    }
}
