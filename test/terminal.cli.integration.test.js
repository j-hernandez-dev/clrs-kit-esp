import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { standartLibrary } from "../src/compiler/StandartLibrary.js";
import { NodeProgramRunner } from "../src/compiler/adapters/NodeProgramRunner.js";
import { EventEmitter } from "node:events";

const cli = fileURLToPath(new URL("../src/compiler/CliEntry.js", import.meta.url));

test("LEER: sólo el AbortError específico de Ctrl+C se clasifica como cancelación y cierra readline", async () => {
    const source = standartLibrary.slice(standartLibrary.indexOf("async function inputData_"),
        standartLibrary.indexOf("// FILES"));
    for (const message of ["Aborted with Ctrl+C", "Otro error de entrada"]) {
        let closed = 0;
        const error = Object.assign(new Error(message), { name: "AbortError" });
        const read = new Function("createInterface", "process", "input", "output", `return (${source.trim()});`)(
            () => ({ async question() { throw error; }, close() { closed += 1; } }),
            { env: {} }, {}, {});
        await assert.rejects(read(), value => value === error);
        assert.equal(closed, 1);
        assert.equal(error.clrsInputCancelled === true, message === "Aborted with Ctrl+C");
    }
});

test("runner: cancelación de readline mantiene código 70 y presenta Cancelado con tiempo", async () => {
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    const output = [];
    const runner = new NodeProgramRunner({
        spawn() {
            queueMicrotask(() => {
                child.emit("spawn");
                child.stderr.emit("data", "■ Ejecución cancelada durante la entrada.\n");
                child.emit("close", 70, null);
            });
            return child;
        },
        logger: { log: value => output.push(value), error: value => output.push(value) },
        standardOutput: { isTTY: false }, standardError: { isTTY: false }
    });
    await assert.rejects(runner.run({ programPath: "fixture.js" }), error => error.exitCode === 70);
    assert.match(output.join("\n"), /■ Estado: Cancelado\n⌛︎Tiempo: \d+ ms/u);
    assert.doesNotMatch(output.join("\n"), /Error de ejecución/u);
});

async function execute(t, source, input = []) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "clrs-terminal-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const file = path.join(directory, "programa.clrs");
    await writeFile(file, source);
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [cli, file], {
            env: { ...process.env, NO_COLOR: "1" },
            stdio: ["pipe", "pipe", "pipe"]
        });
        let stdout = "", stderr = "", prompts = 0;
        const timer = setTimeout(() => { child.kill(); reject(new Error("CLI timeout")); }, 10000);
        child.stdout.on("data", chunk => {
            stdout += chunk;
            const available = stdout.split("> ").length - 1;
            while (prompts < available && prompts < input.length) {
                child.stdin.write(input[prompts++] + "\n");
            }
        });
        child.stderr.on("data", chunk => { stderr += chunk; });
        child.once("error", error => { clearTimeout(timer); reject(error); });
        child.once("close", code => { clearTimeout(timer); resolve({ stdout, stderr, code }); });
    });
}

test("CLI real: ESCRIBIR y LEER sucesivos preservan texto/número sin ANSI en pipes", async t => {
    const result = await execute(t, ["PRINCIPAL()", "    dato = NULO", "    otro = NULO",
        "    escribir \"Hola, CLRS\"", "    leer dato", "    escribir dato",
        "    leer otro", "    escribir otro"].join("\n"), ["texto exacto", "42"]);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Hola, CLRS\n> texto exacto\n> 42\n/u);
    assert.match(result.stdout, /✓ Estado: Correcto\n⌛︎Tiempo: \d+ ms/u);
    assert.doesNotMatch(result.stdout, /\u001b|Preparando entorno gráfico|⠋/u);
});

for (const [name, source, title, runtime] of [
    ["léxico", "dato = @", "Error léxico", false],
    ["sintáctico", "escribir ,", "Error de sintaxis", false],
    ["semántico", "escribir desconocido", "Error semántico", false],
    ["runtime", 'PRINCIPAL()\n    LANZAR_ERROR("Mensaje exacto")', "Error de ejecución", true]
]) {
    test(`CLI real: diagnóstico ${name} conserva ubicación y duración sólo tras spawn`, async t => {
        const result = await execute(t, source);
        assert.equal(result.code, 1);
        assert.ok(result.stderr.includes(title));
        assert.match(result.stderr, /Línea \d+, columna \d+/u);
        const all = result.stdout + result.stderr;
        assert.equal(all.split("● CLRS Runtime").length - 1, 1);
        assert.equal(all.split("Estado:").length - 1, 1);
        assert.equal(/⌛︎Tiempo: \d+ ms/u.test(all), runtime);
        assert.doesNotMatch(all, /\u001b|⠋/u);
        if (runtime) { assert.match(result.stderr, /Mensaje exacto/u); }
    });
}
