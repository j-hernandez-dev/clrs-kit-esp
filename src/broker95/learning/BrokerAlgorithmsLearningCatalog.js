import {
    BROKER_ALGORITHMS_LEARNING_CURRICULUM_SOURCE
} from "./BrokerAlgorithmsLearningCatalogData.js";
import {
    BrokerLearningCatalog
} from "./BrokerLearningCatalog.js";
import {
    createBrokerLearningCurriculum
} from "./BrokerLearningModel.js";

export const BROKER_ALGORITHMS_LEARNING_SECTION_COUNT = 8;
export const BROKER_ALGORITHMS_LEARNING_LESSON_COUNT = 57;

export const BROKER_ALGORITHMS_LEARNING_ID_OPTIONS =
    Object.freeze({
        sectionIdPrefix: "algorithm-section-",
        lessonIdPrefix: "algorithm-lesson-"
    });

export const brokerAlgorithmsLearningCurriculum =
    createBrokerLearningCurriculum(
        BROKER_ALGORITHMS_LEARNING_CURRICULUM_SOURCE,
        BROKER_ALGORITHMS_LEARNING_ID_OPTIONS
    );

assertAlgorithmsCurriculum(
    brokerAlgorithmsLearningCurriculum
);

export const brokerAlgorithmsLearningCatalog =
    Object.freeze(
        new BrokerLearningCatalog(
            brokerAlgorithmsLearningCurriculum,
            BROKER_ALGORITHMS_LEARNING_ID_OPTIONS
        )
    );

function assertAlgorithmsCurriculum(curriculum) {
    if (
        curriculum.sections.length !==
            BROKER_ALGORITHMS_LEARNING_SECTION_COUNT ||
        curriculum.lessons.length !==
            BROKER_ALGORITHMS_LEARNING_LESSON_COUNT ||
        curriculum.sections.at(0)?.id !==
            "algorithm-section-001" ||
        curriculum.sections.at(-1)?.id !==
            "algorithm-section-008" ||
        curriculum.lessons.at(0)?.id !==
            "algorithm-lesson-001" ||
        curriculum.lessons.at(-1)?.id !==
            "algorithm-lesson-057"
    ) {
        throw new Error(
            "Invalid canonical BROKER.95 Algorithms learning curriculum."
        );
    }
}
