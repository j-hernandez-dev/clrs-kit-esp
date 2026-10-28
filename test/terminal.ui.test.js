import test from "node:test";
import assert from "node:assert/strict";

import {
    TerminalUI,
    ansi,
    hasNoColor,
    isTTY,
    supportsAnsi
} from "../src/application/presenters/TerminalUI.js";

const ESCAPE_PATTERN = /\u001b\[/u;

test("TerminalUI en TTY presenta la identidad y estados con ANSI", () => {
    const terminalUI = new TerminalUI({
        stream: { isTTY: true },
        environment: {}
    });
    const presentation = [
        terminalUI.header("programa.clrs"),
        terminalUI.success("Estado: Correcto"),
        terminalUI.error("Estado: Error"),
        terminalUI.warning("Revisa el programa"),
        terminalUI.cancellation(
            "Estado: Cancelado"
        )
    ].join("\n");

    assert.match(presentation, ESCAPE_PATTERN);
    assert.match(presentation, /● CLRS Runtime/u);
    assert.match(presentation, /▶ programa\.clrs/u);
    assert.match(presentation, /✓ Estado: Correcto/u);
    assert.match(presentation, /✕ Estado: Error/u);
    assert.match(presentation, /! Revisa el programa/u);
    assert.match(presentation, /■ Estado: Cancelado/u);
    assert.match(
        terminalUI.time(180.4),
        /⌛︎Tiempo: 180 ms/u
    );
});

test("TerminalUI fuera de TTY produce texto plano sin escapes", () => {
    const terminalUI = new TerminalUI({
        stream: { isTTY: false },
        environment: {}
    });
    const presentation = [
        terminalUI.header("programa.clrs"),
        terminalUI.status("Correcto"),
        terminalUI.time(24)
    ].join("\n");

    assert.doesNotMatch(
        presentation,
        ESCAPE_PATTERN
    );
    assert.equal(
        presentation,
        [
            "● CLRS Runtime",
            "─".repeat(60),
            "▶ programa.clrs",
            "✓ Estado: Correcto",
            "⌛︎Tiempo: 24 ms"
        ].join("\n")
    );
});

test("TerminalUI respeta NO_COLOR incluso en TTY", () => {
    const terminalUI = new TerminalUI({
        stream: { isTTY: true },
        environment: { NO_COLOR: "1" }
    });

    assert.equal(
        terminalUI.error("Estado: Error"),
        "✕ Estado: Error"
    );
    assert.equal(
        supportsAnsi(
            { isTTY: true },
            { NO_COLOR: "" }
        ),
        false
    );
});

test("helpers de terminal detectan TTY y aplican ANSI sólo al habilitarlo", () => {
    assert.equal(isTTY({ isTTY: true }), true);
    assert.equal(isTTY({ isTTY: false }), false);
    assert.equal(hasNoColor({}), false);
    assert.equal(
        hasNoColor({ NO_COLOR: "" }),
        true
    );
    assert.equal(
        ansi("texto", "green", false),
        "texto"
    );
    assert.match(
        ansi("texto", "green", true),
        /^\u001b\[32mtexto\u001b\[0m$/u
    );
});
