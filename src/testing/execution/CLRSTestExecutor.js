import {
    CLRS_TEST_LIMITS,
    CLRSTestFailureKind,
    CLRSTestResultStatus,
    CLRSTestRunStatus,
    accumulateCLRSTestCoverage,
    aggregateCLRSTestCoverage,
    createCLRSTestResult,
    createCLRSTestSuite
} from "../domain/index.js";
import {
    CLRSTestExecutionError
} from "./CLRSTestExecutionError.js";
import {
    createCompletedCLRSTestResult
} from "./CLRSTestCompletedResult.js";
import {
    deriveCLRSTestCaseSeed
} from "./CLRSTestSeed.js";
import {
    CLRSTestProcessStatus
} from "./CLRSNodeTestProcessRunner.js";
import { prepareCLRSTestRuntime, guiTestPreparationDiagnostic } from "./CLRSTestRuntimePreparation.js";

export const CLRS_TEST_EXECUTION_VERSION = 1;
export const CLRS_TEST_EXECUTION_LIMITS =
    Object.freeze({
        maximumSourceCharacters: 1_048_576,
        maximumTotalTimeoutMs: 300_000
    });

/**
 * Coordina análisis, generación y ejecución secuencial de una suite. La
 * superficie no conoce VS Code, archivos, contratos ni presentación.
 */
export class CLRSTestExecutor {

    constructor(options = {}) {
        this.runtimePreparation = options.runtimePreparation ?? null;
        this.documentAnalysisService = requirePort(
            options.documentAnalysisService,
            "documentAnalysisService",
            ["analyze"]
        );
        this.javaScriptGenerator = requirePort(
            options.javaScriptGenerator,
            "javaScriptGenerator",
            ["generate"]
        );
        this.processRunner = requirePort(
            options.processRunner,
            "processRunner",
            ["run"]
        );
        this.now = requireFunction(
            options.now ?? Date.now,
            "now"
        );
    }

    async execute(request = {}) {
        const normalized = normalizeRequest(request);
        const selectedCases = selectCases(
            normalized.suite,
            normalized.caseIds
        );
        const startedAt = this.now();
        if (selectedCases.length === 0) {
            return createExecution({ status: CLRSTestRunStatus.COMPLETED, request: normalized, results: [], elapsedMs: 0 });
        }
        if (normalized.signal?.aborted) {
            return createExecution({ status: CLRSTestRunStatus.CANCELLED, request: normalized,
                results: selectedCases.map(testCase => cancelledResult(normalized.suite, testCase,
                    deriveCLRSTestCaseSeed(normalized.seed, normalized.suite.id, testCase.id))), elapsedMs: 0 });
        }
        const analysis = this.documentAnalysisService
            .analyze({
                key: normalized.suite.programPath,
                version: normalized.sourceVersion,
                sourceCode: normalized.sourceCode
            });

        if (!analysis.ok || analysis.ast == null) {
            return createExecution({
                status:
                    CLRSTestRunStatus.SOURCE_INVALID,
                request: normalized,
                results: selectedCases.map(testCase =>
                    sourceInvalidResult(
                        normalized.suite,
                        testCase,
                        analysis.diagnostics
                    )
                ),
                elapsedMs: elapsed(
                    startedAt,
                    this.now
                )
            });
        }

        let programCode;
        let coverageCatalog = [];
        let processOptions = {};

        try {
            const prepared = await prepareCLRSTestRuntime(
                this.runtimePreparation, analysis.semanticModel, normalized.signal);
            processOptions = prepared.processOptions;
            const generation = this.javaScriptGenerator
                .generate(analysis.ast, {
                    ...(prepared.runtimeContext ? { runtimeContext: prepared.runtimeContext } : {}),
                    semanticModel:
                        analysis.semanticModel
                });

            if (
                typeof generation?.generatedCode !==
                    "string" ||
                generation.generatedCode.length === 0
            ) {
                throw new TypeError(
                    "The JavaScript generator returned no program."
                );
            }

            programCode = generation.generatedCode;
            coverageCatalog =
                normalizeCoverageCatalog(
                    generation.coveragePoints
                );
        } catch (error) {
            if (normalized.signal?.aborted) {
                return createExecution({ status: CLRSTestRunStatus.CANCELLED, request: normalized,
                    results: selectedCases.map(testCase => cancelledResult(normalized.suite, testCase,
                        deriveCLRSTestCaseSeed(normalized.seed, normalized.suite.id, testCase.id))), elapsedMs: elapsed(startedAt, this.now) });
            }
            return createExecution({
                status:
                    CLRSTestRunStatus.COMPLETED,
                request: normalized,
                results: selectedCases.map(testCase =>
                    generationFailureResult(
                        normalized.suite,
                        testCase,
                        error
                    )
                ),
                elapsedMs: elapsed(
                    startedAt,
                    this.now
                )
            });
        }

        const results = [];
        // La instalación privada tiene sus propios límites; no consume el presupuesto de los casos.
        const executionStartedAt = this.now();

        for (const testCase of selectedCases) {
            const seed = deriveCLRSTestCaseSeed(
                normalized.seed,
                normalized.suite.id,
                testCase.id
            );

            if (normalized.signal?.aborted === true) {
                results.push(cancelledResult(
                    normalized.suite,
                    testCase,
                    seed
                ));
                continue;
            }

            const remaining = remainingBudget(
                executionStartedAt,
                this.now
            );

            if (remaining <= 0) {
                results.push(timeoutResult(
                    normalized.suite,
                    testCase,
                    seed,
                    "CLRS_TEST_TOTAL_TIMEOUT"
                ));
                continue;
            }

            let rawProcessResult;

            try {
                rawProcessResult =
                    await this.processRunner.run({
                        ...processOptions,
                        programCode,
                        stdin: testCase.input.stdin,
                        timeoutMs: Math.min(
                            testCase.timeoutMs,
                            remaining
                        ),
                        seed,
                        signal: normalized.signal
                    });
            } catch (error) {
                rawProcessResult = {
                    status:
                        CLRSTestProcessStatus
                            .START_FAILED,
                    stdout: "",
                    stderr: "",
                    exitCode: null,
                    signal: null,
                    elapsedMs: 0,
                    seed,
                    technicalMessage:
                        error instanceof Error
                            ? error.message
                            : String(error)
                };
            }

            const processResult =
                normalizeProcessResult(
                    rawProcessResult,
                    seed
                );

            results.push(caseResult(
                normalized.suite,
                testCase,
                processResult,
                coverageCatalog
            ));
        }

        return createExecution({
            status: normalized.signal?.aborted === true
                ? CLRSTestRunStatus.CANCELLED
                : CLRSTestRunStatus.COMPLETED,
            request: normalized,
            results,
            elapsedMs: elapsed(
                startedAt,
                this.now
            )
        });
    }
}

function normalizeRequest(source) {
    if (!isRecord(source)) {
        invalid(
            "CLRS_TEST_EXECUTION_REQUEST_INVALID",
            "request"
        );
    }

    const suite = createCLRSTestSuite(source.suite);
    const sourceCode = source.sourceCode;

    if (
        typeof sourceCode !== "string" ||
        sourceCode.length >
            CLRS_TEST_EXECUTION_LIMITS
                .maximumSourceCharacters
    ) {
        invalid(
            "CLRS_TEST_EXECUTION_SOURCE_INVALID",
            "sourceCode"
        );
    }

    const sourceVersion = source.sourceVersion ?? null;

    if (
        sourceVersion != null &&
        (
            !Number.isSafeInteger(sourceVersion) ||
            sourceVersion < 0
        )
    ) {
        invalid(
            "CLRS_TEST_EXECUTION_SOURCE_VERSION_INVALID",
            "sourceVersion"
        );
    }

    const seed = source.seed ?? 0;

    if (
        !Number.isSafeInteger(seed) ||
        seed < 0 ||
        seed > CLRS_TEST_LIMITS.maximumSeed
    ) {
        invalid(
            "CLRS_TEST_EXECUTION_SEED_INVALID",
            "seed"
        );
    }

    const signal = normalizeSignal(source.signal);

    return Object.freeze({
        suite,
        sourceCode,
        sourceVersion,
        caseIds: normalizeCaseIds(
            source.caseIds
        ),
        seed,
        signal
    });
}

function normalizeCaseIds(source) {
    if (source == null) {
        return null;
    }

    if (
        !Array.isArray(source) ||
        source.some(value =>
            typeof value !== "string" ||
            value.length === 0
        ) ||
        new Set(source).size !== source.length
    ) {
        invalid(
            "CLRS_TEST_EXECUTION_CASE_IDS_INVALID",
            "caseIds"
        );
    }

    return Object.freeze([...source]);
}

function normalizeSignal(value) {
    if (value == null) {
        return null;
    }

    if (
        typeof value.aborted !== "boolean" ||
        typeof value.addEventListener !== "function" ||
        typeof value.removeEventListener !== "function"
    ) {
        invalid(
            "CLRS_TEST_EXECUTION_SIGNAL_INVALID",
            "signal"
        );
    }

    return value;
}

function selectCases(suite, caseIds) {
    if (caseIds == null) {
        return suite.cases;
    }

    const selected = new Set(caseIds);
    const unknown = caseIds.filter(id =>
        !suite.cases.some(testCase =>
            testCase.id === id
        )
    );

    if (unknown.length > 0) {
        invalid(
            "CLRS_TEST_EXECUTION_CASE_UNKNOWN",
            "caseIds"
        );
    }

    return Object.freeze(
        suite.cases.filter(testCase =>
            selected.has(testCase.id)
        )
    );
}

function caseResult(
    suite,
    testCase,
    processResult,
    coverageCatalog
) {
    const common = {
        suiteId: suite.id,
        caseId: testCase.id,
        durationMs: processResult.elapsedMs,
        seed: processResult.seed,
        stdout: processResult.stdout,
        stderr: processResult.stderr,
        exitCode: processResult.exitCode,
        signal: processResult.signal,
        coverage:
            processResult.coverage == null
                ? null
                : aggregateCLRSTestCoverage({
                    sourcePath:
                        suite.programPath,
                    catalog: coverageCatalog,
                    ...processResult.coverage
                })
    };

    switch (processResult.status) {
        case CLRSTestProcessStatus.CANCELLED:
            return createCLRSTestResult({
                ...common,
                status:
                    CLRSTestResultStatus.CANCELLED
            });

        case CLRSTestProcessStatus.TIMED_OUT:
            return createCLRSTestResult({
                ...common,
                status:
                    CLRSTestResultStatus.ERRORED,
                failure: {
                    kind: CLRSTestFailureKind.TIMEOUT,
                    code: "CLRS_TEST_CASE_TIMEOUT",
                    message:
                        "La prueba excedió el tiempo máximo de ejecución."
                }
            });

        case CLRSTestProcessStatus.OUTPUT_LIMIT:
            return createCLRSTestResult({
                ...common,
                status:
                    CLRSTestResultStatus.ERRORED,
                failure: {
                    kind:
                        CLRSTestFailureKind
                            .OUTPUT_LIMIT,
                    code: "CLRS_TEST_OUTPUT_LIMIT",
                    message:
                        "La prueba produjo más salida de la permitida."
                }
            });

        case CLRSTestProcessStatus.START_FAILED:
            return createCLRSTestResult({
                ...common,
                status:
                    CLRSTestResultStatus.ERRORED,
                failure: {
                    kind:
                        CLRSTestFailureKind
                            .START_FAILURE,
                    code: "CLRS_TEST_PROCESS_START_FAILED",
                    message:
                        "No fue posible iniciar el programa para esta prueba."
                }
            });

        default:
            return createCompletedCLRSTestResult({
                suite,
                testCase,
                ...common
            });
    }
}

function sourceInvalidResult(
    suite,
    testCase,
    diagnostics
) {
    const normalizedDiagnostics =
        Array.isArray(diagnostics)
            ? diagnostics
            : [];
    const first = normalizedDiagnostics[0] ?? null;
    const kind = normalizedDiagnostics.some(
        diagnostic =>
            diagnostic?.phase === "semantic"
    )
        ? CLRSTestFailureKind.SEMANTIC
        : CLRSTestFailureKind.SYNTAX;

    return createCLRSTestResult({
        suiteId: suite.id,
        caseId: testCase.id,
        status: CLRSTestResultStatus.ERRORED,
        durationMs: 0,
        failure: {
            kind,
            code: inlineCode(first?.code),
            message: inlineMessage(
                first?.message,
                kind === CLRSTestFailureKind.SEMANTIC
                    ? "El programa contiene errores semánticos."
                    : "El programa contiene errores sintácticos."
            ),
            location: diagnosticLocation(
                first,
                suite.programPath
            ),
            diagnostics: normalizedDiagnostics
        }
    });
}

function generationFailureResult(suite, testCase, error) {
    const gui = guiTestPreparationDiagnostic(error);
    return createCLRSTestResult({
        suiteId: suite.id,
        caseId: testCase.id,
        status: CLRSTestResultStatus.ERRORED,
        durationMs: 0,
        failure: {
            kind: gui ? CLRSTestFailureKind.START_FAILURE : CLRSTestFailureKind.INTERNAL,
            code: gui?.code ?? "CLRS_TEST_GENERATION_FAILED",
            message:
                gui?.message ?? "No fue posible preparar el programa para las pruebas.",
            diagnostics: [{
                cause: error instanceof Error
                    ? error.name
                    : typeof error
            }]
        }
    });
}

function timeoutResult(
    suite,
    testCase,
    seed,
    code
) {
    return createCLRSTestResult({
        suiteId: suite.id,
        caseId: testCase.id,
        status: CLRSTestResultStatus.ERRORED,
        seed,
        failure: {
            kind: CLRSTestFailureKind.TIMEOUT,
            code,
            message:
                "La suite excedió el tiempo total permitido."
        }
    });
}

function cancelledResult(suite, testCase, seed) {
    return createCLRSTestResult({
        suiteId: suite.id,
        caseId: testCase.id,
        status: CLRSTestResultStatus.CANCELLED,
        seed
    });
}

function normalizeProcessResult(value, fallbackSeed) {
    if (
        !isRecord(value) ||
        !Object.values(CLRSTestProcessStatus)
            .includes(value.status) ||
        typeof value.stdout !== "string" ||
        typeof value.stderr !== "string" ||
        (
            value.exitCode != null &&
            !Number.isInteger(value.exitCode)
        ) ||
        (
            value.signal != null &&
            typeof value.signal !== "string"
        ) ||
        !Number.isSafeInteger(value.elapsedMs) ||
        value.elapsedMs < 0
    ) {
        invalid(
            "CLRS_TEST_PROCESS_RESULT_INVALID",
            "processResult"
        );
    }

    const seed = value.seed ?? fallbackSeed;

    if (
        !Number.isSafeInteger(seed) ||
        seed < 0 ||
        seed > CLRS_TEST_LIMITS.maximumSeed
    ) {
        invalid(
            "CLRS_TEST_PROCESS_RESULT_INVALID",
            "processResult.seed"
        );
    }

    return Object.freeze({
        status: value.status,
        stdout: value.stdout,
        stderr: value.stderr,
        exitCode: value.exitCode ?? null,
        signal: value.signal ?? null,
        elapsedMs: value.elapsedMs,
        seed,
        coverage: normalizeProcessCoverage(
            value.coverage
        )
    });
}

function normalizeCoverageCatalog(source) {
    if (source == null) {
        return Object.freeze([]);
    }

    if (!Array.isArray(source)) {
        invalid(
            "CLRS_TEST_COVERAGE_CATALOG_INVALID",
            "generation.coveragePoints"
        );
    }

    return Object.freeze([...source]);
}

function normalizeProcessCoverage(source) {
    if (source == null) {
        return null;
    }

    if (
        !isRecord(source) ||
        !Array.isArray(source.events) ||
        typeof source.complete !== "boolean" ||
        typeof source.truncated !== "boolean" ||
        source.events.length > 10_000
    ) {
        invalid(
            "CLRS_TEST_PROCESS_COVERAGE_INVALID",
            "processResult.coverage"
        );
    }

    return Object.freeze({
        events: Object.freeze([
            ...source.events
        ]),
        complete: source.complete,
        truncated: source.truncated
    });
}

function createExecution({
    status,
    request,
    results,
    elapsedMs
}) {
    const frozenResults = Object.freeze([...results]);

    return Object.freeze({
        executionVersion:
            CLRS_TEST_EXECUTION_VERSION,
        status,
        suiteId: request.suite.id,
        programPath: request.suite.programPath,
        sourceVersion: request.sourceVersion,
        results: frozenResults,
        summary: summarize(frozenResults),
        coverage: frozenResults.length === 0
            ? null
            : accumulateCLRSTestCoverage({
                coverages: frozenResults.map(
                    result => result.coverage
                ),
                testCount: frozenResults.length
            }),
        elapsedMs
    });
}

function summarize(results) {
    const summary = {
        total: results.length,
        passed: 0,
        failed: 0,
        errored: 0,
        skipped: 0,
        cancelled: 0
    };

    for (const result of results) {
        switch (result.status) {
            case CLRSTestResultStatus.PASSED:
                summary.passed += 1;
                break;
            case CLRSTestResultStatus.FAILED:
                summary.failed += 1;
                break;
            case CLRSTestResultStatus.ERRORED:
                summary.errored += 1;
                break;
            case CLRSTestResultStatus.SKIPPED:
                summary.skipped += 1;
                break;
            default:
                summary.cancelled += 1;
                break;
        }
    }

    return Object.freeze(summary);
}

function remainingBudget(startedAt, now) {
    return CLRS_TEST_EXECUTION_LIMITS
        .maximumTotalTimeoutMs -
        elapsed(startedAt, now);
}

function elapsed(startedAt, now) {
    const duration = Number(now()) - Number(startedAt);

    return Number.isFinite(duration) && duration >= 0
        ? Math.floor(duration)
        : 0;
}

function diagnosticLocation(diagnostic, sourcePath) {
    const location = diagnostic?.location;

    if (
        !Number.isSafeInteger(location?.startLine) ||
        location.startLine < 1 ||
        !Number.isSafeInteger(location?.startColumn) ||
        location.startColumn < 1
    ) {
        return null;
    }

    const candidateEndLine =
        Number.isSafeInteger(location.endLine) &&
        location.endLine >= location.startLine
            ? location.endLine
            : location.startLine;
    const candidateEndColumn =
        Number.isSafeInteger(location.endColumn) &&
        location.endColumn >= 1 &&
        (
            candidateEndLine > location.startLine ||
            location.endColumn >= location.startColumn
        )
            ? location.endColumn
            : location.startColumn;

    return {
        sourcePath,
        startLine: location.startLine,
        startColumn: location.startColumn,
        endLine: candidateEndLine,
        endColumn: candidateEndColumn
    };
}

function inlineMessage(value, fallback) {
    if (typeof value !== "string") {
        return fallback;
    }

    const normalized = value
        .replace(/\s+/gu, " ")
        .trim();

    return normalized.length === 0
        ? fallback
        : normalized.slice(0, 2_000);
}

function inlineCode(value) {
    return typeof value === "string" &&
        value.trim().length > 0
        ? value.trim().slice(
            0,
            CLRS_TEST_LIMITS
                .maximumIdentifierCharacters
        )
        : null;
}

function requirePort(value, name, methods) {
    if (
        value == null ||
        methods.some(method =>
            typeof value[method] !== "function"
        )
    ) {
        throw CLRSTestExecutionError
            .invalidPort(name, methods);
    }

    return value;
}

function requireFunction(value, name) {
    if (typeof value !== "function") {
        throw CLRSTestExecutionError
            .invalidPort(name, []);
    }

    return value;
}

function isRecord(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        (
            Object.getPrototypeOf(value) ===
                Object.prototype ||
            Object.getPrototypeOf(value) === null
        );
}

function invalid(code, field) {
    throw CLRSTestExecutionError
        .invalidRequest(code, field);
}
