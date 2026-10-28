import test from "node:test";
import assert from "node:assert/strict";
import {
    readFile
} from "node:fs/promises";

import {
    BrokerCipherStreamPhase,
    BrokerHostMessageType,
    BrokerLlmStatus,
    BrokerLlmStatusReason,
    BrokerTerminalEntryKind,
    BrokerWebviewMessageType,
    acceptBrokerContract,
    addBrokerContract,
    addBrokerLearningContract,
    brokerCategoryCatalog,
    createBrokerGameState,
    createBrokerHostMessage,
    resetBrokerGameProgress,
    settleBrokerContract
} from "../src/broker95/index.js";
import {
    Broker95CipherVisualState
} from "../frontend/src/broker95/scene/Broker95CipherVisualState.js";
import {
    Broker95Bridge
} from "../frontend/src/broker95/Broker95Bridge.js";
import {
    BROKER95_MAX_VISIBLE_ENTRIES,
    Broker95ConnectionStatus,
    Broker95Panel,
    Broker95ViewStore
} from "../frontend/src/broker95/Broker95ViewStore.js";
import {
    BROKER95_PANEL_DEFINITIONS,
    createBroker95PanelBadges,
    moveBroker95Panel
} from "../frontend/src/broker95/panels/Broker95PanelNavigation.js";
import {
    Broker95LearningScreen
} from "../frontend/src/broker95/panels/Broker95LearningNavigation.js";
import {
    createBroker95LearningRouteSelectorModel,
    moveBroker95LearningRouteFocus
} from "../frontend/src/broker95/panels/Broker95LearningRouteSelector.js";
import {
    formatBroker95LearningCalloutText
} from "../frontend/src/broker95/panels/Broker95LearningCallout.js";
import {
    createBroker95AlertAccessibility,
    createBroker95AssertiveStatus,
    createBroker95PoliteStatus,
    createBroker95TabAccessibleLabel
} from "../frontend/src/broker95/accessibility/Broker95Accessibility.js";
import {
    createAlgorithmsLearningCatalogsFixture,
    createUnlockedAlgorithmsGameState
} from "./fixtures/broker95-algorithms-learning-fixture.js";

const settings = Object.freeze({
    model: "",
    hasApiKey: false,
    audio: Object.freeze({
        muted: false,
        volume: 45
    })
});
const llmStatus = Object.freeze({
    status: BrokerLlmStatus.UNCONFIGURED,
    reason:
        BrokerLlmStatusReason.MISSING_MODEL,
    message:
        "Introduce un modelo para conectar a CIPHER."
});

test("los callouts distinguen flujo vertical de acciones inline", () => {
    assert.equal(
        formatBroker95LearningCalloutText([
            "Comunicar el desarrollo",
            "→",
            "SOLUCIÓN"
        ].join("\n")),
        [
            "Comunicar el desarrollo",
            "↓",
            "SOLUCIÓN"
        ].join("\n")
    );
    assert.equal(
        formatBroker95LearningCalloutText([
            "escribir \"Hola\"",
            "→ ejecutar",
            "se muestra: Hola"
        ].join("\n")),
        [
            "escribir \"Hola\"",
            "→ ejecutar",
            "se muestra: Hola"
        ].join("\n")
    );
    assert.equal(
        formatBroker95LearningCalloutText(
            "entrada → resultado"
        ),
        "entrada → resultado"
    );
});

test("la miniatura de CIPHER se reduce sin invadir las pestañas", async () => {
    const styleSheet = await readFile(
        new URL(
            "../frontend/src/broker95/broker95.css",
            import.meta.url
        ),
        "utf8"
    );

    assert.match(
        styleSheet,
        /--broker-cipher-thumbnail-width:\s*clamp\(68px, 18vw, 92px\)/u
    );
    assert.match(
        styleSheet,
        /flex:\s*0 0 auto/u
    );
    assert.match(
        styleSheet,
        /grid-template-columns:\s*var\(--broker-cipher-thumbnail-width\)\s*minmax\(0, 1fr\)/u
    );
});

test("el expediente activo muestra los casos de prueba debajo de los requisitos", async () => {
    const [application, styleSheet] =
        await Promise.all([
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
        application,
        /<h4>Requisitos<\/h4>[\s\S]*<h4>Casos de prueba<\/h4>/u
    );
    assert.match(
        application,
        /testCase\.explanation/u
    );
    assert.match(
        application,
        /testCase\.stdin/u
    );
    assert.match(
        application,
        /testCase\.expected/u
    );
    assert.match(
        styleSheet,
        /\.broker95-test-case-grid\s*\{/u
    );
});

test("el bridge usa exclusivamente el protocolo tipado en ambas direcciones", () => {
    const target = createEventTarget();
    const outgoing = [];
    const incoming = [];
    const errors = [];
    const bridge = new Broker95Bridge({
        eventTarget: target,
        acquireVsCodeApi() {
            return {
                postMessage(message) {
                    outgoing.push(message);
                }
            };
        },
        createClientId() {
            return "test-client";
        },
        logger: silentLogger()
    });
    const disconnect = bridge.connect({
        onMessage(message) {
            incoming.push(message);
        },
        onError(error) {
            errors.push(error);
        }
    });

    assert.equal(
        outgoing[0].type,
        BrokerWebviewMessageType.READY
    );
    assert.equal(
        bridge.submitTerminal("ai -?"),
        "broker95-webview:test-client:2"
    );
    assert.equal(
        outgoing[1].payload.input,
        "ai -?"
    );
    assert.equal(
        bridge.setModel("modelo-local"),
        "broker95-webview:test-client:3"
    );
    assert.equal(
        bridge.setProvider("groq"),
        "broker95-webview:test-client:4"
    );
    assert.equal(
        outgoing[3].type,
        BrokerWebviewMessageType
            .SET_PROVIDER
    );
    assert.deepEqual(outgoing[3].payload, {
        providerId: "groq"
    });
    assert.equal(
        bridge.setAudioPreferences({
            muted: true,
            volume: 72
        }),
        "broker95-webview:test-client:5"
    );
    assert.equal(
        outgoing[4].type,
        BrokerWebviewMessageType.SET_AUDIO
    );
    assert.deepEqual(outgoing[4].payload, {
        muted: true,
        volume: 72
    });
    assert.equal(
        bridge.setApiKey("secreto-temporal"),
        "broker95-webview:test-client:6"
    );
    assert.equal(
        bridge.deleteApiKey(),
        "broker95-webview:test-client:7"
    );
    assert.equal(
        bridge.testLlmConnection(),
        "broker95-webview:test-client:8"
    );
    assert.equal(
        outgoing[7].type,
        BrokerWebviewMessageType
            .TEST_LLM_CONNECTION
    );
    assert.equal(
        bridge.purchaseCountermeasure(
            "scrub"
        ),
        "broker95-webview:test-client:9"
    );
    assert.equal(
        outgoing[8].type,
        BrokerWebviewMessageType
            .PURCHASE_COUNTERMEASURE
    );
    assert.equal(
        outgoing[8].payload
            .countermeasureId,
        "scrub"
    );
    assert.equal(
        bridge.clearCategoryHistory(),
        "broker95-webview:test-client:10"
    );
    assert.equal(
        outgoing[9].type,
        BrokerWebviewMessageType
            .CLEAR_CATEGORY_HISTORY
    );
    assert.equal(
        bridge.resetGameProgress(),
        "broker95-webview:test-client:11"
    );
    assert.equal(
        outgoing[10].type,
        BrokerWebviewMessageType
            .RESET_GAME_PROGRESS
    );
    assert.equal(
        bridge.setBaseUrl(
            "http://127.0.0.1:1234/v1"
        ),
        "broker95-webview:test-client:12"
    );
    assert.equal(
        outgoing[11].type,
        BrokerWebviewMessageType.SET_BASE_URL
    );
    assert.deepEqual(outgoing[11].payload, {
        baseUrl:
            "http://127.0.0.1:1234/v1"
    });

    target.emit(createReadyMessage());

    assert.equal(incoming.length, 1);
    assert.equal(
        incoming[0].type,
        BrokerHostMessageType.READY
    );

    target.emit({ type: "mensaje-falso" });
    assert.equal(errors.length, 1);

    disconnect();
    disconnect();
    assert.equal(target.listeners.size, 0);
});

test("proyecta el diagnóstico exitoso del enlace sin volverlo estado autoritativo", () => {
    const store = new Broker95ViewStore();

    store.applyHostMessage(
        createReadyMessage()
    );
    store.applyHostMessage(
        createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .LLM_CONNECTION_RESULT,
            requestId:
                "request:test-connection",
            payload: {
                providerId: "groq",
                model: "modelo-prueba",
                connected: true,
                message:
                    "Modelo disponible."
            }
        })
    );

    assert.deepEqual(
        store.getState().connectionCheck,
        {
            providerId: "groq",
            model: "modelo-prueba",
            connected: true,
            message: "Modelo disponible."
        }
    );

    store.applyHostMessage(
        createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .SETTINGS_UPDATED,
            payload: {
                settings
            }
        })
    );
    assert.equal(
        store.getState().connectionCheck,
        null
    );
});

test("descubre y proyecta el catálogo local de LM Studio mediante el protocolo", () => {
    const target = createEventTarget();
    const outgoing = [];
    const bridge = new Broker95Bridge({
        eventTarget: target,
        acquireVsCodeApi() {
            return {
                postMessage(message) {
                    outgoing.push(message);
                }
            };
        },
        createClientId() {
            return "lm-studio-client";
        },
        logger: silentLogger()
    });

    bridge.connect({
        onMessage() {},
        onError(error) {
            assert.fail(error.message);
        }
    });

    assert.equal(
        bridge.discoverLmStudioModels(),
        "broker95-webview:lm-studio-client:2"
    );
    assert.equal(
        outgoing[1].type,
        BrokerWebviewMessageType
            .DISCOVER_LM_STUDIO_MODELS
    );
    assert.deepEqual(outgoing[1].payload, {});

    const store = new Broker95ViewStore();

    store.applyHostMessage(createReadyMessage());
    store.applyHostMessage(
        createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .LM_STUDIO_MODELS,
            requestId:
                "request:lm-studio-models",
            payload: {
                providerId: "lm-studio",
                baseUrl:
                    "http://127.0.0.1:1234/v1",
                models: [
                    "qwen/qwen3-8b",
                    "meta/llama-3.2"
                ]
            }
        })
    );

    assert.deepEqual(
        store.getState().lmStudioModels,
        {
            providerId: "lm-studio",
            baseUrl:
                "http://127.0.0.1:1234/v1",
            models: [
                "qwen/qwen3-8b",
                "meta/llama-3.2"
            ]
        }
    );

    store.applyHostMessage(
        createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .SETTINGS_UPDATED,
            payload: { settings }
        })
    );
    assert.equal(
        store.getState().lmStudioModels,
        null
    );
});

test("la configuración visual de LM Studio ofrece descubrimiento y selección de modelos", async () => {
    const [application, styleSheet] =
        await Promise.all([
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
        application,
        /bridge\.discoverLmStudioModels\(\)/u
    );
    assert.match(
        application,
        /<datalist id="broker95-lm-studio-models">/u
    );
    assert.match(
        application,
        /BUSCAR MODELOS/u
    );
    assert.match(
        styleSheet,
        /\.broker95-lm-studio-discovery\s*\{/u
    );
});

test("los paneles exponen orden estable, indicadores y navegación por teclado", () => {
    const store = new Broker95ViewStore();

    store.applyHostMessage(
        createReadyMessage()
    );

    assert.deepEqual(
        BROKER95_PANEL_DEFINITIONS.map(
            panel => panel.id
        ),
        [
            Broker95Panel.TERMINAL,
            Broker95Panel.CONTRACT,
            Broker95Panel.LEARNING,
            Broker95Panel.ECONOMY,
            Broker95Panel.STATISTICS,
            Broker95Panel.SETTINGS
        ]
    );
    assert.equal(
        moveBroker95Panel(
            Broker95Panel.CONTRACT,
            "ArrowRight"
        ),
        Broker95Panel.LEARNING
    );
    assert.equal(
        moveBroker95Panel(
            Broker95Panel.TERMINAL,
            "ArrowRight"
        ),
        Broker95Panel.CONTRACT
    );
    assert.equal(
        moveBroker95Panel(
            Broker95Panel.TERMINAL,
            "ArrowLeft"
        ),
        Broker95Panel.SETTINGS
    );
    assert.equal(
        moveBroker95Panel(
            Broker95Panel.CONTRACT,
            "End"
        ),
        Broker95Panel.SETTINGS
    );
    assert.equal(
        moveBroker95Panel(
            Broker95Panel.CONTRACT,
            "Escape"
        ),
        null
    );

    const badges = createBroker95PanelBadges(
        store.getState()
    );

    assert.equal(
        badges[Broker95Panel.SETTINGS],
        "!"
    );
    assert.equal(
        badges[Broker95Panel.CONTRACT],
        null
    );
    assert.equal(
        badges[Broker95Panel.LEARNING],
        "0/50"
    );
});

test("Aprendizaje navega localmente y vuelve a la ruta si la lección queda bloqueada", () => {
    let gameState = addBrokerLearningContract(
        createBrokerGameState(),
        "lesson-001",
        {
            title: "Primer ejercicio",
            description: "Mostrar un mensaje.",
            requirements: [
                "Mostrar el texto indicado."
            ],
            testCases: []
        },
        { createdAt: "created" }
    );

    gameState = acceptBrokerContract(
        gameState,
        1
    );
    gameState = settleBrokerContract(
        gameState,
        {
            dimensionScores: {
                functionality: 90
            },
            submittedAt: "submitted"
        }
    );

    const store = new Broker95ViewStore();

    store.applyHostMessage(
        createReadyMessage(gameState)
    );
    store.setActivePanel(
        Broker95Panel.LEARNING
    );

    assert.equal(
        store.openLearningRoute("algorithms"),
        false
    );
    assert.equal(
        store.openLearningLesson("lesson-002"),
        false
    );
    assert.equal(
        store.openLearningRoute("programming"),
        true
    );

    assert.equal(
        store.getState().activePanel,
        Broker95Panel.LEARNING
    );
    assert.equal(
        store.openLearningLesson(
            "lesson-003"
        ),
        false
    );
    assert.equal(
        store.openLearningLesson(
            "lesson-002"
        ),
        true
    );
    assert.deepEqual(
        store.getState().learningNavigation,
        {
            screen:
                Broker95LearningScreen.LESSON,
            routeId: "programming",
            lessonId: "lesson-002"
        }
    );

    store.applyHostMessage(
        stateUpdatedMessage(
            resetBrokerGameProgress(
                gameState
            )
        )
    );

    assert.deepEqual(
        store.getState().learningNavigation,
        {
            screen:
                Broker95LearningScreen.ROUTE,
            routeId: "programming",
            lessonId: null
        }
    );
    assert.equal(
        store.showLearningRoute(),
        false
    );
    assert.equal(
        store.showLearningNetwork(),
        true
    );
    assert.equal(
        store.showLearningNetwork(),
        false
    );
});

test("la Red de Formación proyecta rutas independientes, bloqueo y navegación por teclado", () => {
    const store = new Broker95ViewStore();

    store.applyHostMessage(createReadyMessage());

    const state = store.getState();
    const model =
        createBroker95LearningRouteSelectorModel(
            state.gameState.learning
        );

    assert.equal(model.totalRoutes, 2);
    assert.equal(model.completedRoutes, 0);
    assert.deepEqual(
        model.routes.map(route => ({
            routeId: route.routeId,
            status: route.status,
            completedLessons:
                route.completedLessons,
            totalLessons: route.totalLessons,
            canOpen: route.canOpen
        })),
        [
            {
                routeId: "programming",
                status: "available",
                completedLessons: 0,
                totalLessons: 50,
                canOpen: true
            },
            {
                routeId: "algorithms",
                status: "locked",
                completedLessons: 0,
                totalLessons: 0,
                canOpen: false
            }
        ]
    );
    assert.match(
        model.routes[1].requirement,
        /Completa Programación/u
    );
    assert.match(
        model.routes[1].accessibleLabel,
        /Ruta no interactuable/u
    );
    assert.equal(
        moveBroker95LearningRouteFocus(
            ["programming", "algorithms"],
            "programming",
            "ArrowRight"
        ),
        "algorithms"
    );
    assert.equal(
        moveBroker95LearningRouteFocus(
            ["programming", "algorithms"],
            "algorithms",
            "Home"
        ),
        "programming"
    );
});

test("el selector abre Algoritmia sólo cuando el Host la proyecta disponible", () => {
    const catalogs =
        createAlgorithmsLearningCatalogsFixture();
    const gameState =
        createUnlockedAlgorithmsGameState(catalogs);
    const store = new Broker95ViewStore();

    store.applyHostMessage(
        createReadyMessage(
            gameState,
            { catalogs }
        )
    );

    const model =
        createBroker95LearningRouteSelectorModel(
            store.getState().gameState.learning
        );
    const algorithms = model.routes.find(
        route => route.routeId === "algorithms"
    );

    assert.equal(algorithms.status, "available");
    assert.equal(algorithms.canOpen, true);
    assert.match(
        algorithms.requirement,
        /Requisito cumplido/u
    );
    assert.equal(
        store.openLearningRoute("algorithms"),
        true
    );
    assert.deepEqual(
        store.getState().learningNavigation,
        {
            screen: Broker95LearningScreen.ROUTE,
            routeId: "algorithms",
            lessonId: null
        }
    );
});

test("el selector de rutas es responsivo y anuncia sus estados", async () => {
    const [application, styleSheet] =
        await Promise.all([
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

    assert.match(application, /RED DE FORMACIÓN/u);
    assert.match(application, /aria-live="polite"/u);
    assert.match(application, /aria-disabled=\{!route\.canOpen\}/u);
    assert.match(
        styleSheet,
        /@container broker-learning-network \(max-width: 700px\)/u
    );
    assert.match(
        styleSheet,
        /\.broker95-learning-route-selector[\s\S]*grid-template-columns:\s*repeat\(2/u
    );
});

test("mantiene contenidos, contadores y desplazamiento dentro del panel", async () => {
    const styleSheet = await readFile(
        new URL(
            "../frontend/src/broker95/broker95.css",
            import.meta.url
        ),
        "utf8"
    );

    assert.match(
        styleSheet,
        /\.broker95-learning-network\s*\{[\s\S]*?padding:\s*18px/u
    );
    assert.match(
        styleSheet,
        /\.broker95-tabs button > b\s*\{[\s\S]*?flex:\s*0 0 auto[\s\S]*?white-space:\s*nowrap/u
    );
    assert.match(
        styleSheet,
        /\.broker95-profile-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto/u
    );
    assert.match(
        styleSheet,
        /\.broker95-app,\s*\.broker95-app \*\s*\{\s*scrollbar-color:\s*#365b1c #071000/u
    );
    assert.match(
        styleSheet,
        /\.broker95-learning-route\s*\{[\s\S]*?min-width:\s*340px/u
    );
    assert.match(
        styleSheet,
        /\.broker95-learning-route-viewport\s*\{[\s\S]*?overflow-x:\s*auto/u
    );
    assert.match(
        styleSheet,
        /\.broker95-learning-route::before\s*\{[\s\S]*?bottom:\s*44px/u
    );
    assert.match(
        styleSheet,
        /\.broker95-learning-callout p\s*\{[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?white-space:\s*pre-wrap;/u
    );
});

test("reordena rutas estadísticas y la señal de audio dentro de sus paneles", async () => {
    const [application, styleSheet] =
        await Promise.all([
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
        application,
        /className="broker95-learning-statistics"/u
    );
    assert.match(
        application,
        /broker95-stat-row broker95-learning-stat-row/u
    );
    assert.match(
        application,
        /className="broker95-audio-test"/u
    );
    assert.match(
        styleSheet,
        /@container broker-learning-statistics \(max-width: 320px\)[\s\S]*?\.broker95-learning-stat-row > \.broker95-stat-bar\s*\{[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?grid-row:\s*2;/u
    );
    assert.match(
        styleSheet,
        /@container broker-settings-panel \(max-width: 720px\)[\s\S]*?\.broker95-audio-controls > \.broker95-audio-test\s*\{[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?width:\s*100%;/u
    );
});

test("la capa accesible expresa estados sin depender de colores ni del canvas", () => {
    const store = new Broker95ViewStore();

    store.applyHostMessage(
        createReadyMessage()
    );
    const state = store.getState();
    const alert =
        createBroker95AlertAccessibility(
            state.gameState
        );

    assert.equal(
        createBroker95PoliteStatus(state),
        "BROKER.95 conectado y listo."
    );
    assert.equal(alert.role, "progressbar");
    assert.equal(alert["aria-valuenow"], 0);
    assert.equal(
        alert["aria-valuetext"],
        "Nivel 0 de 10"
    );
    assert.equal(
        createBroker95TabAccessibleLabel(
            Broker95Panel.SETTINGS,
            "Configuración",
            "!",
            state
        ),
        "Configuración, configuración incompleta"
    );
    assert.equal(
        createBroker95TabAccessibleLabel(
            Broker95Panel.LEARNING,
            "Aprendizaje",
            "3/50",
            state
        ),
        "Aprendizaje, 3/50 lecciones completadas"
    );
    assert.equal(
        createBroker95PoliteStatus({
            ...state,
            operation: {
                status: "busy",
                operation:
                    "submission/review"
            }
        }),
        "Operación en curso: revisión del código."
    );
    assert.equal(
        createBroker95AssertiveStatus({
            lastError: {
                message: "Fallo controlado."
            }
        }),
        "Fallo controlado."
    );
});

test("el store preserva identidades inmutables para evitar renderizados históricos", () => {
    const store = new Broker95ViewStore();

    store.applyHostMessage(
        createReadyMessage()
    );
    store.applyHostMessage(
        createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .CIPHER_STREAM,
            requestId: "request:identity",
            payload: {
                streamId: "identity",
                phase:
                    BrokerCipherStreamPhase.END,
                text: "Respuesta estable."
            }
        })
    );

    const firstState = store.getState();
    const firstEntry =
        firstState.terminalEntries[0];
    const signal = firstState.cipherSignal;
    let notifications = 0;

    store.subscribe(() => {
        notifications += 1;
    });

    assert.equal(
        store.setActivePanel(
            Broker95Panel.TERMINAL
        ),
        false
    );
    assert.equal(notifications, 0);

    store.setActivePanel(
        Broker95Panel.SETTINGS
    );
    const secondState = store.getState();

    assert.equal(notifications, 1);
    assert.equal(
        secondState.terminalEntries[0],
        firstEntry
    );
    assert.equal(
        secondState.cipherSignal,
        signal
    );
});

test("el store restaura el snapshot del Host sin convertirse en autoridad", () => {
    const store = new Broker95ViewStore();
    const snapshots = [];
    const unsubscribe = store.subscribe(
        state => snapshots.push(state)
    );

    store.applyHostMessage(
        createReadyMessage()
    );

    const ready = store.getState();

    assert.equal(
        ready.connection,
        Broker95ConnectionStatus.READY
    );
    assert.equal(
        ready.sessionId,
        "broker95:test-webview"
    );
    assert.equal(ready.gameState.money, 0);
    assert.equal(
        ready.terminalEntries.length,
        1
    );
    assert.equal(
        Object.hasOwn(ready.settings, "apiKey"),
        false
    );

    store.setActivePanel(
        Broker95Panel.SETTINGS
    );
    assert.equal(
        store.getState().activePanel,
        Broker95Panel.SETTINGS
    );
    store.setActivePanel(
        Broker95Panel.ECONOMY
    );
    assert.equal(
        store.getState().activePanel,
        Broker95Panel.ECONOMY
    );
    assert.equal(
        store.appendUserInput("ai -get"),
        true
    );
    assert.equal(
        store.appendUserInput("   "),
        false
    );
    assert.equal(
        store.getState()
            .terminalEntries.at(-1).kind,
        BrokerTerminalEntryKind.USER
    );

    store.applyHostMessage(
        createBrokerHostMessage({
            type: BrokerHostMessageType.ERROR,
            requestId: "request:error",
            payload: {
                code:
                    "BROKER95_OPERATION_NOT_AVAILABLE",
                message:
                    "Operación todavía no disponible.",
                recoverable: true,
                requestType:
                    BrokerWebviewMessageType
                        .SUBMIT_TERMINAL
            }
        })
    );

    assert.equal(
        store.getState().lastError.code,
        "BROKER95_OPERATION_NOT_AVAILABLE"
    );
    assert.equal(
        store.getState().cipherSignal.visualState,
        Broker95CipherVisualState.WARNING
    );
    assert.equal(
        store.getState()
            .terminalEntries.at(-1).kind,
        BrokerTerminalEntryKind.ERROR
    );
    assert.ok(snapshots.length >= 4);

    unsubscribe();
});

test("el store traduce respuestas de CIPHER a se\u00f1ales visuales ef\u00edmeras", () => {
    const store = new Broker95ViewStore();

    store.applyHostMessage(
        createReadyMessage()
    );
    store.applyHostMessage(
        createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .CIPHER_STREAM,
            requestId: "request:cipher",
            payload: {
                streamId: "cipher:test",
                phase:
                    BrokerCipherStreamPhase.END,
                text: "Canal listo."
            }
        })
    );

    const signal =
        store.getState().cipherSignal;

    assert.equal(
        signal.visualState,
        Broker95CipherVisualState.ATTENTIVE
    );
    assert.equal(signal.sequence, 1);
    assert.ok(signal.durationMs > 0);
    assert.equal(Object.isFrozen(signal), true);
});

test("el ciclo de contrato produce se\u00f1ales de atenci\u00f3n y resultado", () => {
    const category =
        brokerCategoryCatalog
            .requireCategory("NUM-ARITH");
    let gameState = addBrokerContract(
        createBrokerGameState(),
        {
            title: "Suma clandestina",
            categoryId: category.categoryId,
            categoryName: category.categoryName,
            familyId: category.familyId,
            familyName: category.familyName,
            risk: "low",
            description:
                "Resolver una operaci\u00f3n aritm\u00e9tica.",
            requirements: [
                "Leer dos n\u00fameros.",
                "Mostrar su suma."
            ],
            client: "Northstar",
            payPotential: 200,
            metadata: { source: "test" }
        }
    );
    const store = new Broker95ViewStore();

    store.applyHostMessage(
        createReadyMessage(gameState)
    );
    gameState = acceptBrokerContract(
        gameState,
        1
    );
    store.applyHostMessage(
        stateUpdatedMessage(gameState)
    );

    assert.equal(
        store.getState().cipherSignal.visualState,
        Broker95CipherVisualState.ATTENTIVE
    );

    gameState = settleBrokerContract(
        gameState,
        {
            dimensionScores: {
                functionality: 100
            }
        }
    );
    store.applyHostMessage(
        stateUpdatedMessage(gameState)
    );

    assert.equal(
        store.getState().cipherSignal.visualState,
        Broker95CipherVisualState.SUCCESS
    );
    assert.equal(
        store.getState().cipherSignal.sequence,
        2
    );
});

test("el historial visual de terminal permanece acotado", () => {
    const store = new Broker95ViewStore();

    store.applyHostMessage(
        createReadyMessage()
    );
    store.applyHostMessage(
        createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .TERMINAL_APPEND,
            payload: {
                entries: Array.from(
                    {
                        length:
                            BROKER95_MAX_VISIBLE_ENTRIES
                    },
                    (_, index) => ({
                        id: `entry:${index + 1}`,
                        kind:
                            BrokerTerminalEntryKind
                                .SYSTEM,
                        text: `línea ${index + 1}`,
                        createdOrder: index + 1
                    })
                )
            }
        })
    );

    const entries =
        store.getState().terminalEntries;

    assert.equal(
        entries.length,
        BROKER95_MAX_VISIBLE_ENTRIES
    );
    assert.equal(entries[0].id, "entry:1");
    assert.equal(
        entries.at(-1).id,
        `entry:${BROKER95_MAX_VISIBLE_ENTRIES}`
    );
});

test("abre las estadísticas finales al entrar o restaurar un game over", () => {
    const gameOverState =
        createBrokerGameState({
            revision: 1,
            status: "game_over",
            alertLevel: 11,
            money: 0
        });
    const liveStore = new Broker95ViewStore();

    liveStore.applyHostMessage(
        createReadyMessage()
    );
    liveStore.setActivePanel(
        Broker95Panel.ECONOMY
    );
    liveStore.applyHostMessage(
        createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .STATE_UPDATED,
            payload: {
                state: gameOverState,
                reason: "game/state-changed"
            }
        })
    );

    assert.equal(
        liveStore.getState().activePanel,
        Broker95Panel.STATISTICS
    );
    assert.equal(
        liveStore.getState().gameState
            .statisticsView.summary.gameOver,
        true
    );

    const restoredStore =
        new Broker95ViewStore();
    restoredStore.applyHostMessage(
        createReadyMessage(gameOverState)
    );

    assert.equal(
        restoredStore.getState().activePanel,
        Broker95Panel.STATISTICS
    );
});

function createReadyMessage(
    state = createBrokerGameState(),
    options = {}
) {
    return createBrokerHostMessage({
        type: BrokerHostMessageType.READY,
        requestId: "request:ready",
        payload: {
            sessionId:
                "broker95:test-webview",
            state,
            settings,
            llmStatus
        }
    }, options);
}

function stateUpdatedMessage(state) {
    return createBrokerHostMessage({
        type:
            BrokerHostMessageType
                .STATE_UPDATED,
        payload: {
            state,
            reason: "game/state-changed"
        }
    });
}

function createEventTarget() {
    const listeners = new Set();

    return {
        listeners,
        addEventListener(type, listener) {
            if (type === "message") {
                listeners.add(listener);
            }
        },
        removeEventListener(type, listener) {
            if (type === "message") {
                listeners.delete(listener);
            }
        },
        emit(data) {
            for (const listener of listeners) {
                listener({ data });
            }
        }
    };
}

function silentLogger() {
    return {
        error() {}
    };
}
