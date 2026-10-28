import assert from "node:assert/strict";
import test from "node:test";

import {
    BrokerLLMFinishReason,
    BrokerLLMPort,
    BrokerLlmStatus,
    BrokerLlmStatusReason,
    BrokerRisk,
    BrokerSubmissionEvaluationService,
    BrokerTestComparison,
    acceptBrokerContract,
    addBrokerLearningContract,
    calculateBrokerEvaluationScores,
    createBrokerClrsDocumentCapture,
    createBrokerContract,
    createBrokerEvaluationAnchors,
    createBrokerGameState,
    createBrokerLLMSystemInstruction,
    getBrokerEvaluationRubric,
    validateBrokerSubmissionEvaluation
} from "../src/broker95/index.js";
import {
    activateAlgorithmsLesson,
    brokerAlgorithmsLearningCatalogFixture,
    createAlgorithmsLearningCatalogsFixture,
    createUnlockedAlgorithmsGameState
} from "./fixtures/broker95-algorithms-learning-fixture.js";

const SOURCE = [
    "PRINCIPAL()",
    "    escribir 1"
].join("\n");

test("el Host aplica puntos base y riesgo a las puntuaciones elegidas por CIPHER", () => {
    const scores = calculateBrokerEvaluationScores(
        BrokerRisk.HIGH,
        {
            "F-CUM": 80,
            "F-COR": 100,
            "F-LIM": 60,
            "R-VAL": 100,
            "R-SEG": 50,
            "R-MAN": 75,
            "D-CLA": 80,
            "D-SIM": 80,
            "D-MOD": 80,
            "D-COH": 80,
            "D-ACO": 80,
            "D-ABS": 80
        }
    );

    assert.deepEqual(scores.dimensionScores, {
        functionality: 85,
        robustness: 75,
        design: 80
    });
    assert.equal(scores.finalScore, 82);
    assert.equal(
        getBrokerEvaluationRubric(BrokerRisk.HIGH)
            .dimensions[2].criteria.find(
                item => item.criterion === "D-MOD"
            ).internalWeight,
        0.2
    );
    assert.throws(
        () => calculateBrokerEvaluationScores(
            BrokerRisk.LOW,
            {
                "F-CUM": 100,
                "F-COR": 100,
                "F-LIM": 100,
                "D-CLA": 100
            }
        ),
        error => error.code ===
            "BROKER95_EVALUATION_CRITERION_SCORES_INVALID"
    );
});

test("construye anclas objetivas sin convertir métricas de diseño en penalizaciones", () => {
    const contract = activeContract({
        risk: BrokerRisk.MEDIUM,
        payPotential: 300,
        requirements: [
            "Resolver la entrada válida.",
            "Controlar la entrada inválida."
        ],
        metadata: {
            requirementIds: ["REQ-1", "REQ-2"]
        },
        testCases: [
            testCase({
                id: "TC-normal",
                kind: "normal",
                requirementIds: ["REQ-1"]
            }),
            testCase({
                id: "TC-edge",
                kind: "boundary",
                requirementIds: ["REQ-1"]
            }),
            testCase({
                id: "TC-invalid",
                kind: "invalid",
                requirementIds: ["REQ-2"]
            })
        ]
    });
    const capture = documentCapture();
    const execution = testExecution(
        contract,
        capture,
        [
            resultCase("TC-normal", "normal", ["REQ-1"], "passed"),
            resultCase("TC-edge", "boundary", ["REQ-1"], "failed"),
            resultCase("TC-invalid", "invalid", ["REQ-2"], "passed")
        ]
    );
    const anchors = createBrokerEvaluationAnchors({
        contract,
        testExecution: execution,
        staticEvidence: staticResult(capture)
    });
    const byId = Object.fromEntries(
        anchors.criteria.map(item => [
            item.criterion,
            item
        ])
    );

    assert.equal(byId["F-CUM"].observedScore, 50);
    assert.equal(byId["F-COR"].observedScore, 100);
    assert.equal(byId["F-LIM"].observedScore, 0);
    assert.equal(byId["R-VAL"].observedScore, 100);
    assert.equal(byId["R-SEG"].observedScore, null);
    assert.equal(byId["R-SEG"].confidence, "signals-only");
    assert.equal(
        anchors.policy.observedScoresAreStartingPoints,
        true
    );
    assert.equal(
        anchors.policy.avoidDuplicatePenalties,
        true
    );
});

test("valida todos y sólo los subcriterios activos sin aceptar agregados del LLM", () => {
    const valid = evaluationOutput(BrokerRisk.LOW);

    assert.deepEqual(
        validateBrokerSubmissionEvaluation(
            valid,
            { risk: BrokerRisk.LOW }
        ).criteria.map(item => item.criterion),
        ["F-CUM", "F-COR", "F-LIM"]
    );
    assert.throws(
        () => validateBrokerSubmissionEvaluation(
            {
                ...valid,
                finalScore: 100
            },
            { risk: BrokerRisk.LOW }
        ),
        error => error.code ===
            "BROKER95_EVALUATION_RESPONSE_FIELDS_INVALID"
    );
    assert.throws(
        () => validateBrokerSubmissionEvaluation(
            {
                ...valid,
                criteria: [
                    valid.criteria[0],
                    valid.criteria[0],
                    valid.criteria[2]
                ]
            },
            { risk: BrokerRisk.LOW }
        ),
        error => error.code ===
            "BROKER95_EVALUATION_CRITERIA_INVALID"
    );
    assert.throws(
        () => validateBrokerSubmissionEvaluation(
            {
                ...valid,
                criteria: valid.criteria.map(
                    (item, index) => index === 0
                        ? { ...item, score: 100.5 }
                        : item
                )
            },
            { risk: BrokerRisk.LOW }
        ),
        error => error.code ===
            "BROKER95_SCORE_INVALID"
    );
});

test("evalúa una captura exacta, recalcula agregados y no liquida la partida", async () => {
    const contract = activeContract();
    const state = stateWithContract(contract);
    const capture = documentCapture();
    const observed = { captureCount: 0 };
    const llm = new EvaluationLlm(
        evaluationOutput(BrokerRisk.LOW)
    );
    const service = createEvaluationService({
        state,
        capture,
        llm,
        observed
    });
    const before = service.gameSession.getState();
    const result = await service.evaluate({
        requestId: "evaluation:test"
    });

    assert.deepEqual(result.criterionScores, {
        "F-CUM": 80,
        "F-COR": 100,
        "F-LIM": 60
    });
    assert.deepEqual(result.dimensionScores, {
        functionality: 85
    });
    assert.equal(result.finalScore, 85);
    assert.deepEqual(result.settlement, {
        performed: false,
        payoutCalculated: false,
        gameStateMutated: false
    });
    assert.equal(service.gameSession.getState(), before);
    assert.equal(observed.captureCount, 1);
    assert.equal(observed.staticCapture, capture);
    assert.equal(observed.testCapture, capture);
    assert.equal(Object.isFrozen(result), true);

    const request = llm.requests[0];
    const serialized = JSON.stringify(request);

    assert.equal(request.operation, "evaluateSubmission");
    assert.equal(request.stream, false);
    assert.equal(
        request.input.deterministicEvidence
            .anchors.policy
            .llmChoosesCriterionScores,
        true
    );
    assert.equal(
        request.context.scoringAuthority
            .hostCalculatesFinalScore,
        true
    );
    assert.equal(
        Object.hasOwn(request.input.contract, "payPotential"),
        false
    );
    assert.equal(serialized.includes("entrada-privada"), false);
    assert.equal(serialized.includes("oraculo-privado"), false);
    assert.equal(serialized.includes("file:///privado"), false);
});

test("ai -push limita la evaluación educativa a Funcionalidad y al conocimiento acumulado", async () => {
    const state = activeLearningState();
    const capture = documentCapture();
    const llm = new EvaluationLlm(
        evaluationOutput(BrokerRisk.LOW)
    );
    const result = await createEvaluationService({
        state,
        capture,
        llm
    }).evaluateCapture(
        capture,
        { requestId: "evaluation:learning" }
    );
    const request = llm.requests[0];

    assert.deepEqual(
        request.input.responseShape
            .criteria.requiredIds,
        ["F-CUM", "F-COR", "F-LIM"]
    );
    assert.equal(
        request.context.constraints
            .functionalityOnly,
        true
    );
    assert.equal(
        request.context.constraints
            .noFutureKnowledgePenalty,
        true
    );
    assert.equal(
        request.context.pedagogy.mode,
        "definitive-functionality"
    );
    assert.equal(
        request.context.pedagogy
            .lesson.lessonId,
        "lesson-001"
    );
    assert.deepEqual(result.dimensionScores, {
        functionality: 85
    });
    assert.match(
        createBrokerLLMSystemInstruction(
            request
        ),
        /absence of techniques outside pedagogy\.accumulatedKnowledge/u
    );
});

test("ai -push repara una evaluación educativa que recomienda conceptos futuros", async () => {
    const future = evaluationOutput(
        BrokerRisk.LOW
    );
    const llm = new SequenceEvaluationLlm([
        {
            ...future,
            findings: [{
                severity: "important",
                criterion: "F-COR",
                location: "PRINCIPAL",
                problem:
                    "La salida no coincide.",
                evidence:
                    "La prueba declarada falló.",
                recommendation:
                    "Resuélvelo con una función recursiva."
            }]
        },
        future
    ]);
    const state = activeLearningState();
    const capture = documentCapture();
    const result = await createEvaluationService({
        state,
        capture,
        llm
    }).evaluateCapture(
        capture,
        {
            requestId:
                "evaluation:learning:repair"
        }
    );

    assert.equal(llm.requests.length, 2);
    assert.equal(
        llm.requests[1].input.repair
            .validationCode,
        "BROKER95_LEARNING_EVALUATION_FUTURE_KNOWLEDGE"
    );
    assert.deepEqual(
        llm.requests[1].context.pedagogy,
        llm.requests[0].context.pedagogy
    );
    assert.equal(result.provider.repaired, true);
});

test("ai -push evalúa Algoritmia con el contexto curricular de su propia ruta", async () => {
    const catalogs =
        createAlgorithmsLearningCatalogsFixture();
    const state = activateAlgorithmsLesson(
        createUnlockedAlgorithmsGameState(
            catalogs
        ),
        "algorithm-lesson-001",
        catalogs
    );
    const capture = documentCapture();
    const llm = new EvaluationLlm(
        evaluationOutput(BrokerRisk.LOW)
    );
    const result = await createEvaluationService({
        state,
        capture,
        llm,
        catalogs
    }).evaluateCapture(
        capture,
        { requestId: "evaluation:algorithms" }
    );
    const request = llm.requests[0];
    const pedagogy =
        request.context.pedagogy;

    assert.equal(
        pedagogy.learningRouteId,
        "algorithms"
    );
    assert.equal(
        pedagogy.algorithmicReview.objective,
        brokerAlgorithmsLearningCatalogFixture
            .requireLesson("algorithm-lesson-001")
            .objective
    );
    assert.equal(
        pedagogy.prerequisiteKnowledge[0]
            .learningRouteId,
        "programming"
    );
    assert.deepEqual(
        pedagogy.algorithmicReview
            .blockedConcepts,
        [
            "aplicar divide y conquista",
            "analizar recurrencias"
        ]
    );
    assert.deepEqual(result.dimensionScores, {
        functionality: 85
    });

    const instruction =
        createBrokerLLMSystemInstruction(request);

    assert.match(
        instruction,
        /evaluation belongs to the Algorithms route/u
    );
    assert.match(
        instruction,
        /tool use never affects score/u
    );
});

test("ai -push repara una evaluación que usa herramientas como evidencia de puntuación", async () => {
    const catalogs =
        createAlgorithmsLearningCatalogsFixture();
    const state = activateAlgorithmsLesson(
        createUnlockedAlgorithmsGameState(
            catalogs
        ),
        "algorithm-lesson-001",
        catalogs
    );
    const capture = documentCapture();
    const invalid = evaluationOutput(
        BrokerRisk.LOW
    );
    const llm = new SequenceEvaluationLlm([
        {
            ...invalid,
            criteria: invalid.criteria.map(
                (criterion, index) => index === 0
                    ? {
                        ...criterion,
                        rationale:
                            "La puntuación baja porque no usó el depurador."
                    }
                    : criterion
            )
        },
        evaluationOutput(BrokerRisk.LOW)
    ]);
    const result = await createEvaluationService({
        state,
        capture,
        llm,
        catalogs
    }).evaluateCapture(
        capture,
        {
            requestId:
                "evaluation:algorithms:tool-scoring"
        }
    );

    assert.equal(llm.requests.length, 2);
    assert.equal(
        llm.requests[1].input.repair
            .validationCode,
        "BROKER95_LEARNING_EVALUATION_TOOL_SCORING_FORBIDDEN"
    );
    assert.equal(result.provider.repaired, true);
});

test("evalúa una captura fijada por ai -push sin volver a leer el editor", async () => {
    const contract = activeContract();
    const capture = documentCapture();
    const observed = { captureCount: 0 };
    const service = createEvaluationService({
        state: stateWithContract(contract),
        capture,
        observed
    });
    const result = await service.evaluateCapture(
        capture,
        { requestId: "evaluation:push" }
    );

    assert.equal(observed.captureCount, 0);
    assert.equal(observed.staticCapture, capture);
    assert.equal(observed.testCapture, capture);
    assert.equal(result.document.sourceHash, capture.sourceHash);
    assert.equal(result.stateRevision, 9);
});

test("una evaluación correlacionada ejecuta pruebas y CIPHER una sola vez", async () => {
    const contract = activeContract();
    const capture = documentCapture();
    const observed = { captureCount: 0 };
    const llm = new EvaluationLlm(
        evaluationOutput(BrokerRisk.LOW)
    );
    const service = createEvaluationService({
        state: stateWithContract(contract),
        capture,
        llm,
        observed
    });
    const options = {
        requestId: "evaluation:idempotent:1"
    };
    const [first, duplicate] =
        await Promise.all([
            service.evaluateCapture(
                capture,
                options
            ),
            service.evaluateCapture(
                capture,
                options
            )
        ]);

    assert.equal(first, duplicate);
    assert.equal(llm.requests.length, 1);
    assert.equal(
        await service.evaluateCapture(
            capture,
            options
        ),
        first
    );
    assert.equal(llm.requests.length, 1);
});

test("ai -push repara una puntuación inválida antes de liquidarla", async () => {
    const contract = activeContract();
    const capture = documentCapture();
    const llm = new SequenceEvaluationLlm([
        {
            ...evaluationOutput(BrokerRisk.LOW),
            finalScore: 100
        },
        evaluationOutput(BrokerRisk.LOW)
    ]);
    const result = await createEvaluationService({
        state: stateWithContract(contract),
        capture,
        llm
    }).evaluateCapture(
        capture,
        { requestId: "evaluation:repair:1" }
    );

    assert.equal(llm.requests.length, 2);
    assert.equal(
        llm.requests[1].input.repair.validationCode,
        "BROKER95_EVALUATION_RESPONSE_FIELDS_INVALID"
    );
    assert.equal(
        llm.requests[1].input.repair
            .previousResponse.finalScore,
        100
    );
    assert.equal(result.provider.attempts, 2);
    assert.equal(result.provider.repaired, true);
    assert.equal(result.finalScore, 85);
});

test("CIPHER no disponible o sin contrato falla antes de capturar evidencia", async () => {
    const noContractObserved = { captureCount: 0 };
    const noContract = createEvaluationService({
        state: createBrokerGameState(),
        observed: noContractObserved
    });

    await assert.rejects(
        () => noContract.evaluate(),
        error => error.code ===
            "BROKER95_EVALUATION_ACTIVE_CONTRACT_REQUIRED"
    );
    assert.equal(noContractObserved.captureCount, 0);

    const unavailableObserved = { captureCount: 0 };
    const unavailable = createEvaluationService({
        state: stateWithContract(activeContract()),
        availability: unavailableSnapshot(),
        observed: unavailableObserved
    });

    await assert.rejects(
        () => unavailable.evaluate(),
        error => error.code ===
            "BROKER95_LLM_MODEL_MISSING"
    );
    assert.equal(unavailableObserved.captureCount, 0);
});

class EvaluationLlm extends BrokerLLMPort {

    constructor(output) {
        super();
        this.output = output;
        this.requests = [];
    }

    async performRequest(request) {
        this.requests.push(request);

        return {
            output: this.output,
            model: request.model,
            finishReason:
                BrokerLLMFinishReason.STOP,
            usage: {
                inputTokens: 20,
                outputTokens: 10,
                totalTokens: 30
            },
            responseId: "response:evaluation"
        };
    }
}

class SequenceEvaluationLlm extends BrokerLLMPort {

    constructor(outputs) {
        super();
        this.outputs = [...outputs];
        this.requests = [];
    }

    async performRequest(request) {
        this.requests.push(request);

        return {
            output: this.outputs.shift(),
            model: request.model,
            finishReason:
                BrokerLLMFinishReason.STOP,
            usage: null,
            responseId:
                `response:evaluation:${this.requests.length}`
        };
    }
}

test("evaluación: un fallo de preparación GUI o cancelación no consulta CIPHER ni modifica la partida", async () => {
    for (const reason of ["runtime-preparation-failed", "cancelled"]) {
        const llm = new EvaluationLlm(evaluationOutput(BrokerRisk.LOW));
        const service = createEvaluationService({ state: stateWithContract(activeContract()), llm });
        const before = service.gameSession.getState();
        const controller = new AbortController();
        service.testExecution = { async executeContractCapture(_contract, _capture, options) {
            assert.equal(options.signal, controller.signal);
            return { testCases: [{ reason }] };
        } };
        await assert.rejects(service.evaluate({ requestId: `gui:${reason}`, signal: controller.signal }),
            error => error.code === "BROKER95_TEST_EXECUTION_GENERATION_FAILED");
        assert.equal(llm.requests.length, 0);
        assert.equal(service.gameSession.getState(), before);
    }
});

function createEvaluationService({
    state,
    capture = documentCapture(),
    availability = readySnapshot(),
    llm = new EvaluationLlm(
        evaluationOutput(BrokerRisk.LOW)
    ),
    observed = {},
    catalogs
}) {
    observed.captureCount ??= 0;
    const contract = state.contracts?.find(
        item => item.id === state.activeContractId
    ) ?? activeContract();
    const execution = testExecution(
        contract,
        capture,
        contract.testCases.map(item =>
            resultCase(
                item.id,
                item.kind,
                item.requirementIds,
                "passed"
            )
        )
    );
    const gameSession = {
        state,
        async initialize() {},
        getState() {
            return this.state;
        }
    };
    const service = new BrokerSubmissionEvaluationService({
        gameSession,
        availability: {
            getSnapshot() {
                return availability;
            }
        },
        llm,
        documentCapture: {
            capture() {
                observed.captureCount += 1;
                return capture;
            }
        },
        staticEvidence: {
            collectCapture(value) {
                observed.staticCapture = value;
                return staticResult(capture);
            }
        },
        testExecution: {
            async executeContractCapture(
                selected,
                value
            ) {
                assert.equal(selected, contract);
                observed.testCapture = value;
                return execution;
            }
        },
        createRequestId() {
            return "evaluation:generated";
        },
        catalogs
    });

    service.gameSession = gameSession;
    return service;
}

function evaluationOutput(risk) {
    const criteria = getBrokerEvaluationRubric(risk)
        .dimensions.flatMap(dimension =>
            dimension.criteria.map(item => ({
                criterion: item.criterion,
                score: {
                    "F-CUM": 80,
                    "F-COR": 100,
                    "F-LIM": 60
                }[item.criterion] ?? 80,
                evidence: [
                    `Evidencia observable para ${item.criterion}.`
                ],
                rationale:
                    "La puntuación considera la evidencia y su confianza."
            }))
        );

    return {
        summary:
            "La entrega fue puntuada usando la evidencia disponible.",
        criteria,
        findings: []
    };
}

function activeContract(overrides = {}) {
    return createBrokerContract({
        id: 1,
        title: "Señal de prueba",
        categoryId: "NUM-ARITH",
        categoryName: "Aritmética",
        familyId: "NUM",
        familyName: "Procesamiento numérico",
        risk: BrokerRisk.LOW,
        description: "Produce la señal solicitada.",
        requirements: ["Escribir el resultado."],
        testCases: [testCase()],
        client: "Laboratorio",
        payPotential: 100,
        state: "active",
        metadata: {
            requirementIds: ["REQ-1"]
        },
        ...overrides
    });
}

function activeLearningState() {
    const pending = addBrokerLearningContract(
        createBrokerGameState(),
        "lesson-001",
        {
            title: "Primer mensaje",
            description:
                "Mostrar un mensaje sencillo.",
            requirements: [
                "Mostrar el texto indicado."
            ],
            testCases: []
        },
        { createdAt: 1 }
    );

    return acceptBrokerContract(
        pending,
        pending.contracts[0].id,
        { acceptedAt: 2 }
    );
}

function testCase(overrides = {}) {
    return {
        id: "TC-1",
        kind: "normal",
        requirementIds: ["REQ-1"],
        stdin: "entrada-privada",
        expected: "oraculo-privado",
        comparison: BrokerTestComparison.EXACT,
        timeoutMs: 1_000,
        ...overrides
    };
}

function stateWithContract(contract) {
    return createBrokerGameState({
        revision: 9,
        activeContractId: contract.id,
        contracts: [contract],
        nextContractId: contract.id + 1
    });
}

function documentCapture() {
    return createBrokerClrsDocumentCapture({
        capturedAt: 1,
        document: {
            documentId: "file:///privado/solucion.clrs",
            name: "solucion.clrs",
            languageId: "clrs-es",
            version: 5
        },
        sourceCode: SOURCE,
        analysis: {
            ok: true,
            diagnostics: []
        },
        ast: null
    });
}

function testExecution(contract, capture, cases) {
    const summary = {
        total: cases.length,
        passed: cases.filter(
            item => item.status === "passed"
        ).length,
        failed: cases.filter(
            item => item.status === "failed"
        ).length,
        runtimeErrors: 0,
        timedOut: 0,
        outputLimited: 0,
        startFailed: 0,
        invalid: 0,
        notRun: cases.filter(
            item => item.status === "not-run"
        ).length
    };

    return Object.freeze({
        executionVersion: 1,
        status: "completed",
        contractId: contract.id,
        document: Object.freeze({
            name: capture.document.name,
            languageId: capture.document.languageId,
            version: capture.document.version,
            sourceHash: capture.sourceHash
        }),
        analysis: Object.freeze({
            status: "valid",
            diagnosticCount: 0,
            diagnostics: Object.freeze([])
        }),
        summary: Object.freeze(summary),
        testCases: Object.freeze(cases),
        elapsedMs: 3
    });
}

function resultCase(
    id,
    kind,
    requirementIds,
    status
) {
    return Object.freeze({
        id,
        kind,
        requirementIds: Object.freeze([
            ...requirementIds
        ]),
        comparison: "exact",
        status,
        reason: status === "passed"
            ? null
            : "exact-mismatch",
        stdout: "salida-real",
        stderr: "",
        exitCode: 0,
        signal: null,
        elapsedMs: 1
    });
}

function staticResult(capture) {
    return Object.freeze({
        evidenceVersion: 1,
        status: "complete",
        document: Object.freeze({
            name: capture.document.name,
            languageId: capture.document.languageId,
            version: capture.document.version,
            sourceHash: capture.sourceHash
        }),
        metrics: Object.freeze({
            functionCount: 1,
            globalVariableCount: 0,
            symbolCount: 1,
            unusedSymbolCount: 0,
            unusedVariableCount: 0,
            unusedParameterCount: 0,
            unusedFunctionCount: 0,
            statementCount: 1,
            assignmentCount: 0,
            decisionPointCount: 0,
            logicalConnectorCount: 0,
            loopCount: 0,
            returnCount: 0,
            readStatementCount: 0,
            inputValueCount: 0,
            writeStatementCount: 1,
            callSiteCount: 0,
            userCallEdgeCount: 0,
            cyclomaticComplexityTotal: 1,
            cyclomaticComplexityMaximum: 1,
            nestingDepthMaximum: 0,
            indexedAccessCount: 0,
            divisionCount: 0,
            unreachableStatementCount: 0
        }),
        findings: Object.freeze({
            totalCount: 0,
            truncated: false,
            items: Object.freeze([])
        })
    });
}

function readySnapshot() {
    return Object.freeze({
        settings: Object.freeze({
            model: "modelo-evaluador",
            hasApiKey: true
        }),
        llmStatus: Object.freeze({
            status: BrokerLlmStatus.READY,
            reason: BrokerLlmStatusReason.READY,
            message: "CIPHER está disponible."
        })
    });
}

function unavailableSnapshot() {
    return Object.freeze({
        settings: Object.freeze({
            model: "",
            hasApiKey: true
        }),
        llmStatus: Object.freeze({
            status: BrokerLlmStatus.UNCONFIGURED,
            reason:
                BrokerLlmStatusReason.MODEL_MISSING,
            message: "Falta el modelo."
        })
    });
}
