import test from "node:test";
import assert from "node:assert/strict";

import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    CompilationService
} from "../src/compiler/services/CompilationService.js";
import {
    CLRSCodeLensProvider
} from "../extension/providers/CodeLensProvider.js";
import {
    CLRSCostDecorator
} from "../extension/providers/DecoratorProvider.js";
import {
    CLRSStaticDiagnosticsProvider
} from "../extension/providers/StaticDiagnosticsProvider.js";
import {
    CLRSSymbolNavigationProvider
} from "../extension/providers/SymbolNavigationProvider.js";

test("reutiliza frontend, semántica y costo para una misma versión", () => {
    let analysisCount = 0;
    let costCount = 0;
    const ast = {
        type: "Program",
        statements: []
    };
    const semanticModel = {
        globalScope: {}
    };
    const costReport = {
        statementsCost: []
    };
    const service =
        new DocumentAnalysisService({
            languageDiagnosticsService: {
                analyze(sourceCode) {
                    analysisCount += 1;

                    return {
                        ok: true,
                        diagnostics: [],
                        frontend: {
                            sourceCode,
                            ast
                        },
                        semanticModel
                    };
                }
            },
            analyzeCost(receivedAST) {
                costCount += 1;
                assert.equal(
                    receivedAST,
                    ast
                );

                return costReport;
            }
        });
    const document =
        createDocument("dato = 1");
    const first =
        service.analyzeDocument(document);
    const repeated =
        service.analyzeDocument(document);

    assert.equal(repeated, first);
    assert.equal(analysisCount, 1);
    assert.equal(costCount, 0);
    assert.equal(first.ast, ast);
    assert.equal(
        first.semanticModel,
        semanticModel
    );
    assert.equal(
        Object.isFrozen(first),
        true
    );
    assert.equal(first.hasCostAnalysis, false);

    const firstCost =
        first.getCostAnalysisResult();
    const repeatedCost =
        repeated.getCostAnalysisResult();

    assert.equal(repeatedCost, firstCost);
    assert.equal(firstCost.ok, true);
    assert.equal(firstCost.value, costReport);
    assert.equal(costCount, 1);
    assert.equal(first.hasCostAnalysis, true);

    document.sourceCode = "dato = 2";
    document.version += 1;

    const next =
        service.analyzeDocument(document);

    assert.notEqual(next, first);
    assert.equal(analysisCount, 2);
    assert.equal(service.size, 1);
    assert.equal(
        service.peek(
            document.uri.toString()
        ),
        next
    );

    assert.equal(
        service.invalidateDocument(
            document
        ),
        true
    );
    assert.equal(service.size, 0);

    service.dispose();
    service.dispose();

    assert.throws(
        () => service.analyzeDocument(
            document
        ),
        error =>
            error.code ===
            "CLRS_DOCUMENT_ANALYSIS_DISPOSED"
    );
});

test("limita documentos por uso reciente y conserva una sola versión por clave", () => {
    const service =
        new DocumentAnalysisService({
            maximumSnapshots: 2,
            languageDiagnosticsService: {
                analyze(sourceCode) {
                    return {
                        ok: true,
                        diagnostics: [],
                        frontend: {
                            sourceCode,
                            ast: {
                                type: "Program",
                                statements: []
                            }
                        },
                        semanticModel: {}
                    };
                }
            },
            analyzeCost() {
                return {
                    statementsCost: []
                };
            }
        });

    const first = service.analyze({
        key: "file:///uno.clrs",
        version: 1,
        sourceCode: "uno = 1"
    });
    service.analyze({
        key: "file:///dos.clrs",
        version: 1,
        sourceCode: "dos = 2"
    });

    assert.equal(
        service.analyze({
            key: "file:///uno.clrs",
            version: 1,
            sourceCode: "uno = 1"
        }),
        first
    );

    service.analyze({
        key: "file:///tres.clrs",
        version: 1,
        sourceCode: "tres = 3"
    });

    assert.equal(service.size, 2);
    assert.equal(
        service.peek("file:///dos.clrs"),
        null
    );
    assert.equal(
        service.peek("file:///uno.clrs"),
        first
    );

    const updated = service.analyze({
        key: "file:///uno.clrs",
        version: 2,
        sourceCode: "uno = 10"
    });

    assert.notEqual(updated, first);
    assert.equal(service.size, 2);
});

test("un snapshot inválido conserva diagnósticos y no calcula costo", () => {
    const diagnostic = {
        code: "CLRS_PARSER_ERROR",
        message: "Código incompleto."
    };
    let costCount = 0;
    const service =
        new DocumentAnalysisService({
            languageDiagnosticsService: {
                analyze() {
                    return {
                        ok: false,
                        diagnostics: [
                            diagnostic
                        ],
                        frontend: null,
                        semanticModel: null
                    };
                }
            },
            analyzeCost() {
                costCount += 1;
                return {};
            }
        });
    const snapshot = service.analyze({
        key: "file:///invalido.clrs",
        version: 1,
        sourceCode: "si"
    });
    const cost =
        snapshot.getCostAnalysisResult();

    assert.equal(snapshot.ok, false);
    assert.equal(snapshot.ast, null);
    assert.deepEqual(
        snapshot.diagnostics,
        [diagnostic]
    );
    assert.equal(cost.ok, false);
    assert.deepEqual(
        cost.errors,
        [diagnostic]
    );
    assert.equal(costCount, 0);
});

test("integra el frontend y el costo reales sin repetir la semántica", () => {
    const compilationService =
        new CompilationService();
    const service =
        new DocumentAnalysisService({
            languageDiagnosticsService:
                new LanguageDiagnosticsService(),
            analyzeCost:
                ast =>
                    compilationService
                        .analyzeCostAST(ast)
        });
    const document = createDocument([
        "PRINCIPAL()",
        "    dato = 1",
        "    escribir dato"
    ].join("\n"));
    const snapshot =
        service.analyzeDocument(document);
    const cost =
        snapshot.getCostAnalysisResult();

    assert.equal(snapshot.ok, true);
    assert.equal(
        snapshot.ast.type,
        "Program"
    );
    assert.ok(snapshot.semanticModel);
    assert.equal(cost.ok, true);
    assert.equal(
        cost.value
            .statementsCost.length,
        1
    );
});

test("diagnósticos, costos y navegación comparten el mismo snapshot", async () => {
    const fake = createFakeVSCode();
    let analysisCount = 0;
    let costCount = 0;
    const service =
        new DocumentAnalysisService({
            languageDiagnosticsService: {
                analyze(sourceCode) {
                    analysisCount += 1;

                    return {
                        ok: true,
                        diagnostics: [],
                        frontend: {
                            sourceCode,
                            ast: {
                                type: "Program",
                                statements: []
                            }
                        },
                        semanticModel: {}
                    };
                }
            },
            analyzeCost() {
                costCount += 1;

                return {
                    statementsCost: []
                };
            }
        });
    const unavailableLegacyAnalysis = {
        execute() {
            throw new Error(
                "No debe usarse la ruta antigua."
            );
        }
    };
    const codeLens =
        new CLRSCodeLensProvider({
            analyzeCostUseCase:
                unavailableLegacyAnalysis,
            documentAnalysisService:
                service,
            vscodeApi: fake.api,
            viewState: {
                showCost: true
            },
            languageId: "clrs-es"
        });
    const decorator =
        new CLRSCostDecorator({
            analyzeCostUseCase:
                unavailableLegacyAnalysis,
            documentAnalysisService:
                service,
            vscodeApi: fake.api,
            viewState: {
                showCost: true
            },
            languageId: "clrs-es"
        });
    const diagnostics =
        new CLRSStaticDiagnosticsProvider({
            vscodeApi: fake.api,
            diagnosticsService: {
                diagnose() {
                    throw new Error(
                        "No debe usarse la ruta antigua."
                    );
                }
            },
            documentAnalysisService:
                service,
            languageId: "clrs-es"
        });
    const navigation =
        new CLRSSymbolNavigationProvider({
            vscodeApi: fake.api,
            documentAnalysisService:
                service,
            languageId: "clrs-es"
        });
    const document =
        createDocument("PRINCIPAL()");
    const editor = {
        document,
        setDecorations(
            _decoration,
            values
        ) {
            this.decorations = values;
        }
    };

    decorator.update(editor);
    codeLens.provideCodeLenses(document);
    assert.deepEqual(
        navigation
            .provideDocumentSymbols(
                document
            ),
        []
    );
    assert.equal(
        await diagnostics.refresh(
            document
        ),
        true
    );

    assert.equal(analysisCount, 1);
    assert.equal(costCount, 1);
    assert.equal(service.size, 1);
    assert.deepEqual(
        editor.decorations,
        []
    );
    assert.deepEqual(
        fake.collection.values,
        []
    );

    diagnostics.clear(document);
    assert.equal(service.size, 0);

    diagnostics.dispose();
    navigation.dispose();
    decorator.dispose();
    codeLens.dispose();
    service.dispose();
});

function createDocument(sourceCode) {
    const uri = {
        value: "file:///programa.clrs",
        toString() {
            return this.value;
        }
    };

    return {
        uri,
        languageId: "clrs-es",
        version: 1,
        isClosed: false,
        sourceCode,
        get lineCount() {
            return this.sourceCode
                .split("\n")
                .length;
        },
        getText() {
            return this.sourceCode;
        },
        lineAt(line) {
            return {
                text:
                    this.sourceCode
                        .split("\n")[line] ??
                    ""
            };
        }
    };
}

function createFakeVSCode() {
    const disposable = () => ({
        dispose() {}
    });
    const collection = {
        values: null,
        set(_uri, values) {
            this.values = values;
        },
        delete() {
            this.values = null;
        },
        clear() {
            this.values = null;
        },
        dispose() {}
    };
    const decoration = disposable();

    class Range {
        constructor(
            startLine,
            startCharacter,
            endLine,
            endCharacter
        ) {
            this.start = {
                line: startLine,
                character: startCharacter
            };
            this.end = {
                line: endLine,
                character: endCharacter
            };
        }
    }

    class EventEmitter {
        constructor() {
            this.event = () => {};
        }

        fire() {}

        dispose() {}
    }

    class CodeLens {
        constructor(range, command) {
            this.range = range;
            this.command = command;
        }
    }

    class Diagnostic {
        constructor(range, message, severity) {
            this.range = range;
            this.message = message;
            this.severity = severity;
        }
    }

    class ThemeColor {
        constructor(id) {
            this.id = id;
        }
    }

    return {
        collection,
        api: {
            Range,
            EventEmitter,
            CodeLens,
            Diagnostic,
            ThemeColor,
            DiagnosticSeverity: {
                Error: 0,
                Warning: 1,
                Information: 2,
                Hint: 3
            },
            DecorationRangeBehavior: {
                OpenClosed: 1
            },
            languages: {
                createDiagnosticCollection() {
                    return collection;
                }
            },
            window: {
                createTextEditorDecorationType() {
                    return decoration;
                }
            },
            workspace: {
                textDocuments: [],
                onDidOpenTextDocument:
                    disposable,
                onDidChangeTextDocument:
                    disposable,
                onDidSaveTextDocument:
                    disposable,
                onDidCloseTextDocument:
                    disposable
            }
        }
    };
}
