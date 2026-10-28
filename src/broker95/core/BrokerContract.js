import {
    BrokerGameError
} from "./BrokerGameError.js";
import {
    BrokerCategoryAudience
} from "../catalog/BrokerCategoryAudience.js";
import {
    brokerCategoryCatalog
} from "../catalog/BrokerCategoryCatalog.js";
import {
    brokerLearningCatalog
} from "../learning/BrokerLearningCatalog.js";
import {
    BrokerLearningRouteId,
    requireBrokerLearningRouteId
} from "../learning/BrokerLearningRoutesProgress.js";
import {
    requireBrokerPayPotential
} from "./BrokerPaymentRules.js";
import {
    BrokerRisk,
    getBrokerRiskRule
} from "./BrokerRiskRules.js";
import {
    createBrokerRequirementIds,
    createBrokerTestCases
} from "./BrokerTestCase.js";

export const BrokerContractState =
    Object.freeze({
        PENDING: "pending",
        ACTIVE: "active",
        COMPLETED: "completed",
        FAILED: "failed",
        DELETED: "deleted"
    });

export const BrokerContractType =
    Object.freeze({
        CLIENT: "client",
        LEARNING: "learning"
    });

export const BROKER_CONTRACT_TYPES =
    Object.freeze(
        Object.values(BrokerContractType)
    );

const LEARNING_CONTRACT_FIELDS =
    Object.freeze([
        "learningRouteId",
        "lessonId",
        "sectionId",
        "learningAttempt",
        "baseReward",
        "effectiveReward"
    ]);

const CONTRACT_STATES = Object.freeze(
    Object.values(BrokerContractState)
);

export function createBrokerContract(
    input = {},
    options = {}
) {
    const id = requirePositiveInteger(
        input.id,
        "BROKER95_CONTRACT_ID_INVALID"
    );
    const contractType = normalizeContractType(
        input
    );
    const riskRule =
        getBrokerRiskRule(input.risk);
    const category =
        brokerCategoryCatalog
            .requireCategory(
                input.categoryId
            );
    const client =
        input.risk === BrokerRisk.HIGH ||
        input.risk === BrokerRisk.EXTREME
            ? "Anónimo"
            : requireText(
                input.client,
                "BROKER95_CONTRACT_CLIENT_INVALID"
            );
    const state =
        input.state ??
        BrokerContractState.PENDING;
    const requirements = requireRequirements(
        input.requirements
    );
    const metadata = freezeJsonValue(
        input.metadata ?? {}
    );
    const requirementIds = createBrokerRequirementIds(
        requirements,
        metadata.requirementIds ?? null
    );
    const testCases = createBrokerTestCases(
        input.testCases ?? [],
        requirementIds
    );
    const evaluation = freezeJsonValue(
        input.evaluation ?? null
    );
    const payout = requireNonNegativeInteger(
        input.payout ?? 0,
        "BROKER95_CONTRACT_PAYOUT_INVALID"
    );

    requireContractState(state);
    requireCategoryConsistency(
        input,
        category,
        input.risk,
        contractType
    );
    const learningFields =
        createLearningContractFields({
            input,
            contractType,
            category,
            catalogs: options.catalogs
        });
    const payPotential =
        requireContractPayPotential({
            input,
            contractType,
            learningFields
        });
    requireLifecycleConsistency({
        contractType,
        state,
        evaluation,
        payout
    });

    return Object.freeze({
        id,
        contractType,
        title: requireText(
            input.title,
            "BROKER95_CONTRACT_TITLE_INVALID"
        ),
        categoryId: requireText(
            input.categoryId,
            "BROKER95_CONTRACT_CATEGORY_INVALID"
        ),
        categoryName: requireText(
            input.categoryName,
            "BROKER95_CONTRACT_CATEGORY_INVALID"
        ),
        familyId: requireText(
            input.familyId,
            "BROKER95_CONTRACT_FAMILY_INVALID"
        ),
        familyName: requireText(
            input.familyName,
            "BROKER95_CONTRACT_FAMILY_INVALID"
        ),
        risk: input.risk,
        weights: riskRule.weights,
        description: requireText(
            input.description,
            "BROKER95_CONTRACT_DESCRIPTION_INVALID"
        ),
        requirements,
        testCases,
        client,
        payPotential,
        ...learningFields,
        state,
        createdOrder:
            input.createdOrder == null
                ? id
                : requirePositiveInteger(
                    input.createdOrder,
                    "BROKER95_CONTRACT_ORDER_INVALID"
                ),
        createdAt:
            normalizeTimestamp(
                input.createdAt
            ),
        acceptedAt:
            normalizeTimestamp(
                input.acceptedAt
            ),
        closedAt:
            normalizeTimestamp(
                input.closedAt
            ),
        evaluation,
        payout,
        metadata: freezeJsonValue({
            ...metadata,
            requirementIds
        })
    });
}

function requireCategoryConsistency(
    input,
    category,
    risk,
    contractType
) {
    const categoryName = requireText(
        input.categoryName,
        "BROKER95_CONTRACT_CATEGORY_INVALID"
    );
    const familyId = requireText(
        input.familyId,
        "BROKER95_CONTRACT_FAMILY_INVALID"
    );
    const familyName = requireText(
        input.familyName,
        "BROKER95_CONTRACT_FAMILY_INVALID"
    );

    if (
        category.categoryName !==
            categoryName ||
        category.familyId !== familyId ||
        category.familyName !== familyName
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CONTRACT_CATEGORY_MISMATCH",
            "La categoría del contrato no coincide con el catálogo.",
            [{
                categoryId:
                    category.categoryId
            }]
        );
    }

    if (
        contractType ===
            BrokerContractType.CLIENT &&
        !category.compatibleRisks
            .includes(risk)
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CONTRACT_CATEGORY_RISK_MISMATCH",
            "La categoría no es compatible con el nivel de riesgo del contrato.",
            [{
                categoryId:
                    category.categoryId,
                risk
            }]
        );
    }

    const audience = contractType ===
        BrokerContractType.LEARNING
        ? BrokerCategoryAudience.LEARNING
        : BrokerCategoryAudience.CLIENT;

    if (!category.audiences.includes(audience)) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CONTRACT_CATEGORY_AUDIENCE_MISMATCH",
            "La categoría no es compatible con el origen del contrato.",
            [{
                categoryId:
                    category.categoryId,
                contractType
            }]
        );
    }
}

export function updateBrokerContract(
    contract,
    changes,
    options = {}
) {
    const contractType =
        contract.contractType ??
        BrokerContractType.CLIENT;
    const immutableLearningFields =
        contractType ===
            BrokerContractType.LEARNING
            ? Object.fromEntries(
                LEARNING_CONTRACT_FIELDS.map(
                    field => [
                        field,
                        contract[field]
                    ]
                )
            )
            : {};

    return createBrokerContract(
        {
            ...contract,
            ...changes,
            id: contract.id,
            contractType,
            ...immutableLearningFields,
            createdOrder:
                contract.createdOrder,
            metadata: contract.metadata
        },
        options
    );
}

export function requireBrokerContractType(
    value
) {
    if (!BROKER_CONTRACT_TYPES.includes(value)) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CONTRACT_TYPE_INVALID",
            "El tipo interno del contrato no es válido.",
            [{ value }]
        );
    }

    return value;
}

export function isBrokerLearningContract(
    contract
) {
    return contract?.contractType ===
        BrokerContractType.LEARNING;
}

export function isBrokerClientContract(
    contract
) {
    return contract?.contractType ===
        BrokerContractType.CLIENT;
}

export function requireBrokerContractState(
    value
) {
    return requireContractState(value);
}

export function freezeJsonValue(value) {
    if (
        value == null ||
        typeof value === "string" ||
        typeof value === "boolean"
    ) {
        return value;
    }

    if (
        typeof value === "number" &&
        Number.isFinite(value)
    ) {
        return value;
    }

    if (Array.isArray(value)) {
        return Object.freeze(
            value.map(freezeJsonValue)
        );
    }

    if (
        typeof value === "object" &&
        Object.getPrototypeOf(value) ===
            Object.prototype
    ) {
        return Object.freeze(
            Object.fromEntries(
                Object.entries(value).map(
                    ([key, item]) => [
                        key,
                        freezeJsonValue(item)
                    ]
                )
            )
        );
    }

    throw BrokerGameError.invalidRule(
        "BROKER95_JSON_VALUE_INVALID",
        "Los metadatos del contrato no son válidos.",
        [{ valueType: typeof value }]
    );
}

function requireRequirements(value) {
    if (
        !Array.isArray(value) ||
        value.length === 0
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CONTRACT_REQUIREMENTS_INVALID",
            "El contrato debe contener al menos un requisito.",
            []
        );
    }

    return Object.freeze(
        value.map(requirement =>
            requireText(
                requirement,
                "BROKER95_CONTRACT_REQUIREMENTS_INVALID"
            )
        )
    );
}

function requireContractState(value) {
    if (!CONTRACT_STATES.includes(value)) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CONTRACT_STATE_INVALID",
            "El estado del contrato no es válido.",
            [{ value }]
        );
    }

    return value;
}

function requireLifecycleConsistency({
    contractType,
    state,
    evaluation,
    payout
}) {
    const closed =
        state === BrokerContractState.COMPLETED ||
        state === BrokerContractState.FAILED;
    const validCompleted =
        state !== BrokerContractState.COMPLETED ||
        payout > 0 ||
        contractType ===
            BrokerContractType.LEARNING;
    const validFailed =
        state !== BrokerContractState.FAILED ||
        payout === 0;

    if (
        (closed && !isRecord(evaluation)) ||
        (!closed && evaluation != null) ||
        (!closed && payout !== 0) ||
        !validCompleted ||
        !validFailed
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_CONTRACT_LIFECYCLE_INVALID",
            "El estado y el resultado del contrato no son coherentes.",
            [{ state, payout }]
        );
    }
}

function createLearningContractFields({
    input,
    contractType,
    category,
    catalogs
}) {
    if (
        contractType ===
        BrokerContractType.CLIENT
    ) {
        if (
            LEARNING_CONTRACT_FIELDS.some(
                field =>
                    Object.hasOwn(input, field)
            )
        ) {
            throw BrokerGameError.invalidRule(
                "BROKER95_CLIENT_CONTRACT_LEARNING_FIELDS_FORBIDDEN",
                "Un contrato de cliente no puede contener datos de aprendizaje.",
                []
            );
        }

        return Object.freeze({});
    }

    if (input.risk !== BrokerRisk.LOW) {
        throw BrokerGameError.invalidRule(
            "BROKER95_LEARNING_CONTRACT_RISK_INVALID",
            "Los contratos de aprendizaje deben tener riesgo bajo.",
            [{ risk: input.risk }]
        );
    }

    const learningRouteId =
        requireBrokerLearningRouteId(
            input.learningRouteId
        );

    const learningCatalog =
        catalogs?.[learningRouteId] ??
        (
            learningRouteId ===
                BrokerLearningRouteId.PROGRAMMING
                ? brokerLearningCatalog
                : null
        );

    if (learningCatalog == null) {
        throw BrokerGameError.invalidRule(
            "BROKER95_LEARNING_CONTRACT_ROUTE_NOT_CATALOGED",
            "La ruta asociada al contrato todavía no dispone de un catálogo curricular.",
            [{ learningRouteId }]
        );
    }

    const lessonId = requireText(
        input.lessonId,
        "BROKER95_LEARNING_CONTRACT_LESSON_INVALID"
    );
    let lesson;

    try {
        lesson = learningCatalog.requireLesson(
            lessonId
        );
    } catch (error) {
        throw BrokerGameError.invalidRule(
            "BROKER95_LEARNING_CONTRACT_LESSON_INVALID",
            "La lección asociada al contrato no es válida.",
            [{
                lessonId,
                causeCode: error?.code ?? null
            }]
        );
    }

    const sectionId = requireText(
        input.sectionId,
        "BROKER95_LEARNING_CONTRACT_SECTION_INVALID"
    );
    const learningAttempt =
        requirePositiveInteger(
            input.learningAttempt,
            "BROKER95_LEARNING_CONTRACT_ATTEMPT_INVALID"
        );
    const baseReward = requirePositiveInteger(
        input.baseReward,
        "BROKER95_LEARNING_CONTRACT_REWARD_INVALID"
    );
    const effectiveReward =
        requirePositiveInteger(
            input.effectiveReward,
            "BROKER95_LEARNING_CONTRACT_REWARD_INVALID"
        );

    if (
        sectionId !== lesson.sectionId ||
        category.categoryId !==
            lesson.categoryId ||
        category.familyId !== lesson.familyId
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_LEARNING_CONTRACT_CURRICULUM_MISMATCH",
            "El contrato no coincide con la lección curricular asociada.",
            [{
                lessonId,
                sectionId,
                categoryId: category.categoryId
            }]
        );
    }

    if (
        baseReward !== lesson.baseReward ||
        effectiveReward !== lesson.baseReward
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_LEARNING_CONTRACT_REWARD_MISMATCH",
            "La recompensa del contrato no coincide con la lección.",
            [{
                lessonId,
                learningAttempt,
                baseReward,
                effectiveReward
            }]
        );
    }

    return Object.freeze({
        learningRouteId,
        lessonId,
        sectionId,
        learningAttempt,
        baseReward,
        effectiveReward: lesson.baseReward
    });
}

function normalizeContractType(input) {
    if (!Object.hasOwn(input, "contractType")) {
        return BrokerContractType.CLIENT;
    }

    return requireBrokerContractType(
        input.contractType
    );
}

function requireContractPayPotential({
    input,
    contractType,
    learningFields
}) {
    if (
        contractType ===
        BrokerContractType.CLIENT
    ) {
        return requireBrokerPayPotential(
            input.risk,
            input.payPotential
        );
    }

    const payPotential =
        requirePositiveInteger(
            input.payPotential,
            "BROKER95_PAY_POTENTIAL_INVALID"
        );

    if (
        payPotential !==
            learningFields.effectiveReward
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_LEARNING_CONTRACT_PAY_MISMATCH",
            "La paga potencial debe coincidir con la recompensa educativa efectiva.",
            [{
                payPotential,
                effectiveReward:
                    learningFields
                        .effectiveReward
            }]
        );
    }

    return learningFields.effectiveReward;
}

function isRecord(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) ===
            Object.prototype;
}

function requireText(value, code) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0
    ) {
        throw BrokerGameError.invalidRule(
            code,
            "El contrato contiene información incompleta.",
            []
        );
    }

    return value.trim();
}

function requirePositiveInteger(value, code) {
    if (
        !Number.isInteger(value) ||
        value <= 0
    ) {
        throw BrokerGameError.invalidRule(
            code,
            "El contrato contiene un identificador inválido.",
            [{ value }]
        );
    }

    return value;
}

function requireNonNegativeInteger(
    value,
    code
) {
    if (
        !Number.isInteger(value) ||
        value < 0
    ) {
        throw BrokerGameError.invalidRule(
            code,
            "El contrato contiene un monto inválido.",
            [{ value }]
        );
    }

    return value;
}

function normalizeTimestamp(value) {
    if (value == null) {
        return null;
    }

    if (
        (
            typeof value !== "string" ||
            value.trim().length === 0
        ) &&
        !(
            typeof value === "number" &&
            Number.isFinite(value)
        )
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_TIMESTAMP_INVALID",
            "La fecha registrada no es válida.",
            [{ value }]
        );
    }

    return typeof value === "string"
        ? value.trim()
        : value;
}
