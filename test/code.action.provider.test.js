import test from "node:test";
import assert from "node:assert/strict";

import {
    CLRSCorrectionExplanationPlanner,
    CLRSCorrectionPlanner
} from "../src/language/corrections/index.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    CLRSCodeActionProvider,
    CLRS_EXPLAIN_CORRECTION_COMMAND
} from "../extension/providers/CodeActionProvider.js";

test("convierte una corrección segura en WorkspaceEdit nativo", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    edad = 18",
        "    si edad = 18",
        "        escribir edad"
    ].join("\n");
    const fixture = createFixture(
        sourceCode
    );
    const diagnostics = [{
        code: "CLRS_PARSER_ERROR"
    }];
    const actions = fixture.provider
        .provideCodeActions(
            fixture.document,
            new fixture.vscode.Range(
                2,
                12,
                2,
                13
            ),
            { diagnostics }
        );

    assert.equal(actions.length, 1);
    assert.equal(
        actions[0].title,
        "Cambiar «=» por «==» en esta condición"
    );
    assert.equal(
        actions[0].isPreferred,
        true
    );
    assert.deepEqual(
        actions[0].diagnostics,
        diagnostics
    );
    assert.deepEqual(
        actions[0].edit.entries(),
        [[
            fixture.document.uri,
            [{
                range: new fixture.vscode.Range(
                    2,
                    12,
                    2,
                    13
                ),
                newText: "=="
            }]
        ]]
    );
});

test("publica una explicación como comando sin editar el documento", async () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    escribir total"
    ].join("\n");
    const fixture = createFixture(
        sourceCode
    );
    const actions = fixture.provider
        .provideCodeActions(
            fixture.document,
            new fixture.vscode.Range(
                1,
                13,
                1,
                18
            ),
            {
                diagnostics: [{
                    code:
                        "CLRS_UNDEFINED_IDENTIFIER"
                }]
            }
        );

    assert.equal(actions.length, 1);
    assert.equal(actions[0].edit, undefined);
    assert.equal(
        actions[0].isPreferred,
        false
    );
    assert.equal(
        actions[0].command.command,
        CLRS_EXPLAIN_CORRECTION_COMMAND
    );

    assert.equal(
        await fixture.provider
            .presentExplanation(
                actions[0].command
                    .arguments[0]
            ),
        true
    );
    assert.equal(
        fixture.messages.length,
        1
    );
    assert.equal(
        fixture.messages[0].options
            .modal,
        true
    );
    assert.match(
        fixture.messages[0].options
            .detail,
        /Qué puedes revisar:\n1\./u
    );
});

test("filtra acciones ajenas al rango solicitado", () => {
    const fixture = createFixture([
        "PRINCIPAL()",
        "    escribir total"
    ].join("\n"));

    assert.deepEqual(
        fixture.provider
            .provideCodeActions(
                fixture.document,
                new fixture.vscode.Range(
                    0,
                    0,
                    0,
                    1
                ),
                { diagnostics: [] }
            ),
        []
    );
});

test("respeta cancelación, lenguaje y liberación del proveedor", () => {
    const fixture = createFixture([
        "PRINCIPAL()",
        "    escribir total"
    ].join("\n"));
    const range = new fixture.vscode.Range(
        1,
        13,
        1,
        18
    );

    assert.deepEqual(
        fixture.provider
            .provideCodeActions(
                fixture.document,
                range,
                {},
                {
                    isCancellationRequested:
                        true
                }
            ),
        []
    );

    fixture.document.languageId =
        "plaintext";
    assert.deepEqual(
        fixture.provider
            .provideCodeActions(
                fixture.document,
                range,
                {}
            ),
        []
    );

    fixture.document.languageId =
        "clrs-es";
    fixture.provider.dispose();
    assert.deepEqual(
        fixture.provider
            .provideCodeActions(
                fixture.document,
                range,
                {}
            ),
        []
    );
});

function createFixture(sourceCode) {
    const messages = [];
    const vscode = createFakeVSCode(
        messages
    );
    const document = createDocument(
        sourceCode
    );
    const diagnosticsService =
        new LanguageDiagnosticsService();
    const provider =
        new CLRSCodeActionProvider({
            vscodeApi: vscode,
            documentAnalysisService: {
                analyzeDocument(current) {
                    return {
                        diagnostics:
                            diagnosticsService
                                .diagnose(
                                    current
                                        .getText()
                                )
                    };
                }
            },
            correctionPlanner:
                new CLRSCorrectionPlanner(),
            explanationPlanner:
                new CLRSCorrectionExplanationPlanner(),
            languageId: "clrs-es"
        });

    return {
        vscode,
        document,
        provider,
        messages
    };
}

function createFakeVSCode(messages) {
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

    class WorkspaceEdit {
        constructor() {
            this.changes = new Map();
        }

        replace(uri, range, newText) {
            const edits =
                this.changes.get(uri) ?? [];

            edits.push({ range, newText });
            this.changes.set(uri, edits);
        }

        entries() {
            return [...this.changes];
        }
    }

    class CodeAction {
        constructor(title, kind) {
            this.title = title;
            this.kind = kind;
        }
    }

    return {
        Range,
        WorkspaceEdit,
        CodeAction,
        CodeActionKind: {
            QuickFix: "quickfix"
        },
        window: {
            async showInformationMessage(
                title,
                options
            ) {
                messages.push({
                    title,
                    options
                });
            }
        }
    };
}

function createDocument(sourceCode) {
    const lines = sourceCode.split("\n");

    return {
        uri: {
            toString() {
                return "file:///acciones.clrs";
            }
        },
        languageId: "clrs-es",
        version: 1,
        lineCount: lines.length,
        getText() {
            return sourceCode;
        },
        lineAt(line) {
            return {
                text: lines[line] ?? ""
            };
        }
    };
}
