import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
    CLRSTestFailureKind,
    CLRSTestResultStatus,
    accumulateCLRSTestCoverage,
    aggregateCLRSTestCoverage,
    createCLRSTestResult,
    createCLRSTestSuite
} from "../src/testing/index.js";
import {
    createExecutionCoveragePoint,
    ExecutionCoverageKind
} from "../src/runtime/ExecutionCoverageEvent.js";
import {
    CLRSTestCoverageStore,
    CLRSTestRunController
} from "../extension/testing/index.js";

const DEFINITION_PATH = path.resolve(
    "workspace",
    "suma.clrs-tests.json"
);
const PROGRAM_PATH = path.resolve(
    "workspace",
    "suma.clrs"
);

test("registra el perfil Ejecutar y publica estados, diferencias y salida nativos", async () => {
    const suite = testSuite();
    const fixture = createRunFixture({
        suite,
        async execute(request) {
            fixture.requests.push(request);

            return execution([
                result({
                    caseId: "case:uno",
                    status:
                        CLRSTestResultStatus.PASSED,
                    stdout: "3\n",
                    durationMs: 8
                }),
                result({
                    caseId: "case:dos",
                    status:
                        CLRSTestResultStatus.FAILED,
                    stdout: "5\n",
                    stderr: "detalle\n",
                    durationMs: 11,
                    failure: {
                        kind:
                            CLRSTestFailureKind.ASSERTION,
                        message:
                            "La salida no coincide.",
                        expected: "4\n",
                        actual: "5\n",
                        location: {
                            sourcePath: PROGRAM_PATH,
                            startLine: 3,
                            startColumn: 5,
                            endLine: 3,
                            endColumn: 14
                        }
                    }
                })
            ]);
        }
    });
    const controller = fixture.create();
    const profile = controller.start();
    const coverageProfile =
        fixture.testController.profiles[1];

    assert.equal(profile.label, "Ejecutar");
    assert.equal(profile.kind, 1);
    assert.equal(profile.isDefault, true);
    assert.equal(profile.supportsContinuousRun, false);
    assert.equal(coverageProfile.label, "Cobertura");
    assert.equal(coverageProfile.kind, 3);
    assert.equal(coverageProfile.isDefault, true);
    assert.equal(
        coverageProfile.supportsContinuousRun,
        false
    );

    await profile.runHandler({}, cancellationToken());

    const run = fixture.testController.runs[0];

    assert.deepEqual(
        run.enqueuedItems.map(item => item.label),
        ["Caso uno", "Caso dos"]
    );
    assert.deepEqual(
        run.startedItems.map(item => item.label),
        ["Caso uno", "Caso dos"]
    );
    assert.deepEqual(run.passedItems, [{
        item: fixture.items.cases[0],
        duration: 8
    }]);
    assert.equal(run.failedItems.length, 1);
    assert.equal(
        run.failedItems[0].message.expectedOutput,
        "4\n"
    );
    assert.equal(
        run.failedItems[0].message.actualOutput,
        "5\n"
    );
    assert.equal(
        run.failedItems[0].message.location.uri.fsPath,
        PROGRAM_PATH
    );
    assert.deepEqual(
        run.failedItems[0].message.location.range.values,
        [2, 4, 2, 13]
    );
    assert.equal(run.outputs.length, 2);
    assert.equal(
        run.outputs.every(output =>
            !/(?<!\r)\n/u.test(output.text)
        ),
        true
    );
    assert.match(
        run.outputs[0].text,
        /Estado: Aprobada/u
    );
    assert.match(
        run.outputs[1].text,
        /Estado: Fallida/u
    );
    assert.match(
        run.outputs[1].text,
        /Salida de error:\r\ndetalle/u
    );
    assert.equal(run.ended, true);
    assert.deepEqual(
        fixture.requests[0].caseIds,
        ["case:uno", "case:dos"]
    );
    assert.equal(fixture.requests[0].sourceCode, "programa");
    assert.equal(fixture.requests[0].sourceVersion, 7);
    assert.equal(fixture.requests[0].seed, 0);
    assert.equal(
        fixture.requests[0].signal instanceof AbortSignal,
        true
    );
});

test("publica cobertura nativa acumulada y por prueba", async () => {
    const suite = testSuite();
    const functionPoint = coveragePoint(
        ExecutionCoverageKind.FUNCTION,
        1,
        "PRINCIPAL"
    );
    const statement = coveragePoint(
        ExecutionCoverageKind.STATEMENT,
        2
    );
    const branch = coveragePoint(
        ExecutionCoverageKind.BRANCH,
        3
    );
    const catalog = [
        functionPoint,
        statement,
        branch
    ];
    const firstCoverage = aggregateCLRSTestCoverage({
        sourcePath: PROGRAM_PATH,
        catalog,
        events: [
            functionPoint,
            statement,
            { ...branch, outcome: true }
        ],
        complete: true
    });
    const secondCoverage = aggregateCLRSTestCoverage({
        sourcePath: PROGRAM_PATH,
        catalog,
        events: [
            functionPoint,
            statement,
            { ...branch, outcome: false }
        ],
        complete: true
    });
    const accumulated = accumulateCLRSTestCoverage({
        coverages: [firstCoverage, secondCoverage]
    });
    const coverageStore =
        new CLRSTestCoverageStore();
    const fixture = createRunFixture({
        suite,
        coverageStore,
        async execute() {
            return execution([
                result({
                    caseId: "case:uno",
                    status: CLRSTestResultStatus.PASSED,
                    coverage: firstCoverage
                }),
                result({
                    caseId: "case:dos",
                    status: CLRSTestResultStatus.PASSED,
                    coverage: secondCoverage
                })
            ], accumulated, 7);
        }
    });
    const controller = fixture.create();
    controller.start();
    const profile = fixture.testController.profiles
        .find(candidate => candidate.kind === 3);

    await profile.runHandler({}, cancellationToken());

    const run = fixture.testController.runs[0];
    const fileCoverage = run.coverages[0];

    assert.equal(run.coverages.length, 1);
    assert.equal(
        coverageStore.getSnapshot(PROGRAM_PATH)
            .coverage,
        accumulated
    );
    assert.equal(
        coverageStore.getSnapshot(PROGRAM_PATH)
            .documentVersion,
        7
    );
    assert.equal(
        run.name,
        "Cobertura de pruebas CLRS"
    );
    assert.equal(
        fileCoverage.uri.fsPath,
        PROGRAM_PATH
    );
    assert.deepEqual([
        fileCoverage.statementCoverage.covered,
        fileCoverage.statementCoverage.total
    ], [2, 2]);
    assert.deepEqual([
        fileCoverage.branchCoverage.covered,
        fileCoverage.branchCoverage.total
    ], [2, 2]);
    assert.deepEqual([
        fileCoverage.declarationCoverage.covered,
        fileCoverage.declarationCoverage.total
    ], [1, 1]);
    assert.deepEqual(
        fileCoverage.includesTests,
        fixture.items.cases
    );

    const details = await profile
        .loadDetailedCoverage(
            run,
            fileCoverage,
            cancellationToken()
        );
    const declaration = details.find(detail =>
        detail.name === "PRINCIPAL"
    );
    const condition = details.find(detail =>
        detail.branches?.length === 2
    );

    assert.equal(details.length, 3);
    assert.equal(declaration.executed, 2);
    assert.deepEqual(
        condition.branches.map(item => ({
            executed: item.executed,
            label: item.label
        })),
        [
            { executed: 1, label: "sí" },
            { executed: 1, label: "no" }
        ]
    );
    assert.deepEqual(
        condition.location.values,
        [2, 4, 2, 11]
    );

    const firstDetails = await profile
        .loadDetailedCoverageForTest(
            run,
            fileCoverage,
            fixture.items.cases[0],
            cancellationToken()
        );
    const firstCondition = firstDetails.find(
        detail => detail.branches?.length === 2
    );

    assert.deepEqual(
        firstCondition.branches.map(item =>
            item.executed
        ),
        [1, 0]
    );
});

test("respeta inclusiones, exclusiones y evita ejecutar casos repetidos", async () => {
    const suite = testSuite({
        cases: [
            caseSource("case:uno", "Caso uno"),
            caseSource("case:dos", "Caso dos"),
            caseSource("case:tres", "Caso tres")
        ]
    });
    const requestedCaseIds = [];
    const fixture = createRunFixture({
        suite,
        async execute(request) {
            requestedCaseIds.push(request.caseIds);

            return execution(
                request.caseIds.map(caseId =>
                    result({
                        caseId,
                        status:
                            CLRSTestResultStatus.PASSED
                    })
                )
            );
        }
    });
    const controller = fixture.create();
    const profile = controller.start();

    await profile.runHandler({
        include: [
            fixture.items.root,
            fixture.items.cases[0]
        ],
        exclude: [fixture.items.cases[1]]
    }, cancellationToken());
    await profile.runHandler({
        include: [fixture.items.cases[1]],
        exclude: []
    }, cancellationToken());

    assert.deepEqual(requestedCaseIds, [
        ["case:uno", "case:tres"],
        ["case:dos"]
    ]);
    assert.equal(
        fixture.testController.runs[0]
            .enqueuedItems.length,
        2
    );
    assert.equal(
        fixture.testController.runs[1]
            .enqueuedItems.length,
        1
    );
});

test("presenta definiciones inválidas y programas ausentes sin invocar el ejecutor", async () => {
    let executorCalls = 0;
    const invalid = createInvalidFixture({
        execute() {
            executorCalls += 1;
        }
    });
    const invalidController = invalid.create();
    const invalidProfile = invalidController.start();

    await invalidProfile.runHandler(
        {},
        cancellationToken()
    );

    assert.equal(
        invalid.testController.runs[0]
            .erroredItems[0].message.message,
        "JSON inválido"
    );

    const missing = createRunFixture({
        suite: testSuite(),
        status: "program-missing",
        issue: {
            message:
                "No se encontró el programa CLRS asociado."
        },
        async execute() {
            executorCalls += 1;
        }
    });
    const missingController = missing.create();
    const missingProfile = missingController.start();

    await missingProfile.runHandler(
        {},
        cancellationToken()
    );

    assert.equal(
        missing.testController.runs[0]
            .erroredItems.length,
        2
    );
    assert.equal(executorCalls, 0);
});

test("convierte fallos de lectura y del ejecutor en errores del TestRun", async () => {
    const readFailure = createRunFixture({
        suite: testSuite(),
        readError: new Error("disk unavailable")
    });
    const readController = readFailure.create();

    await readController.start().runHandler(
        {},
        cancellationToken()
    );

    assert.equal(
        readFailure.testController.runs[0]
            .erroredItems.length,
        2
    );
    assert.match(
        readFailure.testController.runs[0]
            .erroredItems[0].message.message,
        /leer el programa/u
    );

    const executionFailure = createRunFixture({
        suite: testSuite(),
        async execute() {
            throw new Error("runner unavailable");
        }
    });
    const executionController =
        executionFailure.create();

    await executionController.start().runHandler(
        {},
        cancellationToken()
    );

    const failedRun =
        executionFailure.testController.runs[0];

    assert.equal(failedRun.startedItems.length, 2);
    assert.equal(failedRun.erroredItems.length, 2);
    assert.match(
        failedRun.erroredItems[0].message.message,
        /ejecutar la suite/u
    );
    assert.equal(failedRun.ended, true);
});

test("propaga la cancelación nativa y marca casos cancelados como omitidos", async () => {
    let executionStarted = false;
    const fixture = createRunFixture({
        suite: testSuite(),
        execute(request) {
            executionStarted = true;

            return new Promise(resolve => {
                request.signal.addEventListener(
                    "abort",
                    () => resolve(execution(
                        request.caseIds.map(caseId =>
                            result({
                                caseId,
                                status:
                                    CLRSTestResultStatus
                                        .CANCELLED
                            })
                        )
                    )),
                    { once: true }
                );
            });
        }
    });
    const controller = fixture.create();
    const profile = controller.start();
    const token = cancellationToken();
    const running = profile.runHandler({}, token);

    await waitFor(() => executionStarted);
    token.cancel();
    await running;

    const run = fixture.testController.runs[0];

    assert.equal(run.skippedItems.length, 2);
    assert.equal(run.ended, true);
    assert.equal(token.subscription.disposed, true);
});

test("al liberar el perfil cancela ejecuciones todavía activas", async () => {
    let receivedSignal = null;
    const fixture = createRunFixture({
        suite: testSuite({
            cases: [caseSource(
                "case:uno",
                "Caso uno"
            )]
        }),
        execute(request) {
            receivedSignal = request.signal;

            return new Promise(resolve => {
                request.signal.addEventListener(
                    "abort",
                    () => resolve(execution([
                        result({
                            caseId: "case:uno",
                            status:
                                CLRSTestResultStatus
                                    .CANCELLED
                        })
                    ])),
                    { once: true }
                );
            });
        }
    });
    const controller = fixture.create();
    const profile = controller.start();
    const running = profile.runHandler(
        {},
        cancellationToken()
    );

    await waitFor(() => receivedSignal != null);
    controller.dispose();
    await running;

    assert.equal(receivedSignal.aborted, true);
    assert.equal(profile.disposed, true);
    assert.equal(
        fixture.testController.runs[0]
            .skippedItems.length,
        1
    );
});

test("enruta los casos externos de BROKER.95 por el mismo perfil nativo", async () => {
    const suite = testSuite({
        cases: [caseSource(
            "TC-1",
            "Caso del contrato"
        )]
    });
    let declarativeCalls = 0;
    const externalRequests = [];
    const fixture = createRunFixture({
        suite,
        metadataOverrides: {
            sourceId: "broker95",
            sourceKey: "7",
            definitionPath: null
        },
        async execute() {
            declarativeCalls += 1;
            return execution([]);
        }
    });
    const controller = fixture.create();

    controller.registerExternalSource({
        id: "broker95",
        async execute(request) {
            externalRequests.push(request);
            return {
                suite,
                execution: execution([result({
                    caseId: "TC-1",
                    status:
                        CLRSTestResultStatus.PASSED
                })])
            };
        }
    });

    await controller.start().runHandler(
        {},
        cancellationToken()
    );

    assert.equal(declarativeCalls, 0);
    assert.equal(externalRequests.length, 1);
    assert.equal(externalRequests[0].sourceKey, "7");
    assert.deepEqual(
        externalRequests[0].caseIds,
        ["TC-1"]
    );
    assert.equal(
        fixture.testController.runs[0]
            .passedItems.length,
        1
    );
});

function createRunFixture(options) {
    const suite = options.suite;
    const status = options.status ?? "ready";
    const issue = options.issue ?? null;
    const testController = nativeController();
    const metadata = new Map();
    const items = addSuiteItems({
        testController,
        suite,
        metadata,
        runnable: status === "ready",
        error: issue?.message,
        metadataOverrides:
            options.metadataOverrides
    });
    const entry = {
        definitionPath: DEFINITION_PATH,
        status,
        suite,
        issue
    };
    const requests = [];

    return {
        items,
        requests,
        testController,
        create() {
            return new CLRSTestRunController({
                vscodeApi: fakeVSCode(),
                discoveryController: {
                    controller: testController,
                    getMetadata(item) {
                        return metadata.get(item.id) ?? null;
                    },
                    getSnapshot() {
                        return { entries: [entry] };
                    }
                },
                discovery: {
                    findByDefinitionPath() {
                        return entry;
                    }
                },
                workspace: {
                    async readText() {
                        if (options.readError != null) {
                            throw options.readError;
                        }

                        return "programa";
                    },
                    toUri(sourcePath) {
                        return { fsPath: sourcePath };
                    },
                    getDocumentVersion() {
                        return 7;
                    }
                },
                executor: {
                    execute: options.execute ??
                        (async request => execution(
                            request.caseIds.map(caseId =>
                                result({
                                    caseId,
                                    status:
                                        CLRSTestResultStatus
                                            .PASSED
                                })
                            )
                        ))
                },
                coverageStore:
                    options.coverageStore,
                developerLogger: {
                    error() {}
                }
            });
        }
    };
}

function createInvalidFixture(executor) {
    const testController = nativeController();
    const root = testController.createTestItem(
        "suite:invalid",
        "Definición inválida"
    );
    root.error = "JSON inválido";
    testController.items.replace([root]);
    const metadata = new Map([[
        root.id,
        {
            kind: "suite",
            definitionPath: DEFINITION_PATH,
            suiteId: null,
            caseId: null,
            runnable: false
        }
    ]]);

    return {
        testController,
        create() {
            return new CLRSTestRunController({
                vscodeApi: fakeVSCode(),
                discoveryController: {
                    controller: testController,
                    getMetadata(item) {
                        return metadata.get(item.id) ?? null;
                    },
                    getSnapshot() {
                        return { entries: [] };
                    }
                },
                discovery: {
                    findByDefinitionPath() {
                        return null;
                    }
                },
                workspace: {
                    async readText() {
                        return "";
                    },
                    toUri(sourcePath) {
                        return { fsPath: sourcePath };
                    }
                },
                executor
            });
        }
    };
}

function addSuiteItems({
    testController,
    suite,
    metadata,
    runnable,
    error,
    metadataOverrides = {}
}) {
    const root = testController.createTestItem(
        "suite:item",
        suite.name,
        { fsPath: DEFINITION_PATH }
    );
    root.error = error;
    const cases = suite.cases.map(testCase => {
        const item = testController.createTestItem(
            `case:item:${testCase.id}`,
            testCase.name,
            { fsPath: DEFINITION_PATH }
        );

        item.error = error;
        metadata.set(item.id, {
            kind: "case",
            definitionPath: DEFINITION_PATH,
            suiteId: suite.id,
            caseId: testCase.id,
            runnable,
            ...metadataOverrides
        });

        return item;
    });

    root.children.replace(cases);
    testController.items.replace([root]);
    metadata.set(root.id, {
        kind: "suite",
        definitionPath: DEFINITION_PATH,
        suiteId: suite.id,
        caseId: null,
        runnable,
        ...metadataOverrides
    });

    return { root, cases };
}

function nativeController() {
    const controller = {
        items: collection(),
        profiles: [],
        runs: [],
        createTestItem(id, label, uri) {
            return {
                id,
                label,
                uri,
                error: undefined,
                children: collection()
            };
        },
        createRunProfile(
            label,
            kind,
            runHandler,
            isDefault,
            tag,
            supportsContinuousRun
        ) {
            const profile = {
                label,
                kind,
                runHandler,
                isDefault,
                tag,
                supportsContinuousRun,
                disposed: false,
                dispose() {
                    profile.disposed = true;
                }
            };

            controller.profiles.push(profile);
            return profile;
        },
        createTestRun(request, name, persist) {
            const run = testRun(request, name, persist);
            controller.runs.push(run);
            return run;
        }
    };

    return controller;
}

function testRun(request, name, persist) {
    return {
        request,
        name,
        persist,
        enqueuedItems: [],
        startedItems: [],
        skippedItems: [],
        passedItems: [],
        failedItems: [],
        erroredItems: [],
        outputs: [],
        coverages: [],
        ended: false,
        enqueued(item) {
            this.enqueuedItems.push(item);
        },
        started(item) {
            this.startedItems.push(item);
        },
        skipped(item) {
            this.skippedItems.push(item);
        },
        passed(item, duration) {
            this.passedItems.push({ item, duration });
        },
        failed(item, message, duration) {
            this.failedItems.push({
                item,
                message,
                duration
            });
        },
        errored(item, message, duration) {
            this.erroredItems.push({
                item,
                message,
                duration
            });
        },
        appendOutput(text, location, item) {
            this.outputs.push({
                text,
                location,
                item
            });
        },
        addCoverage(coverage) {
            this.coverages.push(coverage);
        },
        end() {
            this.ended = true;
        }
    };
}

function collection() {
    const values = new Map();

    return {
        get size() {
            return values.size;
        },
        get(id) {
            return values.get(id);
        },
        replace(items) {
            values.clear();

            for (const item of items) {
                values.set(item.id, item);
            }
        },
        forEach(callback) {
            for (const item of values.values()) {
                callback(item, this);
            }
        },
        [Symbol.iterator]() {
            return values.entries();
        }
    };
}

function fakeVSCode() {
    class TestMessage {

        constructor(message) {
            this.message = message;
        }

        static diff(message, expected, actual) {
            const value = new TestMessage(message);
            value.expectedOutput = expected;
            value.actualOutput = actual;
            return value;
        }
    }

    class Range {

        constructor(...values) {
            this.values = values;
        }
    }

    class Location {

        constructor(uri, range) {
            this.uri = uri;
            this.range = range;
        }
    }

    class TestCoverageCount {

        constructor(covered, total) {
            this.covered = covered;
            this.total = total;
        }
    }

    class FileCoverage {

        constructor(
            uri,
            statementCoverage,
            branchCoverage,
            declarationCoverage,
            includesTests
        ) {
            this.uri = uri;
            this.statementCoverage =
                statementCoverage;
            this.branchCoverage = branchCoverage;
            this.declarationCoverage =
                declarationCoverage;
            this.includesTests = includesTests;
        }
    }

    class StatementCoverage {

        constructor(executed, location, branches = []) {
            this.executed = executed;
            this.location = location;
            this.branches = branches;
        }
    }

    class BranchCoverage {

        constructor(executed, location, label) {
            this.executed = executed;
            this.location = location;
            this.label = label;
        }
    }

    class DeclarationCoverage {

        constructor(name, executed, location) {
            this.name = name;
            this.executed = executed;
            this.location = location;
        }
    }

    return {
        TestRunProfileKind: { Run: 1, Coverage: 3 },
        TestMessage,
        Range,
        Location,
        TestCoverageCount,
        FileCoverage,
        StatementCoverage,
        BranchCoverage,
        DeclarationCoverage
    };
}

function cancellationToken() {
    let listener = null;
    const subscription = {
        disposed: false,
        dispose() {
            subscription.disposed = true;
        }
    };

    return {
        isCancellationRequested: false,
        subscription,
        onCancellationRequested(value) {
            listener = value;
            return subscription;
        },
        cancel() {
            this.isCancellationRequested = true;
            listener?.();
        }
    };
}

function testSuite(overrides = {}) {
    return createCLRSTestSuite({
        id: "suite:suma",
        name: "Suite suma",
        programPath: PROGRAM_PATH,
        definitionPath: DEFINITION_PATH,
        cases: overrides.cases ?? [
            caseSource("case:uno", "Caso uno"),
            caseSource("case:dos", "Caso dos")
        ]
    });
}

function caseSource(id, name) {
    return {
        id,
        name,
        input: { stdin: "" },
        expectation: { stdout: "" }
    };
}

function result(overrides) {
    return createCLRSTestResult({
        suiteId: "suite:suma",
        caseId: overrides.caseId,
        status: overrides.status,
        durationMs: overrides.durationMs ?? 0,
        stdout: overrides.stdout ?? "",
        stderr: overrides.stderr ?? "",
        exitCode: overrides.status ===
            CLRSTestResultStatus.PASSED ||
            overrides.status ===
                CLRSTestResultStatus.FAILED
            ? 0
            : null,
        failure: overrides.failure ?? null,
        coverage: overrides.coverage ?? null
    });
}

function execution(
    results,
    coverage = null,
    sourceVersion = null
) {
    return {
        results,
        coverage,
        sourceVersion
    };
}

function coveragePoint(kind, line, name = null) {
    return createExecutionCoveragePoint(
        kind,
        {
            startLine: line,
            startColumn: 5,
            endLine: line,
            endColumn: 12
        },
        { name }
    );
}

async function waitFor(predicate) {
    const timeoutAt = Date.now() + 2_000;

    while (!predicate()) {
        if (Date.now() >= timeoutAt) {
            assert.fail("La condición esperada no se cumplió.");
        }

        await new Promise(resolve =>
            setTimeout(resolve, 5)
        );
    }
}
