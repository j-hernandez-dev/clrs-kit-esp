import assert from "node:assert/strict";
import test from "node:test";

import {
    CLRS_TEST_LIMITS,
    CLRSTestCoverage,
    CLRSTestCoveragePoint,
    CLRSTestCase,
    CLRSTestComparison,
    CLRSTestDomainError,
    CLRSTestDivergence,
    CLRSTestDivergenceKind,
    CLRSTestDivergenceReason,
    CLRSTestExpectation,
    CLRSTestFailure,
    CLRSTestFailureKind,
    CLRSTestInput,
    CLRSTestLocation,
    CLRSTestResult,
    CLRSTestResultStatus,
    CLRSTestSuite,
    accumulateCLRSTestCoverage,
    aggregateCLRSTestCoverage,
    createCLRSTestCase,
    createCLRSTestDivergence,
    createCLRSTestExpectation,
    createCLRSTestFailure,
    createCLRSTestInput,
    createCLRSTestLocation,
    createCLRSTestResult,
    createCLRSTestSuite
} from "../src/testing/index.js";
import {
    createExecutionCoveragePoint,
    ExecutionCoverageKind
} from "../src/runtime/ExecutionCoverageEvent.js";

test("modela una suite CLRS inmutable de entrada y salida", () => {
    const suite = createCLRSTestSuite({
        id: "suite:suma",
        name: "Programa suma",
        programPath: "proyecto/suma.clrs",
        definitionPath:
            "proyecto/suma.clrs-tests.json",
        cases: [{
            id: "case:positivos",
            name: "Suma dos positivos",
            input: {
                stdin: "5\n8\n"
            },
            expectation: {
                stdout: "13\n"
            },
            definitionLocation: {
                sourcePath:
                    "proyecto/suma.clrs-tests.json",
                startLine: 4,
                startColumn: 5,
                endLine: 9,
                endColumn: 6
            }
        }]
    });

    assert.ok(suite instanceof CLRSTestSuite);
    assert.ok(suite.cases[0] instanceof CLRSTestCase);
    assert.ok(
        suite.cases[0].input instanceof
            CLRSTestInput
    );
    assert.ok(
        suite.cases[0].expectation instanceof
            CLRSTestExpectation
    );
    assert.ok(
        suite.cases[0].definitionLocation instanceof
            CLRSTestLocation
    );
    assert.equal(
        suite.cases[0].timeoutMs,
        CLRS_TEST_LIMITS.defaultTimeoutMs
    );
    assert.equal(
        suite.cases[0].expectation.comparison,
        CLRSTestComparison.EXACT
    );
    assert.equal(Object.isFrozen(suite), true);
    assert.equal(Object.isFrozen(suite.cases), true);
    assert.equal(
        Object.isFrozen(suite.cases[0]),
        true
    );
});

test("preserva literalmente los datos de entrada y salida", () => {
    const input = createCLRSTestInput({
        stdin: "  texto con espacios  \r\n"
    });
    const expectation =
        createCLRSTestExpectation({
            stdout: "  salida exacta  \n"
        });

    assert.equal(
        input.stdin,
        "  texto con espacios  \r\n"
    );
    assert.equal(
        expectation.stdout,
        "  salida exacta  \n"
    );
    assert.equal(Object.isFrozen(input), true);
    assert.equal(
        Object.isFrozen(expectation),
        true
    );
});

test("rechaza IDs duplicados dentro de una suite", () => {
    assertDomainError(
        () => createCLRSTestSuite({
            id: "suite:duplicada",
            name: "Suite duplicada",
            programPath: "programa.clrs",
            cases: [
                testCase({ id: "case:igual" }),
                testCase({ id: "case:igual" })
            ]
        }),
        "CLRS_TEST_CASE_IDS_DUPLICATED"
    );
});

test("valida límites, nombres, ubicaciones y tiempos", () => {
    const invalidCases = [
        [
            () => createCLRSTestCase(
                testCase({ id: "espacio inválido" })
            ),
            "CLRS_TEST_CASE_ID_INVALID"
        ],
        [
            () => createCLRSTestCase(
                testCase({ name: "  " })
            ),
            "CLRS_TEST_CASE_NAME_INVALID"
        ],
        [
            () => createCLRSTestCase(
                testCase({ timeoutMs: 0 })
            ),
            "CLRS_TEST_CASE_TIMEOUT_INVALID"
        ],
        [
            () => createCLRSTestLocation({
                sourcePath: "programa.clrs",
                startLine: 4,
                startColumn: 2,
                endLine: 3,
                endColumn: 1
            }),
            "CLRS_TEST_LOCATION_RANGE_INVALID"
        ],
        [
            () => createCLRSTestInput({
                stdin: "a".repeat(
                    CLRS_TEST_LIMITS
                        .maximumInputCharacters + 1
                )
            }),
            "CLRS_TEST_INPUT_STDIN_INVALID"
        ]
    ];

    for (const [operation, code] of invalidCases) {
        assertDomainError(operation, code);
    }
});

test("estructura fallos con evidencia y diagnósticos inmutables", () => {
    const diagnostics = [{
        code: "CLRS_SEMANTIC_UNKNOWN_SYMBOL",
        location: {
            startLine: 3,
            startColumn: 5
        }
    }];
    const failure = createCLRSTestFailure({
        kind: CLRSTestFailureKind.ASSERTION,
        code: "CLRS_TEST_OUTPUT_MISMATCH",
        message:
            "La salida no coincide con la esperada.",
        expected: "13\n",
        actual: "58\n",
        location: {
            sourcePath: "suma.clrs",
            startLine: 5,
            startColumn: 1,
            endLine: 5,
            endColumn: 20
        },
        divergence: {
            kind: CLRSTestDivergenceKind.JSON,
            reason:
                CLRSTestDivergenceReason.VALUE_MISMATCH,
            path: ["resultado", 1],
            expected: { valor: 13 },
            actual: { valor: 58 }
        },
        diagnostics
    });

    diagnostics[0].code = "modificado";

    assert.ok(failure instanceof CLRSTestFailure);
    assert.equal(
        failure.diagnostics[0].code,
        "CLRS_SEMANTIC_UNKNOWN_SYMBOL"
    );
    assert.equal(
        Object.isFrozen(failure.diagnostics),
        true
    );
    assert.equal(
        Object.isFrozen(
            failure.diagnostics[0].location
        ),
        true
    );
    assert.ok(
        failure.divergence instanceof
            CLRSTestDivergence
    );
    assert.deepEqual(
        [...failure.divergence.path],
        ["resultado", 1]
    );
    assert.equal(
        Object.isFrozen(
            failure.divergence.expected
        ),
        true
    );
    assertDomainError(
        () => createCLRSTestFailure({
            kind:
                CLRSTestFailureKind.ASSERTION,
            message: "Falta evidencia."
        }),
        "CLRS_TEST_ASSERTION_EVIDENCE_REQUIRED"
    );
});

test("valida la estructura de una primera divergencia", () => {
    const divergence = createCLRSTestDivergence({
        kind: CLRSTestDivergenceKind.NUMBER,
        reason:
            CLRSTestDivergenceReason
                .OUTSIDE_TOLERANCE,
        expected: 10,
        actual: 10.5,
        difference: 0.5,
        tolerance: 0.25
    });

    assert.equal(divergence.difference, 0.5);
    assert.equal(divergence.tolerance, 0.25);
    assert.equal(Object.isFrozen(divergence), true);
    assertDomainError(
        () => createCLRSTestDivergence({
            kind: "stack",
            reason:
                CLRSTestDivergenceReason
                    .VALUE_MISMATCH
        }),
        "CLRS_TEST_DIVERGENCE_KIND_INVALID"
    );
    assertDomainError(
        () => createCLRSTestFailure({
            kind: CLRSTestFailureKind.RUNTIME,
            message: "Error.",
            divergence
        }),
        "CLRS_TEST_DIVERGENCE_KIND_MISMATCH"
    );
    assertDomainError(
        () => createCLRSTestFailure({
            kind: CLRSTestFailureKind.ASSERTION,
            message: "Salida diferente.",
            expected: "1",
            actual: "2",
            pedagogicalExplanation: {
                title: "Diferencia",
                summary: "Los valores difieren.",
                technicalDetail: "Esperado 1; obtenido 2.",
                guidance: "Revisa el cálculo."
            }
        }),
        "CLRS_TEST_EXPLANATION_EVIDENCE_MISMATCH"
    );
});

test("modela resultados finales y preserva sus invariantes", () => {
    const passed = createCLRSTestResult({
        suiteId: "suite:suma",
        caseId: "case:positivos",
        status: CLRSTestResultStatus.PASSED,
        durationMs: 12,
        seed: 42,
        stdout: "13\n",
        exitCode: 0
    });
    const failed = createCLRSTestResult({
        suiteId: "suite:suma",
        caseId: "case:concatenacion",
        status: CLRSTestResultStatus.FAILED,
        durationMs: 9,
        stdout: "58\n",
        exitCode: 0,
        failure: {
            kind:
                CLRSTestFailureKind.ASSERTION,
            message: "Salida diferente.",
            expected: "13\n",
            actual: "58\n"
        }
    });
    const errored = createCLRSTestResult({
        suiteId: "suite:suma",
        caseId: "case:error",
        status: CLRSTestResultStatus.ERRORED,
        durationMs: 2,
        stderr: "Variable no definida",
        exitCode: 1,
        failure: {
            kind: CLRSTestFailureKind.SEMANTIC,
            message: "La variable no está definida."
        }
    });

    assert.ok(passed instanceof CLRSTestResult);
    assert.equal(passed.seed, 42);
    assert.equal(passed.failure, null);
    assert.ok(failed.failure instanceof CLRSTestFailure);
    assert.equal(
        failed.failure.kind,
        CLRSTestFailureKind.ASSERTION
    );
    assert.equal(
        errored.failure.kind,
        CLRSTestFailureKind.SEMANTIC
    );
    assert.equal(Object.isFrozen(failed), true);
});

test("agrega cobertura inmutable e independiente para una prueba", () => {
    const statement = coveragePoint(
        ExecutionCoverageKind.STATEMENT,
        2
    );
    const branch = coveragePoint(
        ExecutionCoverageKind.BRANCH,
        3
    );
    const loop = coveragePoint(
        ExecutionCoverageKind.LOOP,
        5
    );
    const functionPoint = coveragePoint(
        ExecutionCoverageKind.FUNCTION,
        1,
        "PRINCIPAL"
    );
    const coverage = aggregateCLRSTestCoverage({
        sourcePath: "programa.clrs",
        catalog: [
            functionPoint,
            statement,
            branch,
            loop
        ],
        events: [
            statement,
            statement,
            { ...branch, outcome: true },
            { ...loop, outcome: true },
            { ...loop, outcome: false }
        ],
        complete: true,
        truncated: false
    });

    assert.ok(coverage instanceof CLRSTestCoverage);
    assert.ok(
        coverage.points[0] instanceof
            CLRSTestCoveragePoint
    );
    assert.equal(
        coverage.points.find(point =>
            point.pointId === statement.pointId
        ).hitCount,
        2
    );
    assert.deepEqual(
        coverage.points.find(point =>
            point.pointId === branch.pointId
        ).outcomeCounts,
        { true: 1, false: 0 }
    );
    assert.deepEqual(coverage.summary, {
        totalPoints: 4,
        coveredPoints: 3,
        totalStatements: 1,
        coveredStatements: 1,
        totalFunctions: 1,
        coveredFunctions: 0,
        totalBranchOutcomes: 2,
        coveredBranchOutcomes: 1,
        totalLoopOutcomes: 2,
        coveredLoopOutcomes: 2
    });
    assert.equal(coverage.eventCount, 5);
    assert.equal(coverage.complete, true);
    assert.equal(Object.isFrozen(coverage), true);
    assert.equal(Object.isFrozen(coverage.points), true);
    assert.equal(
        Object.isFrozen(
            coverage.points[2].outcomeCounts
        ),
        true
    );
});

test("rechaza conteos de cobertura incoherentes", () => {
    const branch = coveragePoint(
        ExecutionCoverageKind.BRANCH,
        2
    );

    assertDomainError(
        () => new CLRSTestCoveragePoint({
            ...branch,
            location: {
                sourcePath: "programa.clrs",
                ...branch.location
            },
            hitCount: 1,
            outcomeCounts: {
                true: 1,
                false: 1
            }
        }),
        "CLRS_TEST_COVERAGE_OUTCOMES_MISMATCH"
    );
});

test("acumula visitas y resultados de cobertura entre pruebas", () => {
    const statement = coveragePoint(
        ExecutionCoverageKind.STATEMENT,
        2
    );
    const branch = coveragePoint(
        ExecutionCoverageKind.BRANCH,
        3
    );
    const catalog = [statement, branch];
    const first = aggregateCLRSTestCoverage({
        sourcePath: "programa.clrs",
        catalog,
        events: [
            statement,
            statement,
            { ...branch, outcome: true }
        ],
        complete: true
    });
    const second = aggregateCLRSTestCoverage({
        sourcePath: "programa.clrs",
        catalog,
        events: [
            statement,
            { ...branch, outcome: false }
        ],
        complete: true
    });
    const accumulated =
        accumulateCLRSTestCoverage({
            coverages: [first, second]
        });

    assert.ok(accumulated instanceof CLRSTestCoverage);
    assert.equal(accumulated.testCount, 2);
    assert.equal(accumulated.evidenceTestCount, 2);
    assert.equal(accumulated.complete, true);
    assert.equal(accumulated.truncated, false);
    assert.equal(accumulated.eventCount, 5);
    assert.equal(
        accumulated.points.find(point =>
            point.pointId === statement.pointId
        ).hitCount,
        3
    );
    assert.deepEqual(
        accumulated.points.find(point =>
            point.pointId === branch.pointId
        ).outcomeCounts,
        { true: 1, false: 1 }
    );
    assert.equal(
        accumulated.summary.coveredBranchOutcomes,
        2
    );
    assert.equal(Object.isFrozen(accumulated), true);
});

test("marca como parcial una acumulación sin evidencia de todos los casos", () => {
    const statement = coveragePoint(
        ExecutionCoverageKind.STATEMENT,
        2
    );
    const first = aggregateCLRSTestCoverage({
        sourcePath: "programa.clrs",
        catalog: [statement],
        events: [statement],
        complete: true
    });
    const accumulated =
        accumulateCLRSTestCoverage({
            coverages: [first, null]
        });

    assert.equal(accumulated.testCount, 2);
    assert.equal(accumulated.evidenceTestCount, 1);
    assert.equal(accumulated.complete, false);
    assert.equal(accumulated.summary.coveredPoints, 1);
});

test("rechaza mezclar coberturas incompatibles", () => {
    const statement = coveragePoint(
        ExecutionCoverageKind.STATEMENT,
        2
    );
    const first = aggregateCLRSTestCoverage({
        sourcePath: "primero.clrs",
        catalog: [statement],
        complete: true
    });
    const second = aggregateCLRSTestCoverage({
        sourcePath: "segundo.clrs",
        catalog: [statement],
        complete: true
    });

    assertDomainError(
        () => accumulateCLRSTestCoverage({
            coverages: [first, second]
        }),
        "CLRS_TEST_COVERAGE_POINT_CONFLICT"
    );
});

test("impide resultados incoherentes con su fallo", () => {
    const cases = [
        {
            status: CLRSTestResultStatus.PASSED,
            failure: assertionFailure(),
            code:
                "CLRS_TEST_RESULT_FAILURE_MISMATCH"
        },
        {
            status: CLRSTestResultStatus.FAILED,
            failure: null,
            code:
                "CLRS_TEST_RESULT_FAILURE_MISMATCH"
        },
        {
            status: CLRSTestResultStatus.FAILED,
            failure: {
                kind: CLRSTestFailureKind.RUNTIME,
                message: "Error de ejecución."
            },
            code:
                "CLRS_TEST_RESULT_FAILURE_KIND_MISMATCH"
        },
        {
            status: CLRSTestResultStatus.ERRORED,
            failure: assertionFailure(),
            code:
                "CLRS_TEST_RESULT_FAILURE_KIND_MISMATCH"
        }
    ];

    for (const item of cases) {
        assertDomainError(
            () => createCLRSTestResult({
                suiteId: "suite:resultado",
                caseId: "case:resultado",
                status: item.status,
                failure: item.failure
            }),
            item.code
        );
    }
});

test("las fábricas conservan instancias ya normalizadas", () => {
    const location = new CLRSTestLocation({
        sourcePath: "programa.clrs",
        startLine: 1,
        startColumn: 1
    });
    const input = new CLRSTestInput();
    const expectation =
        new CLRSTestExpectation();
    const caseValue = new CLRSTestCase({
        ...testCase(),
        input,
        expectation,
        definitionLocation: location
    });
    const suite = new CLRSTestSuite({
        id: "suite:factory",
        name: "Suite",
        programPath: "programa.clrs",
        cases: [caseValue]
    });
    const failure = new CLRSTestFailure(
        assertionFailure()
    );
    const result = new CLRSTestResult({
        suiteId: suite.id,
        caseId: caseValue.id,
        status: CLRSTestResultStatus.FAILED,
        failure
    });

    assert.equal(createCLRSTestLocation(location), location);
    assert.equal(createCLRSTestInput(input), input);
    assert.equal(
        createCLRSTestExpectation(expectation),
        expectation
    );
    assert.equal(createCLRSTestCase(caseValue), caseValue);
    assert.equal(createCLRSTestSuite(suite), suite);
    assert.equal(createCLRSTestFailure(failure), failure);
    assert.equal(createCLRSTestResult(result), result);
});

function testCase(overrides = {}) {
    return {
        id: "case:base",
        name: "Caso base",
        input: { stdin: "" },
        expectation: { stdout: "" },
        ...overrides
    };
}

function assertionFailure() {
    return {
        kind: CLRSTestFailureKind.ASSERTION,
        message: "Salida diferente.",
        expected: "esperado",
        actual: "obtenido"
    };
}

function coveragePoint(kind, line, name = null) {
    return createExecutionCoveragePoint(
        kind,
        {
            startLine: line,
            startColumn: 1,
            endLine: line,
            endColumn: 10
        },
        name == null ? {} : { name }
    );
}

function assertDomainError(operation, code) {
    assert.throws(
        operation,
        error =>
            error instanceof CLRSTestDomainError &&
            error.code === code
    );
}
