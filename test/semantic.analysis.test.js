import test from "node:test";
import assert from "node:assert/strict";

import "../src/compiler/utils/ProgramKey.js";
import {
    CompilationArtifact
} from "../src/compiler/CompilationArtifact.js";
import {
    CompilationService
} from "../src/compiler/services/CompilationService.js";
import {
    SemanticError
} from "../src/errors/SemanticError.js";
import {
    formatLanguageError
} from "../src/errors/ErrorFormatter.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";
import {
    SemanticAnalyzer
} from "../src/semantic/SemanticAnalyzer.js";
import {
    SemanticScopeType
} from "../src/semantic/SemanticScope.js";

test("las asignaciones usan hoisting y ámbito de función a través de bloques", () => {
    const ast = parseSource([
        "PRINCIPAL()",
        "    escribir dato",
        "    si VERDAD",
        "        dato <- 1",
        "    escribir dato"
    ].join("\n")).ast;
    const model =
        new SemanticAnalyzer().analyze(ast);
    const main = ast.statements[0];
    const [
        firstWrite,
        conditional,
        secondWrite
    ] = main.body.statements;
    const declaration =
        conditional.thenBlock.statements[0];
    const symbol =
        model.getSymbol(declaration.left);

    assert.equal(
        model.getSymbol(firstWrite.expressions[0]),
        symbol
    );
    assert.equal(
        model.getSymbol(secondWrite.expressions[0]),
        symbol
    );
    assert.equal(
        symbol.scope.type,
        SemanticScopeType.FUNCTION
    );
    assert.equal(
        model.getScope(main.body),
        model.getScope(conditional.thenBlock)
    );
});

test("una asignación local posterior oculta el símbolo global desde el inicio de la función", () => {
    const ast = parseSource([
        "dato <- 1",
        "CAMBIA()",
        "    escribir dato",
        "    dato <- 2"
    ].join("\n")).ast;
    const model =
        new SemanticAnalyzer().analyze(ast);
    const globalAssignment = ast.statements[0];
    const functionDeclaration = ast.statements[1];
    const [write, localAssignment] =
        functionDeclaration.body.statements;
    const globalSymbol =
        model.getSymbol(globalAssignment.left);
    const localSymbol =
        model.getSymbol(localAssignment.left);

    assert.notEqual(localSymbol, globalSymbol);
    assert.equal(
        model.getSymbol(write.expressions[0]),
        localSymbol
    );
});

test("las funciones tienen hoisting y conservan la flexibilidad de argumentos de JavaScript", () => {
    const ast = parseSource([
        "PRINCIPAL()",
        "    resultado <- SUMA(1)",
        "SUMA(a, b)",
        "    retornar a + b"
    ].join("\n")).ast;
    const model =
        new SemanticAnalyzer().analyze(ast);
    const call =
        ast.statements[0].body.statements[0].right;
    const declaration = ast.statements[1];

    assert.equal(
        model.getSymbol(call.identifier),
        model.getSymbol(declaration.identifier)
    );
});

test("la biblioteca CLRS y los globales JavaScript están disponibles", () => {
    const ast = parseSource([
        "PRINCIPAL()",
        "    absoluto <- ABS(-1)",
        "    numero <- Number(\"2\")"
    ].join("\n")).ast;

    assert.doesNotThrow(
        () => new SemanticAnalyzer().analyze(ast)
    );
});

test("un identificador no declarado produce un error semántico en español y con ubicación", () => {
    const ast = parseSource([
        "PRINCIPAL()",
        "    escribir fantasma"
    ].join("\n")).ast;

    assert.throws(
        () => new SemanticAnalyzer().analyze(ast),
        error => {
            assert.ok(error instanceof SemanticError);
            assert.equal(error.phase, "semantic");
            assert.equal(
                error.code,
                "CLRS_UNDEFINED_IDENTIFIER"
            );
            assert.equal(error.location.startLine, 2);
            assert.equal(error.location.startColumn, 14);
            assert.equal(
                error.message,
                "El identificador «fantasma» no está definido."
            );

            return true;
        }
    );
});

test("leer requiere una declaración implícita emitida en el mismo ámbito", () => {
    const invalidAST =
        parseSource("leer dato").ast;
    const validAST = parseSource([
        "PRINCIPAL()",
        "    leer dato",
        "    dato <- 1"
    ].join("\n")).ast;

    assert.throws(
        () =>
            new SemanticAnalyzer().analyze(
                invalidAST
            ),
        error =>
            error instanceof SemanticError &&
            error.code ===
                "CLRS_UNDEFINED_IDENTIFIER"
    );
    assert.doesNotThrow(
        () =>
            new SemanticAnalyzer().analyze(
                validAST
            )
    );
});

test("retornar fuera de una función es un error semántico estructurado", () => {
    const ast = parseSource(
        "retornar 1"
    ).ast;

    assert.throws(
        () => new SemanticAnalyzer().analyze(ast),
        error =>
            error instanceof SemanticError &&
            error.code ===
                "CLRS_RETURN_OUTSIDE_FUNCTION" &&
            error.location.startLine === 1
    );
});

test("varios errores semánticos se agregan como diagnósticos", () => {
    const ast = parseSource(
        "escribir uno, dos"
    ).ast;

    assert.throws(
        () => new SemanticAnalyzer().analyze(ast),
        error => {
            assert.ok(error instanceof SemanticError);
            assert.equal(
                error.code,
                "CLRS_SEMANTIC_ANALYSIS_ERROR"
            );
            assert.equal(error.diagnostics.length, 2);
            assert.deepEqual(
                error.diagnostics.map(
                    diagnostic =>
                        diagnostic.identifier
                ),
                ["uno", "dos"]
            );

            return true;
        }
    );
});

test("el formateador conserva todos los diagnósticos de un error agregado", () => {
    const ast = parseSource(
        "escribir uno, dos"
    ).ast;

    assert.throws(
        () => new SemanticAnalyzer().analyze(ast),
        error => {
            const formatted =
                formatLanguageError(error);

            assert.match(
                formatted,
                /«uno» no está definido/
            );
            assert.match(
                formatted,
                /«dos» no está definido/
            );

            return true;
        }
    );
});

test("CompilationService devuelve errores semánticos sin escribir artefactos", async () => {
    const writtenArtifacts = [];
    const service = new CompilationService({
        fileEmitter: {
            async writeArtifact(artifact) {
                writtenArtifacts.push(artifact);
                return artifact;
            }
        }
    });
    const result =
        await service.tryCompileSource(
            "escribir ausente",
            "algoritmo.clrs"
        );

    assert.equal(result.ok, false);
    assert.equal(result.value, null);
    assert.ok(
        result.errors[0] instanceof SemanticError
    );
    assert.equal(
        result.errors[0].code,
        "CLRS_UNDEFINED_IDENTIFIER"
    );
    assert.deepEqual(writtenArtifacts, []);
});

test("la integración semántica no altera el JavaScript generado", async () => {
    const service = new CompilationService({
        fileEmitter: {
            async writeArtifact(artifact) {
                return artifact;
            }
        }
    });
    const artifact =
        await service.compileSource(
            "dato <- 1",
            "algoritmo.clrs"
        );

    assert.ok(
        artifact instanceof CompilationArtifact
    );
    assert.equal(
        artifact.userCode,
        "var dato;\ndato = 1;\n"
    );
});
