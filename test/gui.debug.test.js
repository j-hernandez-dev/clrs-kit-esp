import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { guiDapHarness } from "./fixtures/gui/GuiDapHarness.js";

const stops = f => f.events.filter(e => e.type === "stopped");
async function stop(f, count) { await f.wait(() => stops(f).length >= count); return stops(f)[count - 1]; }
async function completed(f, status = "correct", code = 0) {
    const result = await f.completion;
    assert.equal(result.code, code, result.stderr);
    assert.equal(f.events.filter(e => e.type === "end").length, 1);
    assert.equal(f.events.at(-1).status, status);
    assert.equal(f.messages.filter(e => e.event === "terminated").length, 1);
    assert.doesNotMatch(result.stderr, /UnhandledPromise|Gtk[A-Z]|node_modules/);
    return result;
}
const base = ['PRINCIPAL()', '    VENTANA_APLICACION("v", "Depurar")', '    ENTRADA("e")',
    '    CONTENER("v", "e")', '    MOSTRAR("v")'];

test("GUI DAP: entry, breakpoints y pasos sobre API sin exponer GTK", { timeout: 15000 }, async t => {
    const f = await guiDapHarness([...base, '    id = "e"', '    ESTABLECER(id, "texto", "hola")', '    CERRAR("v")'].join("\n"), { stopOnEntry: true });
    t.after(() => f.dispose());
    assert.equal((await stop(f, 1)).location.startLine, 2);
    f.setBreakpoints([{ line: 7 }]); f.request("continue");
    const event = await stop(f, 2);
    assert.equal(event.reason, "breakpoint"); assert.equal(event.location.startLine, 7);
    assert.equal(event.state.frames[0].locals.find(v => v.name === "id").value, '"e"');
    const stack = f.request("stackTrace").stackFrames;
    assert.deepEqual(stack.map(s => s.name), ["PRINCIPAL", "Programa CLRS"]);
    const scopes = f.request("scopes", { frameId: stack[0].id }).scopes;
    assert.ok(scopes.some(s => f.request("variables", { variablesReference: s.variablesReference }).variables.some(v => v.name === "id")));
    assert.doesNotMatch(JSON.stringify(event.state), /Gtk|GObject|records|settings|components/);
    f.request("stepIn"); assert.equal((await stop(f, 3)).location.startLine, 8);
    f.request("continue"); await completed(f);
});

test("GUI DAP: callback inmediato conserva retorno, Step Into y Step Out al llamador", { timeout: 15000 }, async t => {
    const source = ['AL_CERRAR(id)', '    permitir = VERDAD', '    retornar no permitir', ...base,
        '    CONECTAR("v", "cerrar", AL_CERRAR)', '    CERRAR("v")', '    escribir "FIN"'].join("\n");
    const f = await guiDapHarness(source, { breakpoints: [{ line: 10 }] }); t.after(() => f.dispose());
    assert.equal((await stop(f, 1)).location.startLine, 10);
    f.request("stepIn"); assert.equal((await stop(f, 2)).location.startLine, 2);
    assert.deepEqual(f.request("stackTrace").stackFrames.map(x => x.name), ["AL_CERRAR", "PRINCIPAL", "Programa CLRS"]);
    f.request("stepOut"); assert.equal((await stop(f, 3)).location.startLine, 11);
    f.request("continue"); assert.match((await completed(f)).stdout, /FIN/);
});

test("GUI DAP: cierre externo no hereda la pila suspendida y Step Out vuelve a la espera", { timeout: 15000 }, async t => {
    const source = ['AL_CERRAR(id)', '    impedir = VERDAD', '    retornar impedir', ...base,
        '    DIALOGO_ARCHIVO("f")', '    CONECTAR("v", "cerrar", AL_CERRAR)', '    ruta = ABRIR_ARCHIVO("f", "v")'].join("\n");
    const f = await guiDapHarness(source, { breakpoints: [{ line: 2 }] }); t.after(() => f.dispose());
    await f.wait(() => f.events.some(e => e.type === "location" && e.location.startLine === 11));
    await f.action({ type: "close" });
    const event = await stop(f, 1);
    assert.deepEqual(event.state.frames.map(frame => frame.name), ["AL_CERRAR"]);
    f.request("stepOut");
    const idle = await stop(f, 2); assert.equal(idle.state.frames.length, 0); assert.match(idle.text, /Esperando eventos/);
    f.request("continue"); await delay(40);
    f.request("terminate");
    assert.match((await completed(f, "cancelled")).stdout, /"windows":0,"pendingDialogs":0/);
});

test("GUI DAP: dos callbacks suspendidos conservan parámetros y pilas independientes", { timeout: 15000 }, async t => {
    const source = ['AL_CAMBIO(id, texto)', '    copia = texto', '    ruta = ABRIR_ARCHIVO("f", NULO)',
        '    escribir copia, ruta', ...base, '    DIALOGO_ARCHIVO("f")', '    CONECTAR("e", "cambio", AL_CAMBIO)'].join("\n");
    const f = await guiDapHarness(source, { breakpoints: [{ line: 3 }, { line: 4 }] }); t.after(() => f.dispose());
    await f.wait(() => f.events.some(e => e.type === "location" && e.location.startLine === 11));
    await f.action({ type: "text", value: "primero" }); await stop(f, 1); f.request("continue");
    await delay(40);
    await f.action({ type: "text", value: "segundo" });
    const second = await stop(f, 2);
    assert.equal(second.state.frames.length, 1);
    assert.equal(second.state.frames[0].parameters.find(v => v.name === "texto").value, '"segundo"');
    f.request("continue"); await delay(40);
    await f.action({ type: "dialog", index: 0, value: "/primero.clrs" });
    const firstResult = await stop(f, 3);
    assert.equal(firstResult.location.startLine, 4);
    assert.equal(firstResult.state.frames.length, 1);
    assert.equal(firstResult.state.frames[0].locals.find(v => v.name === "copia").value, '"primero"');
    assert.equal(firstResult.state.frames[0].locals.find(v => v.name === "ruta").value, '"/primero.clrs"');
    f.request("continue");
    await f.action({ type: "dialog", index: 0, value: "/segundo.clrs" });
    assert.equal((await stop(f, 4)).state.frames[0].locals.find(v => v.name === "copia").value, '"segundo"');
    f.request("continue"); await f.action({ type: "close" }); await completed(f);
});

test("GUI DAP: pausa en espera y desconexión limpian ventanas y diálogos pendientes", { timeout: 15000 }, async t => {
    const f = await guiDapHarness([...base, '    DIALOGO_ARCHIVO("f")', '    ruta = ABRIR_ARCHIVO("f", "v")', '    escribir "NO_DEBE_EJECUTARSE"'].join("\n"));
    t.after(() => f.dispose());
    await f.wait(() => f.events.some(e => e.type === "location" && e.location.startLine === 7));
    f.request("pause"); assert.equal((await stop(f, 1)).reason, "pause");
    f.request("disconnect"); const result = await completed(f, "cancelled");
    assert.doesNotMatch(result.stdout, /NO_DEBE_EJECUTARSE/);
    assert.match(result.stdout, /GUI_TEST_CLEANUP {"windows":0,"pendingDialogs":0}/);
});

test("GUI DAP: breakpoints condicionales y logpoints en eventos, error con línea del callback", { timeout: 15000 }, async t => {
    const source = ['AL_CAMBIO(id, texto)', '    escribir texto', '    ESTABLECER(id, "propiedad_inexistente", 1)',
        ...base, '    CONECTAR("e", "cambio", AL_CAMBIO)'].join("\n");
    const f = await guiDapHarness(source, { breakpoints: [{ line: 2, logMessage: "Evento {texto}" }, { line: 3, condition: 'texto == "fallo"' }] });
    t.after(() => f.dispose());
    await f.wait(() => f.events.some(e => e.type === "location" && e.location.startLine === 9));
    await f.action({ type: "text", value: "fallo" });
    assert.equal((await stop(f, 1)).location.startLine, 3);
    assert.ok(f.messages.some(m => m.event === "output" && m.body.output.includes("Evento fallo")));
    f.request("continue"); const result = await completed(f, "error", 70);
    assert.match(result.stderr, /Línea 3/);
});

test("GUI DAP: Step Over de diálogo espera su resultado y no entra en otro callback", { timeout: 15000 }, async t => {
    const source = ['AL_CAMBIO(id, texto)', '    copia = texto', '    ruta = ABRIR_ARCHIVO("f", NULO)',
        '    escribir copia, ruta', ...base, '    DIALOGO_ARCHIVO("f")', '    CONECTAR("e", "cambio", AL_CAMBIO)'].join("\n");
    const f = await guiDapHarness(source, { breakpoints: [{ line: 3 }] }); t.after(() => f.dispose());
    await f.wait(() => f.events.some(e => e.type === "location" && e.location.startLine === 11));
    await f.action({ type: "text", value: "primero" }); await stop(f, 1);
    f.setBreakpoints([]); f.request("next"); await delay(40);
    await f.action({ type: "text", value: "segundo" }); await delay(60);
    assert.equal(stops(f).length, 1, "El plan no pertenece al segundo callback");
    await f.action({ type: "dialog", index: 1, value: "/segundo" }); await delay(40);
    assert.equal(stops(f).length, 1);
    await f.action({ type: "dialog", index: 0, value: "/primero" });
    assert.equal((await stop(f, 2)).location.startLine, 4);
    f.request("stepOut");
    const idle = await stop(f, 3); assert.equal(idle.state.frames.length, 0); assert.match(idle.text, /Esperando eventos/);
    f.request("stepIn"); await delay(70); assert.equal(stops(f).length, 3, "No genera pasos ficticios en GTK");
    await f.action({ type: "text", value: "tercero" }); assert.equal((await stop(f, 4)).location.startLine, 2);
    f.request("terminate"); await completed(f, "cancelled");
});

test("GUI DAP: detener al entrar libera la sesión antes de crear ventanas", { timeout: 15000 }, async t => {
    const f = await guiDapHarness(base.join("\n"), { stopOnEntry: true }); t.after(() => f.dispose());
    await stop(f, 1); f.request("terminate");
    assert.match((await completed(f, "cancelled")).stdout, /"windows":0,"pendingDialogs":0/);
});

test("GUI DAP: sesiones simultáneas mantienen estados y órdenes independientes", { timeout: 15000 }, async t => {
    const source = [...base, '    escribir "LISTO"'].join("\n");
    const a = await guiDapHarness(source), b = await guiDapHarness(source);
    t.after(() => a.dispose()); t.after(() => b.dispose());
    await a.wait(() => a.stdout.includes("LISTO")); await b.wait(() => b.stdout.includes("LISTO"));
    a.request("pause"); await stop(a, 1);
    assert.equal(stops(b).length, 0);
    a.request("terminate"); await completed(a, "cancelled");
    assert.equal(b.messages.some(e => e.event === "terminated"), false);
    await b.action({ type: "close" }); await completed(b);
});

test("GUI DAP: conteo de impactos sobre eventos y pausa sin despachar callbacks", { timeout: 15000 }, async t => {
    const source = ['AL_CAMBIO(id, texto)', '    escribir texto', ...base, '    CONECTAR("e", "cambio", AL_CAMBIO)'].join("\n");
    const f = await guiDapHarness(source, { breakpoints: [{ line: 2, hitCondition: "2" }] }); t.after(() => f.dispose());
    await f.wait(() => f.events.some(e => e.type === "location" && e.location.startLine === 8));
    await f.action({ type: "text", value: "primero" }); await f.wait(() => f.stdout.includes("primero"));
    assert.equal(stops(f).length, 0);
    await f.action({ type: "text", value: "segundo" }); assert.equal((await stop(f, 1)).reason, "breakpoint");
    await f.action({ type: "text", value: "tercero" }); await delay(70);
    assert.doesNotMatch(f.stdout, /segundo|tercero/);
    assert.equal(stops(f).length, 1);
    f.request("continue"); await f.wait(() => f.stdout.includes("tercero"));
    await f.action({ type: "close" }); await completed(f);
});
