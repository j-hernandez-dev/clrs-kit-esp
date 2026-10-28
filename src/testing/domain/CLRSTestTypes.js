export const CLRSTestComparison = Object.freeze({
    EXACT: "exact",
    TRIMMED: "trimmed",
    NORMALIZED_WHITESPACE:
        "normalized-whitespace",
    LINES: "lines",
    UNORDERED_LINES: "unordered-lines",
    NUMBER: "number",
    NUMBER_TOLERANCE: "number-tolerance",
    JSON: "json",
    ARRAY_ORDERED: "array-ordered",
    ARRAY_UNORDERED: "array-unordered",
    BOOLEAN: "boolean",
    CONTAINS: "contains",
    REGEX_SAFE: "regex-safe"
});

export const CLRSTestResultStatus = Object.freeze({
    PASSED: "passed",
    FAILED: "failed",
    ERRORED: "errored",
    SKIPPED: "skipped",
    CANCELLED: "cancelled"
});

export const CLRSTestDivergenceKind = Object.freeze({
    TEXT: "text",
    LINES: "lines",
    NUMBER: "number",
    JSON: "json",
    ARRAY: "array",
    BOOLEAN: "boolean",
    CONTAINS: "contains",
    REGEX: "regex"
});

export const CLRSTestDivergenceReason = Object.freeze({
    VALUE_MISMATCH: "value-mismatch",
    TYPE_MISMATCH: "type-mismatch",
    MISSING_VALUE: "missing-value",
    UNEXPECTED_VALUE: "unexpected-value",
    INVALID_ACTUAL: "invalid-actual",
    OUTSIDE_TOLERANCE: "outside-tolerance",
    FRAGMENT_MISSING: "fragment-missing",
    PATTERN_MISMATCH: "pattern-mismatch"
});

export const CLRSTestRunStatus = Object.freeze({
    COMPLETED: "completed",
    SOURCE_INVALID: "source-invalid",
    CANCELLED: "cancelled"
});

export const CLRSTestFailureKind = Object.freeze({
    ASSERTION: "assertion",
    DEFINITION: "definition",
    SYNTAX: "syntax",
    SEMANTIC: "semantic",
    RUNTIME: "runtime",
    TIMEOUT: "timeout",
    OUTPUT_LIMIT: "output-limit",
    START_FAILURE: "start-failure",
    INTERNAL: "internal"
});

export const CLRS_TEST_LIMITS = Object.freeze({
    maximumIdentifierCharacters: 128,
    maximumNameCharacters: 256,
    maximumPathCharacters: 32_768,
    maximumInputCharacters: 1_048_576,
    maximumExpectedCharacters: 1_048_576,
    maximumCapturedOutputCharacters: 4_194_304,
    maximumCasesPerSuite: 10_000,
    maximumSeed: 4_294_967_295,
    minimumTimeoutMs: 1,
    maximumTimeoutMs: 60_000,
    defaultTimeoutMs: 5_000
});
