import {
    requireFunction,
    requirePort
} from "../../application/ports/ApplicationPorts.js";
import {
    BrokerContractState
} from "../core/BrokerContract.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    createBrokerTestCases
} from "../core/BrokerTestCase.js";
import {
    compareBrokerTestOutput
} from "./BrokerTestOutputComparator.js";
import { prepareCLRSTestRuntime, guiTestPreparationDiagnostic } from "../../testing/execution/CLRSTestRuntimePreparation.js";

export const BROKER_TEST_EXECUTION_VERSION = 1;

export const BROKER_TEST_EXECUTION_LIMITS =
    Object.freeze({
        maximumTotalTimeoutMs: 30_000
    });

export const BrokerTestExecutionStatus =
    Object.freeze({
        COMPLETED: "completed",
        SOURCE_INVALID: "source-invalid"
    });

export const BrokerTestCaseExecutionStatus =
    Object.freeze({
        PASSED: "passed",
        FAILED: "failed",
        RUNTIME_ERROR: "runtime-error",
        TIMED_OUT: "timed-out",
        OUTPUT_LIMIT: "output-limit",
        START_FAILED: "start-failed",
        INVALID: "invalid",
        NOT_RUN: "not-run"
    });

/**
 * Evalúa los casos declarativos del contrato activo contra una captura
 * puntual del documento CLRS. El resultado es privado del Host: no muta la
 * partida, no persiste la captura y no se publica al Webview.
 */
export class BrokerTestExecutionService {

    constructor(options = {}) {
        this.runtimePreparation = options.runtimePreparation ?? null;
        this.gameSession = requirePort(
            options.gameSession,
            "brokerGameSession",
            ["initialize", "getState"]
        );
        this.documentCapture = requirePort(
            options.documentCapture,
            "brokerDocumentCapture",
            ["capture"]
        );
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
        this.programRunner = requirePort(
            options.programRunner,
            "brokerTestProcessRunner",
            ["run"]
        );
        this.now = requireFunction(
            options.now ?? Date.now,
            "brokerTestExecutionClock"
        );
    }

    async executeActiveContract() {
        await this.gameSession.initialize();
        const contract = activeContract(
            this.gameSession.getState()
        );

        if (contract == null) {
            throw BrokerGameError.invalidRule(
                "BROKER95_TEST_EXECUTION_ACTIVE_CONTRACT_REQUIRED",
                "No hay ningún contrato activo para ejecutar sus pruebas.",
                []
            );
        }

        return this.executeContract(contract);
    }

    async executeContract(contract) {
        const capture = this.documentCapture.capture();

        return this.executeContractCapture(
            contract,
            capture
        );
    }

    async executeContractCapture(contract, capture, options = {}) {
        const testCases = validateContractTestCases(contract);

        validateCapture(capture);

        const analysis = this.documentAnalysisService.analyze({
            key: capture.document.documentId,
            version: capture.document.version,
            sourceCode: capture.sourceCode
        });

        if (options.signal?.aborted) {
            return executionResult({ status: BrokerTestExecutionStatus.COMPLETED, contract, capture, analysis,
                results: testCases.map(testCase => notRunResult(testCase, "cancelled")), elapsedMs: 0 });
        }

        if (!analysis.ok || analysis.ast == null) {
            return sourceInvalidResult(
                contract,
                capture,
                analysis,
                testCases
            );
        }

        let programCode;
        let processOptions = {};

        try {
            const prepared = await prepareCLRSTestRuntime(this.runtimePreparation, analysis.semanticModel, options.signal);
            processOptions = prepared.processOptions;
            programCode = this.javaScriptGenerator.generate(
                analysis.ast,
                {
                    ...(prepared.runtimeContext ? { runtimeContext: prepared.runtimeContext } : {}),
                    semanticModel:
                        analysis.semanticModel
                }
            ).generatedCode;
        } catch (error) {
            if (options.signal?.aborted) {
                return executionResult({ status: BrokerTestExecutionStatus.COMPLETED, contract, capture, analysis,
                    results: testCases.map(testCase => notRunResult(testCase, "cancelled")), elapsedMs: 0 });
            }
            const gui = guiTestPreparationDiagnostic(error);
            if (gui) {
                return executionResult({ status: BrokerTestExecutionStatus.COMPLETED, contract, capture, analysis,
                    results: testCases.map(testCase => Object.freeze({ ...notRunResult(testCase, "runtime-preparation-failed"),
                        status: BrokerTestCaseExecutionStatus.START_FAILED, stderr: `[${gui.code}] ${gui.message}` })), elapsedMs: 0 });
            }
            throw BrokerGameError.invalidRule(
                "BROKER95_TEST_EXECUTION_GENERATION_FAILED",
                "No fue posible preparar el programa CLRS para las pruebas.",
                [{
                    cause: error instanceof Error
                        ? error.name
                        : typeof error
                }]
            );
        }

        const startedAt = this.now();
        const results = [];

        for (const testCase of testCases) {
            if (options.signal?.aborted) { results.push(notRunResult(testCase, "cancelled")); continue; }
            const remaining = remainingBudget(
                startedAt,
                this.now
            );

            if (remaining <= 0) {
                results.push(notRunResult(
                    testCase,
                    "total-time-budget-exhausted"
                ));
                continue;
            }

            const execution = await this.programRunner.run({
                ...processOptions,
                ...(options.signal ? { signal: options.signal } : {}),
                programCode,
                stdin: testCase.stdin,
                timeoutMs: Math.min(
                    testCase.timeoutMs,
                    remaining
                )
            });

            results.push(execution.status === "cancelled" ? notRunResult(testCase, "cancelled") : caseResult(testCase, execution));
        }

        return executionResult({
            status: BrokerTestExecutionStatus.COMPLETED,
            contract,
            capture,
            analysis,
            results,
            elapsedMs: elapsed(startedAt, this.now)
        });
    }
}

function validateCapture(capture) {
    if (
        capture == null ||
        typeof capture !== "object" ||
        typeof capture.document?.documentId !== "string" ||
        !Number.isSafeInteger(
            capture.document?.version
        ) ||
        typeof capture.sourceCode !== "string" ||
        typeof capture.sourceHash !== "string"
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_TEST_EXECUTION_CAPTURE_INVALID",
            "No fue posible preparar la captura CLRS para las pruebas.",
            []
        );
    }
}

function activeContract(state) {
    if (state?.activeContractId == null) {
        return null;
    }

    const contract = state.contracts?.find(
        item => item.id === state.activeContractId
    );

    return contract?.state === BrokerContractState.ACTIVE
        ? contract
        : null;
}

function validateContractTestCases(contract) {
    if (
        contract == null ||
        typeof contract !== "object" ||
        !Array.isArray(contract.requirements) ||
        !Array.isArray(contract.metadata?.requirementIds)
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_TEST_EXECUTION_CONTRACT_INVALID",
            "El contrato activo no contiene casos de prueba válidos.",
            []
        );
    }

    return createBrokerTestCases(
        contract.testCases,
        contract.metadata.requirementIds,
        { requireAtLeastOne: true }
    );
}

function sourceInvalidResult(
    contract,
    capture,
    analysis,
    testCases
) {
    return executionResult({
        status: BrokerTestExecutionStatus.SOURCE_INVALID,
        contract,
        capture,
        analysis,
        results: testCases.map(testCase => notRunResult(
            testCase,
            "source-invalid"
        )),
        elapsedMs: 0
    });
}

function caseResult(testCase, execution) {
    const normalized = normalizeExecution(execution);
    const common = {
        id: testCase.id,
        kind: testCase.kind,
        requirementIds: Object.freeze([
            ...testCase.requirementIds
        ]),
        comparison: testCase.comparison,
        stdout: normalized.stdout,
        stderr: normalized.stderr,
        exitCode: normalized.exitCode,
        signal: normalized.signal,
        elapsedMs: normalized.elapsedMs
    };

    if (normalized.status === "timed-out") {
        return Object.freeze({
            ...common,
            status: BrokerTestCaseExecutionStatus.TIMED_OUT,
            reason: "timeout"
        });
    }

    if (normalized.status === "output-limit") {
        return Object.freeze({
            ...common,
            status: BrokerTestCaseExecutionStatus.OUTPUT_LIMIT,
            reason: "output-limit"
        });
    }

    if (normalized.status === "start-failed") {
        return Object.freeze({
            ...common,
            status: BrokerTestCaseExecutionStatus.START_FAILED,
            reason: "process-start-failed"
        });
    }

    if (normalized.exitCode !== 0) {
        return Object.freeze({
            ...common,
            status: BrokerTestCaseExecutionStatus.RUNTIME_ERROR,
            reason: "runtime-error"
        });
    }

    let comparison;

    try {
        comparison = compareBrokerTestOutput(
            testCase,
            normalized.stdout
        );
    } catch (error) {
        if (error?.code === "BROKER95_TEST_REGEX_INVALID") {
            return Object.freeze({
                ...common,
                status: BrokerTestCaseExecutionStatus.INVALID,
                reason: "invalid-comparison"
            });
        }

        throw error;
    }

    return Object.freeze({
        ...common,
        status: comparison.passed
            ? BrokerTestCaseExecutionStatus.PASSED
            : BrokerTestCaseExecutionStatus.FAILED,
        reason: comparison.reason
    });
}

function notRunResult(testCase, reason) {
    return Object.freeze({
        id: testCase.id,
        kind: testCase.kind,
        requirementIds: Object.freeze([
            ...testCase.requirementIds
        ]),
        comparison: testCase.comparison,
        status: BrokerTestCaseExecutionStatus.NOT_RUN,
        reason,
        stdout: "",
        stderr: "",
        exitCode: null,
        signal: null,
        elapsedMs: 0
    });
}

function normalizeExecution(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        !["completed", "timed-out", "output-limit", "start-failed"]
            .includes(value.status) ||
        typeof value.stdout !== "string" ||
        typeof value.stderr !== "string" ||
        (value.exitCode != null &&
            !Number.isInteger(value.exitCode)) ||
        (value.signal != null &&
            typeof value.signal !== "string") ||
        !Number.isSafeInteger(value.elapsedMs) ||
        value.elapsedMs < 0
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_TEST_EXECUTION_RESULT_INVALID",
            "El ejecutor de pruebas devolvió un resultado no válido.",
            []
        );
    }

    return value;
}

function executionResult({
    status,
    contract,
    capture,
    analysis,
    results,
    elapsedMs
}) {
    const frozenResults = Object.freeze([
        ...results
    ]);

    return Object.freeze({
        executionVersion: BROKER_TEST_EXECUTION_VERSION,
        ...(analysis.semanticModel?.gui?.usage.requiresGui ? { gui: Object.freeze({
            comparison: "stdout-and-exit-status", visualBehaviorValidated: false,
            note: "Las pruebas no simulan interacción humana. Una ventana o diálogo pendiente puede agotar el tiempo límite; eso no demuestra por sí solo un ciclo infinito. La salida correcta no certifica la interfaz gráfica." }) } : {}),
        status,
        contractId: contract.id,
        document: Object.freeze({
            name: capture.document.name,
            languageId: capture.document.languageId,
            version: capture.document.version,
            sourceHash: capture.sourceHash
        }),
        analysis: Object.freeze({
            status: analysis.ok ? "valid" : "invalid",
            diagnosticCount: capture.analysis.diagnosticCount,
            diagnostics: capture.analysis.diagnostics
        }),
        summary: summarize(frozenResults),
        testCases: frozenResults,
        elapsedMs
    });
}

function summarize(results) {
    const summary = {
        total: results.length,
        passed: 0,
        failed: 0,
        runtimeErrors: 0,
        timedOut: 0,
        outputLimited: 0,
        startFailed: 0,
        invalid: 0,
        notRun: 0
    };

    for (const result of results) {
        switch (result.status) {
            case BrokerTestCaseExecutionStatus.PASSED:
                summary.passed += 1;
                break;

            case BrokerTestCaseExecutionStatus.FAILED:
                summary.failed += 1;
                break;

            case BrokerTestCaseExecutionStatus.RUNTIME_ERROR:
                summary.runtimeErrors += 1;
                break;

            case BrokerTestCaseExecutionStatus.TIMED_OUT:
                summary.timedOut += 1;
                break;

            case BrokerTestCaseExecutionStatus.OUTPUT_LIMIT:
                summary.outputLimited += 1;
                break;

            case BrokerTestCaseExecutionStatus.START_FAILED:
                summary.startFailed += 1;
                break;

            case BrokerTestCaseExecutionStatus.INVALID:
                summary.invalid += 1;
                break;

            default:
                summary.notRun += 1;
                break;
        }
    }

    return Object.freeze(summary);
}

function remainingBudget(startedAt, now) {
    return BROKER_TEST_EXECUTION_LIMITS
        .maximumTotalTimeoutMs - elapsed(startedAt, now);
}

function elapsed(startedAt, now) {
    const duration = Number(now()) - Number(startedAt);

    return Number.isFinite(duration) && duration >= 0
        ? Math.floor(duration)
        : 0;
}
