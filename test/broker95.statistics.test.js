import test from "node:test";
import assert from "node:assert/strict";

import {
    BROKER_STATISTICS_VIEW_VERSION,
    BrokerGameStatus,
    createBrokerGameState,
    createBrokerPublicGameState,
    createBrokerStatisticsView
} from "../src/broker95/index.js";

test("deriva el resumen acumulativo, riesgos y perfil técnico sin recalcularlos en el Webview", () => {
    const state = populatedState();
    const view = createBrokerStatisticsView(
        state
    );

    assert.equal(
        view.schemaVersion,
        BROKER_STATISTICS_VIEW_VERSION
    );
    assert.deepEqual(view.summary, {
        completed: 3,
        failed: 1,
        totalEvaluated: 4,
        successRate: 75,
        totalEarned: 1800,
        currentMoney: 725,
        alertLevel: 4,
        alertLimit: 10,
        gameOver: false
    });
    assert.deepEqual(
        view.risks.map(bucket => [
            bucket.risk,
            bucket.total,
            bucket.distributionPercent,
            bucket.successRate
        ]),
        [
            ["low", 2, 50, 100],
            ["medium", 1, 25, 0],
            ["high", 1, 25, 100],
            ["extreme", 0, 0, 0]
        ]
    );
    assert.deepEqual(
        view.technicalProfile.map(item => [
            item.criterion,
            item.label,
            item.score,
            item.sampleCount
        ]),
        [
            [
                "functionality",
                "Funcionalidad",
                90,
                3
            ],
            [
                "robustness",
                "Robustez",
                80,
                2
            ],
            ["design", "Diseño", 70, 1]
        ]
    );
});

test("incluye las 39 familias y calcula cobertura por categorías completadas", () => {
    const view = createBrokerStatisticsView(
        populatedState()
    );
    const fundamentals = view.families.find(
        family => family.familyId === "FND"
    );
    const graphs = view.families.find(
        family =>
            family.familyId === "GRAPH-F"
    );
    const optimization = view.families.find(
        family => family.familyId === "OPT"
    );
    const geometry = view.families.find(
        family => family.familyId === "GEO"
    );

    assert.equal(view.families.length, 39);
    assert.deepEqual(
        fundamentals,
        {
            familyId: "FND",
            familyName: "Fundamental",
            categoryCount: 12,
            generated: 2,
            accepted: 2,
            completed: 2,
            failed: 0,
            completedCategories: 1,
            coveragePercent: 8
        }
    );
    assert.equal(graphs.completed, 1);
    assert.equal(graphs.completedCategories, 1);
    assert.equal(graphs.coveragePercent, 25);
    assert.equal(optimization.failed, 1);
    assert.equal(optimization.completed, 0);
    assert.deepEqual(
        {
            generated: geometry.generated,
            accepted: geometry.accepted,
            completed: geometry.completed,
            failed: geometry.failed,
            coveragePercent:
                geometry.coveragePercent
        },
        {
            generated: 0,
            accepted: 0,
            completed: 0,
            failed: 0,
            coveragePercent: 0
        }
    );
});

test("publica una vista profundamente inmutable y conserva estadísticas finales tras game over", () => {
    const gameOver = createBrokerGameState({
        ...populatedState(),
        status: BrokerGameStatus.GAME_OVER,
        money: 0,
        alertLevel: 11,
        contracts: [],
        activeContractId: null,
        completedContractIds: [],
        failedContractIds: []
    });
    const publicState =
        createBrokerPublicGameState(
            gameOver
        );

    assert.equal(
        publicState.statisticsView.summary
            .gameOver,
        true
    );
    assert.equal(
        publicState.statisticsView.summary
            .completed,
        3
    );
    assert.equal(
        publicState.statisticsView.summary
            .currentMoney,
        0
    );
    assert.equal(
        Object.isFrozen(
            publicState.statisticsView
                .families
        ),
        true
    );
    assert.equal(
        Object.isFrozen(
            publicState.statisticsView
                .families[0]
        ),
        true
    );
    assert.equal(
        JSON.stringify(
            publicState.statisticsView
        ).includes("efficiency"),
        false
    );
});

function populatedState() {
    return createBrokerGameState({
        money: 725,
        alertLevel: 4,
        statistics: {
            completed: 3,
            failed: 1,
            totalEarned: 1800,
            byRisk: {
                low: {
                    completed: 2,
                    failed: 0
                },
                medium: {
                    completed: 0,
                    failed: 1
                },
                high: {
                    completed: 1,
                    failed: 0
                }
            },
            familyCompleted: {
                FND: 2,
                "GRAPH-F": 1
            }
        },
        technicalProfile: {
            functionality: {
                sum: 270,
                sampleCount: 3
            },
            robustness: {
                sum: 160,
                sampleCount: 2
            },
            design: {
                sum: 70,
                sampleCount: 1
            }
        },
        categoryHistory: {
            "FND-OPERAT": history({
                categoryId: "FND-OPERAT",
                familyId: "FND",
                generatedCount: 2,
                acceptedCount: 2,
                completedCount: 2,
                lastGenerated: 2,
                lastCompleted: 4
            }),
            "GRAPH-F-TRAV": history({
                categoryId: "GRAPH-F-TRAV",
                familyId: "GRAPH-F",
                generatedCount: 1,
                acceptedCount: 1,
                completedCount: 1,
                lastGenerated: 3,
                lastCompleted: 5
            }),
            "OPT-SCHED": history({
                categoryId: "OPT-SCHED",
                familyId: "OPT",
                generatedCount: 1,
                acceptedCount: 1,
                failedCount: 1,
                lastGenerated: 4
            })
        }
    });
}

function history(overrides) {
    return {
        generatedCount: 0,
        acceptedCount: 0,
        completedCount: 0,
        failedCount: 0,
        lastGenerated: null,
        lastCompleted: null,
        ...overrides
    };
}
