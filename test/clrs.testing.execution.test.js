import assert from "node:assert/strict";
import test from "node:test";

import {
    CLRSNodeTestProcessRunner,
    CLRSTestExecutor,
    CLRSTestFailureKind,
    CLRSTestProcessStatus,
    CLRSTestResultStatus,
    CLRSTestRunStatus,
    createCLRSTestSuite
} from "../src/testing/index.js";
import {
    BrokerClrsTestProcessRunner
} from "../src/broker95/submission/BrokerClrsTestProcessRunner.js";
import {
    JavaScriptGenerator
} from "../src/compiler/JavaScriptGenerator.js";
import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";

test("el corredor compartido fija Math.random mediante una semilla", async () => {
    const runner = new CLRSNodeTestProcessRunner();
    const request = {
        programCode:
            "process.stdout.write(String(Math.random()));",
        stdin: "",
        timeoutMs: 5_000,
        seed: 91
    };
    const first = await runner.run(request);
    const second = await runner.run(request);
    const other = await runner.run({
        ...request,
        seed: 92
    });

    assert.equal(
        first.status,
        CLRSTestProcessStatus.COMPLETED
    );
    assert.equal(first.exitCode, 0);
    assert.equal(first.stdout, second.stdout);
    assert.notEqual(first.stdout, other.stdout);
    assert.equal(first.seed, 91);
});

test("el corredor compartido cancela una ejecución activa", async () => {
    const runner = new CLRSNodeTestProcessRunner();
    const controller = new AbortController();
    const execution = runner.run({
        programCode: "setInterval(() => {}, 1);",
        stdin: "",
        timeoutMs: 5_000,
        seed: 7,
        signal: controller.signal
    });

    setTimeout(() => controller.abort(), 50);

    const result = await execution;

    assert.equal(
        result.status,
        CLRSTestProcessStatus.CANCELLED
    );
    assert.equal(result.seed, 7);
});

test("ejecuta una suite CLRS con comparación exacta y resultados inmutables", async () => {
    const executor = createRealExecutor();
    const suite = suiteWithCases([
        testCase({
            id: "case:correcto",
            stdin: "4\n5\n",
            expected: "9\n"
        }),
        testCase({
            id: "case:diferente",
            stdin: "4\n5\n",
            expected: "10\n"
        })
    ]);
    const result = await executor.execute({
        suite,
        sourceCode: sumProgram(),
        sourceVersion: 3,
        seed: 123
    });

    assert.equal(
        result.status,
        CLRSTestRunStatus.COMPLETED
    );
    assert.deepEqual(
        result.results.map(item => item.status),
        [
            CLRSTestResultStatus.PASSED,
            CLRSTestResultStatus.FAILED
        ]
    );
    assert.equal(result.results[0].stdout, "9\n");
    assert.equal(
        result.results[1].failure.kind,
        CLRSTestFailureKind.ASSERTION
    );
    assert.equal(
        result.results[1].failure.expected,
        "10\n"
    );
    assert.equal(
        result.results[1].failure.actual,
        "9\n"
    );
    assert.equal(
        result.results[1].failure.divergence.kind,
        "text"
    );
    assert.equal(
        result.results[1].failure.divergence.index,
        0
    );
    assert.equal(
        result.results[1].failure
            .pedagogicalExplanation.title,
        "La salida cambia en su primer carácter diferente"
    );
    assert.match(
        result.results[1].failure
            .pedagogicalExplanation.summary,
        /línea 1, columna 1/u
    );
    assert.deepEqual(result.summary, {
        total: 2,
        passed: 1,
        failed: 1,
        errored: 0,
        skipped: 0,
        cancelled: 0
    });
    assert.equal(result.sourceVersion, 3);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.results), true);
    assert.equal(Object.isFrozen(result.summary), true);
    assert.equal(result.results[0].coverage.complete, true);
    assert.equal(result.results[0].coverage.truncated, false);
    assert.ok(
        result.results[0].coverage.summary
            .coveredStatements > 0
    );
    assert.equal(
        Object.isFrozen(
            result.results[0].coverage.points
        ),
        true
    );
});

test("aísla la cobertura y los resultados de rama de cada caso", async () => {
    const executor = createRealExecutor();
    const execution = await executor.execute({
        suite: suiteWithCases([
            testCase({
                id: "case:positivo",
                stdin: "2\n",
                expected: "positivo\n"
            }),
            testCase({
                id: "case:no-positivo",
                stdin: "0\n",
                expected: "no positivo\n"
            })
        ]),
        sourceCode: [
            "PRINCIPAL()",
            "    valor = 0",
            "    leer valor",
            "    si valor > 0",
            "        escribir \"positivo\"",
            "    sino",
            "        escribir \"no positivo\""
        ].join("\n")
    });
    const positiveBranch = execution.results[0]
        .coverage.points.find(point =>
            point.kind === "branch"
        );
    const negativeBranch = execution.results[1]
        .coverage.points.find(point =>
            point.kind === "branch"
        );
    const positiveOnly = execution.results[0]
        .coverage.points.find(point =>
            point.location.startLine === 5
        );
    const negativeOnly = execution.results[0]
        .coverage.points.find(point =>
            point.location.startLine === 7
        );

    assert.deepEqual(
        positiveBranch.outcomeCounts,
        { true: 1, false: 0 }
    );
    assert.deepEqual(
        negativeBranch.outcomeCounts,
        { true: 0, false: 1 }
    );
    assert.equal(positiveOnly.hitCount, 1);
    assert.equal(negativeOnly.hitCount, 0);
    assert.notEqual(
        execution.results[0].coverage,
        execution.results[1].coverage
    );
    assert.equal(execution.coverage.testCount, 2);
    assert.equal(
        execution.coverage.evidenceTestCount,
        2
    );
    assert.equal(execution.coverage.complete, true);
    assert.deepEqual(
        execution.coverage.points.find(point =>
            point.kind === "branch"
        ).outcomeCounts,
        { true: 1, false: 1 }
    );
    assert.equal(
        execution.coverage.summary
            .coveredBranchOutcomes,
        2
    );
    assert.equal(
        Object.isFrozen(execution.coverage),
        true
    );
});

test("conserva cobertura parcial en una prueba interrumpida", async () => {
    const executor = createStubExecutor({
        async run() {
            return processResult(
                CLRSTestProcessStatus.TIMED_OUT,
                {
                    coverage: {
                        events: [],
                        complete: false,
                        truncated: false
                    }
                }
            );
        }
    });
    const execution = await executor.execute({
        suite: suiteWithCases([testCase()]),
        sourceCode: "programa"
    });

    assert.equal(
        execution.results[0].status,
        CLRSTestResultStatus.ERRORED
    );
    assert.equal(
        execution.results[0].coverage.complete,
        false
    );
    assert.equal(
        execution.results[0].coverage.eventCount,
        0
    );
    assert.equal(execution.coverage.complete, false);
    assert.equal(execution.coverage.testCount, 1);
    assert.equal(
        execution.coverage.evidenceTestCount,
        1
    );
});

test("el ejecutor aplica el comparador estructurado declarado por cada caso", async () => {
    const responses = [
        '{"b":2,"a":[1,2]}\n',
        "[2,1]\n"
    ];
    let index = 0;
    const executor = createStubExecutor({
        async run() {
            const stdout = responses[index];

            index += 1;
            return completedProcess({ stdout });
        }
    });
    const execution = await executor.execute({
        suite: suiteWithCases([
            testCase({
                id: "case:json",
                expected: '{"a":[1,2],"b":2}\n',
                comparison: "json"
            }),
            testCase({
                id: "case:arreglo",
                expected: "[1,2]\n",
                comparison: "array-ordered"
            })
        ]),
        sourceCode: "programa"
    });

    assert.deepEqual(
        execution.results.map(item => item.status),
        [
            CLRSTestResultStatus.PASSED,
            CLRSTestResultStatus.FAILED
        ]
    );
});

test("conserva la semilla de cada caso al ejecutar toda la suite o un subconjunto", async () => {
    const calls = [];
    const executor = createStubExecutor({
        async run(request) {
            calls.push(request);
            return completedProcess({
                stdout: "ok\n",
                seed: request.seed
            });
        }
    });
    const suite = suiteWithCases([
        testCase({
            id: "case:primero",
            expected: "ok\n"
        }),
        testCase({
            id: "case:segundo",
            expected: "ok\n"
        })
    ]);
    const complete = await executor.execute({
        suite,
        sourceCode: "programa",
        seed: 15
    });
    const selected = await executor.execute({
        suite,
        sourceCode: "programa",
        caseIds: ["case:segundo"],
        seed: 15
    });

    assert.equal(selected.results.length, 1);
    assert.equal(
        selected.results[0].seed,
        complete.results[1].seed
    );
    assert.equal(calls.length, 3);
    await assert.rejects(
        () => executor.execute({
            suite,
            sourceCode: "programa",
            caseIds: ["case:desconocido"]
        }),
        error => error.code ===
            "CLRS_TEST_EXECUTION_CASE_UNKNOWN"
    );
});

test("convierte errores de análisis en resultados sin ejecutar el programa", async () => {
    let runnerCalls = 0;
    const executor = createRealExecutor({
        processRunner: {
            async run() {
                runnerCalls += 1;
            }
        }
    });
    const result = await executor.execute({
        suite: suiteWithCases([testCase()]),
        sourceCode: "escribir ,"
    });

    assert.equal(
        result.status,
        CLRSTestRunStatus.SOURCE_INVALID
    );
    assert.equal(
        result.results[0].status,
        CLRSTestResultStatus.ERRORED
    );
    assert.equal(
        result.results[0].failure.kind,
        CLRSTestFailureKind.SYNTAX
    );
    assert.equal(
        result.results[0].failure.location
            ?.sourcePath,
        "programa.clrs"
    );
    assert.equal(runnerCalls, 0);
});

test("normaliza fallos de proceso, límites y errores de infraestructura", async () => {
    const responses = [
        processResult(
            CLRSTestProcessStatus.TIMED_OUT
        ),
        processResult(
            CLRSTestProcessStatus.OUTPUT_LIMIT
        ),
        processResult(
            CLRSTestProcessStatus.START_FAILED
        ),
        completedProcess({ exitCode: 70 }),
        new Error("filesystem unavailable")
    ];
    let index = 0;
    const executor = createStubExecutor({
        async run() {
            const response = responses[index];
            index += 1;

            if (response instanceof Error) {
                throw response;
            }

            return response;
        }
    });
    const result = await executor.execute({
        suite: suiteWithCases(
            responses.map((unused, caseIndex) =>
                testCase({
                    id: `case:error-${caseIndex}`
                })
            )
        ),
        sourceCode: "programa"
    });

    assert.deepEqual(
        result.results.map(item =>
            item.failure.kind
        ),
        [
            CLRSTestFailureKind.TIMEOUT,
            CLRSTestFailureKind.OUTPUT_LIMIT,
            CLRSTestFailureKind.START_FAILURE,
            CLRSTestFailureKind.RUNTIME,
            CLRSTestFailureKind.START_FAILURE
        ]
    );
    assert.equal(result.summary.errored, 5);
});

test("conserva el mensaje y la ubicación CLRS de un error de ejecución", async () => {
    const executor = createStubExecutor({
        async run() {
            return completedProcess({
                exitCode: 70,
                stderr: [
                    "✕ Error de ejecución",
                    "",
                    "  El índice está fuera del arreglo.",
                    "  Línea 7, columna 9",
                    ""
                ].join("\n")
            });
        }
    });
    const execution = await executor.execute({
        suite: suiteWithCases([testCase()]),
        sourceCode: "programa"
    });
    const failure = execution.results[0].failure;

    assert.equal(
        failure.message,
        "El índice está fuera del arreglo."
    );
    assert.deepEqual({ ...failure.location }, {
        sourcePath: "programa.clrs",
        startLine: 7,
        startColumn: 9,
        endLine: 7,
        endColumn: 9
    });
});

test("la cancelación se proyecta sobre casos pendientes sin invocar el corredor", async () => {
    let runnerCalls = 0;
    const executor = createStubExecutor({
        async run() {
            runnerCalls += 1;
            return completedProcess();
        }
    });
    const controller = new AbortController();
    controller.abort();

    const result = await executor.execute({
        suite: suiteWithCases([
            testCase({ id: "case:uno" }),
            testCase({ id: "case:dos" })
        ]),
        sourceCode: "programa",
        signal: controller.signal
    });

    assert.equal(
        result.status,
        CLRSTestRunStatus.CANCELLED
    );
    assert.deepEqual(
        result.results.map(item => item.status),
        [
            CLRSTestResultStatus.CANCELLED,
            CLRSTestResultStatus.CANCELLED
        ]
    );
    assert.equal(result.summary.cancelled, 2);
    assert.equal(runnerCalls, 0);
});

test("BROKER.95 delega en el corredor compartido sin cambiar su contrato", async () => {
    let captured = null;
    const adapter = new BrokerClrsTestProcessRunner({
        runner: {
            async run(request) {
                captured = request;
                return completedProcess({
                    stdout: "respuesta\n",
                    seed: request.seed
                });
            }
        }
    });
    const result = await adapter.run({
        programCode: "programa",
        stdin: "entrada\n",
        timeoutMs: 250
    });

    assert.deepEqual(captured, {
        programCode: "programa",
        stdin: "entrada\n",
        timeoutMs: 250,
        seed: 0
    });
    assert.deepEqual(result, {
        status: CLRSTestProcessStatus.COMPLETED,
        exitCode: 0,
        signal: null,
        stdout: "respuesta\n",
        stderr: "",
        elapsedMs: 0,
        technicalMessage: null
    });
    assert.equal(Object.hasOwn(result, "seed"), false);
});

function createRealExecutor(overrides = {}) {
    return new CLRSTestExecutor({
        documentAnalysisService:
            createDocumentAnalysisService(),
        javaScriptGenerator:
            new JavaScriptGenerator(),
        processRunner:
            new CLRSNodeTestProcessRunner(),
        ...overrides
    });
}

function createStubExecutor(processRunner) {
    return new CLRSTestExecutor({
        documentAnalysisService: {
            analyze() {
                return {
                    ok: true,
                    ast: {},
                    semanticModel: {}
                };
            }
        },
        javaScriptGenerator: {
            generate() {
                return {
                    generatedCode: "programa"
                };
            }
        },
        processRunner
    });
}

function createDocumentAnalysisService() {
    return new DocumentAnalysisService({
        languageDiagnosticsService:
            new LanguageDiagnosticsService(),
        analyzeCost() {
            return null;
        }
    });
}

function suiteWithCases(cases) {
    return createCLRSTestSuite({
        id: "suite:executor",
        name: "Suite del ejecutor",
        programPath: "programa.clrs",
        cases
    });
}

function testCase(overrides = {}) {
    return {
        id: "case:base",
        name: "Caso base",
        input: {
            stdin: overrides.stdin ?? ""
        },
        expectation: {
            stdout: overrides.expected ?? "1\n",
            ...(overrides.comparison == null
                ? {}
                : { comparison: overrides.comparison })
        },
        timeoutMs: overrides.timeoutMs ?? 5_000,
        ...without(overrides, [
            "stdin",
            "expected",
            "comparison",
            "timeoutMs"
        ])
    };
}

function without(source, keys) {
    return Object.fromEntries(
        Object.entries(source).filter(
            ([key]) => !keys.includes(key)
        )
    );
}

function sumProgram() {
    return [
        "PRINCIPAL()",
        "    primerValor = 0",
        "    segundoValor = 0",
        "    leer primerValor",
        "    leer segundoValor",
        "    escribir primerValor + segundoValor"
    ].join("\n");
}

function completedProcess(overrides = {}) {
    return processResult(
        CLRSTestProcessStatus.COMPLETED,
        overrides
    );
}

function processResult(status, overrides = {}) {
    return {
        status,
        stdout: "",
        stderr: "",
        exitCode: status ===
            CLRSTestProcessStatus.COMPLETED
            ? 0
            : null,
        signal: null,
        elapsedMs: 0,
        ...overrides
    };
}
