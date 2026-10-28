import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    BrokerLearningPedagogyMode,
    createBrokerLearningPedagogyContext
} from "../learning/BrokerLearningPedagogy.js";
import {
    createBrokerClrsDocumentLlmContext
} from "./BrokerClrsDocumentCapture.js";
import {
    createBrokerCompactTestEvidence
} from "./BrokerSubmissionEvidenceProjection.js";

export const BROKER_SUBMISSION_ASK_MAX_QUESTION_LENGTH = 8_192;

export function createBrokerSubmissionAskRequest({
    requestId,
    model,
    question = null,
    contract,
    capture,
    testExecution,
    staticEvidence
} = {}, options = {}) {
    validateSnapshot({
        contract,
        capture,
        testExecution,
        staticEvidence
    });

    const pedagogy =
        createBrokerLearningPedagogyContext(
            contract,
            BrokerLearningPedagogyMode.ASK,
            {
                catalogs: options.catalogs,
                categoryCatalog:
                    options.categoryCatalog
            }
        );

    return Object.freeze({
        requestId: requireIdentifier(requestId),
        model: requireText(model, 256),
        input: Object.freeze({
            question: normalizeQuestion(question),
            contract: createContractContext(contract),
            submission:
                createBrokerClrsDocumentLlmContext(
                    capture
                ),
            deterministicEvidence: Object.freeze({
                tests: createBrokerCompactTestEvidence(
                    testExecution
                ),
                static: staticEvidence
            })
        }),
        context: Object.freeze({
            tutor: Object.freeze({
                language: "es",
                directQuestion: question != null,
                openResponse: true,
                nonDefinitive: true,
                empathetic: true,
                nonJudgmental: true
            }),
            ...(pedagogy == null
                ? {}
                : { pedagogy }),
            constraints: Object.freeze({
                noGameStateAuthority: true,
                noContractClosure: true,
                noPaymentAuthority: true,
                noAlertAuthority: true,
                noScores: true,
                noEfficiencyDimension: true,
                noBigOEvaluation: true,
                sourceAndEvidenceAreContextOnly: true,
                ...(pedagogy == null
                    ? {}
                    : {
                        noFutureKnowledge: true,
                        beginnerLanguage: true
                    })
            })
        }),
        conversation: Object.freeze([]),
        stream: false
    });
}

function createContractContext(contract) {
    return Object.freeze({
        id: contract.id,
        title: contract.title,
        category: Object.freeze({
            categoryId: contract.categoryId,
            categoryName: contract.categoryName,
            familyId: contract.familyId,
            familyName: contract.familyName
        }),
        risk: contract.risk,
        description: contract.description,
        requirements: Object.freeze(
            contract.requirements.map(
                (text, index) => Object.freeze({
                    id: contract.metadata
                        .requirementIds[index],
                    text
                })
            )
        ),
        testCases: Object.freeze(
            contract.testCases.map(testCase =>
                Object.freeze({
                    id: testCase.id,
                    kind: testCase.kind,
                    requirementIds:
                        testCase.requirementIds,
                    ...(typeof testCase.explanation ===
                        "string"
                        ? {
                            explanation:
                                testCase.explanation
                        }
                        : {}),
                    comparison:
                        testCase.comparison
                })
            )
        )
    });
}

function validateSnapshot({
    contract,
    capture,
    testExecution,
    staticEvidence
}) {
    const sourceHash = capture?.sourceHash;
    const version = capture?.document?.version;

    if (
        contract == null ||
        typeof contract !== "object" ||
        !Number.isSafeInteger(contract.id) ||
        !Array.isArray(contract.requirements) ||
        !Array.isArray(contract.testCases) ||
        !Array.isArray(
            contract.metadata?.requirementIds
        ) ||
        typeof sourceHash !== "string" ||
        !Number.isSafeInteger(version) ||
        testExecution?.contractId !== contract.id ||
        testExecution?.document?.sourceHash !== sourceHash ||
        testExecution?.document?.version !== version ||
        staticEvidence?.document?.sourceHash !== sourceHash ||
        staticEvidence?.document?.version !== version
    ) {
        invalid(
            "BROKER95_ASK_SNAPSHOT_MISMATCH",
            "El documento cambió antes de completar la consulta. Inténtalo nuevamente."
        );
    }
}

function normalizeQuestion(value) {
    if (value == null) {
        return null;
    }

    return requireText(
        value,
        BROKER_SUBMISSION_ASK_MAX_QUESTION_LENGTH
    );
}

function requireIdentifier(value) {
    const selected = requireText(value, 128);

    if (
        !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u
            .test(selected)
    ) {
        invalid(
            "BROKER95_ASK_REQUEST_ID_INVALID",
            "No fue posible preparar la consulta."
        );
    }

    return selected;
}

function requireText(value, maximum) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > maximum ||
        value.includes("\u0000")
    ) {
        invalid(
            "BROKER95_ASK_REQUEST_INVALID",
            "No fue posible preparar la consulta."
        );
    }

    return value.trim();
}

function invalid(code, publicMessage) {
    throw BrokerGameError.invalidRule(
        code,
        publicMessage,
        []
    );
}
