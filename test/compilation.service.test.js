import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
    mkdtempSync,
    rmSync,
    writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

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
    const ast = parseSource("dato = 1").ast;
    const result = generator.generate(ast);

    assert.equal(
        result.userCode,
        `registerRuntimeGlobals_${globalThis.ProgramKey}(() => ({"dato": typeof $clrs$0$v$6461746f === "undefined" ? undefined : $clrs$0$v$6461746f}));\n` +
        `setRuntimeLocation_${globalThis.ProgramKey}(1, 1, 1, 8);\n` +
        `recordRuntimeCoverage_${globalThis.ProgramKey}({"pointId":"statement:1:1:1:8","kind":"statement","location":{"startLine":1,"startColumn":1,"endLine":1,"endColumn":8}});\n` +
        "var $clrs$0$v$6461746f;\n" +
        "$clrs$0$v$6461746f = 1;\n"
    );
    assert.match(
        result.generatedCode,
        /var \$clrs\$0\$v\$6461746f;\n\$clrs\$0\$v\$6461746f = 1;/
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
        "dato = 1",
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

test("ejecuta literales de arreglo en asignaciones, argumentos y retornos", async () => {
    const temporaryDirectory = mkdtempSync(
        path.join(
            os.tmpdir(),
            "clrs-array-literal-"
        )
    );
    const sourcePath = path.join(
        temporaryDirectory,
        "arreglos.clrs"
    );
    const programPath = path.join(
        temporaryDirectory,
        "arreglos.mjs"
    );
    const service = new CompilationService({
        fileEmitter: {
            async writeArtifact(artifact) {
                return artifact;
            }
        }
    });

    try {
        const artifact = await service.compileSource(
            [
                "CONSTRUIR(base)",
                "    retornar [[base, base + 1], [\"texto\"], []]",
                "",
                "CONTAR(datos[])",
                "    retornar LONG(datos)",
                "",
                "PRINCIPAL()",
                "    vacio = []",
                "    frutas = [\"manzana\", \"pera\", \"uva\"]",
                "    matriz = CONSTRUIR(4)",
                "    mixto = [VERDAD, \"dos\", 3]",
                "    irregular = [[1], [2, 3]]",
                "    incremental[0] = 7",
                "    incremental[1] = 8",
                "    desdeArgumento = CONTAR([10, 20])",
                "    escribir LONG(vacio)",
                "    escribir UNE(frutas, \"|\")",
                "    escribir matriz[0][1], matriz[1][0], LONG(matriz[2])",
                "    escribir mixto[0], mixto[1], mixto[2]",
                "    escribir irregular[1][1]",
                "    escribir incremental[0], incremental[1]",
                "    escribir desdeArgumento"
            ].join("\n"),
            sourcePath
        );

        writeFileSync(
            programPath,
            artifact.generatedCode,
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
            execution.stdout.replaceAll("\r\n", "\n"),
            [
                "0",
                "manzana|pera|uva",
                "5 texto 0",
                "true dos 3",
                "3",
                "7 8",
                "2",
                ""
            ].join("\n")
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

test("NodeProgramRunner limpia el temporal al recibir la señal de detención", async () => {
    const signalSource = new EventEmitter();
    const childProcess = new EventEmitter();
    const forwardedSignals = [];
    const removedPaths = [];
    const output = [];
    const clockValues = [
        2_000_000_000n,
        2_912_000_000n
    ];

    childProcess.kill = signal => {
        forwardedSignals.push(signal);
        queueMicrotask(() => {
            childProcess.emit(
                "close",
                null,
                signal
            );
        });
        return true;
    };

    const runner = new NodeProgramRunner({
        signalSource,
        clock() {
            return clockValues.shift();
        },
        spawn() {
            return childProcess;
        },
        fileEmitter: {
            async remove(outputPath) {
                removedPaths.push(outputPath);
            }
        },
        logger: {
            log(message) {
                output.push(message);
            },
            error() {}
        }
    });
    const execution = runner.run({
        programPath: "40111_burbuja.js",
        cleanupPath: "40111_burbuja.js"
    });

    childProcess.emit("spawn");
    signalSource.emit("SIGINT");

    await assert.rejects(
        execution,
        error =>
            error instanceof RuntimeExecutionError &&
            error.signal === "SIGINT"
    );
    assert.deepEqual(
        forwardedSignals,
        ["SIGINT"]
    );
    assert.deepEqual(
        removedPaths,
        ["40111_burbuja.js"]
    );
    assert.equal(
        signalSource.listenerCount("SIGINT"),
        0
    );
    assert.equal(
        signalSource.listenerCount("SIGTERM"),
        0
    );
    assert.match(
        output.at(-1),
        /■ Estado: Cancelado/u
    );
    assert.match(
        output.at(-1),
        /⌛︎Tiempo: 912 ms/u
    );
});

test("NodeProgramRunner captura la evidencia de una prueba depurada", async () => {
    const childProcess = new EventEmitter();
    childProcess.stdout = new EventEmitter();
    childProcess.stderr = new EventEmitter();
    const appended = [];
    const relayed = [];
    const runner = new NodeProgramRunner({
        environment: {
            CLRS_TEST_DEBUG: "1",
            CLRS_TRACE_FILE: "trace.jsonl"
        },
        spawn(command, args, options) {
            assert.equal(command, "node");
            assert.deepEqual(args, ["temporal.js"]);
            assert.deepEqual(options.stdio, [
                "inherit",
                "pipe",
                "pipe"
            ]);

            queueMicrotask(() => {
                childProcess.stdout.emit("data", "5\n");
                childProcess.emit("close", 0, null);
            });
            return childProcess;
        },
        readFileSync() {
            return '{"type":"end","status":"correct"}\n';
        },
        appendFileSync(...args) {
            appended.push(args);
        },
        standardOutput: {
            write(value) {
                relayed.push(value);
            }
        },
        fileEmitter: {
            async remove() {}
        },
        logger: { log() {} }
    });

    await runner.run({
        programPath: "temporal.js"
    });

    assert.deepEqual(relayed, ["5\n"]);
    assert.equal(appended.length, 1);
    assert.equal(appended[0][0], "trace.jsonl");
    assert.deepEqual(
        JSON.parse(appended[0][1]),
        {
            type: "test-result",
            status: "correct",
            stdout: "5\n",
            stderr: "",
            exitCode: 0,
            signal: null,
            outputTruncated: false
        }
    );
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
            "dato = 1",
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
