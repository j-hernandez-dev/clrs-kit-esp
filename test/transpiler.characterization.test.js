import test from "node:test";
import assert from "node:assert/strict";

import "../src/compiler/utils/ProgramKey.js";
import { NodeTypes } from "../src/ast/core/NodeTypes.js";
import { Transpiler } from "../src/compiler/Transpiler.js";
import { parseSource } from "../src/language/LanguageFrontend.js";

test("caracteriza expresiones, precedencia y operadores JavaScript", () => {
    const expression = firstAssignmentRight(
        "resultado <- no (a = 2) o -3 ^ 2 > 0"
    );
    const transpiler = createTranspiler();

    assert.equal(
        transpiler.getExpression(expression),
        "!(a === 2) || -3 ** 2 > 0"
    );
});

test("caracteriza llamadas, booleanos y accesos multidimensionales", () => {
    const expression = firstAssignmentRight(
        "resultado <- SUMA(A[i][j], VERDAD)"
    );
    const transpiler = createTranspiler();

    assert.equal(
        transpiler.getExpression(expression),
        "await SUMA(A[i][j], true)"
    );
});

test("caracteriza asignaciones escalares y de arreglos", () => {
    const ast = parseSource([
        "dato <- 1",
        "A[0][1] <- 5"
    ].join("\n")).ast;
    const transpiler = createTranspiler();

    assert.equal(
        transpiler.statementType(ast.statements[0]),
        "var dato;\ndato = 1;\n"
    );
    assert.equal(
        transpiler.statementType(ast.statements[1]),
        `var A = cre_array_${globalThis.ProgramKey}(A, 2);\n` +
        "A[0][1] = 5;\n"
    );
});

test("caracteriza funciones, llamada automática y salida", () => {
    const ast = parseSource([
        "PRINCIPAL()",
        "    escribir \"hola\", 1"
    ].join("\n")).ast;
    const transpiler = createTranspiler();

    assert.equal(
        transpiler.statementType(ast.statements[0]),
        "async function PRINCIPAL() {\n" +
        "\tconsole.log(\"hola\", 1);\n" +
        "}\n" +
        "await PRINCIPAL();\n"
    );
});

test("caracteriza condicionales, ciclos y retornos", () => {
    const ast = parseSource([
        "PRUEBA(a)",
        "    si a = 1",
        "        retornar a",
        "    sino",
        "        retornar 0",
        "    mientras a > 0",
        "        a <- a - 1",
        "    para i <- 0 hasta 2",
        "        escribir i"
    ].join("\n")).ast;
    const transpiler = createTranspiler();
    const statements = ast.statements[0].body.statements;

    assert.equal(
        transpiler.statementType(statements[0]),
        "if (a === 1) {\n" +
        "\treturn a;\n" +
        "\n}\n" +
        "else {\n" +
        "\treturn 0;\n" +
        "\n}\n"
    );
    assert.equal(
        transpiler.statementType(statements[1]),
        "while (a > 0) {\n" +
        "\tvar a;\n" +
        "a = a - 1;\n" +
        "\n}\n"
    );
    assert.equal(
        transpiler.statementType(statements[2]),
        "for (var i = 0; i <= 2; i = i + 1) {\n" +
        "\tconsole.log(i);\n" +
        "\n}\n"
    );
});

test("caracteriza la lectura y sus conversiones implícitas", () => {
    const ast = parseSource("leer dato").ast;
    const transpiler = createTranspiler();

    assert.equal(
        transpiler.statementType(ast.statements[0]),
        `
dato = String(await inputData_${globalThis.ProgramKey}());

if (dato.trim() !== "" && !Number.isNaN(Number(dato))) {
    dato = Number(dato);
} else if (dato === "FALSO") {
    dato = false;
} else if (dato === "VERDAD") {
    dato = true;
}
`
    );
});

test("caracteriza los tipos de nodo aceptados por el transpilador", () => {
    const transpiler = createTranspiler();
    const supportedStatements = [
        NodeTypes.ASSIGNMENT,
        NodeTypes.FUNCTION_DECLARATION,
        NodeTypes.FUNCTION_CALL,
        NodeTypes.WRITE_STATEMENT,
        NodeTypes.READ_STATEMENT,
        NodeTypes.IF_STATEMENT,
        NodeTypes.WHILE_STATEMENT,
        NodeTypes.FOR_STATEMENT,
        NodeTypes.RETURN_STATEMENT
    ];

    for (const nodeType of supportedStatements) {
        assert.equal(typeof nodeType, "string");
    }

    assert.equal(
        transpiler.getOperator("="),
        "==="
    );
    assert.equal(
        transpiler.getOperator("^"),
        "**"
    );
});

function createTranspiler() {
    return new Transpiler("caracterizacion.clrs", false);
}

function firstAssignmentRight(sourceCode) {
    return parseSource(sourceCode).ast.statements[0].right;
}
