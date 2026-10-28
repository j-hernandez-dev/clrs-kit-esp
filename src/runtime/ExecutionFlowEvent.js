// Metadatos mínimos de ejecución, sin referencias nativas ni bindings del usuario.
const KINDS = new Set(["statement", "enter", "return", "wait", "resume", "idle", "paused"]);
export function normalizeExecutionFlow(value) {
    if (!value || !KINDS.has(value.kind) || !Number.isSafeInteger(value.contextId) || value.contextId < 1) { return null; }
    return { kind: value.kind, contextId: value.contextId,
        ...(positiveInteger(value.frameId) ? { frameId: value.frameId } : {}),
        ...(positiveInteger(value.parentFrameId) ? { parentFrameId: value.parentFrameId } : {}),
        ...(["dialog", "windows", "pending"].includes(value.reason) ? { reason: value.reason } : {}),
        ...(typeof value.functionName === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,199}$/.test(value.functionName)
            ? { functionName: value.functionName } : {}) };
}

function positiveInteger(value) {
    return Number.isSafeInteger(value) && value > 0;
}
