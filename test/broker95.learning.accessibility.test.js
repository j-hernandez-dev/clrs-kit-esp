import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    createBrokerGameState,
    createBrokerPublicGameState,
    createBrokerPublicLearningCatalog
} from "../src/broker95/index.js";
import {
    createBroker95LearningLessonLabel,
    createBroker95LearningSectionLabel,
    moveBroker95LearningFocus
} from "../frontend/src/broker95/accessibility/Broker95LearningAccessibility.js";

test("describe cada nodo y seccion con su posicion, progreso y estado", () => {
    const catalog =
        createBrokerPublicLearningCatalog();
    const route = createBrokerPublicGameState(
        createBrokerGameState()
    ).learning.progress.programming;
    const lesson = catalog.lessons[0];
    const section = catalog.sections[0];
    const lessonProgress = route.lessons[0];
    const sectionProgress = route.sections[0];

    const lessonLabel =
        createBroker95LearningLessonLabel({
            lesson,
            progress: lessonProgress,
            section,
            totalLessons: catalog.lessonCount
        });
    const sectionLabel =
        createBroker95LearningSectionLabel({
            section,
            progress: sectionProgress
        });

    assert.match(lessonLabel, /Lecci.n 1 de 50/u);
    assert.match(lessonLabel, /Estado: disponible/u);
    assert.match(sectionLabel, /0 de 4 lecciones completadas/u);
    assert.match(sectionLabel, /Estado: disponible/u);
});

test("aplica foco itinerante con flechas, Inicio y Fin sin salir de la ruta abierta", () => {
    const lessons = [
        "lesson-001",
        "lesson-002",
        "lesson-003"
    ];

    assert.equal(
        moveBroker95LearningFocus(
            lessons,
            "lesson-001",
            "ArrowDown"
        ),
        "lesson-002"
    );
    assert.equal(
        moveBroker95LearningFocus(
            lessons,
            "lesson-002",
            "ArrowLeft"
        ),
        "lesson-001"
    );
    assert.equal(
        moveBroker95LearningFocus(
            lessons,
            "lesson-001",
            "ArrowUp"
        ),
        "lesson-001"
    );
    assert.equal(
        moveBroker95LearningFocus(
            lessons,
            "lesson-002",
            "Home"
        ),
        "lesson-001"
    );
    assert.equal(
        moveBroker95LearningFocus(
            lessons,
            "lesson-001",
            "End"
        ),
        "lesson-003"
    );
    assert.equal(
        moveBroker95LearningFocus(
            lessons,
            "lesson-002",
            "Enter"
        ),
        null
    );
});

test("recorre con teclado los identificadores de Algoritmia", () => {
    const lessons = [
        "algorithm-lesson-001",
        "algorithm-lesson-002",
        "algorithm-lesson-057"
    ];

    assert.equal(
        moveBroker95LearningFocus(
            lessons,
            lessons[0],
            "ArrowDown"
        ),
        lessons[1]
    );
    assert.equal(
        moveBroker95LearningFocus(
            lessons,
            lessons[1],
            "End"
        ),
        lessons[2]
    );
    assert.match(
        createBroker95LearningLessonLabel({
            lesson: {
                id: lessons[0],
                order: 1,
                title: "Problemas computacionales"
            },
            progress: {
                lessonId: lessons[0],
                status: "available"
            },
            section: {
                order: 1,
                title: "Del problema al algoritmo"
            },
            totalLessons: 57
        }),
        /Lecci.n 1 de 57/u
    );
});

test("rechaza proyecciones accesibles invalidas en vez de anunciar datos ambiguos", () => {
    assert.throws(
        () => createBroker95LearningLessonLabel({
            lesson: {
                id: "lesson-001",
                order: 1,
                title: "Inicio"
            },
            progress: {
                lessonId: "lesson-002",
                status: "available"
            },
            section: {
                order: 1,
                title: "Fundamentos"
            },
            totalLessons: 50
        }),
        /Invalid BROKER\.95 learning accessibility projection/u
    );
    assert.equal(
        moveBroker95LearningFocus(
            [],
            "lesson-001",
            "ArrowDown"
        ),
        null
    );
});

test("conserva las salvaguardas declarativas de accesibilidad y render diferido", async () => {
    const [app, css] = await Promise.all([
        readFile(
            new URL(
                "../frontend/src/broker95/Broker95App.jsx",
                import.meta.url
            ),
            "utf8"
        ),
        readFile(
            new URL(
                "../frontend/src/broker95/broker95.css",
                import.meta.url
            ),
            "utf8"
        )
    ]);

    assert.match(
        app,
        /memo\(function LearningRouteShell/u
    );
    assert.match(
        app,
        /memo\(function LearningExample/u
    );
    assert.match(app, /aria-valuetext=/u);
    assert.match(app, /broker95-learning-route-help/u);
    assert.match(css, /content-visibility:\s*auto/u);
    assert.match(
        css,
        /contain-intrinsic-size:\s*auto 680px/u
    );
    assert.match(css, /prefers-reduced-motion/u);
    assert.match(css, /forced-colors:\s*active/u);
    assert.match(css, /pointer:\s*coarse/u);
    assert.match(
        app,
        /broker95-learning-route-viewport/u
    );
    assert.doesNotMatch(
        app,
        /--broker-learning-lesson-count/u
    );
    assert.doesNotMatch(
        css,
        /orientation:\s*landscape/u
    );
    assert.doesNotMatch(
        css,
        /--broker-learning-horizontal-axis/u
    );
    assert.match(
        css,
        /@container broker-learning-route \(max-width: 700px\)/u
    );
    assert.match(
        css,
        /\.broker95-learning-route-viewport\s*\{[\s\S]*?overflow-x:\s*hidden/u
    );
    assert.match(
        css,
        /\.broker95-learning-route::before\s*\{[\s\S]*?top:\s*34px;[\s\S]*?bottom:\s*44px/u
    );
    assert.match(
        css,
        /@container broker-learning-route \(max-width: 700px\)[\s\S]*?\.broker95-learning-node-row\.right > button[\s\S]*?margin-left:\s*50px/u
    );
    assert.match(
        css,
        /container-name:\s*broker-learning-route/u
    );
    assert.match(
        css,
        /@container broker-learning-panel \(max-width: 640px\)/u
    );
});

test("adapta el contenido de la leccion al ancho real del panel", async () => {
    const css = await readFile(
        new URL(
            "../frontend/src/broker95/broker95.css",
            import.meta.url
        ),
        "utf8"
    );
    const baseGrid = css.indexOf(
        ".broker95-learning-lesson-grid {"
    );
    const responsiveGrid = css.indexOf(
        "@container broker-learning-panel (max-width: 760px)"
    );

    assert.ok(baseGrid >= 0);
    assert.ok(responsiveGrid > baseGrid);
    assert.match(
        css,
        /@container broker-learning-panel \(max-width: 760px\)[\s\S]*?\.broker95-learning-lesson-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/u
    );
    assert.match(
        css,
        /@container broker-learning-panel \(max-width: 760px\)[\s\S]*?\.broker95-learning-sidebar\s*\{[\s\S]*?position:\s*static;[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/u
    );
    assert.match(
        css,
        /@container broker-learning-panel \(max-width: 520px\)[\s\S]*?\.broker95-learning-lesson-summary dl,[\s\S]*?\.broker95-learning-sidebar\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/u
    );
});
