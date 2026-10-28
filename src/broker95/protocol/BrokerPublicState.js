import {
    createBrokerGameState
} from "../core/BrokerGameState.js";
import {
    BrokerContractState
} from "../core/BrokerContract.js";
import {
    BROKER_ALERT_LIMIT,
    BROKER_GAME_OVER_ALERT_LEVEL,
    BrokerGameStatus,
    getBrokerCountermeasures
} from "../core/BrokerGameRules.js";
import {
    createBrokerStatisticsView
} from "../statistics/BrokerStatisticsView.js";
import {
    assertBrokerPublicLearningMatches,
    createBrokerCatalogAdaptersFromPublicLearning,
    createBrokerPublicLearning,
    restoreBrokerLearningProgressFromPublic
} from "./BrokerPublicLearning.js";

export const BROKER_PUBLIC_STATE_VERSION = 5;

/**
 * Proyección de lectura para el Webview. Sólo los casos de aceptación del
 * contrato activo forman parte del expediente visible; la evaluación
 * detallada, los metadatos y las pruebas de otros contratos permanecen en el
 * Host.
 */
export function createBrokerPublicGameState(
    source,
    options = {}
) {
    const receivedPublicState =
        source?.publicStateVersion ===
            BROKER_PUBLIC_STATE_VERSION;
    const catalogs = options.catalogs ??
        (
            receivedPublicState
                ? createBrokerCatalogAdaptersFromPublicLearning(
                    source.learning
                )
                : undefined
        );
    const state = createBrokerGameState(
        receivedPublicState
            ? restorePrivateLifecycleShape(
                source
            )
            : source,
        { catalogs }
    );
    const gameOver = state.status ===
        BrokerGameStatus.GAME_OVER;
    const learning = createBrokerPublicLearning(
        state.learningProgress,
        { catalogs }
    );
    const result = Object.freeze({
        publicStateVersion:
            BROKER_PUBLIC_STATE_VERSION,
        schemaVersion: state.schemaVersion,
        revision: state.revision,
        status: state.status,
        gameOver,
        money: state.money,
        alertLevel: state.alertLevel,
        economy: createPublicEconomy(
            state,
            gameOver
        ),
        nextContractId: state.nextContractId,
        activeContractId: state.activeContractId,
        contracts: Object.freeze(
            state.contracts.map(contract =>
                createBrokerPublicContract(
                    contract,
                    state.activeContractId
                )
            )
        ),
        completedContractIds: Object.freeze([
            ...state.completedContractIds
        ]),
        failedContractIds: Object.freeze([
            ...state.failedContractIds
        ]),
        categoryHistory: state.categoryHistory,
        learning,
        technicalProfile: state.technicalProfile,
        statistics: state.statistics,
        statisticsView:
            createBrokerStatisticsView(
                state,
                { catalogs }
            )
    });

    if (receivedPublicState) {
        assertBrokerPublicLearningMatches(
            source.learning,
            learning
        );
    }

    return result;
}

function restorePrivateLifecycleShape(source) {
    return {
        ...source,
        learningProgress:
            restoreBrokerLearningProgressFromPublic(
                source.learning
            ),
        contracts: Array.isArray(source.contracts)
            ? source.contracts.map(contract => {
                const closed =
                    contract?.state ===
                        BrokerContractState.COMPLETED ||
                    contract?.state ===
                        BrokerContractState.FAILED;

                return closed &&
                    contract.evaluation == null
                    ? {
                        ...contract,
                        evaluation: {
                            publicProjection: true
                        }
                    }
                    : contract;
            })
            : source.contracts
    };
}

function createPublicEconomy(state, gameOver) {
    return Object.freeze({
        alertLimit: BROKER_ALERT_LIMIT,
        gameOverAlertLevel:
            BROKER_GAME_OVER_ALERT_LEVEL,
        countermeasures: Object.freeze(
            getBrokerCountermeasures()
                .map(rule => {
                    const affordable =
                        state.money >=
                            rule.price;
                    const unavailableReason =
                        gameOver
                            ? "game_over"
                            : state.alertLevel === 0
                                ? "alert_zero"
                                : !affordable
                                    ? "insufficient_funds"
                                    : null;

                    return Object.freeze({
                        id: rule.id,
                        name: rule.name,
                        price: rule.price,
                        reduction:
                            rule.reduction,
                        reset: rule.reset,
                        affordable,
                        available:
                            unavailableReason == null,
                        unavailableReason
                    });
                })
        )
    });
}

function createBrokerPublicContract(
    contract,
    activeContractId
) {
    const testCases =
        contract.id === activeContractId
            ? contract.testCases.map(
                createBrokerPublicTestCase
            )
            : [];

    return Object.freeze({
        id: contract.id,
        contractType: contract.contractType,
        title: contract.title,
        categoryId: contract.categoryId,
        categoryName: contract.categoryName,
        familyId: contract.familyId,
        familyName: contract.familyName,
        risk: contract.risk,
        weights: contract.weights,
        description: contract.description,
        requirements: Object.freeze([
            ...contract.requirements
        ]),
        testCases: Object.freeze(testCases),
        client: contract.client,
        payPotential: contract.payPotential,
        ...(contract.lessonId == null
            ? {}
            : {
                learningRouteId:
                    contract.learningRouteId,
                lessonId: contract.lessonId,
                sectionId:
                    contract.sectionId,
                learningAttempt:
                    contract.learningAttempt,
                baseReward:
                    contract.baseReward,
                effectiveReward:
                    contract.effectiveReward
            }),
        state: contract.state,
        createdOrder: contract.createdOrder,
        createdAt: contract.createdAt,
        acceptedAt: contract.acceptedAt,
        closedAt: contract.closedAt,
        payout: contract.payout
    });
}

function createBrokerPublicTestCase(testCase) {
    return Object.freeze({
        id: testCase.id,
        kind: testCase.kind,
        requirementIds: Object.freeze([
            ...testCase.requirementIds
        ]),
        explanation:
            testCase.explanation ??
            "Caso guardado sin explicación narrativa disponible.",
        stdin: testCase.stdin,
        expected: testCase.expected,
        comparison: testCase.comparison,
        timeoutMs: testCase.timeoutMs
    });
}
