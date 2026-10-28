import assert from "node:assert/strict";
import test from "node:test";

import {
    BrokerClrsDocumentCaptureService,
    BROKER_CLRS_DOCUMENT_CAPTURE_LIMITS,
    createBrokerClrsDocumentLlmContext
} from "../src/broker95/index.js";
import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    VSCodeBrokerDocumentHost
} from "../extension/adapters/VSCodeBrokerDocumentHost.js";

const LANGUAGE_ID = "clrs-es";

test("captura una versión exacta del CLRS activo con análisis compartido y métricas", () => {
    const sourceCode = [
        "SUMA(a, b)",
        "    retornar a + b",
        "PRINCIPAL()",
        "    escribir SUMA(1, 2)"
    ].join("\n");
    const analysisService = createDocumentAnalysisService();
    const service = new BrokerClrsDocumentCaptureService({
        documentHost: {
            captureActiveDocument() {
                return document({ sourceCode });
            }
        },
        documentAnalysisService: analysisService,
        languageId: LANGUAGE_ID,
        now: () => 1_700_000_000_000
    });

    const capture = service.capture();

    assert.equal(Object.isFrozen(capture), true);
    assert.equal(capture.capturedAt, 1_700_000_000_000);
    assert.deepEqual(capture.document, {
        documentId: "file:///private/workspace/programa.clrs",
        name: "programa.clrs",
        languageId: LANGUAGE_ID,
        version: 14
    });
    assert.equal(capture.sourceCode, sourceCode);
    assert.match(capture.sourceHash, /^[a-f\d]{64}$/u);
    assert.equal(capture.analysis.status, "valid");
    assert.equal(capture.analysis.diagnosticCount, 0);
    assert.deepEqual(capture.staticMetrics.functions, [{
        name: "SUMA",
        parameterCount: 2,
        startLine: 1
    }, {
        name: "PRINCIPAL",
        parameterCount: 0,
        startLine: 3
    }]);
    assert.equal(capture.staticMetrics.functionCount, 2);
    assert.equal(capture.staticMetrics.topLevelStatementCount, 2);
    assert.equal(analysisService.size, 1);
    assert.equal(
        analysisService.peek(
            "file:///private/workspace/programa.clrs"
        )?.version,
        14
    );
});

test("acepta una instantánea sintácticamente incompleta para que CIPHER pueda ayudar a corregirla", () => {
    const service = new BrokerClrsDocumentCaptureService({
        documentHost: {
            captureActiveDocument() {
                return document({
                    sourceCode: "escribir ,"
                });
            }
        },
        documentAnalysisService: createDocumentAnalysisService(),
        languageId: LANGUAGE_ID,
        now: () => 1
    });

    const capture = service.capture();

    assert.equal(capture.analysis.status, "invalid");
    assert.equal(capture.analysis.diagnosticCount > 0, true);
    assert.equal(
        capture.analysis.diagnostics[0].code,
        "CLRS_PARSER_ERROR"
    );
    assert.match(
        capture.analysis.diagnostics[0].message,
        /Se esperaba|sintaxis/u
    );
});

test("la proyección para CIPHER conserva código y hechos seguros, pero omite la identidad local", () => {
    const capture = new BrokerClrsDocumentCaptureService({
        documentHost: {
            captureActiveDocument() {
                return document({
                    documentId: "file:///C:/Users/alguien/secreto.clrs",
                    sourceCode: "PRINCIPAL()\n    escribir 1"
                });
            }
        },
        documentAnalysisService: createDocumentAnalysisService(),
        languageId: LANGUAGE_ID,
        now: () => 999
    }).capture();

    const context = createBrokerClrsDocumentLlmContext(capture);
    const serialized = JSON.stringify(context);

    assert.equal(Object.isFrozen(context), true);
    assert.equal(context.document.documentId, undefined);
    assert.equal(context.capturedAt, undefined);
    assert.equal(context.sourceCode, capture.sourceCode);
    assert.equal(context.document.sourceHash, capture.sourceHash);
    assert.doesNotMatch(serialized, /file:\/\/\/C:/u);
    assert.doesNotMatch(serialized, /C:\\Users\\alguien/u);
    assert.doesNotMatch(serialized, /capturedAt/u);
});

test("rechaza falta de documento, lenguaje ajeno y fuentes excesivas antes de analizar", () => {
    let analysisCalls = 0;
    const service = new BrokerClrsDocumentCaptureService({
        documentHost: {
            captureActiveDocument() {
                return null;
            }
        },
        documentAnalysisService: {
            analyze() {
                analysisCalls += 1;
            }
        },
        languageId: LANGUAGE_ID
    });

    assert.throws(
        () => service.capture(),
        error => error.code ===
            "BROKER95_DOCUMENT_ACTIVE_REQUIRED"
    );

    service.documentHost = {
        captureActiveDocument() {
            return document({ languageId: "javascript" });
        }
    };
    assert.throws(
        () => service.capture(),
        error => error.code ===
            "BROKER95_DOCUMENT_LANGUAGE_INVALID"
    );

    service.documentHost = {
        captureActiveDocument() {
            return document({
                sourceCode: "x".repeat(
                    BROKER_CLRS_DOCUMENT_CAPTURE_LIMITS
                        .maximumSourceCharacters + 1
                )
            });
        }
    };
    assert.throws(
        () => service.capture(),
        error => error.code ===
            "BROKER95_DOCUMENT_SOURCE_INVALID"
    );
    assert.equal(analysisCalls, 0);
});

test("el adaptador de VS Code lee una vez el editor CLRS activo sin retener la ruta como nombre", () => {
    let reads = 0;
    const host = new VSCodeBrokerDocumentHost({
        window: {
            activeTextEditor: {
                document: {
                    languageId: LANGUAGE_ID,
                    version: 8,
                    uri: {
                        path: "/workspace/privado/ejemplo.clrs",
                        toString() {
                            return "file:///workspace/privado/ejemplo.clrs";
                        }
                    },
                    getText() {
                        reads += 1;
                        return "PRINCIPAL()\n    escribir 1";
                    }
                }
            }
        },
        workspace: {}
    }, { languageId: LANGUAGE_ID });

    const captured = host.captureActiveDocument();

    assert.equal(reads, 1);
    assert.equal(Object.isFrozen(captured), true);
    assert.deepEqual(captured, {
        documentId: "file:///workspace/privado/ejemplo.clrs",
        name: "ejemplo.clrs",
        languageId: LANGUAGE_ID,
        version: 8,
        sourceCode: "PRINCIPAL()\n    escribir 1"
    });

    host.vscode.window.activeTextEditor.document.languageId =
        "plaintext";
    assert.equal(host.captureActiveDocument(), null);
});

test("conserva el último CLRS cuando el foco pasa al Webview y libera sus listeners", () => {
    const sourceDocument = vscodeDocument({
        documentId: "file:///workspace/solucion.clrs",
        uriPath: "/workspace/solucion.clrs",
        sourceCode: "PRINCIPAL()\n    escribir 95"
    });
    const fixture = vscodeHostFixture({
        activeDocument: sourceDocument,
        visibleDocuments: [sourceDocument],
        textDocuments: [sourceDocument]
    });
    const host = new VSCodeBrokerDocumentHost(
        fixture.vscode,
        { languageId: LANGUAGE_ID }
    );

    fixture.focusWebview();

    assert.deepEqual(
        host.captureActiveDocument(),
        expectedVscodeSnapshot(sourceDocument)
    );

    host.dispose();

    assert.equal(fixture.disposedSubscriptions(), 2);
});

test("resuelve selectores relativos en workspaces de una y varias carpetas", async () => {
    const singleDocument = vscodeDocument({
        documentId:
            "file:///workspace/curso/ejercicios/suma.clrs",
        uriPath:
            "/workspace/curso/ejercicios/suma.clrs"
    });
    const single = vscodeHostFixture({
        workspaceFolders: [workspaceFolder(
            "Curso",
            "file:///workspace/curso"
        )],
        documentsByUri: new Map([[
            singleDocument.uri.toString(),
            singleDocument
        ]])
    });
    const singleHost = new VSCodeBrokerDocumentHost(
        single.vscode,
        { languageId: LANGUAGE_ID }
    );

    assert.deepEqual(
        await singleHost.captureDocument(
            "ejercicios\\suma.clrs"
        ),
        expectedVscodeSnapshot(singleDocument)
    );

    const multiDocument = vscodeDocument({
        documentId:
            "file:///workspace/practicas/parcial/solucion.clrs",
        uriPath:
            "/workspace/practicas/parcial/solucion.clrs"
    });
    const multi = vscodeHostFixture({
        workspaceFolders: [
            workspaceFolder(
                "Algoritmos",
                "file:///workspace/algoritmos"
            ),
            workspaceFolder(
                "Prácticas",
                "file:///workspace/practicas"
            )
        ],
        documentsByUri: new Map([[
            multiDocument.uri.toString(),
            multiDocument
        ]])
    });
    const multiHost = new VSCodeBrokerDocumentHost(
        multi.vscode,
        { languageId: LANGUAGE_ID }
    );

    assert.deepEqual(
        await multiHost.captureDocument(
            "Prácticas/parcial/solucion.clrs"
        ),
        expectedVscodeSnapshot(multiDocument)
    );
});

test("rechaza selectores que escapan, son absolutos, no son CLRS o no identifican una carpeta abierta", async () => {
    const fixture = vscodeHostFixture({
        workspaceFolders: [
            workspaceFolder(
                "Uno",
                "file:///workspace/uno"
            ),
            workspaceFolder(
                "Dos",
                "file:///workspace/dos"
            )
        ]
    });
    const host = new VSCodeBrokerDocumentHost(
        fixture.vscode,
        { languageId: LANGUAGE_ID }
    );

    for (const selector of [
        "../secreto.clrs",
        "C:\\secreto.clrs",
        "/secreto.clrs",
        "Uno/programa.txt"
    ]) {
        await assert.rejects(
            () => host.captureDocument(selector),
            error => error.code ===
                "BROKER95_DOCUMENT_PATH_INVALID",
            selector
        );
    }

    await assert.rejects(
        () => host.captureDocument(
            "Desconocida/programa.clrs"
        ),
        error => error.code ===
            "BROKER95_DOCUMENT_WORKSPACE_FOLDER_UNKNOWN"
    );
    assert.equal(fixture.openCalls.length, 0);
});

test("captureSelected analiza la ruta indicada y recapture fija la misma identidad documental", async () => {
    const sourceCode = "PRINCIPAL()\n    escribir 1";
    const selected = document({
        documentId:
            "file:///workspace/tareas/seleccion.clrs",
        name: "seleccion.clrs",
        version: 3,
        sourceCode
    });
    const selectors = [];
    const recapturedIds = [];
    const service = new BrokerClrsDocumentCaptureService({
        documentHost: {
            captureActiveDocument() {
                return null;
            },
            async captureDocument(selector) {
                selectors.push(selector);
                return selected;
            },
            recaptureDocument(documentId) {
                recapturedIds.push(documentId);
                return selected;
            }
        },
        documentAnalysisService:
            createDocumentAnalysisService(),
        languageId: LANGUAGE_ID,
        now: () => 10
    });

    const capture = await service.captureSelected(
        "tareas/seleccion.clrs"
    );
    const recapture = service.recapture(
        capture.document.documentId
    );

    assert.deepEqual(selectors, [
        "tareas/seleccion.clrs"
    ]);
    assert.deepEqual(recapturedIds, [
        selected.documentId
    ]);
    assert.equal(capture.document.name, "seleccion.clrs");
    assert.equal(recapture.sourceHash, capture.sourceHash);
});

function createDocumentAnalysisService() {
    return new DocumentAnalysisService({
        languageDiagnosticsService:
            new LanguageDiagnosticsService(),
        analyzeCost() {
            return null;
        }
    });
}

function document(overrides = {}) {
    return Object.freeze({
        documentId: "file:///private/workspace/programa.clrs",
        name: "programa.clrs",
        languageId: LANGUAGE_ID,
        version: 14,
        sourceCode: "PRINCIPAL()\n    escribir 1",
        ...overrides
    });
}

function vscodeHostFixture(options = {}) {
    let activeListener = null;
    let closeListener = null;
    let disposed = 0;
    const activeEditor = options.activeDocument == null
        ? null
        : { document: options.activeDocument };
    const window = {
        activeTextEditor: activeEditor,
        visibleTextEditors:
            (options.visibleDocuments ?? [])
                .map(document => ({ document })),
        onDidChangeActiveTextEditor(listener) {
            activeListener = listener;
            return disposable(() => {
                disposed += 1;
            });
        }
    };
    const workspace = {
        workspaceFolders:
            options.workspaceFolders ?? [],
        textDocuments: options.textDocuments ?? [],
        onDidCloseTextDocument(listener) {
            closeListener = listener;
            return disposable(() => {
                disposed += 1;
            });
        },
        async openTextDocument(uri) {
            fixture.openCalls.push(uri.toString());
            const selected = options.documentsByUri
                ?.get(uri.toString());

            if (!selected) {
                throw new Error("file not found");
            }

            return selected;
        }
    };
    const fixture = {
        openCalls: [],
        vscode: {
            window,
            workspace,
            Uri: {
                joinPath(base, ...segments) {
                    return vscodeUri([
                        base.toString().replace(/\/$/u, ""),
                        ...segments
                    ].join("/"));
                }
            }
        },
        focusWebview() {
            window.activeTextEditor = undefined;
            activeListener?.(undefined);
        },
        close(document) {
            closeListener?.(document);
        },
        disposedSubscriptions() {
            return disposed;
        }
    };

    return fixture;
}

function vscodeDocument(overrides = {}) {
    const documentId = overrides.documentId ??
        "file:///workspace/programa.clrs";

    return {
        languageId: overrides.languageId ?? LANGUAGE_ID,
        version: overrides.version ?? 1,
        uri: vscodeUri(
            documentId,
            overrides.uriPath ?? "/workspace/programa.clrs"
        ),
        isClosed: false,
        getText() {
            return overrides.sourceCode ??
                "PRINCIPAL()\n    escribir 1";
        }
    };
}

function expectedVscodeSnapshot(sourceDocument) {
    return {
        documentId: sourceDocument.uri.toString(),
        name: sourceDocument.uri.path
            .split("/")
            .at(-1),
        languageId: sourceDocument.languageId,
        version: sourceDocument.version,
        sourceCode: sourceDocument.getText()
    };
}

function workspaceFolder(name, documentId) {
    return Object.freeze({
        name,
        uri: vscodeUri(documentId)
    });
}

function vscodeUri(documentId, uriPath = null) {
    return Object.freeze({
        path: uriPath ?? new URL(documentId).pathname,
        toString() {
            return documentId;
        }
    });
}

function disposable(onDispose) {
    return Object.freeze({
        dispose: onDispose
    });
}
