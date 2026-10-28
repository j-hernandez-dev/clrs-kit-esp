import test from "node:test";
import assert from "node:assert/strict";

import {
    ComplexityReportController
} from "../extension/controllers/ComplexityReportController.js";
import {
    VSCodeComplexityReportHost
} from "../extension/adapters/VSCodeComplexityReportHost.js";

test("el panel comparte el snapshot documental y conserva su versión exacta", () => {
    const fixture = createFixture();

    const opened = fixture.controller
        .openReport(
            { extensionUri: {} },
            { functionId: "TF" }
        );

    assert.equal(opened.ok, true);
    assert.equal(
        fixture.analysisRequests.length,
        1
    );
    assert.equal(
        fixture.analysisRequests[0],
        fixture.rawDocument
    );
    assert.deepEqual(
        fixture.messages[0],
        {
            type: "complexity-report",
            report: fixture.presentation,
            selectedFunctionId: "TF"
        }
    );

    fixture.rawDocument.version = 4;
    fixture.documentChange();

    assert.equal(
        fixture.analysisRequests.length,
        2
    );
    assert.equal(
        fixture.buildMetadata[1].version,
        4
    );
});

test("el panel navega al código mediante el host", async () => {
    const fixture = createFixture();

    fixture.controller.openReport(
        { extensionUri: {} }
    );

    const location = {
        startLine: 2,
        startColumn: 1
    };
    const navigation =
        await fixture.controller
            .handlePanelMessage({
                type: "navigate",
                location
            });
    assert.equal(navigation.ok, true);
    assert.deepEqual(
        fixture.navigated,
        [location]
    );
});

test("revela el informe enlazado cuando el Webview deja al editor sin documento activo", () => {
    const fixture = createFixture();

    const opened = fixture.controller
        .openReport({ extensionUri: {} });

    fixture.setActiveDocument(null);

    const reused = fixture.controller
        .openReport({ extensionUri: {} });

    assert.equal(opened.value.reused, false);
    assert.equal(reused.ok, true);
    assert.equal(reused.value.reused, true);
    assert.equal(
        reused.value.document,
        fixture.document
    );
    assert.equal(fixture.panel.revealCount, 1);
    assert.equal(
        fixture.analysisRequests.length,
        2
    );
});

test("el host revela el informe en su grupo actual", () => {
    const revealCalls = [];
    const rawPanel = {
        viewColumn: 7,
        webview: {
            html: "",
            postMessage() {},
            onDidReceiveMessage() {
                return disposable();
            }
        },
        onDidDispose() {
            return disposable();
        },
        reveal(...args) {
            revealCalls.push(args);
        },
        dispose() {}
    };
    const vscode = {
        ViewColumn: { Beside: 2 },
        Uri: {
            joinPath() {
                return {};
            }
        },
        window: {
            createWebviewPanel() {
                return rawPanel;
            }
        }
    };
    const host =
        new VSCodeComplexityReportHost(
            vscode,
            () => "<html></html>",
            {
                complexityReportViewType:
                    "clrsComplexityReport",
                complexityReportTitlePrefix:
                    "Informe de complejidad"
            }
        );
    const panel = host.createPanel(
        { extensionUri: {} },
        { fileName: "programa.clrs" }
    );

    panel.reveal();

    assert.deepEqual(
        revealCalls,
        [[7, true]]
    );
});

function createFixture() {
    const messages = [];
    const analysisRequests = [];
    const buildMetadata = [];
    const navigated = [];
    const presentation = Object.freeze({
        kind: "complexity-report",
        document: {
            version: 3
        },
        functions: []
    });
    const rawDocument = {
        version: 3,
        uri: {
            toString() {
                return "file:///a.clrs";
            }
        },
        getText() {
            return "F()";
        }
    };
    const document = {
        documentUri: "file:///a.clrs",
        fileName: "a.clrs",
        get version() {
            return rawDocument.version;
        },
        getAnalysisDocument() {
            return rawDocument;
        },
        metadata() {
            return {
                uri: this.documentUri,
                fileName: this.fileName,
                version: this.version
            };
        }
    };
    let activeDocument = document;
    let documentChange = () => {};
    const panel = {
        revealCount: 0,
        postMessage(message) {
            messages.push(message);
            return true;
        },
        onMessage() {
            return disposable();
        },
        onDispose() {
            return disposable();
        },
        reveal() {
            this.revealCount += 1;
        },
        dispose() {}
    };
    const controller =
        new ComplexityReportController({
            host: {
                getActiveDocument() {
                    return activeDocument;
                },
                createPanel() {
                    return panel;
                },
                onDocumentChange(
                    _document,
                    listener
                ) {
                    documentChange = listener;
                    return disposable();
                },
                schedule(callback) {
                    callback();
                    return disposable();
                },
                async revealLocation(
                    _document,
                    location
                ) {
                    navigated.push(location);
                    return true;
                }
            },
            presenter: {
                present() {}
            },
            documentAnalysisService: {
                analyzeDocument(request) {
                    analysisRequests.push(
                        request
                    );

                    return {
                        version:
                            request.version,
                        getCostAnalysisResult() {
                            return {
                                ok: true,
                                value: {
                                    statementsCost: []
                                }
                            };
                        }
                    };
                }
            },
            reportBuilder: {
                build(_report, metadata) {
                    buildMetadata.push(
                        metadata
                    );
                    return presentation;
                }
            },
            updateDelay: 0,
            developerLogger: {
                error() {}
            }
        });

    return {
        controller,
        rawDocument,
        presentation,
        document,
        panel,
        messages,
        analysisRequests,
        buildMetadata,
        navigated,
        setActiveDocument(value) {
            activeDocument = value;
        },
        documentChange() {
            documentChange();
        }
    };
}

function disposable() {
    return {
        dispose() {}
    };
}
