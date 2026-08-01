import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import path from "node:path";

import "../src/compiler/utils/ProgramKey.js";
import {
    CompilationArtifact
} from "../src/compiler/CompilationArtifact.js";
import {
    JavaScriptGenerator
} from "../src/compiler/JavaScriptGenerator.js";
import {
    FileSystemEmitter
} from "../src/compiler/adapters/FileSystemEmitter.js";
import {
    NodeProgramRunner
} from "../src/compiler/adapters/NodeProgramRunner.js";
import {
    CompilationService
} from "../src/compiler/services/CompilationService.js";
import {
    CompilationIOError
} from "../src/errors/CompilationIOError.js";
import {
    ParserError
} from "../src/errors/FrontendErrors.js";
import {
    RuntimeExecutionError
} from "../src/errors/RuntimeExecutionError.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("JavaScriptGenerator genera código sin conocer archivos", () => {
    const generator = new JavaScriptGenerator();
    const ast = parseSource("dato <- 1").ast;
    const result = generator.generate(ast);

    assert.equal(
        result.userCode,
        "var dato;\ndato = 1;\n"
    );
    assert.match(
        result.generatedCode,
        /var dato;\ndato = 1;/
    );
    assert.equal(
        "fileEmitter" in generator,
        false
    );
});

test("CompilationService produce y persiste un artefacto inmutable", async () => {
    const writtenArtifacts = [];
    const fileEmitter = {
        async writeArtifact(artifact) {
            writtenArtifacts.push(artifact);
            return artifact;
        }
    };
    const service = new CompilationService({
        fileEmitter,
        programRunner: {
            run() {
                throw new Error(
                    "No debe ejecutarse."
                );
            }
        }
    });
    const sourcePath = path.join(
        "proyecto",
        "algoritmo.clrs"
    );
    const artifact = await service.compileSource(
        "dato <- 1",
        sourcePath
    );

    assert.ok(
        artifact instanceof CompilationArtifact
    );
    assert.equal(
        artifact.outputPath,
        path.join(
            "proyecto",
            ".clrs",
            "js",
            "algoritmo.js"
        )
    );
    assert.equal(artifact.temporary, false);
    assert.equal(
        writtenArtifacts[0],
        artifact
    );
    assert.equal(
        Object.isFrozen(artifact),
        true
    );
});

test("FileSystemEmitter convierte fallos de escritura en errores estructurados", async () => {
    const cause = new Error("sin permisos");
    const emitter = new FileSystemEmitter({
        mkdir: async () => {},
        writeFile: async () => {
            throw cause;
        }
    });

    await assert.rejects(
        () => emitter.write(
            "contenido",
            path.join("salida", "programa.js")
        ),
        error =>
            error instanceof CompilationIOError &&
            error.phase === "compiler-io" &&
            error.code ===
                "CLRS_COMPILATION_WRITE_ERROR" &&
            error.operation === "write" &&
            error.cause === cause
    );
});

test("FileSystemEmitter permite eliminar archivos temporales ausentes", async () => {
    const missingError =
        Object.assign(
            new Error("ausente"),
            { code: "ENOENT" }
        );
    const emitter = new FileSystemEmitter({
        unlink: async () => {
            throw missingError;
        }
    });

    assert.equal(
        await emitter.remove("ausente.js"),
        false
    );
});

test("NodeProgramRunner devuelve el código de salida y limpia el temporal", async () => {
    const removedPaths = [];
    const childProcess = new EventEmitter();
    const runner = new NodeProgramRunner({
        spawn(command, args, options) {
            assert.equal(command, "node");
            assert.deepEqual(
                args,
                ["temporal.js"]
            );
            assert.deepEqual(
                options,
                {
                    stdio: [
                        "inherit",
                        "inherit",
                        "pipe"
                    ]
                }
            );
            queueMicrotask(() => {
                childProcess.emit(
                    "close",
                    0,
                    null
                );
            });
            return childProcess;
        },
        fileEmitter: {
            async remove(outputPath) {
                removedPaths.push(outputPath);
            }
        },
        logger: {
            log() {}
        }
    });

    const result = await runner.run({
        displayName: "algoritmo.clrs",
        programPath: "temporal.js",
        cleanupPath: "temporal.js"
    });

    assert.deepEqual(
        removedPaths,
        ["temporal.js"]
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.status, "Correct");
});

test("NodeProgramRunner estructura una terminación fallida", async () => {
    const childProcess = new EventEmitter();
    let removed = false;
    const runner = new NodeProgramRunner({
        spawn() {
            queueMicrotask(() => {
                childProcess.emit(
                    "close",
                    7,
                    null
                );
            });
            return childProcess;
        },
        fileEmitter: {
            async remove() {
                removed = true;
            }
        },
        logger: {
            log() {}
        }
    });

    await assert.rejects(
        () => runner.run({
            programPath: "temporal.js",
            cleanupPath: "temporal.js"
        }),
        error =>
            error instanceof RuntimeExecutionError &&
            error.phase === "runtime" &&
            error.code ===
                "CLRS_RUNTIME_EXIT_ERROR" &&
            error.exitCode === 7
    );
    assert.equal(removed, true);
});

test("CompilationService ofrece resultados sin excepciones", async () => {
    const service = new CompilationService({
        fileEmitter: {
            async writeArtifact(artifact) {
                return artifact;
            }
        },
        programRunner: {
            async run() {
                return {
                    ok: true,
                    exitCode: 0
                };
            }
        }
    });

    const success =
        await service.tryCompileSource(
            "dato <- 1",
            "algoritmo.clrs"
        );
    const failure =
        await service.tryCompileSource(
            "si",
            "algoritmo.clrs"
        );

    assert.equal(success.ok, true);
    assert.ok(
        success.value
        instanceof CompilationArtifact
    );
    assert.deepEqual(success.errors, []);

    assert.equal(failure.ok, false);
    assert.equal(failure.value, null);
    assert.ok(
        failure.errors[0] instanceof ParserError
    );
});
