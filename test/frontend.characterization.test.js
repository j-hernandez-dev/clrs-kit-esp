import test from "node:test";
import assert from "node:assert/strict";

import {
    parseSource,
    tokenizeSource,
    tryParseSource
} from "../src/language/LanguageFrontend.js";
import {
    FrontendInputError,
    IndentationError,
    LexicalError,
    ParserError
} from "../src/errors/FrontendErrors.js";
import { getAST } from "../src/compiler/BrowserPipeline.js";
import {
    parserCode as parseNodeTokens,
    tokenizeCode as tokenizeNodeCode
} from "../src/compiler/Pipeline.js";

test("la indentación se caracteriza mediante tokens Indent y Dedent", () => {
    const tokens = tokenizeSource([
        "PRINCIPAL()",
        "    escribir \"hola\"",
        "escribir \"fin\""
    ].join("\n"));

    const tokenNames = tokens.map(token => token.tokenType.name);

    assert.deepEqual(tokenNames, [
        "Identifier",
        "LParen",
        "RParen",
        "Indent",
        "Print",
        "StringLiteral",
        "Dedent",
        "Print",
        "StringLiteral"
    ]);
    assert.equal(tokenNames.includes("NewLine"), false);
});

test("tabulaciones y espacios visualmente equivalentes comparten nivel", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "\tescribir 1",
        "    escribir 2"
    ].join("\n");
    const tokens =
        tokenizeSource(sourceCode);
    const tokenNames =
        tokens.map(
            token =>
                token.tokenType.name
        );
    const ast =
        parseSource(sourceCode).ast;

    assert.equal(
        tokenNames.filter(
            name => name === "Indent"
        ).length,
        1
    );
    assert.equal(
        tokenNames.filter(
            name => name === "Dedent"
        ).length,
        1
    );
    assert.equal(
        ast.statements[0]
            .body.statements.length,
        2
    );
});

test("la sangría de continuación no crea bloques dentro de paréntesis o corchetes", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    resultado <- (",
        "        1 + 2",
        "    )",
        "    A[",
        "        0",
        "    ] <- resultado"
    ].join("\n");
    const tokens =
        tokenizeSource(sourceCode);
    const tokenNames =
        tokens.map(
            token =>
                token.tokenType.name
        );
    const statements =
        parseSource(sourceCode)
            .ast.statements[0]
            .body.statements;

    assert.equal(
        tokenNames.filter(
            name => name === "Indent"
        ).length,
        1
    );
    assert.equal(
        tokenNames.filter(
            name => name === "Dedent"
        ).length,
        1
    );
    assert.equal(
        statements[0].right.type,
        "GroupExpression"
    );
    assert.equal(
        statements[1].left.type,
        "Access"
    );
});

test("el AST conserva la precedencia de multiplicación sobre suma", () => {
    const { ast } = parseSource("resultado <- 2 + 3 * 4");
    const assignment = ast.statements[0];

    assert.equal(ast.type, "Program");
    assert.equal(assignment.type, "Assignment");
    assert.equal(assignment.right.type, "BinaryExpression");
    assert.equal(assignment.right.operator, "+");
    assert.equal(assignment.right.left.value, 2);
    assert.equal(assignment.right.right.type, "BinaryExpression");
    assert.equal(assignment.right.right.operator, "*");
    assert.equal(assignment.right.right.left.value, 3);
    assert.equal(assignment.right.right.right.value, 4);
});

test("funciones y control de flujo conservan su forma y ubicación", () => {
    const sourceCode = [
        "SUMA(a, b)",
        "    retornar a + b",
        "",
        "PRINCIPAL()",
        "    resultado <- SUMA(2, 3)",
        "    si resultado > 4",
        "        escribir resultado",
        "    sino",
        "        escribir 0"
    ].join("\n");

    const { ast } = parseSource(sourceCode);
    const [sum, main] = ast.statements;
    const conditional = main.body.statements[1];

    assert.equal(sum.type, "FunctionDeclaration");
    assert.equal(sum.identifier.name, "SUMA");
    assert.equal(sum.parameters.length, 2);
    assert.equal(sum.body.statements[0].type, "ReturnStatement");
    assert.equal(sum.location.startLine, 1);

    assert.equal(main.identifier.name, "PRINCIPAL");
    assert.equal(main.body.statements[0].type, "Assignment");
    assert.equal(conditional.type, "IfStatement");
    assert.equal(conditional.thenBlock.statements[0].type, "WriteStatement");
    assert.equal(conditional.elseBlock.statements[0].type, "WriteStatement");
    assert.equal(conditional.location.startLine, 6);
});

test("el pipeline de navegador conserva el AST del frontend compartido", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    escribir \"hola\""
    ].join("\n");

    assert.deepEqual(
        getAST(sourceCode),
        parseSource(sourceCode).ast
    );

    assert.deepEqual(
        parseNodeTokens(tokenizeNodeCode(sourceCode)),
        parseSource(sourceCode).ast
    );
});

test("arreglos y ciclos conservan sus nodos característicos", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    A[0] <- 1",
        "    para i <- 0 hasta 2",
        "        escribir A[i]",
        "    mientras i > 0",
        "        i <- i - 1"
    ].join("\n");

    const { ast } = parseSource(sourceCode);
    const statements = ast.statements[0].body.statements;

    assert.equal(statements[0].type, "Assignment");
    assert.equal(statements[0].left.type, "Access");
    assert.equal(statements[0].left.indexes.length, 1);

    assert.equal(statements[1].type, "ForStatement");
    assert.equal(statements[1].initializer.type, "Assignment");
    assert.equal(statements[1].body.statements[0].type, "WriteStatement");

    assert.equal(statements[2].type, "WhileStatement");
    assert.equal(statements[2].condition.type, "BinaryExpression");
    assert.equal(statements[2].body.statements[0].type, "Assignment");
});

test("los errores léxicos incluyen fase, código, ubicación y diagnósticos", () => {
    assert.throws(
        () => parseSource("valor <- @"),
        error => {
            assert.ok(error instanceof LexicalError);
            assert.equal(error.phase, "lexer");
            assert.equal(error.code, "CLRS_LEXICAL_ERROR");
            assert.equal(error.location.startLine, 1);
            assert.equal(error.location.startColumn, 10);
            assert.ok(error.diagnostics.length >= 1);

            return true;
        }
    );
});

test("los errores de indentación distinguen la fase de sangría", () => {
    const sourceCode = [
        "si VERDAD",
        "    escribir \"a\"",
        "  escribir \"b\""
    ].join("\n");

    assert.throws(
        () => parseSource(sourceCode),
        error => {
            assert.ok(error instanceof IndentationError);
            assert.equal(error.phase, "indentation");
            assert.equal(error.code, "CLRS_INDENTATION_ERROR");
            assert.equal(error.location.startLine, 3);
            assert.equal(error.location.startColumn, 3);
            assert.equal(
                error.diagnostics[0]
                    .actualIndentation,
                2
            );
            assert.deepEqual(
                error.diagnostics[0]
                    .expectedIndentationLevels,
                [0, 4]
            );
            assert.match(
                error.diagnostics[0]
                    .message,
                /0 o 4 columnas/
            );

            return true;
        }
    );
});

test("los errores sintácticos se devuelven también como resultado estructurado", () => {
    const result = tryParseSource("escribir ,");

    assert.equal(result.ok, false);
    assert.equal(result.value, null);
    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0] instanceof ParserError);
    assert.equal(result.errors[0].phase, "parser");
    assert.equal(result.errors[0].code, "CLRS_PARSER_ERROR");
    assert.equal(result.errors[0].location.startLine, 1);
    assert.ok(result.errors[0].diagnostics.length >= 1);

    assert.deepEqual(
        Object.keys(result.errors[0].toJSON()),
        [
            "name",
            "message",
            "phase",
            "code",
            "location",
            "diagnostics"
        ]
    );
});

test("las entradas inválidas también usan el contrato de errores estructurados", () => {
    const result = tryParseSource(null);

    assert.equal(result.ok, false);
    assert.ok(result.errors[0] instanceof FrontendInputError);
    assert.equal(result.errors[0].phase, "frontend");
    assert.equal(result.errors[0].code, "CLRS_FRONTEND_INPUT_ERROR");
});
