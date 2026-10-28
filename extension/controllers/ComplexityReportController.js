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

export class ComplexityReportController {

    constructor(options = {}) {
        this.host = requirePort(
            options.host,
            "complexityReportHost",
            [
                "getActiveDocument",
                "createPanel",
                "onDocumentChange",
                "schedule",
                "revealLocation"
            ]
        );
        this.presenter = requirePort(
            options.presenter,
            "notificationPresenter",
            ["present"]
        );
        this.documentAnalysisService =
            requirePort(
                options.documentAnalysisService,
                "documentAnalysisService",
                ["analyzeDocument"]
            );
        this.reportBuilder = requirePort(
            options.reportBuilder,
            "complexityReportBuilder",
            ["build"]
        );
        this.updateDelay =
            options.updateDelay ?? 180;
        this.developerLogger =
            options.developerLogger ??
            console;
        this.performanceMonitor =
            options.performanceMonitor == null
                ? null
                : requirePort(
                    options.performanceMonitor,
                    "performanceMonitor",
                    ["now", "record"]
                );
        this.panel = null;
        this.document = null;
        this.resources = [];
        this.pendingUpdate = null;
        this.selectedFunctionId = null;
        this.webviewOpenedAt = null;
    }

    openReport(context, selection = null) {
        const document =
            this.host.getActiveDocument();

        if (!document) {
            if (this.panel && this.document) {
                this.panel.reveal();
                this.postReport();

                return applicationSuccess({
                    panel: this.panel,
                    document: this.document,
                    reused: true
                });
            }

            return this.presentFailure(
                ApplicationError
                    .noActiveDocument()
            );
        }

        this.selectedFunctionId =
            selection?.functionId ??
            this.selectedFunctionId;

        if (
            this.panel != null &&
            this.document?.documentUri ===
                document.documentUri
        ) {
            this.document?.adopt?.(document);
            this.panel.reveal();
            this.postReport();

            return applicationSuccess({
                panel: this.panel,
                document,
                reused: true
            });
        }

        this.disposePanel();

        const panel =
            this.host.createPanel(
                context,
                document
            );

        this.panel = panel;
        this.document = document;
        this.webviewOpenedAt =
            this.performanceMonitor?.now() ??
            null;
        this.resources.push(
            panel.onMessage(message =>
                this.handlePanelMessage(
                    message
                )
            ),
            panel.onDispose(() => {
                if (this.panel === panel) {
                    this.panel = null;
                    this.document = null;
                }

                this.disposeResources();
            }),
            this.host.onDocumentChange(
                document,
                () => this.scheduleUpdate()
            )
        );

        this.postReport();

        return applicationSuccess({
            panel,
            document,
            reused: false
        });
    }

    scheduleUpdate() {
        this.pendingUpdate?.dispose?.();
        this.pendingUpdate =
            this.host.schedule(() => {
                this.pendingUpdate = null;
                this.postReport();
            }, this.updateDelay);
    }

    postReport() {
        const panel = this.panel;
        const document = this.document;

        if (!panel || !document) {
            return false;
        }

        const analysisDocument =
            document.getAnalysisDocument();
        const requestedVersion =
            analysisDocument.version ?? null;

        try {
            const snapshot =
                this.documentAnalysisService
                    .analyzeDocument(
                        analysisDocument
                    );
            const result =
                snapshot
                    .getCostAnalysisResult();

            if (!result.ok) {
                return panel.postMessage({
                    type: "report-error",
                    documentVersion:
                        snapshot.version,
                    error:
                        presentableError(
                            result.errors[0]
                        )
                });
            }

            if (
                requestedVersion !==
                document.version
            ) {
                this.scheduleUpdate();
                return false;
            }

            const report =
                this.reportBuilder.build(
                    result.value,
                    document.metadata()
                );

            return panel.postMessage({
                type: "complexity-report",
                report,
                selectedFunctionId:
                    this.selectedFunctionId
            });
        } catch (error) {
            this.developerLogger.error?.(
                "Error building CLRS complexity report:",
                error
            );

            return panel.postMessage({
                type: "report-error",
                documentVersion:
                    document.version,
                error:
                    presentableError(error)
            });
        }
    }

    async handlePanelMessage(message) {
        if (message?.type === "ready") {
            this.recordWebviewReady();
            this.postReport();
            return applicationSuccess({
                ready: true
            });
        }

        if (message?.type === "select-function") {
            this.selectedFunctionId =
                message.functionId ?? null;

            return applicationSuccess({
                selectedFunctionId:
                    this.selectedFunctionId
            });
        }

        if (message?.type === "navigate") {
            const navigated =
                await this.host
                    .revealLocation(
                        this.document,
                        message.location
                    );

            return applicationSuccess({
                navigated
            });
        }

        return applicationSuccess({
            ignored: true
        });
    }

    recordWebviewReady() {
        if (
            this.performanceMonitor == null ||
            this.webviewOpenedAt == null
        ) {
            return false;
        }

        const duration = Math.max(
            0,
            this.performanceMonitor.now() -
                this.webviewOpenedAt
        );

        this.webviewOpenedAt = null;
        return this.performanceMonitor.record(
            "webview.complexity-report.ready",
            duration
        );
    }

    dispose() {
        this.disposePanel();
    }

    disposePanel() {
        const panel = this.panel;

        this.panel = null;
        this.document = null;
        this.webviewOpenedAt = null;
        this.disposeResources();
        panel?.dispose?.();
    }

    disposeResources() {
        this.pendingUpdate?.dispose?.();
        this.pendingUpdate = null;

        for (const resource of this.resources) {
            resource?.dispose?.();
        }

        this.resources = [];
    }

    presentFailure(error) {
        const result =
            applicationFailure(error);

        this.presenter.present(result);
        return result;
    }
}

function presentableError(error) {
    return {
        code:
            error?.code ??
            "CLRS_COMPLEXITY_REPORT_FAILED",
        message:
            error?.publicMessage ??
            error?.message ??
            "No se pudo generar el informe de complejidad.",
        location:
            error?.location ?? null
    };
}
