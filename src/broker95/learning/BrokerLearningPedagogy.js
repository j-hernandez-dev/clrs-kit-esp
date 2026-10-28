import {
    isBrokerLearningContract
} from "../core/BrokerContract.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    createBrokerLearningCurricularContext,
    getBrokerLearningAllowedKnowledge
} from "./BrokerLearningCurricularContext.js";
import {
    BrokerLearningRouteId,
    BROKER_LEARNING_ROUTE_IDS,
    requireBrokerLearningRouteId
} from "./BrokerLearningRoutesProgress.js";

export const BrokerLearningPedagogyMode =
    Object.freeze({
        REVIEW: "guided-beginner",
        ASK: "open-tutor",
        EVALUATION:
            "definitive-functionality"
    });

const PEDAGOGY_MODES = Object.freeze(
    Object.values(BrokerLearningPedagogyMode)
);

const ALGORITHMIC_FOCUS_PATTERNS = Object.freeze({
    preconditions: /\bprecondici[oó]n(?:es)?\b/iu,
    postconditions: /\bpostcondici[oó]n(?:es)?\b/iu,
    paradigms:
        /\b(?:paradigma|fuerza bruta|divide y (?:vencer[aá]s|conquista)|voraz|backtracking|programaci[oó]n din[aá]mica|aleatorizaci[oó]n|reducci[oó]n)\b/iu
});

/**
 * Deriva el contexto pedagógico exclusivamente desde el contrato y los
 * catálogos autoritativos. Los contratos de cliente conservan el pipeline
 * general y no reciben contexto educativo.
 */
export function createBrokerLearningPedagogyContext(
    contract,
    mode,
    options = {}
) {
    if (!isBrokerLearningContract(contract)) {
        return null;
    }

    if (!PEDAGOGY_MODES.includes(mode)) {
        throw new TypeError(
            "Invalid BROKER.95 learning pedagogy mode."
        );
    }

    const learningRouteId =
        requireBrokerLearningRouteId(
            contract.learningRouteId
        );
    let curricularContext;

    try {
        curricularContext =
            createBrokerLearningCurricularContext(
                {
                    learningRouteId,
                    lessonId: contract.lessonId
                },
                {
                    catalogs: options.catalogs,
                    categoryCatalog:
                        options.categoryCatalog
                }
            );
    } catch (error) {
        if (
            error?.code ===
                "BROKER95_LEARNING_ROUTE_NOT_CATALOGED"
        ) {
            throw BrokerGameError.invalidRule(
                "BROKER95_LEARNING_PEDAGOGY_ROUTE_NOT_CATALOGED",
                "No fue posible resolver la ruta educativa del contrato.",
                [{ learningRouteId }]
            );
        }

        throw error;
    }

    const lesson = curricularContext.lesson;

    if (
        contract.sectionId !== lesson.sectionId ||
        contract.categoryId !==
            curricularContext.category.categoryId ||
        contract.familyId !==
            curricularContext.category.familyId
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_LEARNING_PEDAGOGY_CONTEXT_INVALID",
            "No fue posible vincular la operación con la lección activa.",
            [{
                contractId: contract.id,
                lessonId: contract.lessonId
            }]
        );
    }

    const accumulatedKnowledge =
        getBrokerLearningAllowedKnowledge(
            curricularContext
        );

    return Object.freeze({
        mode,
        learningRouteId,
        lesson,
        prerequisiteKnowledge:
            curricularContext.prerequisiteKnowledge,
        accumulatedRouteKnowledge:
            curricularContext
                .accumulatedRouteKnowledge,
        accumulatedKnowledge,
        blockedKnowledge:
            curricularContext
                .forbiddenFutureKnowledge,
        algorithmicReview:
            learningRouteId ===
                BrokerLearningRouteId.ALGORITHMS
                ? createAlgorithmicReviewContext(
                    curricularContext,
                    accumulatedKnowledge
                )
                : null,
        optionalTools:
            curricularContext.optionalTools,
        toolPolicy:
            curricularContext.toolPolicy,
        feedback: Object.freeze({
            language: "es",
            level: "beginner",
            explainSimply: true,
            preferHints: true,
            allowedKnowledgeOnly: true,
            algorithmicReasoning:
                learningRouteId ===
                    BrokerLearningRouteId.ALGORITHMS
        })
    });
}

export function isBrokerLearningPedagogyContext(
    value,
    mode
) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        value.mode === mode &&
        BROKER_LEARNING_ROUTE_IDS.includes(
            value.learningRouteId
        ) &&
        isLesson(value.lesson) &&
        isPrerequisiteKnowledge(
            value.prerequisiteKnowledge
        ) &&
        isTextList(
            value.accumulatedRouteKnowledge,
            1
        ) &&
        isTextList(value.accumulatedKnowledge, 1) &&
        isTextList(value.blockedKnowledge, 0) &&
        isAlgorithmicReview(
            value.algorithmicReview,
            value.learningRouteId
        ) &&
        isOptionalTools(value.optionalTools) &&
        isToolPolicy(value.toolPolicy) &&
        value.feedback != null &&
        typeof value.feedback === "object" &&
        !Array.isArray(value.feedback) &&
        value.feedback.language === "es" &&
        value.feedback.level === "beginner" &&
        value.feedback.explainSimply === true &&
        value.feedback.preferHints === true &&
        value.feedback.allowedKnowledgeOnly === true &&
        value.feedback.algorithmicReasoning ===
            (
                value.learningRouteId ===
                    BrokerLearningRouteId.ALGORITHMS
            );
}

function createAlgorithmicReviewContext(
    curricularContext,
    accumulatedKnowledge
) {
    const candidates = Object.freeze([
        curricularContext.lesson.objective,
        curricularContext.lesson.expectedPractice,
        ...accumulatedKnowledge
    ]);

    return Object.freeze({
        objective:
            curricularContext.lesson.objective,
        relevantPreconditions:
            selectRelevantKnowledge(
                candidates,
                ALGORITHMIC_FOCUS_PATTERNS
                    .preconditions
            ),
        relevantPostconditions:
            selectRelevantKnowledge(
                candidates,
                ALGORITHMIC_FOCUS_PATTERNS
                    .postconditions
            ),
        studiedParadigms:
            selectRelevantKnowledge(
                candidates,
                ALGORITHMIC_FOCUS_PATTERNS
                    .paradigms
            ),
        blockedConcepts:
            curricularContext
                .forbiddenFutureKnowledge
    });
}

function selectRelevantKnowledge(source, pattern) {
    const result = [];
    const seen = new Set();

    for (const item of source) {
        if (!pattern.test(item)) {
            continue;
        }

        const key = item
            .normalize("NFKC")
            .toLocaleLowerCase("es-MX");

        if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    }

    return Object.freeze(result);
}

function isLesson(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof value.lessonId === "string" &&
        typeof value.sectionId === "string" &&
        Number.isSafeInteger(value.order) &&
        value.order > 0 &&
        isText(value.title) &&
        isText(value.objective) &&
        isText(value.expectedPractice);
}

function isPrerequisiteKnowledge(value) {
    return Array.isArray(value) &&
        value.every(item =>
            item != null &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            BROKER_LEARNING_ROUTE_IDS.includes(
                item.learningRouteId
            ) &&
            isTextList(item.knowledge, 1)
        );
}

function isAlgorithmicReview(value, routeId) {
    if (routeId === BrokerLearningRouteId.PROGRAMMING) {
        return value === null;
    }

    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        isText(value.objective) &&
        isTextList(value.relevantPreconditions, 0) &&
        isTextList(value.relevantPostconditions, 0) &&
        isTextList(value.studiedParadigms, 0) &&
        isTextList(value.blockedConcepts, 0);
}

function isOptionalTools(value) {
    return Array.isArray(value) &&
        value.every(tool =>
            tool != null &&
            typeof tool === "object" &&
            !Array.isArray(tool) &&
            isText(tool.id) &&
            isText(tool.name) &&
            isText(tool.purpose)
        );
}

function isToolPolicy(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        value.recommendationOnly === true &&
        value.contractRequirementForbidden === true &&
        value.testRequirementForbidden === true &&
        value.evaluationImpact === "none";
}

function isTextList(value, minimum) {
    return Array.isArray(value) &&
        value.length >= minimum &&
        value.every(isText);
}

function isText(value) {
    return typeof value === "string" &&
        value.trim().length > 0;
}
