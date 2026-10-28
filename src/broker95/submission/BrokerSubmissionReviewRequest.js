import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    getBrokerRiskRule
} from "../core/BrokerRiskRules.js";
import {
    BrokerLearningPedagogyMode,
    createBrokerLearningPedagogyContext
} from "../learning/BrokerLearningPedagogy.js";
import {
    createBrokerClrsDocumentLlmContext
} from "./BrokerClrsDocumentCapture.js";
import {
    BROKER_SUBMISSION_REVIEW_LIMITS,
    BrokerReviewFindingSeverity,
    BrokerSubmissionReadiness,
    getBrokerReviewCriteria
} from "./BrokerSubmissionReview.js";
import {
    createBrokerCompactTestEvidence
} from "./BrokerSubmissionEvidenceProjection.js";
import {
    normalizeBrokerSubmissionRepair
} from "./BrokerSubmissionResponseRepair.js";

export const BROKER_LEARNING_REVIEW_MODE =
    BrokerLearningPedagogyMode.REVIEW;

export function createBrokerSubmissionReviewRequest({
    requestId,
    model,
    contract,
    capture,
    testExecution,
    staticEvidence,
    repair = null
} = {}, options = {}) {
    const normalizedContract = requireContract(contract);
    const riskRule = getBrokerRiskRule(
        normalizedContract.risk
    );

    validateEvidenceSnapshot({
        contract: normalizedContract,
        capture,
        testExecution,
        staticEvidence
    });

    const activeCriteria = getBrokerReviewCriteria(
        riskRule.activeCriteria
    );
    const pedagogy =
        createBrokerLearningPedagogyContext(
            normalizedContract,
            BrokerLearningPedagogyMode.REVIEW,
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
            contract: Object.freeze({
                id: normalizedContract.id,
                title: normalizedContract.title,
                category: Object.freeze({
                    categoryId:
                        normalizedContract.categoryId,
                    categoryName:
                        normalizedContract.categoryName,
                    familyId:
                        normalizedContract.familyId,
                    familyName:
                        normalizedContract.familyName
                }),
                risk: normalizedContract.risk,
                description:
                    normalizedContract.description,
                requirements: Object.freeze(
                    normalizedContract.requirements.map(
                        (text, index) =>
                            Object.freeze({
                                id: normalizedContract
                                    .metadata
                                    .requirementIds[index],
                                text
                            })
                    )
                )
            }),
            submission:
                createBrokerClrsDocumentLlmContext(
                    capture
                ),
            evidence: Object.freeze({
                tests: createBrokerCompactTestEvidence(
                    testExecution
                ),
                static: staticEvidence
            }),
            responseShape: createResponseShape(
                activeCriteria
            ),
            ...(repair == null
                ? {}
                : {
                    repair:
                        normalizeBrokerSubmissionRepair(
                            repair
                        )
                })
        }),
        context: Object.freeze({
            review: Object.freeze({
                definitive: false,
                activeDimensions:
                    riskRule.activeCriteria,
                activeCriteria,
                pedagogicalTutor: true,
                audience: pedagogy == null
                    ? "general"
                    : "beginner"
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
                noCompleteSolution: true,
                findingsMustUseEvidence: true,
                ...(pedagogy == null
                    ? {}
                    : {
                        functionalityOnly: true,
                        noFutureKnowledge: true,
                        beginnerLanguage: true
                    })
            })
        }),
        conversation: Object.freeze([]),
        stream: false
    });
}

function createResponseShape(activeCriteria) {
    return Object.freeze({
        exactFields: Object.freeze([
            "summary",
            "readiness",
            "findings",
            "nextSteps"
        ]),
        readiness: Object.freeze(
            Object.values(BrokerSubmissionReadiness)
        ),
        findings: Object.freeze({
            maximum:
                BROKER_SUBMISSION_REVIEW_LIMITS
                    .maximumFindings,
            exactFields: Object.freeze([
                "severity",
                "criterion",
                "location",
                "problem",
                "evidence",
                "recommendation"
            ]),
            severities: Object.freeze(
                Object.values(
                    BrokerReviewFindingSeverity
                )
            ),
            criteria: activeCriteria
        }),
        nextSteps: Object.freeze({
            maximum:
                BROKER_SUBMISSION_REVIEW_LIMITS
                    .maximumNextSteps
        })
    });
}

function validateEvidenceSnapshot({
    contract,
    capture,
    testExecution,
    staticEvidence
}) {
    const sourceHash = capture?.sourceHash;
    const documentVersion =
        capture?.document?.version;

    if (
        typeof sourceHash !== "string" ||
        !Number.isSafeInteger(documentVersion) ||
        testExecution?.contractId !== contract.id ||
        testExecution?.document?.sourceHash !== sourceHash ||
        testExecution?.document?.version !== documentVersion ||
        staticEvidence?.document?.sourceHash !== sourceHash ||
        staticEvidence?.document?.version !== documentVersion
    ) {
        invalid(
            "BROKER95_REVIEW_SNAPSHOT_MISMATCH",
            "El documento cambió antes de completar la revisión. Inténtalo nuevamente."
        );
    }
}

function requireContract(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        !Number.isSafeInteger(value.id) ||
        typeof value.risk !== "string" ||
        !Array.isArray(value.requirements) ||
        !Array.isArray(
            value.metadata?.requirementIds
        ) ||
        value.requirements.length !==
            value.metadata.requirementIds.length
    ) {
        invalid(
            "BROKER95_REVIEW_CONTRACT_INVALID",
            "El contrato activo no contiene la información necesaria para revisarlo."
        );
    }

    return value;
}

function requireIdentifier(value) {
    const selected = requireText(value, 128);

    if (
        !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u
            .test(selected)
    ) {
        invalid(
            "BROKER95_REVIEW_REQUEST_ID_INVALID",
            "No fue posible preparar la solicitud de revisión."
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
            "BROKER95_REVIEW_REQUEST_INVALID",
            "No fue posible preparar la solicitud de revisión."
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
