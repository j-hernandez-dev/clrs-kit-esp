import test from "node:test";
import assert from "node:assert/strict";

import "../src/compiler/utils/ProgramKey.js";
import { NodeTypes } from "../src/ast/core/NodeTypes.js";
import { Transpiler } from "../src/compiler/Transpiler.js";
import { parseSource } from "../src/language/LanguageFrontend.js";

test("caracteriza expresiones, precedencia y operadores JavaScript", () => {
    const expression = firstAssignmentRight(
        "resultado = no (a == 2) o -3 ^ 2 > 0"
    );
    const transpiler = createTranspiler();

    assert.equal(
        transpiler.getExpression(expression),
        "!(a === 2) || -3 ** 2 > 0"
    );
});

test("caracteriza llamadas, booleanos y accesos multidimensionales", () => {
    const expression = firstAssignmentRight(
        "resultado = SUMA(A[i][j], VERDAD)"
    );
    const transpiler = createTranspiler();

    assert.equal(
        transpiler.getExpression(expression),
        "await SUMA(A[i][j], true)"
    );
});

test("transpila literales de arreglo vacíos, anidados y con expresiones", () => {
    const expression = firstAssignmentRight(
        "datos = [\"texto\", 1 + 2, [VERDAD, [], CALCULAR(3)]]"
    );
    const transpiler = createTranspiler();

    assert.equal(
        transpiler.getExpression(expression),
        "[\"texto\", 1 + 2, [true, [], await CALCULAR(3)]]"
    );
});

test("caracteriza asignaciones escalares y de arreglos", () => {
    const ast = parseSource([
        "dato = 1",
        "A[0][1] = 5"
    ].join("\n")).ast;
    const transpiler = createTranspiler();

    assert.equal(
        transpiler.statementType(ast.statements[0]),
        `setRuntimeLocation_${globalThis.ProgramKey}(1, 1, 1, 8);\n` +
        `recordRuntimeCoverage_${globalThis.ProgramKey}({"pointId":"statement:1:1:1:8","kind":"statement","location":{"startLine":1,"startColumn":1,"endLine":1,"endColumn":8}});\n` +
        "var dato;\ndato = 1;\n"
    );
    assert.equal(
        transpiler.statementType(ast.statements[1]),
        `setRuntimeLocation_${globalThis.ProgramKey}(2, 1, 2, 11);\n` +
        `recordRuntimeCoverage_${globalThis.ProgramKey}({"pointId":"statement:2:1:2:11","kind":"statement","location":{"startLine":2,"startColumn":1,"endLine":2,"endColumn":11}});\n` +
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
        `\trecordRuntimeCoverage_${globalThis.ProgramKey}({"pointId":"function:1:1:2:22:PRINCIPAL","kind":"function","location":{"startLine":1,"startColumn":1,"endLine":2,"endColumn":22},"name":"PRINCIPAL"});\n` +
        `\tenterRuntimeFrame_${globalThis.ProgramKey}("PRINCIPAL", {"startLine":1,"startColumn":1,"endLine":2,"endColumn":22}, [], [], () => ({}));\n` +
        "\ttry {\n" +
        `\t\tsetRuntimeLocation_${globalThis.ProgramKey}(2, 5, 2, 20);\n` +
        `\t\trecordRuntimeCoverage_${globalThis.ProgramKey}({"pointId":"statement:2:5:2:20","kind":"statement","location":{"startLine":2,"startColumn":5,"endLine":2,"endColumn":20}});\n` +
        "\t\tconsole.log(\"hola\", 1);\n" +
        "\t} finally {\n" +
        `\t\tleaveRuntimeFrame_${globalThis.ProgramKey}();\n` +
        "\t}\n" +
        "}\n" +
        `setRuntimeLocation_${globalThis.ProgramKey}(1, 1, 2, 22, false);\n` +
        "await PRINCIPAL();\n"
    );
});

test("caracteriza condicionales, ciclos y retornos", () => {
    const ast = parseSource([
        "PRUEBA(a)",
        "    si a == 1",
        "        retornar a",
        "    sino",
        "        retornar 0",
        "    mientras a > 0",
        "        a = a - 1",
        "    para i = 0 hasta 2",
        "        escribir i"
    ].join("\n")).ast;
    const transpiler = createTranspiler();
    const statements = ast.statements[0].body.statements;

    assert.equal(
        transpiler.statementType(statements[0]),
        `if ((setRuntimeLocation_${globalThis.ProgramKey}(2, 8, 2, 13), recordRuntimeCoverageCondition_${globalThis.ProgramKey}({"pointId":"branch:2:8:2:13","kind":"branch","location":{"startLine":2,"startColumn":8,"endLine":2,"endColumn":13}}, a === 1))) {\n` +
        `\tsetRuntimeLocation_${globalThis.ProgramKey}(3, 9, 3, 18);\n` +
        `\trecordRuntimeCoverage_${globalThis.ProgramKey}({"pointId":"statement:3:9:3:18","kind":"statement","location":{"startLine":3,"startColumn":9,"endLine":3,"endColumn":18}});\n` +
        "\treturn a;\n" +
        "\n}\n" +
        "else {\n" +
        `\tsetRuntimeLocation_${globalThis.ProgramKey}(5, 9, 5, 18);\n` +
        `\trecordRuntimeCoverage_${globalThis.ProgramKey}({"pointId":"statement:5:9:5:18","kind":"statement","location":{"startLine":5,"startColumn":9,"endLine":5,"endColumn":18}});\n` +
        "\treturn 0;\n" +
        "\n}\n"
    );
    assert.equal(
        transpiler.statementType(statements[1]),
        `while ((setRuntimeLocation_${globalThis.ProgramKey}(6, 14, 6, 18), recordRuntimeCoverageCondition_${globalThis.ProgramKey}({"pointId":"loop:6:14:6:18","kind":"loop","location":{"startLine":6,"startColumn":14,"endLine":6,"endColumn":18}}, a > 0))) {\n` +
        `\tsetRuntimeLocation_${globalThis.ProgramKey}(7, 9, 7, 15);\n` +
        `\trecordRuntimeCoverage_${globalThis.ProgramKey}({"pointId":"statement:7:9:7:15","kind":"statement","location":{"startLine":7,"startColumn":9,"endLine":7,"endColumn":15}});\n` +
        "\tvar a;\n" +
        "\ta = a - 1;\n" +
        "\n}\n"
    );
    assert.equal(
        transpiler.statementType(statements[2]),
        `setRuntimeLocation_${globalThis.ProgramKey}(8, 14, 8, 14);\n` +
        `recordRuntimeCoverage_${globalThis.ProgramKey}({"pointId":"statement:8:14:8:14","kind":"statement","location":{"startLine":8,"startColumn":14,"endLine":8,"endColumn":14}});\n` +
        `for (var i = 0; (setRuntimeLocation_${globalThis.ProgramKey}(8, 22, 8, 22), recordRuntimeCoverageCondition_${globalThis.ProgramKey}({"pointId":"loop:8:22:8:22","kind":"loop","location":{"startLine":8,"startColumn":22,"endLine":8,"endColumn":22}}, i <= 2)); ` +
        `i = (setRuntimeLocation_${globalThis.ProgramKey}(8, 22, 8, 22), i + 1)) {\n` +
        `\tsetRuntimeLocation_${globalThis.ProgramKey}(9, 9, 9, 18);\n` +
        `\trecordRuntimeCoverage_${globalThis.ProgramKey}({"pointId":"statement:9:9:9:18","kind":"statement","location":{"startLine":9,"startColumn":9,"endLine":9,"endColumn":18}});\n` +
        "\tconsole.log(i);\n" +
        "\n}\n"
    );
});

test("caracteriza la lectura y sus conversiones implícitas", () => {
    const ast = parseSource("leer dato").ast;
    const transpiler = createTranspiler();

    assert.equal(
        transpiler.statementType(ast.statements[0]),
        `setRuntimeLocation_${globalThis.ProgramKey}(1, 1, 1, 9);
recordRuntimeCoverage_${globalThis.ProgramKey}({"pointId":"statement:1:1:1:9","kind":"statement","location":{"startLine":1,"startColumn":1,"endLine":1,"endColumn":9}});

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
        transpiler.getOperator("=="),
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
