import {
    brokerLearningCatalog
} from "../learning/BrokerLearningCatalog.js";

export const BROKER_PUBLIC_LEARNING_CATALOG_VERSION =
    2;

const PUBLIC_CATALOG_KEYS = Object.freeze([
    "publicCatalogVersion",
    "sectionCount",
    "lessonCount",
    "sections",
    "lessons"
]);
const PUBLIC_LESSON_KEYS = Object.freeze([
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
    "baseReward",
    "accumulatedKnowledge"
]);
const PUBLIC_SECTION_KEYS = Object.freeze([
    "id",
    "order",
    "title",
    "description",
    "lessonIds"
]);

/**
 * Proyección curricular inmutable para el Webview. El contenido pedagógico
 * se entrega desde el Host; la UI no puede modificarlo ni enviar una copia de
 * vuelta como estado autoritativo.
 */
export function createBrokerPublicLearningCatalog(
    catalog = brokerLearningCatalog
) {
    requireCatalog(catalog);

    return Object.freeze({
        publicCatalogVersion:
            BROKER_PUBLIC_LEARNING_CATALOG_VERSION,
        sectionCount: catalog.sectionCount,
        lessonCount: catalog.lessonCount,
        sections: Object.freeze(
            catalog.listSections().map(
                section => Object.freeze({
                    ...section,
                    lessonIds: Object.freeze([
                        ...section.lessonIds
                    ])
                })
            )
        ),
        lessons: Object.freeze(
            catalog.listLessons().map(
                lesson => Object.freeze({
                    id: lesson.id,
                    sectionId: lesson.sectionId,
                    order: lesson.order,
                    title: lesson.title,
                    objective: lesson.objective,
                    problemStatement:
                        lesson.problemStatement ??
                        null,
                    concepts:
                        lesson.concepts ??
                        Object.freeze([]),
                    explanation:
                        lesson.explanation,
                    examples: lesson.examples,
                    formulas:
                        lesson.formulas ??
                        Object.freeze([]),
                    introducedKnowledge:
                        lesson.introducedKnowledge,
                    comparativeNotes:
                        lesson.comparativeNotes,
                    expectedContract:
                        lesson.expectedContract ??
                        null,
                    recommendedTools:
                        lesson.recommendedTools ??
                        Object.freeze([]),
                    familyId: lesson.familyId,
                    categoryId: lesson.categoryId,
                    baseReward: lesson.baseReward,
                    accumulatedKnowledge:
                        Object.freeze([
                            ...catalog
                                .getAccumulatedKnowledge(
                                    lesson.id
                                )
                        ])
                })
            )
        )
    });
}

/**
 * Revalida una proyección que cruzó la frontera de mensajes. Reconstruir el
 * modelo curricular evita confiar en objetos o arreglos mutables recibidos.
 */
export function parseBrokerPublicLearningCatalog(
    source
) {
    requirePlainRecord(source);
    requireExactKeys(
        source,
        PUBLIC_CATALOG_KEYS
    );

    if (
        source.publicCatalogVersion !==
            BROKER_PUBLIC_LEARNING_CATALOG_VERSION ||
        !Number.isSafeInteger(
            source.sectionCount
        ) ||
        !Number.isSafeInteger(
            source.lessonCount
        ) ||
        !Array.isArray(source.sections) ||
        !Array.isArray(source.lessons)
    ) {
        invalidCatalog();
    }

    if (
        source.sections.length !==
            source.sectionCount ||
        source.lessons.length !==
            source.lessonCount ||
        source.sectionCount < 1 ||
        source.lessonCount < 1
    ) {
        invalidCatalog();
    }

    const sections = source.sections.map(
        section => {
            requirePlainRecord(section);
            requireExactKeys(
                section,
                PUBLIC_SECTION_KEYS
            );
            requirePositiveInteger(section.order);
            requireText(section.id);
            requireText(section.title);
            requireText(section.description);
            requireTextArray(
                section.lessonIds,
                { allowEmpty: false }
            );

            return freezeJsonValue(section);
        }
    );
    const lessons = source.lessons.map(
        lesson => {
            requirePlainRecord(lesson);
            requireExactKeys(
                lesson,
                PUBLIC_LESSON_KEYS
            );
            requireText(lesson.id);
            requireText(lesson.sectionId);
            requirePositiveInteger(lesson.order);
            requireText(lesson.title);
            requireText(lesson.objective);
            requireNullableText(
                lesson.problemStatement
            );
            requireText(lesson.familyId);
            requireText(lesson.categoryId);
            requirePositiveInteger(
                lesson.baseReward
            );
            requireTextArray(
                lesson.concepts
            );
            requireTextArray(
                lesson.introducedKnowledge,
                { allowEmpty: false }
            );
            requireTextArray(
                lesson.accumulatedKnowledge,
                { allowEmpty: false }
            );

            if (
                !Array.isArray(lesson.explanation) ||
                !Array.isArray(lesson.examples) ||
                !Array.isArray(lesson.formulas) ||
                !Array.isArray(
                    lesson.comparativeNotes
                )
            ) {
                invalidCatalog();
            }

            requireNullableText(
                lesson.expectedContract
            );
            requireTextArray(
                lesson.recommendedTools
            );
            requirePublicFormulas(
                lesson.formulas
            );

            return freezeJsonValue(lesson);
        }
    );

    requireCatalogRelations(sections, lessons);

    return Object.freeze({
        publicCatalogVersion:
            BROKER_PUBLIC_LEARNING_CATALOG_VERSION,
        sectionCount: sections.length,
        lessonCount: lessons.length,
        sections: Object.freeze(sections),
        lessons: Object.freeze(lessons)
    });
}

/**
 * Reconstruye el puerto de solo lectura que necesita el dominio a partir de
 * una proyecciÃ³n ya validada. Se utiliza al recibir de nuevo un mensaje del
 * Host en el Webview: el catÃ¡logo sigue siendo datos, no autoridad mutable.
 */
export function createBrokerLearningCatalogAdapterFromPublic(
    source
) {
    const catalog =
        parseBrokerPublicLearningCatalog(source);
    const sections = catalog.sections;
    const lessons = catalog.lessons;
    const lessonById = new Map(
        lessons.map(lesson => [lesson.id, lesson])
    );

    return Object.freeze({
        sectionCount: catalog.sectionCount,
        lessonCount: catalog.lessonCount,
        listSections() {
            return sections;
        },
        listLessons() {
            return lessons;
        },
        requireLesson(lessonId) {
            const lesson = lessonById.get(lessonId);

            if (lesson == null) {
                throw new TypeError(
                    "Unknown BROKER.95 public learning lesson."
                );
            }

            return lesson;
        },
        getAccumulatedKnowledge(lessonId) {
            return this.requireLesson(lessonId)
                .accumulatedKnowledge;
        }
    });
}

function requireCatalog(catalog) {
    if (
        catalog == null ||
        typeof catalog.listSections !==
            "function" ||
        typeof catalog.listLessons !==
            "function" ||
        typeof catalog.getAccumulatedKnowledge !==
            "function" ||
        !Number.isSafeInteger(
            catalog.sectionCount
        ) ||
        !Number.isSafeInteger(
            catalog.lessonCount
        )
    ) {
        throw new TypeError(
            "BROKER.95 public learning catalog requires a valid catalog."
        );
    }
}

function requirePlainRecord(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        (
            Object.getPrototypeOf(value) !==
                Object.prototype &&
            Object.getPrototypeOf(value) !==
                null
        )
    ) {
        invalidCatalog();
    }
}

function requireExactKeys(value, expected) {
    const keys = Object.keys(value);

    if (
        keys.length !== expected.length ||
        keys.some(key =>
            !expected.includes(key)
        )
    ) {
        invalidCatalog();
    }
}

function requireCatalogRelations(
    sections,
    lessons
) {
    const sectionIds = new Set();
    const lessonIds = new Set();
    const referencedLessonIds = [];

    for (const [index, section] of
        sections.entries()) {
        if (
            sectionIds.has(section.id) ||
            section.order !== index + 1
        ) {
            invalidCatalog();
        }
        sectionIds.add(section.id);
        referencedLessonIds.push(
            ...section.lessonIds
        );
    }

    const accumulated = [];
    const accumulatedSet = new Set();

    for (const [index, lesson] of
        lessons.entries()) {
        if (
            lessonIds.has(lesson.id) ||
            !sectionIds.has(lesson.sectionId) ||
            lesson.order !== index + 1 ||
            new Set(
                lesson.introducedKnowledge
            ).size !==
                lesson.introducedKnowledge.length
        ) {
            invalidCatalog();
        }
        lessonIds.add(lesson.id);

        for (const knowledge of
            lesson.introducedKnowledge) {
            if (!accumulatedSet.has(knowledge)) {
                accumulatedSet.add(knowledge);
                accumulated.push(knowledge);
            }
        }

        if (
            accumulated.length !==
                lesson.accumulatedKnowledge.length ||
            accumulated.some(
                (knowledge, index) =>
                    knowledge !==
                    lesson.accumulatedKnowledge[index]
            )
        ) {
            invalidCatalog();
        }
    }

    if (
        referencedLessonIds.length !==
            lessons.length ||
        new Set(referencedLessonIds).size !==
            lessons.length ||
        referencedLessonIds.some(
            (lessonId, index) =>
                lessonId !== lessons[index].id ||
                sections.find(section =>
                    section.lessonIds.includes(
                        lessonId
                    )
                )?.id !==
                    lessons[index].sectionId
        )
    ) {
        invalidCatalog();
    }
}

function requireText(value) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0
    ) {
        invalidCatalog();
    }
}

function requireNullableText(value) {
    if (value != null) {
        requireText(value);
    }
}

function requirePublicFormulas(formulas) {
    const ids = new Set();

    for (const formula of formulas) {
        requirePlainRecord(formula);

        if (
            Object.keys(formula).length !== 4 ||
            !Object.hasOwn(formula, "id") ||
            !Object.hasOwn(formula, "title") ||
            !Object.hasOwn(formula, "latex") ||
            !Object.hasOwn(formula, "description")
        ) {
            invalidCatalog();
        }

        requireText(formula.id);
        requireText(formula.title);
        requireText(formula.latex);
        requireNullableText(formula.description);

        if (ids.has(formula.id)) {
            invalidCatalog();
        }

        ids.add(formula.id);
    }
}

function requireTextArray(
    value,
    { allowEmpty = true } = {}
) {
    if (
        !Array.isArray(value) ||
        (!allowEmpty && value.length === 0) ||
        value.some(item => {
            try {
                requireText(item);
                return false;
            } catch {
                return true;
            }
        })
    ) {
        invalidCatalog();
    }
}

function requirePositiveInteger(value) {
    if (
        !Number.isSafeInteger(value) ||
        value < 1
    ) {
        invalidCatalog();
    }
}

function freezeJsonValue(value) {
    if (Array.isArray(value)) {
        return Object.freeze(
            value.map(freezeJsonValue)
        );
    }

    if (value != null && typeof value === "object") {
        requirePlainRecord(value);

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

    if (
        value == null ||
        typeof value === "string" ||
        typeof value === "boolean" ||
        (
            typeof value === "number" &&
            Number.isFinite(value)
        )
    ) {
        return value;
    }

    invalidCatalog();
}

function invalidCatalog() {
    throw new TypeError(
        "Invalid BROKER.95 public learning catalog."
    );
}
