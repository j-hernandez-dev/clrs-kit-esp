import {
    createBrokerCategoryHistory,
    recordBrokerCategoryAccepted,
    recordBrokerCategoryGenerated,
    recordBrokerCategoryOutcome
} from "./BrokerCategoryHistory.js";
import {
    BrokerContractType,
    BrokerContractState,
    createBrokerContract,
    isBrokerLearningContract,
    updateBrokerContract
} from "./BrokerContract.js";
import {
    BrokerGameError
} from "./BrokerGameError.js";
import {
    BROKER_GAME_OVER_ALERT_LEVEL,
    BrokerGameStatus,
    calculateBrokerFinalScore,
    getBrokerCountermeasure,
    isBrokerGameOverAlert,
    nextBrokerAlertLevel
} from "./BrokerGameRules.js";
import {
    calculateBrokerPayout
} from "./BrokerPaymentRules.js";
import {
    getBrokerRiskRule
} from "./BrokerRiskRules.js";
import {
    assertBrokerGameState,
    createBrokerGameState,
    evolveBrokerGameState
} from "./BrokerGameState.js";
import {
    createBrokerStatistics,
    recordBrokerOutcome
} from "./BrokerStatistics.js";
import {
    createBrokerTechnicalProfile,
    recordBrokerTechnicalScores
} from "./BrokerTechnicalProfile.js";
import {
    BROKER_LEARNING_PASSING_SCORE
} from "../learning/BrokerLearningProgress.js";
import {
    BrokerLearningRouteId,
    getBrokerLearningRouteProgress,
    requireBrokerLearningRouteId,
    resetBrokerLearningRoutesProgress
} from "../learning/BrokerLearningRoutesProgress.js";
import {
    getBrokerLearningRouteAttemptContext,
    linkBrokerLearningRouteContract,
    releaseBrokerLearningRouteContract,
    releaseBrokerLearningRouteContracts,
    resolveBrokerLearningRouteAttempt
} from "../learning/BrokerLearningRoutesProgressTransition.js";
import {
    brokerLearningCatalog
} from "../learning/BrokerLearningCatalog.js";
import {
    requireBrokerLearningGamePolicy
} from "../learning/BrokerLearningGamePolicy.js";
import {
    brokerCategoryCatalog
} from "../catalog/BrokerCategoryCatalog.js";

export function addBrokerContract(
    state,
    draft,
    options = {}
) {
    requirePlaying(state, options);

    const contract = createBrokerContract(
        {
            ...draft,
            contractType:
                draft.contractType ??
                BrokerContractType.CLIENT,
            id: state.nextContractId,
            createdOrder:
                state.nextContractId,
            state:
                BrokerContractState.PENDING
        },
        { catalogs: options.catalogs }
    );
    const learningProgress =
        isBrokerLearningContract(contract)
            ? linkLearningContract(
                state.learningProgress,
                contract,
                options
            )
            : state.learningProgress;

    return evolveBrokerGameState(
        state,
        {
            contracts: [
                ...state.contracts,
                contract
            ],
            nextContractId:
                state.nextContractId + 1,
            learningProgress,
            categoryHistory:
                recordBrokerCategoryGenerated(
                    state.categoryHistory,
                    contract
                )
        },
        { catalogs: options.catalogs }
    );
}

/**
 * Construye la identidad educativa desde el estado autoritativo. El borrador
 * sólo aporta el contenido narrativo y los casos de prueba; no puede elegir
 * dificultad, categoría, intento ni recompensa.
 */
export function addBrokerLearningContract(
    state,
    lessonId,
    draft,
    options = {}
) {
    requirePlaying(state, options);
    const gamePolicy =
        requireBrokerLearningGamePolicy();

    const routeId = options.routeId ??
        BrokerLearningRouteId.PROGRAMMING;
    const context =
        getBrokerLearningRouteAttemptContext(
            state.learningProgress,
            { routeId, lessonId },
            { catalogs: options.catalogs }
        );
    const catalog =
        options.catalogs?.[routeId] ??
        (
            routeId ===
                BrokerLearningRouteId.PROGRAMMING
                ? brokerLearningCatalog
                : null
        );

    if (catalog == null) {
        invalidTransition(
            "BROKER95_LEARNING_ROUTE_NOT_CATALOGED",
            "La ruta de aprendizaje todavía no dispone de un catálogo curricular."
        );
    }

    const lesson = catalog.requireLesson(
        lessonId
    );
    const category =
        brokerCategoryCatalog.requireCategory(
            context.categoryId
        );

    return addBrokerContract(
        state,
        {
            ...draft,
            contractType:
                BrokerContractType.LEARNING,
            categoryId: category.categoryId,
            categoryName: category.categoryName,
            familyId: category.familyId,
            familyName: category.familyName,
            risk: gamePolicy.risk,
            client: "CIPHER",
            payPotential:
                context.effectiveReward,
            learningRouteId: routeId,
            lessonId: lesson.id,
            sectionId: lesson.sectionId,
            learningAttempt:
                context.learningAttempt,
            baseReward: context.baseReward,
            effectiveReward:
                context.effectiveReward,
            createdAt:
                options.createdAt ??
                draft?.createdAt ??
                state.revision + 1
        },
        { catalogs: options.catalogs }
    );
}

export function acceptBrokerContract(
    state,
    contractId,
    options = {}
) {
    requirePlaying(state, options);

    if (state.activeContractId != null) {
        invalidTransition(
            "BROKER95_ACTIVE_CONTRACT_EXISTS",
            "Ya existe un contrato activo."
        );
    }

    const contract = findContract(
        state,
        contractId
    );

    if (
        contract.state !==
        BrokerContractState.PENDING
    ) {
        invalidTransition(
            "BROKER95_CONTRACT_NOT_PENDING",
            "Solo puede aceptarse un contrato pendiente."
        );
    }

    const alertLevel = nextBrokerAlertLevel(
        state.alertLevel,
        getBrokerRiskRule(contract.risk)
            .alertIncrement
    );
    const categoryHistory =
        recordBrokerCategoryAccepted(
            state.categoryHistory,
            contract
        );

    if (isBrokerGameOverAlert(alertLevel)) {
        const learningProgress =
            releaseAllBrokerLearningContracts(
                state.learningProgress,
                state.contracts,
                options
            );

        return evolveBrokerGameState(
            state,
            gameOverChanges(
                categoryHistory,
                learningProgress
            ),
            { catalogs: options.catalogs }
        );
    }

    return evolveBrokerGameState(state, {
        alertLevel,
        categoryHistory,
        activeContractId: contract.id,
        contracts: replaceContract(
            state.contracts,
            updateBrokerContract(
                contract,
                {
                    state:
                        BrokerContractState.ACTIVE,
                    acceptedAt:
                        options.acceptedAt ??
                        null
                },
                { catalogs: options.catalogs }
            )
        )
    }, { catalogs: options.catalogs });
}

export function deleteBrokerContract(
    state,
    contractId,
    options = {}
) {
    requirePlaying(state, options);
    const contract = findContract(
        state,
        contractId
    );

    if (
        contract.state !==
        BrokerContractState.PENDING
    ) {
        invalidTransition(
            "BROKER95_CONTRACT_DELETE_FORBIDDEN",
            "Solo pueden eliminarse contratos pendientes."
        );
    }

    const learningProgress =
        isBrokerLearningContract(contract)
            ? releaseBrokerLearningRouteContract(
                state.learningProgress,
                learningContractIdentity(
                    contract
                ),
                { catalogs: options.catalogs }
            )
            : state.learningProgress;

    return evolveBrokerGameState(state, {
        contracts: replaceContract(
            state.contracts,
            updateBrokerContract(
                contract,
                {
                    state:
                        BrokerContractState.DELETED
                },
                { catalogs: options.catalogs }
            )
        ),
        learningProgress
    }, { catalogs: options.catalogs });
}

export function purgeBrokerContracts(
    state,
    options = {}
) {
    requirePlaying(state, options);
    const pending = state.contracts.filter(
        contract =>
            contract.state ===
                BrokerContractState.PENDING
    );

    if (pending.length === 0) {
        return state;
    }

    const pendingIds = new Set(
        pending.map(contract => contract.id)
    );
    const learningProgress =
        releaseBrokerLearningRouteContracts(
            state.learningProgress,
            pending
                .filter(isBrokerLearningContract)
                .map(learningContractIdentity),
            { catalogs: options.catalogs }
        );

    return evolveBrokerGameState(state, {
        contracts: state.contracts.map(
            contract =>
                pendingIds.has(contract.id)
                    ? updateBrokerContract(
                        contract,
                        {
                            state:
                                BrokerContractState.DELETED
                        },
                        { catalogs: options.catalogs }
                    )
                    : contract
        ),
        learningProgress
    }, { catalogs: options.catalogs });
}

export function settleBrokerContract(
    state,
    evaluation = {},
    options = {}
) {
    requirePlaying(state, options);

    if (state.activeContractId == null) {
        invalidTransition(
            "BROKER95_ACTIVE_CONTRACT_REQUIRED",
            "No hay ningún contrato activo."
        );
    }

    const contract = findContract(
        state,
        state.activeContractId
    );
    const dimensionScores =
        Object.freeze({
            ...(evaluation
                .dimensionScores ?? {})
        });
    const finalScore =
        calculateBrokerFinalScore(
            contract.risk,
            dimensionScores
        );
    const learning =
        isBrokerLearningContract(contract);
    const payout = learning
        ? calculateBrokerLearningImprovementPayout(
            state.learningProgress,
            contract,
            finalScore,
            options
        )
        : calculateBrokerPayout(
            contract.payPotential,
            finalScore
        );
    const completed = learning
        ? finalScore >=
            BROKER_LEARNING_PASSING_SCORE
        : payout > 0;
    const nextContract =
        updateBrokerContract(
            contract,
            {
                state: completed
                    ? BrokerContractState
                        .COMPLETED
                    : BrokerContractState
                        .FAILED,
                closedAt:
                    evaluation.submittedAt ??
                    null,
                payout,
                evaluation: {
                    dimensionScores,
                    finalScore,
                    payout,
                    completed
                }
            },
            { catalogs: options.catalogs }
        );
    const learningProgress = learning
        ? resolveBrokerLearningRouteAttempt(
            state.learningProgress,
            {
                ...learningContractIdentity(
                    contract
                ),
                score: finalScore,
                resolvedAt:
                    evaluation.submittedAt
            },
            { catalogs: options.catalogs }
        )
        : state.learningProgress;

    return evolveBrokerGameState(state, {
        money: state.money + payout,
        activeContractId: null,
        contracts: replaceContract(
            state.contracts,
            nextContract
        ),
        completedContractIds:
            completed
                ? [
                    ...state.completedContractIds,
                    contract.id
                ]
                : state.completedContractIds,
        failedContractIds:
            completed
                ? state.failedContractIds
                : [
                    ...state.failedContractIds,
                    contract.id
                ],
        learningProgress,
        technicalProfile:
            recordBrokerTechnicalScores(
                state.technicalProfile,
                dimensionScores
            ),
        statistics: recordBrokerOutcome(
            state.statistics,
            {
                contract,
                completed,
                payout
            }
        ),
        categoryHistory:
            recordBrokerCategoryOutcome(
                state.categoryHistory,
                nextContract,
                completed,
                state.revision + 1
            )
    }, { catalogs: options.catalogs });
}

export function purchaseBrokerCountermeasure(
    state,
    countermeasureId,
    options = {}
) {
    requirePlaying(state, options);
    const countermeasure =
        getBrokerCountermeasure(
            countermeasureId
        );

    if (state.alertLevel === 0) {
        invalidTransition(
            "BROKER95_ALERT_ALREADY_ZERO",
            "El nivel de alerta ya se encuentra en cero."
        );
    }

    if (state.money < countermeasure.price) {
        invalidTransition(
            "BROKER95_MONEY_INSUFFICIENT",
            "No hay dinero suficiente para comprar esta contramedida."
        );
    }

    return evolveBrokerGameState(state, {
        money:
            state.money -
            countermeasure.price,
        alertLevel: countermeasure.reset
            ? 0
            : Math.max(
                0,
                state.alertLevel -
                countermeasure.reduction
            )
    }, { catalogs: options.catalogs });
}

/**
 * Elimina el aprendizaje histórico usado por la selección adaptativa sin
 * alterar la partida, la economía ni las estadísticas. Los contratos que aún
 * pueden cambiar de estado conservan el anclaje mínimo que necesitan las
 * transiciones de aceptar y cerrar.
 */
export function clearBrokerCategoryHistory(
    state,
    options = {}
) {
    assertBrokerGameState(
        state,
        { catalogs: options.catalogs }
    );

    const openContracts = state.contracts
        .filter(contract =>
            contract.state ===
                BrokerContractState.PENDING ||
            contract.state ===
                BrokerContractState.ACTIVE
        )
        .sort((left, right) =>
            left.createdOrder -
            right.createdOrder
        );
    let categoryHistory =
        createBrokerCategoryHistory();

    for (const contract of openContracts) {
        categoryHistory =
            recordBrokerCategoryGenerated(
                categoryHistory,
                contract
            );

        if (
            contract.state ===
            BrokerContractState.ACTIVE
        ) {
            categoryHistory =
                recordBrokerCategoryAccepted(
                    categoryHistory,
                    contract
                );
        }
    }

    if (
        categoryHistoriesEqual(
            state.categoryHistory,
            categoryHistory
        )
    ) {
        return state;
    }

    return evolveBrokerGameState(state, {
        categoryHistory
    }, { catalogs: options.catalogs });
}

export function resetBrokerGameProgress(
    state,
    options = {}
) {
    assertBrokerGameState(
        state,
        { catalogs: options.catalogs }
    );

    return evolveBrokerGameState(state, {
        status: BrokerGameStatus.PLAYING,
        money: 0,
        alertLevel: 0,
        nextContractId: 1,
        activeContractId: null,
        contracts: [],
        completedContractIds: [],
        failedContractIds: [],
        categoryHistory:
            state.categoryHistory,
        statistics: createBrokerStatistics(),
        technicalProfile:
            createBrokerTechnicalProfile(),
        learningProgress:
            resetBrokerLearningRoutesProgress(
                state.learningProgress,
                { catalogs: options.catalogs }
            )
    }, { catalogs: options.catalogs });
}

export function startBrokerNewRun(
    state,
    options = {}
) {
    assertBrokerGameState(
        state,
        { catalogs: options.catalogs }
    );

    if (
        state.status !==
        BrokerGameStatus.GAME_OVER
    ) {
        invalidTransition(
            "BROKER95_NEW_RUN_FORBIDDEN",
            "Solo puede iniciarse una nueva partida después de un game over."
        );
    }

    return evolveBrokerGameState(state, {
        status: BrokerGameStatus.PLAYING,
        money: 0,
        alertLevel: 0,
        activeContractId: null,
        contracts: [],
        completedContractIds: [],
        failedContractIds: [],
        categoryHistory:
            state.categoryHistory,
        statistics: state.statistics,
        technicalProfile:
            state.technicalProfile,
        learningProgress:
            state.learningProgress
    }, { catalogs: options.catalogs });
}

export class BrokerStateTransition {

    addContract(state, draft, options) {
        return addBrokerContract(
            state,
            draft,
            options
        );
    }

    addLearningContract(
        state,
        lessonId,
        draft,
        options
    ) {
        return addBrokerLearningContract(
            state,
            lessonId,
            draft,
            options
        );
    }

    acceptContract(
        state,
        contractId,
        options
    ) {
        return acceptBrokerContract(
            state,
            contractId,
            options
        );
    }

    deleteContract(state, contractId, options) {
        return deleteBrokerContract(
            state,
            contractId,
            options
        );
    }

    purgeContracts(state, options) {
        return purgeBrokerContracts(
            state,
            options
        );
    }

    settleContract(state, evaluation, options) {
        return settleBrokerContract(
            state,
            evaluation,
            options
        );
    }

    purchaseCountermeasure(state, id, options) {
        return purchaseBrokerCountermeasure(
            state,
            id,
            options
        );
    }

    clearCategoryHistory(state, options) {
        return clearBrokerCategoryHistory(
            state,
            options
        );
    }

    resetGameProgress(state, options) {
        return resetBrokerGameProgress(
            state,
            options
        );
    }

    startNewRun(state, options) {
        return startBrokerNewRun(
            state,
            options
        );
    }
}

export const brokerStateTransition =
    Object.freeze(
        new BrokerStateTransition()
    );

function requirePlaying(state, options = {}) {
    assertBrokerGameState(
        state,
        { catalogs: options.catalogs }
    );

    if (
        state.status !==
        BrokerGameStatus.PLAYING
    ) {
        invalidTransition(
            "BROKER95_GAME_OVER",
            "La partida ha terminado."
        );
    }
}

function findContract(state, contractId) {
    const contract = state.contracts.find(
        item => item.id === contractId
    );

    if (!contract) {
        invalidTransition(
            "BROKER95_CONTRACT_NOT_FOUND",
            "No se encontró el contrato indicado."
        );
    }

    return contract;
}

function replaceContract(
    contracts,
    replacement
) {
    return contracts.map(contract =>
        contract.id === replacement.id
            ? replacement
            : contract
    );
}

function gameOverChanges(
    categoryHistory,
    learningProgress
) {
    return {
        status: BrokerGameStatus.GAME_OVER,
        money: 0,
        alertLevel:
            BROKER_GAME_OVER_ALERT_LEVEL,
        activeContractId: null,
        contracts: [],
        completedContractIds: [],
        failedContractIds: [],
        categoryHistory,
        learningProgress
    };
}

function linkLearningContract(
    progress,
    contract,
    options = {}
) {
    const context =
        getBrokerLearningRouteAttemptContext(
            progress,
            {
                routeId:
                    learningRouteId(contract),
                lessonId: contract.lessonId
            },
            { catalogs: options.catalogs }
        );
    const repetition = context.repetition;

    if (
        contract.sectionId !==
            context.sectionId ||
        contract.learningAttempt !==
            context.learningAttempt ||
        contract.baseReward !==
            context.baseReward ||
        contract.effectiveReward !==
            context.effectiveReward ||
        contract.categoryId !==
            context.categoryId ||
        contract.familyId !==
            context.familyId ||
        repetition !== context.repetition
    ) {
        invalidTransition(
            "BROKER95_LEARNING_CONTRACT_CONTEXT_MISMATCH",
            "El contrato no coincide con el intento educativo disponible."
        );
    }

    return linkBrokerLearningRouteContract(
        progress,
        {
            routeId: context.routeId,
            sectionId: contract.sectionId,
            lessonId: contract.lessonId,
            contractId: contract.id,
            createdAt:
                contract.createdAt ??
                contract.createdOrder
        },
        { catalogs: options.catalogs }
    );
}

function calculateBrokerLearningImprovementPayout(
    progress,
    contract,
    score,
    options = {}
) {
    const routeProgress =
        getBrokerLearningRouteProgress(
            progress,
            learningRouteId(contract),
            { catalogs: options.catalogs }
        );
    const previousBestScore =
        routeProgress.lessonAttempts[
            contract.lessonId
        ]?.bestScore ?? null;
    const achieved = calculateBrokerPayout(
        contract.baseReward,
        score
    );
    const previouslyPaid =
        previousBestScore == null
            ? 0
            : calculateBrokerPayout(
                contract.baseReward,
                previousBestScore
            );

    return Math.max(
        0,
        achieved - previouslyPaid
    );
}

function releaseAllBrokerLearningContracts(
    progress,
    contracts,
    options = {}
) {
    return releaseBrokerLearningRouteContracts(
        progress,
        contracts
            .filter(contract =>
                isBrokerLearningContract(
                    contract
                ) &&
                (
                    contract.state ===
                        BrokerContractState.PENDING ||
                    contract.state ===
                        BrokerContractState.ACTIVE
                )
            )
            .map(learningContractIdentity),
        { catalogs: options.catalogs }
    );
}

function learningRouteId(contract) {
    return requireBrokerLearningRouteId(
        contract.learningRouteId
    );
}

function learningContractIdentity(contract) {
    return {
        routeId: learningRouteId(contract),
        sectionId: contract.sectionId,
        lessonId: contract.lessonId,
        contractId: contract.id
    };
}

function invalidTransition(code, message) {
    throw BrokerGameError.invalidRule(
        code,
        message,
        []
    );
}

function categoryHistoriesEqual(left, right) {
    const leftEntries = Object.entries(left);
    const rightEntries = Object.entries(right);

    if (leftEntries.length !== rightEntries.length) {
        return false;
    }

    return leftEntries.every(
        ([categoryId, entry]) => {
            const candidate = right[categoryId];

            return candidate != null &&
                Object.keys(entry).every(
                    key =>
                        entry[key] ===
                        candidate[key]
                );
        }
    );
}

export function createInitialBrokerGameState(
    options = {}
) {
    return createBrokerGameState(options);
}
