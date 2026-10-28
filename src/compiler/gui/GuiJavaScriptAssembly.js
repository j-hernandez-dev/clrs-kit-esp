import { TranspilerError } from "../../errors/TranspilerError.js";
import { NODE_GTK_RUNTIME_DEPENDENCY } from "../../standard-library/gui/GuiContract.js";
import { createGuiCallbackReference, invokeGuiCallback } from "./GuiCallbackBridge.js";
import { GUI_FUNCTION_DEFINITIONS } from "../../standard-library/gui/GuiFunctionCatalog.js";
import { createGuiExecutionFlow } from "./GuiExecutionFlow.js";
import { GUI_BINDING_LOAD_PROTOCOL, createGuiBindingLoadSource } from "./GuiBindingLoadSource.js";

/** Contexto interno preparado por infraestructura; no resuelve/instala paquetes aquí. */
export function assembleGuiJavaScript({ dependencies, library, userCode, endProgram, gui, runtimeContext }) {
    const context = runtimeContext?.gui;
    if (!context || typeof context.factorySource !== "string" || !context.factorySource.trim()) {
        throw new TranspilerError("El código usa GUI, pero el runtime gráfico aún no está preparado. Se requiere el contexto de ejecución GUI.", gui.usage.calls[0]?.node.location ?? null,
            { code: "CLRS_GUI_RUNTIME_NOT_READY", publicMessage: "El runtime gráfico aún no está preparado para ejecutar este programa." });
    }
    let url;
    try { url = new URL(context.moduleUrl); } catch { /* Se diagnostica a continuación. */ }
    if (url?.protocol !== "file:" && context.moduleUrl !== "node-gtk") {
        throw new TranspilerError("La dependencia GUI requiere una URL de archivo resuelta por la infraestructura.", null,
            { code: "CLRS_GUI_DEP_RESOLUTION_FAILED" });
    }
    for (const name of gui.synchronousStandardFunctions) {
        // Sólo declaraciones del runtime propio, nunca texto/AST del usuario.
        library = library.replace(`async function ${name}(`, `function ${name}(`);
    }
    const source = `
${createGuiBindingLoadSource({
        moduleSpecifier: context.moduleUrl === "node-gtk" ? "node-gtk" : url.href,
        capabilities: gui.usage.capabilities
    })}
runtimeGuiContext_${globalThis.ProgramKey} = new $clrs$gui$AsyncLocalStorage();
let $clrs$gui$scopeSequence = 1;
const $clrs$gui$rootScope = { id: 1, frames: runtimeFrames_${globalThis.ProgramKey}, location: null };
runtimeGuiFlow_${globalThis.ProgramKey} = (${createGuiExecutionFlow.toString()})(event => {
    if (!runtimeTracePath_${globalThis.ProgramKey} || runtimeGuiCancellation_${globalThis.ProgramKey}) { return; }
    if (runtimeTraceCount_${globalThis.ProgramKey} < runtimeTraceLimit_${globalThis.ProgramKey}) {
        writeRuntimeTrace_${globalThis.ProgramKey}(event); runtimeTraceCount_${globalThis.ProgramKey}++;
    } else if (!runtimeTraceTruncated_${globalThis.ProgramKey}) {
        runtimeTraceTruncated_${globalThis.ProgramKey} = true;
        writeRuntimeTrace_${globalThis.ProgramKey}({ type: "truncated", limit: runtimeTraceLimit_${globalThis.ProgramKey} });
    }
}, () => runtimeGuiContext_${globalThis.ProgramKey}.getStore() ?? $clrs$gui$rootScope, $clrs$gui$rootScope);
runtimeGuiTerminate_${globalThis.ProgramKey} = () => {
    const error = new Error("La ejecución CLRS fue detenida.");
    error.name = "CLRSUserError"; error.code = "CLRS_GUI_DEBUG_CANCELLED"; return error;
};
const $clrs$gui$invokeCallback = ${invokeGuiCallback.toString()};
const $clrs$gui$pollDebug = () => runtimeGuiContext_${globalThis.ProgramKey}.run($clrs$gui$rootScope, () =>
    handleRuntimeDebug_${globalThis.ProgramKey}($clrs$gui$rootScope.location ?? runtimeLocation_${globalThis.ProgramKey}, true));
function $clrs$gui$dispatch(reference, id, args, immediate) {
    // GTK exige el retorno en esta misma pila. Sólo un llamador CLRS activo
    // comparte sus frames; un evento externo no hereda funciones suspendidas.
    if (immediate && runtimeGuiContext_${globalThis.ProgramKey}.getStore()?.frames.length) {
        return $clrs$gui$invokeCallback(reference, id, args, true);
    }
    const parent = runtimeGuiContext_${globalThis.ProgramKey}.getStore();
    const scope = { id: ++$clrs$gui$scopeSequence, frames: [], location: reference.location };
    return runtimeGuiContext_${globalThis.ProgramKey}.run(scope, () => {
        const located = { ...reference, callback: (...values) => {
            try {
                const result = reference.callback(...values);
                return result?.then ? result.catch(error => { throw locateRuntimeError_${globalThis.ProgramKey}(error); }) : result;
            } catch (error) { throw locateRuntimeError_${globalThis.ProgramKey}(error); }
        } };
        const result = $clrs$gui$invokeCallback(located, id, args, immediate);
        // Un callback separado no inventa un llamador. Step Out puede detenerse
        // al volver a la espera de eventos, conservando la última ubicación CLRS.
        const finish = value => {
            runtimeGuiFlow_${globalThis.ProgramKey}.callbackFinished(scope, parent);
            if (runtimeControlPath_${globalThis.ProgramKey}) {
                handleRuntimeDebug_${globalThis.ProgramKey}(scope.location, true);
            }
            return value;
        };
        return immediate ? finish(result) : result.then(finish);
    });
}
const $clrs$gui$session = await (${context.factorySource})($clrs$gui$binding, {
    programKey: ${JSON.stringify(String(globalThis.ProgramKey))} + ":" + $clrs$gui$executionKey(),
    dependency: ${JSON.stringify(NODE_GTK_RUNTIME_DEPENDENCY)},
    invokeCallback: $clrs$gui$dispatch,
    pollDebug: runtimeControlPath_${globalThis.ProgramKey} ? $clrs$gui$pollDebug : undefined,
    onWaitForIdle: state => runtimeGuiFlow_${globalThis.ProgramKey}.idle(state)
});
const $clrs$gui$callback = ${createGuiCallbackReference.toString()};
const $clrs$gui$awaitedFunctions = new Set(${JSON.stringify(gui.usage.functionNames.filter(name => GUI_FUNCTION_DEFINITIONS[name]?.asynchronous))});
function $clrs$gui$invoke(name, args) {
    if (runtimeGuiCancellation_${globalThis.ProgramKey}) { throw runtimeGuiCancellation_${globalThis.ProgramKey}; }
    const location = runtimeGuiContext_${globalThis.ProgramKey}.getStore()?.location ?? runtimeLocation_${globalThis.ProgramKey};
    const locate = error => { runtimeGuiFlow_${globalThis.ProgramKey}.fail(); if (error instanceof Error && !error.location) { error.location = location; } throw error; };
    try {
        const result = $clrs$gui$session.invoke(name, args);
        if (result?.then && $clrs$gui$awaitedFunctions.has(name)) {
            const resume = runtimeGuiFlow_${globalThis.ProgramKey}.wait(runtimeGuiContext_${globalThis.ProgramKey}.getStore() ?? $clrs$gui$rootScope, location, name);
            return result.then(value => { resume(); return value; }, error => {
                runtimeGuiFlow_${globalThis.ProgramKey}.fail(); resume(); return locate(error);
            });
        }
        return result?.then ? result.catch(locate) : result;
    } catch (error) { return locate(error); }
}
${gui.usage.functionNames.map(name => `function ${name}(...args) { return $clrs$gui$invoke(${JSON.stringify(name)}, args); }`).join("\n")}
try {
await runtimeGuiContext_${globalThis.ProgramKey}.run($clrs$gui$rootScope, async () => {
${userCode}
if (runtimeControlPath_${globalThis.ProgramKey}) { $clrs$gui$pollDebug(); }
await $clrs$gui$session.waitForIdle();
});
} finally {
await $clrs$gui$session.dispose();
}
`;
    const guiEndProgram = endProgram.replace('const message = runtimeErrorMessage_',
        'const message = (typeof error?.code === "string" && error.code.startsWith("CLRS_GUI_") && !String(error.message).includes("[" + error.code + "]") ? "[" + error.code + "] " : "") + runtimeErrorMessage_')
        .replace('} catch (error) {', `} catch (error) {
if (error === runtimeGuiCancellation_${globalThis.ProgramKey}) {
    finishRuntimeTrace_${globalThis.ProgramKey}("cancelled"); process.exit(0);
}`);
    return GUI_BINDING_LOAD_PROTOCOL.moduleImportsStartMarker + dependencies
        + '\nimport { randomUUID as $clrs$gui$executionKey } from "node:crypto";\n'
        + 'import { AsyncLocalStorage as $clrs$gui$AsyncLocalStorage } from "node:async_hooks";\n'
        + GUI_BINDING_LOAD_PROTOCOL.moduleImportsEndMarker + '\n'
        + library + source + guiEndProgram;
}
