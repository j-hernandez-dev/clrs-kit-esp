import assert from "node:assert/strict";
import test from "node:test";

import {
    BrokerContractState,
    BrokerGamePersistenceError,
    BrokerRisk,
    BrokerSubmissionPushService,
    BrokerTestComparison,
    acceptBrokerContract,
    addBrokerContract,
    addBrokerLearningContract,
    createBrokerClrsDocumentCapture,
    createBrokerGameState,
    formatBrokerSubmissionPush,
    settleBrokerContract
} from "../src/broker95/index.js";
import {
    activateAlgorithmsLesson,
    completeActiveAlgorithmsLesson,
    createAlgorithmsLearningCatalogsFixture,
    createUnlockedAlgorithmsGameState
} from "./fixtures/broker95-algorithms-learning-fixture.js";

const SOURCE = [
    "PRINCIPAL()",
    "    escribir 42"
].join("\n");

test("ai -push liquida una evaluación exacta una sola vez y actualiza la partida", async () => {
    const session = createSession(activeState());
    const capture = documentCapture();
    const observed = {};
    const service = createPushService({
        session,
        captures: [capture, capture],
        observed,
        score: 85
    });
    const result = await service.push({
        requestId: "request:push"
    });
    const state = session.getState();

    assert.equal(observed.capture, capture);
    assert.equal(observed.requestId, "request:push");
    assert.equal(result.finalScore, 85);
    assert.equal(result.contract.completed, true);
    assert.equal(result.contract.payout, 90);
    assert.equal(result.contract.payoutMultiplier, 0.9);
    assert.equal(result.settlement.money, 90);
    assert.equal(result.settlement.performed, true);
    assert.equal(state.activeContractId, null);
    assert.equal(state.money, 90);
    assert.equal(state.statistics.completed, 1);
    assert.equal(result.learning, null);
    assert.deepEqual(state.completedContractIds, [1]);
    assert.equal(
        state.contracts[0].state,
        BrokerContractState.COMPLETED
    );
    assert.equal(
        state.contracts[0].evaluation.finalScore,
        85
    );

    await assert.rejects(
        () => service.push(),
        error => error.code ===
            "BROKER95_PUSH_ACTIVE_CONTRACT_REQUIRED"
    );
    assert.equal(session.getState().money, 90);
});

test("un push correlacionado comparte evaluación y liquidación sin pagar dos veces", async () => {
    const session = createSession(activeState());
    const capture = documentCapture();
    const observed = {};
    const service = createPushService({
        session,
        captures: [capture, capture],
        observed,
        score: 85
    });
    const options = {
        requestId: "push:idempotent:1"
    };
    const [first, duplicate] =
        await Promise.all([
            service.push(options),
            service.push(options)
        ]);

    assert.equal(first, duplicate);
    assert.equal(observed.evaluationCalls, 1);
    assert.equal(session.getState().money, 90);
    assert.equal(
        session.getState().statistics.completed,
        1
    );
    assert.equal(
        await service.push(options),
        first
    );
    assert.equal(observed.evaluationCalls, 1);
    assert.equal(session.getState().money, 90);
});

test("ai -push propaga el selector y recaptura exactamente el documento evaluado", async () => {
    const session = createSession(activeState());
    const capture = documentCapture({
        documentId:
            "file:///workspace/Practicas/final.clrs"
    });
    const observed = {};
    const service = createPushService({
        session,
        captures: [capture, capture],
        observed
    });

    await service.push({
        requestId: "push:selected:1",
        documentSelector: " Practicas/final.clrs "
    });

    assert.equal(
        observed.documentSelector,
        "Practicas/final.clrs"
    );
    assert.deepEqual(observed.recaptureIds, [
        capture.document.documentId
    ]);
    assert.equal(observed.capture, capture);
});

test("una calificación menor que 60 cierra el contrato sin paga", async () => {
    const session = createSession(activeState());
    const capture = documentCapture();
    const result = await createPushService({
        session,
        captures: [capture, capture],
        score: 59
    }).push();

    assert.equal(result.contract.completed, false);
    assert.equal(result.contract.state, "failed");
    assert.equal(result.contract.payout, 0);
    assert.equal(result.settlement.money, 0);
    assert.equal(session.getState().statistics.failed, 1);
    assert.deepEqual(
        session.getState().failedContractIds,
        [1]
    );
});

test("un documento modificado durante la evaluación no liquida el contrato", async () => {
    const initial = documentCapture();
    const changed = documentCapture({
        version: 6,
        sourceCode: `${SOURCE}\n// cambio tardío`
    });
    const session = createSession(activeState());
    const before = session.getState();
    const service = createPushService({
        session,
        captures: [initial, changed]
    });

    await assert.rejects(
        () => service.push(),
        error => error.code ===
            "BROKER95_PUSH_DOCUMENT_CHANGED"
    );
    assert.equal(session.getState(), before);
    assert.equal(session.getState().activeContractId, 1);
    assert.equal(session.getState().money, 0);
});

test("una revisión de partida obsoleta o un fallo de CIPHER no produce pago parcial", async () => {
    const capture = documentCapture();
    const staleSession = createSession(activeState());
    const stale = createPushService({
        session: staleSession,
        captures: [capture],
        stateRevision: staleSession.getState().revision - 1
    });

    await assert.rejects(
        () => stale.push(),
        error => error.code ===
            "BROKER95_SESSION_REVISION_CONFLICT"
    );
    assert.equal(staleSession.getState().money, 0);
    assert.equal(staleSession.getState().activeContractId, 1);

    const failedSession = createSession(activeState());
    const failed = new BrokerSubmissionPushService({
        gameSession: failedSession,
        documentCapture: {
            capture() {
                return capture;
            }
        },
        evaluation: {
            async evaluateCapture() {
                throw new Error("provider unavailable");
            }
        }
    });
    const before = failedSession.getState();

    await assert.rejects(() => failed.push());
    assert.equal(failedSession.getState(), before);
});

test("presenta la evaluación definitiva sin incluir oráculos privados", async () => {
    const capture = documentCapture();
    const result = await createPushService({
        session: createSession(activeState()),
        captures: [capture, capture],
        score: 85
    }).push();
    const formatted = formatBrokerSubmissionPush(result);

    assert.match(formatted, /ENTREGA DEFINITIVA/u);
    assert.match(formatted, /Calificación final: 85\/100/u);
    assert.match(formatted, /Paga recibida: USD 90/u);
    assert.match(formatted, /F-COR Corrección: 85\/100/u);
    assert.match(formatted, /Justificación: Puntuación justificada/u);
    assert.match(formatted, /contrato quedó cerrado/u);
    assert.equal(formatted.includes("oráculo-privado"), false);
    assert.equal(formatted.includes(capture.sourceHash), false);
});

test("ai -push informa el porcentaje educativo según la calificación", async () => {
    const session = createSession(
        activeLearningState()
    );
    const capture = documentCapture();
    const result = await createPushService({
        session,
        captures: [capture, capture],
        score: 60
    }).push();

    assert.equal(result.contract.completed, true);
    assert.equal(result.contract.payPotential, 10);
    assert.equal(result.contract.payout, 5);
    assert.equal(result.contract.payoutMultiplier, 0.5);
    assert.equal(result.settlement.money, 5);
    assert.equal(result.learning.passed, true);
    assert.equal(result.learning.firstCompletion, true);
    assert.equal(result.learning.progressAdvanced, true);
    assert.equal(result.learning.repetition, false);
    assert.equal(result.learning.previousBestScore, null);
    assert.equal(result.learning.bestScore, 60);
    assert.equal(result.learning.completedLessons, 1);
    assert.equal(result.learning.totalLessons, 50);
    assert.equal(
        result.learning.currentLessonId,
        "lesson-002"
    );
    assert.deepEqual(result.learning.reward, {
        baseReward: 10,
        payPotential: 10,
        payout: 5,
        scorePercentage: 50,
        paidPercentage: 50,
        earnedToDate: 5,
        policy: "score-percentage"
    });
    assert.deepEqual(
        session.getState()
            .learningProgress.routes.programming
            .completedLessonIds,
        ["lesson-001"]
    );
    assert.equal(
        session.getState()
            .learningProgress.routes.programming
            .currentLessonId,
        "lesson-002"
    );

    const formatted =
        formatBrokerSubmissionPush(result);

    assert.match(
        formatted,
        /Resultado: LECCIÓN COMPLETADA/u
    );
    assert.match(
        formatted,
        /Ruta: 1\/50 lecciones completadas/u
    );
    assert.match(
        formatted,
        /Siguiente lección: lesson-002/u
    );
});

test("ai -push fallido libera la lección sin paga, progreso ni desbloqueo", async () => {
    const session = createSession(
        activeLearningState()
    );
    const capture = documentCapture();
    const result = await createPushService({
        session,
        captures: [capture, capture],
        score: 59
    }).push();
    const progress = session.getState()
        .learningProgress.routes.programming;

    assert.equal(result.contract.completed, false);
    assert.equal(result.contract.payout, 0);
    assert.equal(result.learning.passed, false);
    assert.equal(result.learning.firstCompletion, false);
    assert.equal(result.learning.progressAdvanced, false);
    assert.equal(result.learning.lessonCompleted, false);
    assert.equal(result.learning.bestScore, null);
    assert.equal(result.learning.currentLessonId, "lesson-001");
    assert.equal(result.learning.completedLessons, 0);
    assert.deepEqual(
        progress.completedLessonIds,
        []
    );
    assert.deepEqual(
        progress.lessonContractLinks,
        {}
    );
    assert.equal(
        progress.lessonAttempts["lesson-001"]
            .attempts,
        1
    );
    assert.match(
        formatBrokerSubmissionPush(result),
        /INTENTO NO APROBADO · LA LECCIÓN SIGUE DISPONIBLE/u
    );
});

test("una repetición paga sólo la mejora y nunca vuelve a avanzar la ruta", async () => {
    const session = createSession(
        activeLearningRepetitionState(60)
    );
    const capture = documentCapture();
    const result = await createPushService({
        session,
        captures: [capture, capture],
        score: 80
    }).push();

    assert.equal(result.contract.id, 2);
    assert.equal(result.contract.payout, 4);
    assert.equal(result.contract.payoutMultiplier, 0.4);
    assert.equal(result.settlement.money, 9);
    assert.equal(result.learning.repetition, true);
    assert.equal(result.learning.firstCompletion, false);
    assert.equal(result.learning.progressAdvanced, false);
    assert.equal(result.learning.previousBestScore, 60);
    assert.equal(result.learning.bestScore, 80);
    assert.equal(result.learning.currentLessonId, "lesson-002");
    assert.equal(result.learning.completedLessons, 1);
    assert.deepEqual(result.learning.reward, {
        baseReward: 10,
        payPotential: 10,
        payout: 4,
        scorePercentage: 90,
        paidPercentage: 40,
        earnedToDate: 9,
        policy: "best-score-improvement"
    });
    assert.match(
        formatBrokerSubmissionPush(result),
        /Resultado: REPETICIÓN APROBADA/u
    );
});

test("ai -push aprueba Algoritmia, paga y desbloquea sólo su siguiente lección", async () => {
    const catalogs =
        createAlgorithmsLearningCatalogsFixture();
    const initial = activateAlgorithmsLesson(
        createUnlockedAlgorithmsGameState(
            catalogs
        ),
        "algorithm-lesson-001",
        catalogs
    );
    const session = createSession(initial);
    const capture = documentCapture();
    const result = await createPushService({
        session,
        captures: [capture, capture],
        score: 80,
        catalogs
    }).push({
        requestId: "push:algorithms:first"
    });
    const routes = session.getState()
        .learningProgress;
    const algorithms = routes.routes.algorithms;

    assert.equal(
        result.learning.learningRouteId,
        "algorithms"
    );
    assert.equal(result.contract.payout, 90);
    assert.equal(result.settlement.money, 90);
    assert.equal(result.learning.firstCompletion, true);
    assert.equal(result.learning.progressAdvanced, true);
    assert.equal(result.learning.completedLessons, 1);
    assert.equal(result.learning.totalLessons, 2);
    assert.equal(
        result.learning.currentLessonId,
        "algorithm-lesson-002"
    );
    assert.equal(result.learning.routeCompleted, false);
    assert.deepEqual(
        algorithms.completedLessonIds,
        ["algorithm-lesson-001"]
    );
    assert.equal(
        routes.routes.programming
            .completedLessonIds.length,
        50
    );
});

test("ai -push rechazado mantiene disponible la lección de Algoritmia", async () => {
    const catalogs =
        createAlgorithmsLearningCatalogsFixture();
    const initial = activateAlgorithmsLesson(
        createUnlockedAlgorithmsGameState(
            catalogs
        ),
        "algorithm-lesson-001",
        catalogs
    );
    const session = createSession(initial);
    const capture = documentCapture();
    const result = await createPushService({
        session,
        captures: [capture, capture],
        score: 59,
        catalogs
    }).push({
        requestId: "push:algorithms:failed"
    });
    const algorithms = session.getState()
        .learningProgress.routes.algorithms;

    assert.equal(result.learning.passed, false);
    assert.equal(result.contract.payout, 0);
    assert.equal(result.learning.progressAdvanced, false);
    assert.equal(
        result.learning.currentLessonId,
        "algorithm-lesson-001"
    );
    assert.deepEqual(
        algorithms.completedLessonIds,
        []
    );
    assert.deepEqual(
        algorithms.lessonContractLinks,
        {}
    );
});

test("una repetición de Algoritmia paga sólo la mejora sin volver a desbloquear", async () => {
    const catalogs =
        createAlgorithmsLearningCatalogsFixture();
    let state = activateAlgorithmsLesson(
        createUnlockedAlgorithmsGameState(
            catalogs
        ),
        "algorithm-lesson-001",
        catalogs
    );

    state = completeActiveAlgorithmsLesson(
        state,
        catalogs,
        { score: 60 }
    );
    state = activateAlgorithmsLesson(
        state,
        "algorithm-lesson-001",
        catalogs,
        { createdAt: 40, acceptedAt: 50 }
    );

    const session = createSession(state);
    const capture = documentCapture();
    const result = await createPushService({
        session,
        captures: [capture, capture],
        score: 80,
        catalogs
    }).push({
        requestId:
            "push:algorithms:repetition"
    });

    assert.equal(result.learning.repetition, true);
    assert.equal(result.learning.firstCompletion, false);
    assert.equal(result.learning.progressAdvanced, false);
    assert.equal(result.learning.previousBestScore, 60);
    assert.equal(result.learning.bestScore, 80);
    assert.equal(result.contract.payout, 40);
    assert.equal(result.settlement.money, 90);
    assert.equal(
        result.learning.currentLessonId,
        "algorithm-lesson-002"
    );
    assert.equal(result.learning.completedLessons, 1);
});

test("la última aprobación cierra Algoritmia sin crear una tercera ruta", async () => {
    const catalogs =
        createAlgorithmsLearningCatalogsFixture();
    let state = activateAlgorithmsLesson(
        createUnlockedAlgorithmsGameState(
            catalogs
        ),
        "algorithm-lesson-001",
        catalogs
    );

    state = completeActiveAlgorithmsLesson(
        state,
        catalogs,
        { score: 100 }
    );
    state = activateAlgorithmsLesson(
        state,
        "algorithm-lesson-002",
        catalogs,
        { createdAt: 40, acceptedAt: 50 }
    );

    const session = createSession(state);
    const capture = documentCapture();
    const result = await createPushService({
        session,
        captures: [capture, capture],
        score: 100,
        catalogs
    }).push({
        requestId: "push:algorithms:last"
    });
    const progress = session.getState()
        .learningProgress;

    assert.equal(result.learning.routeCompleted, true);
    assert.equal(
        result.learning.currentLessonId,
        "algorithm-lesson-002"
    );
    assert.equal(result.learning.completedLessons, 2);
    assert.equal(result.learning.totalLessons, 2);
    assert.deepEqual(
        progress.availableRouteIds,
        ["programming", "algorithms"]
    );
    assert.deepEqual(
        Object.keys(progress.routes),
        ["programming", "algorithms"]
    );
    assert.match(
        formatBrokerSubmissionPush(result),
        /Siguiente paso: RUTA COMPLETADA/u
    );
});

function createPushService({
    session,
    captures,
    observed = {},
    score = 85,
    stateRevision = session.getState().revision,
    catalogs
}) {
    let captureIndex = 0;
    const nextCapture = () => {
        const selected = captures[
            Math.min(
                captureIndex,
                captures.length - 1
            )
        ];

        captureIndex += 1;
        return selected;
    };

    return new BrokerSubmissionPushService({
        gameSession: session,
        documentCapture: {
            capture() {
                return nextCapture();
            },
            async captureSelected(selector) {
                observed.documentSelector = selector;
                return nextCapture();
            },
            recapture(documentId) {
                observed.recaptureIds ??= [];
                observed.recaptureIds.push(documentId);
                return nextCapture();
            }
        },
        evaluation: {
            async evaluateCapture(capture, options) {
                observed.evaluationCalls =
                    (observed.evaluationCalls ?? 0) + 1;
                observed.capture = capture;
                observed.requestId = options.requestId;
                return evaluationResult({
                    capture,
                    score,
                    stateRevision,
                    contractId:
                        session.getState()
                            .activeContractId
                });
            }
        },
        now() {
            return 1_234;
        },
        catalogs
    });
}

function evaluationResult({
    capture,
    score,
    stateRevision,
    contractId = 1
}) {
    const criteria = ["F-CUM", "F-COR", "F-LIM"];

    return Object.freeze({
        contractId,
        risk: BrokerRisk.LOW,
        stateRevision,
        document: Object.freeze({
            name: capture.document.name,
            languageId: capture.document.languageId,
            version: capture.document.version,
            sourceHash: capture.sourceHash
        }),
        deterministicEvidence: Object.freeze({
            testStatus: "completed",
            testSummary: Object.freeze({
                total: 1,
                passed: 1
            }),
            staticStatus: "complete"
        }),
        evaluation: Object.freeze({
            summary:
                "La entrega cumple la mayor parte del contrato.",
            criteria: Object.freeze(
                criteria.map(criterion =>
                    Object.freeze({
                        criterion,
                        score,
                        evidence: Object.freeze([
                            "Evidencia observable."
                        ]),
                        rationale:
                            "Puntuación justificada."
                    })
                )
            ),
            findings: Object.freeze([])
        }),
        criterionScores: Object.freeze(
            Object.fromEntries(
                criteria.map(criterion => [
                    criterion,
                    score
                ])
            )
        ),
        dimensionScores: Object.freeze({
            functionality: score
        }),
        finalScore: score,
        provider: Object.freeze({
            model: "modelo",
            responseId: "response:push",
            finishReason: "stop",
            usage: null
        }),
        settlement: Object.freeze({
            performed: false,
            payoutCalculated: false,
            gameStateMutated: false
        })
    });
}

function createSession(initialState) {
    return {
        state: initialState,
        async initialize() {},
        getState() {
            return this.state;
        },
        async transact(transition, options = {}) {
            if (
                options.expectedRevision != null &&
                options.expectedRevision !==
                    this.state.revision
            ) {
                throw BrokerGamePersistenceError
                    .revisionConflict(
                        options.expectedRevision,
                        this.state.revision
                    );
            }

            this.state = transition(this.state);
            return this.state;
        }
    };
}

function activeState() {
    let state = createBrokerGameState();

    state = addBrokerContract(state, {
        title: "Contrato de prueba",
        categoryId: "NUM-ARITH",
        categoryName: "Aritmética",
        familyId: "NUM",
        familyName: "Procesamiento numérico",
        risk: BrokerRisk.LOW,
        description: "Escribe el resultado solicitado.",
        requirements: ["Escribir 42."],
        testCases: [{
            id: "TC-1",
            kind: "normal",
            requirementIds: ["REQ-1"],
            stdin: "",
            expected: "oráculo-privado",
            comparison: BrokerTestComparison.EXACT,
            timeoutMs: 1_000
        }],
        client: "Laboratorio",
        payPotential: 100,
        createdAt: 50,
        metadata: {
            requirementIds: ["REQ-1"]
        }
    });
    return acceptBrokerContract(
        state,
        1,
        { acceptedAt: 100 }
    );
}

function activeLearningState() {
    let state = addBrokerLearningContract(
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
        { createdAt: 50 }
    );

    state = acceptBrokerContract(
        state,
        1,
        { acceptedAt: 100 }
    );

    return state;
}

function activeLearningRepetitionState(
    firstScore
) {
    let state = settleBrokerContract(
        activeLearningState(),
        {
            dimensionScores: {
                functionality: firstScore
            },
            submittedAt: 150
        }
    );

    state = addBrokerLearningContract(
        state,
        "lesson-001",
        {
            title: "Primer mensaje repetido",
            description:
                "Mostrar nuevamente un mensaje sencillo.",
            requirements: [
                "Mostrar el texto indicado."
            ],
            testCases: []
        },
        { createdAt: 200 }
    );

    return acceptBrokerContract(
        state,
        2,
        { acceptedAt: 250 }
    );
}

function documentCapture({
    version = 5,
    sourceCode = SOURCE,
    documentId = "file:///privado/solucion.clrs"
} = {}) {
    return createBrokerClrsDocumentCapture({
        capturedAt: 1,
        document: {
            documentId,
            name: "solucion.clrs",
            languageId: "clrs-es",
            version
        },
        sourceCode,
        analysis: {
            ok: true,
            diagnostics: []
        },
        ast: null
    });
}
