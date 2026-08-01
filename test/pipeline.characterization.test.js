import test from "node:test";
import assert from "node:assert/strict";
import {
    mkdtemp,
    readFile,
    rm
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import "../src/compiler/utils/ProgramKey.js";
import {
    transpileCode
} from "../src/compiler/Pipeline.js";
import { Transpiler } from "../src/compiler/Transpiler.js";
import { parseSource } from "../src/language/LanguageFrontend.js";

test("Transpiler conserva las rutas públicas de generación", () => {
    const sourcePath = path.join(
        "proyecto",
        "algoritmo.clrs"
    );
    const transpiler =
        new Transpiler(sourcePath, false);

    assert.equal(
        transpiler.CLRSFile,
        "algoritmo.clrs"
    );
    assert.equal(
        transpiler.JSFile,
        "algoritmo.js"
    );
    assert.equal(
        transpiler.JSDir,
        path.join(
            "proyecto",
            ".clrs",
            "js"
        )
    );
});

test("Transpiler conserva las rutas temporales de ejecución", () => {
    const transpiler =
        new Transpiler("algoritmo.clrs", true);

    assert.equal(
        transpiler.CLRSFile,
        "algoritmo.clrs"
    );
    assert.equal(
        transpiler.JSFile,
        `${globalThis.ProgramKey}_algoritmo.js`
    );
    assert.equal(transpiler.JSDir, ".");
});

test("transpileCode escribe el programa y devuelve la fachada histórica", async () => {
    const temporaryDirectory = await mkdtemp(
        path.join(
            os.tmpdir(),
            "clrs-pipeline-"
        )
    );
    const sourcePath = path.join(
        temporaryDirectory,
        "algoritmo.clrs"
    );
    const ast = parseSource("dato <- 1").ast;

    try {
        const transpiler = await transpileCode(
            ast,
            sourcePath,
            false
        );

        assert.ok(transpiler instanceof Transpiler);

        const outputPath = path.join(
            transpiler.JSDir,
            transpiler.JSFile
        );
        const generatedCode = await readFile(
            outputPath,
            "utf8"
        );

        assert.equal(
            generatedCode,
            transpiler.assembleProgram(ast)
        );
    } finally {
        await rm(temporaryDirectory, {
            recursive: true,
            force: true
        });
    }
});
