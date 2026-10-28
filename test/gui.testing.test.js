import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { CLRSTestExecutor, CLRSNodeTestProcessRunner, createCLRSTestSuite } from "../src/testing/index.js";
import { JavaScriptGenerator } from "../src/compiler/JavaScriptGenerator.js";
import { DocumentAnalysisService } from "../src/language/analysis/DocumentAnalysisService.js";
import { LanguageDiagnosticsService } from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import { GuiRuntimePreparation } from "../src/compiler/gui/GuiRuntimePreparation.js";
import { GuiDependencyError } from "../src/infrastructure/gui/GuiDependencyError.js";
import { BrokerTestExecutionService } from "../src/broker95/submission/BrokerTestExecutionService.js";
import { BrokerClrsTestProcessRunner } from "../src/broker95/submission/BrokerClrsTestProcessRunner.js";
import { BrokerClrsDocumentCaptureService } from "../src/broker95/submission/BrokerClrsDocumentCaptureService.js";
import { BrokerStaticEvidenceService } from "../src/broker95/submission/BrokerStaticEvidenceService.js";
import { createBrokerCompactTestEvidence } from "../src/broker95/submission/BrokerSubmissionEvidenceProjection.js";
import { assertBrokerTestEnvironment } from "../src/broker95/submission/BrokerTestEnvironmentGuard.js";
import { CostAnalysisVisitor } from "../src/complex/CostAnalysisVisitor.js";

function setup(overrides = {}) {
    const prepared = [], processes = [];
    const analysis = new DocumentAnalysisService({ languageDiagnosticsService: new LanguageDiagnosticsService(),
        analyzeCost: ast => new CostAnalysisVisitor().costAnalysis(ast) });
    const generator = new JavaScriptGenerator();
    const preparation = new GuiRuntimePreparation({ dependencyManager: { async ensure(request) {
        prepared.push(request);
        return { entryUrl: new URL("./fixtures/gui/binding-testing-stub.mjs", import.meta.url).href,
            nodeExecutable: process.execPath, version: "4.1.1", gtkVersion: "4.10" };
    } } });
    const runner = new CLRSNodeTestProcessRunner({ ...overrides.runnerOptions, spawn(command, args, options) {
        const child = spawn(command, args, options);
        processes.push({ command, args, options, child }); return child;
    } });
    const executor = new CLRSTestExecutor({ documentAnalysisService: analysis, javaScriptGenerator: generator,
        processRunner: runner, runtimePreparation: preparation, ...overrides });
    return { analysis, generator, preparation, runner, executor, prepared, processes };
}
const suite = (expected = "1\n", count = 1, timeoutMs = 5000) => createCLRSTestSuite({ id: "gui-suite", name: "GUI",
    programPath: "programa.clrs", cases: Array.from({ length: count }, (_, index) => ({ id: `caso-${index}`, name: `Caso ${index}`,
        input: { stdin: "" }, expectation: { stdout: expected }, timeoutMs })) });
const run = (s, sourceCode, expected = "1\n", count = 1) => s.executor.execute({ suite: suite(expected, count), sourceCode, seed: 45 });
const callbackSource = 'CAMBIO(id, texto)\n    escribir texto\nPRINCIPAL()\n    VENTANA("v", "Prueba")\n    ENTRADA("e")\n    CONECTAR("e", "cambio", CAMBIO)\n    ESTABLECER("e", "texto", "hola")\n    CERRAR("v")';

test("GUI pruebas: runtime productivo, callbacks, cobertura y aislamiento por caso", async () => {
    const s = setup();
    const result = await run(s, callbackSource, "hola\n", 2);
    assert.equal(s.prepared.length, 1);
    assert.equal(result.summary.passed, 2, JSON.stringify(result));
    for (const item of result.results) {
        assert.equal(item.coverage.complete, true);
        assert.ok(item.coverage.points.some(point => point.name === "CAMBIO" && point.hitCount === 1));
    }
    assert.notEqual(s.processes[0].options.cwd, s.processes[1].options.cwd);
    for (const item of s.processes) {
        assert.equal(item.command, process.execPath);
        assert.equal(item.options.shell, false); assert.equal(item.options.windowsHide, true);
        assert.equal(item.child.exitCode, 0);
        await assert.rejects(access(item.options.cwd));
    }
});

test("GUI pruebas: registrar un callback no acredita su ejecución ni su cobertura", async () => {
    const s = setup();
    const result = await run(s, callbackSource.replace('    ESTABLECER("e", "texto", "hola")\n', ''), "");
    assert.equal(result.summary.passed, 1);
    assert.ok(result.results[0].coverage.points.some(point => point.name === "CAMBIO" && point.hitCount === 0));
});

test("GUI pruebas: cancelación de FileDialog retorna NULO y limpia el runtime", async () => {
    const result = await run(setup(), 'PRINCIPAL()\n    DIALOGO_ARCHIVO("f")\n    ruta = ABRIR_ARCHIVO("f", NULO)\n    escribir ruta == NULO', "true\n");
    assert.equal(result.summary.passed, 1, JSON.stringify(result));
});

test("GUI pruebas: errores de API conservan diagnóstico y línea CLRS", async () => {
    const result = await run(setup(), 'PRINCIPAL()\n    ENTRADA("e")\n    ENTRADA("e")');
    const failure = result.results[0].failure;
    assert.equal(result.summary.errored, 1);
    assert.match(result.results[0].stderr, /Ya existe un componente con ese identificador/);
    assert.equal(failure.location.startLine, 3);
});

test("GUI pruebas: timeout de ventana y cancelación detienen el proceso y limpian temporales", async () => {
    const s = setup();
    const sourceCode = 'PRINCIPAL()\n    VENTANA("v", "Pendiente")\n    MOSTRAR("v")';
    const result = await s.executor.execute({ sourceCode, suite: suite("", 1, 5000) });
    assert.equal(result.results[0].failure.kind, "timeout");
    assert.equal(result.results[0].coverage.complete, false);
    assert.ok(s.processes[0].child.exitCode != null || s.processes[0].child.signalCode != null);
    await assert.rejects(access(s.processes[0].options.cwd));
    const controller = new AbortController();
    const cancelSetup = setup();
    const promise = cancelSetup.executor.execute({ sourceCode, suite: suite("", 2), signal: controller.signal });
    const timer = setTimeout(() => controller.abort(), 600);
    const cancelled = await promise; clearTimeout(timer);
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelSetup.processes.length, 1);
    await assert.rejects(access(cancelSetup.processes[0].options.cwd));
});

test("GUI pruebas: consola, fuente inválida y cancelación previa no aprovisionan GTK", async () => {
    const s = setup();
    assert.equal((await run(s, 'PRINCIPAL()\n    escribir 1')).summary.passed, 1);
    assert.equal((await run(s, 'PRINCIPAL()\n    ENTRADA(1)')).status, "source-invalid");
    const controller = new AbortController(); controller.abort();
    assert.equal((await s.executor.execute({ sourceCode: callbackSource, suite: suite(), signal: controller.signal })).status, "cancelled");
    assert.equal(s.prepared.length, 0);
});

test("GUI pruebas: cancelación alcanza los probes descendientes y espera el cierre", async () => {
    const controller = new AbortController();
    let descendant;
    const runner = new CLRSNodeTestProcessRunner({ spawn(command, args, options) {
        const child = spawn(command, args, options);
        child.stdout.on("data", chunk => {
            const pid = Number(String(chunk).trim());
            if (Number.isSafeInteger(pid) && pid > 0) { descendant = pid; controller.abort(); }
        });
        return child;
    } });
    try {
        const result = await runner.run({ gui: true, stdin: "", timeoutMs: 10000, signal: controller.signal,
            programCode: 'import { spawn } from "node:child_process"; const probe = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore", windowsHide: true }); console.log(probe.pid); setInterval(() => {}, 1000);' });
        assert.equal(result.status, "cancelled");
        assert.ok(descendant);
        assert.throws(() => process.kill(descendant, 0), error => error.code === "ESRCH");
    } finally {
        if (descendant) { try { process.kill(descendant, "SIGKILL"); } catch { /* Ya terminó. */ } }
    }
});

test("GUI pruebas: un diálogo pendiente agota el tiempo sin fabricar entrada humana", async () => {
    const result = await run(setup(), 'PRINCIPAL()\n    DIALOGO_ARCHIVO("f")\n    ESTABLECER("f", "titulo", "pendiente")\n    ruta = ABRIR_ARCHIVO("f", NULO)\n    escribir "no alcanzado"', "");
    assert.equal(result.results[0].failure.kind, "timeout");
    assert.equal(result.results[0].stdout, "");
    assert.equal(result.results[0].coverage.complete, false);
});

test("GUI pruebas: fallo privado y cancelación durante preparación no arrancan casos", async () => {
    const s = setup({ runtimePreparation: { async prepare() { throw new GuiDependencyError("CLRS_GUI_DEP_GTK_NOT_FOUND", new Error("interno secreto")); } } });
    const result = await run(s, callbackSource, "", 2);
    assert.equal(result.summary.errored, 2);
    assert.equal(result.results[0].failure.kind, "start-failure");
    assert.equal(result.results[0].failure.code, "CLRS_GUI_DEP_GTK_NOT_FOUND");
    assert.doesNotMatch(JSON.stringify(result), /interno secreto/);
    assert.equal(s.processes.length, 0);
    const controller = new AbortController();
    const cancelled = setup({ runtimePreparation: { async prepare({ signal }) {
        assert.equal(signal, controller.signal); controller.abort(); throw new GuiDependencyError("CLRS_GUI_DEP_CANCELLED");
    } } });
    assert.equal((await cancelled.executor.execute({ sourceCode: callbackSource, suite: suite(), signal: controller.signal })).status, "cancelled");
    assert.equal(cancelled.processes.length, 0);
});

test("GUI pruebas: entorno gráfico selectivo y Node validado sin credenciales ni inyección", async () => {
    const s = setup({ runnerOptions: { environment: { ...process.env, DISPLAY: ":77", WAYLAND_DISPLAY: "wayland-test",
        NODE_OPTIONS: "--invalid", NODE_PATH: "privado", OPENAI_API_KEY: "secreto", GSETTINGS_SCHEMA_DIR: "externo" } } });
    await run(s, 'PRINCIPAL()\n    escribir 1');
    await run(s, 'PRINCIPAL()\n    ESTABLECER_MODO_TEMA("claro")\n    escribir 1');
    assert.equal(s.processes[0].options.env.DISPLAY, undefined);
    assert.equal(s.processes[1].options.env.DISPLAY, ":77");
    for (const key of ["NODE_OPTIONS", "NODE_PATH", "OPENAI_API_KEY", "GSETTINGS_SCHEMA_DIR"]) {
        assert.equal(s.processes[1].options.env[key], undefined);
    }
    await assert.rejects(s.runner.run({ programCode: "void 0;", stdin: "", timeoutMs: 5000, nodeExecutable: "node --bad" }),
        error => error.code === "CLRS_TEST_PROCESS_REQUEST_INVALID");
});

function broker(s, sourceCode) {
    const capture = new BrokerClrsDocumentCaptureService({ documentAnalysisService: s.analysis, languageId: "clrs-es",
        documentHost: { captureActiveDocument: () => ({ documentId: "file:///programa.clrs", name: "programa.clrs", languageId: "clrs-es", version: 1, sourceCode }) } });
    const evidence = new BrokerStaticEvidenceService({ documentCapture: capture, documentAnalysisService: s.analysis });
    const service = new BrokerTestExecutionService({ gameSession: { async initialize() {}, getState: () => ({}) },
        documentCapture: capture, documentAnalysisService: s.analysis, javaScriptGenerator: s.generator,
        programRunner: new BrokerClrsTestProcessRunner({ runner: s.runner }), runtimePreparation: s.preparation });
    return { service, evidence, capture };
}
const contract = { id: 1, state: "active", requirements: ["Mostrar la salida"], metadata: { requirementIds: ["REQ-1"] }, testCases: [{ id: "TC-1", kind: "normal", requirementIds: ["REQ-1"], stdin: "", expected: "hola\n", comparison: "exact", timeoutMs: 5000 }] };

test("GUI BROKER: evidencia distingue biblioteca, callbacks potenciales y llamadas reales", () => {
    const b = broker(setup(), callbackSource);
    const evidence = b.evidence.collect();
    assert.equal(evidence.status, "complete");
    assert.ok(evidence.calls.edges.items.some(edge => edge.callee === "CONECTAR" && edge.kind === "builtin"));
    assert.ok(!evidence.calls.edges.items.some(edge => edge.callee === "CAMBIO"));
    assert.equal(evidence.calls.callbackRegistrations.items[0].observedExecution, false);
    assert.equal(evidence.symbols.records.items.find(symbol => symbol.name === "CAMBIO").used, true);
    assert.equal(evidence.symbols.records.items.find(symbol => symbol.name === "texto").used, true);
    assert.equal(evidence.interpretation.gui.visualBehaviorValidated, false);
    assert.equal(evidence.interpretation.scoresProduced, false);
    assert.doesNotMatch(JSON.stringify(evidence), /factorySource|nodeExecutable|node_modules/);
});

test("GUI BROKER: callbacks muertos y CONECTAR homónimo no crean activaciones ficticias", () => {
    const source = 'EVENTO(id)\n    escribir id\nMUERTA()\n    ENTRADA("e")\n    CONECTAR("e", "activar", EVENTO)\nPRINCIPAL()\n    escribir 1';
    const evidence = broker(setup(), source).evidence.collect();
    assert.equal(evidence.symbols.records.items.find(symbol => symbol.name === "EVENTO").used, false);
    const homonym = broker(setup(), 'CONECTAR(x)\n    retornar x\nPRINCIPAL()\n    escribir CONECTAR(1)').evidence.collect();
    assert.equal(homonym.calls.callbackRegistrations, undefined);
    assert.equal(homonym.interpretation.gui, undefined);
});

test("GUI BROKER: ejecuta el mismo runtime y proyecta únicamente evidencia observada", async () => {
    const s = setup(), b = broker(s, callbackSource);
    const execution = await b.service.executeContract(contract);
    assert.equal(execution.summary.passed, 1, JSON.stringify(execution));
    assert.equal(s.prepared.length, 1);
    const compact = createBrokerCompactTestEvidence(execution);
    assert.equal(compact.gui.visualBehaviorValidated, false);
    assert.equal(compact.cases[0].stdout, "hola\n");
    assert.doesNotMatch(JSON.stringify(compact), /factorySource|nodeExecutable|expected|node_modules/);
    assert.doesNotThrow(() => assertBrokerTestEnvironment(execution));
});

test("GUI BROKER: infraestructura ausente impide calificación antes de liquidar", async () => {
    const s = setup(); s.preparation = { async prepare() { throw new GuiDependencyError("CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE"); } };
    const execution = await broker(s, callbackSource).service.executeContract(contract);
    assert.equal(execution.summary.startFailed, 1);
    assert.equal(execution.summary.failed, 0);
    assert.match(execution.testCases[0].stderr, /CLRS_GUI_DEP_GTK_RESOURCES_UNAVAILABLE/);
    assert.equal(s.processes.length, 0);
    assert.throws(() => assertBrokerTestEnvironment(execution), error => /No se ha calificado ni liquidado/.test(error.publicMessage));
});

test("GUI BROKER: cancelación previa y durante preparación no inicia casos ni acusa al programa", async () => {
    for (const beforehand of [true, false]) {
        const controller = new AbortController(), s = setup();
        if (beforehand) { controller.abort(); }
        else { s.preparation = { async prepare() { controller.abort(); throw new GuiDependencyError("CLRS_GUI_DEP_CANCELLED"); } }; }
        const b = broker(s, callbackSource);
        const execution = await b.service.executeContractCapture(contract, b.capture.capture(), { signal: controller.signal });
        assert.equal(execution.testCases[0].reason, "cancelled");
        assert.equal(s.prepared.length, 0);
        assert.equal(s.processes.length, 0);
        assert.throws(() => assertBrokerTestEnvironment(execution), error => /canceladas/.test(error.publicMessage));
    }
});
