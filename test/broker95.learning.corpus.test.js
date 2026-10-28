import assert from "node:assert/strict";
import {
    readFileSync
} from "node:fs";
import test from "node:test";

import {
    BrokerLearningRouteId,
    BrokerWebviewMessageType,
    brokerAlgorithmsLearningCatalog,
    brokerLearningCatalog,
    brokerLearningRouteCatalogs,
    createBrokerGameState,
    createBrokerLearningCurricularContext,
    createBrokerLearningProgress,
    createBrokerPublicGameState,
    createBrokerWebviewMessage,
    createInitialBrokerLearningRoutesProgress,
    getBrokerLearningAllowedKnowledge,
    getBrokerLearningRouteProgress,
    isBrokerLearningRouteAvailable,
    linkBrokerLearningRouteContract,
    replaceBrokerLearningRouteProgress
} from "../src/broker95/index.js";
import {
    createBroker95LearningRouteModel
} from "../frontend/src/broker95/panels/Broker95LearningRoute.js";
import {
    createBroker95LearningRouteSelectorModel
} from "../frontend/src/broker95/panels/Broker95LearningRouteSelector.js";

const corpus = JSON.parse(
    readFileSync(
        new URL(
            "./fixtures/broker95-learning-corpus.v1.json",
            import.meta.url
        ),
        "utf8"
    )
);

const CATALOGS = Object.freeze({
    [BrokerLearningRouteId.PROGRAMMING]:
        brokerLearningCatalog,
    [BrokerLearningRouteId.ALGORITHMS]:
        brokerAlgorithmsLearningCatalog
});

test("el corpus multirruta es versionado, completo y trazable", () => {
    assert.equal(corpus.schemaVersion, 1);
    assert.equal(
        corpus.suite,
        "BROKER.95 multiroute learning acceptance corpus"
    );
    assert.deepEqual(
        corpus.requiredAreas,
        [
            "catalog",
            "persistence",
            "progression",
            "curriculum",
            "contracts",
            "submission",
            "lifecycle",
            "protocol",
            "webview",
            "regression"
        ]
    );
    assert.deepEqual(corpus.policies, {
        legacyPersistence:
            "reject-without-migration",
        routeMap: "vertical-responsive",
        algorithmsUnlock:
            "programming-completed",
        learningCriteria: ["functionality"],
        tools: "optional-only"
    });

    const ids = corpus.cases.map(item => item.id);
    const coveredAreas = new Set(
        corpus.cases.map(item => item.area)
    );

    assert.equal(
        new Set(ids).size,
        ids.length,
        "El corpus no admite identificadores duplicados."
    );
    assert.equal(corpus.cases.length >= 20, true);
    assert.deepEqual(
        [...coveredAreas].sort(),
        [...corpus.requiredAreas].sort()
    );

    const packageJson = JSON.parse(
        readFileSync(
            new URL("../package.json", import.meta.url),
            "utf8"
        )
    );
    const learningScript =
        packageJson.scripts["test:broker95:learning"];

    for (const item of corpus.cases) {
        assert.equal(
            corpus.requiredAreas.includes(item.area),
            true,
            item.id
        );
        assert.equal(
            typeof item.requirement === "string" &&
                item.requirement.length > 20,
            true,
            item.id
        );
        assert.equal(
            Array.isArray(item.evidence) &&
                item.evidence.length > 0,
            true,
            item.id
        );

        for (const evidence of item.evidence) {
            const source = readFileSync(
                new URL(
                    `../${evidence.file}`,
                    import.meta.url
                ),
                "utf8"
            );
            const fileName = evidence.file
                .split("/")
                .at(-1);

            assert.equal(
                source.includes(evidence.testNeedle),
                true,
                `${item.id}:${evidence.testNeedle}`
            );
            assert.equal(
                learningScript.includes(fileName),
                true,
                `${item.id}:${fileName}`
            );
        }
    }
});

test("protege los catálogos completos, sus identificadores y el modelo compartido", () => {
    const allIds = [];

    for (const expected of corpus.routes) {
        const catalog = CATALOGS[expected.routeId];
        const sections = catalog.listSections();
        const lessons = catalog.listLessons();

        assert.ok(catalog, expected.routeId);
        assert.equal(
            catalog.sectionCount,
            expected.sectionCount,
            expected.routeId
        );
        assert.equal(
            catalog.lessonCount,
            expected.lessonCount,
            expected.routeId
        );
        assert.equal(
            lessons.at(0).id,
            expected.firstLessonId,
            expected.routeId
        );
        assert.equal(
            lessons.at(-1).id,
            expected.lastLessonId,
            expected.routeId
        );

        allIds.push(
            ...sections.map(section => section.id),
            ...lessons.map(lesson => lesson.id)
        );

        for (const lesson of lessons) {
            assert.deepEqual(
                Object.keys(lesson),
                corpus.sharedLessonFields,
                lesson.id
            );
            assert.equal(
                typeof lesson.expectedContract ===
                    "string" &&
                    lesson.expectedContract.length > 20,
                true,
                lesson.id
            );
            assert.equal(
                lesson.explanation.length > 0,
                true,
                lesson.id
            );
            assert.equal(
                lesson.examples.length > 0,
                true,
                lesson.id
            );
            assert.equal(
                lesson.introducedKnowledge.length > 0,
                true,
                lesson.id
            );
        }

        assertMonotonicKnowledge(catalog);
    }

    assert.equal(
        new Set(allIds).size,
        allIds.length,
        "Las rutas no deben compartir identificadores."
    );
});

test("recorre bloqueo, no salto y desbloqueo secuencial entre rutas", () => {
    const initial =
        createInitialBrokerLearningRoutesProgress({
            catalogs: CATALOGS
        });

    assert.deepEqual(
        initial.availableRouteIds,
        [BrokerLearningRouteId.PROGRAMMING]
    );
    assert.equal(
        isBrokerLearningRouteAvailable(
            initial,
            BrokerLearningRouteId.ALGORITHMS,
            { catalogs: CATALOGS }
        ),
        false
    );
    assert.throws(
        () => linkBrokerLearningRouteContract(
            initial,
            {
                routeId:
                    BrokerLearningRouteId.ALGORITHMS,
                sectionId: "algorithm-section-001",
                lessonId: "algorithm-lesson-001",
                contractId: 1,
                createdAt: "locked-route"
            },
            { catalogs: CATALOGS }
        ),
        error => error?.code ===
            "BROKER95_LEARNING_ROUTE_LOCKED"
    );
    assert.throws(
        () => linkBrokerLearningRouteContract(
            initial,
            {
                routeId:
                    BrokerLearningRouteId.PROGRAMMING,
                sectionId: "section-001",
                lessonId: "lesson-002",
                contractId: 2,
                createdAt: "skipped-lesson"
            },
            { catalogs: CATALOGS }
        ),
        error => error?.code ===
            "BROKER95_LEARNING_LESSON_LOCKED"
    );

    const unlocked =
        replaceBrokerLearningRouteProgress(
            initial,
            BrokerLearningRouteId.PROGRAMMING,
            completedProgrammingProgress(),
            { catalogs: CATALOGS }
        );
    const algorithms =
        getBrokerLearningRouteProgress(
            unlocked,
            BrokerLearningRouteId.ALGORITHMS,
            { catalogs: CATALOGS }
        );

    assert.deepEqual(
        unlocked.availableRouteIds,
        [
            BrokerLearningRouteId.PROGRAMMING,
            BrokerLearningRouteId.ALGORITHMS
        ]
    );
    assert.equal(
        algorithms.currentLessonId,
        "algorithm-lesson-001"
    );
    assert.deepEqual(
        algorithms.completedLessonIds,
        []
    );
});

test("construye una frontera curricular acumulativa y equivalente para CIPHER", () => {
    const programmingLesson =
        brokerLearningCatalog.requireLesson(
            "lesson-001"
        );
    const programmingContext =
        createBrokerLearningCurricularContext(
            {
                learningRouteId:
                    BrokerLearningRouteId.PROGRAMMING,
                lessonId: programmingLesson.id
            },
            { catalogs: CATALOGS }
        );
    const algorithmsLesson =
        brokerAlgorithmsLearningCatalog
            .requireLesson(
                "algorithm-lesson-001"
            );
    const algorithmsContext =
        createBrokerLearningCurricularContext(
            {
                learningRouteId:
                    BrokerLearningRouteId.ALGORITHMS,
                lessonId: algorithmsLesson.id
            },
            { catalogs: CATALOGS }
        );
    const programmingKnowledge =
        brokerLearningCatalog
            .getAccumulatedKnowledge(
                "lesson-050"
            );
    const allowed =
        getBrokerLearningAllowedKnowledge(
            algorithmsContext
        );

    assert.equal(
        programmingContext.lesson
            .expectedPractice,
        programmingLesson.expectedContract
    );
    assert.deepEqual(
        programmingContext.prerequisiteKnowledge,
        []
    );
    assert.deepEqual(
        algorithmsContext.prerequisiteKnowledge,
        [{
            learningRouteId:
                BrokerLearningRouteId.PROGRAMMING,
            knowledge: programmingKnowledge
        }]
    );
    assert.deepEqual(
        algorithmsContext
            .accumulatedRouteKnowledge,
        brokerAlgorithmsLearningCatalog
            .getAccumulatedKnowledge(
                algorithmsLesson.id
            )
    );
    assert.ok(
        programmingKnowledge.every(item =>
            allowed.includes(item)
        )
    );
    assert.ok(
        algorithmsLesson.introducedKnowledge
            .every(item => allowed.includes(item))
    );
    assert.deepEqual(
        algorithmsContext.optionalTools.map(
            tool => tool.id
        ),
        algorithmsLesson.recommendedTools
    );
    assert.equal(
        algorithmsContext.toolPolicy
            .evaluationImpact,
        "none"
    );
});

test("mantiene protocolo, selector accesible y un solo mapa vertical para ambas rutas", () => {
    const state = createBrokerGameState(
        {},
        { catalogs: CATALOGS }
    );
    const publicState = createBrokerPublicGameState(
        state,
        { catalogs: CATALOGS }
    );
    const selector =
        createBroker95LearningRouteSelectorModel(
            publicState.learning
        );
    const algorithmsRoute = selector.routes.find(
        route =>
            route.routeId ===
            BrokerLearningRouteId.ALGORITHMS
    );

    assert.equal(selector.totalRoutes, 2);
    assert.equal(algorithmsRoute.canOpen, false);
    assert.equal(
        algorithmsRoute.accessibleLabel.includes(
            "Completa Programación para desbloquear"
        ),
        true
    );

    for (const expected of corpus.routes) {
        const routeId = expected.routeId;
        const model = createBroker95LearningRouteModel(
            publicState.learning.catalogs[routeId],
            publicState.learning.progress[routeId]
        );
        const nodes = model.sections.flatMap(
            section => section.lessons
        );

        assert.equal(
            model.totalLessons,
            expected.lessonCount,
            routeId
        );
        assert.equal(nodes[0].side, "left", routeId);
        assert.equal(nodes[1].side, "right", routeId);
    }

    for (const expected of corpus.routes) {
        const message = createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .OBTAIN_LEARNING_CONTRACT,
            requestId:
                `corpus:${expected.routeId}`,
            payload: {
                learningRouteId:
                    expected.routeId,
                lessonId:
                    expected.firstLessonId
            }
        });

        assert.deepEqual(message.payload, {
            learningRouteId: expected.routeId,
            lessonId: expected.firstLessonId
        });
    }
});

function assertMonotonicKnowledge(catalog) {
    let previous = [];

    for (const lesson of catalog.listLessons()) {
        const accumulated =
            catalog.getAccumulatedKnowledge(
                lesson.id
            );

        assert.ok(
            previous.every(item =>
                accumulated.includes(item)
            ),
            lesson.id
        );
        assert.ok(
            lesson.introducedKnowledge.every(
                item => accumulated.includes(item)
            ),
            lesson.id
        );
        previous = accumulated;
    }
}

function completedProgrammingProgress() {
    const lessons =
        brokerLearningCatalog.listLessons();

    return createBrokerLearningProgress(
        {
            revision: lessons.length,
            completedLessonIds:
                lessons.map(lesson => lesson.id),
            lessonAttempts: Object.fromEntries(
                lessons.map(lesson => [
                    lesson.id,
                    {
                        lessonId: lesson.id,
                        attempts: 1,
                        firstCompletionScore: 100,
                        bestScore: 100,
                        completedAt:
                            `corpus:${lesson.id}`
                    }
                ])
            ),
            learningStartedAt:
                "corpus:programming:start",
            learningCompletedAt:
                "corpus:programming:complete"
        },
        { catalog: brokerLearningCatalog }
    );
}

assert.deepEqual(
    brokerLearningRouteCatalogs,
    CATALOGS,
    "El corpus debe usar los catálogos canónicos exportados."
);
