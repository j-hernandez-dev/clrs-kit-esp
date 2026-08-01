import test from "node:test";
import assert from "node:assert/strict";

import { NodeTypes } from "../src/ast/core/NodeTypes.js";
import { ASTFactory } from "../src/ast/utils/ASTFactory.js";
import {
    inspectAST,
    validateAST
} from "../src/ast/validation/ASTValidator.js";
import {
    ASTValidationError
} from "../src/ast/validation/ASTValidationError.js";
import { parseSource } from "../src/language/LanguageFrontend.js";

const location = Object.freeze({
    startLine: 1,
    startColumn: 1,
    endLine: 1,
    endColumn: 1
});

test("un AST producido por el frontend satisface el contrato", () => {
    const { ast } = parseSource([
        "SUMA(a, b[])",
        "    retornar a + b[0]",
        "",
        "PRINCIPAL()",
        "    valores[0] <- 2",
        "    escribir SUMA(1, valores)"
    ].join("\n"));

    assert.equal(validateAST(ast), ast);
    assert.deepEqual(inspectAST(ast), {
        valid: true,
        diagnostics: []
    });
});

test("Program requiere un arreglo de instrucciones", () => {
    assert.throws(
        () => validateAST({
            type: NodeTypes.PROGRAM,
            location: null
        }),
        error => {
            assert.ok(error instanceof ASTValidationError);
            assert.equal(error.phase, "ast-validation");
            assert.equal(error.code, "CLRS_INVALID_AST");
            assert.equal(
                error.diagnostics[0].code,
                "CLRS_AST_ARRAY_REQUIRED"
            );
            assert.equal(
                error.diagnostics[0].path,
                "$.statements"
            );

            return true;
        }
    );
});

test("una asignación sin expresión derecha es inválida", () => {
    const ast = {
        type: NodeTypes.PROGRAM,
        location: null,
        statements: [{
            type: NodeTypes.ASSIGNMENT,
            location,
            left: identifier("resultado"),
            right: null
        }]
    };

    const report = inspectAST(ast);

    assert.equal(report.valid, false);
    assert.equal(
        report.diagnostics[0].code,
        "CLRS_AST_EXPRESSION_REQUIRED"
    );
    assert.equal(
        report.diagnostics[0].path,
        "$.statements[0].right"
    );
});

test("una función requiere identificador, parámetros y cuerpo Block", () => {
    const ast = program([{
        type: NodeTypes.FUNCTION_DECLARATION,
        location,
        identifier: identifier("VACIA"),
        parameters: [],
        body: null
    }]);

    assert.throws(
        () => validateAST(ast),
        error => {
            assert.ok(error instanceof ASTValidationError);
            assert.ok(
                error.diagnostics.some(diagnostic =>
                    diagnostic.path === "$.statements[0].body" &&
                    diagnostic.code === "CLRS_AST_UNEXPECTED_NODE"
                )
            );

            return true;
        }
    );
});

test("un tipo desconocido genera un diagnóstico localizable", () => {
    const report = inspectAST(
        program([{
            type: "NodoInventado",
            location
        }])
    );

    assert.equal(report.valid, false);
    assert.ok(
        report.diagnostics.some(diagnostic =>
            diagnostic.code === "CLRS_AST_UNKNOWN_NODE" &&
            diagnostic.path === "$.statements[0]"
        )
    );
});

test("las ubicaciones no pueden terminar antes de comenzar", () => {
    const ast = {
        type: NodeTypes.PROGRAM,
        statements: [],
        location: {
            startLine: 4,
            startColumn: 8,
            endLine: 3,
            endColumn: 1
        }
    };

    const report = inspectAST(ast);

    assert.equal(report.valid, false);
    assert.equal(
        report.diagnostics[0].code,
        "CLRS_AST_REVERSED_LOCATION"
    );
    assert.equal(
        report.diagnostics[0].path,
        "$.location"
    );
});

test("la fábrica construye declaraciones de arreglo con el contrato correcto", () => {
    const declaration = ASTFactory.arrayDeclaration(
        identifier("datos"),
        [numberLiteral(10)],
        "Numero",
        location
    );
    const ast = program([declaration]);

    assert.equal(declaration.type, NodeTypes.ARRAY_DECLARATION);
    assert.equal(declaration.dataType, "Numero");
    assert.deepEqual(declaration.location, location);
    assert.equal(validateAST(ast), ast);
});

function program(statements) {
    return {
        type: NodeTypes.PROGRAM,
        statements,
        location
    };
}

function identifier(name) {
    return {
        type: NodeTypes.IDENTIFIER,
        name,
        location
    };
}

function numberLiteral(value) {
    return {
        type: NodeTypes.NUMBER_LITERAL,
        value,
        location
    };
}
