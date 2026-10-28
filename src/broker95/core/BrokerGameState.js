import {
    createBrokerCategoryHistory
} from "./BrokerCategoryHistory.js";
import {
    BrokerContractState,
    createBrokerContract
} from "./BrokerContract.js";
import {
    BrokerGameError
} from "./BrokerGameError.js";
import {
    BROKER_ALERT_LIMIT,
    BROKER_GAME_OVER_ALERT_LEVEL,
    BrokerGameStatus,
    requireBrokerAlert
} from "./BrokerGameRules.js";
import {
    requireBrokerMoney
} from "./BrokerPaymentRules.js";
import {
    createBrokerStatistics
} from "./BrokerStatistics.js";
import {
    createBrokerTechnicalProfile
} from "./BrokerTechnicalProfile.js";
import {
    reconcileBrokerLearningRoutesProgress
} from "../learning/BrokerLearningRoutesProgressReconciliation.js";

export const BROKER_GAME_SCHEMA_VERSION = 4;

export function createBrokerGameState(
    source = {},
    options = {}
) {
    const schemaVersion =
        source.schemaVersion ??
        BROKER_GAME_SCHEMA_VERSION;
    const contracts = Object.freeze(
        (source.contracts ?? [])
            .map(contract =>
                createBrokerContract(
                    contract,
                    {
                        catalogs:
                            options.catalogs
                    }
                )
            )
    );
    const activeContracts =
        contracts.filter(contract =>
            contract.state ===
                BrokerContractState.ACTIVE
        );
    const activeContractId =
        source.activeContractId ?? null;
    const status =
        source.status ??
        BrokerGameStatus.PLAYING;
    const alertLevel =
        requireBrokerAlert(
            source.alertLevel ?? 0
        );
    const nextContractId =
        positiveInteger(
            source.nextContractId ?? 1,
            "BROKER95_NEXT_CONTRACT_ID_INVALID"
        );
    const money = requireBrokerMoney(
        source.money ?? 0
    );
    const completedContractIds =
        freezeIds(
            source.completedContractIds
        );
    const failedContractIds = freezeIds(
        source.failedContractIds
    );
    const categoryHistory =
        createBrokerCategoryHistory(
            source.categoryHistory
        );
    const learningProgress =
        reconcileBrokerLearningRoutesProgress(
            source.learningProgress ?? {},
            contracts,
            {
                catalogs: options.catalogs
            }
        );

    requireSchemaVersion(schemaVersion);
    requireStatus(status);
    requireStateConsistency({
        contracts,
        activeContracts,
        activeContractId,
        status,
        alertLevel,
        nextContractId,
        money,
        completedContractIds,
        failedContractIds
    });

    return Object.freeze({
        schemaVersion,
        revision: nonNegativeInteger(
            source.revision ?? 0,
            "BROKER95_REVISION_INVALID"
        ),
        status,
        money,
        alertLevel,
        nextContractId,
        activeContractId,
        contracts,
        completedContractIds,
        failedContractIds,
        categoryHistory,
        learningProgress,
        technicalProfile:
            createBrokerTechnicalProfile(
                source.technicalProfile
            ),
        statistics:
            createBrokerStatistics(
                source.statistics
            )
    });
}

export function evolveBrokerGameState(
    state,
    changes,
    options = {}
) {
    assertBrokerGameState(state, options);

    return createBrokerGameState(
        {
            ...state,
            ...changes,
            revision: state.revision + 1
        },
        options
    );
}

export function assertBrokerGameState(
    state,
    options = {}
) {
    createBrokerGameState(state, options);

    return state;
}

function requireStateConsistency({
    contracts,
    activeContracts,
    activeContractId,
    status,
    alertLevel,
    nextContractId,
    money,
    completedContractIds,
    failedContractIds
}) {
    const ids = contracts.map(
        contract => contract.id
    );

    if (new Set(ids).size !== ids.length) {
        invalidState(
            "BROKER95_CONTRACT_IDS_DUPLICATED"
        );
    }

    if (
        ids.some(id => id >= nextContractId)
    ) {
        invalidState(
            "BROKER95_NEXT_CONTRACT_ID_CONFLICT"
        );
    }


    requireOutcomeHistory({
        contracts,
        completedContractIds,
        failedContractIds
    });

    if (
        activeContracts.length > 1 ||
        (
            activeContractId == null &&
            activeContracts.length !== 0
        ) ||
        (
            activeContractId != null &&
            (
                activeContracts.length !== 1 ||
                activeContracts[0].id !==
                    activeContractId
            )
        )
    ) {
        invalidState(
            "BROKER95_ACTIVE_CONTRACT_INCONSISTENT"
        );
    }

    if (
        status === BrokerGameStatus.PLAYING &&
        alertLevel > BROKER_ALERT_LIMIT
    ) {
        invalidState(
            "BROKER95_PLAYING_ALERT_INVALID"
        );
    }

    if (
        status === BrokerGameStatus.GAME_OVER &&
        (
            alertLevel !==
                BROKER_GAME_OVER_ALERT_LEVEL ||
            money !== 0 ||
            contracts.length !== 0 ||
            activeContractId != null
        )
    ) {
        invalidState(
            "BROKER95_GAME_OVER_STATE_INVALID"
        );
    }
}

function requireOutcomeHistory({
    contracts,
    completedContractIds,
    failedContractIds
}) {
    const completed = new Set(
        completedContractIds
    );
    const failed = new Set(
        failedContractIds
    );

    if (
        completedContractIds.some(id =>
            failed.has(id)
        ) ||
        contracts.some(contract => {
            const isCompleted =
                contract.state ===
                BrokerContractState.COMPLETED;
            const isFailed =
                contract.state ===
                BrokerContractState.FAILED;

            return completed.has(contract.id) !==
                    isCompleted ||
                failed.has(contract.id) !==
                    isFailed;
        }) ||
        completedContractIds.some(id =>
            !contracts.some(contract =>
                contract.id === id
            )
        ) ||
        failedContractIds.some(id =>
            !contracts.some(contract =>
                contract.id === id
            )
        )
    ) {
        invalidState(
            "BROKER95_CONTRACT_OUTCOME_HISTORY_INCONSISTENT"
        );
    }
}

function requireSchemaVersion(value) {
    if (value !== BROKER_GAME_SCHEMA_VERSION) {
        throw BrokerGameError.invalidRule(
            "BROKER95_SCHEMA_VERSION_UNSUPPORTED",
            "La versión de la partida no es compatible.",
            [{ schemaVersion: value }]
        );
    }
}

function requireStatus(status) {
    if (
        !Object.values(BrokerGameStatus)
            .includes(status)
    ) {
        invalidState(
            "BROKER95_GAME_STATUS_INVALID"
        );
    }
}

function freezeIds(source = []) {
    if (!Array.isArray(source)) {
        invalidState(
            "BROKER95_CONTRACT_ID_HISTORY_INVALID"
        );
    }

    const values = source.map(value =>
        positiveInteger(
            value,
            "BROKER95_CONTRACT_ID_HISTORY_INVALID"
        )
    );

    if (new Set(values).size !== values.length) {
        invalidState(
            "BROKER95_CONTRACT_ID_HISTORY_INVALID"
        );
    }

    return Object.freeze(values);
}

function positiveInteger(value, code) {
    if (
        !Number.isInteger(value) ||
        value <= 0
    ) {
        throw BrokerGameError.invalidRule(
            code,
            "La partida contiene un identificador inválido.",
            [{ value }]
        );
    }

    return value;
}

function nonNegativeInteger(value, code) {
    if (
        !Number.isInteger(value) ||
        value < 0
    ) {
        throw BrokerGameError.invalidRule(
            code,
            "La partida contiene un contador inválido.",
            [{ value }]
        );
    }

    return value;
}

function invalidState(code) {
    throw BrokerGameError.invalidRule(
        code,
        "El estado guardado de BROKER.95 no es válido.",
        []
    );
}
