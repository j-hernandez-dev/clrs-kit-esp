import test from "node:test";
import assert from "node:assert/strict";

import {
    CLRSCorrectionPlanner
} from "../src/language/corrections/index.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    tryParseSource
} from "../src/language/LanguageFrontend.js";

test("cambia la asignación inequívoca de una condición por igualdad", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    edad = 18",
        "    si edad = 18",
        "        escribir edad"
    ].join("\n");
    const plans = plan(sourceCode);

    assert.equal(plans.length, 1);
    assert.equal(
        plans[0].correctionId,
        "replace-assignment-with-equality"
    );
    assert.equal(
        plans[0].preferred,
        true
    );
    assert.deepEqual(
        plans[0].edits,
        [{
            location: {
                startLine: 3,
                startColumn: 13,
                endLine: 3,
                endColumn: 13
            },
            newText: "=="
        }]
    );

    const corrected = applyPlan(
        sourceCode,
        plans[0]
    );

    assert.equal(
        corrected.split("\n")[2],
        "    si edad == 18"
    );
    assert.equal(
        tryParseSource(corrected).ok,
        true
    );
});

test("corrige conjuntamente varias asignaciones de la misma condición", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    a = 1",
        "    b = 2",
        "    mientras a = 1 y b = 2",
        "        a = a + 1"
    ].join("\n");
    const plans = plan(sourceCode);

    assert.equal(plans.length, 1);
    assert.deepEqual(
        plans[0].edits.map(
            edit => [
                edit.location.startColumn,
                edit.newText
            ]
        ),
        [
            [16, "=="],
            [24, "=="]
        ]
    );
    assert.equal(
        applyPlan(
            sourceCode,
            plans[0]
        ).split("\n")[3],
        "    mientras a == 1 y b == 2"
    );
});

test("admite condiciones de sino si y conserva cadenas y comentarios", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    valor = 1",
        "    si valor == 0",
        "        escribir \"=\"",
        "    sino si valor = 1  // comparar",
        "        escribir valor"
    ].join("\n");
    const plans = plan(sourceCode);

    assert.equal(plans.length, 1);
    assert.deepEqual(
        plans[0].targetLocation,
        {
            startLine: 5,
            startColumn: 19,
            endLine: 5,
            endColumn: 19
        }
    );
});

test("no altera asignaciones válidas ni inicializadores para", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    total = 0",
        "    para i = 1 hasta 3",
        "        total = total + i"
    ].join("\n");
    const diagnostics = [{
        code: "CLRS_PARSER_ERROR",
        phase: "parser",
        location: location(3, 5)
    }];

    assert.deepEqual(
        new CLRSCorrectionPlanner()
            .planInequivocalCorrections({
                sourceCode,
                diagnostics
            }),
        []
    );
});

test("rechaza condiciones incompletas aunque contengan el operador", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    si valor =",
        "        escribir valor"
    ].join("\n");

    assert.deepEqual(plan(sourceCode), []);
});

test("no actúa sin el código, fase y ubicación diagnóstica correspondientes", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    si valor = 1",
        "        escribir valor"
    ].join("\n");
    const planner =
        new CLRSCorrectionPlanner();

    assert.deepEqual(
        planner.planInequivocalCorrections({
            sourceCode,
            diagnostic: {
                code:
                    "CLRS_UNDEFINED_IDENTIFIER",
                phase: "semantic",
                location: location(2, 5)
            }
        }),
        []
    );
    assert.deepEqual(
        planner.planInequivocalCorrections({
            sourceCode,
            diagnostic: {
                code: {
                    value:
                        "CLRS_PARSER_ERROR"
                },
                phase: "semantic",
                location: location(2, 5)
            }
        }),
        []
    );
    assert.deepEqual(
        planner.planInequivocalCorrections({
            sourceCode,
            diagnostic: {
                code:
                    "CLRS_PARSER_ERROR",
                phase: "parser"
            }
        }),
        []
    );
});

test("el plan y todas sus ediciones permanecen inmutables", () => {
    const result = plan([
        "PRINCIPAL()",
        "    si dato = 1",
        "        escribir dato"
    ].join("\n"));

    assert.equal(
        Object.isFrozen(result),
        true
    );
    assert.equal(
        Object.isFrozen(result[0]),
        true
    );
    assert.equal(
        Object.isFrozen(
            result[0].edits
        ),
        true
    );
    assert.equal(
        Object.isFrozen(
            result[0].edits[0]
                .location
        ),
        true
    );
});

function plan(sourceCode) {
    const diagnostics =
        new LanguageDiagnosticsService()
            .diagnose(sourceCode);

    return new CLRSCorrectionPlanner()
        .planInequivocalCorrections({
            sourceCode,
            diagnostics
        });
}

function location(line, column) {
    return {
        startLine: line,
        startColumn: column,
        endLine: line,
        endColumn: column
    };
}

function applyPlan(sourceCode, plan) {
    const lines = sourceCode.split("\n");
    const edits = [...plan.edits].sort(
        (left, right) =>
            right.location.startLine -
                left.location.startLine ||
            right.location.startColumn -
                left.location.startColumn
    );

    for (const edit of edits) {
        const lineIndex =
            edit.location.startLine - 1;
        const line = lines[lineIndex];
        const start =
            edit.location.startColumn - 1;
        const end =
            edit.location.endColumn;

        lines[lineIndex] =
            line.slice(0, start) +
            edit.newText +
            line.slice(end);
    }

    return lines.join("\n");
}
