import {
    CLRS_TEST_LIMITS,
    CLRSTestComparison,
    CLRSTestFailureKind,
    CLRSTestResultStatus
} from "./CLRSTestTypes.js";
import {
    freezeData,
    invalid,
    requireDataText,
    requireEnum,
    requireIdentifier,
    requireInlineText,
    requireNonNegativeInteger,
    requireNullableInlineText,
    requireNullableInteger,
    requireRecord
} from "./CLRSTestValidation.js";
import {
    validateCLRSTestExpectationFormat
} from "./CLRSTestComparisonSupport.js";
import {
    createCLRSTestDivergence
} from "./CLRSTestDivergence.js";
import {
    createCLRSTestPedagogicalExplanation
} from "./CLRSTestPedagogicalExplanation.js";
import {
    createCLRSTestCoverage
} from "./CLRSTestCoverage.js";

export class CLRSTestLocation {

    constructor(source = {}) {
        const input = requireRecord(
            source,
            "CLRS_TEST_LOCATION_INVALID",
            "location"
        );
        const startLine = requirePosition(
            input.startLine,
            "startLine"
        );
        const startColumn = requirePosition(
            input.startColumn,
            "startColumn"
        );
        const endLine = requirePosition(
            input.endLine ?? startLine,
            "endLine"
        );
        const endColumn = requirePosition(
            input.endColumn ?? startColumn,
            "endColumn"
        );

        if (
            endLine < startLine ||
            (
                endLine === startLine &&
                endColumn < startColumn
            )
        ) {
            invalid(
                "CLRS_TEST_LOCATION_RANGE_INVALID",
                "location"
            );
        }

        this.sourcePath = requirePath(
            input.sourcePath,
            "location.sourcePath"
        );
        this.startLine = startLine;
        this.startColumn = startColumn;
        this.endLine = endLine;
        this.endColumn = endColumn;

        Object.freeze(this);
    }
}

export class CLRSTestInput {

    constructor(source = {}) {
        const input = requireRecord(
            source,
            "CLRS_TEST_INPUT_INVALID",
            "input"
        );

        this.stdin = requireDataText(
            input.stdin ?? "",
            CLRS_TEST_LIMITS
                .maximumInputCharacters,
            "CLRS_TEST_INPUT_STDIN_INVALID",
            "input.stdin"
        );

        Object.freeze(this);
    }
}

export class CLRSTestExpectation {

    constructor(source = {}) {
        const input = requireRecord(
            source,
            "CLRS_TEST_EXPECTATION_INVALID",
            "expectation"
        );

        const stdout = requireDataText(
            input.stdout ?? "",
            CLRS_TEST_LIMITS
                .maximumExpectedCharacters,
            "CLRS_TEST_EXPECTATION_STDOUT_INVALID",
            "expectation.stdout"
        );
        const comparison = requireEnum(
            input.comparison ??
                CLRSTestComparison.EXACT,
            CLRSTestComparison,
            "CLRS_TEST_COMPARISON_INVALID",
            "expectation.comparison"
        );

        validateCLRSTestExpectationFormat(
            comparison,
            stdout
        );

        this.stdout = stdout;
        this.comparison = comparison;

        Object.freeze(this);
    }
}

export class CLRSTestCase {

    constructor(source = {}) {
        const input = requireRecord(
            source,
            "CLRS_TEST_CASE_INVALID",
            "testCase"
        );

        this.id = requireIdentifier(
            input.id,
            CLRS_TEST_LIMITS
                .maximumIdentifierCharacters,
            "CLRS_TEST_CASE_ID_INVALID",
            "testCase.id"
        );
        this.name = requireInlineText(
            input.name,
            CLRS_TEST_LIMITS.maximumNameCharacters,
            "CLRS_TEST_CASE_NAME_INVALID",
            "testCase.name"
        );
        this.input = input.input instanceof CLRSTestInput
            ? input.input
            : new CLRSTestInput(input.input);
        this.expectation = input.expectation instanceof
            CLRSTestExpectation
            ? input.expectation
            : new CLRSTestExpectation(
                input.expectation
            );
        this.timeoutMs = requireTimeout(
            input.timeoutMs ??
                CLRS_TEST_LIMITS.defaultTimeoutMs
        );
        this.definitionLocation = optionalLocation(
            input.definitionLocation,
            "testCase.definitionLocation"
        );

        Object.freeze(this);
    }
}

export class CLRSTestSuite {

    constructor(source = {}) {
        const input = requireRecord(
            source,
            "CLRS_TEST_SUITE_INVALID",
            "suite"
        );

        if (
            !Array.isArray(input.cases) ||
            input.cases.length >
                CLRS_TEST_LIMITS
                    .maximumCasesPerSuite
        ) {
            invalid(
                "CLRS_TEST_SUITE_CASES_INVALID",
                "suite.cases"
            );
        }

        const cases = input.cases.map(item =>
            item instanceof CLRSTestCase
                ? item
                : new CLRSTestCase(item)
        );

        if (
            new Set(cases.map(item => item.id))
                .size !== cases.length
        ) {
            invalid(
                "CLRS_TEST_CASE_IDS_DUPLICATED",
                "suite.cases"
            );
        }

        this.id = requireIdentifier(
            input.id,
            CLRS_TEST_LIMITS
                .maximumIdentifierCharacters,
            "CLRS_TEST_SUITE_ID_INVALID",
            "suite.id"
        );
        this.name = requireInlineText(
            input.name,
            CLRS_TEST_LIMITS.maximumNameCharacters,
            "CLRS_TEST_SUITE_NAME_INVALID",
            "suite.name"
        );
        this.programPath = requirePath(
            input.programPath,
            "suite.programPath"
        );
        this.definitionPath = input.definitionPath == null
            ? null
            : requirePath(
                input.definitionPath,
                "suite.definitionPath"
            );
        this.cases = Object.freeze(cases);

        Object.freeze(this);
    }
}

export class CLRSTestFailure {

    constructor(source = {}) {
        const input = requireRecord(
            source,
            "CLRS_TEST_FAILURE_INVALID",
            "failure"
        );
        const kind = requireEnum(
            input.kind,
            CLRSTestFailureKind,
            "CLRS_TEST_FAILURE_KIND_INVALID",
            "failure.kind"
        );
        const expected = optionalDataText(
            input.expected,
            CLRS_TEST_LIMITS
                .maximumExpectedCharacters,
            "failure.expected"
        );
        const actual = optionalDataText(
            input.actual,
            CLRS_TEST_LIMITS
                .maximumCapturedOutputCharacters,
            "failure.actual"
        );
        const divergence = input.divergence == null
            ? null
            : createCLRSTestDivergence(
                input.divergence
            );
        const pedagogicalExplanation =
            input.pedagogicalExplanation == null
                ? null
                : createCLRSTestPedagogicalExplanation(
                    input.pedagogicalExplanation
                );

        if (
            kind === CLRSTestFailureKind.ASSERTION &&
            (expected == null || actual == null)
        ) {
            invalid(
                "CLRS_TEST_ASSERTION_EVIDENCE_REQUIRED",
                "failure"
            );
        }

        if (
            divergence != null &&
            kind !== CLRSTestFailureKind.ASSERTION
        ) {
            invalid(
                "CLRS_TEST_DIVERGENCE_KIND_MISMATCH",
                "failure.divergence"
            );
        }

        if (
            pedagogicalExplanation != null &&
            (
                kind !== CLRSTestFailureKind.ASSERTION ||
                divergence == null
            )
        ) {
            invalid(
                "CLRS_TEST_EXPLANATION_EVIDENCE_MISMATCH",
                "failure.pedagogicalExplanation"
            );
        }

        this.kind = kind;
        this.code = requireNullableInlineText(
            input.code,
            CLRS_TEST_LIMITS
                .maximumIdentifierCharacters,
            "CLRS_TEST_FAILURE_CODE_INVALID",
            "failure.code"
        );
        this.message = requireInlineText(
            input.message,
            2_000,
            "CLRS_TEST_FAILURE_MESSAGE_INVALID",
            "failure.message"
        );
        this.expected = expected;
        this.actual = actual;
        this.divergence = divergence;
        this.pedagogicalExplanation =
            pedagogicalExplanation;
        this.location = optionalLocation(
            input.location,
            "failure.location"
        );
        this.diagnostics = freezeData(
            input.diagnostics ?? [],
            "CLRS_TEST_FAILURE_DIAGNOSTICS_INVALID",
            "failure.diagnostics"
        );

        if (!Array.isArray(this.diagnostics)) {
            invalid(
                "CLRS_TEST_FAILURE_DIAGNOSTICS_INVALID",
                "failure.diagnostics"
            );
        }

        Object.freeze(this);
    }
}

export class CLRSTestResult {

    constructor(source = {}) {
        const input = requireRecord(
            source,
            "CLRS_TEST_RESULT_INVALID",
            "result"
        );
        const status = requireEnum(
            input.status,
            CLRSTestResultStatus,
            "CLRS_TEST_RESULT_STATUS_INVALID",
            "result.status"
        );
        const failure = optionalFailure(
            input.failure
        );
        const requiresFailure =
            status === CLRSTestResultStatus.FAILED ||
            status === CLRSTestResultStatus.ERRORED;

        if (
            requiresFailure !== (failure != null)
        ) {
            invalid(
                "CLRS_TEST_RESULT_FAILURE_MISMATCH",
                "result.failure"
            );
        }

        if (
            status === CLRSTestResultStatus.FAILED &&
            failure.kind !==
                CLRSTestFailureKind.ASSERTION
        ) {
            invalid(
                "CLRS_TEST_RESULT_FAILURE_KIND_MISMATCH",
                "result.failure.kind"
            );
        }

        if (
            status === CLRSTestResultStatus.ERRORED &&
            failure.kind ===
                CLRSTestFailureKind.ASSERTION
        ) {
            invalid(
                "CLRS_TEST_RESULT_FAILURE_KIND_MISMATCH",
                "result.failure.kind"
            );
        }

        this.suiteId = requireIdentifier(
            input.suiteId,
            CLRS_TEST_LIMITS
                .maximumIdentifierCharacters,
            "CLRS_TEST_RESULT_SUITE_ID_INVALID",
            "result.suiteId"
        );
        this.caseId = requireIdentifier(
            input.caseId,
            CLRS_TEST_LIMITS
                .maximumIdentifierCharacters,
            "CLRS_TEST_RESULT_CASE_ID_INVALID",
            "result.caseId"
        );
        this.status = status;
        this.durationMs = requireNonNegativeInteger(
            input.durationMs ?? null,
            "CLRS_TEST_RESULT_DURATION_INVALID",
            "result.durationMs",
            { nullable: true }
        );
        this.seed = requireSeed(
            input.seed ?? null
        );
        this.stdout = requireDataText(
            input.stdout ?? "",
            CLRS_TEST_LIMITS
                .maximumCapturedOutputCharacters,
            "CLRS_TEST_RESULT_STDOUT_INVALID",
            "result.stdout"
        );
        this.stderr = requireDataText(
            input.stderr ?? "",
            CLRS_TEST_LIMITS
                .maximumCapturedOutputCharacters,
            "CLRS_TEST_RESULT_STDERR_INVALID",
            "result.stderr"
        );
        this.exitCode = requireNullableInteger(
            input.exitCode,
            "CLRS_TEST_RESULT_EXIT_CODE_INVALID",
            "result.exitCode"
        );
        this.signal = requireNullableInlineText(
            input.signal,
            128,
            "CLRS_TEST_RESULT_SIGNAL_INVALID",
            "result.signal"
        );
        this.failure = failure;
        this.coverage = input.coverage == null
            ? null
            : createCLRSTestCoverage(
                input.coverage
            );

        Object.freeze(this);
    }
}

export function createCLRSTestLocation(source) {
    return source instanceof CLRSTestLocation
        ? source
        : new CLRSTestLocation(source);
}

export function createCLRSTestInput(source) {
    return source instanceof CLRSTestInput
        ? source
        : new CLRSTestInput(source);
}

export function createCLRSTestExpectation(source) {
    return source instanceof CLRSTestExpectation
        ? source
        : new CLRSTestExpectation(source);
}

export function createCLRSTestCase(source) {
    return source instanceof CLRSTestCase
        ? source
        : new CLRSTestCase(source);
}

export function createCLRSTestSuite(source) {
    return source instanceof CLRSTestSuite
        ? source
        : new CLRSTestSuite(source);
}

export function createCLRSTestFailure(source) {
    return source instanceof CLRSTestFailure
        ? source
        : new CLRSTestFailure(source);
}

export function createCLRSTestResult(source) {
    return source instanceof CLRSTestResult
        ? source
        : new CLRSTestResult(source);
}

function requirePath(value, field) {
    return requireInlineText(
        value,
        CLRS_TEST_LIMITS.maximumPathCharacters,
        "CLRS_TEST_PATH_INVALID",
        field
    );
}

function requirePosition(value, field) {
    if (!Number.isSafeInteger(value) || value < 1) {
        invalid(
            "CLRS_TEST_LOCATION_POSITION_INVALID",
            `location.${field}`
        );
    }

    return value;
}

function requireTimeout(value) {
    if (
        !Number.isSafeInteger(value) ||
        value < CLRS_TEST_LIMITS.minimumTimeoutMs ||
        value > CLRS_TEST_LIMITS.maximumTimeoutMs
    ) {
        invalid(
            "CLRS_TEST_CASE_TIMEOUT_INVALID",
            "testCase.timeoutMs"
        );
    }

    return value;
}

function requireSeed(value) {
    if (value == null) {
        return null;
    }

    if (
        !Number.isSafeInteger(value) ||
        value < 0 ||
        value > CLRS_TEST_LIMITS.maximumSeed
    ) {
        invalid(
            "CLRS_TEST_RESULT_SEED_INVALID",
            "result.seed"
        );
    }

    return value;
}

function optionalLocation(value, field) {
    if (value == null) {
        return null;
    }

    try {
        return createCLRSTestLocation(value);
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }

        invalid(
            "CLRS_TEST_LOCATION_INVALID",
            field
        );
    }
}

function optionalFailure(value) {
    return value == null
        ? null
        : createCLRSTestFailure(value);
}

function optionalDataText(value, maximum, field) {
    return value == null
        ? null
        : requireDataText(
            value,
            maximum,
            "CLRS_TEST_FAILURE_EVIDENCE_INVALID",
            field
        );
}
