import test from "node:test";
import assert from "node:assert/strict";

import {
    CLRSCorrectionExplanationPlanner,
    CLRSCorrectionSafety
} from "../src/language/corrections/index.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";

test("explica una variable no definida sin elegir su valor inicial", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    escribir total"
    ].join("\n");
    const plans = explainSource(
        sourceCode
    );

    assert.equal(plans.length, 1);
    assert.equal(
        plans[0].correctionId,
        "initialize-undefined-variable"
    );
    assert.equal(
        plans[0].title,
        "Explicar cómo inicializar «total»"
    );
    assert.match(
        plans[0].explanation.summary,
        /no puede elegir un valor inicial/u
    );
    assert.match(
        plans[0].explanation.guidance[2],
        /no siempre debe ser cero/u
    );
    assert.deepEqual(
        plans[0].edits,
        []
    );
});

test("distingue una función no definida y explica su declaración", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    resultado = CALCULA(10)"
    ].join("\n");
    const plans = explainSource(
        sourceCode
    );

    assert.equal(plans.length, 1);
    assert.equal(
        plans[0].correctionId,
        "create-undefined-function"
    );
    assert.equal(
        plans[0].title,
        "Explicar cómo crear «CALCULA»"
    );
    assert.match(
        plans[0].explanation.summary,
        /no determina por sí sola los parámetros/u
    );
    assert.deepEqual(
        plans[0].edits,
        []
    );
});

test("la clasificación depende del código y no del texto diagnóstico", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    dato = DESCONOCIDA ()"
    ].join("\n");
    const realDiagnostic =
        new LanguageDiagnosticsService()
            .diagnose(sourceCode)[0];
    const plans =
        new CLRSCorrectionExplanationPlanner()
            .planExplanatoryCorrections({
                sourceCode,
                diagnostic: {
                    ...realDiagnostic,
                    message:
                        "Mensaje deliberadamente diferente."
                }
            });

    assert.deepEqual(
        plans.map(
            plan => plan.correctionId
        ),
        ["create-undefined-function"]
    );
});

test("explica diferencias de aridad aportadas como evidencia estructural", () => {
    const planner =
        new CLRSCorrectionExplanationPlanner();
    const missing = planner
        .planExplanatoryCorrections({
            sourceCode: "SUMA(1)",
            diagnostic: {
                code:
                    "CLRS_FUNCTION_ARITY_MISMATCH",
                phase: "semantic",
                location: location(1, 1),
                data: {
                    arityRelation: "missing",
                    expectedArity: 2,
                    actualArity: 1
                }
            }
        });
    const extra = planner
        .planExplanatoryCorrections({
            sourceCode: "SUMA(1, 2, 3)",
            diagnostic: {
                code:
                    "CLRS_FUNCTION_ARITY_MISMATCH",
                phase: "semantic",
                location: location(1, 1),
                data: {
                    arityRelation: "extra",
                    expectedArity: 2,
                    actualArity: 3
                }
            }
        });

    assert.equal(
        missing[0].correctionId,
        "add-missing-arguments"
    );
    assert.match(
        missing[0].explanation.summary,
        /2 parámetros.*1 argumento/u
    );
    assert.equal(
        extra[0].correctionId,
        "remove-extra-arguments"
    );
    assert.match(
        extra[0].explanation.summary,
        /2 parámetros.*3 argumentos/u
    );
});

test("explica una rama inaccesible únicamente con prueba estructural", () => {
    const planner =
        new CLRSCorrectionExplanationPlanner();
    const diagnostic = {
        code: "CLRS_UNREACHABLE_BRANCH",
        phase: "semantic",
        location: location(3, 5)
    };

    assert.deepEqual(
        planner.planExplanatoryCorrections({
            sourceCode: "",
            diagnostic
        }),
        []
    );

    const plans = planner
        .planExplanatoryCorrections({
            sourceCode: "",
            diagnostic,
            evidence: {
                reachability:
                    "proven-unreachable"
            }
        });

    assert.equal(
        plans[0].correctionId,
        "delete-unreachable-branch"
    );
    assert.match(
        plans[0].explanation.summary,
        /decisión irreversible/u
    );
});

test("no duplica la acción segura de igualdad como explicación", () => {
    const plans =
        new CLRSCorrectionExplanationPlanner()
            .planExplanatoryCorrections({
                sourceCode: [
                    "PRINCIPAL()",
                    "    si dato = 1",
                    "        escribir dato"
                ].join("\n"),
                diagnostic: {
                    code:
                        "CLRS_PARSER_ERROR",
                    phase: "parser",
                    location: location(2, 5)
                },
                evidence: {
                    syntaxKind:
                        "assignment-in-condition"
                }
            });

    assert.deepEqual(plans, []);
});

test("los planes explicativos son inmutables y nunca son preferentes", () => {
    const plans = explainSource([
        "PRINCIPAL()",
        "    escribir dato"
    ].join("\n"));

    assert.equal(
        Object.isFrozen(plans),
        true
    );
    assert.equal(
        Object.isFrozen(plans[0]),
        true
    );
    assert.equal(
        Object.isFrozen(
            plans[0].explanation
                .guidance
        ),
        true
    );
    assert.equal(
        plans[0].preferred,
        false
    );
    assert.equal(
        plans[0].safety,
        CLRSCorrectionSafety
            .EXPLANATION_ONLY
    );
});

function explainSource(sourceCode) {
    const diagnostics =
        new LanguageDiagnosticsService()
            .diagnose(sourceCode);

    return new CLRSCorrectionExplanationPlanner()
        .planExplanatoryCorrections({
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
