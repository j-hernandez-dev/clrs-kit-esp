import { normalizeExecutionFlow } from "../../../src/runtime/ExecutionFlowEvent.js";

export function createEmptyExecutionTrace() {
    return {
        traceId: null,
        status: "idle",
        steps: [],
        truncated: false,
        maxSteps: 0
    };
}

export function reduceExecutionTrace(
    state,
    message
) {
    if (message?.type === "execution-trace") {
        return message.trace
            ? normalizeTrace(message.trace)
            : createEmptyExecutionTrace();
    }

    if (message?.type !== "execution-event") {
        return state;
    }

    const event = message.event;

    if (event?.type === "start") {
        return normalizeTrace(event.trace);
    }

    if (
        !event ||
        state.traceId == null ||
        event.traceId !== state.traceId
    ) {
        return state;
    }

    switch (event.type) {
        case "step":
            return {
                ...state,
                steps: appendSteps(
                    state.steps,
                    [event.step]
                )
            };

        case "steps":
            return {
                ...state,
                steps: appendSteps(
                    state.steps,
                    event.steps ?? []
                )
            };

        case "truncated":
            return {
                ...state,
                truncated: true,
                maxSteps:
                    event.maxSteps ??
                    state.maxSteps
            };

        case "end":
            return {
                ...state,
                status: event.status,
                truncated:
                    event.truncated ??
                    state.truncated
            };

        default:
            return state;
    }
}

function normalizeTrace(trace) {
    return {
        traceId: trace.traceId ?? null,
        status: trace.status ?? "idle",
        steps:
            (trace.steps ?? [])
                .map(normalizeStep),
        truncated:
            trace.truncated === true,
        maxSteps:
            Number(trace.maxSteps) || 0
    };
}

function normalizeStep(step) {
    const flow = normalizeExecutionFlow(step?.flow);
    return {
        index:
            Number.isInteger(step?.index)
                ? step.index
                : 0,
        location: step?.location ? {
            ...step?.location
        } : null,
        ...(flow ? { flow } : {})
    };
}

export function describeExecutionStep(step) {
    if (step?.presentation?.kind === "entry") {
        return "Inicio del flujo";
    }
    if (step?.presentation?.kind === "function-entry") {
        return "Entrada a " +
            (step.presentation.functionName ??
                "una función CLRS");
    }
    if (step?.presentation?.kind === "function-end") {
        return "Fin de " +
            (step.flow?.functionName ??
                "la función CLRS");
    }
    if (step?.presentation?.kind === "end") {
        return "Fin del flujo";
    }
    if (step?.presentation?.kind === "for-preparation") {
        return "Preparación del ciclo para";
    }
    if (step?.presentation?.kind === "loop-decision") {
        return "Evaluación de la condición del ciclo";
    }
    const flow = step?.flow;
    switch (flow?.kind) {
        case "wait": return "En espera de un cuadro de diálogo" + (flow.functionName ? ": " + flow.functionName : "");
        case "idle": return flow.reason === "windows" ? "En espera de eventos: la ventana permanece abierta" : "En espera de operaciones pendientes";
        case "enter": return "Entrada a " + (flow.functionName ?? "una función CLRS");
        case "return": return "Retorno de " + (flow.functionName ?? "una función CLRS");
        case "resume": return "Reanudación después de " + (flow.functionName ?? "la espera");
        case "paused": return "Ejecución pausada en el depurador";
        default: return "";
    }
}

function appendSteps(current, incoming) {
    const lastIndex =
        current.at(-1)?.index ?? -1;
    const additions = incoming
        .map(normalizeStep)
        .filter(step =>
            step.index > lastIndex
        );

    return additions.length === 0
        ? current
        : [...current, ...additions];
}
