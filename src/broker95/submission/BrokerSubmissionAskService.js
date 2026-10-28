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
    BrokerContractState
} from "../core/BrokerContract.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    assertBrokerLlmAvailable
} from "../llm/BrokerLlmAvailability.js";
import {
    createBrokerSubmissionAskRequest
} from "./BrokerSubmissionAskRequest.js";

export const BROKER_SUBMISSION_ASK_RESULT_VERSION = 1;

export class BrokerSubmissionAskService {

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
            ["askSubmission"]
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
        this.createRequestId = requireFunction(
            options.createRequestId ??
                defaultRequestId,
            "createBrokerAskRequestId"
        );
        this.operations = requirePort(
            options.operationCoordinator ??
                new BrokerOperationCoordinator(),
            "brokerSubmissionAskOperations",
            ["execute"]
        );
        this.catalogs = options.catalogs;
        this.categoryCatalog =
            options.categoryCatalog;
    }

    async ask(options = {}) {
        const execution = normalizeOptions(options);
        const requestId = execution.requestId ??
            this.createRequestId();

        return this.operations.execute(
            {
                operation: "submission/ask",
                requestId,
                fingerprint:
                    createBrokerOperationFingerprint({
                        kind: "active-document-question",
                        question: execution.question
                    }),
                lane: "submission-ask"
            },
            () => this.#ask({
                ...execution,
                requestId
            })
        );
    }

    async #ask(execution) {
        await this.gameSession.initialize();

        const state = this.gameSession.getState();
        const contract = requireActiveContract(state);
        const availability = this.availability
            .getSnapshot();

        assertBrokerLlmAvailable(
            availability.llmStatus
        );

        const capture = await captureDocument(
            this.documentCapture
        );
        const staticEvidence = this.staticEvidence
            .collectCapture(capture);
        const testExecution = await this.testExecution
            .executeContractCapture(
                contract,
                capture
            );
        const request =
            createBrokerSubmissionAskRequest(
                {
                    requestId: execution.requestId,
                    model:
                        availability.settings.model,
                    question: execution.question,
                    contract,
                    capture,
                    testExecution,
                    staticEvidence
                },
                {
                    catalogs: this.catalogs,
                    categoryCatalog:
                        this.categoryCatalog
                }
            );
        const llmResult = await this.llm
            .askSubmission(
                request,
                { signal: execution.signal }
            );
        const answer = requireAnswer(llmResult);

        return Object.freeze({
            resultVersion:
                BROKER_SUBMISSION_ASK_RESULT_VERSION,
            contract: Object.freeze({
                id: contract.id,
                title: contract.title
            }),
            stateRevision: state.revision,
            question: execution.question,
            answer,
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
                staticStatus: staticEvidence.status
            }),
            provider: Object.freeze({
                providerId: llmResult.providerId,
                model: llmResult.model,
                responseId:
                    llmResult.responseId ?? null,
                finishReason:
                    llmResult.finishReason,
                usage: llmResult.usage ?? null
            })
        });
    }
}

function requireActiveContract(state) {
    const contract = state?.contracts?.find(
        item => item.id === state.activeContractId
    );

    if (
        contract?.state !==
            BrokerContractState.ACTIVE
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_ASK_ACTIVE_CONTRACT_REQUIRED",
            "Acepta un contrato antes de consultar a CIPHER sobre tu código.",
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
                "signal",
                "question"
            ].includes(key)
        )
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_ASK_OPTIONS_INVALID",
            "No fue posible iniciar la consulta.",
            []
        );
    }

    return Object.freeze({
        requestId: value.requestId ?? null,
        signal: value.signal ?? null,
        question: normalizeQuestion(value.question)
    });
}

function normalizeQuestion(value) {
    if (value == null) {
        return null;
    }

    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > 8_192 ||
        value.includes("\u0000")
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_ASK_QUESTION_INVALID",
            "La pregunta para CIPHER no es válida.",
            []
        );
    }

    return value.trim();
}

async function captureDocument(documentCapture) {
    if (
        typeof documentCapture.captureSelected ===
            "function"
    ) {
        return documentCapture.captureSelected(null);
    }

    return documentCapture.capture();
}

function requireAnswer(result) {
    if (
        result == null ||
        typeof result !== "object" ||
        typeof result.output !== "string" ||
        result.output.trim().length === 0
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_ASK_RESPONSE_INVALID",
            "CIPHER devolvió una respuesta que no pudo leerse.",
            []
        );
    }

    return result.output.trim();
}

function defaultRequestId() {
    return `ask:${randomUUID()}`;
}
