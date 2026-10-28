import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    BrokerRisk,
    getBrokerRiskRule
} from "../core/BrokerRiskRules.js";
import {
    brokerCategoryCatalog
} from "../catalog/BrokerCategoryCatalog.js";
import {
    createBrokerLearningCurricularContext
} from "../learning/BrokerLearningCurricularContext.js";
import {
    getBrokerLearningRouteAttemptContext
} from "../learning/BrokerLearningRoutesProgressTransition.js";
import {
    BROKER_TEST_CASE_LIMITS,
    BrokerTestCaseKind,
    BrokerTestComparison
} from "../core/BrokerTestCase.js";
import {
    BROKER_TEST_COMPARISON_FORMATS
} from "../core/BrokerTestComparison.js";
import {
    cloneBrokerLLMJson,
    isBrokerLLMPlainRecord
} from "../llm/BrokerLLMProtocol.js";
import {
    getBrokerExerciseDifficultyProfile
} from "../catalog/BrokerExerciseDifficulty.js";

export const BROKER_CONTRACT_REQUIREMENT_LIMITS =
    Object.freeze({
        minimum: 1,
        maximum: 8
    });

export const BROKER_CONTRACT_GENERATION_MAX_ATTEMPTS = 2;

export const BROKER_LEARNING_CONTRACT_GENERATION_MODE =
    "generate_learning_contract";

export const BrokerLearningContractSimplicity =
    Object.freeze({
        VERY_HIGH: "very_high"
    });

/**
 * Construye el único contexto que el Host entrega al LLM. La categoría,
 * riesgo y reglas pertenecen al Host; no se acepta ningún valor de vuelta
 * para reemplazarlos.
 */
export function createBrokerContractGenerationRequest({
    requestId,
    model,
    risk,
    category,
    repair = null
}) {
    const rule = getBrokerRiskRule(risk);
    const difficulty =
        getBrokerExerciseDifficultyProfile(
            risk
        );
    const normalizedCategory = requireCategory(category);
    const clientPolicy = requiresAnonymousClient(risk)
        ? "anonymous"
        : "named";

    return Object.freeze({
        requestId: requireIdentifier(
            requestId,
            "BROKER95_CONTRACT_GENERATION_REQUEST_ID_INVALID"
        ),
        model: requireText(
            model,
            "BROKER95_CONTRACT_GENERATION_MODEL_INVALID",
            256
        ),
        input: Object.freeze({
            category: Object.freeze({
                categoryId: normalizedCategory.categoryId,
                categoryName:
                    normalizedCategory.categoryName,
                familyId: normalizedCategory.familyId,
                familyName: normalizedCategory.familyName,
                scope: normalizedCategory.scope,
                representativeExamples:
                    normalizedCategory
                        .representativeExamples
            }),
            risk,
            difficulty,
            clientPolicy,
            responseShape:
                createContractResponseShape(
                    clientPolicy
                ),
            ...(repair == null
                ? {}
                : {
                    repair: normalizeRepair(
                        repair
                    )
                })
        }),
        context: Object.freeze({
            risk: Object.freeze({
                value: risk,
                activeCriteria: rule.activeCriteria,
                clientPolicy
            }),
            constraints: Object.freeze({
                ...createAuthorityConstraints()
            })
        }),
        conversation: Object.freeze([]),
        stream: false
    });
}

/**
 * Prepara el contexto curricular mínimo para CIPHER. La operación
 * continúa usando el puerto neutral de generación de contratos, pero su
 * modo permite aplicar instrucciones pedagógicas específicas sin filtrar
 * historial, recompensa ni estado de la partida.
 */
export function createBrokerLearningContractGenerationRequest(
    {
        requestId,
        model,
        learningProgress,
        learningRouteId,
        lessonId,
        repair = null
    },
    options = {}
) {
    const catalogs = options.catalogs;
    const categoryCatalog =
        options.categoryCatalog ??
        brokerCategoryCatalog;
    const attempt =
        getBrokerLearningRouteAttemptContext(
            learningProgress,
            {
                routeId: learningRouteId,
                lessonId
            },
            { catalogs }
        );
    const curriculum =
        createBrokerLearningCurricularContext(
            {
                learningRouteId:
                    attempt.routeId,
                lessonId: attempt.lessonId
            },
            {
                catalogs,
                categoryCatalog
            }
        );
    const rule = getBrokerRiskRule(
        BrokerRisk.LOW
    );
    const clientPolicy = "anonymous";

    if (
        attempt.familyId !==
            curriculum.category.familyId ||
        attempt.categoryId !==
            curriculum.category.categoryId
    ) {
        invalid(
            "BROKER95_LEARNING_CONTRACT_CONTEXT_INVALID"
        );
    }

    return Object.freeze({
        requestId: requireIdentifier(
            requestId,
            "BROKER95_CONTRACT_GENERATION_REQUEST_ID_INVALID"
        ),
        model: requireText(
            model,
            "BROKER95_CONTRACT_GENERATION_MODEL_INVALID",
            256
        ),
        input: Object.freeze({
            generationMode:
                BROKER_LEARNING_CONTRACT_GENERATION_MODE,
            learningRouteId:
                curriculum.learningRouteId,
            difficulty: "easy",
            category: curriculum.category,
            lessonObjective:
                curriculum.lesson.objective,
            expectedPractice:
                curriculum.lesson
                    .expectedPractice,
            prerequisiteKnowledge:
                curriculum
                    .prerequisiteKnowledge,
            accumulatedRouteKnowledge:
                curriculum
                    .accumulatedRouteKnowledge,
            forbiddenFutureKnowledge:
                curriculum
                    .forbiddenFutureKnowledge,
            pedagogicalDifficulty:
                curriculum
                    .pedagogicalDifficulty,
            optionalTools:
                curriculum.optionalTools,
            simplicity:
                BrokerLearningContractSimplicity
                    .VERY_HIGH,
            clientPolicy,
            responseShape:
                createContractResponseShape(
                    clientPolicy
                ),
            ...(repair == null
                ? {}
                : {
                    repair: normalizeRepair(
                        repair
                    )
                })
        }),
        context: Object.freeze({
            risk: Object.freeze({
                value: BrokerRisk.LOW,
                activeCriteria:
                    rule.activeCriteria,
                clientPolicy
            }),
            pedagogy: Object.freeze({
                learningRouteId:
                    curriculum.learningRouteId,
                learnerLevel: "beginner",
                allowedKnowledgeOnly: true,
                lessonAlignmentRequired: true,
                equivalentVariantsAllowed: true,
                exerciseHistoryIncluded: false,
                toolPolicy:
                    curriculum.toolPolicy
            }),
            constraints: Object.freeze({
                ...createAuthorityConstraints(),
                noFutureKnowledge: true,
                functionalityOnly: true
            })
        }),
        conversation: Object.freeze([]),
        stream: false
    });
}

function createContractResponseShape(
    clientPolicy
) {
    return Object.freeze({
        required: Object.freeze([
            "title",
            "description",
            "requirements",
            "testCases",
            ...(clientPolicy === "named"
                ? ["client"]
                : [])
        ]),
        requirementCount:
            BROKER_CONTRACT_REQUIREMENT_LIMITS,
        testCases: Object.freeze({
            fields: Object.freeze([
                "id",
                "kind",
                "requirementIds",
                "explanation",
                "stdin",
                "expected",
                "comparison",
                "timeoutMs"
            ]),
            limits: BROKER_TEST_CASE_LIMITS,
            kinds: Object.freeze(
                Object.values(BrokerTestCaseKind)
            ),
            comparisons: Object.freeze(
                Object.values(
                    BrokerTestComparison
                )
            ),
            expectedFormats:
                BROKER_TEST_COMPARISON_FORMATS
        })
    });
}

function createAuthorityConstraints() {
    return {
        noPersistentStateAuthority: true,
        noPaymentAuthority: true,
        noAlertAuthority: true,
        noExecutableTestCode: true,
        noEfficiencyDimension: true
    };
}

function normalizeRepair(value) {
    if (
        !isBrokerLLMPlainRecord(value) ||
        Object.keys(value).some(key =>
            ![
                "attempt",
                "validationCode",
                "previousDraft"
            ].includes(key)
        ) ||
        value.attempt !==
            BROKER_CONTRACT_GENERATION_MAX_ATTEMPTS ||
        typeof value.validationCode !== "string" ||
        !/^BROKER95_[A-Z0-9_]{1,120}$/u
            .test(value.validationCode) ||
        (
            value.previousDraft != null &&
            !isBrokerLLMPlainRecord(
                value.previousDraft
            )
        )
    ) {
        invalid(
            "BROKER95_CONTRACT_GENERATION_REPAIR_INVALID"
        );
    }

    return Object.freeze({
        attempt: value.attempt,
        validationCode: value.validationCode,
        previousDraft:
            value.previousDraft == null
                ? null
                : cloneBrokerLLMJson(
                    value.previousDraft,
                    "repair.previousDraft"
                )
    });
}

export function requiresAnonymousClient(risk) {
    getBrokerRiskRule(risk);

    return risk === BrokerRisk.HIGH ||
        risk === BrokerRisk.EXTREME;
}

function requireCategory(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        invalid(
            "BROKER95_CONTRACT_GENERATION_CATEGORY_INVALID"
        );
    }

    return Object.freeze({
        categoryId: requireText(
            value.categoryId,
            "BROKER95_CONTRACT_GENERATION_CATEGORY_INVALID",
            64
        ),
        categoryName: requireText(
            value.categoryName,
            "BROKER95_CONTRACT_GENERATION_CATEGORY_INVALID",
            256
        ),
        familyId: requireText(
            value.familyId,
            "BROKER95_CONTRACT_GENERATION_CATEGORY_INVALID",
            64
        ),
        familyName: requireText(
            value.familyName,
            "BROKER95_CONTRACT_GENERATION_CATEGORY_INVALID",
            256
        ),
        scope: requireText(
            value.scope,
            "BROKER95_CONTRACT_GENERATION_CATEGORY_INVALID",
            2_048
        ),
        representativeExamples: requireText(
            value.representativeExamples,
            "BROKER95_CONTRACT_GENERATION_CATEGORY_INVALID",
            4_096
        )
    });
}

function requireIdentifier(value, code) {
    const selected = requireText(value, code, 128);

    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(selected)) {
        invalid(code);
    }

    return selected;
}

function requireText(value, code, maximum) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > maximum ||
        value.includes("\u0000")
    ) {
        invalid(code);
    }

    return value.trim();
}

function invalid(code) {
    throw BrokerGameError.invalidRule(
        code,
        "No fue posible preparar una solicitud de contrato válida.",
        []
    );
}
