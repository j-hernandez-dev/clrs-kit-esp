import {
    BrokerContractState
} from "../core/BrokerContract.js";
import {
    createBrokerGameState
} from "../core/BrokerGameState.js";
import {
    BROKER_ALERT_LIMIT,
    BrokerGameStatus
} from "../core/BrokerGameRules.js";

export const BROKER_CIPHER_URGENT_ALERT_LEVEL =
    Math.ceil(BROKER_ALERT_LIMIT * 0.8);

export const BrokerCipherTone = Object.freeze({
    DRY: "dry",
    URGENT: "urgent",
    CRITICAL: "critical",
    RESPECTFUL: "respectful"
});

/**
 * Contexto compacto y de sólo lectura para la conversación libre. No incluye
 * código fuente, casos privados, metadatos ni capacidades de mutación.
 */
export function createBrokerConversationContext(
    source
) {
    const state = createBrokerGameState(source);
    const activeContract = state.activeContractId == null
        ? null
        : state.contracts.find(contract =>
            contract.id === state.activeContractId
        ) ?? null;
    const latestOutcome = selectLatestOutcome(
        state.contracts
    );

    return Object.freeze({
        contextVersion: 1,
        game: Object.freeze({
            status: state.status,
            money: state.money,
            alertLevel: state.alertLevel,
            alertLimit: BROKER_ALERT_LIMIT,
            progress: Object.freeze({
                completedContracts:
                    state.statistics.completed,
                failedContracts:
                    state.statistics.failed,
                totalEarned:
                    state.statistics.totalEarned
            }),
            activeContract:
                activeContract == null
                    ? null
                    : createActiveContractContext(
                        activeContract
                    ),
            latestOutcome:
                latestOutcome == null
                    ? null
                    : createOutcomeContext(
                        latestOutcome
                    )
        }),
        cipher: Object.freeze({
            identity: "CIPHER",
            role: "broker95-intermediary",
            language: "es",
            mode: "diegetic",
            tone: selectCipherTone(
                state,
                latestOutcome
            ),
            becomeImpatientOnlyAfterRepeatedOffTopicMessages:
                true
        }),
        boundaries: Object.freeze({
            gameStateAuthority: "extension-host",
            paymentAuthority: "extension-host",
            alertAuthority: "extension-host",
            persistenceAuthority: "extension-host",
            mayExplainProgramming: true,
            mayExplainBroker95: true,
            mayProvideCompleteContractSolution: false,
            academicCriteria: Object.freeze([
                "functionality",
                "robustness",
                "design"
            ])
        })
    });
}

function createActiveContractContext(contract) {
    return Object.freeze({
        id: contract.id,
        title: contract.title,
        client: contract.client,
        categoryId: contract.categoryId,
        categoryName: contract.categoryName,
        familyId: contract.familyId,
        familyName: contract.familyName,
        risk: contract.risk,
        description: contract.description,
        requirements: Object.freeze([
            ...contract.requirements
        ]),
        payPotential: contract.payPotential,
        state: contract.state
    });
}

function createOutcomeContext(contract) {
    return Object.freeze({
        contractId: contract.id,
        title: contract.title,
        state: contract.state,
        finalScore:
            contract.evaluation?.finalScore ??
            null,
        payout: contract.payout
    });
}

function selectLatestOutcome(contracts) {
    return contracts
        .filter(contract =>
            contract.state ===
                BrokerContractState.COMPLETED ||
            contract.state ===
                BrokerContractState.FAILED
        )
        .reduce(
            (latest, contract) =>
                latest == null ||
                contract.createdOrder >
                    latest.createdOrder
                    ? contract
                    : latest,
            null
        );
}

function selectCipherTone(state, latestOutcome) {
    if (
        state.status ===
            BrokerGameStatus.GAME_OVER ||
        latestOutcome?.state ===
            BrokerContractState.FAILED
    ) {
        return BrokerCipherTone.CRITICAL;
    }

    if (
        state.alertLevel >=
            BROKER_CIPHER_URGENT_ALERT_LEVEL
    ) {
        return BrokerCipherTone.URGENT;
    }

    if (
        latestOutcome?.state ===
            BrokerContractState.COMPLETED &&
        latestOutcome.evaluation
            ?.finalScore >= 90
    ) {
        return BrokerCipherTone.RESPECTFUL;
    }

    return BrokerCipherTone.DRY;
}
