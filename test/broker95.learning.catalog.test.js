import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER_ALGORITHMS_LEARNING_LESSON_COUNT,
    BROKER_ALGORITHMS_LEARNING_SECTION_COUNT,
    BROKER_LEARNING_LESSON_COUNT,
    BROKER_LEARNING_SECTION_COUNT,
    BrokerGameError,
    BrokerLearningCatalog,
    BrokerLearningExampleLanguage,
    brokerCategoryCatalog,
    brokerAlgorithmsLearningCatalog,
    brokerLearningCatalog,
    brokerLearningCurriculum
} from "../src/broker95/index.js";

const ALGORITHM_SECTION_TITLES = Object.freeze([
    "Del problema al algoritmo",
    "Representar y seguir algoritmos",
    "Analizar algoritmos",
    "Crecimiento y análisis asintótico",
    "Pensar recursivamente",
    "Analizar algoritmos recursivos",
    "Especificar y demostrar algoritmos",
    "Diseñar algoritmos"
]);

const SECTION_LESSON_COUNTS = Object.freeze([
    4,
    7,
    6,
    5,
    8,
    7,
    8,
    5
]);

const SECTION_TITLES = Object.freeze([
    "Del problema al programa",
    "Representar información",
    "Texto y entrada",
    "Expresiones y operaciones",
    "Control de flujo y programación estructurada",
    "Funciones y programación procedimental",
    "Arreglos y colecciones",
    "Resolver problemas completos"
]);

const LESSON_TITLES = Object.freeze([
    "Código fuente y programa",
    "De un problema a instrucciones",
    "Flujo secuencial",
    "Entrada, procesamiento y salida",
    "Datos y valores",
    "Literales",
    "Identificadores",
    "Variables",
    "Declaración, inicialización y asignación",
    "Mutabilidad y estado",
    "Tipos de datos y sistemas de tipos",
    "Cadenas de caracteres",
    "Concatenación",
    "Secuencias de escape",
    "Examinar cadenas",
    "Transformar cadenas",
    "Leer y convertir datos",
    "Expresiones, operadores y operandos",
    "Operaciones aritméticas",
    "Precedencia y paréntesis",
    "Comparaciones",
    "Condiciones compuestas",
    "Programación estructurada",
    "Tomar una decisión con si",
    "Elegir entre varias alternativas",
    "Repetición con mientras",
    "Contadores",
    "Acumuladores",
    "Ciclo para",
    "Ciclos anidados",
    "Programación procedimental",
    "Crear una función",
    "Invocar una función",
    "Parámetros y argumentos",
    "Valores de retorno",
    "Ámbito",
    "Refactorización mediante funciones",
    "Qué es un arreglo",
    "Índices",
    "Crear y actualizar arreglos",
    "Tamaño y recorrido",
    "Operaciones con arreglos",
    "Arreglos multidimensionales",
    "Recorrer matrices",
    "Arreglos y funciones",
    "Entrada, procesamiento y salida",
    "Combinar estructuras de control",
    "Dividir un problema en subproblemas",
    "Primer prototipo algorítmico",
    "Tu siguiente paso como programador"
]);

test("publica el catálogo canónico completo de Algoritmia", () => {
    assert.equal(
        BROKER_ALGORITHMS_LEARNING_SECTION_COUNT,
        8
    );
    assert.equal(
        BROKER_ALGORITHMS_LEARNING_LESSON_COUNT,
        57
    );
    assert.equal(
        brokerAlgorithmsLearningCatalog.sectionCount,
        8
    );
    assert.equal(
        brokerAlgorithmsLearningCatalog.lessonCount,
        57
    );
    assert.deepEqual(
        brokerAlgorithmsLearningCatalog
            .listSections()
            .map(section => section.title),
        ALGORITHM_SECTION_TITLES
    );
    assert.deepEqual(
        brokerAlgorithmsLearningCatalog
            .listSections()
            .map(section => section.lessonIds.length),
        [6, 6, 7, 9, 7, 5, 6, 11]
    );
    assert.equal(
        brokerAlgorithmsLearningCatalog
            .listLessons().at(0).id,
        "algorithm-lesson-001"
    );
    assert.equal(
        brokerAlgorithmsLearningCatalog
            .listLessons().at(-1).id,
        "algorithm-lesson-057"
    );
    assert.equal(
        brokerAlgorithmsLearningCatalog
            .listLessons().at(-1).baseReward,
        253
    );
    assert.equal(
        brokerAlgorithmsLearningCatalog
            .getAccumulatedKnowledge(
                "algorithm-lesson-057"
            ).length,
        548
    );

    const algorithmLessons =
        brokerAlgorithmsLearningCatalog
            .listLessons();
    const asymptoticLesson =
        brokerAlgorithmsLearningCatalog
            .requireLesson(
                "algorithm-lesson-024"
            );

    assert.equal(
        algorithmLessons.every(lesson =>
            typeof lesson.problemStatement ===
                "string" &&
            lesson.concepts.length > 0 &&
            typeof lesson.expectedContract ===
                "string"
        ),
        true
    );
    assert.equal(
        asymptoticLesson.formulas.some(
            formula =>
                /Theta/u.test(formula.latex)
        ),
        true
    );
    assert.equal(
        Object.isFrozen(
            asymptoticLesson.formulas
        ),
        true
    );
});

const EXPECTED_REWARDS = Object.freeze([
    10, 12, 14, 16, 18, 20, 22, 24,
    26, 28, 30, 32, 34, 36, 38, 40,
    42, 44, 46, 48, 50, 52, 54, 56,
    58, 60, 62, 64, 66, 68, 70, 72,
    74, 76, 78, 80, 82, 84, 86, 88,
    90, 92, 94, 96, 98, 100, 102, 104,
    106, 108
]);

test("publica las 8 secciones y las 50 lecciones curriculares", () => {
    assert.equal(
        BROKER_LEARNING_SECTION_COUNT,
        8
    );
    assert.equal(
        BROKER_LEARNING_LESSON_COUNT,
        50
    );
    assert.equal(
        brokerLearningCatalog.sectionCount,
        8
    );
    assert.equal(
        brokerLearningCatalog.lessonCount,
        50
    );
    assert.deepEqual(
        brokerLearningCatalog
            .listSections()
            .map(section => section.title),
        SECTION_TITLES
    );
    assert.deepEqual(
        brokerLearningCatalog
            .listLessons()
            .map(lesson => lesson.title),
        LESSON_TITLES
    );
});

test("respeta la distribución oficial de lecciones por sección", () => {
    assert.deepEqual(
        brokerLearningCatalog
            .listSections()
            .map(section =>
                brokerLearningCatalog
                    .listSectionLessons(section.id)
                    .length
            ),
        SECTION_LESSON_COUNTS
    );

    for (
        const section of
        brokerLearningCatalog.listSections()
    ) {
        const sectionLessons =
            brokerLearningCatalog
                .listSectionLessons(section.id);

        assert.deepEqual(
            sectionLessons.map(lesson => lesson.id),
            section.lessonIds
        );
        assert.equal(
            sectionLessons.every(
                lesson =>
                    lesson.sectionId === section.id
            ),
            true
        );
    }
});

test("mantiene contenido curricular completo, estructurado e inmutable", () => {
    for (
        const lesson of
        brokerLearningCatalog.listLessons()
    ) {
        assert.equal(lesson.objective.length > 20, true);
        assert.equal(
            typeof lesson.expectedContract ===
                "string" &&
            lesson.expectedContract.length > 20,
            true
        );
        assert.equal(lesson.explanation.length > 0, true);
        assert.equal(lesson.examples.length > 0, true);
        assert.equal(
            lesson.introducedKnowledge.length > 0,
            true
        );
        assert.equal(Object.isFrozen(lesson), true);
        assert.equal(
            Object.isFrozen(lesson.explanation),
            true
        );
        assert.equal(
            Object.isFrozen(lesson.examples),
            true
        );
        assert.equal(
            Object.isFrozen(
                lesson.introducedKnowledge
            ),
            true
        );
        assert.equal(
            Object.isFrozen(
                lesson.comparativeNotes
            ),
            true
        );
    }

    assert.equal(
        Object.isFrozen(brokerLearningCurriculum),
        true
    );
});

test("deriva conocimientos acumulados de las lecciones anteriores y la actual", () => {
    const first = brokerLearningCatalog
        .getAccumulatedKnowledge("lesson-001");
    const comparisonLesson = brokerLearningCatalog
        .getAccumulatedKnowledge("lesson-021");
    const last = brokerLearningCatalog
        .getAccumulatedKnowledge("lesson-050");

    assert.deepEqual(
        first,
        brokerLearningCatalog
            .requireLesson("lesson-001")
            .introducedKnowledge
    );
    assert.equal(
        comparisonLesson.includes(
            "diferenciar asignación mediante = y comparación de igualdad mediante =="
        ),
        true
    );
    assert.equal(
        comparisonLesson.includes(
            "reconocer una instrucción de programa"
        ),
        true
    );
    assert.equal(
        last.includes(
            "construir una primera solución completa sin recibir de antemano las estructuras que deben utilizarse"
        ),
        true
    );
    assert.equal(last.length >= comparisonLesson.length, true);
    assert.equal(Object.isFrozen(last), true);
    assert.equal(
        new Set(
            last.map(normalizeKnowledge)
        ).size,
        last.length
    );
    assert.throws(
        () => last.push("alteración"),
        TypeError
    );
});

test("conserva la sintaxis vigente de asignación e igualdad", () => {
    const clrsExamples = brokerLearningCatalog
        .listLessons()
        .flatMap(lesson => lesson.examples)
        .filter(
            example =>
                example.language ===
                BrokerLearningExampleLanguage.CLRS
        );

    assert.equal(clrsExamples.length >= 40, true);
    assert.equal(
        clrsExamples.some(
            example => example.content.includes("<-")
        ),
        false
    );

    const comparisons = brokerLearningCatalog
            .requireLesson("lesson-021")
        .examples[1]
        .content;

    assert.match(comparisons, /edad = 18/u);
    assert.match(comparisons, /edad == 18/u);
    assert.match(
        brokerLearningCatalog
            .requireLesson("lesson-040")
            .examples[0]
            .content,
        /A = \[10, 20, 30\]/u
    );
    assert.match(
        brokerLearningCatalog
            .requireLesson("lesson-043")
            .examples[1]
            .content,
        /M = \[\[10, 20\], \[30, 40\]\]/u
    );
});

test("asigna únicamente categorías Fundamentales existentes", () => {
    for (
        const lesson of
        brokerLearningCatalog.listLessons()
    ) {
        const category = brokerCategoryCatalog
            .requireCategory(lesson.categoryId);

        assert.equal(lesson.familyId, "FND");
        assert.equal(category.familyId, "FND");
    }
});

test("utiliza recompensas explícitas, pares y progresivas", () => {
    const rewards = brokerLearningCatalog
        .listLessons()
        .map(lesson => lesson.baseReward);

    assert.deepEqual(rewards, EXPECTED_REWARDS);
    assert.equal(
        rewards.every(reward => reward % 2 === 0),
        true
    );
    assert.equal(
        rewards.every(
            (reward, index) =>
                index === 0 ||
                reward >= rewards[index - 1]
        ),
        true
    );
    assert.equal(rewards[0], 10);
    assert.equal(rewards.at(-1), 108);
});

test("conserva las notas comparativas sin convertirlas en conocimiento exigible", () => {
    const notesByLesson = new Map([
        ["lesson-006", "Otros lenguajes"],
        [
            "lesson-010",
            "Transferencia a otros lenguajes"
        ],
        [
            "lesson-011",
            "Las categorías pueden variar entre lenguajes"
        ],
        ["lesson-012", "Carácter y cadena"],
        ["lesson-024", "Una sola alternativa"],
        [
            "lesson-025",
            "Otras estructuras de selección"
        ],
        ["lesson-026", "Otras formas de repetición"],
        [
            "lesson-027",
            "Formas abreviadas en otros lenguajes"
        ],
        [
            "lesson-029",
            "La forma de para cambia entre lenguajes"
        ],
        [
            "lesson-032",
            "Función como término de esta ruta"
        ],
        [
            "lesson-034",
            "La forma puede variar entre lenguajes"
        ],
        [
            "lesson-038",
            "Las colecciones pueden adoptar distintas formas"
        ]
    ]);

    for (const [lessonId, noteTitle] of notesByLesson) {
        const lesson = brokerLearningCatalog
            .requireLesson(lessonId);

        assert.equal(
            lesson.comparativeNotes.some(
                note => note.title.includes(noteTitle)
            ),
            true,
            `${lessonId} debe conservar ${noteTitle}`
        );
    }

    const accumulated = brokerLearningCatalog
        .getAccumulatedKnowledge("lesson-050")
        .join(" ")
        .toLocaleLowerCase("es-MX");

    assert.equal(accumulated.includes("lambda"), false);
    assert.equal(accumulated.includes("do-while"), false);
    assert.equal(accumulated.includes("list<t>"), false);
});

test("no introduce como práctica los temas deliberadamente pospuestos", () => {
    const introduced = brokerLearningCatalog
        .listLessons()
        .flatMap(
            lesson => lesson.introducedKnowledge
        )
        .join(" ")
        .toLocaleLowerCase("es-MX");
    const postponed = [
        "búsqueda binaria",
        "recursión avanzada",
        "big o",
        "divide y vencerás",
        "programación dinámica",
        "algoritmos voraces",
        "criptografía"
    ];

    for (const subject of postponed) {
        assert.equal(
            introduced.includes(subject),
            false,
            `${subject} no debe introducirse en la ruta básica`
        );
    }
});

test("expone consultas tolerantes y errores estructurados para IDs desconocidos", () => {
    const catalog = new BrokerLearningCatalog(
        brokerLearningCurriculum
    );

    assert.equal(
        catalog.getSection("section-999"),
        null
    );
    assert.equal(
        catalog.getLesson("lesson-999"),
        null
    );
    assertBrokerLearningError(
        () => catalog.requireSection("section-999"),
        "BROKER95_LEARNING_SECTION_NOT_FOUND"
    );
    assertBrokerLearningError(
        () => catalog.requireLesson("lesson-999"),
        "BROKER95_LEARNING_LESSON_NOT_FOUND"
    );
    assertBrokerLearningError(
        () => catalog.getAccumulatedKnowledge(
            "lesson-999"
        ),
        "BROKER95_LEARNING_LESSON_NOT_FOUND"
    );
});

function normalizeKnowledge(value) {
    return value.normalize("NFKC")
        .toLocaleLowerCase("es-MX");
}

function assertBrokerLearningError(
    operation,
    code
) {
    assert.throws(
        operation,
        error =>
            error instanceof BrokerGameError &&
            error.code === code
    );
}
