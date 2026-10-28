import assert from "node:assert/strict";
import test from "node:test";

import {
    createBrokerGameState,
    createBrokerPublicGameState,
    createBrokerPublicLearningCatalog,
    brokerAlgorithmsLearningCatalog,
    brokerLearningRouteCatalogs
} from "../src/broker95/index.js";
import {
    Broker95LearningNodeSide,
    createBroker95LearningRouteModel,
    scrollBroker95LearningTarget
} from "../frontend/src/broker95/panels/Broker95LearningRoute.js";

test("proyecta una ruta vertical completa de 8 secciones y 50 lecciones", () => {
    const catalog =
        createBrokerPublicLearningCatalog();
    const gameState = createBrokerPublicGameState(
        createBrokerGameState()
    );
    const model =
        createBroker95LearningRouteModel(
            catalog,
            gameState.learning.progress.programming
        );
    const lessons = model.sections.flatMap(
        section => section.lessons
    );

    assert.equal(model.sections.length, 8);
    assert.equal(lessons.length, 50);
    assert.equal(model.completedLessons, 0);
    assert.equal(model.totalLessons, 50);
    assert.equal(model.progressPercent, 0);
    assert.equal(
        lessons.filter(
            item =>
                item.progress.status ===
                    "available"
        ).length,
        1
    );
    assert.equal(lessons[0].current, true);
    assert.equal(
        lessons[0].side,
        Broker95LearningNodeSide.LEFT
    );
    assert.equal(
        lessons[1].side,
        Broker95LearningNodeSide.RIGHT
    );
    assert.deepEqual(
        model.sections.map(section =>
            section.lessons.length
        ),
        [4, 7, 6, 5, 8, 7, 8, 5]
    );
    assert.equal(Object.isFrozen(model), true);
    assert.equal(
        Object.isFrozen(model.sections),
        true
    );
});

test("reutiliza el mapa vertical para las 57 lecciones de Algoritmia", () => {
    const catalog =
        createBrokerPublicLearningCatalog(
            brokerAlgorithmsLearningCatalog
        );
    const gameState = createBrokerPublicGameState(
        createBrokerGameState(
            {},
            {
                catalogs:
                    brokerLearningRouteCatalogs
            }
        ),
        {
            catalogs:
                brokerLearningRouteCatalogs
        }
    );
    const model =
        createBroker95LearningRouteModel(
            catalog,
            gameState.learning.progress.algorithms
        );
    const lessons = model.sections.flatMap(
        section => section.lessons
    );

    assert.equal(model.sections.length, 8);
    assert.equal(lessons.length, 57);
    assert.equal(model.totalLessons, 57);
    assert.equal(
        model.currentLessonId,
        "algorithm-lesson-001"
    );
    assert.deepEqual(
        model.sections.map(section =>
            section.lessons.length
        ),
        [6, 6, 7, 9, 7, 5, 6, 11]
    );
    assert.equal(
        lessons[0].side,
        Broker95LearningNodeSide.LEFT
    );
    assert.equal(
        lessons[55].side,
        Broker95LearningNodeSide.RIGHT
    );
});

test("rechaza una ruta incompleta o con una disponibilidad no secuencial", () => {
    const catalog =
        createBrokerPublicLearningCatalog();
    const route = createBrokerPublicGameState(
        createBrokerGameState()
    ).learning.progress.programming;

    assert.throws(
        () => createBroker95LearningRouteModel(
            catalog,
            {
                ...route,
                lessons: route.lessons.slice(1)
            }
        ),
        /Invalid BROKER\.95 learning route projection/u
    );
    assert.throws(
        () => createBroker95LearningRouteModel(
            catalog,
            {
                ...route,
                currentLessonId: "lesson-002"
            }
        ),
        /Invalid BROKER\.95 learning route projection/u
    );
});

test("centra el nodo con desplazamiento suave y respeta movimiento reducido", () => {
    const calls = [];
    const focusCalls = [];
    const target = {
        focus(options) {
            focusCalls.push(options);
        },
        scrollIntoView(options) {
            calls.push(options);
        }
    };

    assert.equal(
        scrollBroker95LearningTarget(
            target,
            {
                reducedMotion: false,
                focus: true
            }
        ),
        true
    );
    assert.deepEqual(focusCalls, [
        { preventScroll: true }
    ]);
    assert.deepEqual(calls[0], {
        behavior: "smooth",
        block: "center",
        inline: "nearest"
    });

    scrollBroker95LearningTarget(
        target,
        { reducedMotion: true }
    );
    assert.equal(calls[1].behavior, "auto");
    assert.equal(
        scrollBroker95LearningTarget(null),
        false
    );
});
