import {
    CLRSTestFailureKind,
    CLRSTestResultStatus,
    compareCLRSTestOutput,
    createCLRSTestResult,
    explainCLRSTestDivergence
} from "../domain/index.js";

export function createCompletedCLRSTestResult({
    suite,
    testCase,
    durationMs,
    seed,
    stdout,
    stderr,
    exitCode,
    signal = null,
    coverage = null
}) {
    const common = {
        suiteId: suite.id,
        caseId: testCase.id,
        durationMs,
        seed,
        stdout,
        stderr,
        exitCode,
        signal,
        coverage
    };

    if (exitCode !== 0) {
        const runtimeEvidence =
            parseCLRSTestRuntimeEvidence(stderr);

        return createCLRSTestResult({
            ...common,
            status: CLRSTestResultStatus.ERRORED,
            failure: {
                kind: CLRSTestFailureKind.RUNTIME,
                code: "CLRS_TEST_RUNTIME_ERROR",
                message: runtimeEvidence.message ??
                    "El programa terminó con un error de ejecución.",
                location: runtimeEvidence.location == null
                    ? null
                    : {
                        sourcePath: suite.programPath,
                        ...runtimeEvidence.location
                    }
            }
        });
    }

    const expected = testCase.expectation.stdout;
    const comparison = compareCLRSTestOutput(
        testCase.expectation,
        stdout
    );

    if (comparison.passed) {
        return createCLRSTestResult({
            ...common,
            status: CLRSTestResultStatus.PASSED
        });
    }

    return createCLRSTestResult({
        ...common,
        status: CLRSTestResultStatus.FAILED,
        failure: {
            kind: CLRSTestFailureKind.ASSERTION,
            code: "CLRS_TEST_OUTPUT_MISMATCH",
            message:
                "La salida no coincide con la esperada.",
            expected,
            actual: stdout,
            divergence: comparison.divergence,
            pedagogicalExplanation:
                explainCLRSTestDivergence({
                    comparison:
                        testCase.expectation.comparison,
                    divergence:
                        comparison.divergence
                })
        }
    });
}

export function parseCLRSTestRuntimeEvidence(stderr) {
    const normalized = stderr
        .replace(/\r\n/gu, "\n")
        .replace(/\r/gu, "\n")
        .trim();

    if (!normalized.startsWith("✕ Error de ejecución")) {
        return Object.freeze({
            message: null,
            location: null
        });
    }

    const withoutHeading = normalized
        .slice("✕ Error de ejecución".length)
        .trim();
    const locationMatch = withoutHeading.match(
        /(?:^|\n)\s*Línea\s+(\d+)(?:,\s*columna\s+(\d+))?\s*$/u
    );
    const line = Number.parseInt(
        locationMatch?.[1] ?? "",
        10
    );
    const column = Number.parseInt(
        locationMatch?.[2] ?? "1",
        10
    );
    const messageSource = locationMatch == null
        ? withoutHeading
        : withoutHeading.slice(
            0,
            locationMatch.index
        );
    const message = inlineMessage(
        messageSource,
        "El programa terminó con un error de ejecución."
    );
    const location = Number.isSafeInteger(line) &&
        line >= 1 &&
        Number.isSafeInteger(column) &&
        column >= 1
        ? Object.freeze({
            startLine: line,
            startColumn: column,
            endLine: line,
            endColumn: column
        })
        : null;

    return Object.freeze({ message, location });
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
