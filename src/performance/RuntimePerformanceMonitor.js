import {
    performance
} from "node:perf_hooks";

const DEFAULT_MAXIMUM_STAGES = 32;

/**
 * Conserva métricas agregadas y acotadas del proceso. No recibe código,
 * rutas ni contenido documental; únicamente nombres internos y duraciones.
 */
export class RuntimePerformanceMonitor {

    constructor(options = {}) {
        this.clock =
            options.clock ??
            (() => performance.now());
        this.maximumStages =
            positiveInteger(
                options.maximumStages ??
                    DEFAULT_MAXIMUM_STAGES,
                "maximumStages"
            );
        this.stages = new Map();
        this.disposed = false;
    }

    now() {
        return this.clock();
    }

    measure(stage, operation) {
        if (typeof operation !== "function") {
            throw new TypeError(
                "Performance operation must be a function."
            );
        }

        const startedAt = this.now();

        try {
            const result = operation();

            if (isPromiseLike(result)) {
                return Promise.resolve(result)
                    .finally(() => {
                        this.record(
                            stage,
                            this.now() - startedAt
                        );
                    });
            }

            this.record(
                stage,
                this.now() - startedAt
            );
            return result;
        } catch (error) {
            this.record(
                stage,
                this.now() - startedAt
            );
            throw error;
        }
    }

    record(stage, durationMs) {
        if (this.disposed) {
            return false;
        }

        const key = normalizeStage(stage);
        const duration =
            normalizeDuration(durationMs);
        let metric = this.stages.get(key);

        if (metric == null) {
            this.ensureCapacity();
            metric = {
                count: 0,
                totalMs: 0,
                minimumMs: duration,
                maximumMs: duration,
                lastMs: duration
            };
            this.stages.set(key, metric);
        }

        metric.count += 1;
        metric.totalMs += duration;
        metric.minimumMs = Math.min(
            metric.minimumMs,
            duration
        );
        metric.maximumMs = Math.max(
            metric.maximumMs,
            duration
        );
        metric.lastMs = duration;

        return true;
    }

    getSnapshot() {
        const stages = {};

        for (const [stage, metric] of this.stages) {
            stages[stage] = Object.freeze({
                count: metric.count,
                totalMs: round(metric.totalMs),
                averageMs: round(
                    metric.totalMs /
                        metric.count
                ),
                minimumMs: round(
                    metric.minimumMs
                ),
                maximumMs: round(
                    metric.maximumMs
                ),
                lastMs: round(metric.lastMs)
            });
        }

        return Object.freeze({
            stages: Object.freeze(stages)
        });
    }

    clear() {
        this.stages.clear();
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.clear();
    }

    ensureCapacity() {
        if (
            this.stages.size <
            this.maximumStages
        ) {
            return;
        }

        const oldest =
            this.stages.keys().next().value;

        if (oldest != null) {
            this.stages.delete(oldest);
        }
    }
}

function isPromiseLike(value) {
    return (
        value != null &&
        typeof value.then === "function"
    );
}

function normalizeStage(value) {
    if (
        typeof value !== "string" ||
        !/^[a-z][a-z0-9.-]{0,63}$/u.test(
            value
        )
    ) {
        throw new TypeError(
            "Performance stage must be a stable internal identifier."
        );
    }

    return value;
}

function normalizeDuration(value) {
    if (
        !Number.isFinite(value) ||
        value < 0
    ) {
        throw new TypeError(
            "Performance duration must be a finite non-negative number."
        );
    }

    return value;
}

function positiveInteger(value, name) {
    if (
        !Number.isInteger(value) ||
        value <= 0
    ) {
        throw new TypeError(
            `${name} must be a positive integer.`
        );
    }

    return value;
}

function round(value) {
    return Math.round(value * 1000) / 1000;
}
