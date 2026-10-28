import assert from "node:assert/strict";
import test from "node:test";

import {
    BrokerClrsDocumentCaptureService,
    BrokerClrsTestProcessRunner,
    BrokerRisk,
    BrokerTestCaseExecutionStatus,
    BrokerTestComparison,
    BrokerTestExecutionService,
    BrokerTestExecutionStatus,
    compareBrokerTestOutput,
    createBrokerContract,
    createBrokerGameState
} from "../src/broker95/index.js";
import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";
import {
    JavaScriptGenerator
} from "../src/compiler/JavaScriptGenerator.js";

const LANGUAGE_ID = "clrs-es";

test("ejecuta casos declarativos contra el documento activo sin mostrar prompts de leer", async () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    primerValor = 0",
        "    segundoValor = 0",
        "    leer primerValor",
        "    leer segundoValor",
        "    escribir primerValor + segundoValor"
    ].join("\n");
    const contract = activeContract({
        testCases: [
            testCase({
                id: "TC-pass",
                stdin: "4\n5\n",
                expected: "9\n"
            }),
            testCase({
                id: "TC-fail",
                stdin: "4\n5\n",
                expected: "10\n"
            })
        ]
    });
    const service = createExecutionService({
        sourceCode,
        contract,
        programRunner: new BrokerClrsTestProcessRunner()
    });
    const result = await service.executeActiveContract();

    assert.equal(result.status, BrokerTestExecutionStatus.COMPLETED);
    assert.deepEqual(
        result.testCases.map(item => item.status),
        [
            BrokerTestCaseExecutionStatus.PASSED,
            BrokerTestCaseExecutionStatus.FAILED
        ]
    );
    assert.equal(result.testCases[0].stdout, "9\n");
    assert.equal(result.testCases[0].stdout.includes("> "), false);
    assert.equal(service.documentAnalysisService.size, 1);
    assert.deepEqual(result.summary, {
        total: 2,
        passed: 1,
        failed: 1,
        runtimeErrors: 0,
        timedOut: 0,
        outputLimited: 0,
        startFailed: 0,
        invalid: 0,
        notRun: 0
    });
    assert.equal(Object.isFrozen(result), true);
    assert.equal(
        JSON.stringify(result).includes("4\\n"),
        false
    );
    assert.equal(
        JSON.stringify(result).includes("6\\n"),
        false
    );
});

test("ejecuta contratos que inicializan arreglos literales anidados", async () => {
    const sourceCode = [
        "PRINCIPAL()",
        "    datos = [2, 3, [4, 5]]",
        "    escribir datos[0] + datos[1] + datos[2][1]"
    ].join("\n");
    const contract = activeContract({
        testCases: [
            testCase({
                id: "TC-array-literal",
                expected: "10\n"
            })
        ]
    });
    const service = createExecutionService({
        sourceCode,
        contract,
        programRunner: new BrokerClrsTestProcessRunner()
    });
    const result = await service.executeActiveContract();

    assert.equal(
        result.status,
        BrokerTestExecutionStatus.COMPLETED
    );
    assert.equal(
        result.testCases[0].status,
        BrokerTestCaseExecutionStatus.PASSED
    );
    assert.equal(result.testCases[0].stdout, "10\n");
});

test("preserva resultados de error del proceso y no liquida ni muta el contrato", async () => {
    const contract = activeContract({
        testCases: [
            testCase({ id: "TC-runtime" }),
            testCase({ id: "TC-timeout" }),
            testCase({ id: "TC-output" }),
            testCase({ id: "TC-start" })
        ]
    });
    const executions = [{
        status: "completed",
        stdout: "",
        stderr: "error",
        exitCode: 70,
        signal: null,
        elapsedMs: 2
    }, {
        status: "timed-out",
        stdout: "",
        stderr: "",
        exitCode: null,
        signal: "SIGTERM",
        elapsedMs: 100
    }, {
        status: "output-limit",
        stdout: "demasiado",
        stderr: "",
        exitCode: null,
        signal: "SIGTERM",
        elapsedMs: 3
    }, {
        status: "start-failed",
        stdout: "",
        stderr: "",
        exitCode: null,
        signal: null,
        elapsedMs: 0
    }];
    let runnerCalls = 0;
    const service = createExecutionService({
        contract,
        programRunner: {
            async run() {
                const next = executions[runnerCalls];
                runnerCalls += 1;
                return next;
            }
        }
    });
    const before = service.gameSession.getState();
    const result = await service.executeActiveContract();

    assert.deepEqual(
        result.testCases.map(item => item.status),
        [
            BrokerTestCaseExecutionStatus.RUNTIME_ERROR,
            BrokerTestCaseExecutionStatus.TIMED_OUT,
            BrokerTestCaseExecutionStatus.OUTPUT_LIMIT,
            BrokerTestCaseExecutionStatus.START_FAILED
        ]
    );
    assert.equal(result.summary.runtimeErrors, 1);
    assert.equal(result.summary.timedOut, 1);
    assert.equal(result.summary.outputLimited, 1);
    assert.equal(result.summary.startFailed, 1);
    assert.equal(runnerCalls, 4);
    assert.equal(service.gameSession.getState(), before);
});

test("devuelve una ejecución no realizada si la captura contiene errores de CLRS", async () => {
    const contract = activeContract();
    let runnerCalls = 0;
    const service = createExecutionService({
        contract,
        sourceCode: "escribir ,",
        programRunner: {
            async run() {
                runnerCalls += 1;
            }
        }
    });

    const result = await service.executeActiveContract();

    assert.equal(result.status, BrokerTestExecutionStatus.SOURCE_INVALID);
    assert.equal(result.analysis.status, "invalid");
    assert.equal(
        result.testCases[0].status,
        BrokerTestCaseExecutionStatus.NOT_RUN
    );
    assert.equal(result.testCases[0].reason, "source-invalid");
    assert.equal(runnerCalls, 0);
});

test("rechaza una comparación insegura antes de ejecutar", () => {
    assert.throws(
        () => activeContract({
            testCases: [
                testCase({
                    comparison:
                        BrokerTestComparison.REGEX_SAFE,
                    expected: "(a+)+$"
                })
            ]
        }),
        error => error.code ===
            "BROKER95_TEST_REGEX_INVALID"
    );
});

test("el corredor local canaliza stdin, acota salida y detiene programas que exceden el tiempo", async () => {
    const runner = new BrokerClrsTestProcessRunner();
    const echoed = await runner.run({
        programCode: [
            "let input = '';",
            "process.stdin.setEncoding('utf8');",
            "process.stdin.on('data', chunk => { input += chunk; });",
            "process.stdin.on('end', () => process.stdout.write(input.toUpperCase()));"
        ].join("\n"),
        stdin: "hola\n",
        timeoutMs: 5_000
    });
    const timedOut = await runner.run({
        programCode: "setInterval(() => {}, 1);",
        stdin: "",
        timeoutMs: 100
    });
    const outputLimited = await runner.run({
        programCode: "process.stdout.write('x'.repeat(70000));",
        stdin: "",
        timeoutMs: 5_000
    });

    assert.equal(echoed.status, "completed");
    assert.equal(echoed.exitCode, 0);
    assert.equal(echoed.stdout, "HOLA\n");
    assert.equal(timedOut.status, "timed-out");
    assert.equal(outputLimited.status, "output-limit");
    assert.equal(outputLimited.stdout.length, 65_536);
});

test("exige un contrato activo antes de capturar o ejecutar código", async () => {
    const session = memorySession(
        createBrokerGameState()
    );
    const service = new BrokerTestExecutionService({
        gameSession: session,
        documentCapture: {
            capture() {
                assert.fail("No debe capturar sin contrato activo.");
            }
        },
        documentAnalysisService: {
            analyze() {}
        },
        javaScriptGenerator: {
            generate() {}
        },
        programRunner: {
            async run() {}
        }
    });

    await assert.rejects(
        () => service.executeActiveContract(),
        error => error.code ===
            "BROKER95_TEST_EXECUTION_ACTIVE_CONTRACT_REQUIRED"
    );
});

test("compara todas las formas declarativas y rechaza patrones regex no lineales", () => {
    const cases = [
        ["exact", "hola\n", "hola\n"],
        ["trimmed", " hola\n", "hola"],
        ["normalized-whitespace", "hola\n  mundo", "hola mundo"],
        ["lines", "uno\ndos\n", "uno\ndos"],
        ["unordered-lines", "dos\nuno\n", "uno\ndos"],
        ["number", "3.0\n", "3"],
        ["number-tolerance", "3.1415", "3.14 ± 0.01"],
        ["json", "{\"b\":2,\"a\":1}", "{\"a\":1,\"b\":2}"],
        ["array-ordered", "[1,2]", "[1,2]"],
        ["array-unordered", "[2,1]", "[1,2]"],
        ["boolean", "VERDAD", "true"],
        ["contains", "resultado: 5", "5"],
        ["regex-safe", "resultado: 42", "^resultado: \\d+$"]
    ];

    for (const [comparison, actual, expected] of cases) {
        const result = compareBrokerTestOutput(
            testCase({ comparison, expected }),
            actual
        );

        assert.equal(result.passed, true, comparison);
    }

    assert.throws(
        () => compareBrokerTestOutput(
            testCase({
                comparison: BrokerTestComparison.REGEX_SAFE,
                expected: "(a+)+$"
            }),
            "aaaa"
        ),
        error => error.code === "BROKER95_TEST_REGEX_INVALID"
    );
});

function createExecutionService({
    sourceCode = "PRINCIPAL()\n    escribir 1",
    contract = activeContract(),
    programRunner = {
        async run() {
            return {
                status: "completed",
                stdout: "1\n",
                stderr: "",
                exitCode: 0,
                signal: null,
                elapsedMs: 0
            };
        }
    }
} = {}) {
    const documentAnalysisService =
        new DocumentAnalysisService({
            languageDiagnosticsService:
                new LanguageDiagnosticsService(),
            analyzeCost() {
                return null;
            }
        });
    const capture = new BrokerClrsDocumentCaptureService({
        documentHost: {
            captureActiveDocument() {
                return Object.freeze({
                    documentId: "file:///broker95/actual.clrs",
                    name: "actual.clrs",
                    languageId: LANGUAGE_ID,
                    version: 1,
                    sourceCode
                });
            }
        },
        documentAnalysisService,
        languageId: LANGUAGE_ID,
        now: () => 1
    });
    const session = memorySession(
        createBrokerGameState({
            activeContractId: contract.id,
            contracts: [contract],
            nextContractId: contract.id + 1
        })
    );

    return new BrokerTestExecutionService({
        gameSession: session,
        documentCapture: capture,
        documentAnalysisService,
        javaScriptGenerator: new JavaScriptGenerator(),
        programRunner
    });
}

function activeContract(overrides = {}) {
    return createBrokerContract({
        id: 1,
        title: "Prueba de salida",
        categoryId: "NUM-ARITH",
        categoryName: "Aritmética",
        familyId: "NUM",
        familyName: "Procesamiento numérico",
        risk: BrokerRisk.LOW,
        description: "Produce una salida determinista.",
        requirements: ["Responder correctamente."],
        client: "Laboratorio",
        payPotential: 100,
        state: "active",
        metadata: {
            requirementIds: ["REQ-1"]
        },
        testCases: [testCase()],
        ...overrides
    });
}

function testCase(overrides = {}) {
    return {
        id: "TC-1",
        kind: "normal",
        requirementIds: ["REQ-1"],
        stdin: "",
        expected: "1\n",
        comparison: BrokerTestComparison.EXACT,
        // El corpus unitario completo ejecuta muchos procesos CLRS en
        // paralelo; este caso prueba comparación, no el límite temporal.
        timeoutMs: 5_000,
        ...overrides
    };
}

function memorySession(state) {
    return {
        state,
        async initialize() {},
        getState() {
            return this.state;
        }
    };
}
