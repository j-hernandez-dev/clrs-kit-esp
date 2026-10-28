import test from "node:test";
import assert from "node:assert/strict";
import {
    EventEmitter
} from "node:events";

import {
    ConsolePresenter
} from "../src/application/presenters/ConsolePresenter.js";
import {
    NodeProgramRunner
} from "../src/compiler/adapters/NodeProgramRunner.js";
import {
    LexicalError,
    ParserError
} from "../src/errors/FrontendErrors.js";
import {
    SemanticError
} from "../src/errors/SemanticError.js";
import {
    TranspilerError
} from "../src/errors/TranspilerError.js";

const SEPARATOR = "─".repeat(60);
const LOCATION = Object.freeze({
    startLine: 4,
    startColumn: 7,
    endLine: 4,
    endColumn: 8
});

test("tiempo de ejecución correcta excluye preparación y conserva intacta la salida", async () => {
    const childProcess = new EventEmitter();
    childProcess.stdout = new EventEmitter();
    childProcess.stderr = new EventEmitter();
    const runtimeOutput = [];
    const studentOutput = [];
    let clockValue = 0n;
    let clockReads = 0;
    const runner = new NodeProgramRunner({
        clock() {
            clockReads += 1;
            return clockValue;
        },
        environment: {
            CLRS_TEST_DEBUG: "1",
            CLRS_TRACE_FILE: "trace.jsonl"
        },
        spawn() {
            queueMicrotask(() => {
                assert.equal(
                    clockReads,
                    0
                );
                childProcess.emit("spawn");
                clockValue +=
                    180_400_000n;
                childProcess.stdout.emit(
                    "data",
                    "Hola\n10\n20\n"
                );
                childProcess.emit(
                    "close",
                    0,
                    null
                );
            });
            return childProcess;
        },
        readFileSync() {
            return "";
        },
        appendFileSync() {},
        fileEmitter: {
            async remove() {}
        },
        logger: {
            log(message) {
                runtimeOutput.push(message);
            },
            error() {}
        },
        standardOutput: {
            isTTY: false,
            write(message) {
                studentOutput.push(message);
            }
        },
        standardError: {
            isTTY: false
        }
    });

    clockValue += 8_000_000_000n;
    await runner.run({
        displayName: "programa.clrs",
        programPath: "temporal.js"
    });

    assert.deepEqual(
        studentOutput,
        ["Hola\n10\n20\n"]
    );
    assert.equal(clockReads, 2);
    assert.equal(
        runtimeOutput[0],
        [
            "",
            "● CLRS Runtime",
            SEPARATOR,
            "▶ programa.clrs",
            ""
        ].join("\n")
    );
    assert.equal(
        runtimeOutput[1],
        [
            "",
            SEPARATOR,
            "✓ Estado: Correcto",
            "⌛︎Tiempo: 180 ms",
            ""
        ].join("\n")
    );
    assert.doesNotMatch(
        studentOutput.join(""),
        /●|▶|✓|✕|■|\u001b\[/u
    );
});

test("presentación conserva mensaje, código y ubicación de cada fase", () => {
    const cases = [
        {
            error: new LexicalError(
                "Mensaje léxico exacto.",
                LOCATION
            ),
            title: "Error léxico"
        },
        {
            error: new ParserError(
                "Mensaje sintáctico exacto.",
                LOCATION
            ),
            title: "Error de sintaxis"
        },
        {
            error: new SemanticError(
                "Mensaje semántico exacto.",
                null,
                {
                    code:
                        "CLRS_SEMANTIC_TEST",
                    location: LOCATION
                }
            ),
            title: "Error semántico"
        },
        {
            error: new TranspilerError(
                "Detalle técnico exacto.",
                LOCATION,
                {
                    code:
                        "CLRS_TRANSPILER_TEST",
                    publicMessage:
                        "Mensaje de compilación exacto."
                }
            ),
            title: "Error de compilación"
        }
    ];

    for (const { error, title } of cases) {
        const output = [];
        const original = {
            code: error.code,
            publicMessage:
                error.publicMessage,
            location: error.location
        };
        const presenter =
            new ConsolePresenter({
                logger: {
                    log(message) {
                        output.push(message);
                    },
                    error(message) {
                        output.push(message);
                    }
                },
                standardError: {
                    isTTY: false
                },
                environment: {}
            });

        const exitCode = presenter.present(
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

        assert.equal(exitCode, 1);
        assert.equal(output.length, 1);
        assert.match(
            output[0],
            new RegExp(`✕ ${title}`, "u")
        );
        assert.ok(
            output[0].includes(
                `  ${original.publicMessage}`
            )
        );
        assert.match(
            output[0],
            /Línea 4, columna 7/u
        );
        assert.match(
            output[0],
            /✕ Estado: No ejecutado$/u
        );
        assert.equal(
            error.code,
            original.code
        );
        assert.equal(
            error.publicMessage,
            original.publicMessage
        );
        assert.equal(
            error.location,
            original.location
        );
    }
});

test("un fallo de runtime ya presentado no duplica encabezado ni estado", async () => {
    const childProcess = new EventEmitter();
    childProcess.stderr =
        new EventEmitter();
    const output = [];
    const errors = [];
    const logger = {
        log(message) {
            output.push(message);
        },
        error(message) {
            errors.push(message);
        }
    };
    const runner = new NodeProgramRunner({
        clock: deterministicClock(
            5_000_000_000n,
            5_043_100_000n
        ),
        spawn() {
            queueMicrotask(() => {
                childProcess.emit("spawn");
                childProcess.stderr.emit(
                    "data",
                    [
                        "✕ Error de ejecución",
                        "",
                        "  Mensaje controlado.",
                        "  Línea 8, columna 13"
                    ].join("\n")
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
        logger,
        standardOutput: {
            isTTY: false
        },
        standardError: {
            isTTY: false
        }
    });
    let runtimeError;

    try {
        await runner.run({
            displayName: "programa.clrs",
            programPath: "temporal.js"
        });
    } catch (error) {
        runtimeError = error;
    }

    const presenter = new ConsolePresenter({
        logger,
        standardError: {
            isTTY: false
        },
        environment: {}
    });
    const exitCode = presenter.present({
        ok: false,
        value: null,
        errors: [runtimeError]
    });
    const completeOutput = [
        ...output,
        ...errors
    ].join("\n");

    assert.equal(exitCode, 1);
    assert.equal(runtimeError.presented, true);
    assert.equal(
        occurrences(
            completeOutput,
            "● CLRS Runtime"
        ),
        1
    );
    assert.equal(
        occurrences(
            completeOutput,
            "✕ Estado: Error"
        ),
        1
    );
    assert.equal(
        occurrences(
            completeOutput,
            "⌛︎Tiempo: 43 ms"
        ),
        1
    );
    assert.equal(
        occurrences(
            completeOutput,
            "✕ Error de ejecución"
        ),
        1
    );
    assert.match(
        completeOutput,
        /Mensaje controlado\./u
    );
    assert.match(
        completeOutput,
        /Línea 8, columna 13/u
    );
});

test("una señal fatal no se presenta como cancelación", async () => {
    const childProcess = new EventEmitter();
    const output = [];
    const runner = new NodeProgramRunner({
        clock: deterministicClock(
            1_000_000_000n,
            1_020_000_000n
        ),
        spawn() {
            queueMicrotask(() => {
                childProcess.emit("spawn");
                childProcess.emit(
                    "close",
                    null,
                    "SIGSEGV"
                );
            });
            return childProcess;
        },
        fileEmitter: {
            async remove() {}
        },
        logger: {
            log(message) {
                output.push(message);
            },
            error(message) {
                output.push(message);
            }
        },
        standardOutput: {
            isTTY: false
        },
        standardError: {
            isTTY: false
        }
    });

    await assert.rejects(
        () => runner.run({
            displayName: "programa.clrs",
            programPath: "temporal.js"
        }),
        error => error.signal === "SIGSEGV"
    );

    const text = output.join("\n");

    assert.match(text, /✕ Estado: Error/u);
    assert.match(text, /⌛︎Tiempo: 20 ms/u);
    assert.doesNotMatch(
        text,
        /■ Estado: Cancelado/u
    );
});

test("un fallo de arranque no muestra tiempo porque JavaScript no comenzó", async () => {
    const childProcess =
        new EventEmitter();
    const output = [];
    let clockWasRead = false;
    const runner = new NodeProgramRunner({
        clock() {
            clockWasRead = true;
            return 0n;
        },
        spawn() {
            queueMicrotask(() => {
                childProcess.emit(
                    "error",
                    new Error(
                        "fallo de spawn"
                    )
                );
            });
            return childProcess;
        },
        fileEmitter: {
            async remove() {}
        },
        logger: {
            log(message) {
                output.push(message);
            },
            error(message) {
                output.push(message);
            }
        },
        standardOutput: {
            isTTY: false
        },
        standardError: {
            isTTY: false
        }
    });

    await assert.rejects(
        () => runner.run({
            displayName: "programa.clrs",
            programPath: "temporal.js"
        }),
        error =>
            error.code ===
            "CLRS_RUNTIME_START_ERROR"
    );

    assert.equal(clockWasRead, false);
    assert.match(
        output.join("\n"),
        /✕ Estado: Error/u
    );
    assert.doesNotMatch(
        output.join("\n"),
        /⌛︎Tiempo:/u
    );
});

test("errores anteriores al proceso no consultan reloj ni muestran tiempo", () => {
    const output = [];
    const error = new ParserError(
        "Mensaje sintáctico exacto.",
        LOCATION
    );
    const presenter =
        new ConsolePresenter({
            logger: {
                log(message) {
                    output.push(message);
                },
                error(message) {
                    output.push(message);
                }
            },
            standardError: {
                isTTY: false
            },
            environment: {}
        });

    presenter.present({
        ok: false,
        value: null,
        errors: [error]
    });

    assert.doesNotMatch(
        output.join("\n"),
        /⌛︎Tiempo:/u
    );
});

function occurrences(text, search) {
    return text.split(search).length - 1;
}

function deterministicClock(...values) {
    return () => values.shift();
}
