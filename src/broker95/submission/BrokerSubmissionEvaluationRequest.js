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
import {
    BROKER_SUBMISSION_EVALUATION_LIMITS
} from "./BrokerSubmissionEvaluation.js";
import {
    getBrokerEvaluationRubric
} from "./BrokerEvaluationRubric.js";
import {
    normalizeBrokerSubmissionRepair
} from "./BrokerSubmissionResponseRepair.js";

export function createBrokerSubmissionEvaluationRequest({
    requestId,
    model,
    contract,
    capture,
    testExecution,
    staticEvidence,
    anchors,
    repair = null
} = {}, options = {}) {
    validateSnapshot({
        contract,
        capture,
        testExecution,
        staticEvidence,
        anchors
    });

    const rubric = getBrokerEvaluationRubric(
        contract.risk
    );
    const activeCriteria = rubric.dimensions
        .flatMap(dimension =>
            dimension.criteria.map(
                item => item.criterion
            )
        );
    const pedagogy =
        createBrokerLearningPedagogyContext(
            contract,
            BrokerLearningPedagogyMode
                .EVALUATION,
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
            contract: createContractContext(contract),
            submission:
                createBrokerClrsDocumentLlmContext(
                    capture
                ),
            deterministicEvidence: Object.freeze({
                tests: createBrokerCompactTestEvidence(
                    testExecution
                ),
                static: staticEvidence,
                anchors
            }),
            rubric,
            responseShape: Object.freeze({
                exactFields: Object.freeze([
                    "summary",
                    "criteria",
                    "findings"
                ]),
                criteria: Object.freeze({
                    exactCount:
                        activeCriteria.length,
                    requiredIds:
                        Object.freeze(activeCriteria),
                    exactFields: Object.freeze([
                        "criterion",
                        "score",
                        "evidence",
                        "rationale"
                    ]),
                    score: Object.freeze({
                        integer: true,
                        minimum: 0,
                        maximum: 100
                    }),
                    maximumEvidenceItems:
                        BROKER_SUBMISSION_EVALUATION_LIMITS
                            .maximumCriterionEvidenceItems
                }),
                findings: Object.freeze({
                    maximum:
                        BROKER_SUBMISSION_EVALUATION_LIMITS
                            .maximumFindings,
                    exactFields: Object.freeze([
                        "severity",
                        "criterion",
                        "location",
                        "problem",
                        "evidence",
                        "recommendation"
                    ]),
                    severities: Object.freeze([
                        "critical",
                        "important",
                        "improvement"
                    ])
                })
            }),
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
            scoringAuthority: Object.freeze({
                llmChoosesCriterionScores: true,
                hostChoosesActiveCriteria: true,
                hostCalculatesDimensionScores: true,
                hostCalculatesFinalScore: true,
                hostCalculatesPayout: true
            }),
            ...(pedagogy == null
                ? {}
                : { pedagogy }),
            constraints: Object.freeze({
                evidenceRequired: true,
                avoidDuplicatePenalties: true,
                inactiveDimensionsMustBeOmitted: true,
                deterministicAnchorsAreStartingPoints: true,
                signalsAreNotAutomaticPenalties: true,
                noEfficiencyDimension: true,
                noBigOEvaluation: true,
                noPayoutProposal: true,
                noGameStateAuthority: true,
                ...(pedagogy == null
                    ? {}
                    : {
                        functionalityOnly: true,
                        noFutureKnowledgePenalty: true,
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
                (text, index) =>
                    Object.freeze({
                        id: contract.metadata
                            .requirementIds[index],
                        text
                    })
            )
        )
    });
}

function validateSnapshot({
    contract,
    capture,
    testExecution,
    staticEvidence,
    anchors
}) {
    const sourceHash = capture?.sourceHash;
    const version = capture?.document?.version;

    if (
        contract == null ||
        typeof contract !== "object" ||
        !Array.isArray(contract.requirements) ||
        !Array.isArray(
            contract.metadata?.requirementIds
        ) ||
        typeof sourceHash !== "string" ||
        !Number.isSafeInteger(version) ||
        testExecution?.contractId !== contract.id ||
        testExecution?.document?.sourceHash !== sourceHash ||
        testExecution?.document?.version !== version ||
        staticEvidence?.document?.sourceHash !== sourceHash ||
        staticEvidence?.document?.version !== version ||
        !Array.isArray(anchors?.criteria)
    ) {
        invalid(
            "BROKER95_EVALUATION_SNAPSHOT_MISMATCH",
            "El documento cambió antes de completar la evaluación. Inténtalo nuevamente."
        );
    }
}

function requireIdentifier(value) {
    const selected = requireText(value, 128);

    if (
        !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u
            .test(selected)
    ) {
        invalid(
            "BROKER95_EVALUATION_REQUEST_ID_INVALID",
            "No fue posible preparar la evaluación."
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
            "BROKER95_EVALUATION_REQUEST_INVALID",
            "No fue posible preparar la evaluación."
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
