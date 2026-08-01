import test from "node:test";
import assert from "node:assert/strict";

import {
    CLRSStaticDiagnosticsProvider
} from "../extension/providers/StaticDiagnosticsProvider.js";

test("el adaptador publica, reemplaza y elimina diagnósticos de VS Code", async () => {
    const fake = createFakeVSCode();
    const document = createDocument(
        "escribir fantasma"
    );
    let diagnostics = [{
        code:
            "CLRS_UNDEFINED_IDENTIFIER",
        message:
            "El identificador «fantasma» no está definido.",
        phase: "semantic",
        severity: "error",
        location: {
            startLine: 1,
            startColumn: 10,
            endLine: 1,
            endColumn: 17
        }
    }];
    const provider =
        new CLRSStaticDiagnosticsProvider({
            vscodeApi: fake.api,
            diagnosticsService: {
                diagnose() {
                    return diagnostics;
                }
            },
            languageId: "clrs-es",
            debounceMs: 0
        });

    provider.start();
    assert.equal(
        await provider.refresh(document),
        true
    );

    const published =
        fake.collection.get(
            document.uri
        );

    assert.equal(
        published.length,
        1
    );
    assert.equal(
        published[0].source,
        "CLRS"
    );
    assert.equal(
        published[0].code,
        "CLRS_UNDEFINED_IDENTIFIER"
    );
    assert.deepEqual(
        {
            start:
                published[0]
                    .range.start,
            end:
                published[0]
                    .range.end
        },
        {
            start: {
                line: 0,
                character: 9
            },
            end: {
                line: 0,
                character: 17
            }
        }
    );

    diagnostics = [];
    document.version += 1;
    fake.events.change({
        document
    });
    await waitForTimers();

    assert.deepEqual(
        fake.collection.get(
            document.uri
        ),
        []
    );

    fake.events.close(document);

    assert.equal(
        fake.collection.has(
            document.uri
        ),
        false
    );

    provider.dispose();
    provider.dispose();

    assert.equal(
        fake.collection.disposed,
        true
    );
    assert.ok(
        fake.eventDisposables
            .every(
                disposable =>
                    disposable.disposed
            )
    );
});

test("los resultados obsoletos no reemplazan el diagnóstico más reciente", async () => {
    const fake = createFakeVSCode();
    const document =
        createDocument("escribir viejo");
    let resolveFirst;
    let requestCount = 0;
    const firstResult =
        new Promise(resolve => {
            resolveFirst = resolve;
        });
    const provider =
        new CLRSStaticDiagnosticsProvider({
            vscodeApi: fake.api,
            diagnosticsService: {
                diagnose() {
                    requestCount += 1;

                    return requestCount === 1
                        ? firstResult
                        : [];
                }
            },
            languageId: "clrs-es"
        });

    const staleRefresh =
        provider.refresh(document);

    document.sourceCode =
        "dato <- 1";
    document.version += 1;

    await provider.refresh(document);

    resolveFirst([{
        code:
            "CLRS_UNDEFINED_IDENTIFIER",
        message: "Resultado anterior.",
        severity: "error",
        location: {
            startLine: 1,
            startColumn: 10,
            endLine: 1,
            endColumn: 14
        }
    }]);

    assert.equal(
        await staleRefresh,
        false
    );
    assert.deepEqual(
        fake.collection.get(
            document.uri
        ),
        []
    );

    provider.dispose();
});

test("los fallos internos se reservan para el log de desarrollo", async () => {
    const fake = createFakeVSCode();
    const developerMessages = [];
    const document =
        createDocument("dato <- 1");
    const provider =
        new CLRSStaticDiagnosticsProvider({
            vscodeApi: fake.api,
            diagnosticsService: {
                diagnose() {
                    throw new Error(
                        "Static analysis invariant failed."
                    );
                }
            },
            languageId: "clrs-es",
            developerLogger: {
                error(message) {
                    developerMessages.push(
                        message
                    );
                }
            }
        });

    assert.equal(
        await provider.refresh(document),
        false
    );
    assert.equal(
        fake.collection.has(
            document.uri
        ),
        false
    );
    assert.match(
        developerMessages[0],
        /Static analysis invariant failed/
    );

    provider.dispose();
});

function createDocument(sourceCode) {
    const uri = {
        value:
            "file:///programa.clrs",
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
    const handlers = {
        open: [],
        change: [],
        save: [],
        close: []
    };
    const eventDisposables = [];
    const register =
        eventName =>
            handler => {
                handlers[eventName]
                    .push(handler);
                const disposable = {
                    disposed: false,
                    dispose() {
                        disposable.disposed =
                            true;
                    }
                };

                eventDisposables.push(
                    disposable
                );

                return disposable;
            };
    const entries = new Map();
    const collection = {
        disposed: false,
        set(uri, diagnostics) {
            entries.set(
                uri.toString(),
                diagnostics
            );
        },
        get(uri) {
            return entries.get(
                uri.toString()
            );
        },
        has(uri) {
            return entries.has(
                uri.toString()
            );
        },
        delete(uri) {
            entries.delete(
                uri.toString()
            );
        },
        clear() {
            entries.clear();
        },
        dispose() {
            this.disposed = true;
            entries.clear();
        }
    };

    class Range {

        constructor(
            startLine,
            startCharacter,
            endLine,
            endCharacter
        ) {
            this.start = {
                line: startLine,
                character:
                    startCharacter
            };
            this.end = {
                line: endLine,
                character:
                    endCharacter
            };
        }
    }

    class Diagnostic {

        constructor(
            range,
            message,
            severity
        ) {
            this.range = range;
            this.message = message;
            this.severity = severity;
        }
    }

    return {
        collection,
        eventDisposables,
        events: {
            open:
                document =>
                    handlers.open
                        .forEach(
                            handler =>
                                handler(
                                    document
                                )
                        ),
            change:
                event =>
                    handlers.change
                        .forEach(
                            handler =>
                                handler(event)
                        ),
            save:
                document =>
                    handlers.save
                        .forEach(
                            handler =>
                                handler(
                                    document
                                )
                        ),
            close:
                document =>
                    handlers.close
                        .forEach(
                            handler =>
                                handler(
                                    document
                                )
                        )
        },
        api: {
            languages: {
                createDiagnosticCollection() {
                    return collection;
                }
            },
            workspace: {
                textDocuments: [],
                onDidOpenTextDocument:
                    register("open"),
                onDidChangeTextDocument:
                    register("change"),
                onDidSaveTextDocument:
                    register("save"),
                onDidCloseTextDocument:
                    register("close")
            },
            Diagnostic,
            DiagnosticSeverity: {
                Error: 0,
                Warning: 1,
                Information: 2,
                Hint: 3
            },
            Range
        }
    };
}

async function waitForTimers() {
    await new Promise(
        resolve =>
            setTimeout(resolve, 10)
    );
}
