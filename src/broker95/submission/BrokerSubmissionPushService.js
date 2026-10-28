import {
    randomUUID
} from "node:crypto";

import {
    requireFunction,
    requirePort
} from "../../application/ports/ApplicationPorts.js";
import {
    BrokerOperationCoordinator,
    createBrokerOperationFingerprint
} from "../application/BrokerOperationCoordinator.js";
import {
    BrokerContractState,
    isBrokerLearningContract
} from "../core/BrokerContract.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    calculateBrokerPayout,
    getBrokerPayoutMultiplier
} from "../core/BrokerPaymentRules.js";
import {
    settleBrokerContract
} from "../core/BrokerStateTransition.js";
import {
    brokerLearningCatalog
} from "../learning/BrokerLearningCatalog.js";
import {
    BrokerLearningRouteId,
    getBrokerLearningRouteProgress
} from "../learning/BrokerLearningRoutesProgress.js";

export const BROKER_SUBMISSION_PUSH_RESULT_VERSION = 2;

/**
 * Entrega definitivamente una única captura CLRS ya evaluada. La liquidación
 * ocurre en una transacción con revisión optimista y no puede pagar dos veces.
 */
export class BrokerSubmissionPushService {

    constructor(options = {}) {
        this.gameSession = requirePort(
            options.gameSession,
            "brokerGameSession",
            ["initialize", "getState", "transact"]
        );
        this.documentCapture = requirePort(
            options.documentCapture,
            "brokerDocumentCapture",
            ["capture"]
        );
        this.evaluation = requirePort(
            options.evaluation,
            "brokerSubmissionEvaluation",
            ["evaluateCapture"]
        );
        this.now = requireFunction(
            options.now ?? Date.now,
            "brokerSubmissionPushClock"
        );
        this.createRequestId = requireFunction(
            options.createRequestId ??
                defaultRequestId,
            "createBrokerSubmissionPushRequestId"
        );
        this.operations = requirePort(
            options.operationCoordinator ??
                new BrokerOperationCoordinator(),
            "brokerSubmissionPushOperations",
            ["execute"]
        );
        this.catalogs = options.catalogs;
    }

    async push(options = {}) {
        const execution = normalizeOptions(options);
        const requestId = execution.requestId ??
            this.createRequestId();

        return this.operations.execute(
            {
                operation: "submission/push",
                requestId,
                fingerprint:
                    createBrokerOperationFingerprint({
                        kind: "selected-document",
                        documentSelector:
                            execution.documentSelector
                    }),
                lane: "submission-push"
            },
            () => this.#push({
                ...execution,
                requestId
            })
        );
    }

    async #push(execution) {

        await this.gameSession.initialize();
        const initialState =
            this.gameSession.getState();
        const activeContract = requireActiveContract(
            initialState
        );

        const capture = await captureSelectedDocument(
            this.documentCapture,
            execution.documentSelector
        );
        const evaluation = await this.evaluation
            .evaluateCapture(capture, {
                requestId: execution.requestId,
                signal: execution.signal
            });
        const submittedAt = requireTimestamp(
            this.now()
        );
        let settledContract = null;

        const state = await this.gameSession.transact(
            current => {
                requireMatchingEvaluation(
                    current,
                    evaluation
                );
                requireUnchangedDocument(
                    capture,
                    recaptureDocument(
                        this.documentCapture,
                        capture
                    )
                );

                const next = settleBrokerContract(
                    current,
                    {
                        dimensionScores:
                            evaluation.dimensionScores,
                        submittedAt
                    },
                    { catalogs: this.catalogs }
                );

                settledContract = next.contracts.find(
                    contract => contract.id ===
                        evaluation.contractId
                ) ?? null;

                requireMatchingSettlement(
                    settledContract,
                    evaluation
                );

                return next;
            },
            {
                expectedRevision:
                    evaluation.stateRevision
            }
        );

        return Object.freeze({
            resultVersion:
                BROKER_SUBMISSION_PUSH_RESULT_VERSION,
            contract: Object.freeze({
                id: settledContract.id,
                title: settledContract.title,
                risk: settledContract.risk,
                state: settledContract.state,
                completed:
                    settledContract.state ===
                    BrokerContractState.COMPLETED,
                payPotential:
                    settledContract.payPotential,
                payout: settledContract.payout,
                payoutMultiplier:
                    settledContract.payPotential === 0
                        ? 0
                        : settledContract.payout /
                            settledContract.payPotential,
                closedAt: settledContract.closedAt
            }),
            document: evaluation.document,
            deterministicEvidence:
                evaluation.deterministicEvidence,
            evaluation: evaluation.evaluation,
            criterionScores:
                evaluation.criterionScores,
            dimensionScores:
                evaluation.dimensionScores,
            finalScore: evaluation.finalScore,
            provider: evaluation.provider,
            learning:
                createLearningSettlementProjection({
                    contract: activeContract,
                    settledContract,
                    before:
                        getLearningContractProgress(
                            initialState
                                .learningProgress,
                            activeContract,
                            this.catalogs
                        ),
                    after:
                        getLearningContractProgress(
                            state.learningProgress,
                            activeContract,
                            this.catalogs
                        ),
                    finalScore:
                        evaluation.finalScore,
                    catalogs: this.catalogs
                }),
            settlement: Object.freeze({
                performed: true,
                stateRevision: state.revision,
                money: state.money,
                alertLevel: state.alertLevel,
                completedContracts:
                    state.statistics.completed,
                failedContracts:
                    state.statistics.failed
            })
        });
    }
}

function getLearningContractProgress(
    progress,
    contract,
    catalogs
) {
    if (!isBrokerLearningContract(contract)) {
        return null;
    }

    return getBrokerLearningRouteProgress(
        progress,
        contract.learningRouteId,
        { catalogs }
    );
}

function createLearningSettlementProjection({
    contract,
    settledContract,
    before,
    after,
    finalScore,
    catalogs
}) {
    if (!isBrokerLearningContract(contract)) {
        return null;
    }

    const lessonId = contract.lessonId;
    const previousAttempt =
        before.lessonAttempts[lessonId] ??
        null;
    const currentAttempt =
        after.lessonAttempts[lessonId];
    const wasCompleted =
        before.completedLessonIds.includes(
            lessonId
        );
    const lessonCompleted =
        after.completedLessonIds.includes(
            lessonId
        );
    const passed = settledContract.state ===
        BrokerContractState.COMPLETED;
    const firstCompletion =
        passed && !wasCompleted &&
        lessonCompleted;
    const bestScore =
        currentAttempt?.bestScore ?? null;
    const earnedToDate = bestScore == null
        ? 0
        : calculateBrokerPayout(
            contract.baseReward,
            bestScore
        );

    return Object.freeze({
        learningRouteId:
            contract.learningRouteId,
        lessonId,
        sectionId: contract.sectionId,
        learningAttempt:
            contract.learningAttempt,
        repetition: wasCompleted,
        passed,
        firstCompletion,
        lessonCompleted,
        progressAdvanced: firstCompletion,
        attempts: currentAttempt.attempts,
        previousBestScore:
            previousAttempt?.bestScore ?? null,
        bestScore,
        currentLessonId:
            after.currentLessonId,
        routeCompleted:
            after.learningCompletedAt != null,
        completedLessons:
            after.completedLessonIds.length,
        totalLessons:
            requireLearningCatalog(
                contract.learningRouteId,
                catalogs
            ).lessonCount,
        completedSections:
            after.completedSectionIds.length,
        reward: Object.freeze({
            baseReward: contract.baseReward,
            payPotential:
                contract.payPotential,
            payout: settledContract.payout,
            scorePercentage: Math.round(
                getBrokerPayoutMultiplier(
                    finalScore
                ) * 100
            ),
            paidPercentage: contract.payPotential === 0
                ? 0
                : Math.round(
                    settledContract.payout /
                        contract.payPotential *
                        100
                ),
            earnedToDate,
            policy: wasCompleted
                ? "best-score-improvement"
                : "score-percentage"
        })
    });
}

function requireLearningCatalog(routeId, catalogs) {
    const catalog = catalogs?.[routeId] ??
        (
            routeId ===
                BrokerLearningRouteId.PROGRAMMING
                ? brokerLearningCatalog
                : null
        );

    if (
        catalog != null &&
        Number.isSafeInteger(catalog.lessonCount) &&
        catalog.lessonCount > 0
    ) {
        return catalog;
    }

    invalid(
        "BROKER95_PUSH_LEARNING_ROUTE_NOT_CATALOGED",
        "La ruta educativa del contrato no está disponible."
    );
}

function requireActiveContract(state) {
    const contract = state?.contracts?.find(
        item => item.id === state.activeContractId
    );

    if (
        contract?.state !==
            BrokerContractState.ACTIVE
    ) {
        invalid(
            "BROKER95_PUSH_ACTIVE_CONTRACT_REQUIRED",
            "Acepta un contrato antes de realizar una entrega definitiva."
        );
    }

    return contract;
}

function requireMatchingEvaluation(state, evaluation) {
    const contract = requireActiveContract(state);

    if (
        evaluation == null ||
        typeof evaluation !== "object" ||
        contract.id !== evaluation.contractId ||
        contract.risk !== evaluation.risk ||
        evaluation.settlement?.performed !== false ||
        !Number.isSafeInteger(evaluation.finalScore) ||
        evaluation.dimensionScores == null ||
        typeof evaluation.dimensionScores !== "object"
    ) {
        invalid(
            "BROKER95_PUSH_EVALUATION_MISMATCH",
            "La evaluación ya no corresponde al contrato activo. Inténtalo nuevamente."
        );
    }
}

function requireUnchangedDocument(expected, actual) {
    if (
        actual == null ||
        expected.document.documentId !==
            actual.document?.documentId ||
        expected.document.languageId !==
            actual.document?.languageId ||
        expected.document.version !==
            actual.document?.version ||
        expected.sourceHash !== actual.sourceHash
    ) {
        invalid(
            "BROKER95_PUSH_DOCUMENT_CHANGED",
            "El documento CLRS cambió durante la evaluación. Repite ai -push para entregar la versión actual."
        );
    }
}

function requireMatchingSettlement(contract, evaluation) {
    const validState =
        contract?.state ===
            BrokerContractState.COMPLETED ||
        contract?.state ===
            BrokerContractState.FAILED;

    if (
        !validState ||
        contract.evaluation?.finalScore !==
            evaluation.finalScore ||
        contract.evaluation?.payout !==
            contract.payout
    ) {
        invalid(
            "BROKER95_PUSH_SETTLEMENT_MISMATCH",
            "No fue posible validar el resultado definitivo del contrato."
        );
    }
}

function normalizeOptions(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).some(
            key => ![
                "requestId",
                "signal",
                "documentSelector"
            ]
                .includes(key)
        )
    ) {
        invalid(
            "BROKER95_PUSH_OPTIONS_INVALID",
            "No fue posible iniciar la entrega definitiva."
        );
    }

    return Object.freeze({
        requestId: value.requestId ?? null,
        signal: value.signal ?? null,
        documentSelector:
            normalizeDocumentSelector(
                value.documentSelector
            )
    });
}

async function captureSelectedDocument(
    documentCapture,
    documentSelector
) {
    if (
        typeof documentCapture.captureSelected ===
            "function"
    ) {
        return documentCapture.captureSelected(
            documentSelector
        );
    }

    return documentCapture.capture();
}

function recaptureDocument(
    documentCapture,
    capture
) {
    if (
        typeof documentCapture.recapture ===
            "function"
    ) {
        return documentCapture.recapture(
            capture.document.documentId
        );
    }

    return documentCapture.capture();
}

function normalizeDocumentSelector(value) {
    if (value == null) {
        return null;
    }

    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > 2_048 ||
        value.includes("\u0000")
    ) {
        invalid(
            "BROKER95_PUSH_DOCUMENT_SELECTOR_INVALID",
            "La ruta del documento para entregar no es válida."
        );
    }

    return value.trim();
}

function requireTimestamp(value) {
    if (
        !(
            typeof value === "number" &&
            Number.isFinite(value) &&
            value >= 0
        ) &&
        !(
            typeof value === "string" &&
            value.trim().length > 0
        )
    ) {
        invalid(
            "BROKER95_PUSH_CLOCK_INVALID",
            "No fue posible registrar la entrega definitiva."
        );
    }

    return typeof value === "string"
        ? value.trim()
        : value;
}

function invalid(code, publicMessage) {
    throw BrokerGameError.invalidRule(
        code,
        publicMessage,
        []
    );
}

function defaultRequestId() {
    return `push:${randomUUID()}`;
}
