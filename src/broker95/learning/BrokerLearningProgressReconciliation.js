import {
    BrokerContractState,
    isBrokerLearningContract
} from "../core/BrokerContract.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    createBrokerLearningProgress
} from "./BrokerLearningProgress.js";

const OPEN_CONTRACT_STATES = Object.freeze([
    BrokerContractState.PENDING,
    BrokerContractState.ACTIVE
]);

/**
 * Recalcula los enlaces efímeros lección/contrato usando la colección
 * autoritativa de contratos. Los logros e intentos cerrados permanecen en el
 * progreso educativo, incluso cuando una partida normal termina.
 */
export function reconcileBrokerLearningProgress(
    source = {},
    contracts = [],
    options = {}
) {
    if (!isRecord(source)) {
        invalidReconciliation(
            "BROKER95_LEARNING_RECONCILIATION_PROGRESS_INVALID"
        );
    }

    if (!Array.isArray(contracts)) {
        invalidReconciliation(
            "BROKER95_LEARNING_RECONCILIATION_CONTRACTS_INVALID"
        );
    }

    const progress = createBrokerLearningProgress({
        ...source,
        lessonContractLinks: {}
    }, options);
    const openLearningContracts = contracts
        .filter(contract =>
            isBrokerLearningContract(contract) &&
            OPEN_CONTRACT_STATES.includes(
                contract.state
            )
        )
        .sort((left, right) =>
            left.createdOrder -
            right.createdOrder
        );
    const links = {};

    for (const contract of openLearningContracts) {
        if (links[contract.lessonId] != null) {
            invalidReconciliation(
                "BROKER95_LEARNING_RECONCILIATION_LESSON_CONFLICT",
                [{
                    lessonId: contract.lessonId,
                    contractId: contract.id
                }]
            );
        }

        links[contract.lessonId] = {
            lessonId: contract.lessonId,
            contractId: contract.id,
            learningAttempt:
                contract.learningAttempt,
            repetition:
                progress.completedLessonIds
                    .includes(contract.lessonId)
        };
    }

    const firstOpenContract =
        openLearningContracts[0] ?? null;

    return createBrokerLearningProgress({
        ...progress,
        lessonContractLinks: links,
        learningStartedAt:
            progress.learningStartedAt ??
            firstOpenContract?.createdAt ??
            firstOpenContract?.createdOrder ??
            null
    }, options);
}

function isRecord(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        (
            Object.getPrototypeOf(value) ===
                Object.prototype ||
            Object.getPrototypeOf(value) === null
        );
}

function invalidReconciliation(
    code,
    diagnostics = []
) {
    throw BrokerGameError.invalidRule(
        code,
        "No fue posible reconciliar el progreso de aprendizaje guardado.",
        diagnostics
    );
}
