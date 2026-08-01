import test from "node:test";
import assert from "node:assert/strict";
import {
    EventEmitter
} from "node:events";
import {
    spawn
} from "node:child_process";
import {
    mkdtemp,
    rm,
    writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
    fileURLToPath
} from "node:url";

import {
    ConsolePresenter
} from "../src/application/presenters/ConsolePresenter.js";
import {
    NodeProgramRunner
} from "../src/compiler/adapters/NodeProgramRunner.js";
import {
    TranspilerError
} from "../src/errors/TranspilerError.js";
import {
    formatDeveloperError,
    formatLanguageError,
    formatTerminalError
} from "../src/errors/ErrorFormatter.js";
import {
    tryParseSource
} from "../src/language/LanguageFrontend.js";

const projectRoot = path.resolve(
    fileURLToPath(
        new URL("..", import.meta.url)
    )
);

test("Chevrotain presenta alternativas sintácticas en español y sin duplicados", () => {
    const result = tryParseSource([
        "PRINCIPAL(",
        "    escribir 1"
    ].join("\n"));
    const message =
        result.errors[0].message;

    assert.equal(result.ok, false);
    assert.match(
        message,
        /Se esperaba una de las siguientes secuencias:/
    );
    assert.match(
        message,
        /pero se encontró: «PRINCIPAL»\./
    );
    assert.doesNotMatch(
        message,
        /Expecting|but found/
    );
    assert.equal(
        occurrences(
            message,
            "[identificador, (, identificador]"
        ),
        1
    );
    assert.equal(
        occurrences(
            message,
            "[identificador, (, )]"
        ),
        1
    );
});

test("el lexer describe caracteres desconocidos en español", () => {
    const result =
        tryParseSource("dato <- @");
    const error = result.errors[0];

    assert.equal(error.phase, "lexer");
    assert.equal(
        error.message,
        "Carácter no reconocido: «@»."
    );
    assert.equal(
        formatLanguageError(error),
        [
            "[Error léxico] Carácter no reconocido: «@».",
            "Línea 1, columna 9"
        ].join("\n")
    );
});

test("la terminal conserva la estética CLRS para errores del usuario", () => {
    const result =
        tryParseSource("escribir ,");
    const formatted =
        formatTerminalError(
            result.errors[0],
            {
                displayName:
                    "programa.clrs"
            }
        );

    assert.match(
        formatted,
        /^CLRS Runtime\n────────────────────────\n▶ programa\.clrs/
    );
    assert.match(
        formatted,
        /✕ Error de sintaxis/
    );
    assert.match(
        formatted,
        /Línea 1, columna 10/
    );
    assert.match(
        formatted,
        /Estado: No ejecutado$/
    );
    assert.doesNotMatch(
        formatted,
        /Expecting|but found|Status:/
    );
});

test("los errores internos separan el mensaje público del log técnico", () => {
    const cause = new Error(
        "Native implementation failure"
    );
    const error = new TranspilerError(
        "Generator invariant failed.",
        null,
        { cause }
    );
    const publicMessage =
        formatLanguageError(error);
    const developerMessage =
        formatDeveloperError(error);

    assert.match(
        publicMessage,
        /Ocurrió un error interno al generar el programa/
    );
    assert.doesNotMatch(
        publicMessage,
        /Generator invariant|Native implementation/
    );
    assert.match(
        developerMessage,
        /Generator invariant failed/
    );
    assert.match(
        developerMessage,
        /Native implementation failure/
    );
    assert.match(
        developerMessage,
        /\[developer\]\[transpiler\]/
    );
});

test("ConsolePresenter oculta detalles internos salvo en modo de depuración", () => {
    const publicOutput = [];
    const developerOutput = [];
    const error = new TranspilerError(
        "Unsupported emitter state."
    );
    const presenter =
        new ConsolePresenter({
            logger: {
                log(message) {
                    publicOutput.push(message);
                },
                error(message) {
                    publicOutput.push(message);
                }
            },
            developerLogger: {
                error(message) {
                    developerOutput.push(message);
                }
            },
            debug: false
        });

    presenter.present(
        {
            ok: false,
            value: null,
            errors: [error]
        },
        {
            displayName:
                "programa.clrs"
        }
    );

    assert.equal(publicOutput.length, 1);
    assert.doesNotMatch(
        publicOutput[0],
        /Unsupported emitter state/
    );
    assert.deepEqual(developerOutput, []);

    presenter.debug = true;
    presenter.present({
        ok: false,
        value: null,
        errors: [error]
    });

    assert.match(
        developerOutput[0],
        /Unsupported emitter state/
    );
});

test("NodeProgramRunner reenvía un error controlado y traduce el estado", async () => {
    const childProcess =
        new EventEmitter();
    childProcess.stderr =
        new EventEmitter();
    const standardOutput = [];
    const standardError = [];
    const runner =
        new NodeProgramRunner({
            spawn(command, args, options) {
                assert.equal(command, "node");
                assert.deepEqual(
                    args,
                    ["temporal.js"]
                );
                assert.deepEqual(
                    options.stdio,
                    [
                        "inherit",
                        "inherit",
                        "pipe"
                    ]
                );

                queueMicrotask(() => {
                    childProcess.stderr.emit(
                        "data",
                        "✕ Error de ejecución\n\n" +
                        "  Mensaje controlado."
                    );
                    childProcess.emit(
                        "close",
                        70,
                        null
                    );
                });

                return childProcess;
            },
            fileEmitter: {
                async remove() {}
            },
            logger: {
                log(message) {
                    standardOutput.push(
                        message
                    );
                },
                error(message) {
                    standardError.push(
                        message
                    );
                }
            }
        });

    await assert.rejects(
        () => runner.run({
            displayName:
                "programa.clrs",
            programPath:
                "temporal.js"
        }),
        error =>
            error.presented === true &&
            error.exitCode === 70
    );

    assert.match(
        standardOutput[0],
        /CLRS Runtime/
    );
    assert.match(
        standardError[0],
        /Mensaje controlado/
    );
    assert.match(
        standardOutput[1],
        /Estado: Error/
    );
});

test("el CLI muestra errores sintácticos con el formato público completo", async () => {
    const execution = await runCli([
        "PRINCIPAL(",
        "    escribir 1"
    ].join("\n"));

    assert.equal(execution.exitCode, 1);
    assert.match(
        execution.stderr,
        /CLRS Runtime/
    );
    assert.match(
        execution.stderr,
        /✕ Error de sintaxis/
    );
    assert.match(
        execution.stderr,
        /Estado: No ejecutado/
    );
    assert.doesNotMatch(
        execution.stderr,
        /Expecting|but found|Status:/
    );
});

test("el runtime oculta el TypeError nativo y lo conserva en modo de desarrollo", async () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    dato <- 1",
        "    dato()"
    ].join("\n");
    const publicExecution =
        await runCli(sourceCode);
    const debugExecution =
        await runCli(
            sourceCode,
            { debug: true }
        );

    assert.equal(
        publicExecution.exitCode,
        1
    );
    assert.match(
        publicExecution.stderr,
        /El programa intentó realizar una operación con un valor incompatible/
    );
    assert.doesNotMatch(
        publicExecution.stderr,
        /TypeError|is not a function/
    );
    assert.match(
        publicExecution.stdout,
        /Estado: Error/
    );

    assert.equal(
        debugExecution.exitCode,
        1
    );
    assert.match(
        debugExecution.stderr,
        /\[developer\]\[runtime\]/
    );
    assert.match(
        debugExecution.stderr,
        /TypeError/
    );
});

test("LANZAR_ERROR conserva el mensaje escrito por el usuario", async () => {
    const execution =
        await runCli([
            "PRINCIPAL()",
            "    LANZAR_ERROR(\"No se encontró una solución\")"
        ].join("\n"));

    assert.equal(execution.exitCode, 1);
    assert.match(
        execution.stderr,
        /No se encontró una solución/
    );
    assert.match(
        execution.stdout,
        /Estado: Error/
    );
    assert.doesNotMatch(
        execution.stderr,
        /CLRSUserError|at PRINCIPAL/
    );
});

function occurrences(text, fragment) {
    return text.split(fragment).length - 1;
}

async function runCli(
    sourceCode,
    options = {}
) {
    const temporaryDirectory =
        await mkdtemp(
            path.join(
                os.tmpdir(),
                "clrs-localization-"
            )
        );
    const sourcePath =
        path.join(
            temporaryDirectory,
            "programa.clrs"
        );

    try {
        await writeFile(
            sourcePath,
            sourceCode,
            "utf8"
        );

        return await executeProcess(
            process.execPath,
            [
                path.join(
                    projectRoot,
                    "src",
                    "compiler",
                    "CliEntry.js"
                ),
                sourcePath
            ],
            {
                cwd: projectRoot,
                env: {
                    ...process.env,
                    CLRS_DEBUG:
                        options.debug
                            ? "1"
                            : "0"
                }
            }
        );
    } finally {
        await rm(
            temporaryDirectory,
            {
                recursive: true,
                force: true
            }
        );
    }
}

function executeProcess(
    command,
    args,
    options
) {
    return new Promise(
        (resolve, reject) => {
            const child = spawn(
                command,
                args,
                {
                    ...options,
                    stdio: [
                        "ignore",
                        "pipe",
                        "pipe"
                    ]
                }
            );
            let stdout = "";
            let stderr = "";

            child.stdout.on(
                "data",
                chunk => {
                    stdout += String(chunk);
                }
            );
            child.stderr.on(
                "data",
                chunk => {
                    stderr += String(chunk);
                }
            );
            child.once("error", reject);
            child.once(
                "close",
                (exitCode, signal) => {
                    resolve({
                        exitCode,
                        signal,
                        stdout,
                        stderr
                    });
                }
            );
        }
    );
}
