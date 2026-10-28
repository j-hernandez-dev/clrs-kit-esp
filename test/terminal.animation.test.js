import test from "node:test";
import assert from "node:assert/strict";

import {
    GuiRuntimeProgressPresenter
} from "../src/application/presenters/GuiRuntimeProgressPresenter.js";
import {
    TerminalSpinner
} from "../src/application/presenters/TerminalSpinner.js";
import {
    TerminalUI
} from "../src/application/presenters/TerminalUI.js";

const CLEAR_LINE = "\r\u001b[2K";

test("spinner: una operación menor al retardo no produce frames", () => {
    const writes = [];
    const scheduler = fakeScheduler();
    const spinner = new TerminalSpinner({
        terminalUI: terminalUI(
            writes,
            { isTTY: true }
        ),
        scheduler
    });

    spinner.start("Operación corta");
    spinner.stop();
    scheduler.runDelay();

    assert.deepEqual(writes, []);
    assert.equal(
        scheduler.pendingCount(),
        0
    );
});

test("spinner: espera real actualiza una línea y la limpia al terminar", () => {
    const writes = [];
    const scheduler = fakeScheduler();
    const spinner = new TerminalSpinner({
        terminalUI: terminalUI(
            writes,
            { isTTY: true }
        ),
        scheduler,
        delayMs: 200,
        intervalMs: 80
    });

    spinner.start("Preparando dependencias");
    assert.deepEqual(writes, []);

    scheduler.runDelay();
    scheduler.runInterval();
    spinner.stop();

    assert.match(writes[0], /⠋/u);
    assert.match(writes[1], /⠙/u);
    assert.equal(writes.at(-1), CLEAR_LINE);
    assert.equal(
        scheduler.pendingCount(),
        0
    );
    assert.doesNotMatch(
        writes.join(""),
        /\u001b\[\?25[hl]/u
    );
});

test("spinner: una salida no TTY usa estado textual sin frames ni controles", () => {
    const writes = [];
    const lines = [];
    const scheduler = fakeScheduler();
    const spinner = new TerminalSpinner({
        terminalUI: terminalUI(
            writes,
            { isTTY: false }
        ),
        scheduler,
        writeLine(message) {
            lines.push(message);
        }
    });

    spinner.start(
        "Preparando dependencias"
    );
    scheduler.runDelay();
    scheduler.runInterval();
    spinner.stop();

    assert.deepEqual(writes, []);
    assert.deepEqual(
        lines,
        ["▶ Preparando dependencias"]
    );
    assert.doesNotMatch(
        lines.join(""),
        /⠋|⠙|\u001b\[|\r/u
    );
    assert.equal(
        scheduler.createdCount(),
        0
    );
});

test("spinner: NO_COLOR conserva actualizaciones TTY sin aplicar color", () => {
    const writes = [];
    const scheduler = fakeScheduler();
    const spinner = new TerminalSpinner({
        terminalUI: terminalUI(
            writes,
            {
                isTTY: true,
                environment: {
                    NO_COLOR: "1"
                }
            }
        ),
        scheduler
    });

    spinner.start(
        "Preparando dependencias"
    );
    scheduler.runDelay();
    spinner.stop();

    assert.match(writes[0], /⠋/u);
    assert.equal(writes.at(-1), CLEAR_LINE);
    assert.doesNotMatch(
        writes[0].slice(CLEAR_LINE.length),
        /\u001b\[(?:2|3)[0-9]?m/u
    );
});

test("spinner: una terminal estrecha trunca la línea antes de provocar wrap", () => {
    const writes = [];
    const scheduler = fakeScheduler();
    const stream = {
        isTTY: true,
        columns: 16,
        write(message) {
            writes.push(message);
        }
    };
    const spinner = new TerminalSpinner({
        terminalUI: new TerminalUI({
            stream,
            environment: {}
        }),
        scheduler
    });

    spinner.start(
        "Preparando dependencias muy extensas"
    );
    scheduler.runDelay();
    spinner.stop();

    const visibleLine = writes[0]
        .slice(CLEAR_LINE.length)
        .replace(
            /\u001b\[[0-?]*[ -/]*[@-~]/gu,
            ""
        );

    assert.ok(
        Array.from(visibleLine).length <= 15
    );
    assert.match(visibleLine, /…$/u);
});

test("GUI spinner: dispose elimina timers y limpia una línea visible", () => {
    const writes = [];
    const scheduler = fakeScheduler();
    const progress =
        new GuiRuntimeProgressPresenter({
            logger: { log() {} },
            stream: {
                isTTY: true,
                columns: 80,
                write(message) {
                    writes.push(message);
                }
            },
            environment: {},
            scheduler
        });

    progress.present("PLATFORM_READY");
    progress.present("INSTALLING");
    scheduler.runDelay();
    progress.dispose();
    progress.dispose();

    assert.equal(writes.at(-1), CLEAR_LINE);
    assert.equal(
        scheduler.pendingCount(),
        0
    );
});

test("progreso: sólo calcula porcentaje con bytes recibidos y total fiables", () => {
    const writes = [];
    const stream = {
        isTTY: true,
        columns: 32,
        write(message) {
            writes.push(message);
        }
    };
    const ui = new TerminalUI({
        stream,
        environment: {},
        ansiEnabled: false
    });
    const formatted = ui.progress(63, 100);

    assert.match(formatted, / 63%$/u);
    assert.match(formatted, /╸/u);
    assert.equal(
        ui.updateProgress(63, 100),
        true
    );
    assert.equal(
        writes[0],
        CLEAR_LINE + formatted
    );
    assert.equal(ui.progress(10), null);
    assert.equal(
        ui.updateProgress(10),
        false
    );
    assert.equal(writes.length, 1);
});

test("progreso: una salida redirigida nunca recibe controles de línea", () => {
    const writes = [];
    const ui = terminalUI(
        writes,
        { isTTY: false }
    );

    assert.equal(
        ui.updateProgress(50, 100),
        false
    );
    assert.deepEqual(writes, []);
    assert.match(
        ui.progress(50, 100),
        / 50%$/u
    );
});

for (const terminalState of [
    {
        state: "READY",
        expected:
            "✓ Entorno gráfico preparado"
    },
    {
        state: "FAILED",
        expected:
            "✕ No se pudo preparar el entorno gráfico"
    },
    {
        state: "CANCELLED",
        expected:
            "■ Preparación del entorno gráfico cancelada"
    }
]) {
    test(`GUI spinner: limpia la línea antes de ${terminalState.state}`, () => {
        const events = [];
        const scheduler = fakeScheduler();
        const stream = {
            isTTY: true,
            columns: 80,
            write(message) {
                events.push({
                    type: "stream",
                    message
                });
            }
        };
        const progress =
            new GuiRuntimeProgressPresenter({
                logger: {
                    log(message) {
                        events.push({
                            type: "log",
                            message
                        });
                    }
                },
                stream,
                environment: {},
                scheduler
            });

        progress.present("PLATFORM_READY");
        progress.present("INSTALLING");
        scheduler.runDelay();
        progress.present(
            terminalState.state
        );

        const clearIndex =
            events.findIndex(event =>
                event.type === "stream" &&
                event.message === CLEAR_LINE
            );
        const statusIndex =
            events.findIndex(event =>
                event.type === "log" &&
                event.message.includes(
                    terminalState.expected
                )
            );

        assert.ok(clearIndex >= 0);
        assert.ok(statusIndex > clearIndex);
        assert.equal(
            scheduler.pendingCount(),
            0
        );
    });
}

function terminalUI(
    writes,
    options
) {
    const stream = {
        isTTY: options.isTTY,
        columns: 80,
        write(message) {
            writes.push(message);
        }
    };

    return new TerminalUI({
        stream,
        environment:
            options.environment ?? {}
    });
}

function fakeScheduler() {
    let delayTask = null;
    let intervalTask = null;
    let created = 0;

    return {
        setTimeout(callback) {
            created += 1;
            delayTask = callback;
            return "delay";
        },
        clearTimeout() {
            delayTask = null;
        },
        setInterval(callback) {
            created += 1;
            intervalTask = callback;
            return "interval";
        },
        clearInterval() {
            intervalTask = null;
        },
        runDelay() {
            const callback = delayTask;
            delayTask = null;
            callback?.();
        },
        runInterval() {
            intervalTask?.();
        },
        pendingCount() {
            return Number(delayTask != null) +
                Number(intervalTask != null);
        },
        createdCount() {
            return created;
        }
    };
}
