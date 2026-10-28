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
import {
    getPublicMessage
} from "../../src/errors/ErrorFormatter.js";
import {
    DiagramEditingError
} from "../../src/errors/DiagramEditingError.js";
import {
    DiagramSourceEditService
} from "../../src/diagram/editing/DiagramSourceEditService.js";

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
                "revealLocation",
                "saveDocument",
                "saveSvg"
            ]
        );
        this.presenter = requirePort(
            options.presenter,
            "notificationPresenter",
            ["present", "info"]
        );
        this.executionTraceService =
            requirePort(
                options.executionTraceService,
                "executionTraceService",
                [
                    "getSnapshot",
                    "subscribe"
                ]
            );
        this.testCoverageStore =
            options.testCoverageStore == null
                ? null
                : requirePort(
                    options.testCoverageStore,
                    "testCoverageStore",
                    ["getSnapshot", "subscribe"]
                );
        this.documentAnalysisService =
            options.documentAnalysisService == null
                ? null
                : requirePort(
                    options.documentAnalysisService,
                    "documentAnalysisService",
                    ["analyzeDocument"]
                );
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
        this.editingService =
            options.editingService ??
            new DiagramSourceEditService();
        this.initialSourceDelay =
            options.initialSourceDelay;
        this.executeDocument =
            typeof options.executeDocument ===
                "function"
                ? options.executeDocument
                : null;
        this.stopDocument =
            typeof options.stopDocument ===
                "function"
                ? options.stopDocument
                : null;

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
        this.document = null;
        this.panelResources = [];
        this.pendingExecutionSteps = [];
        this.executionFlushTimer = null;
        this.webviewOpenedAt = null;
        this.traceResource =
            this.executionTraceService
                .subscribe(event => {
                    this.forwardExecutionEvent(
                        event
                    );
                });
        this.coverageResource =
            this.testCoverageStore
                ?.subscribe(() => {
                    this.forwardTestCoverage();
                }) ?? null;
    }

    async toggleDiagram(context) {
        const document =
            this.host.getActiveDocument();

        if (!document) {
            if (this.panel && this.document) {
                this.panel.reveal();
                this.postInitialState(
                    this.panel,
                    this.document
                );

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

        if (
            this.panel &&
            sameDiagramDocument(
                this.document,
                document
            )
        ) {
            this.document?.adopt?.(document);
            this.panel.reveal();
            this.postInitialState(
                this.panel,
                this.document
            );

            return applicationSuccess({
                panel: this.panel,
                document: this.document,
                reused: true
            });
        }

        return this.openDiagram(
            context,
            document
        );
    }

    openDiagram(context, document) {
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

        this.panelResources.push(
            panel.onMessage(
                message =>
                    this.handlePanelMessage(
                        message,
                        panel
                    )
            ),
            this.host.schedule(
                () => {
                    this.postInitialState(
                        panel,
                        document
                    );
                },
                this.initialSourceDelay
            ),
            this.host.onDocumentChange(
                document,
                () => {
                    this.postSource(
                        panel,
                        document
                    );
                    this.postExecutionTrace(
                        panel,
                        document
                    );
                    this.postTestCoverage(
                        panel,
                        document
                    );
                }
            ),
            this.host.onSelectionChange(
                document,
                () =>
                    this.postSelection(
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
                    this.document = null;
                }
            })
        );

        return applicationSuccess({
            panel,
            document,
            reused: false
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

    async handlePanelMessage(
        message,
        panel = null
    ) {

        if (message?.type === "webview-ready") {
            if (
                panel == null ||
                panel !== this.panel
            ) {
                return applicationSuccess({
                    ready: false
                });
            }

            this.recordWebviewReady();

            this.postInitialState(
                panel,
                this.document
            );

            return applicationSuccess({
                ready: true
            });
        }

        if (message?.type === "navigate") {
            if (!this.document) {
                return applicationSuccess({
                    navigated: false
                });
            }

            try {
                const navigated =
                    await this.host
                        .revealLocation(
                            this.document,
                            message.location
                        );

                return applicationSuccess({
                    navigated
                });
            } catch (error) {
                return this.presentFailure(
                    error
                );
            }
        }

        if (message?.type === "diagram-edit") {
            return this.handleDiagramEdit(
                message,
                panel
            );
        }

        if (message?.type === "execute-document") {
            if (
                !this.document ||
                (panel != null && panel !== this.panel) ||
                this.executeDocument == null
            ) {
                return this.presentFailure(
                    ApplicationError
                        .invalidRequest(
                            "No hay un archivo CLRS enlazado al diagrama para ejecutar."
                        )
                );
            }

            try {
                return await this.executeDocument(
                    this.document
                );
            } catch (error) {
                return this.presentFailure(
                    error,
                    "Error al ejecutar"
                );
            }
        }

        if (message?.type === "stop-document") {
            if (
                (panel != null && panel !== this.panel) ||
                this.stopDocument == null
            ) {
                return this.presentFailure(
                    ApplicationError
                        .invalidRequest(
                            "No hay una ejecución CLRS enlazada al diagrama para detener."
                        )
                );
            }

            try {
                return await this.stopDocument();
            } catch (error) {
                return this.presentFailure(
                    error,
                    "Error al detener la ejecución"
                );
            }
        }

        if (message?.type === "save-document") {
            if (
                !this.document ||
                (panel != null && panel !== this.panel)
            ) {
                return this.presentFailure(
                    ApplicationError
                        .invalidRequest(
                            "No hay un archivo CLRS enlazado al diagrama."
                        )
                );
            }

            try {
                const saved =
                    await this.host
                        .saveDocument(
                            this.document
                        );

                if (saved) {
                    this.presenter.info(
                        "Archivo CLRS guardado."
                    );
                }

                return applicationSuccess({
                    saved
                });
            } catch (error) {
                return this.presentFailure(
                    error,
                    "Error al guardar"
                );
            }
        }

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
            "webview.diagram.ready",
            duration
        );
    }

    async handleDiagramEdit(message, panel) {
        const responsePanel =
            panel ?? this.panel;
        const requestId =
            validRequestId(message.requestId)
                ? message.requestId
                : null;

        try {
            if (
                !this.document ||
                !responsePanel ||
                responsePanel !== this.panel ||
                requestId == null
            ) {
                throw DiagramEditingError
                    .invalidIntent(
                        "La solicitud no pertenece al diagrama activo."
                    );
            }

            if (
                typeof this.host
                    .applySourceEdits !==
                "function"
            ) {
                throw DiagramEditingError
                    .applyFailed();
            }

            const plan =
                this.editingService.plan({
                    sourceCode:
                        this.document.getSource(),
                    sourceOrigin:
                        this.document
                            .getSourceOrigin(),
                    wholeDocument:
                        this.document
                            .isWholeDocument?.() ??
                        false,
                    documentVersion:
                        this.document.version,
                    expectedDocumentVersion:
                        message
                            .expectedDocumentVersion,
                    intent: message.intent
                });
            const applied =
                await this.host
                    .applySourceEdits(
                        this.document,
                        plan
                    );

            if (!applied) {
                throw DiagramEditingError
                    .staleDocument();
            }

            await responsePanel.postMessage({
                type: "diagram-edit-result",
                requestId,
                ok: true,
                operation: plan.operation
            });
            this.presenter.info(
                diagramEditSuccessMessage(
                    plan.operation
                )
            );

            return applicationSuccess({
                applied: true,
                operation: plan.operation
            });
        } catch (error) {
            await responsePanel?.postMessage?.({
                type: "diagram-edit-result",
                requestId,
                ok: false,
                code: error?.code ?? null,
                error: getPublicMessage(error)
            });

            return this.presentFailure(
                error,
                "Edición del diagrama"
            );
        }
    }

    postSource(panel, document) {
        return panel.postMessage({
            type: "source",
            source:
                document.getSource(),
            sourceOrigin:
                document.getSourceOrigin(),
            documentVersion:
                document.version ?? null,
            wholeDocument:
                document.isWholeDocument?.() ??
                false,
            semanticDiagnostics:
                this.getSemanticDiagnostics(
                    document
                ),
            selection:
                document.getSelection()
        });
    }

    getSemanticDiagnostics(document) {
        if (
            this.documentAnalysisService == null ||
            document.isWholeDocument?.() !== true ||
            document.document == null
        ) {
            return [];
        }

        try {
            const snapshot =
                this.documentAnalysisService
                    .analyzeDocument(
                        document.document
                    );

            return (snapshot.diagnostics ?? [])
                .filter(diagnostic =>
                    diagnostic?.phase ===
                        "semantic"
                );
        } catch (error) {
            this.developerLogger?.error?.(
                "Could not analyze diagram semantics.",
                error
            );

            return [];
        }
    }

    postInitialState(
        panel,
        document
    ) {
        if (
            panel !== this.panel ||
            document !== this.document
        ) {
            return false;
        }

        const source = this.postSource(
            panel,
            document
        );

        this.postExecutionTrace(
            panel,
            document
        );
        this.postTestCoverage(
            panel,
            document
        );

        return source;
    }

    postSelection(panel, document) {
        return panel.postMessage({
            type: "selection",
            location:
                document.getSelection()
        });
    }

    postExecutionTrace(panel, document) {
        const trace =
            this.executionTraceService
                .getSnapshot();

        if (!trace) {
            return false;
        }

        return panel.postMessage({
            type: "execution-trace",
            trace:
                documentMatchesTrace(
                    document,
                    trace
                )
                    ? trace
                    : null
        });
    }

    postTestCoverage(panel, document) {
        if (this.testCoverageStore == null) {
            return false;
        }

        const sourcePath =
            document?.filePath ??
            document?.document?.uri?.fsPath ??
            document?.fileName ?? null;
        const snapshot = sourcePath == null
            ? null
            : this.testCoverageStore
                .getSnapshot(sourcePath);
        const matches = snapshot != null &&
            documentMatchesTestCoverage(
                document,
                snapshot
            );

        return panel.postMessage({
            type: "test-coverage",
            coverage: matches
                ? createDiagramCoveragePayload(
                    snapshot
                )
                : null
        });
    }

    forwardTestCoverage() {
        if (!this.panel || !this.document) {
            return false;
        }

        return this.postTestCoverage(
            this.panel,
            this.document
        );
    }

    forwardExecutionEvent(event) {
        const panel = this.panel;
        const document = this.document;

        if (
            !panel ||
            !document ||
            !documentMatchesTrace(
                document,
                event.trace ?? event
            )
        ) {
            return;
        }

        if (event.type === "step") {
            this.pendingExecutionSteps.push(
                event
            );
            this.scheduleExecutionFlush();
            return;
        }

        this.flushExecutionSteps();

        this.postExecutionEvent(
            panel,
            event
        );
    }

    scheduleExecutionFlush() {
        if (this.executionFlushTimer != null) {
            return;
        }

        this.executionFlushTimer =
            setTimeout(() => {
                this.executionFlushTimer = null;
                this.flushExecutionSteps();
            }, 40);
    }

    flushExecutionSteps() {
        if (this.executionFlushTimer != null) {
            clearTimeout(
                this.executionFlushTimer
            );
            this.executionFlushTimer = null;
        }

        if (
            this.pendingExecutionSteps.length ===
                0
        ) {
            return;
        }

        const events =
            this.pendingExecutionSteps;

        this.pendingExecutionSteps = [];

        const first = events[0];
        const panel = this.panel;

        if (!panel) {
            return;
        }

        this.postExecutionEvent(
            panel,
            {
                type: "steps",
                traceId: first.traceId,
                sourcePath:
                    first.sourcePath,
                documentVersion:
                    first.documentVersion,
                steps: events.map(
                    event => event.step
                )
            }
        );
    }

    postExecutionEvent(panel, event) {
        Promise.resolve(
            panel.postMessage({
                type: "execution-event",
                event
            })
        ).catch(error => {
            this.developerLogger.error?.(
                "Error forwarding CLRS execution trace:",
                error
            );
        });
    }

    dispose() {
        this.traceResource?.dispose?.();
        this.traceResource = null;
        this.coverageResource?.dispose?.();
        this.coverageResource = null;
        this.disposePanel();
    }

    disposePanel() {
        const panel = this.panel;

        this.panel = null;
        this.document = null;
        this.webviewOpenedAt = null;
        this.disposePanelResources();
        panel?.dispose?.();
    }

    disposePanelResources() {
        if (this.executionFlushTimer != null) {
            clearTimeout(
                this.executionFlushTimer
            );
            this.executionFlushTimer = null;
        }

        this.pendingExecutionSteps = [];

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

function diagramEditSuccessMessage(operation) {
    switch (operation) {
        case "insert-node":
            return "Figura insertada en el código fuente.";
        case "create-function":
            return "Función creada en el código fuente.";
        case "delete-node":
            return "Figura eliminada del código fuente.";
        default:
            return "Figura actualizada en el código fuente.";
    }
}

function validRequestId(value) {
    return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= 128 &&
        /^[A-Za-z0-9_-]+$/u.test(value)
    );
}

function sameDiagramDocument(left, right) {
    if (!left || !right) {
        return false;
    }

    if (
        typeof left.matchesSession ===
            "function"
    ) {
        return left.matchesSession(right);
    }

    return (
        typeof left.documentUri === "string" &&
        left.documentUri === right.documentUri
    );
}

function documentMatchesTrace(
    document,
    trace
) {
    if (
        typeof document
            ?.matchesExecutionTrace ===
        "function"
    ) {
        return document
            .matchesExecutionTrace(trace);
    }

    return true;
}

function documentMatchesTestCoverage(
    document,
    snapshot
) {
    if (
        typeof document
            ?.matchesTestCoverage ===
        "function"
    ) {
        return document
            .matchesTestCoverage(snapshot);
    }

    return true;
}

function createDiagramCoveragePayload(snapshot) {
    const coverage = snapshot.coverage;

    return Object.freeze({
        revision: snapshot.revision,
        complete: coverage.complete,
        truncated: coverage.truncated,
        testCount: coverage.testCount,
        evidenceTestCount:
            coverage.evidenceTestCount,
        summary: coverage.summary,
        points: Object.freeze(
            coverage.points.map(point =>
                Object.freeze({
                    pointId: point.pointId,
                    kind: point.kind,
                    name: point.name,
                    location: point.location,
                    hitCount: point.hitCount,
                    outcomeCounts:
                        point.outcomeCounts
                })
            )
        )
    });
}
