import test from "node:test";
import assert from "node:assert/strict";
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
    spawn
} from "node:child_process";

import {
    ExecutionControlFileSession
} from "../extension/adapters/ExecutionControlFileSession.js";
import {
    BreakpointExpressionCompiler
} from "../extension/debug/BreakpointExpressionCompiler.js";

test("el runtime se detiene en breakpoints y avanza a otra línea", {
    timeout: 15000
}, async () => {
    const fixture = createFixture();
    const control =
        new ExecutionControlFileSession({
            controlPath:
                fixture.controlPath,
            logger: silentLogger()
        }).start({
            breakpoints: [3]
        });
    const execution =
        startRuntime(fixture);

    try {
        const breakpoint =
            await waitForTraceEvent(
                fixture.tracePath,
                event =>
                    event.type === "stopped" &&
                    event.reason ===
                        "breakpoint"
            );

        assert.equal(
            breakpoint.location.startLine,
            3
        );
        assert.equal(
            breakpoint.state.frames[0]
                .name,
            "PRINCIPAL"
        );
        assert.deepEqual(
            breakpoint.state.frames[0]
                .locals
                .map(variable => ({
                    name: variable.name,
                    value: variable.value
                })),
            [{
                name: "dato",
                value: "1"
            }]
        );
        assert.equal(execution.closed, false);

        control.next();

        const stepped =
            await waitForTraceEvent(
                fixture.tracePath,
                event =>
                    event.type === "stopped" &&
                    event.reason === "step"
            );

        assert.equal(
            stepped.location.startLine,
            4
        );
        assert.equal(
            stepped.state.frames[0]
                .locals[0].value,
            "2"
        );

        control.continue();

        const result =
            await execution.close;
        const events =
            readTrace(fixture.tracePath);

        assert.equal(result.code, 0);
        assert.match(execution.stdout, /2/);
        assert.deepEqual(
            events.at(-1),
            {
                type: "end",
                status: "correct"
            }
        );
    } finally {
        await finishFixture(
            fixture,
            control,
            execution
        );
    }
});

test("Step Into entra en la llamada y Step Out regresa al llamador", {
    timeout: 15000
}, async () => {
    const fixture = createFixture([
        "DOBLE(x)",
        "    temporal = x * 2",
        "    retornar temporal",
        "PRINCIPAL()",
        "    dato = 3",
        "    resultado = DOBLE(dato)",
        "    escribir resultado",
        ""
    ]);
    const control =
        new ExecutionControlFileSession({
            controlPath:
                fixture.controlPath,
            logger: silentLogger()
        }).start({
            breakpoints: [6]
        });
    const execution = startRuntime(fixture);

    try {
        await waitForTraceEvent(
            fixture.tracePath,
            event =>
                event.type === "stopped" &&
                event.location
                    ?.startLine === 6
        );
        control.stepIn();

        const inside =
            await waitForTraceEvent(
                fixture.tracePath,
                event =>
                    event.type === "stopped" &&
                    event.reason === "step" &&
                    event.location
                        ?.startLine === 2
            );

        assert.deepEqual(
            inside.state.frames
                .map(frame => frame.name),
            ["PRINCIPAL", "DOBLE"]
        );

        control.stepOut();

        const returned =
            await waitForTraceEvent(
                fixture.tracePath,
                event =>
                    event.type === "stopped" &&
                    event.reason === "step" &&
                    event.location
                        ?.startLine === 7
            );

        assert.deepEqual(
            returned.state.frames
                .map(frame => frame.name),
            ["PRINCIPAL"]
        );
        assert.equal(
            returned.state.frames[0]
                .locals.find(variable =>
                    variable.name === "resultado"
                ).value,
            "6"
        );

        control.continue();
        assert.equal(
            (await execution.close).code,
            0
        );
    } finally {
        await finishFixture(
            fixture,
            control,
            execution
        );
    }
});

test("Step Over ejecuta una llamada completa sin entrar en su frame", {
    timeout: 15000
}, async () => {
    const fixture = createFixture([
        "DOBLE(x)",
        "    temporal = x * 2",
        "    retornar temporal",
        "PRINCIPAL()",
        "    dato = 3",
        "    resultado = DOBLE(dato)",
        "    escribir resultado",
        ""
    ]);
    const control =
        new ExecutionControlFileSession({
            controlPath:
                fixture.controlPath,
            logger: silentLogger()
        }).start({
            breakpoints: [6]
        });
    const execution = startRuntime(fixture);

    try {
        await waitForTraceEvent(
            fixture.tracePath,
            event =>
                event.type === "stopped" &&
                event.location
                    ?.startLine === 6
        );
        const cursor =
            readTrace(fixture.tracePath)
                .length;

        control.stepOver();

        const returned =
            await waitForTraceEventAfter(
                fixture.tracePath,
                cursor,
                event =>
                    event.type === "stopped"
            );

        assert.equal(
            returned.location.startLine,
            7
        );
        assert.deepEqual(
            returned.state.frames
                .map(frame => frame.name),
            ["PRINCIPAL"]
        );
        assert.equal(
            readTrace(fixture.tracePath)
                .slice(cursor)
                .filter(event =>
                    event.type === "stopped" &&
                    [2, 3].includes(
                        event.location
                            ?.startLine
                    )
                ).length,
            0
        );

        control.continue();
        assert.equal(
            (await execution.close).code,
            0
        );
    } finally {
        await finishFixture(
            fixture,
            control,
            execution
        );
    }
});

test("los breakpoints combinan condición CLRS y conteo de impactos", {
    timeout: 15000
}, async () => {
    const fixture = createFixture([
        "PRINCIPAL()",
        "    para i = 1 hasta 4",
        "        valor = i * 10",
        "        escribir valor",
        ""
    ]);
    const breakpoint = compileBreakpoint(
        21,
        3,
        {
            condition: "i >= 2",
            hitCondition: "2"
        }
    );
    const control =
        new ExecutionControlFileSession({
            controlPath:
                fixture.controlPath,
            logger: silentLogger()
        }).start({
            breakpoints: [breakpoint]
        });
    const execution = startRuntime(fixture);

    try {
        const stopped =
            await waitForTraceEvent(
                fixture.tracePath,
                event =>
                    event.type === "stopped" &&
                    event.reason ===
                        "breakpoint"
            );
        const locals = Object.fromEntries(
            stopped.state.frames[0]
                .locals.map(variable => [
                    variable.name,
                    variable.value
                ])
        );

        assert.equal(
            stopped.location.startLine,
            3
        );
        assert.deepEqual(
            stopped.breakpointIds,
            [21]
        );
        assert.equal(locals.i, "3");
        assert.equal(locals.valor, "20");

        control.continue();
        assert.equal(
            (await execution.close).code,
            0
        );
        assert.equal(
            readTrace(fixture.tracePath)
                .filter(event =>
                    event.type === "stopped"
                ).length,
            1
        );
    } finally {
        await finishFixture(
            fixture,
            control,
            execution
        );
    }
});

test("los breakpoints evalúan arreglos literales en funciones estándar", {
    timeout: 15000
}, async () => {
    const fixture = createFixture([
        "PRINCIPAL()",
        "    para i = 1 hasta 4",
        "        valor = i * 10",
        "        escribir valor",
        ""
    ]);
    const breakpoint = compileBreakpoint(
        22,
        3,
        {
            condition:
                "CONT([2, 4], i)"
        }
    );
    const control =
        new ExecutionControlFileSession({
            controlPath:
                fixture.controlPath,
            logger: silentLogger()
        }).start({
            breakpoints: [breakpoint]
        });
    const execution = startRuntime(fixture);

    try {
        const stopped =
            await waitForTraceEvent(
                fixture.tracePath,
                event =>
                    event.type === "stopped" &&
                    event.reason ===
                        "breakpoint"
            );
        const locals = Object.fromEntries(
            stopped.state.frames[0]
                .locals.map(variable => [
                    variable.name,
                    variable.value
                ])
        );

        assert.deepEqual(
            stopped.breakpointIds,
            [22]
        );
        assert.equal(locals.i, "2");

        control.setBreakpoints([]);
        control.continue();
        assert.equal(
            (await execution.close).code,
            0
        );
    } finally {
        await finishFixture(
            fixture,
            control,
            execution
        );
    }
});

test("los logpoints interpolan estado y funciones estándar sin pausar", {
    timeout: 15000
}, async () => {
    const fixture = createFixture([
        "PRINCIPAL()",
        "    A[0] = 5",
        "    A[1] = 8",
        "    para i = 0 hasta 1",
        "        valor = A[i]",
        "        escribir valor",
        ""
    ]);
    const breakpoint = compileBreakpoint(
        31,
        6,
        {
            logMessage:
                "Iteración {i}: {valor}; tamaño={LONG(A)}"
        }
    );
    const control =
        new ExecutionControlFileSession({
            controlPath:
                fixture.controlPath,
            logger: silentLogger()
        }).start({
            breakpoints: [breakpoint]
        });
    const execution = startRuntime(fixture);

    try {
        const result = await execution.close;
        const events =
            readTrace(fixture.tracePath);
        const outputs = events
            .filter(event =>
                event.type === "output"
            );

        assert.equal(result.code, 0);
        assert.deepEqual(
            outputs.map(event =>
                event.output
            ),
            [
                "Iteración 0: 5; tamaño=2\n",
                "Iteración 1: 8; tamaño=2\n"
            ]
        );
        assert.deepEqual(
            outputs.map(event =>
                event.breakpointId
            ),
            [31, 31]
        );
        assert.equal(
            events.filter(event =>
                event.type === "stopped"
            ).length,
            0
        );
    } finally {
        await finishFixture(
            fixture,
            control,
            execution
        );
    }
});

test("un breakpoint alcanzado activa dinámicamente su breakpoint dependiente", {
    timeout: 15000
}, async () => {
    const fixture = createFixture([
        "PRINCIPAL()",
        "    para i = 1 hasta 3",
        "        si i == 2",
        "            activador = i",
        "        objetivo = i",
        "    escribir objetivo",
        ""
    ]);
    const activator = compileBreakpoint(
        41,
        4
    );
    const dependent = compileBreakpoint(
        42,
        5
    );
    const control =
        new ExecutionControlFileSession({
            controlPath:
                fixture.controlPath,
            logger: silentLogger()
        }).start({
            breakpoints: [activator]
        });
    const execution = startRuntime(fixture);

    try {
        const first =
            await waitForTraceEvent(
                fixture.tracePath,
                event =>
                    event.type === "stopped" &&
                    event.location
                        ?.startLine === 4
            );

        assert.deepEqual(
            first.breakpointIds,
            [41]
        );

        const cursor =
            readTrace(fixture.tracePath)
                .length;

        control.setBreakpoints([
            activator,
            dependent
        ]);
        control.continue();

        const second =
            await waitForTraceEventAfter(
                fixture.tracePath,
                cursor,
                event =>
                    event.type === "stopped" &&
                    event.location
                        ?.startLine === 5
            );

        assert.deepEqual(
            second.breakpointIds,
            [42]
        );
        assert.equal(
            second.state.frames[0]
                .locals.find(variable =>
                    variable.name === "i"
                ).value,
            "2"
        );

        control.setBreakpoints([]);
        control.continue();
        assert.equal(
            (await execution.close).code,
            0
        );
    } finally {
        await finishFixture(
            fixture,
            control,
            execution
        );
    }
});

test("pausar y detener cancelan el runtime de forma controlada", {
    timeout: 15000
}, async () => {
    const fixture = createFixture();
    const control =
        new ExecutionControlFileSession({
            controlPath:
                fixture.controlPath,
            logger: silentLogger()
        }).start();

    control.pause();

    const execution =
        startRuntime(fixture);

    try {
        await waitForTraceEvent(
            fixture.tracePath,
            event =>
                event.type === "stopped" &&
                event.reason === "pause"
        );

        control.terminate();

        const result =
            await execution.close;
        const events =
            readTrace(fixture.tracePath);

        assert.equal(result.code, 0);
        assert.deepEqual(
            events.at(-1),
            {
                type: "end",
                status: "cancelled"
            }
        );
        assert.match(
            execution.stdout,
            /Estado: Cancelado/
        );
    } finally {
        await finishFixture(
            fixture,
            control,
            execution
        );
    }
});

test("la pausa conserva globales, arreglos y activaciones anidadas", {
    timeout: 15000
}, async () => {
    const fixture = createFixture([
        "base = 10",
        "A[0] = 5",
        "CALCULA(x)",
        "    local = x + base",
        "    retornar local",
        "PRINCIPAL()",
        "    resultado = CALCULA(A[0])",
        "    escribir resultado",
        ""
    ]);
    const control =
        new ExecutionControlFileSession({
            controlPath:
                fixture.controlPath,
            logger: silentLogger()
        }).start({
            breakpoints: [5]
        });
    const execution =
        startRuntime(fixture);

    try {
        const stopped =
            await waitForTraceEvent(
                fixture.tracePath,
                event =>
                    event.type === "stopped" &&
                    event.location
                        ?.startLine === 5
            );
        const [principal, calcula] =
            stopped.state.frames;
        const global =
            stopped.state.globals.find(
                variable =>
                    variable.name === "base"
            );
        const array =
            stopped.state.globals.find(
                variable =>
                    variable.name === "A"
            );

        assert.equal(global.value, "10");
        assert.equal(array.type, "arreglo");
        assert.equal(
            array.children[0].value,
            "5"
        );
        assert.equal(principal.name, "PRINCIPAL");
        assert.equal(
            principal.locals[0].value,
            "indefinido"
        );
        assert.equal(calcula.name, "CALCULA");
        assert.deepEqual(
            calcula.parameters.map(item =>
                [item.name, item.value]
            ),
            [["x", "5"]]
        );
        assert.deepEqual(
            calcula.locals.map(item =>
                [item.name, item.value]
            ),
            [["local", "15"]]
        );

        control.terminate();
        await execution.close;
    } finally {
        await finishFixture(
            fixture,
            control,
            execution
        );
    }
});

test("depura arreglos literales anidados y conserva el origen de sus llamadas", {
    timeout: 15000
}, async () => {
    const fixture = createFixture([
        "base = [10, [\"global\"]]",
        "CREA(valor)",
        "    local = [valor, [valor + 1]]",
        "    retornar local",
        "PRINCIPAL()",
        "    resultado = [CREA(base[0]), [base[1][0]]]",
        "    marcador = 1",
        "    escribir resultado[0][1][0]",
        ""
    ]);
    const control =
        new ExecutionControlFileSession({
            controlPath:
                fixture.controlPath,
            logger: silentLogger()
        }).start({
            breakpoints: [4, 7]
        });
    const execution = startRuntime(fixture);

    try {
        const inside =
            await waitForTraceEvent(
                fixture.tracePath,
                event =>
                    event.type === "stopped" &&
                    event.location
                        ?.startLine === 4
            );
        const [principal, crea] =
            inside.state.frames;
        const global =
            inside.state.globals.find(
                variable =>
                    variable.name === "base"
            );
        const local = crea.locals.find(
            variable =>
                variable.name === "local"
        );

        assert.equal(
            inside.location.startLine,
            4
        );
        assert.equal(
            principal.location.startLine,
            6
        );
        assert.equal(global.type, "arreglo");
        assert.equal(global.value, "Arreglo(2)");
        assert.equal(
            global.children[1].type,
            "arreglo"
        );
        assert.equal(
            global.children[1]
                .children[0].value,
            "\"global\""
        );
        assert.equal(local.type, "arreglo");
        assert.equal(
            local.children[0].value,
            "10"
        );
        assert.equal(
            local.children[1]
                .children[0].value,
            "11"
        );
        assert.equal(
            principal.locals.find(
                variable =>
                    variable.name ===
                    "resultado"
            ).value,
            "indefinido"
        );

        const cursor =
            readTrace(fixture.tracePath)
                .length;

        control.continue();

        const returned =
            await waitForTraceEventAfter(
                fixture.tracePath,
                cursor,
                event =>
                    event.type === "stopped" &&
                    event.location
                        ?.startLine === 7
            );
        const result =
            returned.state.frames[0]
                .locals.find(
                    variable =>
                        variable.name ===
                        "resultado"
                );

        assert.equal(
            returned.state.frames.length,
            1
        );
        assert.equal(result.type, "arreglo");
        assert.equal(
            result.children[0]
                .children[1]
                .children[0].value,
            "11"
        );
        assert.equal(
            result.children[1]
                .children[0].value,
            "\"global\""
        );

        control.continue();
        assert.equal(
            (await execution.close).code,
            0
        );
    } finally {
        await finishFixture(
            fixture,
            control,
            execution
        );
    }
});

test("cada llamada recursiva conserva su propio parámetro", {
    timeout: 15000
}, async () => {
    const fixture = createFixture([
        "CUENTA(n)",
        "    si n > 0",
        "        retornar CUENTA(n - 1)",
        "    retornar n",
        "PRINCIPAL()",
        "    resultado = CUENTA(3)",
        ""
    ]);
    const control =
        new ExecutionControlFileSession({
            controlPath:
                fixture.controlPath,
            logger: silentLogger()
        }).start({
            breakpoints: [4]
        });
    const execution =
        startRuntime(fixture);

    try {
        const stopped =
            await waitForTraceEvent(
                fixture.tracePath,
                event =>
                    event.type === "stopped" &&
                    event.location
                        ?.startLine === 4
            );
        const recursiveFrames =
            stopped.state.frames.filter(
                frame =>
                    frame.name === "CUENTA"
            );

        assert.deepEqual(
            recursiveFrames.map(frame =>
                frame.parameters[0].value
            ),
            ["3", "2", "1", "0"]
        );

        control.terminate();
        await execution.close;
    } finally {
        await finishFixture(
            fixture,
            control,
            execution
        );
    }
});

test("la detenciÃ³n activa un corte forzado si el runtime no responde", () => {
    const writes = [];
    const timers = new Map();
    const cleared = [];
    let nextTimer = 1;
    let forcedCount = 0;
    const control =
        new ExecutionControlFileSession({
            controlPath: "control.json",
            logger: silentLogger(),
            fileSystem: {
                writeFileSync(
                    filePath,
                    contents
                ) {
                    writes.push({
                        filePath,
                        contents
                    });
                },
                existsSync() {
                    return false;
                },
                unlinkSync() {}
            },
            setTimeout(callback, delay) {
                const id = nextTimer++;

                timers.set(id, {
                    callback,
                    delay
                });
                return id;
            },
            clearTimeout(id) {
                cleared.push(id);
                timers.delete(id);
            },
            onTerminateTimeout() {
                forcedCount += 1;
            }
        }).start();

    control.terminate();

    assert.equal(
        JSON.parse(
            writes.at(-1).contents
        ).command,
        "terminate"
    );
    assert.equal(
        timers.get(1).delay,
        300
    );

    timers.get(1).callback();
    assert.equal(forcedCount, 1);

    control.terminate();
    const pendingCallback =
        timers.get(2).callback;

    control.dispose();
    pendingCallback();

    assert.deepEqual(cleared, [2]);
    assert.equal(forcedCount, 1);
});

test("stopOnEntry omite la invocaciÃ³n automÃ¡tica y se detiene dentro de PRINCIPAL", {
    timeout: 15000
}, async () => {
    const fixture = createFixture();
    const control =
        new ExecutionControlFileSession({
            controlPath:
                fixture.controlPath,
            logger: silentLogger()
        }).start({
            stopOnEntry: true
        });
    const execution = startRuntime(fixture);

    try {
        const stopped =
            await waitForTraceEvent(
                fixture.tracePath,
                event =>
                    event.type === "stopped" &&
                    event.reason === "entry"
            );

        assert.equal(
            stopped.location.startLine,
            2
        );
        assert.equal(
            stopped.state.frames[0].name,
            "PRINCIPAL"
        );

        control.terminate();

        const result = await execution.close;

        assert.equal(result.code, 0);
        assert.deepEqual(
            readTrace(fixture.tracePath).at(-1),
            {
                type: "end",
                status: "cancelled"
            }
        );
    } finally {
        await finishFixture(
            fixture,
            control,
            execution
        );
    }
});

function createFixture(sourceLines = null) {
    const directory =
        mkdtempSync(
            path.join(
                os.tmpdir(),
                "clrs-debug-control-"
            )
        );
    const sourcePath = path.join(
        directory,
        "programa.clrs"
    );
    const tracePath = path.join(
        directory,
        "trace.jsonl"
    );
    const controlPath = path.join(
        directory,
        "control.json"
    );

    writeFileSync(
        sourcePath,
        (
            sourceLines ?? [
                "PRINCIPAL()",
                "    dato = 1",
                "    dato = 2",
                "    escribir dato",
                ""
            ]
        ).join("\n"),
        "utf8"
    );

    return {
        directory,
        sourcePath,
        tracePath,
        controlPath
    };
}

function startRuntime(fixture) {
    const child = spawn(
        process.execPath,
        [
            path.resolve(
                "src/compiler/CliEntry.js"
            ),
            fixture.sourcePath,
            "--trace-file",
            fixture.tracePath,
            "--control-file",
            fixture.controlPath
        ],
        {
            cwd: process.cwd(),
            stdio: [
                "ignore",
                "pipe",
                "pipe"
            ]
        }
    );
    const execution = {
        child,
        closed: false,
        stdout: "",
        stderr: "",
        close: null
    };

    child.stdout.on("data", chunk => {
        execution.stdout += String(chunk);
    });
    child.stderr.on("data", chunk => {
        execution.stderr += String(chunk);
    });
    execution.close = new Promise(
        (resolve, reject) => {
            child.once("error", reject);
            child.once(
                "close",
                (code, signal) => {
                    execution.closed = true;
                    resolve({ code, signal });
                }
            );
        }
    );

    return execution;
}

async function waitForTraceEvent(
    tracePath,
    predicate
) {
    const deadline = Date.now() + 10000;

    while (Date.now() < deadline) {
        const event =
            readTrace(tracePath)
                .find(predicate);

        if (event) {
            return event;
        }

        await new Promise(resolve =>
            setTimeout(resolve, 25)
        );
    }

    assert.fail(
        "El runtime no emitió el evento de depuración esperado."
    );
}

async function waitForTraceEventAfter(
    tracePath,
    cursor,
    predicate
) {
    const deadline = Date.now() + 10000;

    while (Date.now() < deadline) {
        const event =
            readTrace(tracePath)
                .slice(cursor)
                .find(predicate);

        if (event) {
            return event;
        }

        await new Promise(resolve =>
            setTimeout(resolve, 25)
        );
    }

    assert.fail(
        "El runtime no emitió el nuevo evento de depuración esperado."
    );
}

function readTrace(tracePath) {
    if (!existsSync(tracePath)) {
        return [];
    }

    return String(
        readFileSync(tracePath, "utf8")
    ).split("\n")
        .filter(line => line.trim() !== "")
        .flatMap(line => {
            try {
                return [JSON.parse(line)];
            } catch {
                return [];
            }
        });
}

async function finishFixture(
    fixture,
    control,
    execution
) {
    if (!execution.closed) {
        control.terminate();

        await Promise.race([
            execution.close,
            new Promise(resolve =>
                setTimeout(resolve, 500)
            )
        ]);
    }

    if (!execution.closed) {
        execution.child.kill();
    }

    control.dispose();
    rmSync(
        fixture.directory,
        {
            recursive: true,
            force: true
        }
    );
}

function compileBreakpoint(
    id,
    line,
    options = {}
) {
    const compiled =
        new BreakpointExpressionCompiler()
            .compileBreakpoint(options);

    assert.equal(
        compiled.ok,
        true,
        compiled.error
    );

    return {
        id,
        line,
        column: null,
        ...compiled.value
    };
}

function silentLogger() {
    return {
        error() {}
    };
}
