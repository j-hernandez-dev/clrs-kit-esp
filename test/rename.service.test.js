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

const SOURCE = [
    "GLOBAL = 1",
    "CALCULA(valor)",
    "    total = valor + GLOBAL",
    "    total = total + 1",
    "    retornar total",
    "PRINCIPAL()",
    "    resultado = CALCULA(GLOBAL)"
].join("\n");

test("renombra declaración, escrituras y lecturas del mismo binding", () => {
    const snapshot = analyze(SOURCE);
    const service = new RenameService();
    const position = {
        line: 5,
        column: 14
    };
    const prepared =
        service.prepareRename({
            snapshot,
            position
        });
    const plan = service.planRename({
        snapshot,
        position,
        newName: "acumulado"
    });

    assert.equal(
        prepared.name,
        "total"
    );
    assert.deepEqual(
        prepared.location,
        {
            startLine: 5,
            startColumn: 14,
            endLine: 5,
            endColumn: 18
        }
    );
    assert.equal(plan.oldName, "total");
    assert.equal(
        plan.newName,
        "acumulado"
    );
    assert.deepEqual(
        plan.edits.map(edit => [
            edit.location.startLine,
            edit.location.startColumn,
            edit.newText
        ]),
        [
            [3, 5, "acumulado"],
            [4, 5, "acumulado"],
            [4, 13, "acumulado"],
            [5, 14, "acumulado"]
        ]
    );
});

test("renombra una función desde su llamada", () => {
    const snapshot = analyze(SOURCE);
    const plan =
        new RenameService()
            .planRename({
                snapshot,
                position: {
                    line: 7,
                    column: 18
                },
                newName: "COMPUTA"
            });

    assert.deepEqual(
        plan.edits.map(edit => [
            edit.location.startLine,
            edit.location.startColumn
        ]),
        [
            [2, 1],
            [7, 17]
        ]
    );
});

test("rechaza nombres inválidos, reservados y colisiones visibles", () => {
    const snapshot = analyze(SOURCE);
    const service = new RenameService();
    const totalPosition = {
        line: 5,
        column: 14
    };

    assertRenameError(
        () => service.planRename({
            snapshot,
            position: totalPosition,
            newName: "nuevo valor"
        }),
        "CLRS_RENAME_INVALID_IDENTIFIER"
    );
    assertRenameError(
        () => service.planRename({
            snapshot,
            position: totalPosition,
            newName: "si"
        }),
        "CLRS_RENAME_RESERVED_IDENTIFIER"
    );
    assertRenameError(
        () => service.planRename({
            snapshot,
            position: totalPosition,
            newName: "NULO"
        }),
        "CLRS_RENAME_RESERVED_IDENTIFIER"
    );
    assertRenameError(
        () => service.planRename({
            snapshot,
            position: totalPosition,
            newName: "valor"
        }),
        "CLRS_RENAME_COLLISION"
    );
    assertRenameError(
        () => service.planRename({
            snapshot,
            position: totalPosition,
            newName: "GLOBAL"
        }),
        "CLRS_RENAME_COLLISION"
    );
});

test("detecta capturas locales al renombrar un símbolo global", () => {
    const snapshot = analyze(SOURCE);

    assertRenameError(
        () => new RenameService()
            .planRename({
                snapshot,
                position: {
                    line: 1,
                    column: 1
                },
                newName: "resultado"
            }),
        "CLRS_RENAME_COLLISION"
    );
});

test("impide renombrar predefinidos o documentos inválidos", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    A[0] = 1",
        "    n = LONG(A)"
    ].join("\n");
    const service = new RenameService();

    assertRenameError(
        () => service.prepareRename({
            snapshot: analyze(sourceCode),
            position: {
                line: 3,
                column: 10
            }
        }),
        "CLRS_RENAME_BUILTIN"
    );
    assertRenameError(
        () => service.prepareRename({
            snapshot:
                analyze("PRINCIPAL("),
            position: {
                line: 1,
                column: 1
            }
        }),
        "CLRS_RENAME_INVALID_DOCUMENT"
    );
});

test("una función local que sustituye un nombre estándar sí es renombrable", () => {
    const sourceCode = [
        "LONG(x)",
        "    retornar x",
        "PRINCIPAL()",
        "    resultado = LONG(1)"
    ].join("\n");
    const plan =
        new RenameService()
            .planRename({
                snapshot:
                    analyze(sourceCode),
                position: {
                    line: 4,
                    column: 18
                },
                newName: "TAMANO"
            });

    assert.equal(plan.edits.length, 2);
});

test("renombra todas las referencias dentro de arreglos literales anidados", () => {
    const sourceCode = [
        "base = 2",
        "DUPLICA(valor)",
        "    retornar valor * 2",
        "PRINCIPAL()",
        "    datos = [base, DUPLICA(base), [base]]"
    ].join("\n");
    const plan = new RenameService()
        .planRename({
            snapshot: analyze(sourceCode),
            position: {
                line: 5,
                column: 29
            },
            newName: "origen"
        });

    assert.deepEqual(
        plan.edits.map(edit => [
            edit.location.startLine,
            edit.location.startColumn,
            edit.newText
        ]),
        [
            [1, 1, "origen"],
            [5, 14, "origen"],
            [5, 28, "origen"],
            [5, 36, "origen"]
        ]
    );
});

function analyze(sourceCode) {
    return new DocumentAnalysisService({
        languageDiagnosticsService:
            new LanguageDiagnosticsService(),
        analyzeCost() {
            return null;
        }
    }).analyze({
        key: "file:///rename.clrs",
        version: 1,
        sourceCode
    });
}

function assertRenameError(
    operation,
    code
) {
    assert.throws(
        operation,
        error => error.code === code
    );
}
