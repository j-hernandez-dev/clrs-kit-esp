import test from "node:test";
import assert from "node:assert/strict";

import {
    BROKER_CRITERIA,
    BrokerContractState,
    BrokerCountermeasure,
    BrokerGameStatus,
    BrokerRisk,
    acceptBrokerContract,
    addBrokerContract,
    calculateBrokerPayout,
    calculateBrokerFinalScore,
    clearBrokerCategoryHistory,
    createBrokerContract,
    createBrokerGameState,
    getBrokerRiskRule,
    purchaseBrokerCountermeasure,
    purgeBrokerContracts,
    resetBrokerGameProgress,
    settleBrokerContract,
    startBrokerNewRun
} from "../src/broker95/core/index.js";

test("define únicamente las tres dimensiones académicas", () => {
    assert.deepEqual(
        BROKER_CRITERIA,
        [
            "functionality",
            "robustness",
            "design"
        ]
    );
    assert.equal(
        Object.hasOwn(
            getBrokerRiskRule(
                BrokerRisk.EXTREME
            ).weights,
            "efficiency"
        ),
        false
    );
    assert.deepEqual(
        getBrokerRiskRule(
            BrokerRisk.EXTREME
        ).weights,
        {
            functionality: 0.5,
            robustness: 0.125,
            design: 0.375
        }
    );
});

test("crea una partida inicial profundamente inmutable", () => {
    const state = createBrokerGameState();

    assert.equal(
        state.status,
        BrokerGameStatus.PLAYING
    );
    assert.equal(state.revision, 0);
    assert.equal(state.nextContractId, 1);
    assert.equal(state.alertLevel, 0);
    assert.equal(
        Object.isFrozen(state),
        true
    );
    assert.equal(
        Object.isFrozen(
            state.technicalProfile
        ),
        true
    );
    assert.equal(
        Object.isFrozen(
            state.statistics.byRisk
        ),
        true
    );
});

test("asigna IDs deterministas sin mutar el estado anterior", () => {
    const initial = createBrokerGameState();
    const first = addBrokerContract(
        initial,
        contractDraft()
    );
    const second = addBrokerContract(
        first,
        contractDraft({
            title: "Segundo contrato"
        })
    );

    assert.equal(initial.contracts.length, 0);
    assert.equal(first.contracts[0].id, 1);
    assert.equal(second.contracts[1].id, 2);
    assert.equal(second.nextContractId, 3);
    assert.equal(second.revision, 2);
    assert.equal(
        Object.isFrozen(
            second.contracts[0]
                .requirements
        ),
        true
    );
    assert.deepEqual(
        second.categoryHistory[
            "NUM-ARITH"
        ],
        {
            categoryId: "NUM-ARITH",
            familyId: "NUM",
            generatedCount: 2,
            acceptedCount: 0,
            completedCount: 0,
            failedCount: 0,
            lastGenerated: 2,
            lastCompleted: null
        }
    );
});

test("limpia sólo el historial adaptativo y conserva contratos abiertos", () => {
    let state = createBrokerGameState();

    state = addBrokerContract(
        state,
        contractDraft()
    );
    state = acceptBrokerContract(state, 1);
    state = settleBrokerContract(state, {
        dimensionScores: {
            functionality: 100
        }
    });
    state = addBrokerContract(
        state,
        contractDraft({
            title: "Contrato abierto"
        })
    );

    const money = state.money;
    const statistics = state.statistics;
    const pendingContracts = state.contracts;
    const clearedPending =
        clearBrokerCategoryHistory(state);

    assert.equal(clearedPending.money, money);
    assert.deepEqual(
        clearedPending.statistics,
        statistics
    );
    assert.deepEqual(
        clearedPending.contracts,
        pendingContracts
    );
    assert.deepEqual(
        clearedPending.categoryHistory[
            "NUM-ARITH"
        ],
        {
            categoryId: "NUM-ARITH",
            familyId: "NUM",
            generatedCount: 1,
            acceptedCount: 0,
            completedCount: 0,
            failedCount: 0,
            lastGenerated: 2,
            lastCompleted: null
        }
    );

    const active = acceptBrokerContract(
        clearedPending,
        2
    );
    const clearedActive =
        clearBrokerCategoryHistory(active);
    const settled = settleBrokerContract(
        clearedActive,
        {
            dimensionScores: {
                functionality: 100
            }
        }
    );

    assert.equal(
        clearedActive.activeContractId,
        2
    );
    assert.equal(
        clearedActive.categoryHistory[
            "NUM-ARITH"
        ].acceptedCount,
        1
    );
    assert.equal(
        settled.completedContractIds.length,
        2
    );
});

test("reinicia el progreso de partida y conserva el historial de categorías", () => {
    let state = createBrokerGameState();

    state = addBrokerContract(
        state,
        contractDraft()
    );
    state = acceptBrokerContract(state, 1);
    state = settleBrokerContract(state, {
        dimensionScores: {
            functionality: 90
        }
    });
    state = addBrokerContract(
        state,
        contractDraft({
            title: "Contrato pendiente"
        })
    );

    const previousRevision = state.revision;
    const categoryHistory =
        state.categoryHistory;
    const reset = resetBrokerGameProgress(
        state
    );

    assert.equal(reset.status, BrokerGameStatus.PLAYING);
    assert.equal(reset.money, 0);
    assert.equal(reset.alertLevel, 0);
    assert.equal(reset.nextContractId, 1);
    assert.equal(reset.activeContractId, null);
    assert.deepEqual(reset.contracts, []);
    assert.deepEqual(reset.completedContractIds, []);
    assert.deepEqual(reset.failedContractIds, []);
    assert.equal(reset.statistics.completed, 0);
    assert.equal(reset.statistics.failed, 0);
    assert.equal(reset.statistics.totalEarned, 0);
    assert.equal(
        reset.technicalProfile.functionality
            .sampleCount,
        0
    );
    assert.deepEqual(
        reset.categoryHistory,
        categoryHistory
    );
    assert.equal(
        reset.revision,
        previousRevision + 1
    );
});

test("aplica exactamente los límites de la tabla de pagos", () => {
    assert.equal(
        calculateBrokerPayout(200, 90),
        200
    );
    assert.equal(
        calculateBrokerPayout(200, 80),
        180
    );
    assert.equal(
        calculateBrokerPayout(200, 70),
        150
    );
    assert.equal(
        calculateBrokerPayout(200, 60),
        100
    );
    assert.equal(
        calculateBrokerPayout(200, 59),
        0
    );
});

test("permite permanecer en alerta 10", () => {
    const state = addBrokerContract(
        createBrokerGameState({
            alertLevel: 8
        }),
        contractDraft({
            risk: BrokerRisk.HIGH,
            payPotential: 1000
        })
    );
    const accepted = acceptBrokerContract(
        state,
        1,
        { acceptedAt: 100 }
    );

    assert.equal(accepted.alertLevel, 10);
    assert.equal(
        accepted.status,
        BrokerGameStatus.PLAYING
    );
    assert.equal(accepted.activeContractId, 1);
    assert.equal(
        accepted.contracts[0].state,
        BrokerContractState.ACTIVE
    );
});

test("activa game over en 11 y elimina el progreso de la partida", () => {
    const state = addBrokerContract(
        createBrokerGameState({
            alertLevel: 10,
            money: 900
        }),
        contractDraft({
            risk: BrokerRisk.MEDIUM,
            payPotential: 400
        })
    );
    const ended = acceptBrokerContract(
        state,
        1
    );

    assert.equal(
        ended.status,
        BrokerGameStatus.GAME_OVER
    );
    assert.equal(ended.alertLevel, 11);
    assert.equal(ended.money, 0);
    assert.equal(ended.activeContractId, null);
    assert.deepEqual(ended.contracts, []);
    assert.equal(
        ended.categoryHistory[
            "NUM-ARITH"
        ].acceptedCount,
        1
    );
});

test("impide aceptar dos contratos simultáneamente", () => {
    let state = createBrokerGameState();
    state = addBrokerContract(
        state,
        contractDraft()
    );
    state = addBrokerContract(
        state,
        contractDraft({
            title: "Pendiente"
        })
    );
    state = acceptBrokerContract(state, 1);

    assert.throws(
        () => acceptBrokerContract(
            state,
            2
        ),
        error =>
            error.code ===
            "BROKER95_ACTIVE_CONTRACT_EXISTS"
    );
});

test("calcula nota, paga y perfil técnico sin ponderar el perfil", () => {
    let state = createBrokerGameState();
    state = addBrokerContract(
        state,
        contractDraft({
            risk: BrokerRisk.HIGH,
            payPotential: 1000
        })
    );
    state = acceptBrokerContract(state, 1);
    const settled = settleBrokerContract(
        state,
        {
            dimensionScores: {
                functionality: 90,
                robustness: 80,
                design: 70
            },
            submittedAt: 200
        }
    );
    const contract = settled.contracts[0];

    assert.equal(
        calculateBrokerFinalScore(
            BrokerRisk.HIGH,
            {
                functionality: 90,
                robustness: 80,
                design: 70
            }
        ),
        82
    );
    assert.equal(contract.payout, 900);
    assert.equal(settled.money, 900);
    assert.equal(
        contract.state,
        BrokerContractState.COMPLETED
    );
    assert.equal(
        settled.technicalProfile
            .functionality.score,
        90
    );
    assert.equal(
        settled.technicalProfile
            .robustness.score,
        80
    );
    assert.equal(
        settled.technicalProfile
            .design.score,
        70
    );
    assert.equal(
        settled.statistics.totalEarned,
        900
    );
    assert.equal(
        settled.statistics.byRisk.high
            .completed,
        1
    );
    assert.deepEqual(
        settled.categoryHistory[
            "NUM-ARITH"
        ],
        {
            categoryId: "NUM-ARITH",
            familyId: "NUM",
            generatedCount: 1,
            acceptedCount: 1,
            completedCount: 1,
            failedCount: 0,
            lastGenerated: 1,
            lastCompleted: 200
        }
    );
});

test("rechaza un contrato sin paga cuando la nota es menor que 60", () => {
    let state = createBrokerGameState();
    state = addBrokerContract(
        state,
        contractDraft()
    );
    state = acceptBrokerContract(state, 1);
    const failed = settleBrokerContract(
        state,
        {
            dimensionScores: {
                functionality: 59
            }
        }
    );

    assert.equal(failed.money, 0);
    assert.equal(
        failed.contracts[0].state,
        BrokerContractState.FAILED
    );
    assert.deepEqual(
        failed.failedContractIds,
        [1]
    );
    assert.equal(
        failed.statistics.failed,
        1
    );
});

test("un contrato cerrado no puede volver a pagar", () => {
    let state = createBrokerGameState();
    state = addBrokerContract(
        state,
        contractDraft()
    );
    state = acceptBrokerContract(state, 1);
    state = settleBrokerContract(
        state,
        {
            dimensionScores: {
                functionality: 100
            }
        }
    );

    assert.throws(
        () => settleBrokerContract(
            state,
            {
                dimensionScores: {
                    functionality: 100
                }
            }
        ),
        error =>
            error.code ===
            "BROKER95_ACTIVE_CONTRACT_REQUIRED"
    );
    assert.equal(state.money, 200);
});

test("rechaza dimensiones inactivas y cualquier intento de eficiencia", () => {
    assert.throws(
        () => calculateBrokerFinalScore(
            BrokerRisk.LOW,
            {
                functionality: 100,
                efficiency: 100
            }
        ),
        error =>
            error.code ===
            "BROKER95_DIMENSION_SCORES_MISMATCH"
    );
});

test("anonimiza clientes de riesgo alto y extremo", () => {
    const contract = createBrokerContract({
        id: 1,
        ...contractDraft({
            risk: BrokerRisk.EXTREME,
            payPotential: 2000,
            client: "Nombre filtrado"
        })
    });

    assert.equal(contract.client, "Anónimo");
});

test("rechaza resultados inyectados en contratos no cerrados", () => {
    assert.throws(
        () => createBrokerContract({
            id: 1,
            ...contractDraft(),
            payout: 200,
            evaluation: {
                finalScore: 100
            }
        }),
        error =>
            error.code ===
            "BROKER95_CONTRACT_LIFECYCLE_INVALID"
    );
});

test("rechaza estados persistidos con historiales contradictorios", () => {
    let state = createBrokerGameState();
    state = addBrokerContract(
        state,
        contractDraft()
    );
    state = acceptBrokerContract(state, 1);
    state = settleBrokerContract(
        state,
        {
            dimensionScores: {
                functionality: 100
            }
        }
    );

    assert.throws(
        () => createBrokerGameState({
            ...state,
            completedContractIds: [],
            failedContractIds: [1]
        }),
        error =>
            error.code ===
            "BROKER95_CONTRACT_OUTCOME_HISTORY_INCONSISTENT"
    );
    assert.throws(
        () => createBrokerGameState({
            status:
                BrokerGameStatus.GAME_OVER,
            alertLevel: 11,
            money: 1
        }),
        error =>
            error.code ===
            "BROKER95_GAME_OVER_STATE_INVALID"
    );
});

test("compra contramedidas con efecto y costo deterministas", () => {
    const state = createBrokerGameState({
        money: 1000,
        alertLevel: 4
    });
    const reduced =
        purchaseBrokerCountermeasure(
            state,
            BrokerCountermeasure
                .INFRASTRUCTURE
        );

    assert.equal(reduced.money, 350);
    assert.equal(reduced.alertLevel, 2);
    assert.throws(
        () => purchaseBrokerCountermeasure(
            reduced,
            BrokerCountermeasure.IDENTITY
        ),
        error =>
            error.code ===
            "BROKER95_MONEY_INSUFFICIENT"
    );
});

test("purga únicamente contratos pendientes", () => {
    let state = createBrokerGameState();
    state = addBrokerContract(
        state,
        contractDraft()
    );
    state = addBrokerContract(
        state,
        contractDraft({
            title: "Segundo"
        })
    );
    state = acceptBrokerContract(state, 1);
    const purged = purgeBrokerContracts(
        state
    );

    assert.equal(
        purged.contracts[0].state,
        BrokerContractState.ACTIVE
    );
    assert.equal(
        purged.contracts[1].state,
        BrokerContractState.DELETED
    );
});

test("una nueva partida conserva estadísticas acumuladas", () => {
    let state = createBrokerGameState();
    state = addBrokerContract(
        state,
        contractDraft()
    );
    state = acceptBrokerContract(state, 1);
    state = settleBrokerContract(
        state,
        {
            dimensionScores: {
                functionality: 100
            }
        }
    );
    state = addBrokerContract(
        createBrokerGameState({
            ...state,
            alertLevel: 8
        }),
        contractDraft({
            risk: BrokerRisk.EXTREME,
            payPotential: 2500
        })
    );
    state = acceptBrokerContract(
        state,
        2
    );
    const restarted = startBrokerNewRun(
        state
    );

    assert.equal(
        restarted.status,
        BrokerGameStatus.PLAYING
    );
    assert.equal(restarted.money, 0);
    assert.equal(restarted.alertLevel, 0);
    assert.equal(
        restarted.statistics.completed,
        1
    );
    assert.equal(
        restarted.technicalProfile
            .functionality.sampleCount,
        1
    );
    assert.equal(
        restarted.nextContractId,
        3
    );
});

function contractDraft(overrides = {}) {
    return {
        title: "Suma clandestina",
        categoryId: "NUM-ARITH",
        categoryName: "Aritmética",
        familyId: "NUM",
        familyName: "Procesamiento numérico",
        risk: BrokerRisk.LOW,
        description:
            "Resolver una operación aritmética.",
        requirements: [
            "Leer dos números.",
            "Mostrar su suma."
        ],
        client: "Northstar",
        payPotential: 200,
        metadata: {
            source: "test"
        },
        ...overrides
    };
}
