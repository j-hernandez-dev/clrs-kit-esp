import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER_LEARNING_FAMILY_ID,
    BrokerGameError,
    BrokerLearningContentBlockKind,
    BrokerLearningExampleLanguage,
    BrokerLearningToolId,
    createBrokerLearningContentBlock,
    createBrokerLearningCurriculum,
    createBrokerLearningExample,
    createBrokerLearningFormula,
    createBrokerLearningFormulas,
    createBrokerLearningLesson,
    createBrokerLearningSection,
    createBrokerLearningTextList
} from "../src/broker95/index.js";

test("modela fórmulas LaTeX curriculares como datos inmutables", () => {
    const formula = createBrokerLearningFormula({
        id: "cost-linear",
        title: "Costo lineal",
        latex: String.raw`T(n) \in \Theta(n)`,
        description:
            "El costo crece proporcionalmente con n."
    });

    assert.equal(
        formula.latex,
        String.raw`T(n) \in \Theta(n)`
    );
    assert.equal(Object.isFrozen(formula), true);
    assert.throws(
        () => createBrokerLearningFormulas([
            formula,
            formula
        ]),
        error =>
            error instanceof BrokerGameError &&
            error.code ===
                "BROKER95_LEARNING_FORMULA_IDS_DUPLICATED"
    );
});

test("modela contenido curricular estructurado e inmutable", () => {
    const paragraph =
        createBrokerLearningContentBlock({
            kind:
                BrokerLearningContentBlockKind
                    .PARAGRAPH,
            text:
                "Una variable conserva un valor para poder utilizarlo después."
        });
    const list = createBrokerLearningContentBlock({
        kind:
            BrokerLearningContentBlockKind.LIST,
        items: [
            "Elegir un identificador",
            "Asignar un valor"
        ]
    });
    const callout =
        createBrokerLearningContentBlock({
            kind:
                BrokerLearningContentBlockKind
                    .CALLOUT,
            title: "Transferencia",
            text:
                "Otros lenguajes pueden exigir una declaración explícita."
        });

    assert.equal(Object.isFrozen(paragraph), true);
    assert.equal(Object.isFrozen(list.items), true);
    assert.equal(callout.title, "Transferencia");
    assert.throws(
        () => list.items.push("Modificarla"),
        TypeError
    );
});

test("acepta ejemplos CLRS con asignación = y comparación ==", () => {
    const example = createBrokerLearningExample({
        id: "example-001",
        title: "Asignar y comparar",
        language:
            BrokerLearningExampleLanguage.CLRS,
        content: [
            "x = 10",
            "si x == 10",
            "    escribir x"
        ].join("\n"),
        explanation:
            "El primer signo asigna y el doble signo compara."
    });

    assert.equal(
        example.content,
        "x = 10\nsi x == 10\n    escribir x"
    );
    assert.equal(Object.isFrozen(example), true);
});

test("rechaza la asignación histórica y envolturas Markdown en ejemplos CLRS", () => {
    assertLearningError(
        () => createBrokerLearningExample({
            id: "example-001",
            language:
                BrokerLearningExampleLanguage.CLRS,
            content: "x <- 10"
        }),
        "BROKER95_LEARNING_EXAMPLE_CLRS_SYNTAX_INVALID"
    );
    assertLearningError(
        () => createBrokerLearningExample({
            id: "example-001",
            language:
                BrokerLearningExampleLanguage.CLRS,
            content: "```clrs\nx = 10\n```"
        }),
        "BROKER95_LEARNING_EXAMPLE_CLRS_SYNTAX_INVALID"
    );
});

test("crea secciones y lecciones tipadas sobre categorías FND", () => {
    const section = createBrokerLearningSection(
        sectionSource()
    );
    const lesson = createBrokerLearningLesson(
        lessonSource()
    );

    assert.equal(section.id, "section-001");
    assert.equal(lesson.id, "lesson-001");
    assert.equal(
        lesson.familyId,
        BROKER_LEARNING_FAMILY_ID
    );
    assert.equal(lesson.categoryId, "FND-OPERAT");
    assert.deepEqual(lesson.comparativeNotes, []);
    assert.equal(Object.isFrozen(section), true);
    assert.equal(Object.isFrozen(section.lessonIds), true);
    assert.equal(Object.isFrozen(lesson), true);
    assert.equal(
        Object.isFrozen(lesson.explanation),
        true
    );
    assert.equal(
        Object.isFrozen(
            lesson.introducedKnowledge
        ),
        true
    );
});

test("rechaza familias y categorías ajenas a Fundamentales", () => {
    assertLearningError(
        () => createBrokerLearningLesson(
            lessonSource({
                familyId: "MATH"
            })
        ),
        "BROKER95_LEARNING_LESSON_FAMILY_INVALID"
    );
    assertLearningError(
        () => createBrokerLearningLesson(
            lessonSource({
                categoryId: "MATH-NUMTH"
            })
        ),
        "BROKER95_LEARNING_LESSON_CATEGORY_INVALID"
    );
});

test("normaliza listas pedagógicas y evita conocimientos duplicados", () => {
    const values = createBrokerLearningTextList([
        "  asignar   un valor  ",
        "mostrar una variable"
    ]);

    assert.deepEqual(values, [
        "asignar un valor",
        "mostrar una variable"
    ]);
    assertLearningError(
        () => createBrokerLearningTextList([
            "Asignar un valor",
            "asignar un valor"
        ]),
        "BROKER95_LEARNING_TEXT_LIST_INVALID"
    );
});

test("valida globalmente órdenes y enlaces del currículo", () => {
    const curriculum =
        createBrokerLearningCurriculum({
            sections: [sectionSource()],
            lessons: [lessonSource()]
        });

    assert.deepEqual(
        curriculum.sections[0].lessonIds,
        ["lesson-001"]
    );
    assert.equal(
        curriculum.lessons[0].sectionId,
        "section-001"
    );
    assert.equal(Object.isFrozen(curriculum), true);
    assert.equal(
        Object.isFrozen(curriculum.sections),
        true
    );
    assert.equal(
        Object.isFrozen(curriculum.lessons),
        true
    );

    assertLearningError(
        () => createBrokerLearningCurriculum({
            sections: [
                sectionSource({
                    lessonIds: ["lesson-002"]
                })
            ],
            lessons: [lessonSource()]
        }),
        "BROKER95_LEARNING_CURRICULUM_LINKS_INVALID"
    );
});

test("exige órdenes curriculares únicos y continuos", () => {
    assertLearningError(
        () => createBrokerLearningCurriculum({
            sections: [
                sectionSource({
                    lessonIds: [
                        "lesson-001",
                        "lesson-003"
                    ]
                })
            ],
            lessons: [
                lessonSource(),
                lessonSource({
                    id: "lesson-003",
                    order: 3,
                    examples: [
                        exampleSource({
                            id: "example-003"
                        })
                    ]
                })
            ]
        }),
        "BROKER95_LEARNING_LESSON_ORDER_SEQUENCE_INVALID"
    );
});

test("mantiene consistentes los sufijos de IDs y los órdenes", () => {
    assertLearningError(
        () => createBrokerLearningSection(
            sectionSource({ order: 2 })
        ),
        "BROKER95_LEARNING_SECTION_ID_ORDER_MISMATCH"
    );
    assertLearningError(
        () => createBrokerLearningLesson(
            lessonSource({ order: 2 })
        ),
        "BROKER95_LEARNING_LESSON_ID_ORDER_MISMATCH"
    );
});

test("rechaza campos curriculares desconocidos", () => {
    assertLearningError(
        () => createBrokerLearningLesson({
            ...lessonSource(),
            accumulatedKnowledge: [
                "duplicación manual no permitida"
            ]
        }),
        "BROKER95_LEARNING_LESSON_FIELDS_INVALID"
    );
});

test("modela la practica esperada y herramientas opcionales", () => {
    const lesson = createBrokerLearningLesson(
        lessonSource({
            expectedContract:
                "Construir un programa breve que muestre un mensaje.",
            recommendedTools: [
                BrokerLearningToolId.FLOWCHART,
                BrokerLearningToolId.DEBUGGER
            ]
        })
    );

    assert.equal(
        lesson.expectedContract,
        "Construir un programa breve que muestre un mensaje."
    );
    assert.deepEqual(lesson.recommendedTools, [
        "flowchart",
        "debugger"
    ]);
    assert.equal(
        Object.isFrozen(lesson.recommendedTools),
        true
    );

    assertLearningError(
        () => createBrokerLearningLesson(
            lessonSource({
                recommendedTools: [
                    "herramienta-inventada"
                ]
            })
        ),
        "BROKER95_LEARNING_TOOLS_INVALID"
    );
});

function sectionSource(overrides = {}) {
    return {
        id: "section-001",
        order: 1,
        title:
            "Dar instrucciones a una computadora",
        description:
            "Comprender qué es un programa y cómo se ejecutan sus instrucciones.",
        lessonIds: ["lesson-001"],
        ...overrides
    };
}

function lessonSource(overrides = {}) {
    return {
        id: "lesson-001",
        sectionId: "section-001",
        order: 1,
        title: "Código fuente y programa",
        objective:
            "Distinguir entre las instrucciones escritas y el programa que las ejecuta.",
        explanation: [{
            kind:
                BrokerLearningContentBlockKind
                    .PARAGRAPH,
            text:
                "El código fuente expresa instrucciones que una computadora puede procesar."
        }],
        examples: [exampleSource()],
        introducedKnowledge: [
            "reconocer código fuente",
            "ejecutar instrucciones en orden"
        ],
        familyId: "FND",
        categoryId: "FND-OPERAT",
        baseReward: 10,
        ...overrides
    };
}

function exampleSource(overrides = {}) {
    return {
        id: "example-001",
        title: "Primera instrucción",
        language:
            BrokerLearningExampleLanguage.CLRS,
        content: "escribir \"Hola\"",
        explanation:
            "La instrucción muestra un texto.",
        ...overrides
    };
}

function assertLearningError(operation, code) {
    assert.throws(
        operation,
        error =>
            error instanceof BrokerGameError &&
            error.code === code
    );
}
