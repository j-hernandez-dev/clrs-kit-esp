import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER_CLIENT_CATEGORY_COUNT,
    BROKER_LEARNING_CATEGORY_COUNT,
    BROKER_LEARNING_CATEGORY_IDS,
    BrokerCategoryAudience,
    BrokerCategorySelector,
    BrokerRisk,
    brokerCategoryCatalog,
    brokerLearningCatalog,
    createBrokerLearningLesson,
    listBrokerLearningCategories,
    requireBrokerLearningCategory
} from "../src/broker95/index.js";

const EXPECTED_LEARNING_CATEGORIES = Object.freeze([
    ["FND-OPERAT", "Operaciones básicas"],
    ["FND-IO", "Entrada y salida"],
    ["FND-DATA", "Datos y variables"],
    ["FND-TEXT", "Texto básico"],
    ["FND-CONTROL", "Control de flujo"],
    ["FND-FUNC", "Funciones"],
    ["FND-COLLECTION", "Colecciones básicas"],
    ["FND-ALG", "Algoritmos"],
    ["FND-ALG-ANALY", "Análisis de algoritmos"],
    ["FND-ALG-RECUR", "Recursión"],
    ["FND-ALG-DESIGN", "Diseño de algoritmos"],
    ["NUM-ALG-VERIF", "Verificación de algoritmos"]
]);

const PROGRAMMING_CATEGORY_IDS = Object.freeze([
    "FND-OPERAT",
    "FND-IO",
    "FND-DATA",
    "FND-TEXT",
    "FND-CONTROL",
    "FND-FUNC",
    "FND-COLLECTION"
]);

const EXPECTED_LESSON_DISTRIBUTION = Object.freeze({
    "FND-OPERAT": 5,
    "FND-IO": 4,
    "FND-DATA": 7,
    "FND-TEXT": 5,
    "FND-CONTROL": 11,
    "FND-FUNC": 8,
    "FND-COLLECTION": 10
});

test("define doce categorías FND reservadas para las rutas educativas", () => {
    const categories = listBrokerLearningCategories();

    assert.equal(categories.length, BROKER_LEARNING_CATEGORY_COUNT);
    assert.deepEqual(
        categories.map(category => [
            category.categoryId,
            category.categoryName
        ]),
        EXPECTED_LEARNING_CATEGORIES
    );
    assert.deepEqual(
        BROKER_LEARNING_CATEGORY_IDS,
        EXPECTED_LEARNING_CATEGORIES.map(([categoryId]) => categoryId)
    );

    for (const category of categories) {
        assert.equal(category.familyId, "FND");
        assert.deepEqual(
            category.audiences,
            [BrokerCategoryAudience.LEARNING]
        );
        assert.equal(
            requireBrokerLearningCategory(category.categoryId),
            category
        );
        assert.equal(Object.isFrozen(category.audiences), true);
    }
});

test("mantiene FND fuera de los contratos de cliente", () => {
    const clientCategories = brokerCategoryCatalog.listCategories({
        audience: BrokerCategoryAudience.CLIENT
    });
    const learningCategories = brokerCategoryCatalog.listCategories({
        audience: BrokerCategoryAudience.LEARNING
    });

    assert.equal(clientCategories.length, BROKER_CLIENT_CATEGORY_COUNT);
    assert.equal(learningCategories.length, BROKER_LEARNING_CATEGORY_COUNT);
    assert.equal(
        learningCategories.every(category =>
            !category.audiences.includes(BrokerCategoryAudience.CLIENT)
        ),
        true
    );
    assert.equal(
        clientCategories.some(category => category.familyId === "FND"),
        false
    );
});

test("el selector de contratos normales usa diez categorías fáciles no FND", () => {
    const candidates = new BrokerCategorySelector({
        random: () => 0
    }).getCandidates({ risk: BrokerRisk.LOW });

    assert.equal(candidates.length, 10);
    assert.equal(
        candidates.every(candidate =>
            candidate.category.familyId !== "FND"
        ),
        true
    );
    assert.deepEqual(
        candidates.slice(0, 3).map(
            candidate => candidate.category.categoryId
        ),
        ["NUM-ARITH", "NUM-CONV", "NUM-DIGIT"]
    );
});

test("asigna las 50 lecciones actuales a las siete categorías de Programación", () => {
    const distribution = Object.fromEntries(
        PROGRAMMING_CATEGORY_IDS.map(categoryId => [
            categoryId,
            brokerLearningCatalog.listCategoryLessons(categoryId).length
        ])
    );

    assert.deepEqual(distribution, EXPECTED_LESSON_DISTRIBUTION);
    assert.equal(
        Object.values(distribution).reduce(
            (total, count) => total + count,
            0
        ),
        50
    );

    for (const lesson of brokerLearningCatalog.listLessons()) {
        assert.equal(PROGRAMMING_CATEGORY_IDS.includes(lesson.categoryId), true);
    }
});

test("conserva las categorías de Algoritmia sin publicar lecciones incompletas", () => {
    for (const categoryId of BROKER_LEARNING_CATEGORY_IDS.filter(
        categoryId => !PROGRAMMING_CATEGORY_IDS.includes(categoryId)
    )) {
        assert.throws(
            () => brokerLearningCatalog.listCategoryLessons(categoryId),
            error =>
                error.code === "BROKER95_LEARNING_CATEGORY_NOT_USED"
        );
    }
});

test("rechaza categorías de cliente dentro de una lección", () => {
    assert.throws(
        () => createBrokerLearningLesson({
            ...learningLessonSource(),
            categoryId: "NUM-ARITH"
        }),
        error =>
            error.code ===
            "BROKER95_LEARNING_LESSON_CATEGORY_INVALID"
    );
    assert.throws(
        () => requireBrokerLearningCategory("STRING-PAL"),
        error => error.code === "BROKER95_LEARNING_CATEGORY_INVALID"
    );
});

test("rechaza audiencias desconocidas con un error estructurado", () => {
    assert.throws(
        () => brokerCategoryCatalog.listCategories({
            audience: "desconocida"
        }),
        error => error.code === "BROKER95_CATEGORY_AUDIENCE_INVALID"
    );
    assert.throws(
        () => brokerCategoryCatalog.supportsAudience(
            "FND-OPERAT",
            "desconocida"
        ),
        error => error.code === "BROKER95_CATEGORY_AUDIENCE_INVALID"
    );
});

function learningLessonSource() {
    return {
        id: "lesson-001",
        sectionId: "section-001",
        order: 1,
        title: "Lección de prueba",
        objective: "Comprobar la taxonomía curricular.",
        explanation: [{
            kind: "paragraph",
            text: "La lección utiliza una categoría educativa."
        }],
        examples: [{
            id: "learning-example",
            language: "clrs",
            content: "escribir 1"
        }],
        introducedKnowledge: ["mostrar un valor"],
        familyId: "FND",
        categoryId: "FND-IO",
        baseReward: 10
    };
}
