import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    assertBrokerLearningKnowledgeScope
} from "../contracts/BrokerLearningContractValidator.js";
import {
    BrokerLearningPedagogyMode,
    isBrokerLearningPedagogyContext
} from "../learning/BrokerLearningPedagogy.js";
import {
    assertBrokerLearningOptionalToolRecommendations
} from "../learning/BrokerLearningPedagogicalToolPolicy.js";

export const BROKER_SUBMISSION_REVIEW_VERSION = 1;

export const BrokerSubmissionReadiness = Object.freeze({
    READY: "ready",
    NEEDS_CHANGES: "needs-changes",
    BLOCKED: "blocked"
});

export const BrokerReviewFindingSeverity = Object.freeze({
    CRITICAL: "critical",
    IMPORTANT: "important",
    IMPROVEMENT: "improvement"
});

export const BROKER_SUBMISSION_REVIEW_LIMITS =
    Object.freeze({
        maximumSummaryCharacters: 2_000,
        maximumFindings: 12,
        maximumLocationCharacters: 240,
        maximumProblemCharacters: 800,
        maximumEvidenceCharacters: 1_000,
        maximumRecommendationCharacters: 800,
        maximumNextSteps: 8,
        maximumNextStepCharacters: 500
    });

const CRITERIA_BY_DIMENSION = Object.freeze({
    functionality: Object.freeze([
        "F-CUM",
        "F-COR",
        "F-LIM"
    ]),
    robustness: Object.freeze([
        "R-VAL",
        "R-SEG",
        "R-MAN"
    ]),
    design: Object.freeze([
        "D-CLA",
        "D-SIM",
        "D-MOD",
        "D-COH",
        "D-ACO",
        "D-ABS"
    ])
});

const RESPONSE_FIELDS = Object.freeze([
    "summary",
    "readiness",
    "findings",
    "nextSteps"
]);

const FINDING_FIELDS = Object.freeze([
    "severity",
    "criterion",
    "location",
    "problem",
    "evidence",
    "recommendation"
]);

export class BrokerSubmissionReviewValidator {

    validate(proposal, options = {}) {
        const source = requireRecord(proposal);
        const activeCriteria = createActiveCriteria(
            options.activeDimensions
        );
        const pedagogicalContext =
            normalizePedagogicalContext(
                options.pedagogicalContext,
                options.activeDimensions
            );

        requireExactFields(source, RESPONSE_FIELDS);

        const findings = requireArray(
            source.findings,
            BROKER_SUBMISSION_REVIEW_LIMITS
                .maximumFindings,
            "BROKER95_REVIEW_FINDINGS_INVALID"
        ).map((finding, index) =>
            normalizeFinding(
                finding,
                activeCriteria,
                index
            )
        );
        const nextSteps = requireArray(
            source.nextSteps,
            BROKER_SUBMISSION_REVIEW_LIMITS
                .maximumNextSteps,
            "BROKER95_REVIEW_NEXT_STEPS_INVALID"
        ).map(step => requireText(
            step,
            BROKER_SUBMISSION_REVIEW_LIMITS
                .maximumNextStepCharacters,
            "BROKER95_REVIEW_NEXT_STEPS_INVALID"
        ));

        const review = Object.freeze({
            reviewVersion:
                BROKER_SUBMISSION_REVIEW_VERSION,
            summary: requireText(
                source.summary,
                BROKER_SUBMISSION_REVIEW_LIMITS
                    .maximumSummaryCharacters,
                "BROKER95_REVIEW_SUMMARY_INVALID"
            ),
            readiness: requireEnum(
                source.readiness,
                BrokerSubmissionReadiness,
                "BROKER95_REVIEW_READINESS_INVALID"
            ),
            findings: Object.freeze(findings),
            nextSteps: Object.freeze(nextSteps)
        });

        validatePedagogicalRecommendations(
            review,
            pedagogicalContext
        );

        return review;
    }
}

export const brokerSubmissionReviewValidator =
    Object.freeze(
        new BrokerSubmissionReviewValidator()
    );

export function validateBrokerSubmissionReview(
    proposal,
    options
) {
    return brokerSubmissionReviewValidator.validate(
        proposal,
        options
    );
}

export function getBrokerReviewCriteria(
    activeDimensions
) {
    return Object.freeze([
        ...createActiveCriteria(activeDimensions)
    ]);
}

function normalizeFinding(
    value,
    activeCriteria,
    index
) {
    const source = requireRecord(
        value,
        "BROKER95_REVIEW_FINDING_INVALID",
        index
    );

    requireExactFields(
        source,
        FINDING_FIELDS,
        "BROKER95_REVIEW_FINDING_FIELDS_INVALID"
    );

    const criterion = requireText(
        source.criterion,
        16,
        "BROKER95_REVIEW_FINDING_CRITERION_INVALID"
    );

    if (!activeCriteria.has(criterion)) {
        invalid(
            "BROKER95_REVIEW_FINDING_CRITERION_INACTIVE",
            [{ criterion, index }]
        );
    }

    return Object.freeze({
        severity: requireEnum(
            source.severity,
            BrokerReviewFindingSeverity,
            "BROKER95_REVIEW_FINDING_SEVERITY_INVALID"
        ),
        criterion,
        location: source.location == null
            ? null
            : requireText(
                source.location,
                BROKER_SUBMISSION_REVIEW_LIMITS
                    .maximumLocationCharacters,
                "BROKER95_REVIEW_FINDING_LOCATION_INVALID"
            ),
        problem: requireText(
            source.problem,
            BROKER_SUBMISSION_REVIEW_LIMITS
                .maximumProblemCharacters,
            "BROKER95_REVIEW_FINDING_PROBLEM_INVALID"
        ),
        evidence: requireText(
            source.evidence,
            BROKER_SUBMISSION_REVIEW_LIMITS
                .maximumEvidenceCharacters,
            "BROKER95_REVIEW_FINDING_EVIDENCE_INVALID"
        ),
        recommendation: requireText(
            source.recommendation,
            BROKER_SUBMISSION_REVIEW_LIMITS
                .maximumRecommendationCharacters,
            "BROKER95_REVIEW_FINDING_RECOMMENDATION_INVALID"
        )
    });
}

function createActiveCriteria(dimensions) {
    if (
        !Array.isArray(dimensions) ||
        dimensions.length === 0
    ) {
        invalid(
            "BROKER95_REVIEW_ACTIVE_CRITERIA_INVALID"
        );
    }

    const criteria = new Set();

    for (const dimension of dimensions) {
        const selected =
            CRITERIA_BY_DIMENSION[dimension];

        if (!selected) {
            invalid(
                "BROKER95_REVIEW_ACTIVE_CRITERIA_INVALID",
                [{ dimension }]
            );
        }

        for (const criterion of selected) {
            criteria.add(criterion);
        }
    }

    return criteria;
}

function normalizePedagogicalContext(
    value,
    activeDimensions
) {
    if (value == null) {
        return null;
    }

    if (
        !isBrokerLearningPedagogyContext(
            value,
            BrokerLearningPedagogyMode.REVIEW
        ) ||
        !Array.isArray(activeDimensions) ||
        activeDimensions.length !== 1 ||
        activeDimensions[0] !== "functionality"
    ) {
        invalid(
            "BROKER95_REVIEW_LEARNING_CONTEXT_INVALID"
        );
    }

    return value;
}

function validatePedagogicalRecommendations(
    review,
    pedagogicalContext
) {
    if (pedagogicalContext == null) {
        return;
    }

    const surfaces = [
        ...review.findings.map(
            (finding, index) => ({
                field:
                    `findings[${index}].recommendation`,
                text: finding.recommendation
            })
        ),
        ...review.nextSteps.map(
            (step, index) => ({
                field: `nextSteps[${index}]`,
                text: step
            })
        )
    ];

    assertBrokerLearningKnowledgeScope(
        surfaces,
        pedagogicalContext
            .accumulatedKnowledge,
        {
            code:
                "BROKER95_LEARNING_REVIEW_FUTURE_KNOWLEDGE",
            publicMessage:
                "CIPHER devolvió una revisión que no pudo validarse."
        }
    );

    assertBrokerLearningOptionalToolRecommendations(
        surfaces,
        pedagogicalContext,
        {
            notRecommendedCode:
                "BROKER95_LEARNING_REVIEW_TOOL_NOT_RECOMMENDED",
            notOptionalCode:
                "BROKER95_LEARNING_REVIEW_TOOL_NOT_OPTIONAL",
            publicMessage:
                "CIPHER devolvió una revisión que no pudo validarse."
        }
    );
}

function requireArray(value, maximum, code) {
    if (
        !Array.isArray(value) ||
        value.length > maximum
    ) {
        invalid(code);
    }

    return value;
}

function requireRecord(
    value,
    code = "BROKER95_REVIEW_RESPONSE_INVALID",
    index = null
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
        invalid(
            code,
            index == null ? [] : [{ index }]
        );
    }

    return value;
}

function requireExactFields(
    value,
    expected,
    code = "BROKER95_REVIEW_RESPONSE_FIELDS_INVALID"
) {
    const keys = Object.keys(value);

    if (
        keys.length !== expected.length ||
        expected.some(
            field => !Object.hasOwn(value, field)
        ) ||
        keys.some(field => !expected.includes(field))
    ) {
        invalid(code);
    }
}

function requireEnum(value, enumeration, code) {
    if (!Object.values(enumeration).includes(value)) {
        invalid(code);
    }

    return value;
}

function requireText(value, maximum, code) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > maximum ||
        value.includes("\u0000") ||
        containsUnsafeControl(value)
    ) {
        invalid(code);
    }

    return value.replace(/\r\n?/gu, "\n")
        .trim();
}

function containsUnsafeControl(value) {
    return [...value].some(character => {
        const code = character.codePointAt(0);

        return code < 32 &&
            character !== "\n" &&
            character !== "\r" &&
            character !== "\t";
    });
}

function invalid(code, diagnostics = []) {
    throw BrokerGameError.invalidRule(
        code,
        "CIPHER devolvió una revisión que no pudo validarse.",
        diagnostics
    );
}
