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
    assertBrokerLlmAvailable
} from "../llm/BrokerLlmAvailability.js";
import {
    createBrokerEvaluationAnchors
} from "./BrokerEvaluationAnchors.js";
import {
    calculateBrokerEvaluationScores
} from "./BrokerEvaluationRubric.js";
import {
    brokerSubmissionEvaluationValidator
} from "./BrokerSubmissionEvaluation.js";
import {
    createBrokerSubmissionEvaluationRequest
} from "./BrokerSubmissionEvaluationRequest.js";
import {
    createBrokerSubmissionRepair,
    createBrokerSubmissionRepairRequestId
} from "./BrokerSubmissionResponseRepair.js";

export const BROKER_SUBMISSION_EVALUATION_RESULT_VERSION = 1;

/**
 * Solicita a CIPHER puntuaciones justificadas y conserva en el Host la
 * selección de criterios, agregación y nota final. No liquida el contrato.
 */
export class BrokerSubmissionEvaluationService {

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
            ["evaluateSubmission"]
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
                brokerSubmissionEvaluationValidator,
            "brokerSubmissionEvaluationValidator",
            ["validate"]
        );
        this.createRequestId = requireFunction(
            options.createRequestId ??
                defaultRequestId,
            "createBrokerEvaluationRequestId"
        );
        this.operations = requirePort(
            options.operationCoordinator ??
                new BrokerOperationCoordinator(),
            "brokerSubmissionEvaluationOperations",
            ["execute"]
        );
        this.catalogs = options.catalogs;
        this.categoryCatalog =
            options.categoryCatalog;
    }

    async evaluate(options = {}) {
        const execution = normalizeOptions(options);
        const requestId = execution.requestId ??
            this.createRequestId();

        return this.operations.execute(
            {
                operation:
                    "submission/evaluate",
                requestId,
                fingerprint:
                    createBrokerOperationFingerprint({
                        capture: "active-document"
                    }),
                lane: "submission-evaluation"
            },
            () => this.#evaluateActive({
                ...execution,
                requestId
            })
        );
    }

    async #evaluateActive(execution) {

        await this.gameSession.initialize();

        const state = this.gameSession.getState();
        const contract = requireActiveContract(state);
        const availability = this.availability
            .getSnapshot();

        assertBrokerLlmAvailable(
            availability.llmStatus
        );

        const capture = this.documentCapture.capture();

        return this.#evaluateCapture({
            execution,
            state,
            contract,
            availability,
            capture
        });
    }

    async evaluateCapture(capture, options = {}) {
        const execution = normalizeOptions(options);
        const requestId = execution.requestId ??
            this.createRequestId();

        requireCapture(capture);

        return this.operations.execute(
            {
                operation:
                    "submission/evaluate-capture",
                requestId,
                fingerprint:
                    createBrokerOperationFingerprint({
                        documentId:
                            capture.document.documentId,
                        documentVersion:
                            capture.document.version,
                        sourceHash:
                            capture.sourceHash
                    }),
                lane: "submission-evaluation"
            },
            () => this.#evaluateProvidedCapture(
                capture,
                {
                    ...execution,
                    requestId
                }
            )
        );
    }

    async #evaluateProvidedCapture(
        capture,
        execution
    ) {

        await this.gameSession.initialize();

        const state = this.gameSession.getState();
        const contract = requireActiveContract(state);
        const availability = this.availability
            .getSnapshot();

        assertBrokerLlmAvailable(
            availability.llmStatus
        );

        return this.#evaluateCapture({
            execution,
            state,
            contract,
            availability,
            capture
        });
    }

    async #evaluateCapture({
        execution,
        state,
        contract,
        availability,
        capture
    }) {
        const staticEvidence = this.staticEvidence
            .collectCapture(capture);
        const testExecution = await this.testExecution
            .executeContractCapture(
                contract,
                capture,
                { signal: execution.signal }
            );
        assertBrokerTestEnvironment(testExecution);
        const anchors = createBrokerEvaluationAnchors({
            contract,
            testExecution,
            staticEvidence
        });
        const requestSource = {
            model:
                availability.settings.model,
            contract,
            capture,
            testExecution,
            staticEvidence,
            anchors
        };
        const request =
            createBrokerSubmissionEvaluationRequest(
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
            .evaluateSubmission(
                request,
                { signal: execution.signal }
            );
        const firstOutput = requireEvaluationOutput(
            llmResult
        );
        let evaluation;
        let attempts = 1;

        try {
            evaluation = this.validator.validate(
                firstOutput,
                {
                    risk: contract.risk,
                    pedagogicalContext:
                        request.context
                            .pedagogy ?? null
                }
            );
        } catch (validationError) {
            const repair =
                createBrokerSubmissionRepair({
                    validationError,
                    previousResponse: firstOutput
                });
            const repairRequest =
                createBrokerSubmissionEvaluationRequest(
                    {
                        requestId:
                            createBrokerSubmissionRepairRequestId(
                                execution.requestId,
                                "evaluation"
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
                .evaluateSubmission(
                    repairRequest,
                    { signal: execution.signal }
                );
            evaluation = this.validator.validate(
                requireEvaluationOutput(llmResult),
                {
                    risk: contract.risk,
                    pedagogicalContext:
                        request.context
                            .pedagogy ?? null
                }
            );
            attempts = 2;
        }
        const criterionScores = Object.freeze(
            Object.fromEntries(
                evaluation.criteria.map(item => [
                    item.criterion,
                    item.score
                ])
            )
        );
        const scores = calculateBrokerEvaluationScores(
            contract.risk,
            criterionScores
        );

        return Object.freeze({
            resultVersion:
                BROKER_SUBMISSION_EVALUATION_RESULT_VERSION,
            contractId: contract.id,
            risk: contract.risk,
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
                    staticEvidence.status,
                anchors
            }),
            evaluation,
            criterionScores:
                scores.criterionScores,
            dimensionScores:
                scores.dimensionScores,
            finalScore: scores.finalScore,
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
            }),
            settlement: Object.freeze({
                performed: false,
                payoutCalculated: false,
                gameStateMutated: false
            })
        });
    }
}

function requireCapture(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        typeof value.sourceHash !== "string" ||
        typeof value.sourceCode !== "string" ||
        !Number.isSafeInteger(
            value.document?.version
        ) ||
        typeof value.document?.documentId !==
            "string"
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_EVALUATION_CAPTURE_INVALID",
            "No fue posible evaluar el documento CLRS activo.",
            []
        );
    }

    return value;
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
            "BROKER95_EVALUATION_ACTIVE_CONTRACT_REQUIRED",
            "Acepta un contrato antes de evaluar una entrega.",
            []
        );
    }

    return contract;
}

function normalizeOptions(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).some(
            key => ![
                "requestId",
                "signal"
            ].includes(key)
        )
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_EVALUATION_OPTIONS_INVALID",
            "No fue posible iniciar la evaluación.",
            []
        );
    }

    return Object.freeze({
        requestId: value.requestId ?? null,
        signal: value.signal ?? null
    });
}

function requireEvaluationOutput(result) {
    if (
        result == null ||
        typeof result !== "object" ||
        !Object.hasOwn(result, "output")
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_EVALUATION_RESPONSE_INVALID",
            "CIPHER devolvió una puntuación que no pudo validarse.",
            []
        );
    }

    return result.output;
}

function defaultRequestId() {
    return `evaluation:${randomUUID()}`;
}
