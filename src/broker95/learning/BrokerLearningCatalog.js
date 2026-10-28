import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    BROKER_LEARNING_CURRICULUM_SOURCE
} from "./BrokerLearningCatalogData.js";
import {
    createBrokerLearningCurriculum
} from "./BrokerLearningModel.js";

export const BROKER_LEARNING_SECTION_COUNT = 8;
export const BROKER_LEARNING_LESSON_COUNT = 50;

export const brokerLearningCurriculum =
    createBrokerLearningCurriculum(
        BROKER_LEARNING_CURRICULUM_SOURCE
    );

assertCanonicalCurriculum(
    brokerLearningCurriculum
);

export class BrokerLearningCatalog {

    #curriculum;
    #sectionById;
    #lessonById;
    #lessonsBySectionId;
    #lessonsByCategoryId;
    #accumulatedKnowledgeByLessonId;

    constructor(
        curriculum = brokerLearningCurriculum,
        options = {}
    ) {
        this.#curriculum =
            createBrokerLearningCurriculum(
                curriculum,
                options
            );
        this.#sectionById = new Map(
            this.#curriculum.sections.map(
                section => [section.id, section]
            )
        );
        this.#lessonById = new Map(
            this.#curriculum.lessons.map(
                lesson => [lesson.id, lesson]
            )
        );
        this.#lessonsBySectionId = new Map(
            this.#curriculum.sections.map(
                section => [
                    section.id,
                    Object.freeze(
                        section.lessonIds.map(
                            lessonId =>
                                this.#lessonById.get(
                                    lessonId
                                )
                        )
                    )
                ]
            )
        );
        this.#lessonsByCategoryId =
            buildLessonsByCategory(
                this.#curriculum.lessons
            );
        this.#accumulatedKnowledgeByLessonId =
            buildAccumulatedKnowledge(
                this.#curriculum.lessons
            );
    }

    get sectionCount() {
        return this.#curriculum.sections.length;
    }

    get lessonCount() {
        return this.#curriculum.lessons.length;
    }

    listSections() {
        return this.#curriculum.sections;
    }

    listLessons() {
        return this.#curriculum.lessons;
    }

    getSection(sectionId) {
        return this.#sectionById.get(
            sectionId
        ) ?? null;
    }

    requireSection(sectionId) {
        const section = this.getSection(sectionId);

        if (section == null) {
            throw BrokerGameError.invalidRule(
                "BROKER95_LEARNING_SECTION_NOT_FOUND",
                "La sección de aprendizaje solicitada no existe.",
                [{ sectionId }]
            );
        }

        return section;
    }

    getLesson(lessonId) {
        return this.#lessonById.get(
            lessonId
        ) ?? null;
    }

    requireLesson(lessonId) {
        const lesson = this.getLesson(lessonId);

        if (lesson == null) {
            throw BrokerGameError.invalidRule(
                "BROKER95_LEARNING_LESSON_NOT_FOUND",
                "La lección de aprendizaje solicitada no existe.",
                [{ lessonId }]
            );
        }

        return lesson;
    }

    listSectionLessons(sectionId) {
        this.requireSection(sectionId);

        return this.#lessonsBySectionId.get(
            sectionId
        );
    }

    listCategoryLessons(categoryId) {
        const lessons =
            this.#lessonsByCategoryId.get(
                categoryId
            );

        if (lessons == null) {
            throw BrokerGameError.invalidRule(
                "BROKER95_LEARNING_CATEGORY_NOT_USED",
                "La categoría indicada no forma parte de la ruta de aprendizaje.",
                [{ categoryId }]
            );
        }

        return lessons;
    }

    getAccumulatedKnowledge(lessonId) {
        this.requireLesson(lessonId);

        return this
            .#accumulatedKnowledgeByLessonId
            .get(lessonId);
    }
}

export const brokerLearningCatalog =
    Object.freeze(
        new BrokerLearningCatalog()
    );

function buildAccumulatedKnowledge(lessons) {
    const byLessonId = new Map();
    const accumulated = [];
    const normalizedKnowledge = new Set();

    for (const lesson of lessons) {
        for (
            const knowledge of
            lesson.introducedKnowledge
        ) {
            const normalized = knowledge
                .normalize("NFKC")
                .toLocaleLowerCase("es-MX");

            if (!normalizedKnowledge.has(normalized)) {
                normalizedKnowledge.add(normalized);
                accumulated.push(knowledge);
            }
        }

        byLessonId.set(
            lesson.id,
            Object.freeze([...accumulated])
        );
    }

    return byLessonId;
}

function buildLessonsByCategory(lessons) {
    const mutable = new Map();

    for (const lesson of lessons) {
        const categoryLessons = mutable.get(
            lesson.categoryId
        ) ?? [];

        categoryLessons.push(lesson);
        mutable.set(
            lesson.categoryId,
            categoryLessons
        );
    }

    return new Map(
        [...mutable.entries()].map(
            ([categoryId, categoryLessons]) => [
                categoryId,
                Object.freeze(categoryLessons)
            ]
        )
    );
}

function assertCanonicalCurriculum(curriculum) {
    if (
        curriculum.sections.length !==
            BROKER_LEARNING_SECTION_COUNT ||
        curriculum.lessons.length !==
            BROKER_LEARNING_LESSON_COUNT
    ) {
        throw new Error(
            "The canonical BROKER.95 learning curriculum must contain 8 sections and 50 lessons."
        );
    }
}
