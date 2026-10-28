import test from "node:test";
import assert from "node:assert/strict";

import {
    BROKER_LEARNING_LESSON_COUNT,
    BROKER_LEARNING_SECTION_COUNT,
    BROKER_PUBLIC_LEARNING_CATALOG_VERSION,
    BrokerHostMessageType,
    BrokerLlmStatus,
    BrokerLlmStatusReason,
    BrokerProtocolError,
    BrokerWebviewMessageType,
    acceptBrokerContract,
    addBrokerLearningContract,
    brokerAlgorithmsLearningCatalog,
    brokerLearningCatalog,
    createBrokerGameState,
    createBrokerHostMessage,
    createBrokerPublicGameState,
    createBrokerPublicLearningCatalog,
    createBrokerWebviewMessage,
    deleteBrokerContract,
    purgeBrokerContracts,
    resetBrokerGameProgress,
    settleBrokerContract,
    parseBrokerHostMessage,
    parseBrokerPublicLearningCatalog
} from "../src/broker95/index.js";
import {
    BrokerCommandController
} from "../extension/controllers/BrokerCommandController.js";
import {
    Broker95Bridge
} from "../frontend/src/broker95/Broker95Bridge.js";
import {
    Broker95ViewStore
} from "../frontend/src/broker95/Broker95ViewStore.js";

const publicConfiguration = Object.freeze({
    settings: Object.freeze({
        providerId: "groq",
        model: "modelo-prueba",
        hasApiKey: true,
        audio: Object.freeze({
            muted: false,
            volume: 45
        })
    }),
    llmStatus: Object.freeze({
        status: BrokerLlmStatus.READY,
        reason: BrokerLlmStatusReason.READY,
        message: "CIPHER está disponible."
    })
});

test("publica las 50 lecciones y deriva sus conocimientos acumulados", () => {
    const catalog =
        createBrokerPublicLearningCatalog();

    assert.equal(
        catalog.publicCatalogVersion,
        BROKER_PUBLIC_LEARNING_CATALOG_VERSION
    );
    assert.equal(
        catalog.sectionCount,
        BROKER_LEARNING_SECTION_COUNT
    );
    assert.equal(
        catalog.lessonCount,
        BROKER_LEARNING_LESSON_COUNT
    );
    assert.equal(
        catalog.sections.length,
        BROKER_LEARNING_SECTION_COUNT
    );
    assert.equal(
        catalog.lessons.length,
        BROKER_LEARNING_LESSON_COUNT
    );

    const lastLesson = catalog.lessons.at(-1);

    assert.deepEqual(
        lastLesson.accumulatedKnowledge,
        brokerLearningCatalog
            .getAccumulatedKnowledge(
                lastLesson.id
            )
    );
    assert.equal(Object.isFrozen(catalog), true);
    assert.equal(
        Object.isFrozen(lastLesson),
        true
    );
});

test("publica la vista pedagógica completa de una lección de Algoritmia", () => {
    const catalog =
        createBrokerPublicLearningCatalog(
            brokerAlgorithmsLearningCatalog
        );
    const lesson = catalog.lessons.find(
        item =>
            item.id ===
            "algorithm-lesson-026"
    );
    const parsed =
        parseBrokerPublicLearningCatalog(
            JSON.parse(JSON.stringify(catalog))
        );

    assert.match(
        lesson.problemStatement,
        /orden de crecimiento/u
    );
    assert.equal(lesson.concepts.length > 0, true);
    assert.equal(lesson.formulas.length, 4);
    assert.equal(
        lesson.recommendedTools.includes(
            "complexity-report"
        ),
        true
    );
    assert.match(
        lesson.expectedContract,
        /Implementar/u
    );
    assert.deepEqual(parsed, catalog);
});

test("revalida el catálogo al cruzar el protocolo y rechaza conocimiento adulterado", () => {
    const source = JSON.parse(JSON.stringify(
        createBrokerPublicLearningCatalog()
    ));
    const parsed =
        parseBrokerPublicLearningCatalog(
            source
        );

    assert.deepEqual(
        parsed,
        createBrokerPublicLearningCatalog()
    );

    source.lessons[0]
        .accumulatedKnowledge.push(
            "Conocimiento futuro inyectado"
        );

    assert.throws(
        () => parseBrokerPublicLearningCatalog(
            source
        ),
        TypeError
    );
});

test("el Webview sólo puede solicitar una lección por su identificador", () => {
    const valid = createBrokerWebviewMessage({
        type:
            BrokerWebviewMessageType
                .OBTAIN_LEARNING_CONTRACT,
        requestId: "learning:obtain:1",
        payload: {
            learningRouteId: "programming",
            lessonId: "lesson-001"
        }
    });

    assert.deepEqual(valid.payload, {
        learningRouteId: "programming",
        lessonId: "lesson-001"
    });
    const algorithms = createBrokerWebviewMessage({
        type:
            BrokerWebviewMessageType
                .OBTAIN_LEARNING_CONTRACT,
        requestId: "learning:obtain:algorithms",
        payload: {
            learningRouteId: "algorithms",
            lessonId: "algorithm-lesson-001"
        }
    });

    assert.deepEqual(algorithms.payload, {
        learningRouteId: "algorithms",
        lessonId: "algorithm-lesson-001"
    });
    assert.throws(
        () => createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .OBTAIN_LEARNING_CONTRACT,
            requestId: "learning:obtain:2",
            payload: {
                learningRouteId: "programming",
                lessonId: "lesson-001",
                baseReward: 999_999,
                status: "completed"
            }
        }),
        error =>
            error instanceof
                BrokerProtocolError &&
            error.code ===
                "BROKER95_PROTOCOL_PAYLOAD_INVALID"
    );
    assert.throws(
        () => createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .OBTAIN_LEARNING_CONTRACT,
            requestId: "learning:obtain:3",
            payload: {
                learningRouteId: "programming",
                lessonId: "lesson-final"
            }
        }),
        error =>
            error instanceof
                BrokerProtocolError
    );
});

test("el handshake entrega currículo y el resultado educativo queda correlacionado", () => {
    const ready = createReadyMessage();

    assert.equal(
        ready.payload.state.learning
            .catalogs.programming.lessonCount,
        50
    );
    assert.throws(
        () => createBrokerHostMessage({
            type: BrokerHostMessageType.READY,
            requestId: "learning:ready:null",
            payload: {
                sessionId: "learning:session",
                state: createBrokerGameState(),
                settings:
                    publicConfiguration.settings,
                llmStatus:
                    publicConfiguration.llmStatus,
                learningCatalog: null
            }
        }),
        error =>
            error instanceof
                BrokerProtocolError
    );

    const synchronizedState =
        createLearningContractState();
    const created = createBrokerHostMessage({
        type:
            BrokerHostMessageType
                .LEARNING_CONTRACT_CREATED,
        requestId: "learning:obtain:4",
        payload: {
            learningRouteId: "programming",
            routeTitle: "Programación",
            lessonId: "lesson-001",
            lessonOrder: 1,
            lessonTitle:
                "Código fuente y programa",
            sectionId: "section-001",
            contractId: 1,
            title: "Presenta un mensaje",
            learningAttempt: 1,
            repetition: false,
            state: synchronizedState
        }
    });

    assert.equal(
        created.requestId,
        "learning:obtain:4"
    );
    assert.equal(created.payload.contractId, 1);
    assert.equal(
        created.payload.learningRouteId,
        "programming"
    );
    assert.equal(created.payload.state.revision, 1);
    assert.throws(
        () => createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .LEARNING_CONTRACT_CREATED,
            requestId: "learning:obtain:invalid",
            payload: {
                learningRouteId: "programming",
                routeTitle: "Programación",
                lessonId: "lesson-001",
                lessonOrder: 1,
                lessonTitle:
                    "Código fuente y programa",
                sectionId: "section-001",
                contractId: 1,
                title: "Presenta un mensaje",
                learningAttempt: 1,
                repetition: false,
                state: createBrokerGameState()
            }
        }),
        error =>
            error instanceof BrokerProtocolError &&
            error.code ===
                "BROKER95_PROTOCOL_PAYLOAD_INVALID"
    );
});

test("bridge y store transportan la solicitud y la notificación sin asumir autoridad", () => {
    const outgoing = [];
    const bridge = new Broker95Bridge({
        eventTarget: null,
        acquireVsCodeApi() {
            return {
                postMessage(message) {
                    outgoing.push(message);
                }
            };
        },
        createClientId() {
            return "learning-client";
        },
        logger: silentLogger()
    });

    assert.equal(
        bridge.obtainLearningContract(
            "lesson-001"
        ),
        "broker95-webview:learning-client:1"
    );
    assert.deepEqual(outgoing[0].payload, {
        learningRouteId: "programming",
        lessonId: "lesson-001"
    });
    bridge.obtainLearningContract(
        "algorithm-lesson-001",
        "algorithms"
    );
    assert.deepEqual(outgoing[1].payload, {
        learningRouteId: "algorithms",
        lessonId: "algorithm-lesson-001"
    });

    const store = new Broker95ViewStore();
    const synchronizedState =
        createLearningContractState();
    const notice = createBrokerHostMessage({
        type:
            BrokerHostMessageType
                .LEARNING_CONTRACT_CREATED,
        requestId: "learning:obtain:5",
        payload: {
            learningRouteId: "programming",
            routeTitle: "Programación",
            lessonId: "lesson-001",
            lessonOrder: 1,
            lessonTitle:
                "Código fuente y programa",
            sectionId: "section-001",
            contractId: 1,
            title: "Presenta un mensaje",
            learningAttempt: 1,
            repetition: false,
            state: synchronizedState
        }
    });

    store.applyHostMessage(
        createReadyMessage()
    );
    store.applyHostMessage(notice);

    assert.equal(
        store.getState().gameState.learning
            .catalogs.programming.lessonCount,
        50
    );
    assert.deepEqual(
        store.getState()
            .learningContractNotice,
        {
            requestId:
                "learning:obtain:5",
            learningRouteId: "programming",
            routeTitle: "Programación",
            lessonId: "lesson-001",
            lessonOrder: 1,
            lessonTitle:
                "Código fuente y programa",
            sectionId: "section-001",
            contractId: 1,
            title: "Presenta un mensaje",
            learningAttempt: 1,
            repetition: false
        }
    );
    assert.equal(
        store.getState().gameState
            .contracts.length,
        1
    );
    assert.equal(
        store.getState().gameState
            .learning.progress.programming
            .lessons[0]
            .activeContractId,
        1
    );
    assert.equal(
        store.dismissLearningContractNotice(),
        true
    );
    assert.equal(
        store.getState().learningContractNotice,
        null
    );
    assert.equal(
        store.dismissLearningContractNotice(),
        false
    );
    store.applyHostMessage(notice);

    const deleted = deleteBrokerContract(
        synchronizedState,
        1
    );

    store.applyHostMessage(
        createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .STATE_UPDATED,
            payload: {
                state: deleted,
                reason: "contract/deleted"
            }
        })
    );
    assert.equal(
        store.getState().learningContractNotice,
        null
    );
    assert.equal(
        store.getState().gameState.contracts[0]
            .state,
        "deleted"
    );
    assert.equal(
        store.getState().gameState
            .learning.progress.programming
            .lessons[0]
            .activeContractId,
        null
    );

    store.applyHostMessage(notice);
    assert.equal(
        store.getState().learningContractNotice,
        null
    );
    assert.equal(
        store.getState().gameState.revision,
        deleted.revision
    );
});

test("push, purge y reset sincronizan inmediatamente mapa y detalle sin aceptar revisiones obsoletas", () => {
    const store = new Broker95ViewStore();
    let state = createLearningContractState();

    store.applyHostMessage(createReadyMessage());
    store.applyHostMessage(
        createLearningContractCreatedMessage(
            state,
            "learning:sync:created"
        )
    );
    store.setActivePanel("learning");
    assert.equal(
        store.openLearningRoute("programming"),
        true
    );
    assert.equal(
        store.openLearningLesson("lesson-001"),
        true
    );

    state = acceptBrokerContract(
        state,
        1,
        { acceptedAt: "accepted" }
    );
    state = settleBrokerContract(state, {
        dimensionScores: {
            functionality: 80
        },
        submittedAt: "completed"
    });
    store.applyHostMessage(
        createStateUpdatedMessage(
            state,
            "learning/push-completed"
        )
    );

    let synchronized = store.getState();

    assert.equal(
        synchronized.learningNavigation.screen,
        "lesson"
    );
    assert.equal(
        synchronized.gameState.learning
            .progress.programming.lessons[0]
            .completed,
        true
    );
    assert.equal(
        synchronized.gameState.learning
            .progress.programming.lessons[1]
            .status,
        "available"
    );
    assert.equal(
        synchronized.learningContractNotice,
        null
    );

    const completedState = state;

    state = addBrokerLearningContract(
        state,
        "lesson-001",
        {
            title: "Repite el mensaje",
            description:
                "Reforzar la primera lección.",
            requirements: [
                "Mostrar el mensaje solicitado."
            ],
            testCases: []
        },
        { createdAt: "repetition" }
    );
    store.applyHostMessage(
        createStateUpdatedMessage(
            state,
            "learning/repetition-created"
        )
    );
    assert.equal(
        store.getState().gameState.learning
            .progress.programming.lessons[0]
            .activeContractId,
        2
    );

    state = purgeBrokerContracts(state);
    store.applyHostMessage(
        createStateUpdatedMessage(
            state,
            "contracts/purged"
        )
    );
    assert.equal(
        store.getState().gameState.learning
            .progress.programming.lessons[0]
            .activeContractId,
        null
    );

    state = resetBrokerGameProgress(state);
    store.applyHostMessage(
        createStateUpdatedMessage(
            state,
            "game/reset"
        )
    );
    synchronized = store.getState();
    assert.equal(
        synchronized.gameState.learning
            .progress.programming
            .completedLessons,
        0
    );
    assert.equal(
        synchronized.gameState.learning
            .progress.programming.lessons[0]
            .status,
        "available"
    );
    assert.equal(
        synchronized.learningNavigation.screen,
        "lesson"
    );

    const resetRevision =
        synchronized.gameState.revision;

    store.applyHostMessage(
        createStateUpdatedMessage(
            completedState,
            "game/stale"
        )
    );
    assert.equal(
        store.getState().gameState.revision,
        resetRevision
    );
    assert.equal(
        store.getState().gameState.learning
            .progress.programming
            .completedLessons,
        0
    );
});

test("el controlador delega la generación al Host y publica su resultado", async () => {
    const panel = createPanel();
    const calls = [];
    let state = createBrokerGameState();
    const controller =
        new BrokerCommandController({
            host: {
                createPanel() {
                    return panel;
                }
            },
            presenter: {
                present() {}
            },
            gameSession: {
                getState() {
                    return state;
                },
                subscribe() {
                    return disposable();
                }
            },
            configuration: {
                getSnapshot() {
                    return publicConfiguration;
                },
                subscribe() {
                    return disposable();
                }
            },
            learningContractService: {
                async obtain(options) {
                    calls.push(options);

                    state =
                        createLearningContractState();

                    return Object.freeze({
                        contract:
                            state.contracts[0],
                        lesson: Object.freeze({
                            learningRouteId:
                                "programming",
                            routeTitle:
                                "Programación",
                            lessonId:
                                "lesson-001",
                            lessonOrder: 1,
                            lessonTitle:
                                "Código fuente y programa",
                            sectionId:
                                "section-001"
                        }),
                        stateRevision: 1
                    });
                }
            },
            async initialize() {},
            createSessionId() {
                return "learning-session";
            },
            developerLogger: silentLogger()
        });

    controller.open({});
    const result = await controller
        .handleMessage(
            createBrokerWebviewMessage({
                type:
                    BrokerWebviewMessageType
                        .OBTAIN_LEARNING_CONTRACT,
                requestId:
                    "learning:controller:1",
                payload: {
                    learningRouteId:
                        "programming",
                    lessonId: "lesson-001"
                }
            })
        );

    assert.equal(result.ok, true);
    assert.deepEqual(calls, [{
        learningRouteId: "programming",
        lessonId: "lesson-001",
        requestId: "learning:controller:1"
    }]);
    assert.deepEqual(
        panel.messages.map(message =>
            message.type
        ),
        [
            BrokerHostMessageType
                .OPERATION_STATUS,
            BrokerHostMessageType
                .LEARNING_CONTRACT_CREATED,
            BrokerHostMessageType
                .TERMINAL_APPEND,
            BrokerHostMessageType
                .OPERATION_STATUS
        ]
    );
    assert.equal(
        panel.messages[1].requestId,
        "learning:controller:1"
    );
    assert.equal(
        panel.messages[1].payload
            .contractId,
        1
    );
    assert.equal(
        panel.messages[1].payload.state
            .learning.progress.programming
            .lessons[0]
            .activeContractId,
        1
    );
    assert.match(
        panel.messages[2].payload
            .entries[0].text,
        /ai -set 1/u
    );

    controller.dispose();
});

test("public learning projects both routes without singular write authority", () => {
    const state = createBrokerPublicGameState(
        createBrokerGameState()
    );

    assert.equal(
        Object.hasOwn(state, "learningRoute"),
        false
    );
    assert.deepEqual(
        state.learning.routes.map(route => ({
            routeId: route.routeId,
            status: route.status,
            completedLessons:
                route.completedLessons,
            totalLessons: route.totalLessons
        })),
        [
            {
                routeId: "programming",
                status: "available",
                completedLessons: 0,
                totalLessons: 50
            },
            {
                routeId: "algorithms",
                status: "locked",
                completedLessons: 0,
                totalLessons: 0
            }
        ]
    );
    assert.deepEqual(
        Object.keys(state.learning.catalogs),
        ["programming"]
    );
    assert.deepEqual(
        Object.keys(state.learning.progress),
        ["programming"]
    );
    assert.equal(
        Object.isFrozen(state.learning),
        true
    );

    const tampered = JSON.parse(
        JSON.stringify(state)
    );
    tampered.learning.routes[0]
        .completedLessons = 50;

    assert.throws(
        () => createBrokerPublicGameState(
            tampered
        ),
        /Invalid BROKER\.95 public learning projection/u
    );
});

test("the serialized protocol rehydrates every cataloged route", () => {
    const algorithms = createAlgorithmsCatalog();
    const catalogs = {
        programming: brokerLearningCatalog,
        algorithms
    };
    const message = createBrokerHostMessage({
        type: BrokerHostMessageType.READY,
        requestId: "learning:ready:multi-route",
        payload: {
            sessionId: "learning:multi-route",
            state: createBrokerGameState(
                {},
                { catalogs }
            ),
            settings:
                publicConfiguration.settings,
            llmStatus:
                publicConfiguration.llmStatus
        }
    }, { catalogs });
    const parsed = parseBrokerHostMessage(
        JSON.parse(JSON.stringify(message))
    );

    assert.equal(
        parsed.payload.state.learning
            .catalogs.algorithms.lessonCount,
        1
    );
    assert.equal(
        parsed.payload.state.learning
            .progress.algorithms
            .lessons[0].lessonId,
        "algorithm-lesson-001"
    );
    assert.equal(
        parsed.payload.state.learning
            .routes[1].status,
        "locked"
    );
});

function createAlgorithmsCatalog() {
    const lesson = Object.freeze({
        id: "algorithm-lesson-001",
        sectionId: "algorithm-section-001",
        order: 1,
        title: "Primer algoritmo",
        objective: "Comprender un algoritmo.",
        explanation: Object.freeze([Object.freeze({
            kind: "paragraph",
            text: "Una secuencia finita de pasos."
        })]),
        examples: Object.freeze([Object.freeze({
            title: "Secuencia",
            language: "clrs",
            content: "PRINCIPAL()\n    escribir 1",
            explanation: null
        })]),
        introducedKnowledge: Object.freeze([
            "Secuencias algorÃ­tmicas"
        ]),
        comparativeNotes: Object.freeze([]),
        familyId: "FND",
        categoryId: "FND-001",
        baseReward: 10
    });
    const section = Object.freeze({
        id: "algorithm-section-001",
        order: 1,
        title: "IntroducciÃ³n",
        description: "Primeros algoritmos.",
        lessonIds: Object.freeze([
            lesson.id
        ])
    });

    return Object.freeze({
        sectionCount: 1,
        lessonCount: 1,
        listSections() {
            return Object.freeze([section]);
        },
        listLessons() {
            return Object.freeze([lesson]);
        },
        requireLesson(lessonId) {
            if (lessonId !== lesson.id) {
                throw new TypeError("unknown lesson");
            }
            return lesson;
        },
        getAccumulatedKnowledge(lessonId) {
            this.requireLesson(lessonId);
            return lesson.introducedKnowledge;
        }
    });
}

function createReadyMessage() {
    return createBrokerHostMessage({
        type: BrokerHostMessageType.READY,
        requestId: "learning:ready",
        payload: {
            sessionId: "learning:session",
            state: createBrokerGameState(),
            settings:
                publicConfiguration.settings,
            llmStatus:
                publicConfiguration.llmStatus
        }
    });
}

function createLearningContractCreatedMessage(
    state,
    requestId
) {
    return createBrokerHostMessage({
        type:
            BrokerHostMessageType
                .LEARNING_CONTRACT_CREATED,
        requestId,
        payload: {
            learningRouteId: "programming",
            routeTitle: "Programación",
            lessonId: "lesson-001",
            lessonOrder: 1,
            lessonTitle:
                "Código fuente y programa",
            sectionId: "section-001",
            contractId: 1,
            title: "Presenta un mensaje",
            learningAttempt: 1,
            repetition: false,
            state
        }
    });
}

function createStateUpdatedMessage(state, reason) {
    return createBrokerHostMessage({
        type:
            BrokerHostMessageType.STATE_UPDATED,
        payload: { state, reason }
    });
}

function createLearningContractState() {
    return addBrokerLearningContract(
        createBrokerGameState(),
        "lesson-001",
        {
            title: "Presenta un mensaje",
            description:
                "Mostrar un mensaje sencillo.",
            requirements: [
                "Mostrar el mensaje solicitado."
            ],
            testCases: []
        },
        { createdAt: "created" }
    );
}

function createPanel() {
    return {
        messages: [],
        async postMessage(message) {
            this.messages.push(message);
            return true;
        },
        onMessage() {
            return disposable();
        },
        onDispose() {
            return disposable();
        },
        reveal() {},
        dispose() {}
    };
}

function disposable() {
    return Object.freeze({
        dispose() {}
    });
}

function silentLogger() {
    return Object.freeze({
        error() {}
    });
}
