/** Autocontenida: se incluye sólo en programas GUI. No añade nodos al AST/diagrama. */
export function createGuiExecutionFlow(emit, currentScope, root) {
    const waits = new Map();
    let mainFinished = false;
    let idleReason = "windows";
    const frameMetadata = frame => frame ? {
        frameId: frame.id,
        ...(frame.parentFrameId ? { parentFrameId: frame.parentFrameId } : {})
    } : {};
    const describe = (kind, scope = currentScope(), extra = {}) => ({
        kind,
        contextId: scope?.id ?? root.id,
        ...frameMetadata(scope?.frames?.at(-1)),
        ...extra
    });
    const write = (kind, scope, location, extra) => emit({ type: "gui-flow", location,
        flow: describe(kind, scope, extra) });
    const restore = preferred => {
        const scope = waits.has(preferred) ? preferred : waits.has(root) ? root : [...waits.keys()].at(-1);
        if (scope) {
            const waiting = waits.get(scope);
            write("wait", scope, waiting.location, { reason: "dialog", functionName: waiting.name });
        } else if (mainFinished) {
            write("idle", root, null, { reason: idleReason });
        }
    };
    return {
        describe,
        enter(frame) { write("enter", currentScope(), frame.location, {
            functionName: frame.name, ...frameMetadata(frame)
        }); },
        leave(frame, parent) {
            const scope = currentScope();
            if (!frame || scope?.failed) { return; }
            const location = parent?.location ?? frame.location;
            write("return", scope, location, {
                functionName: frame.name, ...frameMetadata(frame)
            });
        },
        fail() { const scope = currentScope(); if (scope) { scope.failed = true; } },
        wait(scope, location, name) {
            const token = { location, name }; waits.set(scope, token);
            write("wait", scope, location, { reason: "dialog", functionName: name });
            return () => {
                if (waits.get(scope) !== token) { return; }
                waits.delete(scope);
                if (!scope.failed) { write("resume", scope, location, { functionName: name }); }
            };
        },
        callbackFinished(scope, parent) { if (!scope.failed) { restore(parent); } },
        idle({ windows, pending }) {
            mainFinished = true; idleReason = windows ? "windows" : "pending";
            if (windows || pending) { restore(root); }
        }
    };
}
