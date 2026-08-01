import test from "node:test";
import assert from "node:assert/strict";

import "../src/compiler/utils/ProgramKey.js";
import { NodeTypes } from "../src/ast/core/NodeTypes.js";
import { ASTVisitor } from "../src/ast/visitors/ASTVisitor.js";
import {
    ASTVisitorError
} from "../src/ast/visitors/ASTVisitorError.js";
import { TranspilerError } from "../src/errors/TranspilerError.js";
import {
    dependencies,
    endProgram,
    standartLibrary
} from "../src/compiler/StandartLibrary.js";
import { Transpiler } from "../src/compiler/Transpiler.js";
import {
    JavaScriptExpressionVisitor
} from "../src/compiler/visitors/JavaScriptExpressionVisitor.js";
import {
    JavaScriptStatementVisitor
} from "../src/compiler/visitors/JavaScriptStatementVisitor.js";
import { parseSource } from "../src/language/LanguageFrontend.js";

const location = Object.freeze({
    startLine: 1,
    startColumn: 1,
    endLine: 1,
    endColumn: 1
});

test("los visitors JavaScript separan expresiones e instrucciones", () => {
    const expressionVisitor =
        new JavaScriptExpressionVisitor();
    const statementVisitor =
        new JavaScriptStatementVisitor(
            expressionVisitor
        );

    assert.ok(expressionVisitor instanceof ASTVisitor);
    assert.ok(statementVisitor instanceof ASTVisitor);
    assert.equal(
        statementVisitor.expressionVisitor,
        expressionVisitor
    );

    assert.equal(
        expressionVisitor.supports(
            NodeTypes.BINARY_EXPRESSION
        ),
        true
    );
    assert.equal(
        expressionVisitor.supports(
            NodeTypes.ASSIGNMENT
        ),
        false
    );
    assert.equal(
        statementVisitor.supports(
            NodeTypes.ASSIGNMENT
        ),
        true
    );
    assert.equal(
        statementVisitor.supports(
            NodeTypes.BINARY_EXPRESSION
        ),
        false
    );
});

test("Transpiler coordina ambos visitors y conserva sus fachadas", () => {
    const { ast } = parseSource([
        "PRINCIPAL()",
        "    dato <- 2 ^ 3"
    ].join("\n"));
    const transpiler = createTranspiler();
    const assignment =
        ast.statements[0].body.statements[0];

    assert.ok(
        transpiler.expressionVisitor
        instanceof JavaScriptExpressionVisitor
    );
    assert.ok(
        transpiler.statementVisitor
        instanceof JavaScriptStatementVisitor
    );

    assert.equal(
        transpiler.getExpression(assignment.right),
        transpiler.expressionVisitor.visit(
            assignment.right
        )
    );
    assert.equal(
        transpiler.statementType(assignment),
        transpiler.statementVisitor.visit(
            assignment
        )
    );
    assert.equal(
        transpiler.buildBlock([assignment]),
        transpiler.statementVisitor.buildBlock(
            [assignment]
        )
    );
});

test("emitProgram produce solo código de usuario", () => {
    const { ast } = parseSource([
        "PRINCIPAL()",
        "    escribir \"hola\""
    ].join("\n"));
    const transpiler = createTranspiler();

    assert.equal(
        transpiler.emitProgram(ast),
        "async function PRINCIPAL() {\n" +
        "\tconsole.log(\"hola\");\n" +
        "}\n" +
        "await PRINCIPAL();\n"
    );
});

test("assembleProgram conserva exactamente runtime, usuario y cierre", () => {
    const { ast } = parseSource("dato <- 1");
    const transpiler = createTranspiler();
    const userCode = transpiler.emitProgram(ast);

    assert.equal(
        transpiler.assembleProgram(ast),
        dependencies +
        standartLibrary +
        userCode +
        endProgram
    );
});

test("el emisor de literales escapa cadenas construidas externamente", () => {
    const transpiler = createTranspiler();
    const literal = {
        type: NodeTypes.STRING_LITERAL,
        value: "línea 1\n\"línea 2\"",
        location
    };

    assert.equal(
        transpiler.getLiteral(literal),
        "\"línea 1\\n\\\"línea 2\\\"\""
    );
});

test("nodos no soportados producen ASTVisitorError por capa", () => {
    const transpiler = createTranspiler();

    assert.throws(
        () => transpiler.getExpression({
            type: NodeTypes.BLOCK,
            statements: [],
            location
        }),
        error =>
            error instanceof ASTVisitorError &&
            error.phase === "ast-visitor" &&
            error.code === "CLRS_UNSUPPORTED_AST_NODE" &&
            error.nodeType === NodeTypes.BLOCK
    );

    assert.throws(
        () => transpiler.statementType({
            type: NodeTypes.IDENTIFIER,
            name: "dato",
            location
        }),
        error =>
            error instanceof ASTVisitorError &&
            error.code === "CLRS_UNSUPPORTED_AST_NODE" &&
            error.nodeType === NodeTypes.IDENTIFIER
    );
});

test("el coordinador conserva errores de raíz como TranspilerError", () => {
    const transpiler = createTranspiler();

    assert.throws(
        () => transpiler.emitProgram(null),
        error =>
            error instanceof TranspilerError &&
            error.code === "CLRS_TRANSPILER_ERROR"
    );

    assert.throws(
        () => transpiler.emitProgram({
            type: NodeTypes.IDENTIFIER,
            name: "dato",
            location
        }),
        error =>
            error instanceof TranspilerError &&
            error.code === "CLRS_TRANSPILER_ERROR"
    );
});

function createTranspiler() {
    return new Transpiler(
        "visitors.clrs",
        false
    );
}
