import assert from "node:assert/strict";
import test from "node:test";

import { VSCodeCodeHost } from "../extension/adapters/VSCodeCodeHost.js";
import { createJavaScriptProjectOutputLines } from "../extension/presentation/JavaScriptProjectOutput.js";

const commonProjectLines = [
    "El código se generó en: C:/proyecto/app/programa/programa.js",
    "Proyecto JavaScript: C:/proyecto/app/programa",
    "",
    "Para preparar el proyecto:",
    "  npm ci",
    "",
    "Para ejecutarlo:",
    "  npm start",
    "",
    "Para generar un ejecutable distribuible:",
    "  Windows:      npm run build:win",
    "  Linux/macOS:  npm run build:unix",
    ""
];

test("salida de exportación CLI: muestra Node y omite por completo requisitos GUI", () => {
    const lines = createJavaScriptProjectOutputLines("C:/proyecto/app/programa/programa.js", {
        kind: "node-project", exportProfile: "cli", projectDirectory: "C:/proyecto/app/programa",
        backupPath: "C:/proyecto/app/.programa.backup-1"
    });
    assert.deepEqual(lines, [...commonProjectLines,
        "Requiere Node compatible para preparar, ejecutar desde código fuente y construir el proyecto.",
        "Los recursos externos no se incluyen automáticamente en el ejecutable.",
        "",
        "La exportación anterior se conservó en: C:/proyecto/app/.programa.backup-1"
    ]);
    const text = lines.join("\n");
    assert.doesNotMatch(text, /GTK|node-gtk|runtime gráfico|bootstrap|packable/iu);
    assert.equal(Object.isFrozen(lines), true);
});

test("salida de exportación GUI: conserva GTK y los mismos comandos de proyecto", () => {
    const lines = createJavaScriptProjectOutputLines("C:/proyecto/app/programa/programa.js", {
        kind: "node-project", exportProfile: "gui", projectDirectory: "C:/proyecto/app/programa"
    });
    assert.deepEqual(lines, [...commonProjectLines,
        "Requiere Node compatible y GTK 4.10 o superior según tu sistema.",
        "Los recursos externos no se copian automáticamente."
    ]);
    assert.match(lines.join("\n"), /GTK 4\.10/u);
});

test("salida de exportación: archivo histórico y perfil desconocido tienen fallback seguro", () => {
    assert.deepEqual(createJavaScriptProjectOutputLines("C:/proyecto/programa.js"),
        ["El código se generó en: C:/proyecto/programa.js"]);
    const unknown = createJavaScriptProjectOutputLines("C:/proyecto/app/programa/programa.js", {
        kind: "node-project", exportProfile: "desconocido", projectDirectory: "C:/proyecto/app/programa"
    });
    assert.match(unknown.join("\n"), /Requiere Node compatible/u);
    assert.doesNotMatch(unknown.join("\n"), /GTK|node-gtk/iu);
});

test("salida de exportación: VS Code escribe las líneas del presentador sin Webview", () => {
    const lines = [];
    let cleared = 0, shown = 0;
    const host = new VSCodeCodeHost({ window: { createOutputChannel: () => ({
        clear() { cleared++; }, show() { shown++; }, appendLine(line) { lines.push(line); }
    }) } }, { outputChannelName: "CLRS" });
    const project = { kind: "node-project", exportProfile: "cli", projectDirectory: "/proyecto/app/consola" };
    host.showGeneratedPath("/proyecto/app/consola/consola.js", project);

    assert.equal(cleared, 1);
    assert.equal(shown, 1);
    assert.deepEqual(lines, createJavaScriptProjectOutputLines("/proyecto/app/consola/consola.js", project));
});
