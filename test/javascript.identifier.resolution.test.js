import test from "node:test";
import assert from "node:assert/strict";
import {
    mkdtempSync,
    rmSync,
    writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
    spawnSync
} from "node:child_process";

import {
    JavaScriptGenerator
} from "../src/compiler/JavaScriptGenerator.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("mapea bindings CLRS a identificadores JavaScript higiénicos", () => {
    const source = reservedIdentifierProgram();
    const { ast } = parseSource(source);
    const generated =
        new JavaScriptGenerator()
            .generate(ast)
            .userCode;

    assert.match(
        generated,
        /async function \$clrs\$0\$f\$66756e6374696f6e\(\$clrs\$1\$p\$766172\)/
    );
    assert.match(
        generated,
        /var \$clrs\$1\$v\$636c617373;/
    );
    assert.match(
        generated,
        /await LONG\("hola"\)/
    );
    assert.doesNotMatch(
        generated,
        /async function function|var var|var class|var await/
    );
});

test("conserva nombres CLRS públicos en la instrumentación del runtime", () => {
    const { ast } = parseSource(
        reservedIdentifierProgram()
    );
    const generated =
        new JavaScriptGenerator()
            .generate(ast)
            .userCode;

    assert.match(
        generated,
        /enterRuntimeFrame_\d+\("function".*\["var"\], \["class"\]/
    );
    assert.match(
        generated,
        /enterRuntimeFrame_\d+\("PRINCIPAL".*\[\], \["console","await"\]/
    );
    assert.doesNotMatch(
        generated,
        /enterRuntimeFrame_\d+\("\$clrs\$/
    );
});

test("ejecuta palabras reservadas y evita colisionar con console", () => {
    const temporaryDirectory =
        mkdtempSync(
            path.join(
                os.tmpdir(),
                "clrs-identifiers-"
            )
        );
    const programPath = path.join(
        temporaryDirectory,
        "program.mjs"
    );

    try {
        const { ast } = parseSource(
            reservedIdentifierProgram()
        );
        const generated =
            new JavaScriptGenerator()
                .generate(ast)
                .generatedCode;

        writeFileSync(
            programPath,
            generated,
            "utf8"
        );

        const execution = spawnSync(
            process.execPath,
            [programPath],
            {
                encoding: "utf8",
                timeout: 10_000
            }
        );

        assert.equal(
            execution.status,
            0,
            execution.stderr
        );
        assert.equal(
            execution.stdout.trim(),
            "5 4"
        );
    } finally {
        rmSync(
            temporaryDirectory,
            {
                recursive: true,
                force: true
            }
        );
    }
});

test("mantiene separados símbolos homónimos de ámbitos distintos", () => {
    const { ast } = parseSource([
        "UNO(var)",
        "    retornar var",
        "DOS(var)",
        "    retornar var",
        "PRINCIPAL()",
        "    resultado = UNO(1) + DOS(2)",
        "    escribir resultado"
    ].join("\n"));
    const generated =
        new JavaScriptGenerator()
            .generate(ast)
            .userCode;

    assert.match(
        generated,
        /\$clrs\$1\$p\$766172/
    );
    assert.match(
        generated,
        /\$clrs\$2\$p\$766172/
    );
    assert.notEqual(
        "$clrs$1$p$766172",
        "$clrs$2$p$766172"
    );
});

test("no modifica los identificadores conservados en el AST", () => {
    const parsed = parseSource(
        reservedIdentifierProgram()
    );
    const declaration = parsed.ast.statements[0];
    const parameter = declaration.parameters[0];
    const assignment =
        declaration.body.statements[0];

    new JavaScriptGenerator()
        .generate(parsed.ast);

    assert.equal(
        declaration.identifier.name,
        "function"
    );
    assert.equal(
        parameter.identifier.name,
        "var"
    );
    assert.equal(
        assignment.left.name,
        "class"
    );
});

function reservedIdentifierProgram() {
    return [
        "function(var)",
        "    class = var + 1",
        "    retornar class",
        "",
        "PRINCIPAL()",
        "    console = function(4)",
        "    await = LONG(\"hola\")",
        "    escribir console, await"
    ].join("\n");
}
