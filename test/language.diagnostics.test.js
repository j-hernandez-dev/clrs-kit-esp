import test from "node:test";
import assert from "node:assert/strict";

import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";

test("un programa válido conserva el frontend y el modelo semántico", () => {
    const service =
        new LanguageDiagnosticsService();
    const result = service.analyze([
        "PRINCIPAL()",
        "    dato <- 1",
        "    escribir dato"
    ].join("\n"));

    assert.equal(result.ok, true);
    assert.deepEqual(
        result.diagnostics,
        []
    );
    assert.equal(
        result.frontend.ast.type,
        "Program"
    );
    assert.ok(result.semanticModel);
});

test("los errores léxicos se normalizan sin depender de VS Code", () => {
    const service =
        new LanguageDiagnosticsService();
    const diagnostics =
        service.diagnose(
            "dato <- @"
        );

    assert.equal(diagnostics.length, 1);
    assert.deepEqual(
        diagnostics[0],
        {
            code:
                "CLRS_LEXICAL_ERROR",
            message:
                "Carácter no reconocido: «@».",
            phase: "lexer",
            severity: "error",
            location: {
                startLine: 1,
                startColumn: 9,
                endLine: 1,
                endColumn: 9
            }
        }
    );
    assert.equal(
        Object.isFrozen(
            diagnostics[0]
        ),
        true
    );
});

test("los diagnósticos sintácticos conservan los mensajes en español", () => {
    const diagnostics =
        new LanguageDiagnosticsService()
            .diagnose(
                "escribir ,"
            );

    assert.ok(
        diagnostics.length > 0
    );
    assert.equal(
        diagnostics[0].code,
        "CLRS_PARSER_ERROR"
    );
    assert.equal(
        diagnostics[0].phase,
        "parser"
    );
    assert.doesNotMatch(
        diagnostics[0].message,
        /Expecting|but found/
    );
});

test("todos los errores semánticos se publican con código y ubicación", () => {
    const diagnostics =
        new LanguageDiagnosticsService()
            .diagnose(
                "escribir uno, dos"
            );

    assert.deepEqual(
        diagnostics.map(
            diagnostic =>
                diagnostic.code
        ),
        [
            "CLRS_UNDEFINED_IDENTIFIER",
            "CLRS_UNDEFINED_IDENTIFIER"
        ]
    );
    assert.deepEqual(
        diagnostics.map(
            diagnostic =>
                diagnostic.location
                    .startColumn
        ),
        [10, 15]
    );
    assert.match(
        diagnostics[0].message,
        /«uno» no está definido/
    );
    assert.match(
        diagnostics[1].message,
        /«dos» no está definido/
    );
});

test("un fallo de implementación no se presenta como error del usuario", () => {
    const service =
        new LanguageDiagnosticsService({
            parseSource() {
                throw new Error(
                    "Parser implementation failed."
                );
            }
        });

    assert.throws(
        () => service.diagnose("dato <- 1"),
        /Parser implementation failed/
    );
});
