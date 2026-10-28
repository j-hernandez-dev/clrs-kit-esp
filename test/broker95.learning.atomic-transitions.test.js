import assert from "node:assert/strict";
import test from "node:test";

import {
    BrokerContractState,
    BrokerContractType,
    BrokerGameStatus,
    BrokerRisk,
    acceptBrokerContract,
    addBrokerContract,
    addBrokerLearningContract,
    brokerCategoryCatalog,
    createBrokerGameState,
    deleteBrokerContract,
    purgeBrokerContracts,
    settleBrokerContract
} from "../src/broker95/index.js";

test("crea y vincula un contrato learning en una sola transición", () => {
    const initial = createBrokerGameState();
    const next = addBrokerLearningContract(
        initial,
        "lesson-001",
        learningNarrative({
            contractType: BrokerContractType.CLIENT,
            risk: BrokerRisk.EXTREME,
            payPotential: 9_999,
            lessonId: "lesson-048",
            learningAttempt: 90
        }),
        { createdAt: "created-1" }
    );
    const contract = next.contracts[0];

    assert.equal(initial.revision, 0);
    assert.equal(next.revision, 1);
    assert.equal(
        programming(next).revision,
        programming(initial).revision + 1
    );
    assert.equal(
        contract.contractType,
        BrokerContractType.LEARNING
    );
    assert.equal(contract.risk, BrokerRisk.LOW);
    assert.equal(contract.client, "CIPHER");
    assert.equal(
        contract.learningRouteId,
        "programming"
    );
    assert.equal(contract.lessonId, "lesson-001");
    assert.equal(contract.sectionId, "section-001");
    assert.equal(contract.learningAttempt, 1);
    assert.equal(contract.baseReward, 10);
    assert.equal(contract.effectiveReward, 10);
    assert.equal(contract.payPotential, 10);
    assert.equal(contract.createdAt, "created-1");
    assert.deepEqual(
        programming(next).lessonContractLinks[
            "lesson-001"
        ],
        {
            lessonId: "lesson-001",
            contractId: 1,
            learningAttempt: 1,
            repetition: false
        }
    );
    assert.equal(
        programming(initial).learningStartedAt,
        null
    );
});

test("mantiene el enlace al aceptar sin fingir otra transición educativa", () => {
    const pending = createLearningContract();
    const active = acceptBrokerContract(
        pending,
        1,
        { acceptedAt: "accepted-1" }
    );

    assert.equal(active.revision, pending.revision + 1);
    assert.equal(
        programming(active).revision,
        programming(pending).revision
    );
    assert.equal(active.activeContractId, 1);
    assert.equal(
        active.contracts[0].state,
        BrokerContractState.ACTIVE
    );
    assert.equal(
        programming(active)
            .lessonContractLinks["lesson-001"]
            .contractId,
        1
    );
});

test("aprueba, paga el porcentaje y desbloquea atómicamente", () => {
    const active = acceptLearningContract(
        createLearningContract()
    );
    const settled = settleBrokerContract(
        active,
        {
            dimensionScores: {
                functionality: 60
            },
            submittedAt: "submitted-1"
        }
    );
    const contract = settled.contracts[0];

    assert.equal(settled.revision, active.revision + 1);
    assert.equal(contract.state, BrokerContractState.COMPLETED);
    assert.equal(contract.payout, 5);
    assert.equal(contract.evaluation.finalScore, 60);
    assert.equal(settled.money, 5);
    assert.equal(settled.activeContractId, null);
    assert.deepEqual(
        programming(settled).completedLessonIds,
        ["lesson-001"]
    );
    assert.equal(
        programming(settled).currentLessonId,
        "lesson-002"
    );
    assert.equal(
        programming(settled).revision,
        programming(active).revision + 1
    );
    assert.deepEqual(
        programming(settled).lessonContractLinks,
        {}
    );
    assert.deepEqual(
        programming(settled).lessonAttempts[
            "lesson-001"
        ],
        {
            lessonId: "lesson-001",
            attempts: 1,
            firstCompletionScore: 60,
            bestScore: 60,
            completedAt: "submitted-1"
        }
    );
    assert.equal(settled.statistics.completed, 1);
    assert.equal(settled.statistics.failed, 0);
    assert.equal(settled.statistics.totalEarned, 5);
    assert.equal(
        settled.statistics.familyCompleted.FND,
        1
    );
    assert.deepEqual(
        settled.technicalProfile.functionality,
        { sum: 60, sampleCount: 1, score: 60 }
    );
    assert.equal(
        settled.technicalProfile.robustness.sampleCount,
        0
    );
    assert.equal(
        settled.technicalProfile.design.sampleCount,
        0
    );
});

test("un intento fallido cierra y libera sin pagar ni avanzar", () => {
    const active = acceptLearningContract(
        createLearningContract()
    );
    const failed = settleBrokerContract(
        active,
        {
            dimensionScores: {
                functionality: 59
            },
            submittedAt: "submitted-failed"
        }
    );

    assert.equal(
        failed.contracts[0].state,
        BrokerContractState.FAILED
    );
    assert.equal(failed.contracts[0].payout, 0);
    assert.equal(failed.money, 0);
    assert.equal(
        programming(failed).currentLessonId,
        "lesson-001"
    );
    assert.deepEqual(
        programming(failed).completedLessonIds,
        []
    );
    assert.deepEqual(
        programming(failed).lessonContractLinks,
        {}
    );
    assert.equal(
        programming(failed)
            .lessonAttempts["lesson-001"]
            .attempts,
        1
    );
    assert.equal(failed.statistics.failed, 1);

    const retry = addBrokerLearningContract(
        failed,
        "lesson-001",
        learningNarrative(),
        { createdAt: "created-2" }
    );

    assert.equal(retry.contracts[1].learningAttempt, 2);
    assert.equal(retry.contracts[1].effectiveReward, 10);
});

test("una repetición paga sólo la mejora sobre el mejor resultado", () => {
    const completed = settleBrokerContract(
        acceptLearningContract(
            createLearningContract()
        ),
        {
            dimensionScores: {
                functionality: 60
            },
            submittedAt: "first-pass"
        }
    );
    const repeatedPending =
        addBrokerLearningContract(
            completed,
            "lesson-001",
            learningNarrative(),
            { createdAt: "repeat-created" }
        );
    const repeatedContract =
        repeatedPending.contracts[1];
    const repeated = settleBrokerContract(
        acceptBrokerContract(
            repeatedPending,
            repeatedContract.id,
            { acceptedAt: "repeat-accepted" }
        ),
        {
            dimensionScores: {
                functionality: 80
            },
            submittedAt: "repeat-submitted"
        }
    );

    assert.equal(repeatedContract.learningAttempt, 2);
    assert.equal(repeatedContract.baseReward, 10);
    assert.equal(repeatedContract.effectiveReward, 10);
    assert.equal(repeatedContract.payPotential, 10);
    assert.equal(repeated.contracts[0].payout, 5);
    assert.equal(repeated.contracts[1].payout, 4);
    assert.equal(repeated.money, 9);
    assert.deepEqual(
        programming(repeated).completedLessonIds,
        ["lesson-001"]
    );
    assert.equal(
        programming(repeated).currentLessonId,
        "lesson-002"
    );
    assert.equal(
        programming(repeated)
            .lessonAttempts["lesson-001"]
            .attempts,
        2
    );
    assert.equal(repeated.statistics.completed, 2);

    const sameScorePending =
        addBrokerLearningContract(
            repeated,
            "lesson-001",
            learningNarrative(),
            { createdAt: "same-score-created" }
        );
    const sameScore = settleBrokerContract(
        acceptBrokerContract(
            sameScorePending,
            3,
            { acceptedAt: "same-score-accepted" }
        ),
        {
            dimensionScores: {
                functionality: 80
            },
            submittedAt: "same-score-submitted"
        }
    );

    assert.equal(
        sameScore.contracts[2].state,
        BrokerContractState.COMPLETED
    );
    assert.equal(sameScore.contracts[2].payout, 0);
    assert.equal(sameScore.money, 9);
    assert.equal(sameScore.statistics.completed, 3);
    assert.equal(
        programming(sameScore)
            .lessonAttempts["lesson-001"]
            .bestScore,
        80
    );

    const perfectPending =
        addBrokerLearningContract(
            sameScore,
            "lesson-001",
            learningNarrative(),
            { createdAt: "perfect-created" }
        );
    const perfect = settleBrokerContract(
        acceptBrokerContract(
            perfectPending,
            4,
            { acceptedAt: "perfect-accepted" }
        ),
        {
            dimensionScores: {
                functionality: 95
            },
            submittedAt: "perfect-submitted"
        }
    );
    const cappedPending =
        addBrokerLearningContract(
            perfect,
            "lesson-001",
            learningNarrative(),
            { createdAt: "capped-created" }
        );
    const capped = settleBrokerContract(
        acceptBrokerContract(
            cappedPending,
            5,
            { acceptedAt: "capped-accepted" }
        ),
        {
            dimensionScores: {
                functionality: 100
            },
            submittedAt: "capped-submitted"
        }
    );

    assert.equal(perfect.contracts[3].payout, 1);
    assert.equal(perfect.money, 10);
    assert.equal(capped.contracts[4].payout, 0);
    assert.equal(capped.money, 10);
    assert.equal(
        programming(capped)
            .lessonAttempts["lesson-001"]
            .bestScore,
        100
    );
});

test("delete y purge liberan enlaces en la misma revisión global", () => {
    const first = createLearningContract();
    const deleted = deleteBrokerContract(first, 1);

    assert.equal(deleted.revision, first.revision + 1);
    assert.equal(
        programming(deleted).revision,
        programming(first).revision + 1
    );
    assert.deepEqual(
        programming(deleted).lessonContractLinks,
        {}
    );
    assert.equal(
        deleted.contracts[0].state,
        BrokerContractState.DELETED
    );

    const completed = settleBrokerContract(
        acceptLearningContract(
            addBrokerLearningContract(
                deleted,
                "lesson-001",
                learningNarrative(),
                { createdAt: "created-after-delete" }
            )
        ),
        {
            dimensionScores: {
                functionality: 90
            },
            submittedAt: "completed"
        }
    );
    let withTwoPending =
        addBrokerLearningContract(
            completed,
            "lesson-001",
            learningNarrative(),
            { createdAt: "repeat" }
        );

    withTwoPending = addBrokerLearningContract(
        withTwoPending,
        "lesson-002",
        learningNarrative(),
        { createdAt: "next-lesson" }
    );

    const learningRevision =
        programming(withTwoPending).revision;
    const purged = purgeBrokerContracts(
        withTwoPending
    );

    assert.equal(
        purged.revision,
        withTwoPending.revision + 1
    );
    assert.equal(
        programming(purged).revision,
        learningRevision + 1
    );
    assert.deepEqual(
        programming(purged).lessonContractLinks,
        {}
    );
    assert.equal(
        purged.contracts.filter(
            contract =>
                contract.state ===
                BrokerContractState.DELETED
        ).length,
        3
    );
    assert.deepEqual(
        programming(purged).completedLessonIds,
        ["lesson-001"]
    );
});

test("game over descarta enlaces abiertos pero conserva el aprendizaje", () => {
    let state = createLearningContract();

    state = addBrokerContract(
        state,
        clientDraft({
            risk: BrokerRisk.HIGH,
            payPotential: 1_000
        })
    );
    state = createBrokerGameState({
        ...state,
        alertLevel: 10
    });

    const learningRevision =
        programming(state).revision;
    const gameOver = acceptBrokerContract(
        state,
        2
    );

    assert.equal(
        gameOver.status,
        BrokerGameStatus.GAME_OVER
    );
    assert.deepEqual(gameOver.contracts, []);
    assert.deepEqual(
        programming(gameOver).lessonContractLinks,
        {}
    );
    assert.equal(
        programming(gameOver).revision,
        learningRevision + 1
    );
    assert.equal(
        programming(gameOver).learningStartedAt,
        "created-1"
    );
    assert.deepEqual(
        programming(gameOver).completedLessonIds,
        []
    );
});

test("rechaza contextos educativos falsificados sin mutar el estado", () => {
    const initial = createBrokerGameState();

    assert.throws(
        () => addBrokerContract(
            initial,
            rawLearningDraft({
                learningAttempt: 2
            })
        ),
        error =>
            error?.code ===
            "BROKER95_LEARNING_CONTRACT_CONTEXT_MISMATCH"
    );
    assert.equal(initial.revision, 0);
    assert.equal(initial.contracts.length, 0);
    assert.deepEqual(
        programming(initial).lessonContractLinks,
        {}
    );
});

test("conserva la tabla porcentual para contratos client", () => {
    let state = createBrokerGameState();

    state = addBrokerContract(
        state,
        clientDraft()
    );
    state = acceptBrokerContract(state, 1);
    state = settleBrokerContract(state, {
        dimensionScores: {
            functionality: 60
        }
    });

    assert.equal(state.contracts[0].payout, 100);
    assert.equal(state.money, 100);
    assert.deepEqual(
        programming(state).completedLessonIds,
        []
    );
});

function createLearningContract() {
    return addBrokerLearningContract(
        createBrokerGameState(),
        "lesson-001",
        learningNarrative(),
        { createdAt: "created-1" }
    );
}

function programming(state) {
    return state.learningProgress.routes.programming;
}

function acceptLearningContract(state) {
    const pending = state.contracts.find(
        contract =>
            contract.contractType ===
                BrokerContractType.LEARNING &&
            contract.state ===
                BrokerContractState.PENDING
    );

    return acceptBrokerContract(
        state,
        pending.id,
        { acceptedAt: `accepted-${pending.id}` }
    );
}

function learningNarrative(overrides = {}) {
    return {
        title: "Primer mensaje",
        description:
            "Mostrar un mensaje sencillo.",
        requirements: [
            "Mostrar el texto indicado."
        ],
        testCases: [],
        ...overrides
    };
}

function rawLearningDraft(overrides = {}) {
    const category =
        brokerCategoryCatalog.requireCategory(
            "FND-IO"
        );

    return {
        ...learningNarrative(),
        contractType: BrokerContractType.LEARNING,
        learningRouteId: "programming",
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        familyId: category.familyId,
        familyName: category.familyName,
        risk: BrokerRisk.LOW,
        client: "CIPHER",
        payPotential: 10,
        lessonId: "lesson-001",
        sectionId: "section-001",
        learningAttempt: 1,
        baseReward: 10,
        effectiveReward: 10,
        ...overrides
    };
}

function clientDraft(overrides = {}) {
    const category =
        brokerCategoryCatalog.requireCategory(
            "NUM-ARITH"
        );

    return {
        title: "Operación aritmética",
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        familyId: category.familyId,
        familyName: category.familyName,
        risk: BrokerRisk.LOW,
        description: "Resolver una suma.",
        requirements: ["Mostrar el resultado."],
        client: "Northstar",
        payPotential: 200,
        ...overrides
    };
}
