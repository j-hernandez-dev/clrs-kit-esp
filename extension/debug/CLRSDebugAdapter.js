import path from "node:path";
import {
    CLRSDebugStateStore
} from "./CLRSDebugStateStore.js";
import {
    BreakpointExpressionCompiler
} from "./BreakpointExpressionCompiler.js";

export class CLRSDebugAdapter {

    constructor(options) {
        this.messageEmitter =
            options.messageEmitter;
        this.onDidSendMessage =
            this.messageEmitter.event;
        this.executionTraceService =
            options.executionTraceService;
        this.launchProgram =
            options.launchProgram;
        this.logger =
            options.logger ?? console;
        this.onDispose =
            options.onDispose ?? (() => {});
        this.stateStore =
            options.stateStore ??
            new CLRSDebugStateStore();
        this.breakpointCompiler =
            options.breakpointCompiler ??
            new BreakpointExpressionCompiler();
        this.sequence = 1;
        this.launchConfiguration = null;
        this.traceId = null;
        this.traceResource = null;
        this.controlSession = null;
        this.breakpoints = [];
        this.breakpointIds = new Map();
        this.nextBreakpointId = 1;
        this.currentLocation = null;
        this.stopped = false;
        this.terminationRequested = false;
        this.terminated = false;
        this.initializedSent = false;
        this.disposed = false;
    }

    handleMessage(message) {
        if (
            this.disposed ||
            message?.type !== "request"
        ) {
            return;
        }

        try {
            this.handleRequest(message);
        } catch (error) {
            this.logger.error?.(
                "CLRS debug adapter request failed:",
                error
            );
            this.sendErrorResponse(
                message,
                "La sesión de depuración encontró un error interno."
            );
            this.sendTerminated();
        }
    }

    handleRequest(request) {
        switch (request.command) {
            case "initialize":
                this.sendResponse(
                    request,
                    {
                        supportsConfigurationDoneRequest:
                            true,
                        supportsTerminateRequest:
                            true,
                        supportTerminateDebuggee:
                            true,
                        supportsRestartRequest:
                            false,
                        supportsStepBack:
                            false,
                        supportsSetVariable:
                            false,
                        supportsEvaluateForHovers:
                            false,
                        supportsConditionalBreakpoints:
                            true,
                        supportsHitConditionalBreakpoints:
                            true,
                        supportsLogPoints:
                            true
                    }
                );
                return;

            case "launch":
                this.launchConfiguration = {
                    ...request.arguments
                };
                this.sendResponse(request);
                this.sendInitialized();
                return;

            case "configurationDone":
                this.startProgram(request);
                return;

            case "setBreakpoints":
                this.setBreakpoints(request);
                return;

            case "setExceptionBreakpoints":
                this.sendResponse(
                    request,
                    { breakpoints: [] }
                );
                return;

            case "threads":
                this.sendThreads(request);
                return;

            case "stackTrace":
                this.sendStackTrace(request);
                return;

            case "scopes":
                this.sendScopes(request);
                return;

            case "variables":
                this.sendVariables(request);
                return;

            case "continue":
                this.resumeExecution(
                    request,
                    "continue"
                );
                return;

            case "next":
                this.resumeExecution(
                    request,
                    "stepOver"
                );
                return;

            case "stepIn":
                this.resumeExecution(
                    request,
                    "stepIn"
                );
                return;

            case "stepOut":
                this.resumeExecution(
                    request,
                    "stepOut"
                );
                return;

            case "pause":
                this.pauseExecution(request);
                return;

            case "terminate":
                this.terminateExecution(
                    request
                );
                return;

            case "disconnect":
                this.terminateExecution(
                    request
                );
                return;

            default:
                this.sendErrorResponse(
                    request,
                    `La operación «${request.command}» todavía no está disponible en el depurador CLRS.`
                );
        }
    }

    setBreakpoints(request) {
        const sourcePath =
            request.arguments
                ?.source?.path ??
            this.launchConfiguration
                ?.program;
        const sourceMatches =
            samePath(
                sourcePath,
                this.launchConfiguration
                    ?.program
            );
        const requestedBreakpoints =
            (
                request.arguments
                    ?.breakpoints ?? []
            );
        const runtimeBreakpoints = [];
        const breakpoints =
            requestedBreakpoints
            .map(breakpoint => {
                const validLine =
                    Number.isInteger(
                        breakpoint.line
                    ) &&
                    breakpoint.line > 0;
                const locationVerified =
                    sourceMatches &&
                    validLine;
                const id =
                    this.getBreakpointId(
                        sourcePath,
                        breakpoint.line,
                        breakpoint.column
                    );
                const compiled =
                    locationVerified
                        ? this.breakpointCompiler
                            .compileBreakpoint(
                                breakpoint
                            )
                        : null;
                const verified =
                    locationVerified &&
                    compiled?.ok === true;

                if (verified) {
                    runtimeBreakpoints.push({
                        id,
                        line: breakpoint.line,
                        column:
                            positiveInteger(
                                breakpoint.column
                            ),
                        condition:
                            compiled.value
                                .condition,
                        hitCondition:
                            compiled.value
                                .hitCondition,
                        logSegments:
                            compiled.value
                                .logSegments
                    });
                }

                return {
                    id,
                    verified,
                    line: breakpoint.line,
                    column:
                        breakpoint.column,
                    ...(
                        verified
                            ? {}
                            : {
                                message:
                                    sourceMatches
                                        ? validLine
                                            ? compiled.error
                                            : "El punto de interrupción no tiene una línea válida."
                                        : "El depurador CLRS sólo controla el archivo iniciado."
                            }
                    )
                };
            });

        // VS Code puede reenviar los breakpoints persistidos de todos los
        // documentos abiertos al iniciar una sesión. Este adaptador controla
        // un único programa, por lo que una solicitud de otra fuente sólo se
        // responde como no verificada y nunca debe borrar la configuración
        // válida del archivo que se está ejecutando.
        if (sourceMatches) {
            this.breakpoints =
                runtimeBreakpoints;
            this.controlSession
                ?.setBreakpoints(
                    this.breakpoints
                );
        }

        this.sendResponse(
            request,
            { breakpoints }
        );
    }

    getBreakpointId(
        sourcePath,
        line,
        column
    ) {
        const key = [
            normalizePath(sourcePath),
            Number.isInteger(line)
                ? line
                : "invalid",
            Number.isInteger(column)
                ? column
                : 0
        ].join(":");
        let id = this.breakpointIds
            .get(key);

        if (id == null) {
            id = this.nextBreakpointId++;
            this.breakpointIds.set(key, id);
        }

        return id;
    }

    sendThreads(request) {
        this.sendResponse(
            request,
            {
                threads: this.terminated
                    ? []
                    : [{
                        id: 1,
                        name: "Programa CLRS"
                    }]
            }
        );
    }

    sendStackTrace(request) {
        const allFrames =
            this.stateStore
                .getStackFrames();
        const startFrame =
            nonNegativeInteger(
                request.arguments
                    ?.startFrame
            ) ?? 0;
        const levels =
            nonNegativeInteger(
                request.arguments?.levels
            );
        const stackFrames =
            levels == null || levels === 0
                ? allFrames.slice(startFrame)
                : allFrames.slice(
                    startFrame,
                    startFrame + levels
                );

        this.sendResponse(
            request,
            {
                stackFrames,
                totalFrames:
                    allFrames.length
            }
        );
    }

    sendScopes(request) {
        this.sendResponse(
            request,
            {
                scopes:
                    this.stateStore
                        .getScopes(
                            request.arguments
                                ?.frameId
                        )
            }
        );
    }

    sendVariables(request) {
        const variables =
            this.stateStore
                .getVariables(
                    request.arguments
                        ?.variablesReference
                );
        const start =
            nonNegativeInteger(
                request.arguments?.start
            ) ?? 0;
        const count =
            nonNegativeInteger(
                request.arguments?.count
            );

        this.sendResponse(
            request,
            {
                variables:
                    count == null || count === 0
                        ? variables.slice(start)
                        : variables.slice(
                            start,
                            start + count
                        )
            }
        );
    }

    resumeExecution(request, command) {
        if (!this.controlSession) {
            this.sendErrorResponse(
                request,
                "El proceso CLRS todavía no está disponible para continuar."
            );
            return;
        }

        const method = {
            continue: "continue",
            stepIn: "stepIn",
            stepOver: "stepOver",
            stepOut: "stepOut"
        }[command];

        if (
            method == null ||
            typeof this.controlSession[
                method
            ] !== "function"
        ) {
            this.sendErrorResponse(
                request,
                "El proceso CLRS no admite esta operación de avance."
            );
            return;
        }

        this.controlSession[method]();

        this.stopped = false;
        this.sendResponse(
            request,
            request.command === "continue"
                ? {
                    allThreadsContinued: true
                }
                : undefined
        );
        this.sendEvent(
            "continued",
            {
                threadId: 1,
                allThreadsContinued: true
            }
        );
    }

    pauseExecution(request) {
        if (!this.controlSession) {
            this.sendErrorResponse(
                request,
                "El proceso CLRS todavía no está disponible para pausarse."
            );
            return;
        }

        this.controlSession.pause();
        this.sendResponse(request);
    }

    terminateExecution(request) {
        this.terminationRequested = true;
        this.executionTraceService
            .requestCancellation?.(
                this.traceId
            );
        this.controlSession?.terminate();
        this.sendResponse(request);
        this.sendOutput(
            "Deteniendo la ejecución CLRS.\n"
        );

        if (
            !this.controlSession
        ) {
            this.sendTerminated();
        }
    }

    startProgram(request) {
        if (
            typeof this.launchConfiguration
                ?.program !== "string"
        ) {
            this.sendErrorResponse(
                request,
                "La configuración de depuración no contiene un programa CLRS."
            );
            this.sendTerminated();
            return;
        }

        this.stateStore.reset();
        this.traceResource =
            this.executionTraceService
                .subscribe(event =>
                    this.handleTraceEvent(event)
                );

        try {
            const launchResult =
                this.launchProgram({
                    ...this.launchConfiguration,
                    __clrsBreakpoints:
                        this.breakpoints.map(
                            cloneBreakpoint
                        )
                });

            this.controlSession =
                launchResult
                    ?.controlSession ?? null;
            this.sendResponse(request);
            this.sendOutput(
                "Depurador CLRS iniciado. La entrada y salida permanecen en la terminal integrada.\n"
            );
        } catch (error) {
            this.logger.error?.(
                "CLRS debug launch failed:",
                error
            );
            this.sendErrorResponse(
                request,
                "No fue posible iniciar el programa CLRS."
            );
            this.sendTerminated();
        }
    }

    handleTraceEvent(event) {
        if (event?.type === "start") {
            const trace = event.trace;

            if (
                samePath(
                    trace?.sourcePath,
                    this.launchConfiguration
                        ?.program
                )
            ) {
                this.traceId = trace.traceId;
            }

            return;
        }

        if (event?.traceId !== this.traceId) {
            return;
        }

        if (event.type === "step") {
            this.currentLocation =
                event.step?.location ??
                this.currentLocation;
            return;
        }

        if (event.type === "stopped") {
            this.currentLocation =
                event.location;
            this.stateStore.update(
                event.state,
                this.launchConfiguration
                    ?.program,
                event.location
            );
            this.stopped = true;
            this.sendEvent(
                "stopped",
                {
                    reason: event.reason,
                    description:
                        stopDescription(
                            event.reason
                        ),
                    threadId: 1,
                    allThreadsStopped: true,
                    ...(
                        event.breakpointIds
                            ?.length > 0
                            ? {
                                hitBreakpointIds:
                                    [...event.breakpointIds]
                            }
                            : {}
                    ),
                    ...(
                        event.text
                            ? { text: event.text }
                            : {}
                    )
                }
            );
            return;
        }

        if (event.type === "output") {
            this.sendEvent(
                "output",
                {
                    category:
                        event.category ??
                        "console",
                    output:
                        String(
                            event.output ?? ""
                        ),
                    source: {
                        name: path.basename(
                            this.launchConfiguration
                                ?.program ?? ""
                        ),
                        path:
                            this.launchConfiguration
                                ?.program,
                        sourceReference: 0
                    },
                    ...(
                        event.location
                            ?.startLine != null
                            ? {
                                line:
                                    event.location
                                        .startLine,
                                column:
                                    event.location
                                        .startColumn ?? 1
                            }
                            : {}
                    )
                }
            );
            return;
        }

        if (event.type === "continued") {
            this.stopped = false;
            return;
        }

        if (event.type !== "end") {
            return;
        }

        const status = event.status;

        if (status === "correct") {
            this.sendOutput(
                "La ejecución CLRS terminó correctamente.\n"
            );
        } else if (status === "cancelled") {
            this.sendOutput(
                this.terminationRequested
                    ? "La ejecución CLRS fue detenida.\n"
                    : "La ejecución CLRS fue reemplazada por otra sesión.\n"
            );
        } else {
            this.sendOutput(
                "La ejecución CLRS terminó con errores. Consulta la terminal para ver el diagnóstico.\n",
                "stderr"
            );
        }

        this.sendTerminated();
    }

    sendResponse(request, body = undefined) {
        this.send({
            type: "response",
            request_seq: request.seq,
            success: true,
            command: request.command,
            ...(body === undefined
                ? {}
                : { body })
        });
    }

    sendErrorResponse(request, message) {
        this.send({
            type: "response",
            request_seq: request.seq,
            success: false,
            command: request.command,
            message
        });
    }

    sendOutput(
        output,
        category = "console"
    ) {
        this.sendEvent(
            "output",
            { category, output }
        );
    }

    sendInitialized() {
        if (this.initializedSent) {
            return;
        }

        this.initializedSent = true;
        this.sendEvent("initialized");
    }

    sendTerminated() {
        if (this.terminated) {
            return;
        }

        this.terminated = true;
        this.sendEvent("terminated");
        this.traceResource?.dispose?.();
        this.traceResource = null;
        this.controlSession = null;
    }

    sendEvent(event, body = undefined) {
        this.send({
            type: "event",
            event,
            ...(body === undefined
                ? {}
                : { body })
        });
    }

    send(message) {
        this.messageEmitter.fire({
            seq: this.sequence++,
            ...message
        });
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.traceResource?.dispose?.();
        this.traceResource = null;
        this.controlSession = null;
        this.messageEmitter.dispose?.();
        this.onDispose(this);
    }
}

function stopDescription(reason) {
    switch (reason) {
        case "entry":
            return "Detenido al entrar al programa.";
        case "breakpoint":
            return "Detenido en un punto de interrupción.";
        case "step":
            return "Detenido después de avanzar.";
        default:
            return "Ejecución pausada.";
    }
}

function samePath(left, right) {
    if (!left || !right) {
        return false;
    }

    const normalizedLeft = path.resolve(left);
    const normalizedRight = path.resolve(right);

    return process.platform === "win32"
        ? normalizedLeft.toLocaleLowerCase("en") ===
            normalizedRight.toLocaleLowerCase("en")
        : normalizedLeft === normalizedRight;
}

function normalizePath(value) {
    if (!value) {
        return "";
    }

    const normalized = path.resolve(value);

    return process.platform === "win32"
        ? normalized.toLocaleLowerCase("en")
        : normalized;
}

function cloneBreakpoint(breakpoint) {
    return JSON.parse(
        JSON.stringify(breakpoint)
    );
}

function positiveInteger(value) {
    return Number.isInteger(value) && value > 0
        ? value
        : null;
}

function nonNegativeInteger(value) {
    return Number.isInteger(value) && value >= 0
        ? value
        : null;
}
