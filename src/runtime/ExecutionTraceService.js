import {
    cloneExecutionCoverageEvent,
    normalizeExecutionCoverageEvent
} from "./ExecutionCoverageEvent.js";
import { normalizeExecutionFlow } from "./ExecutionFlowEvent.js";

export const ExecutionTraceStatus =
    Object.freeze({
        RUNNING: "running",
        CORRECT: "correct",
        ERROR: "error",
        CANCELLED: "cancelled"
    });

export class ExecutionTraceService {

    constructor(options = {}) {
        this.maxSteps =
            positiveInteger(
                options.maxSteps
            ) ?? 10000;
        this.maxCoverageEvents =
            positiveInteger(
                options.maxCoverageEvents
            ) ?? this.maxSteps;
        this.traceIdPrefix =
            nonEmptyString(
                options.traceIdPrefix
            ) ?? "execution";
        this.listeners = new Set();
        this.currentTrace = null;
        this.nextTraceId = 1;
        this.disposed = false;
    }

    start(request) {
        const trace = {
            traceId:
                `${this.traceIdPrefix}-${this.nextTraceId++}`,
            sourcePath:
                String(request.sourcePath),
            documentVersion:
                positiveInteger(
                    request.documentVersion
                ),
            status:
                ExecutionTraceStatus.RUNNING,
            steps: [],
            truncated: false,
            maxSteps: this.maxSteps,
            coverageEvents: [],
            coverageTruncated: false,
            maxCoverageEvents:
                this.maxCoverageEvents,
            cancellationRequested: false,
            debug:
                request.debug === true
                    ? createDebugState()
                    : null
        };

        this.currentTrace = trace;
        this.emit({
            type: "start",
            trace: cloneTrace(trace)
        });

        return cloneTrace(trace);
    }

    accept(traceId, event) {
        const trace = this.currentTrace;

        if (
            !trace ||
            trace.traceId !== traceId
        ) {
            return false;
        }

        if (event?.type === "test-result") {
            return this.addTestResult(
                trace,
                event
            );
        }

        if (
            trace.status !==
                ExecutionTraceStatus.RUNNING
        ) {
            return false;
        }

        switch (event?.type) {
            case "start":
                return true;

            case "location":
                return this.addLocation(
                    trace,
                    event.location,
                    normalizeExecutionFlow(event.flow)
                );

            case "gui-flow":
            case "execution-flow": {
                const flow = normalizeExecutionFlow(event.flow);
                return flow != null && this.addLocation(trace, event.location, flow);
            }

            case "coverage":
                return this.addCoverageEvent(
                    trace,
                    event
                );

            case "coverage-truncated":
                return this.markCoverageTruncated(
                    trace
                );

            case "truncated":
                return this.markTruncated(trace);

            case "stopped":
                return this.stopExecution(
                    trace,
                    event
                );

            case "output":
                return this.addOutput(
                    trace,
                    event
                );

            case "continued":
                return this.continueExecution(
                    trace
                );

            case "end":
                return this.finish(
                    trace,
                    normalizeStatus(
                        event.status
                    )
                );

            default:
                return false;
        }
    }

    cancel(traceId) {
        const trace = this.currentTrace;

        if (
            !trace ||
            trace.traceId !== traceId ||
            trace.status !==
                ExecutionTraceStatus.RUNNING
        ) {
            return false;
        }

        return this.finish(
            trace,
            ExecutionTraceStatus.CANCELLED
        );
    }

    requestCancellation(traceId) {
        const trace = this.currentTrace;

        if (
            !trace ||
            trace.traceId !== traceId ||
            trace.status !==
                ExecutionTraceStatus.RUNNING
        ) {
            return false;
        }

        if (trace.cancellationRequested) {
            return true;
        }

        trace.cancellationRequested = true;

        if (trace.debug) {
            trace.debug = {
                ...trace.debug,
                status: "stopping"
            };
        }

        this.emit({
            type: "cancelling",
            traceId: trace.traceId,
            sourcePath: trace.sourcePath,
            documentVersion:
                trace.documentVersion
        });

        return true;
    }

    getSnapshot() {
        return this.currentTrace
            ? cloneTrace(this.currentTrace)
            : null;
    }

    subscribe(listener) {
        this.listeners.add(listener);

        return {
            dispose: () => {
                this.listeners.delete(listener);
            }
        };
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.listeners.clear();
        this.currentTrace = null;
    }

    addLocation(trace, location, flow = null) {
        if (trace.cancellationRequested) {
            return true;
        }

        const normalized =
            normalizeLocation(location);

        if (!normalized && flow?.kind !== "idle") {
            return false;
        }

        if (
            trace.steps.length >=
                this.maxSteps
        ) {
            return this.markTruncated(trace);
        }

        const step = {
            index: trace.steps.length,
            location: normalized,
            ...(flow ? { flow } : {})
        };

        trace.steps.push(step);
        this.emit({
            type: "step",
            traceId: trace.traceId,
            sourcePath: trace.sourcePath,
            documentVersion:
                trace.documentVersion,
            step: cloneStep(step)
        });

        return true;
    }

    addCoverageEvent(trace, source) {
        if (trace.cancellationRequested) {
            return true;
        }

        const coverageEvent =
            normalizeExecutionCoverageEvent(
                source
            );

        if (coverageEvent == null) {
            return false;
        }

        if (
            trace.coverageEvents.length >=
                this.maxCoverageEvents
        ) {
            return this.markCoverageTruncated(
                trace
            );
        }

        const recorded = Object.freeze({
            index: trace.coverageEvents.length,
            ...coverageEvent
        });

        trace.coverageEvents.push(recorded);
        this.emit({
            type: "coverage",
            traceId: trace.traceId,
            sourcePath: trace.sourcePath,
            documentVersion:
                trace.documentVersion,
            coverageEvent:
                cloneExecutionCoverageEvent(
                    recorded
                )
        });

        return true;
    }

    markCoverageTruncated(trace) {
        if (trace.coverageTruncated) {
            return true;
        }

        trace.coverageTruncated = true;
        this.emit({
            type: "coverage-truncated",
            traceId: trace.traceId,
            sourcePath: trace.sourcePath,
            documentVersion:
                trace.documentVersion,
            maxCoverageEvents:
                trace.maxCoverageEvents
        });

        return true;
    }

    markTruncated(trace) {
        if (trace.truncated) {
            return true;
        }

        trace.truncated = true;
        this.emit({
            type: "truncated",
            traceId: trace.traceId,
            sourcePath: trace.sourcePath,
            documentVersion:
                trace.documentVersion,
            maxSteps: trace.maxSteps
        });

        return true;
    }

    stopExecution(trace, event) {
        if (trace.cancellationRequested) {
            return true;
        }

        const location =
            normalizeLocation(
                event.location
            );

        if (!location) {
            return false;
        }

        const lastStep = trace.steps.at(-1);
        if (lastStep?.flow) {
            trace.flowBeforePause = lastStep;
            this.addLocation(trace, location, { ...lastStep.flow, kind: "paused" });
        }

        const runtimeState =
            event.state &&
            typeof event.state === "object"
                ? clonePlainValue(
                    event.state
                )
                : null;
        const breakpointIds =
            normalizeBreakpointIds(
                event.breakpointIds
            );
        const text = nonEmptyString(
            event.text
        );

        if (trace.debug) {
            trace.debug = {
                ...trace.debug,
                status: "paused",
                reason:
                    normalizeStopReason(
                        event.reason
                    ),
                location,
                state: runtimeState,
                breakpointIds,
                text
            };
        }

        this.emit({
            type: "stopped",
            traceId: trace.traceId,
            sourcePath: trace.sourcePath,
            documentVersion:
                trace.documentVersion,
            reason:
                normalizeStopReason(
                    event.reason
                ),
            location,
            state: runtimeState,
            breakpointIds,
            text
        });

        return true;
    }

    addOutput(trace, event) {
        if (trace.cancellationRequested) {
            return true;
        }

        if (typeof event.output !== "string") {
            return false;
        }

        this.emit({
            type: "output",
            traceId: trace.traceId,
            sourcePath: trace.sourcePath,
            documentVersion:
                trace.documentVersion,
            category:
                normalizeOutputCategory(
                    event.category
                ),
            output: event.output,
            location:
                normalizeLocation(
                    event.location
                ),
            breakpointId:
                positiveInteger(
                    event.breakpointId
                )
        });

        return true;
    }

    continueExecution(trace) {
        if (trace.cancellationRequested) {
            return true;
        }

        if (trace.flowBeforePause) {
            const previous = trace.flowBeforePause;
            delete trace.flowBeforePause;
            this.addLocation(trace, previous.location, previous.flow);
        }

        if (trace.debug) {
            trace.debug = {
                ...trace.debug,
                status: "running",
                reason: null,
                location: null,
                state: null,
                breakpointIds: [],
                text: null
            };
        }

        this.emit({
            type: "continued",
            traceId: trace.traceId,
            sourcePath: trace.sourcePath,
            documentVersion:
                trace.documentVersion
        });

        return true;
    }

    finish(trace, status) {
        trace.status =
            trace.cancellationRequested
                ? ExecutionTraceStatus.CANCELLED
                : status;

        if (trace.debug) {
            trace.debug = {
                ...trace.debug,
                status: "ended"
            };
        }

        this.emit({
            type: "end",
            traceId: trace.traceId,
            sourcePath: trace.sourcePath,
            documentVersion:
                trace.documentVersion,
            status: trace.status,
            truncated: trace.truncated,
            coverageTruncated:
                trace.coverageTruncated
        });

        return true;
    }

    addTestResult(trace, event) {
        if (
            typeof event.stdout !== "string" ||
            typeof event.stderr !== "string" ||
            !["correct", "error", "cancelled"]
                .includes(event.status) ||
            (
                event.exitCode != null &&
                !Number.isInteger(event.exitCode)
            ) ||
            (
                event.signal != null &&
                typeof event.signal !== "string"
            )
        ) {
            return false;
        }

        this.emit({
            type: "test-result",
            traceId: trace.traceId,
            sourcePath: trace.sourcePath,
            documentVersion:
                trace.documentVersion,
            status: event.status,
            stdout: event.stdout,
            stderr: event.stderr,
            exitCode: event.exitCode ?? null,
            signal: event.signal ?? null,
            outputTruncated:
                event.outputTruncated === true
        });

        return true;
    }

    emit(event) {
        if (this.disposed) {
            return;
        }

        for (const listener of this.listeners) {
            listener(event);
        }
    }
}

function cloneTrace(trace) {
    const snapshot = {
        ...trace,
        steps: trace.steps.map(cloneStep),
        coverageEvents:
            trace.coverageEvents.map(
                cloneExecutionCoverageEvent
            ),
        debug: cloneDebugState(
            trace.debug
        )
    };
    delete snapshot.flowBeforePause;
    return snapshot;
}

function createDebugState() {
    return {
        enabled: true,
        status: "running",
        reason: null,
        location: null,
        state: null,
        breakpointIds: [],
        text: null
    };
}

function cloneDebugState(debug) {
    if (!debug) {
        return null;
    }

    return {
        ...debug,
        location:
            debug.location
                ? { ...debug.location }
                : null,
        state: clonePlainValue(
            debug.state
        ),
        breakpointIds:
            [...debug.breakpointIds ?? []]
    };
}

function clonePlainValue(value, seen = new WeakMap()) {
    if (
        value == null ||
        typeof value !== "object"
    ) {
        return value;
    }

    if (seen.has(value)) {
        return null;
    }

    const clone = Array.isArray(value)
        ? []
        : {};

    seen.set(value, clone);

    for (const [key, item] of Object.entries(value)) {
        clone[key] = clonePlainValue(
            item,
            seen
        );
    }

    return clone;
}

function cloneStep(step) {
    return {
        index: step.index,
        location: step.location ? {
            ...step.location
        } : null,
        ...(step.flow ? { flow: { ...step.flow } } : {})
    };
}

function normalizeLocation(location) {
    const startLine =
        positiveInteger(
            location?.startLine
        );

    if (startLine == null) {
        return null;
    }

    const startColumn =
        positiveInteger(
            location?.startColumn
        ) ?? 1;
    const endLine =
        positiveInteger(
            location?.endLine
        ) ?? startLine;
    const endColumn =
        positiveInteger(
            location?.endColumn
        ) ?? startColumn;

    return {
        startLine,
        startColumn,
        endLine: Math.max(
            startLine,
            endLine
        ),
        endColumn:
            endLine < startLine
                ? startColumn
                : endColumn
    };
}

function normalizeStatus(status) {
    switch (status) {
        case ExecutionTraceStatus.CORRECT:
            return ExecutionTraceStatus.CORRECT;
        case ExecutionTraceStatus.CANCELLED:
            return ExecutionTraceStatus.CANCELLED;
        default:
            return ExecutionTraceStatus.ERROR;
    }
}

function normalizeStopReason(reason) {
    switch (reason) {
        case "entry":
        case "pause":
        case "step":
        case "breakpoint":
            return reason;
        default:
            return "pause";
    }
}

function normalizeBreakpointIds(value) {
    return [...new Set(
        (Array.isArray(value)
            ? value
            : [])
            .filter(identifier =>
                Number.isInteger(identifier) &&
                identifier > 0
            )
    )];
}

function normalizeOutputCategory(value) {
    switch (value) {
        case "stdout":
        case "stderr":
        case "important":
            return value;
        default:
            return "console";
    }
}

function positiveInteger(value) {
    return Number.isInteger(value) && value > 0
        ? value
        : null;
}

function nonEmptyString(value) {
    return typeof value === "string" &&
        value.trim() !== ""
        ? value.trim()
        : null;
}
