import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { NodeTypes } from "../src/ast/core/NodeTypes.js";
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

test("una función sin instrucciones conserva una declaración inequívoca", () => {
    const sourceCode = [
        "NUEVA(dato)",
        "    // Subproceso sin instrucciones",
        "",
        "PRINCIPAL()",
        "    escribir dato"
    ].join("\n");
    const result = parseSource(sourceCode);
    const emptyFunction =
        result.ast.statements[0];

    assert.equal(
        emptyFunction.type,
        "FunctionDeclaration"
    );
    assert.equal(
        emptyFunction.identifier.name,
        "NUEVA"
    );
    assert.deepEqual(
        emptyFunction.body.statements,
        []
    );
});

test("retornar exige siempre una expresión", () => {
    const result = tryParseSource([
        "PRINCIPAL()",
        "    retornar"
    ].join("\n"));

    assert.equal(result.ok, false);
    assert.equal(
        result.errors[0] instanceof ParserError,
        true
    );
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
        "    resultado = (",
        "        1 + 2",
        "    )",
        "    A[",
        "        0",
        "    ] = resultado"
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
    const { ast } = parseSource("resultado = 2 + 3 * 4");
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

test("distingue la asignación con = de la comparación con ==", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    dato = 1",
        "    si dato == 1",
        "        escribir dato"
    ].join("\n");
    const statements =
        parseSource(sourceCode)
            .ast.statements[0]
            .body.statements;
    const tokenNames =
        tokenizeSource(sourceCode)
            .map(token => token.tokenType.name);

    assert.equal(statements[0].type, "Assignment");
    assert.equal(statements[1].type, "IfStatement");
    assert.equal(statements[1].condition.operator, "==");
    assert.equal(tokenNames.includes("Assignment"), true);
    assert.equal(tokenNames.includes("Equal"), true);
});

test("rechaza la flecha de asignación y el igual simple como comparación", () => {
    assert.throws(
        () => parseSource("dato <- 1"),
        error => error instanceof ParserError
    );
    assert.throws(
        () => parseSource([
            "PRINCIPAL()",
            "    si dato = 1",
            "        escribir dato"
        ].join("\n")),
        error => error instanceof ParserError
    );
});

test("TextMate resalta = como asignación y == como comparación", () => {
    const grammar = JSON.parse(
        readFileSync(
            new URL(
                "../extension/syntaxes/clrs.tmLanguage.json",
                import.meta.url
            ),
            "utf8"
        )
    );
    const operatorPatterns =
        grammar.repository.operators.patterns;
    const assignment = new RegExp(
        operatorPatterns.find(pattern =>
            pattern.name.includes("assignment")
        ).match
    );
    const comparison = new RegExp(
        operatorPatterns.find(pattern =>
            pattern.name.includes("comparison")
        ).match
    );

    assert.equal(assignment.test("="), true);
    assert.equal(assignment.test("=="), false);
    assert.equal(comparison.test("=="), true);
    assert.equal(comparison.test("="), false);
});

test("funciones y control de flujo conservan su forma y ubicación", () => {
    const sourceCode = [
        "SUMA(a, b)",
        "    retornar a + b",
        "",
        "PRINCIPAL()",
        "    resultado = SUMA(2, 3)",
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
        "    A[0] = 1",
        "    para i = 0 hasta 2",
        "        escribir A[i]",
        "    mientras i > 0",
        "        i = i - 1"
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

test("los literales de arreglo admiten vacío, expresiones y anidamiento arbitrario", () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    base = 2",
        "    frutas = [\"manzana\", \"pera\", \"uva\"]",
        "    vacio = []",
        "    matriz = [",
        "        [1, base + 1],",
        "        [\"texto\", VERDAD],",
        "        [[3], []]",
        "    ]"
    ].join("\n");
    const statements =
        parseSource(sourceCode)
            .ast.statements[0]
            .body.statements;
    const fruits = statements[1].right;
    const empty = statements[2].right;
    const matrix = statements[3].right;

    assert.equal(fruits.type, NodeTypes.ARRAY_EXPRESSION);
    assert.deepEqual(
        fruits.elements.map(element => element.value),
        ["manzana", "pera", "uva"]
    );
    assert.equal(empty.type, NodeTypes.ARRAY_EXPRESSION);
    assert.deepEqual(empty.elements, []);
    assert.equal(matrix.type, NodeTypes.ARRAY_EXPRESSION);
    assert.equal(matrix.elements.length, 3);
    assert.equal(
        matrix.elements[0].elements[1].type,
        NodeTypes.BINARY_EXPRESSION
    );
    assert.equal(
        matrix.elements[1].elements[0].type,
        NodeTypes.STRING_LITERAL
    );
    assert.equal(
        matrix.elements[1].elements[1].type,
        NodeTypes.BOOLEAN_LITERAL
    );
    assert.equal(
        matrix.elements[2].elements[0]
            .elements[0].value,
        3
    );
    assert.deepEqual(
        matrix.elements[2].elements[1].elements,
        []
    );
    assert.deepEqual(matrix.location, {
        startLine: 5,
        startColumn: 14,
        endLine: 9,
        endColumn: 5
    });
});

test("el contrato de literales de arreglo exige comas entre elementos y dimensiones", () => {
    const invalidSources = [
        "datos = [1, 2,]",
        "datos = [, 1]",
        "datos = [1,, 2]",
        "datos = [1 2]",
        "datos = [1, 2",
        "A = [5, 2, 9, 1, 6] [10]",
        "A = [[5, 2, 9, 1, 6] [10]]"
    ];

    for (const sourceCode of invalidSources) {
        const result = tryParseSource(sourceCode);

        assert.equal(
            result.ok,
            false,
            `Se esperaba rechazar: ${sourceCode}`
        );
        assert.equal(
            result.errors[0] instanceof ParserError,
            true
        );
    }
});

test("los errores léxicos incluyen fase, código, ubicación y diagnósticos", () => {
    assert.throws(
        () => parseSource("valor = @"),
        error => {
            assert.ok(error instanceof LexicalError);
            assert.equal(error.phase, "lexer");
            assert.equal(error.code, "CLRS_LEXICAL_ERROR");
            assert.equal(error.location.startLine, 1);
            assert.equal(error.location.startColumn, 9);
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

test("un error dentro de una función no degrada su declaración a llamada", () => {
    const invalidBodies = [
        [
            "holaMundo(funcion)",
            "    escribir ,"
        ].join("\n"),
        [
            "holaMundo(funcion)",
            "    resultado =",
            "    escribir resultado"
        ].join("\n"),
        [
            "holaMundo(funcion)",
            "    funcion(",
            "    resultado = 0"
        ].join("\n")
    ];

    for (const sourceCode of invalidBodies) {
        const result = tryParseSource(sourceCode);

        assert.equal(result.ok, false);
        assert.ok(result.errors[0] instanceof ParserError);
        assert.doesNotMatch(
            result.errors[0].message,
            /<INDENT>/u
        );
        assert.equal(
            result.errors[0].location.startLine >= 2,
            true
        );
    }
});

test("la decisión acotada conserva declaraciones y llamadas ambiguas válidas", () => {
    const sourceCode = [
        "ejecutar(accion)",
        "    accion()",
        "",
        "PRINCIPAL()",
        "    ejecutar(tarea)"
    ].join("\n");
    const statements = parseSource(sourceCode).ast.statements;

    assert.equal(statements[0].type, "FunctionDeclaration");
    assert.equal(
        statements[0].body.statements[0].type,
        "FunctionCall"
    );
    assert.equal(statements[1].type, "FunctionDeclaration");
    assert.equal(
        statements[1].body.statements[0].type,
        "FunctionCall"
    );
});

test("las entradas inválidas también usan el contrato de errores estructurados", () => {
    const result = tryParseSource(null);

    assert.equal(result.ok, false);
    assert.ok(result.errors[0] instanceof FrontendInputError);
    assert.equal(result.errors[0].phase, "frontend");
    assert.equal(result.errors[0].code, "CLRS_FRONTEND_INPUT_ERROR");
});
