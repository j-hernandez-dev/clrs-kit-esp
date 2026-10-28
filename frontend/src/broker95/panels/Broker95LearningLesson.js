import {
    calculateBrokerPayout
} from "../../../../src/broker95/core/index.js";

export const Broker95LearningLessonAction =
    Object.freeze({
        OBTAIN: "obtain",
        REPEAT: "repeat",
        CONTRACT_LINKED: "contract-linked",
        LOCKED: "locked"
    });

export function createBroker95LearningLessonModel({
    lesson,
    routeLesson,
    section,
    notice = null,
    busy = false
}) {
    requireLessonProjection(
        lesson,
        routeLesson,
        section
    );

    const activeContractId =
        routeLesson.activeContractId;
    const contractLinked =
        Number.isSafeInteger(activeContractId);
    const completed =
        routeLesson.completed === true;
    const action = deriveAction({
        completed,
        contractLinked,
        canObtainContract:
            routeLesson.canObtainContract
    });
    const bestScore = routeLesson.bestScore;
    const earnedReward =
        bestScore == null
            ? null
            : calculateBrokerPayout(
                lesson.baseReward,
                bestScore
            );
    const matchingNotice =
        notice?.lessonId === lesson.id &&
        notice?.contractId === activeContractId
            ? notice
            : null;

    return Object.freeze({
        lesson,
        routeLesson,
        section,
        action,
        actionLabel: actionLabel(
            action,
            busy
        ),
        actionDisabled:
            busy ||
            action ===
                Broker95LearningLessonAction
                    .CONTRACT_LINKED ||
            action ===
                Broker95LearningLessonAction
                    .LOCKED,
        completed,
        contractLinked,
        activeContractId,
        bestScore,
        earnedReward,
        notice: matchingNotice
    });
}

function deriveAction({
    completed,
    contractLinked,
    canObtainContract
}) {
    if (contractLinked) {
        return Broker95LearningLessonAction
            .CONTRACT_LINKED;
    }

    if (canObtainContract !== true) {
        return Broker95LearningLessonAction
            .LOCKED;
    }

    return completed
        ? Broker95LearningLessonAction.REPEAT
        : Broker95LearningLessonAction.OBTAIN;
}

function actionLabel(action, busy) {
    if (busy) {
        return "CIPHER ESTÁ GENERANDO…";
    }

    return {
        [Broker95LearningLessonAction.OBTAIN]:
            "OBTENER CONTRATO",
        [Broker95LearningLessonAction.REPEAT]:
            "REPETIR CONTRATO",
        [Broker95LearningLessonAction
            .CONTRACT_LINKED]:
            "CONTRATO OBTENIDO",
        [Broker95LearningLessonAction.LOCKED]:
            "LECCIÓN BLOQUEADA"
    }[action];
}

function requireLessonProjection(
    lesson,
    routeLesson,
    section
) {
    if (
        typeof lesson?.id !== "string" ||
        lesson.sectionId !== section?.id ||
        routeLesson?.lessonId !== lesson.id ||
        routeLesson.sectionId !== section.id ||
        !Array.isArray(lesson.explanation) ||
        !Array.isArray(lesson.examples) ||
        !Array.isArray(lesson.formulas) ||
        !Array.isArray(lesson.concepts) ||
        !Array.isArray(
            lesson.introducedKnowledge
        ) ||
        !Array.isArray(
            lesson.accumulatedKnowledge
        ) ||
        !Array.isArray(
            lesson.comparativeNotes
        ) ||
        !Array.isArray(
            lesson.recommendedTools
        ) ||
        (
            lesson.problemStatement != null &&
            typeof lesson.problemStatement !==
                "string"
        ) ||
        (
            lesson.expectedContract != null &&
            typeof lesson.expectedContract !==
                "string"
        ) ||
        !Number.isSafeInteger(
            lesson.baseReward
        ) ||
        lesson.baseReward <= 0 ||
        (
            routeLesson.bestScore != null &&
            (
                !Number.isInteger(
                    routeLesson.bestScore
                ) ||
                routeLesson.bestScore < 0 ||
                routeLesson.bestScore > 100
            )
        )
    ) {
        throw new TypeError(
            "Invalid BROKER.95 learning lesson projection."
        );
    }
}
