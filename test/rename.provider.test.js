import test from "node:test";
import assert from "node:assert/strict";

import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    RenameService
} from "../src/language/refactoring/RenameService.js";
import {
    CLRSRenameProvider
} from "../extension/providers/RenameProvider.js";

test("adapta preparación y ediciones de renombrado a VS Code", () => {
    const vscode = createFakeVSCode();
    const provider = createProvider(vscode);
    const document = createDocument([
        "PRINCIPAL()",
        "    dato = 1",
        "    dato = dato + 1",
        "    escribir dato"
    ].join("\n"));
    const position = {
        line: 3,
        character: 13
    };
    const prepared =
        provider.prepareRename(
            document,
            position
        );
    const workspaceEdit =
        provider.provideRenameEdits(
            document,
            position,
            "valor"
        );

    assert.equal(
        prepared.placeholder,
        "dato"
    );
    assert.deepEqual(
        prepared.range.start,
        { line: 3, character: 13 }
    );
    assert.deepEqual(
        workspaceEdit.edits.map(
            edit => [
                edit.range.start.line,
                edit.range.start.character,
                edit.newText
            ]
        ),
        [
            [1, 4, "valor"],
            [2, 4, "valor"],
            [2, 12, "valor"],
            [3, 13, "valor"]
        ]
    );

    provider.dispose();
    assert.equal(
        provider.prepareRename(
            document,
            position
        ),
        null
    );
});

test("presenta en español los rechazos esperados sin registrarlos como fallos internos", () => {
    const logs = [];
    const provider = createProvider(
        createFakeVSCode(),
        logs
    );
    const document = createDocument([
        "PRINCIPAL()",
        "    A[0] = 1",
        "    n = LONG(A)"
    ].join("\n"));

    assert.throws(
        () => provider.prepareRename(
            document,
            { line: 2, character: 10 }
        ),
        /predefinido/
    );
    assert.deepEqual(logs, []);
});

function createProvider(
    vscode,
    logs = []
) {
    return new CLRSRenameProvider({
        vscodeApi: vscode,
        documentAnalysisService:
            new DocumentAnalysisService({
                languageDiagnosticsService:
                    new LanguageDiagnosticsService(),
                analyzeCost() {
                    return null;
                }
            }),
        renameService: new RenameService(),
        languageId: "clrs-es",
        developerLogger: {
            error(value) {
                logs.push(value);
            }
        }
    });
}

function createDocument(sourceCode) {
    return {
        uri: {
            toString() {
                return "file:///rename.clrs";
            }
        },
        languageId: "clrs-es",
        version: 1,
        sourceCode,
        get lineCount() {
            return this.sourceCode
                .split("\n").length;
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

    class WorkspaceEdit {
        constructor() {
            this.edits = [];
        }

        replace(uri, range, newText) {
            this.edits.push({
                uri,
                range,
                newText
            });
        }
    }

    return {
        Range,
        WorkspaceEdit
    };
}
