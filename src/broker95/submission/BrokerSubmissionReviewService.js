import {
    randomUUID
} from "node:crypto";
import { assertBrokerTestEnvironment } from "./BrokerTestEnvironmentGuard.js";

import {
    requireFunction,
    requirePort
} from "../../application/ports/ApplicationPorts.js";
import {
    BrokerOperationCoordinator,
    createBrokerOperationFingerprint
} from "../application/BrokerOperationCoordinator.js";
import {
    BrokerContractState
} from "../core/BrokerContract.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    getBrokerRiskRule
} from "../core/BrokerRiskRules.js";
import {
    assertBrokerLlmAvailable
} from "../llm/BrokerLlmAvailability.js";
import {
    brokerSubmissionReviewValidator
} from "./BrokerSubmissionReview.js";
import {
    createBrokerSubmissionReviewRequest
} from "./BrokerSubmissionReviewRequest.js";
import {
    createBrokerSubmissionRepair,
    createBrokerSubmissionRepairRequestId
} from "./BrokerSubmissionResponseRepair.js";

export const BROKER_SUBMISSION_REVIEW_RESULT_VERSION = 1;

/**
 * Revisa una captura exacta sin escribir en el editor ni mutar la partida.
 * Las pruebas y la evidencia permanecen privadas del Extension Host.
 */
export class BrokerSubmissionReviewService {

    constructor(options = {}) {
        this.gameSession = requirePort(
            options.gameSession,
            "brokerGameSession",
            ["initialize", "getState"]
        );
        this.availability = requirePort(
            options.availability,
            "brokerLlmAvailability",
            ["getSnapshot"]
        );
        this.llm = requirePort(
            options.llm,
            "brokerLlmPort",
            ["reviewSubmission"]
        );
        this.documentCapture = requirePort(
            options.documentCapture,
            "brokerDocumentCapture",
            ["capture"]
        );
        this.testExecution = requirePort(
            options.testExecution,
            "brokerTestExecution",
            ["executeContractCapture"]
        );
        this.staticEvidence = requirePort(
            options.staticEvidence,
            "brokerStaticEvidence",
            ["collectCapture"]
        );
        this.validator = requirePort(
            options.validator ??
                brokerSubmissionReviewValidator,
            "brokerSubmissionReviewValidator",
            ["validate"]
        );
        this.createRequestId = requireFunction(
            options.createRequestId ??
                defaultRequestId,
            "createBrokerReviewRequestId"
        );
        this.operations = requirePort(
            options.operationCoordinator ??
                new BrokerOperationCoordinator(),
            "brokerSubmissionReviewOperations",
            ["execute"]
        );
        this.catalogs = options.catalogs;
        this.categoryCatalog =
            options.categoryCatalog;
    }

    async review(options = {}) {
        const execution = normalizeExecutionOptions(
            options
        );
        const requestId = execution.requestId ??
            this.createRequestId();

        return this.operations.execute(
            {
                operation: "submission/review",
                requestId,
                fingerprint:
                    createBrokerOperationFingerprint({
                        kind: "selected-document",
                        documentSelector:
                            execution.documentSelector
                    }),
                lane: "submission-review"
            },
            () => this.#review({
                ...execution,
                requestId
            })
        );
    }

    async #review(execution) {

        await this.gameSession.initialize();

        const state = this.gameSession.getState();
        const contract = requireActiveContract(state);
        const availability = this.availability
            .getSnapshot();

        assertBrokerLlmAvailable(
            availability.llmStatus
        );

        const capture = await captureSelectedDocument(
            this.documentCapture,
            execution.documentSelector
        );
        const staticEvidence = this.staticEvidence
            .collectCapture(capture);
        const testExecution = await this.testExecution
            .executeContractCapture(
                contract,
                capture,
                { signal: execution.signal }
            );
        assertBrokerTestEnvironment(testExecution);
        const requestSource = {
            model:
                availability.settings.model,
            contract,
            capture,
            testExecution,
            staticEvidence
        };
        const request =
            createBrokerSubmissionReviewRequest(
                {
                    requestId:
                        execution.requestId,
                    ...requestSource
                },
                {
                    catalogs: this.catalogs,
                    categoryCatalog:
                        this.categoryCatalog
                }
            );
        let llmResult = await this.llm
            .reviewSubmission(
                request,
                { signal: execution.signal }
            );
        const riskRule = getBrokerRiskRule(
            contract.risk
        );
        const validationOptions = {
            activeDimensions:
                riskRule.activeCriteria,
            pedagogicalContext:
                request.context.pedagogy ?? null
        };
        const firstOutput = requireReviewOutput(
            llmResult
        );
        let review;
        let attempts = 1;

        try {
            review = this.validator.validate(
                firstOutput,
                validationOptions
            );
        } catch (validationError) {
            const repair =
                createBrokerSubmissionRepair({
                    validationError,
                    previousResponse: firstOutput
                });
            const repairRequest =
                createBrokerSubmissionReviewRequest(
                    {
                        requestId:
                            createBrokerSubmissionRepairRequestId(
                                execution.requestId,
                                "review"
                            ),
                        ...requestSource,
                        repair
                    },
                    {
                        catalogs: this.catalogs,
                        categoryCatalog:
                            this.categoryCatalog
                    }
                );

            llmResult = await this.llm
                .reviewSubmission(
                    repairRequest,
                    { signal: execution.signal }
                );
            review = this.validator.validate(
                requireReviewOutput(llmResult),
                validationOptions
            );
            attempts = 2;
        }

        return Object.freeze({
            resultVersion:
                BROKER_SUBMISSION_REVIEW_RESULT_VERSION,
            contractId: contract.id,
            stateRevision: state.revision,
            document: Object.freeze({
                name: capture.document.name,
                languageId:
                    capture.document.languageId,
                version: capture.document.version,
                sourceHash: capture.sourceHash
            }),
            deterministicEvidence: Object.freeze({
                testStatus: testExecution.status,
                testSummary: testExecution.summary,
                staticStatus:
                    staticEvidence.status
            }),
            review,
            provider: Object.freeze({
                providerId:
                    llmResult.providerId,
                model: llmResult.model,
                responseId:
                    llmResult.responseId ?? null,
                finishReason:
                    llmResult.finishReason,
                usage: llmResult.usage ?? null,
                attempts,
                repaired: attempts > 1
            })
        });
    }
}

function requireActiveContract(state) {
    const contract = state?.contracts?.find(
        item => item.id ===
            state.activeContractId
    );

    if (
        contract?.state !==
            BrokerContractState.ACTIVE
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_REVIEW_ACTIVE_CONTRACT_REQUIRED",
            "Acepta un contrato antes de solicitar una revisión.",
            []
        );
    }

    return contract;
}

function normalizeExecutionOptions(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).some(
            key => ![
                "requestId",
                "signal",
                "onDelta",
                "documentSelector"
            ].includes(key)
        ) ||
        (
            value.onDelta != null &&
            typeof value.onDelta !== "function"
        )
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_REVIEW_OPTIONS_INVALID",
            "No fue posible iniciar la revisión.",
            []
        );
    }

    return Object.freeze({
        requestId: value.requestId ?? null,
        signal: value.signal ?? null,
        onDelta: value.onDelta ?? null,
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
        throw BrokerGameError.invalidRule(
            "BROKER95_REVIEW_DOCUMENT_SELECTOR_INVALID",
            "La ruta del documento para revisar no es válida.",
            []
        );
    }

    return value.trim();
}

function requireReviewOutput(result) {
    if (
        result == null ||
        typeof result !== "object" ||
        !Object.hasOwn(result, "output")
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_REVIEW_RESPONSE_INVALID",
            "CIPHER devolvió una revisión que no pudo validarse.",
            []
        );
    }

    return result.output;
}

function defaultRequestId() {
    return `review:${randomUUID()}`;
}
