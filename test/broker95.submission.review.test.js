import assert from "node:assert/strict";
import test from "node:test";

import {
    BrokerLlmStatus,
    BrokerLlmStatusReason,
    BrokerLearningRouteId,
    BrokerLearningToolId,
    BrokerRisk,
    BrokerSubmissionAskService,
    BrokerSubmissionReviewService,
    BrokerTestComparison,
    acceptBrokerContract,
    addBrokerLearningContract,
    brokerLearningCatalog,
    createBrokerClrsDocumentCapture,
    createBrokerContract,
    createBrokerGameState,
    createBrokerLearningProgress,
    createBrokerLLMSystemInstruction,
    createBrokerLLMRequest,
    createInitialBrokerLearningRoutesProgress,
    createReviewSubmissionRequest,
    formatBrokerSubmissionAsk,
    formatBrokerSubmissionReview,
    replaceBrokerLearningRouteProgress,
    validateBrokerSubmissionReview
} from "../src/broker95/index.js";

const SOURCE = [
    "PRINCIPAL()",
    "    escribir 1"
].join("\n");

test("ai -ask comparte contrato, código y evidencia sin exigir JSON", async () => {
    const observed = {};
    const service = createAskService({
        state: stateWithContract(activeContract()),
        observed
    });
    const before = service.gameSession.getState();
    const result = await service.ask({
        requestId: "ask:test:1",
        question:
            "¿Por qué la salida no coincide?"
    });
    const request = observed.request;
    const protocolRequest =
        createBrokerLLMRequest(
            "askSubmission",
            request
        );
    const instruction =
        createBrokerLLMSystemInstruction(
            protocolRequest
        );

    assert.equal(
        request.input.question,
        "¿Por qué la salida no coincide?"
    );
    assert.equal(
        request.input.submission.sourceCode,
        SOURCE
    );
    assert.equal(
        request.input.contract.testCases[0].id,
        "TC-1"
    );
    assert.equal(
        request.input.deterministicEvidence
            .tests.summary.failed,
        1
    );
    assert.equal(protocolRequest.responseFormat, "text");
    assert.equal(protocolRequest.stream, false);
    assert.match(instruction, /natural Spanish plain text/u);
    assert.doesNotMatch(instruction, /valid JSON object/u);
    assert.equal(
        JSON.stringify(request).includes(
            "entrada-privada"
        ),
        false
    );
    assert.equal(
        JSON.stringify(request).includes(
            "oraculo-privado"
        ),
        false
    );
    assert.equal(result.answer.includes("F-COR"), true);
    assert.equal(service.gameSession.getState(), before);
});

test("ai -ask sin pregunta solicita una oferta cercana de ayuda", async () => {
    const observed = {};
    const result = await createAskService({
        state: stateWithContract(activeContract()),
        observed
    }).ask({
        requestId: "ask:test:empty"
    });
    const protocolRequest = createBrokerLLMRequest(
        "askSubmission",
        observed.request
    );
    const instruction = createBrokerLLMSystemInstruction(
        protocolRequest
    );

    assert.equal(observed.request.input.question, null);
    assert.equal(
        observed.request.context.tutor.directQuestion,
        false
    );
    assert.match(instruction, /did not write a question/u);
    assert.match(result.answer, /¿Todo va bien/u);
    assert.match(
        formatBrokerSubmissionAsk(result),
        /CIPHER \/\/ CONSULTA/u
    );
});

test("ai -ask conserva la frontera curricular del contrato educativo", async () => {
    const observed = {};

    await createAskService({
        state: activeLearningState(),
        observed
    }).ask({
        requestId: "ask:learning:1",
        question: "¿Cómo puedo empezar?"
    });

    assert.equal(
        observed.request.context.pedagogy.mode,
        "open-tutor"
    );
    assert.equal(
        observed.request.context.pedagogy
            .lesson.lessonId,
        "lesson-001"
    );
    assert.deepEqual(
        observed.request.context.pedagogy
            .accumulatedKnowledge,
        brokerLearningCatalog
            .getAccumulatedKnowledge("lesson-001")
    );
    assert.equal(
        observed.request.context.constraints
            .noFutureKnowledge,
        true
    );
});

test("ai -review combina una sola captura, pruebas y evidencia sin mutar la partida", async () => {
    const contract = activeContract();
    const state = stateWithContract(contract);
    const capture = documentCapture();
    const observed = {
        capture: 0,
        staticCapture: null,
        testCapture: null,
        request: null,
        execution: null
    };
    const service = createReviewService({
        state,
        capture,
        observed
    });
    const before = service.gameSession.getState();
    const result = await service.review({
        requestId: "review:test"
    });

    assert.equal(result.contractId, contract.id);
    assert.equal(result.review.readiness, "needs-changes");
    assert.equal(result.review.findings[0].criterion, "F-COR");
    assert.equal(observed.capture, 1);
    assert.equal(observed.staticCapture, capture);
    assert.equal(observed.testCapture, capture);
    assert.equal(service.gameSession.getState(), before);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.review), true);
    const request = observed.request;
    const serialized = JSON.stringify(request);

    assert.equal(request.requestId, "review:test");
    assert.equal(request.stream, false);
    assert.equal(
        request.input.submission.sourceCode,
        SOURCE
    );
    assert.equal(
        Object.hasOwn(
            request.input.submission.document,
            "documentId"
        ),
        false
    );
    assert.deepEqual(
        request.input.responseShape
            .findings.criteria,
        ["F-CUM", "F-COR", "F-LIM"]
    );
    assert.equal(
        request.context.constraints
            .noEfficiencyDimension,
        true
    );
    assert.equal(serialized.includes("entrada-privada"), false);
    assert.equal(serialized.includes("oraculo-privado"), false);
    assert.equal(serialized.includes("file:///privado"), false);
    assert.equal(serialized.includes("salida-real"), true);
    assert.equal(
        Object.hasOwn(request.context, "pedagogy"),
        false
    );
});

test("ai -review deriva una tutoría de principiante desde la lección activa", async () => {
    const observed = {};
    const state = activeLearningState();
    const service = createReviewService({
        state,
        observed
    });
    const result = await service.review({
        requestId: "review:learning:1"
    });
    const request = observed.request;
    const pedagogy = request.context.pedagogy;

    assert.deepEqual(
        request.context.review.activeDimensions,
        ["functionality"]
    );
    assert.deepEqual(
        request.input.responseShape
            .findings.criteria,
        ["F-CUM", "F-COR", "F-LIM"]
    );
    assert.equal(
        request.context.constraints
            .functionalityOnly,
        true
    );
    assert.equal(
        request.context.constraints
            .noFutureKnowledge,
        true
    );
    assert.equal(pedagogy.mode, "guided-beginner");
    assert.equal(
        pedagogy.lesson.lessonId,
        "lesson-001"
    );
    assert.equal(
        pedagogy.lesson.objective,
        brokerLearningCatalog
            .requireLesson("lesson-001")
            .objective
    );
    assert.deepEqual(
        pedagogy.accumulatedKnowledge,
        brokerLearningCatalog
            .getAccumulatedKnowledge(
                "lesson-001"
            )
    );
    assert.equal(
        pedagogy.feedback.explainSimply,
        true
    );
    assert.equal(
        pedagogy.feedback.preferHints,
        true
    );
    assert.equal(
        pedagogy.feedback.algorithmicReasoning,
        false
    );
    assert.equal(pedagogy.algorithmicReview, null);
    assert.deepEqual(
        pedagogy.prerequisiteKnowledge,
        []
    );
    assert.deepEqual(pedagogy.optionalTools, []);
    assert.equal(
        JSON.stringify(request)
            .includes("baseReward"),
        false
    );
    assert.equal(result.provider.attempts, 1);

    const instruction =
        createBrokerLLMSystemInstruction(
            createReviewSubmissionRequest(
                request
            )
        );

    assert.match(
        instruction,
        /beginning student/u
    );
    assert.match(
        instruction,
        /Functionality only/u
    );
    assert.match(
        instruction,
        /accumulatedKnowledge/u
    );
    assert.match(
        instruction,
        /without writing the complete program/u
    );
});

test("ai -review de Algoritmia conserva objetivo, condiciones, paradigma y conceptos bloqueados", async () => {
    const catalogs = routeCatalogs();
    const observed = {};
    const state = activeAlgorithmsLearningState(
        catalogs
    );
    const result = await createReviewService({
        state,
        catalogs,
        observed,
        llm: {
            async reviewSubmission(request) {
                observed.request = request;

                return {
                    output: {
                        ...reviewOutput(),
                        findings: [{
                            ...reviewOutput().findings[0],
                            recommendation:
                                "Puedes usar Step Into si te ayuda a observar cada paso."
                        }]
                    },
                    model: request.model,
                    responseId:
                        "response:algorithms-review",
                    finishReason: "stop",
                    usage: null
                };
            }
        }
    }).review({
        requestId: "review:algorithms:1"
    });
    const pedagogy =
        observed.request.context.pedagogy;

    assert.equal(
        pedagogy.learningRouteId,
        BrokerLearningRouteId.ALGORITHMS
    );
    assert.equal(
        pedagogy.feedback.algorithmicReasoning,
        true
    );
    assert.equal(
        pedagogy.algorithmicReview.objective,
        algorithmsCatalog().requireLesson(
            "algorithm-lesson-001"
        ).objective
    );
    assert.deepEqual(
        pedagogy.algorithmicReview
            .relevantPreconditions,
        ["identificar precondiciones sencillas"]
    );
    assert.deepEqual(
        pedagogy.algorithmicReview
            .relevantPostconditions,
        ["verificar postcondiciones observables"]
    );
    assert.deepEqual(
        pedagogy.algorithmicReview
            .studiedParadigms,
        [
            "Implementar una secuencia observable con fuerza bruta.",
            "aplicar el paradigma de fuerza bruta"
        ]
    );
    assert.deepEqual(
        pedagogy.algorithmicReview
            .blockedConcepts,
        [
            "aplicar divide y conquista",
            "analizar recurrencias"
        ]
    );
    assert.equal(
        pedagogy.prerequisiteKnowledge[0]
            .learningRouteId,
        BrokerLearningRouteId.PROGRAMMING
    );
    assert.deepEqual(
        pedagogy.optionalTools.map(tool => tool.id),
        [BrokerLearningToolId.DEBUGGER]
    );
    assert.equal(
        pedagogy.toolPolicy.evaluationImpact,
        "none"
    );
    assert.equal(result.provider.attempts, 1);

    const instruction =
        createBrokerLLMSystemInstruction(
            createReviewSubmissionRequest(
                observed.request
            )
        );

    assert.match(instruction, /Algorithms route/u);
    assert.match(
        instruction,
        /relevantPreconditions/u
    );
    assert.match(
        instruction,
        /studiedParadigms/u
    );
    assert.match(
        instruction,
        /optional formative help only/u
    );
});

test("ai -review de aprendizaje repara herramientas obligatorias o no recomendadas", async () => {
    const catalogs = routeCatalogs();
    const invalidOutputs = [
        {
            ...reviewOutput(),
            findings: [{
                ...reviewOutput().findings[0],
                recommendation:
                    "Debes usar Step Into para aprobar."
            }]
        },
        {
            ...reviewOutput(),
            findings: [{
                ...reviewOutput().findings[0],
                recommendation:
                    "Puedes usar el informe de complejidad si te ayuda."
            }]
        }
    ];

    for (const [index, invalidOutput] of
        invalidOutputs.entries()) {
        const requests = [];
        const responses = [
            invalidOutput,
            reviewOutput()
        ];
        const result = await createReviewService({
            state:
                activeAlgorithmsLearningState(
                    catalogs
                ),
            catalogs,
            llm: {
                async reviewSubmission(request) {
                    requests.push(request);

                    return {
                        output: responses.shift(),
                        model: request.model,
                        responseId:
                            `response:tool-policy:${index}:${requests.length}`,
                        finishReason: "stop",
                        usage: null
                    };
                }
            }
        }).review({
            requestId: `review:tool-policy:${index}`
        });

        assert.equal(requests.length, 2);
        assert.equal(
            requests[1].input.repair
                .validationCode,
            index === 0
                ? "BROKER95_LEARNING_REVIEW_TOOL_NOT_OPTIONAL"
                : "BROKER95_LEARNING_REVIEW_TOOL_NOT_RECOMMENDED"
        );
        assert.equal(result.provider.repaired, true);
    }
});

test("ai -review repara recomendaciones que exigen conocimientos futuros", async () => {
    const requests = [];
    const responses = [
        {
            ...reviewOutput(),
            findings: [{
                ...reviewOutput().findings[0],
                recommendation:
                    "Crea una función recursiva para resolverlo."
            }],
            nextSteps: [
                "Implementa la recursión y vuelve a revisar."
            ]
        },
        reviewOutput()
    ];
    const result = await createReviewService({
        state: activeLearningState(),
        llm: {
            async reviewSubmission(request) {
                requests.push(request);

                return {
                    output: responses.shift(),
                    model: request.model,
                    responseId:
                        `response:learning-review:${requests.length}`,
                    finishReason: "stop",
                    usage: null
                };
            }
        }
    }).review({
        requestId: "review:learning:repair"
    });

    assert.equal(requests.length, 2);
    assert.equal(
        requests[1].input.repair.validationCode,
        "BROKER95_LEARNING_REVIEW_FUTURE_KNOWLEDGE"
    );
    assert.deepEqual(
        requests[1].context.pedagogy,
        requests[0].context.pedagogy
    );
    assert.equal(result.provider.repaired, true);
    assert.equal(
        result.review.findings[0].recommendation,
        reviewOutput().findings[0].recommendation
    );
});

test("una review correlacionada comparte captura, pruebas y llamada a CIPHER", async () => {
    const observed = {};
    const service = createReviewService({
        state: stateWithContract(
            activeContract()
        ),
        observed
    });
    const options = {
        requestId: "review:idempotent:1"
    };
    const [first, duplicate] =
        await Promise.all([
            service.review(options),
            service.review(options)
        ]);

    assert.equal(first, duplicate);
    assert.equal(observed.capture, 1);
    assert.equal(observed.llmCalls, 1);
    assert.equal(
        await service.review(options),
        first
    );
    assert.equal(observed.capture, 1);
    assert.equal(observed.llmCalls, 1);
});

test("ai -review propaga el selector normalizado a una sola captura documental", async () => {
    const observed = {};
    const service = createReviewService({
        state: stateWithContract(
            activeContract()
        ),
        observed
    });

    await service.review({
        requestId: "review:selected:1",
        documentSelector:
            "  Curso Uno/tareas/solucion.clrs  "
    });

    assert.equal(observed.capture, 1);
    assert.equal(
        observed.documentSelector,
        "Curso Uno/tareas/solucion.clrs"
    );
});

test("ai -review repara una respuesta de CIPHER una sola vez", async () => {
    const requests = [];
    const responses = [
        {
            ...reviewOutput(),
            score: 100
        },
        reviewOutput()
    ];
    const llm = {
        async reviewSubmission(request) {
            requests.push(request);

            return {
                output: responses.shift(),
                model: request.model,
                responseId:
                    `response:review:${requests.length}`,
                finishReason: "stop",
                usage: null
            };
        }
    };
    const result = await createReviewService({
        state: stateWithContract(
            activeContract()
        ),
        llm
    }).review({
        requestId: "review:repair:1"
    });

    assert.equal(requests.length, 2);
    assert.equal(
        requests[1].input.repair.validationCode,
        "BROKER95_REVIEW_RESPONSE_FIELDS_INVALID"
    );
    assert.equal(
        requests[1].input.repair
            .previousResponse.score,
        100
    );
    assert.equal(result.provider.attempts, 2);
    assert.equal(result.provider.repaired, true);
    assert.equal(result.review.readiness, "needs-changes");
});

test("rechaza respuestas abiertas o criterios inactivos del LLM", () => {
    const valid = reviewOutput();

    assert.throws(
        () => validateBrokerSubmissionReview(
            {
                ...valid,
                score: 100
            },
            { activeDimensions: ["functionality"] }
        ),
        error => error.code ===
            "BROKER95_REVIEW_RESPONSE_FIELDS_INVALID"
    );
    assert.throws(
        () => validateBrokerSubmissionReview(
            {
                ...valid,
                findings: [{
                    ...valid.findings[0],
                    criterion: "D-MOD"
                }]
            },
            { activeDimensions: ["functionality"] }
        ),
        error => error.code ===
            "BROKER95_REVIEW_FINDING_CRITERION_INACTIVE"
    );
});

test("exige contrato activo y CIPHER disponible antes de capturar o ejecutar", async () => {
    const inactiveObserved = { capture: 0 };
    const withoutContract = createReviewService({
        state: createBrokerGameState(),
        observed: inactiveObserved
    });

    await assert.rejects(
        () => withoutContract.review(),
        error => error.code ===
            "BROKER95_REVIEW_ACTIVE_CONTRACT_REQUIRED"
    );
    assert.equal(inactiveObserved.capture, 0);

    const unavailableObserved = { capture: 0 };
    const unavailable = createReviewService({
        state: stateWithContract(activeContract()),
        availability: unavailableSnapshot(),
        observed: unavailableObserved
    });

    await assert.rejects(
        () => unavailable.review(),
        error => error.code ===
            "BROKER95_LLM_MODEL_MISSING"
    );
    assert.equal(unavailableObserved.capture, 0);
});

test("presenta una tutoría legible sin filtrar la evidencia privada", () => {
    const text = formatBrokerSubmissionReview({
        deterministicEvidence: {
            testSummary: testExecution(
                activeContract(),
                documentCapture()
            ).summary
        },
        review: {
            ...reviewOutput(),
            reviewVersion: 1
        }
    });

    assert.match(text, /REVISIÓN NO DEFINITIVA/u);
    assert.match(text, /Pruebas: 0\/1 superadas/u);
    assert.match(text, /F-COR/u);
    assert.match(text, /Recomendación:/u);
    assert.equal(text.includes("entrada-privada"), false);
    assert.equal(text.includes("oraculo-privado"), false);
});

function createAskService({
    state,
    capture = documentCapture(),
    availability = readySnapshot(),
    observed = {},
    catalogs
}) {
    observed.capture ??= 0;
    const gameSession = {
        state,
        async initialize() {},
        getState() {
            return this.state;
        }
    };
    const contract = state.contracts.find(
        item => item.id === state.activeContractId
    );
    const service = new BrokerSubmissionAskService({
        gameSession,
        availability: {
            getSnapshot() {
                return availability;
            }
        },
        llm: {
            async askSubmission(request, execution) {
                observed.request = request;
                observed.execution = execution;
                return {
                    output: request.input.question == null
                        ? `¿Todo va bien con ${contract.title}? Puedo ayudarte con el contrato o con tu código.`
                        : "La evidencia F-COR indica que la salida observada no coincide. Revisa el valor que escribes.",
                    model: request.model,
                    providerId: "test",
                    responseId: "response:ask",
                    finishReason: "stop",
                    usage: null
                };
            }
        },
        documentCapture: {
            capture() {
                observed.capture += 1;
                return capture;
            },
            async captureSelected(selector) {
                observed.capture += 1;
                observed.documentSelector = selector;
                return capture;
            }
        },
        staticEvidence: {
            collectCapture(value) {
                return staticResult(value);
            }
        },
        testExecution: {
            async executeContractCapture(
                selected,
                value
            ) {
                return testExecution(
                    selected,
                    value
                );
            }
        },
        catalogs
    });

    service.gameSession = gameSession;
    return service;
}

test("review: un runtime GUI no preparado no se atribuye al estudiante ni se envía a CIPHER", async () => {
    const observed = {};
    const service = createReviewService({ state: stateWithContract(activeContract()), observed });
    const before = service.gameSession.getState();
    service.testExecution = { async executeContractCapture() {
        return { testCases: [{ reason: "runtime-preparation-failed" }] };
    } };
    await assert.rejects(service.review({ requestId: "review:gui-failed" }),
        error => error.code === "BROKER95_TEST_EXECUTION_GENERATION_FAILED");
    assert.equal(observed.request, undefined);
    assert.equal(service.gameSession.getState(), before);
});

function createReviewService({
    state,
    capture = documentCapture(),
    availability = readySnapshot(),
    llm = null,
    observed = {},
    catalogs
}) {
    observed.capture ??= 0;
    const gameSession = {
        state,
        async initialize() {},
        getState() {
            return this.state;
        }
    };
    const contract = state.contracts?.find(
        item => item.id === state.activeContractId
    ) ?? activeContract();
    const tests = testExecution(contract, capture);
    const staticEvidence = staticResult(capture);
    const service = new BrokerSubmissionReviewService({
        gameSession,
        availability: {
            getSnapshot() {
                return availability;
            }
        },
        llm: llm ?? {
            async reviewSubmission(request, execution) {
                observed.llmCalls =
                    (observed.llmCalls ?? 0) + 1;
                observed.request = request;
                observed.execution = execution;
                return {
                    output: reviewOutput(),
                    model: request.model,
                    responseId: "response:review",
                    finishReason: "stop",
                    usage: {
                        inputTokens: 10,
                        outputTokens: 5,
                        totalTokens: 15
                    }
                };
            }
        },
        documentCapture: {
            capture() {
                observed.capture += 1;
                return capture;
            },
            async captureSelected(selector) {
                observed.capture += 1;
                observed.documentSelector = selector;
                return capture;
            }
        },
        staticEvidence: {
            collectCapture(value) {
                observed.staticCapture = value;
                return staticEvidence;
            }
        },
        testExecution: {
            async executeContractCapture(
                selected,
                value
            ) {
                assert.equal(selected, contract);
                observed.testCapture = value;
                return tests;
            }
        },
        createRequestId() {
            return "review:generated";
        },
        catalogs
    });

    service.gameSession = gameSession;
    return service;
}

function reviewOutput() {
    return {
        summary:
            "La estructura es válida, pero la salida aún no satisface el contrato.",
        readiness: "needs-changes",
        findings: [{
            severity: "important",
            criterion: "F-COR",
            location: "función PRINCIPAL",
            problem:
                "La salida observada no coincide con el comportamiento solicitado.",
            evidence:
                "El caso TC-1 terminó sin superar la comparación.",
            recommendation:
                "Revisa el valor producido para la entrada normal."
        }],
        nextSteps: [
            "Corrige el cálculo y vuelve a ejecutar ai -review."
        ]
    };
}

function activeContract() {
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
        testCases: [{
            id: "TC-1",
            kind: "normal",
            requirementIds: ["REQ-1"],
            stdin: "entrada-privada",
            expected: "oraculo-privado",
            comparison: BrokerTestComparison.EXACT,
            timeoutMs: 1_000
        }],
        client: "Laboratorio",
        payPotential: 100,
        state: "active",
        metadata: {
            requirementIds: ["REQ-1"]
        }
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
            testCases: [{
                id: "TC-LEARNING",
                kind: "normal",
                requirementIds: ["REQ-1"],
                explanation:
                    "Debe mostrar exactamente el mensaje solicitado.",
                stdin: "",
                expected: "HOLA",
                comparison:
                    BrokerTestComparison.EXACT,
                timeoutMs: 1_000
            }]
        }
    );

    return acceptBrokerContract(
        pending,
        pending.contracts[0].id,
        { acceptedAt: 2 }
    );
}

function activeAlgorithmsLearningState(catalogs) {
    const initialRoutes =
        createInitialBrokerLearningRoutesProgress({
            catalogs
        });
    const completedProgramming =
        completedProgrammingProgress();
    const learningProgress =
        replaceBrokerLearningRouteProgress(
            initialRoutes,
            BrokerLearningRouteId.PROGRAMMING,
            completedProgramming,
            { catalogs }
        );
    const initialState = createBrokerGameState(
        { learningProgress },
        { catalogs }
    );
    const pending = addBrokerLearningContract(
        initialState,
        "algorithm-lesson-001",
        {
            title: "Pasos verificables",
            description:
                "Aplicar pasos ordenados y verificables.",
            requirements: [
                "Producir el resultado solicitado."
            ],
            testCases: [{
                id: "TC-ALGORITHM",
                kind: "normal",
                requirementIds: ["REQ-1"],
                explanation:
                    "Comprueba el resultado del algoritmo.",
                stdin: "3",
                expected: "6",
                comparison:
                    BrokerTestComparison.EXACT,
                timeoutMs: 1_000
            }]
        },
        {
            routeId:
                BrokerLearningRouteId.ALGORITHMS,
            catalogs,
            createdAt: 1
        }
    );

    return acceptBrokerContract(
        pending,
        pending.contracts[0].id,
        { acceptedAt: 2, catalogs }
    );
}

function completedProgrammingProgress() {
    const lessons =
        brokerLearningCatalog.listLessons();

    return createBrokerLearningProgress({
        revision: lessons.length,
        completedLessonIds:
            lessons.map(lesson => lesson.id),
        lessonAttempts: Object.fromEntries(
            lessons.map(lesson => [
                lesson.id,
                {
                    lessonId: lesson.id,
                    attempts: 1,
                    firstCompletionScore: 100,
                    bestScore: 100,
                    completedAt:
                        `completed-${lesson.id}`
                }
            ])
        ),
        learningStartedAt: "started",
        learningCompletedAt: "completed"
    });
}

function routeCatalogs() {
    return Object.freeze({
        [BrokerLearningRouteId.PROGRAMMING]:
            brokerLearningCatalog,
        [BrokerLearningRouteId.ALGORITHMS]:
            algorithmsCatalog()
    });
}

function algorithmsCatalog() {
    const lessons = Object.freeze([
        Object.freeze({
            id: "algorithm-lesson-001",
            sectionId:
                "algorithm-section-001",
            order: 1,
            title: "Razonamiento verificable",
            objective:
                "Construir un algoritmo sencillo con condiciones verificables.",
            expectedContract:
                "Implementar una secuencia observable con fuerza bruta.",
            introducedKnowledge: Object.freeze([
                "identificar precondiciones sencillas",
                "verificar postcondiciones observables",
                "aplicar el paradigma de fuerza bruta"
            ]),
            recommendedTools: Object.freeze([
                BrokerLearningToolId.DEBUGGER
            ]),
            familyId: "FND",
            categoryId: "FND-ALG",
            baseReward: 100
        }),
        Object.freeze({
            id: "algorithm-lesson-002",
            sectionId:
                "algorithm-section-001",
            order: 2,
            title: "Dividir el problema",
            objective:
                "Reconocer una reducción recursiva.",
            expectedContract:
                "Resolver un caso guiado mediante subproblemas.",
            introducedKnowledge: Object.freeze([
                "aplicar divide y conquista",
                "analizar recurrencias"
            ]),
            recommendedTools: Object.freeze([]),
            familyId: "FND",
            categoryId: "FND-ALG",
            baseReward: 120
        })
    ]);
    const sections = Object.freeze([
        Object.freeze({
            id: "algorithm-section-001",
            order: 1,
            title: "Fundamentos de algoritmia",
            lessonIds: Object.freeze(
                lessons.map(lesson => lesson.id)
            )
        })
    ]);

    return Object.freeze({
        lessonCount: lessons.length,
        requireLesson(lessonId) {
            const lesson = lessons.find(
                item => item.id === lessonId
            );

            if (lesson == null) {
                throw new Error(
                    "Unknown algorithms lesson."
                );
            }

            return lesson;
        },
        listLessons() {
            return lessons;
        },
        listSections() {
            return sections;
        },
        getAccumulatedKnowledge(lessonId) {
            const lesson = this.requireLesson(
                lessonId
            );

            return Object.freeze(
                lessons
                    .filter(item =>
                        item.order <= lesson.order
                    )
                    .flatMap(item =>
                        item.introducedKnowledge
                    )
            );
        }
    });
}

function stateWithContract(contract) {
    return createBrokerGameState({
        revision: 7,
        activeContractId: contract.id,
        contracts: [contract],
        nextContractId: contract.id + 1
    });
}

function documentCapture() {
    return createBrokerClrsDocumentCapture({
        capturedAt: 1,
        document: {
            documentId: "file:///privado/actual.clrs",
            name: "actual.clrs",
            languageId: "clrs-es",
            version: 3
        },
        sourceCode: SOURCE,
        analysis: {
            ok: true,
            diagnostics: []
        },
        ast: null
    });
}

function testExecution(contract, capture) {
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
        summary: Object.freeze({
            total: 1,
            passed: 0,
            failed: 1,
            runtimeErrors: 0,
            timedOut: 0,
            outputLimited: 0,
            startFailed: 0,
            invalid: 0,
            notRun: 0
        }),
        testCases: Object.freeze([Object.freeze({
            id: "TC-1",
            kind: "normal",
            requirementIds: Object.freeze(["REQ-1"]),
            comparison: "exact",
            status: "failed",
            reason: "output-mismatch",
            stdout: "salida-real",
            stderr: "",
            exitCode: 0,
            signal: null,
            elapsedMs: 2
        })]),
        elapsedMs: 2
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
            cyclomaticComplexityMaximum: 1
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
            model: "modelo-revision",
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
