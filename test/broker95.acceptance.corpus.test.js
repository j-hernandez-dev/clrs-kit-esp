import assert from "node:assert/strict";
import {
    readFileSync
} from "node:fs";
import test from "node:test";

import {
    BROKER_CRITERIA,
    BROKER_PROTOCOL_ID,
    BROKER_PROTOCOL_VERSION,
    BrokerCategoryAudience,
    BrokerClrsDocumentCaptureService,
    BrokerClrsTestProcessRunner,
    BrokerOperationCoordinator,
    BrokerProtocolDirection,
    BrokerTestExecutionService,
    acceptBrokerContract,
    addBrokerContract,
    brokerCategoryCatalog,
    brokerGameStateSerializer,
    calculateBrokerPayout,
    compareBrokerTestOutput,
    createBrokerContract,
    createBrokerGameState,
    createBrokerOperationFingerprint,
    createBrokerWebviewMessage,
    getBrokerRiskRule,
    parseBrokerTerminalInput,
    parseBrokerWebviewMessage,
    purchaseBrokerCountermeasure,
    settleBrokerContract
} from "../src/broker95/index.js";
import {
    JavaScriptGenerator
} from "../src/compiler/JavaScriptGenerator.js";
import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";

const corpus = JSON.parse(
    readFileSync(
        new URL(
            "./fixtures/broker95-acceptance-corpus.v1.json",
            import.meta.url
        ),
        "utf8"
    )
);

test("el corpus BROKER.95 es versionado, trazable y no deja casos huérfanos", () => {
    assert.equal(corpus.schemaVersion, 1);
    assert.deepEqual(
        Object.keys(corpus.coverageAreas),
        [
            "academic-policy",
            "catalog",
            "terminal",
            "economy",
            "comparison",
            "protocol",
            "game-lifecycle",
            "local-execution",
            "concurrency"
        ]
    );

    const cases = collectCorpusCases();
    const ids = cases.map(item => item.id);
    const referencedIds = new Set(
        Object.values(corpus.coverageAreas).flat()
    );

    assert.equal(new Set(ids).size, ids.length);
    assert.equal(cases.length >= 90, true);

    for (const id of ids) {
        assert.equal(
            referencedIds.has(id),
            true,
            `El caso ${id} no está asociado a un área de cobertura.`
        );
    }

    for (const id of referencedIds) {
        assert.equal(
            ids.includes(id),
            true,
            `El área de cobertura referencia el caso inexistente ${id}.`
        );
    }
});

test("el corpus fija las tres dimensiones y la tabla canónica de riesgos", () => {
    assert.deepEqual(
        BROKER_CRITERIA,
        corpus.academicPolicy.dimensions
    );

    for (const forbidden of
        corpus.academicPolicy.forbiddenDimensions) {
        assert.equal(BROKER_CRITERIA.includes(forbidden), false);
    }

    for (const item of corpus.riskRules) {
        const actual = getBrokerRiskRule(item.risk);

        assert.equal(actual.alertIncrement, item.alertIncrement, item.id);
        assert.deepEqual(actual.payRange, item.payRange, item.id);
        assert.deepEqual(actual.weights, item.weights, item.id);
        assert.equal(
            Object.values(actual.weights)
                .reduce((total, value) => total + value, 0),
            1,
            item.id
        );
        assert.equal(
            Object.keys(actual.weights)
                .every(criterion => BROKER_CRITERIA.includes(criterion)),
            true,
            item.id
        );
    }
});

test("el corpus detecta deriva en las categorías de cliente y aprendizaje", () => {
    assert.equal(
        brokerCategoryCatalog.size,
        corpus.catalog.categoryCount
    );
    assert.equal(
        brokerCategoryCatalog.families.length,
        corpus.catalog.familyCount
    );
    assert.equal(
        brokerCategoryCatalog.listCategories({
            audience: BrokerCategoryAudience.CLIENT
        }).length,
        corpus.catalog.clientCategoryCount
    );
    assert.equal(
        brokerCategoryCatalog.listCategories({
            audience:
                BrokerCategoryAudience.LEARNING
        }).length,
        corpus.catalog.learningCategoryCount
    );
    assert.deepEqual(
        Object.fromEntries(
            brokerCategoryCatalog.families.map(family => [
                family.familyId,
                family.categoryCount
            ])
        ),
        corpus.catalog.families
    );

    for (const [risk, expected] of Object.entries(
        corpus.catalog.compatibleCategoryCountByRisk
    )) {
        assert.equal(
            brokerCategoryCatalog.listCategories({
                risk,
                audience:
                    BrokerCategoryAudience.CLIENT
            }).length,
            expected,
            risk
        );
    }

    for (const [risk, expected] of Object.entries(
        corpus.catalog.baseCategoryCountByRisk
    )) {
        assert.equal(
            brokerCategoryCatalog.listCategories({
                baseRisk: risk,
                audience:
                    BrokerCategoryAudience.CLIENT
            }).length,
            expected,
            `base:${risk}`
        );
    }
});

test("el corpus protege todos los umbrales de pago", () => {
    for (const item of corpus.payoutCases) {
        assert.equal(
            calculateBrokerPayout(item.potential, item.score),
            item.expected,
            item.id
        );
    }
});

test("el corpus acepta todos los comandos públicos y rechaza su matriz negativa", () => {
    for (const item of corpus.terminal.valid) {
        const command = parseBrokerTerminalInput(item.input);

        assert.equal(command.type, item.type, item.id);
        assert.equal(command.requiresLlm, item.requiresLlm, item.id);
        assert.equal(
            command.requiresActiveDocument,
            item.requiresActiveDocument,
            item.id
        );

        for (const field of [
            "risk",
            "contractId",
            "documentSelector",
            "question"
        ]) {
            if (Object.hasOwn(item, field)) {
                assert.equal(command[field], item[field], `${item.id}:${field}`);
            }
        }
    }

    for (const item of corpus.terminal.invalid) {
        assert.throws(
            () => parseBrokerTerminalInput(item.input),
            error => error.code === item.errorCode,
            item.id
        );
    }
});

test("el corpus recorre positivamente y negativamente todos los comparadores", () => {
    const seen = new Set();

    for (const [group, expectedPass] of [
        [corpus.comparisonCases.passing, true],
        [corpus.comparisonCases.failing, false]
    ]) {
        for (const item of group) {
            const result = compareBrokerTestOutput(
                comparisonTestCase(item),
                item.actual
            );

            seen.add(`${item.comparison}:${expectedPass}`);
            assert.equal(result.passed, expectedPass, item.id);
            assert.equal(
                result.reason == null,
                expectedPass,
                item.id
            );
        }
    }

    for (const comparison of new Set(
        corpus.comparisonCases.passing.map(item => item.comparison)
    )) {
        assert.equal(seen.has(`${comparison}:true`), true, comparison);
        assert.equal(seen.has(`${comparison}:false`), true, comparison);
    }
});

test("el corpus prueba la frontera estricta Webview a Extension Host", () => {
    for (const item of corpus.protocol.validWebviewMessages) {
        const message = createBrokerWebviewMessage({
            type: item.type,
            requestId: `corpus:${item.id}`,
            payload: item.payload
        });

        assert.equal(message.type, item.type, item.id);
        assert.deepEqual(message.payload, item.payload, item.id);
        assert.equal(Object.isFrozen(message), true, item.id);
    }

    for (const item of corpus.protocol.invalidWebviewMessages) {
        const envelope = invalidProtocolEnvelope(item);

        assert.throws(
            () => parseBrokerWebviewMessage(envelope),
            error => error.code === item.errorCode,
            item.id
        );
    }
});

test("el corpus ejecuta ciclos completos y persiste sus resultados sin deriva", () => {
    for (const scenario of corpus.gameScenarios) {
        const state = runGameScenario(scenario);
        const contract = state.contracts.find(item => item.id === 1) ?? null;

        assert.equal(state.status, scenario.expected.status, scenario.id);
        assert.equal(state.revision, scenario.expected.revision, scenario.id);
        assert.equal(state.money, scenario.expected.money, scenario.id);
        assert.equal(
            state.alertLevel,
            scenario.expected.alertLevel,
            scenario.id
        );
        assert.equal(
            state.activeContractId,
            scenario.expected.activeContractId,
            scenario.id
        );
        assert.equal(
            state.completedContractIds.length,
            scenario.expected.completed,
            scenario.id
        );
        assert.equal(
            state.failedContractIds.length,
            scenario.expected.failed,
            scenario.id
        );
        assert.equal(
            contract?.state ?? null,
            scenario.expected.contractState,
            scenario.id
        );

        if (scenario.expected.finalScore != null) {
            assert.equal(
                contract.evaluation.finalScore,
                scenario.expected.finalScore,
                scenario.id
            );
            assert.equal(contract.payout, scenario.expected.payout, scenario.id);
        }

        const restored = brokerGameStateSerializer.decode(
            brokerGameStateSerializer.encode(state)
        ).state;

        assert.deepEqual(restored, state, `${scenario.id}:round-trip`);
    }
});

test("el corpus ejecuta programas CLRS reales y conserva privados sus oráculos", async () => {
    for (const scenario of corpus.executionScenarios) {
        const service = createExecutionService(scenario);
        const result = await service.executeActiveContract();

        assert.equal(result.status, scenario.expectedStatus, scenario.id);
        assert.deepEqual(result.summary, scenario.expectedSummary, scenario.id);
        assert.equal(
            result.testCases.every(item =>
                scenario.expectedStatus === "source-invalid"
                    ? item.status === "not-run"
                    : item.status === "passed"
            ),
            true,
            scenario.id
        );
        assert.equal(service.documentAnalysisService.size, 1, scenario.id);
    }
});

test("el corpus hace ejecutable la idempotencia, el conflicto y el reintento", async () => {
    for (const item of corpus.operationCases) {
        const coordinator = new BrokerOperationCoordinator();
        let executions = 0;

        if (item.mode === "single-flight") {
            const descriptor = operationDescriptor(item.id, { intent: 1 });
            const operation = async () => {
                executions += 1;
                await Promise.resolve();
                return "ok";
            };

            assert.deepEqual(
                await Promise.all([
                    coordinator.execute(descriptor, operation),
                    coordinator.execute(descriptor, operation)
                ]),
                ["ok", "ok"],
                item.id
            );
            assert.equal(executions, item.expectedExecutions, item.id);
            continue;
        }

        if (item.mode === "key-conflict") {
            await coordinator.execute(
                operationDescriptor(item.id, { intent: 1 }),
                () => "ok"
            );
            assert.throws(
                () => coordinator.execute(
                    operationDescriptor(item.id, { intent: 2 }),
                    () => "no"
                ),
                error => error.code === item.errorCode,
                item.id
            );
            continue;
        }

        const descriptor = operationDescriptor(item.id, { intent: 1 });

        await assert.rejects(
            coordinator.execute(descriptor, () => {
                executions += 1;
                throw new Error("transient");
            })
        );
        assert.equal(
            await coordinator.execute(descriptor, () => {
                executions += 1;
                return "recovered";
            }),
            "recovered",
            item.id
        );
        assert.equal(executions, item.expectedExecutions, item.id);
    }
});

function collectCorpusCases() {
    return [
        ...corpus.riskRules,
        ...corpus.payoutCases,
        ...corpus.terminal.valid,
        ...corpus.terminal.invalid,
        ...corpus.comparisonCases.passing,
        ...corpus.comparisonCases.failing,
        ...corpus.protocol.validWebviewMessages,
        ...corpus.protocol.invalidWebviewMessages,
        ...corpus.gameScenarios,
        ...corpus.executionScenarios,
        ...corpus.operationCases
    ];
}

function comparisonTestCase(item) {
    return {
        id: item.id,
        kind: "normal",
        requirementIds: ["REQ-1"],
        stdin: "",
        expected: item.expected,
        comparison: item.comparison,
        timeoutMs: 1_000
    };
}

function invalidProtocolEnvelope(item) {
    const envelope = {
        protocol: BROKER_PROTOCOL_ID,
        protocolVersion: BROKER_PROTOCOL_VERSION,
        direction: BrokerProtocolDirection.WEBVIEW_TO_HOST,
        type: "game/request-state",
        requestId: `corpus:${item.id}`,
        payload: {}
    };

    if (item.mutation === "extraEnvelopeField") {
        envelope.unexpected = item.value;
    } else if (item.mutation === "extraPayloadField") {
        envelope.payload.unexpected = item.value;
    } else {
        envelope[item.mutation] = item.value;
    }

    return envelope;
}

function runGameScenario(scenario) {
    let state = createBrokerGameState(scenario.initial);

    for (const operation of scenario.operations) {
        switch (operation.type) {
            case "add":
                state = addBrokerContract(
                    state,
                    contractDraft(scenario.contract)
                );
                break;

            case "accept":
                state = acceptBrokerContract(state, 1);
                break;

            case "settle":
                state = settleBrokerContract(state, {
                    dimensionScores: operation.dimensionScores,
                    submittedAt: 95
                });
                break;

            case "countermeasure":
                state = purchaseBrokerCountermeasure(
                    state,
                    operation.countermeasureId
                );
                break;

            default:
                assert.fail(`Operación desconocida en ${scenario.id}.`);
        }
    }

    return state;
}

function contractDraft({ risk, payPotential }) {
    const category = brokerCategoryCatalog.requireCategory("NUM-ARITH");

    return {
        title: "Contrato del corpus",
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        familyId: category.familyId,
        familyName: category.familyName,
        risk,
        description: "Validar una transición determinista completa.",
        requirements: ["Producir la salida esperada."],
        client: "Laboratorio del corpus",
        payPotential,
        metadata: { source: "broker95-corpus-v1" }
    };
}

function createExecutionService(scenario) {
    const category = brokerCategoryCatalog.requireCategory("NUM-ARITH");
    const contract = createBrokerContract({
        id: 1,
        title: "Ejecución del corpus",
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        familyId: category.familyId,
        familyName: category.familyName,
        risk: "low",
        description: "Ejecutar casos locales reproducibles.",
        requirements: ["Responder correctamente."],
        client: "Laboratorio del corpus",
        payPotential: 100,
        state: "active",
        metadata: { requirementIds: ["REQ-1"] },
        testCases: scenario.testCases
    });
    const documentAnalysisService = new DocumentAnalysisService({
        languageDiagnosticsService: new LanguageDiagnosticsService(),
        analyzeCost() {
            return null;
        }
    });
    const capture = new BrokerClrsDocumentCaptureService({
        documentHost: {
            captureActiveDocument() {
                return Object.freeze({
                    documentId: `file:///broker95/corpus/${scenario.id}.clrs`,
                    name: `${scenario.id}.clrs`,
                    languageId: "clrs-es",
                    version: 1,
                    sourceCode: scenario.sourceCode
                });
            }
        },
        documentAnalysisService,
        languageId: "clrs-es",
        now: () => 95
    });
    const gameSession = {
        state: createBrokerGameState({
            activeContractId: 1,
            contracts: [contract],
            nextContractId: 2
        }),
        async initialize() {},
        getState() {
            return this.state;
        }
    };

    const service = new BrokerTestExecutionService({
        gameSession,
        documentCapture: capture,
        documentAnalysisService,
        javaScriptGenerator: new JavaScriptGenerator(),
        programRunner: new BrokerClrsTestProcessRunner()
    });

    service.documentAnalysisService = documentAnalysisService;
    return service;
}

function operationDescriptor(requestId, intent) {
    return {
        operation: "corpus.operation",
        requestId,
        fingerprint: createBrokerOperationFingerprint(intent),
        lane: "corpus.game"
    };
}
