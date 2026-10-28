import test from "node:test";
import assert from "node:assert/strict";

import {
    CLRSCorrectionDiagnosticCode,
    CLRSCorrectionSafety,
    CLRSCorrectionStrategy,
    getCLRSCorrectionDefinition,
    isCLRSCorrectionSafe,
    listCLRSCorrectionDefinitions,
    listCLRSCorrectionsForDiagnosticCode,
    resolveCLRSCorrectionDefinitions
} from "../src/language/corrections/index.js";

test("cataloga las correcciones previstas con identidad estable", () => {
    const definitions =
        listCLRSCorrectionDefinitions();
    const identifiers = definitions.map(
        definition => definition.id
    );

    assert.deepEqual(
        identifiers,
        [
            "replace-assignment-with-equality",
            "initialize-undefined-variable",
            "create-undefined-function",
            "add-missing-arguments",
            "remove-extra-arguments",
            "delete-unreachable-branch",
            "change-loop-bound",
            "capture-function-result"
        ]
    );
    assert.equal(
        new Set(identifiers).size,
        definitions.length
    );
    assert.equal(
        Object.isFrozen(definitions),
        true
    );
    assert.equal(
        Object.isFrozen(
            definitions[0]
                .requirements.syntaxKind
        ),
        true
    );
});

test("permite consultar por identidad y por código diagnóstico", () => {
    const createFunction =
        getCLRSCorrectionDefinition(
            "create-undefined-function"
        );
    const undefinedCorrections =
        listCLRSCorrectionsForDiagnosticCode(
            CLRSCorrectionDiagnosticCode
                .UNDEFINED_IDENTIFIER
        );

    assert.equal(
        createFunction.strategy,
        CLRSCorrectionStrategy
            .CREATE_FUNCTION
    );
    assert.deepEqual(
        undefinedCorrections.map(
            definition => definition.id
        ),
        [
            "initialize-undefined-variable",
            "create-undefined-function"
        ]
    );
    assert.equal(
        Object.isFrozen(
            undefinedCorrections
        ),
        true
    );
    assert.equal(
        getCLRSCorrectionDefinition(
            "unknown"
        ),
        null
    );
});

test("distingue una variable no definida de una llamada no definida", () => {
    const diagnostic = {
        code:
            "CLRS_UNDEFINED_IDENTIFIER",
        phase: "semantic",
        message:
            "Este texto no participa en la selección."
    };

    assert.deepEqual(
        resolveCLRSCorrectionDefinitions(
            diagnostic,
            {
                referenceKind:
                    "variable-read"
            }
        ).map(definition => definition.id),
        ["initialize-undefined-variable"]
    );
    assert.deepEqual(
        resolveCLRSCorrectionDefinitions(
            diagnostic,
            {
                referenceKind:
                    "function-call"
            }
        ).map(definition => definition.id),
        ["create-undefined-function"]
    );
});

test("no propone cambios para diagnósticos generales sin evidencia estructural", () => {
    const diagnostic = {
        code: {
            value: "CLRS_PARSER_ERROR"
        },
        phase: "parser",
        message:
            "Unexpected token = in condition."
    };

    assert.deepEqual(
        resolveCLRSCorrectionDefinitions(
            diagnostic
        ),
        []
    );
    assert.deepEqual(
        resolveCLRSCorrectionDefinitions(
            diagnostic,
            {
                syntaxKind:
                    "assignment-in-condition"
            }
        ).map(definition => definition.id),
        [
            "replace-assignment-with-equality"
        ]
    );
});

test("separa correcciones seguras de transformaciones que requieren revisión", () => {
    const equality =
        getCLRSCorrectionDefinition(
            "replace-assignment-with-equality"
        );
    const initialize =
        getCLRSCorrectionDefinition(
            "initialize-undefined-variable"
        );

    assert.equal(
        equality.safety,
        CLRSCorrectionSafety.SAFE
    );
    assert.equal(
        equality.preferred,
        true
    );
    assert.equal(
        isCLRSCorrectionSafe(equality),
        true
    );
    assert.equal(
        initialize.safety,
        CLRSCorrectionSafety
            .REQUIRES_REVIEW
    );
    assert.equal(
        initialize.preferred,
        false
    );
    assert.equal(
        isCLRSCorrectionSafe(
            initialize.id
        ),
        false
    );
});

test("diferencia argumentos faltantes y sobrantes con evidencia de aridad", () => {
    const diagnostic = {
        code:
            "CLRS_FUNCTION_ARITY_MISMATCH",
        phase: "semantic"
    };

    assert.deepEqual(
        resolveCLRSCorrectionDefinitions(
            diagnostic,
            { arityRelation: "missing" }
        ).map(definition => definition.id),
        ["add-missing-arguments"]
    );
    assert.deepEqual(
        resolveCLRSCorrectionDefinitions(
            diagnostic,
            { arityRelation: "extra" }
        ).map(definition => definition.id),
        ["remove-extra-arguments"]
    );
    assert.deepEqual(
        resolveCLRSCorrectionDefinitions(
            {
                ...diagnostic,
                phase: "runtime"
            },
            { arityRelation: "missing" }
        ),
        []
    );
});
