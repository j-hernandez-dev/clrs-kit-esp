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
import {
    RuntimeLocationInstrumentation
} from "../src/compiler/runtime/RuntimeLocationInstrumentation.js";
import {
    RuntimeCoverageInstrumentation
} from "../src/compiler/runtime/RuntimeCoverageInstrumentation.js";
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
        "    dato = 2 ^ 3"
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
        "async function $clrs$0$f$5052494e434950414c() {\n" +
        `\trecordRuntimeCoverage_${globalThis.ProgramKey}({"pointId":"function:1:1:2:19:PRINCIPAL","kind":"function","location":{"startLine":1,"startColumn":1,"endLine":2,"endColumn":19},"name":"PRINCIPAL"});\n` +
        `\tenterRuntimeFrame_${globalThis.ProgramKey}("PRINCIPAL", {"startLine":1,"startColumn":1,"endLine":2,"endColumn":19}, [], [], () => ({}));\n` +
        "\ttry {\n" +
        `\t\tsetRuntimeLocation_${globalThis.ProgramKey}(2, 5, 2, 19);\n` +
        `\t\trecordRuntimeCoverage_${globalThis.ProgramKey}({"pointId":"statement:2:5:2:19","kind":"statement","location":{"startLine":2,"startColumn":5,"endLine":2,"endColumn":19}});\n` +
        "\t\tconsole.log(\"hola\");\n" +
        "\t} finally {\n" +
        `\t\tleaveRuntimeFrame_${globalThis.ProgramKey}();\n` +
        "\t}\n" +
        "}\n" +
        `setRuntimeLocation_${globalThis.ProgramKey}(1, 1, 2, 19, false);\n` +
        "await $clrs$0$f$5052494e434950414c();\n"
    );
});

test("la instrumentación de cobertura conserva puntos estables y condiciones", () => {
    const runtimeCoverage =
        new RuntimeCoverageInstrumentation({
            markerName: "cover",
            conditionMarkerName: "condition"
        });

    assert.equal(
        runtimeCoverage.markStatement(location),
        "cover({\"pointId\":\"statement:1:1:1:1\",\"kind\":\"statement\",\"location\":{\"startLine\":1,\"startColumn\":1,\"endLine\":1,\"endColumn\":1}});\n"
    );
    assert.equal(
        runtimeCoverage.wrapBranch(
            "operacion()",
            location
        ),
        "condition({\"pointId\":\"branch:1:1:1:1\",\"kind\":\"branch\",\"location\":{\"startLine\":1,\"startColumn\":1,\"endLine\":1,\"endColumn\":1}}, operacion())"
    );
    assert.equal(
        runtimeCoverage.markStatement(null),
        ""
    );
});

test("la instrumentación conserva ubicaciones CLRS en statements y expresiones", () => {
    const runtimeLocations =
        new RuntimeLocationInstrumentation({
            markerName: "track"
        });

    assert.equal(
        runtimeLocations.mark(location),
        "track(1, 1, 1, 1);\n"
    );
    assert.equal(
        runtimeLocations.mark(
            location,
            { debug: false }
        ),
        "track(1, 1, 1, 1, false);\n"
    );
    assert.equal(
        runtimeLocations.wrap(
            "await OPERACION()",
            location
        ),
        "(track(1, 1, 1, 1), await OPERACION())"
    );
    assert.equal(
        runtimeLocations.mark(null),
        ""
    );
});

test("assembleProgram conserva exactamente runtime, usuario y cierre", () => {
    const { ast } = parseSource("dato = 1");
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

test("el generador publica el mismo catálogo que instrumenta", () => {
    const { ast } = parseSource([
        "PRINCIPAL()",
        "    dato = 0",
        "    si dato > 0",
        "        escribir dato",
        "    mientras dato < 2",
        "        dato = dato + 1"
    ].join("\n"));
    const generation = createTranspiler()
        .generate(ast);
    const kinds = generation.coveragePoints
        .map(point => point.kind);

    assert.deepEqual(kinds, [
        "function",
        "statement",
        "branch",
        "statement",
        "loop",
        "statement"
    ]);

    for (const point of generation.coveragePoints) {
        assert.match(
            generation.userCode,
            new RegExp(
                point.pointId.replace(
                    /[.*+?^${}()|[\]\\]/gu,
                    "\\$&"
                ),
                "u"
            )
        );
    }
});

test("el emisor de literales conserva las secuencias de escape específicas", () => {
    const transpiler = createTranspiler();
    const literal = {
        type: NodeTypes.STRING_LITERAL,
        value: "línea 1\n\t\"línea 2\"\r\b",
        location
    };

    assert.equal(
        transpiler.getLiteral(literal),
        "\"línea 1\\n\\t\\\"línea 2\\\"\\r\\b\""
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

test("interpreta los escapes propios escritos en una cadena CLRS", () => {
    const transpiler = createTranspiler();
    const { ast } = parseSource(
        String.raw`mensaje = "linea 1\n\t\"linea 2\"\r\b\q"`
    );
    const literal =
        ast.statements[0].right;
    const generatedLiteral =
        transpiler.getLiteral(literal);

    assert.equal(
        generatedLiteral,
        String.raw`"linea 1\n\t\"linea 2\"\r\b\\q"`
    );
    assert.equal(
        JSON.parse(generatedLiteral),
        "linea 1\n\t\"linea 2\"\r\b\\q"
    );
});

function createTranspiler() {
    return new Transpiler(
        "visitors.clrs",
        false
    );
}
