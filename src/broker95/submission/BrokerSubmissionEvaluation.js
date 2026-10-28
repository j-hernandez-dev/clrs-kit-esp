import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    assertBrokerLearningKnowledgeScope
} from "../contracts/BrokerLearningContractValidator.js";
import {
    requireBrokerScore
} from "../core/BrokerPaymentRules.js";
import {
    BrokerLearningPedagogyMode,
    isBrokerLearningPedagogyContext
} from "../learning/BrokerLearningPedagogy.js";
import {
    assertBrokerLearningOptionalToolRecommendations,
    assertBrokerLearningToolsAbsent
} from "../learning/BrokerLearningPedagogicalToolPolicy.js";
import {
    BrokerReviewFindingSeverity
} from "./BrokerSubmissionReview.js";
import {
    getBrokerActiveEvaluationCriteria
} from "./BrokerEvaluationRubric.js";

export const BROKER_SUBMISSION_EVALUATION_VERSION = 1;

export const BROKER_SUBMISSION_EVALUATION_LIMITS =
    Object.freeze({
        maximumSummaryCharacters: 2_000,
        maximumCriterionEvidenceItems: 4,
        maximumCriterionEvidenceCharacters: 1_000,
        maximumRationaleCharacters: 1_200,
        maximumFindings: 16,
        maximumFindingCharacters: 1_200,
        maximumLocationCharacters: 240
    });

const RESPONSE_FIELDS = Object.freeze([
    "summary",
    "criteria",
    "findings"
]);
const CRITERION_FIELDS = Object.freeze([
    "criterion",
    "score",
    "evidence",
    "rationale"
]);
const FINDING_FIELDS = Object.freeze([
    "severity",
    "criterion",
    "location",
    "problem",
    "evidence",
    "recommendation"
]);

export class BrokerSubmissionEvaluationValidator {

    validate(proposal, options = {}) {
        const source = requireRecord(proposal);
        const activeCriteria =
            getBrokerActiveEvaluationCriteria(
                options.risk
            );
        const activeSet = new Set(activeCriteria);
        const pedagogicalContext =
            normalizePedagogicalContext(
                options.pedagogicalContext,
                activeCriteria
            );

        requireExactFields(source, RESPONSE_FIELDS);

        const criteria = requireArray(
            source.criteria,
            activeCriteria.length,
            activeCriteria.length,
            "BROKER95_EVALUATION_CRITERIA_INVALID"
        ).map(normalizeCriterion);
        const byCriterion = new Map(
            criteria.map(item => [
                item.criterion,
                item
            ])
        );

        if (
            byCriterion.size !== activeCriteria.length ||
            activeCriteria.some(
                criterion => !byCriterion.has(criterion)
            ) ||
            criteria.some(
                item => !activeSet.has(item.criterion)
            )
        ) {
            invalid(
                "BROKER95_EVALUATION_CRITERIA_INVALID"
            );
        }

        const findings = requireArray(
            source.findings,
            0,
            BROKER_SUBMISSION_EVALUATION_LIMITS
                .maximumFindings,
            "BROKER95_EVALUATION_FINDINGS_INVALID"
        ).map((item, index) =>
            normalizeFinding(
                item,
                activeSet,
                index
            )
        );

        const evaluation = Object.freeze({
            evaluationVersion:
                BROKER_SUBMISSION_EVALUATION_VERSION,
            summary: requireText(
                source.summary,
                BROKER_SUBMISSION_EVALUATION_LIMITS
                    .maximumSummaryCharacters,
                "BROKER95_EVALUATION_SUMMARY_INVALID"
            ),
            criteria: Object.freeze(
                activeCriteria.map(
                    criterion =>
                        byCriterion.get(criterion)
                )
            ),
            findings: Object.freeze(findings)
        });

        validatePedagogicalRecommendations(
            evaluation,
            pedagogicalContext
        );

        return evaluation;
    }
}

export const brokerSubmissionEvaluationValidator =
    Object.freeze(
        new BrokerSubmissionEvaluationValidator()
    );

export function validateBrokerSubmissionEvaluation(
    proposal,
    options
) {
    return brokerSubmissionEvaluationValidator.validate(
        proposal,
        options
    );
}

function normalizeCriterion(value) {
    const source = requireRecord(
        value,
        "BROKER95_EVALUATION_CRITERION_INVALID"
    );

    requireExactFields(
        source,
        CRITERION_FIELDS,
        "BROKER95_EVALUATION_CRITERION_FIELDS_INVALID"
    );

    return Object.freeze({
        criterion: requireIdentifier(
            source.criterion,
            "BROKER95_EVALUATION_CRITERION_INVALID"
        ),
        score: requireBrokerScore(source.score),
        evidence: Object.freeze(
            requireArray(
                source.evidence,
                1,
                BROKER_SUBMISSION_EVALUATION_LIMITS
                    .maximumCriterionEvidenceItems,
                "BROKER95_EVALUATION_CRITERION_EVIDENCE_INVALID"
            ).map(item => requireText(
                item,
                BROKER_SUBMISSION_EVALUATION_LIMITS
                    .maximumCriterionEvidenceCharacters,
                "BROKER95_EVALUATION_CRITERION_EVIDENCE_INVALID"
            ))
        ),
        rationale: requireText(
            source.rationale,
            BROKER_SUBMISSION_EVALUATION_LIMITS
                .maximumRationaleCharacters,
            "BROKER95_EVALUATION_CRITERION_RATIONALE_INVALID"
        )
    });
}

function normalizeFinding(value, active, index) {
    const source = requireRecord(
        value,
        "BROKER95_EVALUATION_FINDING_INVALID"
    );

    requireExactFields(
        source,
        FINDING_FIELDS,
        "BROKER95_EVALUATION_FINDING_FIELDS_INVALID"
    );

    const criterion = requireIdentifier(
        source.criterion,
        "BROKER95_EVALUATION_FINDING_CRITERION_INVALID"
    );

    if (!active.has(criterion)) {
        invalid(
            "BROKER95_EVALUATION_FINDING_CRITERION_INACTIVE",
            [{ criterion, index }]
        );
    }

    return Object.freeze({
        severity: requireEnum(
            source.severity,
            BrokerReviewFindingSeverity,
            "BROKER95_EVALUATION_FINDING_SEVERITY_INVALID"
        ),
        criterion,
        location: source.location == null
            ? null
            : requireText(
                source.location,
                BROKER_SUBMISSION_EVALUATION_LIMITS
                    .maximumLocationCharacters,
                "BROKER95_EVALUATION_FINDING_LOCATION_INVALID"
            ),
        problem: requireFindingText(
            source.problem,
            "BROKER95_EVALUATION_FINDING_PROBLEM_INVALID"
        ),
        evidence: requireFindingText(
            source.evidence,
            "BROKER95_EVALUATION_FINDING_EVIDENCE_INVALID"
        ),
        recommendation: requireFindingText(
            source.recommendation,
            "BROKER95_EVALUATION_FINDING_RECOMMENDATION_INVALID"
        )
    });
}

function normalizePedagogicalContext(
    value,
    activeCriteria
) {
    if (value == null) {
        return null;
    }

    if (
        !isBrokerLearningPedagogyContext(
            value,
            BrokerLearningPedagogyMode
                .EVALUATION
        ) ||
        activeCriteria.length !== 3 ||
        activeCriteria.some(
            criterion =>
                !["F-CUM", "F-COR", "F-LIM"]
                    .includes(criterion)
        )
    ) {
        invalid(
            "BROKER95_EVALUATION_LEARNING_CONTEXT_INVALID"
        );
    }

    return value;
}

function validatePedagogicalRecommendations(
    evaluation,
    pedagogicalContext
) {
    if (pedagogicalContext == null) {
        return;
    }

    const recommendations =
        evaluation.findings.map(
            (finding, index) => ({
                field:
                    `findings[${index}].recommendation`,
                text: finding.recommendation
            })
        );

    assertBrokerLearningKnowledgeScope(
        recommendations,
        pedagogicalContext
            .accumulatedKnowledge,
        {
            code:
                "BROKER95_LEARNING_EVALUATION_FUTURE_KNOWLEDGE",
            publicMessage:
                "CIPHER devolvió una puntuación que no pudo validarse."
        }
    );

    assertBrokerLearningOptionalToolRecommendations(
        recommendations,
        pedagogicalContext,
        {
            notRecommendedCode:
                "BROKER95_LEARNING_EVALUATION_TOOL_NOT_RECOMMENDED",
            notOptionalCode:
                "BROKER95_LEARNING_EVALUATION_TOOL_NOT_OPTIONAL",
            publicMessage:
                "CIPHER devolvió una puntuación que no pudo validarse."
        }
    );

    assertBrokerLearningToolsAbsent(
        createScoringSurfaces(evaluation),
        {
            code:
                "BROKER95_LEARNING_EVALUATION_TOOL_SCORING_FORBIDDEN",
            publicMessage:
                "CIPHER devolvió una puntuación que no pudo validarse."
        }
    );
}

function createScoringSurfaces(evaluation) {
    return [
        {
            field: "summary",
            text: evaluation.summary
        },
        ...evaluation.criteria.flatMap(
            (criterion, criterionIndex) => [
                {
                    field:
                        `criteria[${criterionIndex}].rationale`,
                    text: criterion.rationale
                },
                ...criterion.evidence.map(
                    (text, evidenceIndex) => ({
                        field:
                            `criteria[${criterionIndex}].evidence[${evidenceIndex}]`,
                        text
                    })
                )
            ]
        ),
        ...evaluation.findings.flatMap(
            (finding, index) => [
                {
                    field:
                        `findings[${index}].problem`,
                    text: finding.problem
                },
                {
                    field:
                        `findings[${index}].evidence`,
                    text: finding.evidence
                }
            ]
        )
    ];
}

function requireFindingText(value, code) {
    return requireText(
        value,
        BROKER_SUBMISSION_EVALUATION_LIMITS
            .maximumFindingCharacters,
        code
    );
}

function requireArray(
    value,
    minimum,
    maximum,
    code
) {
    if (
        !Array.isArray(value) ||
        value.length < minimum ||
        value.length > maximum
    ) {
        invalid(code);
    }

    return value;
}

function requireRecord(
    value,
    code = "BROKER95_EVALUATION_RESPONSE_INVALID"
) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        (
            Object.getPrototypeOf(value) !==
                Object.prototype &&
            Object.getPrototypeOf(value) !== null
        )
    ) {
        invalid(code);
    }

    return value;
}

function requireExactFields(
    value,
    expected,
    code = "BROKER95_EVALUATION_RESPONSE_FIELDS_INVALID"
) {
    const fields = Object.keys(value);

    if (
        fields.length !== expected.length ||
        expected.some(
            field => !Object.hasOwn(value, field)
        ) ||
        fields.some(field => !expected.includes(field))
    ) {
        invalid(code);
    }
}

function requireIdentifier(value, code) {
    if (
        typeof value !== "string" ||
        !/^[A-Z]-[A-Z]{3}$/u.test(value)
    ) {
        invalid(code);
    }

    return value;
}

function requireText(value, maximum, code) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > maximum ||
        value.includes("\u0000")
    ) {
        invalid(code);
    }

    return value.replace(/\r\n?/gu, "\n")
        .trim();
}

function requireEnum(value, enumeration, code) {
    if (!Object.values(enumeration).includes(value)) {
        invalid(code);
    }

    return value;
}

function invalid(code, diagnostics = []) {
    throw BrokerGameError.invalidRule(
        code,
        "CIPHER devolvió una puntuación que no pudo validarse.",
        diagnostics
    );
}
