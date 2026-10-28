import test from "node:test";
import assert from "node:assert/strict";

import {
    VSCodeClrsDocumentResolver
} from "../extension/adapters/VSCodeClrsDocumentResolver.js";
import {
    VSCodeCodeHost
} from "../extension/adapters/VSCodeCodeHost.js";
import {
    CodeCommandController
} from "../extension/controllers/CodeCommandController.js";

test("conserva el último editor CLRS cuando el Walkthrough ocupa el editor", () => {
    const listeners = [];
    const document = {
        languageId: "clrs-es",
        isClosed: false
    };
    const editor = { document };
    const vscode = {
        window: {
            activeTextEditor: editor,
            onDidChangeActiveTextEditor(listener) {
                listeners.push(listener);
                return disposable();
            }
        },
        workspace: {
            onDidCloseTextDocument() {
                return disposable();
            }
        }
    };
    const resolver =
        new VSCodeClrsDocumentResolver(
            vscode,
            "clrs-es"
        );

    vscode.window.activeTextEditor = undefined;
    listeners[0](undefined);

    assert.equal(resolver.getEditor(), editor);
    assert.equal(
        resolver.getDocument(),
        document
    );

    resolver.dispose();
});

test("no recupera un documento CLRS si hay otro lenguaje activo", () => {
    const listeners = [];
    const vscode = {
        window: {
            activeTextEditor: {
                document: {
                    languageId: "clrs-es",
                    isClosed: false
                }
            },
            onDidChangeActiveTextEditor(listener) {
                listeners.push(listener);
                return disposable();
            }
        },
        workspace: {
            onDidCloseTextDocument() {
                return disposable();
            }
        }
    };
    const resolver =
        new VSCodeClrsDocumentResolver(
            vscode,
            "clrs-es"
        );
    const javascriptEditor = {
        document: {
            languageId: "javascript",
            isClosed: false
        }
    };

    vscode.window.activeTextEditor =
        javascriptEditor;
    listeners[0](javascriptEditor);

    assert.equal(resolver.getEditor(), null);

    resolver.dispose();
});

test("actualiza la ruta después de guardar un documento Untitled", async () => {
    const listeners = [];
    const savedDocument = {
        languageId: "clrs-es",
        isClosed: false,
        isUntitled: false,
        version: 2,
        uri: {
            fsPath: "C:\\proyecto\\programa.clrs"
        },
        getText: () => "PRINCIPAL()",
        save: async () => true
    };
    const vscode = {
        window: {
            activeTextEditor: null,
            terminals: [],
            onDidChangeActiveTextEditor(listener) {
                listeners.push(listener);
                return disposable();
            },
            async showTextDocument(document) {
                const editor = { document };

                this.activeTextEditor = editor;
                listeners[0](editor);
                return editor;
            }
        },
        workspace: {
            onDidCloseTextDocument() {
                return disposable();
            }
        }
    };
    const untitledDocument = {
        languageId: "clrs-es",
        isClosed: false,
        isUntitled: true,
        version: 1,
        uri: { fsPath: "Untitled-1" },
        getText: () => "PRINCIPAL()",
        async save() {
            const editor = {
                document: savedDocument
            };

            vscode.window.activeTextEditor =
                editor;
            listeners[0](editor);
            return true;
        }
    };
    const initialEditor = {
        document: untitledDocument
    };

    vscode.window.activeTextEditor =
        initialEditor;
    const resolver =
        new VSCodeClrsDocumentResolver(
            vscode,
            "clrs-es"
        );
    vscode.window.activeTextEditor = undefined;
    listeners[0](undefined);
    const host = new VSCodeCodeHost(
        vscode,
        {
            terminalName: "CLRS",
            outputChannelName: "CLRS"
        },
        { documentResolver: resolver }
    );
    const document = host.getActiveDocument();

    await document.save();

    assert.equal(
        document.filePath,
        "C:\\proyecto\\programa.clrs"
    );
    assert.equal(document.version, 2);

    host.dispose();
    resolver.dispose();
});

test("cancelar Guardar como no ejecuta una ruta Untitled", async () => {
    let executions = 0;
    const controller =
        new CodeCommandController({
            host: {
                getActiveDocument() {
                    return {
                        filePath: "Untitled-1",
                        version: 1,
                        save: async () => false
                    };
                },
                getWorkspaceRoot: () => null,
                runCli() {
                    executions += 1;
                },
                stopExecution: () => false,
                writeClipboard: async () => {},
                showGeneratedPath() {}
            },
            presenter: {
                present() {},
                info() {}
            },
            generateJavaScriptUseCase: {
                execute: async () => ({ ok: true })
            },
            path: {
                join: (...parts) =>
                    parts.join("/"),
                basename: value => value
            }
        });

    const result = await controller
        .runProgram("C:\\extension");

    assert.equal(result.ok, true);
    assert.equal(result.value.cancelled, true);
    assert.equal(executions, 0);
});

function disposable() {
    return { dispose() {} };
}
