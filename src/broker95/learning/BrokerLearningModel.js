import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    brokerCategoryCatalog
} from "../catalog/BrokerCategoryCatalog.js";
import {
    requireBrokerLearningCategory
} from "../catalog/BrokerLearningCategoryTaxonomy.js";
import {
    createBrokerLearningContentBlocks,
    createBrokerLearningExamples,
    createBrokerLearningFormulas,
    createBrokerLearningTextList
} from "./BrokerLearningContent.js";
import {
    createBrokerLearningToolIds
} from "./BrokerLearningToolRecommendation.js";

export const BROKER_LEARNING_FAMILY_ID = "FND";

export const BROKER_LEARNING_MODEL_LIMITS =
    Object.freeze({
        sections: 64,
        lessons: 512,
        sectionLessons: 128,
        titleCharacters: 240,
        objectiveCharacters: 2_000,
        descriptionCharacters: 4_000,
        knowledgeItems: 64,
        noteBlocks: 24
    });

export function createBrokerLearningSection(
    source = {},
    options = {}
) {
    const input = requireRecord(
        source,
        "BROKER95_LEARNING_SECTION_INVALID"
    );

    requireExactFields(
        input,
        [
            "id",
            "order",
            "title",
            "description",
            "lessonIds"
        ],
        "BROKER95_LEARNING_SECTION_FIELDS_INVALID"
    );

    const lessonIds = requireIdentifierList(
        input.lessonIds,
        {
            prefix:
                options.lessonIdPrefix ??
                "lesson-",
            minimum: 1,
            maximum:
                BROKER_LEARNING_MODEL_LIMITS
                    .sectionLessons,
            code:
                "BROKER95_LEARNING_SECTION_LESSONS_INVALID"
        }
    );
    const id = requireCanonicalId(
        input.id,
        options.sectionIdPrefix ??
            "section-",
        "BROKER95_LEARNING_SECTION_ID_INVALID"
    );
    const order = requirePositiveInteger(
        input.order,
        "BROKER95_LEARNING_SECTION_ORDER_INVALID"
    );

    requireIdOrderConsistency(
        id,
        order,
        "BROKER95_LEARNING_SECTION_ID_ORDER_MISMATCH"
    );

    return Object.freeze({
        id,
        order,
        title: requireInlineText(
            input.title,
            BROKER_LEARNING_MODEL_LIMITS
                .titleCharacters,
            "BROKER95_LEARNING_SECTION_TITLE_INVALID"
        ),
        description: requireMultilineText(
            input.description,
            BROKER_LEARNING_MODEL_LIMITS
                .descriptionCharacters,
            "BROKER95_LEARNING_SECTION_DESCRIPTION_INVALID"
        ),
        lessonIds
    });
}

export function createBrokerLearningLesson(
    source = {},
    options = {}
) {
    const input = requireRecord(
        source,
        "BROKER95_LEARNING_LESSON_INVALID"
    );

    requireExactFields(
        input,
        [
            "id",
            "sectionId",
            "order",
            "title",
            "objective",
            "problemStatement",
            "concepts",
            "explanation",
            "examples",
            "formulas",
            "introducedKnowledge",
            "comparativeNotes",
            "expectedContract",
            "recommendedTools",
            "familyId",
            "categoryId",
            "baseReward"
        ],
        "BROKER95_LEARNING_LESSON_FIELDS_INVALID",
        [
            "id",
            "sectionId",
            "order",
            "title",
            "objective",
            "explanation",
            "examples",
            "introducedKnowledge",
            "familyId",
            "categoryId",
            "baseReward"
        ]
    );

    const familyId = requireLearningFamily(
        input.familyId
    );
    const category = requireLearningCategory(
        input.categoryId,
        options.categoryCatalog ??
            brokerCategoryCatalog
    );

    if (category.familyId !== familyId) {
        invalid(
            "BROKER95_LEARNING_LESSON_CATEGORY_FAMILY_MISMATCH"
        );
    }

    const id = requireCanonicalId(
        input.id,
        options.lessonIdPrefix ??
            "lesson-",
        "BROKER95_LEARNING_LESSON_ID_INVALID"
    );
    const order = requirePositiveInteger(
        input.order,
        "BROKER95_LEARNING_LESSON_ORDER_INVALID"
    );

    requireIdOrderConsistency(
        id,
        order,
        "BROKER95_LEARNING_LESSON_ID_ORDER_MISMATCH"
    );

    return Object.freeze({
        id,
        sectionId: requireCanonicalId(
            input.sectionId,
            options.sectionIdPrefix ??
                "section-",
            "BROKER95_LEARNING_LESSON_SECTION_INVALID"
        ),
        order,
        title: requireInlineText(
            input.title,
            BROKER_LEARNING_MODEL_LIMITS
                .titleCharacters,
            "BROKER95_LEARNING_LESSON_TITLE_INVALID"
        ),
        objective: requireMultilineText(
            input.objective,
            BROKER_LEARNING_MODEL_LIMITS
                .objectiveCharacters,
            "BROKER95_LEARNING_LESSON_OBJECTIVE_INVALID"
        ),
        problemStatement:
            input.problemStatement == null
                ? null
                : requireMultilineText(
                    input.problemStatement,
                    BROKER_LEARNING_MODEL_LIMITS
                        .descriptionCharacters,
                    "BROKER95_LEARNING_LESSON_PROBLEM_INVALID"
                ),
        concepts: createBrokerLearningTextList(
            input.concepts ?? [],
            {
                minimum: 0,
                maximum:
                    BROKER_LEARNING_MODEL_LIMITS
                        .knowledgeItems,
                code:
                    "BROKER95_LEARNING_LESSON_CONCEPTS_INVALID"
            }
        ),
        explanation:
            createBrokerLearningContentBlocks(
                input.explanation
            ),
        examples: createBrokerLearningExamples(
            input.examples
        ),
        formulas: createBrokerLearningFormulas(
            input.formulas ?? []
        ),
        introducedKnowledge:
            createBrokerLearningTextList(
                input.introducedKnowledge,
                {
                    minimum: 1,
                    maximum:
                        BROKER_LEARNING_MODEL_LIMITS
                            .knowledgeItems,
                    code:
                        "BROKER95_LEARNING_LESSON_KNOWLEDGE_INVALID"
                }
            ),
        comparativeNotes:
            input.comparativeNotes == null
                ? Object.freeze([])
                : createBrokerLearningContentBlocks(
                    input.comparativeNotes,
                    {
                        minimum: 0,
                        maximum:
                            BROKER_LEARNING_MODEL_LIMITS
                                .noteBlocks
                    }
                ),
        expectedContract:
            input.expectedContract == null
                ? null
                : requireMultilineText(
                    input.expectedContract,
                    BROKER_LEARNING_MODEL_LIMITS
                        .descriptionCharacters,
                    "BROKER95_LEARNING_LESSON_EXPECTED_CONTRACT_INVALID"
                ),
        recommendedTools:
            createBrokerLearningToolIds(
                input.recommendedTools ?? []
            ),
        familyId,
        categoryId: category.categoryId,
        baseReward: requirePositiveInteger(
            input.baseReward,
            "BROKER95_LEARNING_LESSON_REWARD_INVALID"
        )
    });
}

export function createBrokerLearningCurriculum(
    source = {},
    options = {}
) {
    const input = requireRecord(
        source,
        "BROKER95_LEARNING_CURRICULUM_INVALID"
    );

    requireExactFields(
        input,
        ["sections", "lessons"],
        "BROKER95_LEARNING_CURRICULUM_FIELDS_INVALID"
    );

    if (
        !Array.isArray(input.sections) ||
        input.sections.length === 0 ||
        input.sections.length >
            BROKER_LEARNING_MODEL_LIMITS.sections ||
        !Array.isArray(input.lessons) ||
        input.lessons.length === 0 ||
        input.lessons.length >
            BROKER_LEARNING_MODEL_LIMITS.lessons
    ) {
        invalid(
            "BROKER95_LEARNING_CURRICULUM_SIZE_INVALID"
        );
    }

    const sections = input.sections
        .map(section =>
            createBrokerLearningSection(
                section,
                options
            )
        )
        .sort((left, right) =>
            left.order - right.order
        );
    const lessons = input.lessons
        .map(lesson =>
            createBrokerLearningLesson(
                lesson,
                options
            )
        )
        .sort((left, right) =>
            left.order - right.order
        );

    requireUniqueValues(
        sections.map(section => section.id),
        "BROKER95_LEARNING_SECTION_IDS_DUPLICATED"
    );
    requireUniqueValues(
        sections.map(section => section.order),
        "BROKER95_LEARNING_SECTION_ORDERS_DUPLICATED"
    );
    requireUniqueValues(
        lessons.map(lesson => lesson.id),
        "BROKER95_LEARNING_LESSON_IDS_DUPLICATED"
    );
    requireUniqueValues(
        lessons.map(lesson => lesson.order),
        "BROKER95_LEARNING_LESSON_ORDERS_DUPLICATED"
    );
    requireContiguousOrders(
        sections,
        "BROKER95_LEARNING_SECTION_ORDER_SEQUENCE_INVALID"
    );
    requireContiguousOrders(
        lessons,
        "BROKER95_LEARNING_LESSON_ORDER_SEQUENCE_INVALID"
    );
    requireCurriculumLinks(sections, lessons);

    return Object.freeze({
        sections: Object.freeze(sections),
        lessons: Object.freeze(lessons)
    });
}

function requireCurriculumLinks(
    sections,
    lessons
) {
    const sectionById = new Map(
        sections.map(section => [
            section.id,
            section
        ])
    );
    const lessonById = new Map(
        lessons.map(lesson => [
            lesson.id,
            lesson
        ])
    );
    const referencedLessonIds = sections.flatMap(
        section => section.lessonIds
    );

    requireUniqueValues(
        referencedLessonIds,
        "BROKER95_LEARNING_LESSON_SECTION_DUPLICATED"
    );

    if (
        referencedLessonIds.length !==
            lessons.length ||
        referencedLessonIds.some(
            lessonId => !lessonById.has(lessonId)
        ) ||
        lessons.some(lesson => {
            const section = sectionById.get(
                lesson.sectionId
            );

            return section == null ||
                !section.lessonIds.includes(
                    lesson.id
                );
        })
    ) {
        invalid(
            "BROKER95_LEARNING_CURRICULUM_LINKS_INVALID"
        );
    }

    for (const section of sections) {
        const sectionLessons = section.lessonIds
            .map(lessonId =>
                lessonById.get(lessonId)
            );
        const sortedIds = [...sectionLessons]
            .sort((left, right) =>
                left.order - right.order
            )
            .map(lesson => lesson.id);

        if (
            sortedIds.some(
                (lessonId, index) =>
                    lessonId !==
                        section.lessonIds[index]
            )
        ) {
            invalid(
                "BROKER95_LEARNING_SECTION_LESSON_ORDER_INVALID"
            );
        }
    }
}

function requireLearningFamily(value) {
    if (value !== BROKER_LEARNING_FAMILY_ID) {
        invalid(
            "BROKER95_LEARNING_LESSON_FAMILY_INVALID"
        );
    }

    return value;
}

function requireLearningCategory(
    categoryId,
    categoryCatalog
) {
    try {
        return requireBrokerLearningCategory(
            categoryId,
            categoryCatalog
        );
    } catch (error) {
        if (error instanceof TypeError) {
            throw error;
        }

        throw BrokerGameError.invalidRule(
            "BROKER95_LEARNING_LESSON_CATEGORY_INVALID",
            "La categoría curricular de BROKER.95 no es válida.",
            [{
                categoryId,
                causeCode: error?.code ?? null
            }]
        );
    }
}

function requireIdentifierList(
    source,
    {
        prefix,
        minimum,
        maximum,
        code
    }
) {
    if (
        !Array.isArray(source) ||
        source.length < minimum ||
        source.length > maximum
    ) {
        invalid(code);
    }

    const identifiers = source.map(value =>
        requireCanonicalId(
            value,
            prefix,
            code
        )
    );

    requireUniqueValues(identifiers, code);

    return Object.freeze(identifiers);
}

function requireCanonicalId(value, prefix, code) {
    if (
        typeof value !== "string" ||
        !new RegExp(
            `^${prefix}[0-9]{3,}$`,
            "u"
        ).test(value)
    ) {
        invalid(code);
    }

    return value;
}

function requireIdOrderConsistency(
    id,
    order,
    code
) {
    const suffix = Number.parseInt(
        id.slice(id.lastIndexOf("-") + 1),
        10
    );

    if (suffix !== order) {
        invalid(code);
    }
}

function requireContiguousOrders(items, code) {
    const ordered = [...items].sort(
        (left, right) =>
            left.order - right.order
    );

    if (
        ordered.some(
            (item, index) =>
                item.order !== index + 1
        )
    ) {
        invalid(code);
    }
}

function requireUniqueValues(values, code) {
    if (new Set(values).size !== values.length) {
        invalid(code);
    }
}

function requirePositiveInteger(value, code) {
    if (
        !Number.isSafeInteger(value) ||
        value <= 0
    ) {
        invalid(code);
    }

    return value;
}

function requireInlineText(value, maximum, code) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > maximum ||
        containsUnsafeControl(value, false)
    ) {
        invalid(code);
    }

    const normalized = value
        .replace(/\s+/gu, " ")
        .trim();

    if (normalized.length === 0) {
        invalid(code);
    }

    return normalized;
}

function requireMultilineText(value, maximum, code) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > maximum ||
        containsUnsafeControl(value, true)
    ) {
        invalid(code);
    }

    const normalized = value
        .replace(/\r\n?/gu, "\n")
        .split("\n")
        .map(line => line.trim())
        .join("\n")
        .trim();

    if (normalized.length === 0) {
        invalid(code);
    }

    return normalized;
}

function containsUnsafeControl(
    value,
    multiline
) {
    return [...value].some(character => {
        const code = character.codePointAt(0);

        return code < 32 &&
            character !== "\t" &&
            (
                !multiline ||
                (
                    character !== "\n" &&
                    character !== "\r"
                )
            );
    });
}

function requireRecord(value, code) {
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
    source,
    allowed,
    code,
    required = allowed
) {
    const keys = Object.keys(source);

    if (
        keys.some(key => !allowed.includes(key)) ||
        required.some(
            key => !Object.hasOwn(source, key)
        )
    ) {
        invalid(code);
    }
}

function invalid(code) {
    throw BrokerGameError.invalidRule(
        code,
        "El modelo curricular de BROKER.95 no es válido.",
        []
    );
}
