import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { parseSource } from "../../../src/language/LanguageFrontend.js";
import { JavaScriptGenerator } from "../../../src/compiler/JavaScriptGenerator.js";
import { getGuiRuntimeFactorySource } from "../../../src/standard-library/gui/runtime/GuiRuntimeSource.js";
import { ExecutionControlFileSession } from "../../../extension/adapters/ExecutionControlFileSession.js";
import { ExecutionTraceFileSession } from "../../../extension/adapters/ExecutionTraceFileSession.js";
import { ExecutionTraceService } from "../../../src/runtime/ExecutionTraceService.js";
import { CLRSDebugAdapter } from "../../../extension/debug/CLRSDebugAdapter.js";

export async function guiDapHarness(source, options = {}) {
    const generated = new JavaScriptGenerator().generate(parseSource(source).ast, { runtimeContext: { gui: {
        moduleUrl: options.moduleUrl ?? new URL("./binding-debug-stub.mjs", import.meta.url).href,
        factorySource: getGuiRuntimeFactorySource()
    } } });
    const root = await mkdtemp(path.join(options.parent ?? tmpdir(), "clrs-gui-dap-"));
    const program = path.join(root, "programa.clrs"), emitted = path.join(root, "programa.mjs");
    const actionPath = path.join(root, "actions.json");
    await writeFile(program, source); await writeFile(emitted, generated.generatedCode);
    const messages = [], events = [], traceService = new ExecutionTraceService();
    const control = new ExecutionControlFileSession({ controlPath: path.join(root, "control.json") });
    let child, closed = false, stdout = "", stderr = "", traceSession, finish;
    const completion = new Promise(resolve => { finish = resolve; });
    const adapter = new CLRSDebugAdapter({ messageEmitter: { event() {}, fire: message => messages.push(message), dispose() {} },
        executionTraceService: traceService, launchProgram(configuration) {
            const trace = traceService.start({ sourcePath: program, debug: options.debug !== false });
            control.start({ stopOnEntry: configuration.stopOnEntry, breakpoints: configuration.__clrsBreakpoints });
            traceSession = new ExecutionTraceFileSession({ tracePath: path.join(root, "trace.jsonl"), intervalMs: 5,
                onEvent(event) { events.push(event); traceService.accept(trace.traceId, event); }
            }).start();
            child = spawn(process.execPath, [emitted], { cwd: root, windowsHide: true,
                env: { ...process.env, CLRS_TRACE_FILE: traceSession.tracePath, CLRS_CONTROL_FILE: options.debug === false ? undefined : control.controlPath,
                    CLRS_GUI_TEST_ACTION_FILE: actionPath }, stdio: ["ignore", "pipe", "pipe"] });
            child.stdout.on("data", value => { stdout += value; });
            child.stderr.on("data", value => { stderr += value; });
            child.once("error", error => { stderr += error.message; });
            child.once("close", (code, signal) => { closed = true; traceSession.poll(); finish({ code, signal, stdout, stderr }); });
            return { controlSession: control };
        } });
    let seq = 0, actionSeq = 0;
    const request = (command, args = {}) => {
        const id = ++seq;
        adapter.handleMessage({ type: "request", seq: id, command, arguments: args });
        const response = messages.find(m => m.type === "response" && m.request_seq === id);
        assert.equal(response?.success, true, JSON.stringify(response));
        return response.body;
    };
    request("initialize"); request("launch", { program, stopOnEntry: options.stopOnEntry ?? false });
    request("setBreakpoints", { source: { path: program }, breakpoints: options.breakpoints ?? [] });
    request("configurationDone");
    return {
        root, program, generated, messages, events, request, completion,
        snapshot: () => traceService.getSnapshot(),
        get stdout() { return stdout; }, get stderr() { return stderr; },
        setBreakpoints(breakpoints) { return request("setBreakpoints", { source: { path: program }, breakpoints }); },
        async action(action) { await writeFile(actionPath, JSON.stringify({ ...action, sequence: ++actionSeq })); },
        async wait(predicate, timeout = 8000) {
            const end = Date.now() + timeout;
            while (Date.now() < end) {
                const value = predicate(); if (value) { return value; }
                if (closed) { throw new Error("Proceso terminado antes del evento: " + stderr + stdout); }
                await delay(10);
            }
            throw new Error("Tiempo agotado: " + stderr + stdout + JSON.stringify(events.slice(-3)));
        },
        async dispose() {
            if (!closed) {
                control.terminate();
                await Promise.race([completion, delay(800)]);
                if (!closed) { child.kill(); await completion; }
            }
            adapter.dispose(); control.dispose(); traceSession.dispose(); traceService.dispose();
            assert.ok(path.basename(root).startsWith("clrs-gui-dap-"));
            await rm(root, { recursive: true, force: true });
        }
    };
}
