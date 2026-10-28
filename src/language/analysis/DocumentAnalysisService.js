import {
    ApplicationError
} from "../../errors/ApplicationError.js";

const COST_STATE = new WeakMap();
const DEFAULT_MAXIMUM_SNAPSHOTS = 16;

/**
 * Resultado estable del análisis de una versión concreta de un documento.
 * El análisis de costo se conserva de forma perezosa en un WeakMap para
 * mantener inmutable la superficie pública del snapshot.
 */
export class DocumentAnalysisSnapshot {

    constructor(options = {}) {
        this.key = options.key;
        this.version = options.version;
        this.sourceCode = options.sourceCode;
        this.ok = options.analysis.ok;
        this.diagnostics =
            options.analysis.diagnostics;
        this.frontend =
            options.analysis.frontend;
        this.ast =
            options.analysis.frontend?.ast ??
            null;
        this.semanticModel =
            options.analysis.semanticModel;

        COST_STATE.set(this, {
            resolved: false,
            result: null,
            analyzeCost:
                options.analyzeCost,
            performanceMonitor:
                options.performanceMonitor ??
                null
        });

        Object.freeze(this);
    }

    get hasCostAnalysis() {
        return COST_STATE.get(this)
            ?.resolved ?? false;
    }

    getCostAnalysisResult() {
        const state = COST_STATE.get(this);

        if (state.resolved) {
            return state.result;
        }

        state.resolved = true;

        if (!this.ok || this.ast == null) {
            state.result = analysisFailure(
                this.diagnostics
            );

            return state.result;
        }

        try {
            const analyze = () =>
                state.analyzeCost(
                    this.ast,
                    this
                );
            const value =
                state.performanceMonitor == null
                    ? analyze()
                    : state.performanceMonitor
                        .measure(
                            "analysis.cost",
                            analyze
                        );

            state.result =
                analysisSuccess(value);
        } catch (error) {
            state.result = analysisFailure([
                error
            ]);
        }

        return state.result;
    }
}

/**
 * Conserva como máximo un snapshot por documento. Una nueva versión
 * reemplaza a la anterior, evitando trabajo duplicado y crecimiento de la
 * caché durante una sesión de edición.
 */
export class DocumentAnalysisService {

    constructor(options = {}) {
        this.languageDiagnosticsService =
            requireMethod(
                options.languageDiagnosticsService,
                "languageDiagnosticsService",
                "analyze"
            );
        this.analyzeCost =
            requireFunction(
                options.analyzeCost,
                "analyzeCost"
            );
        this.performanceMonitor =
            requirePerformanceMonitor(
                options.performanceMonitor
            );
        this.maximumSnapshots =
            requirePositiveInteger(
                options.maximumSnapshots ??
                    DEFAULT_MAXIMUM_SNAPSHOTS,
                "maximumSnapshots"
            );
        this.snapshots = new Map();
        this.disposed = false;
    }

    analyze(request = {}) {
        this.ensureActive();

        const key = requireKey(request.key);
        const sourceCode =
            requireSourceCode(
                request.sourceCode
            );
        const version =
            request.version ?? null;
        const cached =
            this.snapshots.get(key);

        if (
            cached != null &&
            Object.is(
                cached.version,
                version
            ) &&
            cached.sourceCode === sourceCode
        ) {
            this.touch(key, cached);
            return cached;
        }

        const analyze = () =>
            this.languageDiagnosticsService
                .analyze(sourceCode);
        const analysis =
            this.performanceMonitor == null
                ? analyze()
                : this.performanceMonitor
                    .measure(
                        "analysis.document",
                        analyze
                    );
        const snapshot =
            new DocumentAnalysisSnapshot({
                key,
                version,
                sourceCode,
                analysis,
                analyzeCost:
                    this.analyzeCost,
                performanceMonitor:
                    this.performanceMonitor
            });

        this.store(key, snapshot);

        return snapshot;
    }

    analyzeDocument(document) {
        return this.analyze(
            createDocumentRequest(document)
        );
    }

    peek(key) {
        return (
            this.snapshots.get(
                String(key)
            ) ??
            null
        );
    }

    invalidate(key) {
        return this.snapshots.delete(
            String(key)
        );
    }

    invalidateDocument(document) {
        return this.invalidate(
            getDocumentKey(document)
        );
    }

    clear() {
        this.snapshots.clear();
    }

    store(key, snapshot) {
        this.snapshots.delete(key);

        while (
            this.snapshots.size >=
            this.maximumSnapshots
        ) {
            const oldest =
                this.snapshots
                    .keys()
                    .next().value;

            if (oldest == null) {
                break;
            }

            this.snapshots.delete(oldest);
        }

        this.snapshots.set(key, snapshot);
    }

    touch(key, snapshot) {
        this.snapshots.delete(key);
        this.snapshots.set(key, snapshot);
    }

    get size() {
        return this.snapshots.size;
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.clear();
    }

    ensureActive() {
        if (this.disposed) {
            throw new ApplicationError(
                "DocumentAnalysisService is disposed.",
                {
                    code:
                        "CLRS_DOCUMENT_ANALYSIS_DISPOSED",
                    audience: "developer",
                    publicMessage:
                        "El servicio de análisis no está disponible."
                }
            );
        }
    }
}

export function createDocumentRequest(document) {
    if (
        document == null ||
        typeof document.getText !==
            "function"
    ) {
        throw ApplicationError.configuration(
            "document",
            "getText()"
        );
    }

    return {
        key: getDocumentKey(document),
        version:
            document.version ?? null,
        sourceCode: document.getText()
    };
}

export function getDocumentKey(document) {
    const uri = document?.uri;
    const key =
        typeof uri === "string"
            ? uri
            : uri?.toString?.();

    return requireKey(key);
}

function analysisSuccess(value) {
    return Object.freeze({
        ok: true,
        value,
        errors: Object.freeze([])
    });
}

function analysisFailure(errors) {
    return Object.freeze({
        ok: false,
        value: null,
        errors: Object.freeze([
            ...(errors ?? [])
        ])
    });
}

function requireMethod(
    dependency,
    name,
    method
) {
    if (
        typeof dependency?.[method] !==
            "function"
    ) {
        throw ApplicationError.configuration(
            name,
            `${method}()`
        );
    }

    return dependency;
}

function requireFunction(value, name) {
    if (typeof value !== "function") {
        throw ApplicationError.configuration(
            name,
            "a function"
        );
    }

    return value;
}

function requirePerformanceMonitor(value) {
    if (value == null) {
        return null;
    }

    if (
        typeof value.measure !==
        "function"
    ) {
        throw ApplicationError.configuration(
            "performanceMonitor",
            "measure()"
        );
    }

    return value;
}

function requirePositiveInteger(value, name) {
    if (
        !Number.isInteger(value) ||
        value <= 0
    ) {
        throw ApplicationError.configuration(
            name,
            "a positive integer"
        );
    }

    return value;
}

function requireKey(value) {
    if (
        typeof value !== "string" ||
        value.length === 0
    ) {
        throw ApplicationError.invalidRequest(
            "El análisis documental requiere una clave no vacía."
        );
    }

    return value;
}

function requireSourceCode(value) {
    if (typeof value !== "string") {
        throw ApplicationError.invalidRequest(
            "El análisis documental requiere código fuente."
        );
    }

    return value;
}
