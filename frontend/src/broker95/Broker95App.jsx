import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import {
    broker95Bridge
} from "./Broker95Bridge.js";
import {
    Broker95ConnectionStatus,
    Broker95Panel,
    broker95ViewStore
} from "./Broker95ViewStore.js";
import Broker95CipherScene
    from "./scene/Broker95CipherScene.jsx";
import {
    deriveBroker95CipherVisualState
} from "./scene/Broker95CipherVisualState.js";
import {
    BROKER95_PANEL_DEFINITIONS,
    createBroker95PanelBadges,
    moveBroker95Panel
} from "./panels/Broker95PanelNavigation.js";
import {
    createBroker95ProviderExperience,
    focusBroker95Configuration
} from "./panels/Broker95ProviderExperience.js";
import {
    Broker95LearningScreen
} from "./panels/Broker95LearningNavigation.js";
import {
    createBroker95LearningRouteSelectorModel,
    moveBroker95LearningRouteFocus
} from "./panels/Broker95LearningRouteSelector.js";
import {
    createBroker95LearningRouteModel,
    scrollBroker95LearningTarget
} from "./panels/Broker95LearningRoute.js";
import {
    Broker95LearningLessonAction,
    createBroker95LearningLessonModel
} from "./panels/Broker95LearningLesson.js";
import {
    formatBroker95LearningCalloutText
} from "./panels/Broker95LearningCallout.js";
import Broker95LearningFormula
    from "./panels/Broker95LearningFormula.jsx";
import {
    getBroker95LearningToolDescriptor
} from "./panels/Broker95LearningTools.js";
import {
    createBroker95LearningLessonLabel,
    createBroker95LearningSectionLabel,
    moveBroker95LearningFocus
} from "./accessibility/Broker95LearningAccessibility.js";
import {
    createBroker95AlertAccessibility,
    createBroker95AssertiveStatus,
    createBroker95PoliteStatus,
    createBroker95TabAccessibleLabel
} from "./accessibility/Broker95Accessibility.js";
import {
    Broker95AudioEngine,
    Broker95SoundEffect,
    deriveBroker95StateSoundEffects
} from "./audio/index.js";

import "./broker95.css";

const RISK_LABELS = Object.freeze({
    low: "Bajo",
    medium: "Medio",
    high: "Alto",
    extreme: "Extremo"
});

export default function Broker95App({
    bridge = broker95Bridge,
    store = broker95ViewStore
}) {
    const state = useBroker95State(store);
    const [cipherExpanded, setCipherExpanded] =
        useState(false);
    const audioEngine = useMemo(
        () => new Broker95AudioEngine(),
        []
    );
    const previousAudioState = useRef(null);

    useEffect(
        () => bridge.connect({
            onMessage: message =>
                store.applyHostMessage(message),
            onError: error =>
                store.reportBridgeError(error)
        }),
        [bridge, store]
    );

    useEffect(
        () => {
            audioEngine.configure(
                state.settings.audio
            );
        },
        [
            audioEngine,
            state.settings.audio
        ]
    );

    useEffect(
        () => {
            const effects =
                deriveBroker95StateSoundEffects(
                    previousAudioState.current,
                    state
                );

            previousAudioState.current = state;

            effects.forEach((effect, index) => {
                audioEngine.play(effect, {
                    delayMs: index * 180
                });
            });
        },
        [audioEngine, state]
    );

    useEffect(
        () => () => audioEngine.dispose(),
        [audioEngine]
    );

    useEffect(
        () => {
            if (!cipherExpanded) {
                return undefined;
            }

            const closeWithEscape = event => {
                if (event.key === "Escape") {
                    setCipherExpanded(false);
                }
            };

            globalThis.addEventListener?.(
                "keydown",
                closeWithEscape
            );

            return () => globalThis
                .removeEventListener?.(
                    "keydown",
                    closeWithEscape
                );
        },
        [cipherExpanded]
    );

    return (
        <main
            className="broker95-app"
            aria-labelledby="broker95-title"
            onClickCapture={event => {
                if (
                    event.target.closest?.(
                        "button"
                    )
                ) {
                    void audioEngine
                        .playFromGesture(
                            Broker95SoundEffect
                                .CRT_CLICK
                        );
                }
            }}
            onKeyDownCapture={event => {
                if (
                    isMechanicalKeyEvent(event)
                ) {
                    void audioEngine
                        .playFromGesture(
                            Broker95SoundEffect
                                .MECHANICAL_KEY
                        );
                }
            }}
        >
            <a
                className="broker95-skip-link"
                href="#broker95-console"
            >
                Saltar a los paneles
            </a>
            <AccessibilityAnnouncements
                state={state}
            />
            <div
                className="broker95-scanlines"
                aria-hidden="true"
            />

            <Header state={state} />

            <section className="broker95-workspace">
                <CipherPanel
                    state={state}
                    store={store}
                    expanded={cipherExpanded}
                    onToggleExpanded={() =>
                        setCipherExpanded(value =>
                            !value
                        )
                    }
                />

                <section
                    id="broker95-console"
                    className="broker95-console"
                    aria-label="Consola y paneles de BROKER.95"
                    tabIndex={-1}
                >
                    <PanelTabs
                        state={state}
                        store={store}
                    />

                    <div
                        className="broker95-panel-frame"
                        id={
                            `broker95-panel-${state.activePanel}`
                        }
                        role="tabpanel"
                        aria-labelledby={
                            `broker95-tab-${state.activePanel}`
                        }
                        tabIndex={0}
                        aria-busy={
                            state.operation.status ===
                            "busy"
                        }
                    >
                        {state.activePanel ===
                            Broker95Panel.TERMINAL && (
                            <TerminalPanel
                                state={state}
                                bridge={bridge}
                                store={store}
                            />
                        )}
                        {state.activePanel ===
                            Broker95Panel.CONTRACT && (
                            <ContractPanel
                                gameState={
                                    state.gameState
                                }
                            />
                        )}
                        {state.activePanel ===
                            Broker95Panel.LEARNING && (
                            <LearningPanel
                                state={state}
                                store={store}
                                bridge={bridge}
                            />
                        )}
                        {state.activePanel ===
                            Broker95Panel.ECONOMY && (
                            <EconomyPanel
                                state={state}
                                bridge={bridge}
                            />
                        )}
                        {state.activePanel ===
                            Broker95Panel.STATISTICS && (
                            <StatisticsPanel
                                gameState={
                                    state.gameState
                                }
                            />
                        )}
                        {state.activePanel ===
                            Broker95Panel.SETTINGS && (
                            <SettingsPanel
                                state={state}
                                bridge={bridge}
                                audioEngine={
                                    audioEngine
                                }
                            />
                        )}
                    </div>
                </section>
            </section>

            <footer className="broker95-footer">
                <span>
                    SISTEMA LOCAL // ESTADO AUTORITATIVO EN HOST
                </span>
                <span>
                    SESIÓN {shortSession(
                        state.sessionId
                    )}
                </span>
            </footer>
        </main>
    );
}

function AccessibilityAnnouncements({ state }) {
    const politeStatus =
        createBroker95PoliteStatus(state);
    const assertiveStatus =
        createBroker95AssertiveStatus(state);

    return (
        <>
            <div
                className="broker95-visually-hidden"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                {politeStatus}
            </div>
            <div
                className="broker95-visually-hidden"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
            >
                {assertiveStatus}
            </div>
        </>
    );
}

function PanelTabs({ state, store }) {
    const tabRefs = useRef({});
    const badges = useMemo(
        () => createBroker95PanelBadges(
            state
        ),
        [state]
    );
    const selectPanel = panel => {
        store.setActivePanel(panel);
        tabRefs.current[panel]?.focus();
    };
    const navigate = event => {
        const nextPanel = moveBroker95Panel(
            state.activePanel,
            event.key
        );

        if (!nextPanel) {
            return;
        }

        event.preventDefault();
        selectPanel(nextPanel);
    };

    return (
        <nav
            className="broker95-tabs"
            aria-label="Paneles de BROKER.95"
            role="tablist"
            aria-orientation="horizontal"
            onKeyDown={navigate}
        >
            {BROKER95_PANEL_DEFINITIONS.map(
                definition => {
                    const selected =
                        state.activePanel ===
                        definition.id;
                    const badge =
                        badges[definition.id];

                    return (
                        <button
                            type="button"
                            key={definition.id}
                            ref={element => {
                                tabRefs.current[
                                    definition.id
                                ] = element;
                            }}
                            id={definition.tabId}
                            role="tab"
                            className={
                                selected
                                    ? "active"
                                    : ""
                            }
                            aria-controls={
                                definition.panelId
                            }
                            aria-selected={selected}
                            aria-label={
                                createBroker95TabAccessibleLabel(
                                    definition.id,
                                    definition.label,
                                    badge,
                                    state
                                )
                            }
                            tabIndex={selected ? 0 : -1}
                            onClick={() =>
                                selectPanel(
                                    definition.id
                                )
                            }
                        >
                            <span>{definition.label}</span>
                            {badge && (
                                <b aria-hidden="true">
                                    {badge}
                                </b>
                            )}
                        </button>
                    );
                }
            )}
        </nav>
    );
}

function Header({ state }) {
    const game = state.gameState;
    const alert = game?.alertLevel ?? 0;
    const alertLimit = game?.economy
        ?.alertLimit ?? 10;
    const gameOver = game?.gameOver === true;
    const alertAccessibility =
        createBroker95AlertAccessibility(game);

    return (
        <header className="broker95-header">
            <div className="broker95-brand">
                <span
                    className="broker95-brand-mark"
                    aria-hidden="true"
                >
                    95
                </span>
                <div>
                    <h1 id="broker95-title">
                        BROKER.95
                    </h1>
                    <p>RED PRIVADA DE CONTRATOS</p>
                </div>
            </div>

            <div className="broker95-metrics">
                <Metric
                    label="Saldo"
                    value={formatMoney(
                        game?.money ?? 0
                    )}
                />
                <Metric
                    label="Contrato"
                    value={
                        game?.activeContractId == null
                            ? "NINGUNO"
                            : `#${game.activeContractId}`
                    }
                />
                <div className="broker95-alert-metric">
                    <span>Alerta</span>
                    <strong>
                        {gameOver
                            ? "GAME OVER"
                            : `${alert}/${alertLimit}`}
                    </strong>
                    <div
                        {...alertAccessibility}
                        className={
                            `broker95-alert-track ${
                                gameOver
                                    ? "critical"
                                    : ""
                            }`
                        }
                    >
                        <i style={{
                            width:
                                `${Math.min(
                                    alert,
                                    alertLimit
                                ) /
                                    alertLimit *
                                    100}%`
                        }} />
                    </div>
                </div>
            </div>
        </header>
    );
}

function Metric({ label, value }) {
    return (
        <div className="broker95-metric">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function CipherPanel({
    state,
    store,
    expanded,
    onToggleExpanded
}) {
    const experience = createBroker95ProviderExperience(state);
    const online = experience.configured && experience.tone !== "warning";
    const visualState =
        deriveBroker95CipherVisualState(
            state
        );
    const connecting = state.connection ===
        Broker95ConnectionStatus.CONNECTING;
    const statusText = connecting
        ? "ENLAZANDO"
        : experience.title;

    return (
        <aside
            className={
                `broker95-cipher-panel ${
                    expanded ? "expanded" : ""
                }`
            }
            aria-labelledby="broker95-cipher-title"
            aria-describedby="broker95-cipher-description"
        >
            <div
                id="broker95-cipher-title"
                className="broker95-section-label"
            >
                INTERMEDIARIO // CIPHER
            </div>

            <button
                type="button"
                className={
                    `broker95-cipher-screen ${
                        online ? "online" : "offline"
                    }`
                }
                aria-label={
                    expanded
                        ? `${statusText}. Contraer vista de CIPHER.`
                        : `${statusText}. Ampliar vista de CIPHER.`
                }
                aria-expanded={expanded}
                aria-pressed={expanded}
                data-cipher-state={visualState}
                title={
                    expanded
                        ? "Volver a la vista miniatura"
                        : "Ampliar CIPHER"
                }
                onClick={onToggleExpanded}
            >
                <Broker95CipherScene
                    visualState={visualState}
                    signal={state.cipherSignal}
                />
            </button>

            <div
                className="broker95-cipher-status"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                <span className={
                    online ? "online" : "offline"
                } />
                <strong>{statusText}</strong>
            </div>
            <p id="broker95-cipher-description">
                {experience.message}
            </p>

            <div className="broker95-cipher-provider">
                <strong>{experience.provider?.label ?? "Proveedor pendiente"}</strong>
                <span>{experience.endpointLabel}</span>
                <code>{state.settings.model || "Sin modelo seleccionado"}</code>
                <button type="button" onClick={() => {
                    store.setActivePanel(Broker95Panel.SETTINGS);
                    globalThis.requestAnimationFrame(() =>
                        focusBroker95Configuration(experience.actionTarget)
                    );
                }}>
                    CONFIGURAR CIPHER
                </button>
            </div>

            <div className="broker95-link-details">
                <span>
                    HOST
                    <b>{
                        state.connection ===
                            Broker95ConnectionStatus.READY
                            ? "CONECTADO"
                            : "PENDIENTE"
                    }</b>
                </span>
                <span>
                    OPERACIÓN
                    <b>{
                        state.operation.status ===
                            "busy"
                            ? state.operation
                                .operation
                            : "EN ESPERA"
                    }</b>
                </span>
            </div>
        </aside>
    );
}

function TerminalPanel({
    state,
    bridge,
    store
}) {
    const [input, setInput] = useState("");
    const [followingOutput, setFollowingOutput] =
        useState(true);
    const outputRef = useRef(null);
    const busy = state.connection !==
        Broker95ConnectionStatus.READY ||
        state.operation.status === "busy";

    useEffect(
        () => {
            const output = outputRef.current;

            if (output && followingOutput) {
                output.scrollTop =
                    output.scrollHeight;
            }
        },
        [state.terminalEntries, followingOutput]
    );

    const submit = event => {
        event.preventDefault();

        if (
            busy ||
            !store.appendUserInput(input)
        ) {
            return;
        }

        bridge.submitTerminal(input);
        setInput("");
    };

    return (
        <section className="broker95-terminal-panel">
            <header className="broker95-panel-header">
                <div>
                    <span>CONSOLA SEGURA</span>
                    <h2>Terminal</h2>
                </div>
                <span
                    id="broker95-terminal-help"
                    className="broker95-terminal-hint"
                >
                    raíz: ai
                </span>
            </header>

            <div
                ref={outputRef}
                className="broker95-terminal-output"
                role="log"
                tabIndex={0}
                aria-label="Historial de la terminal de BROKER.95"
                aria-live="polite"
                aria-relevant="additions text"
                aria-busy={
                    state.operation.status ===
                    "busy"
                }
                onScroll={event => {
                    const output =
                        event.currentTarget;
                    const atBottom =
                        output.scrollHeight -
                        output.scrollTop -
                        output.clientHeight < 24;

                    setFollowingOutput(atBottom);
                }}
            >
                {state.terminalEntries.length === 0 && (
                    <p className="broker95-terminal-empty">
                        Esperando respuesta del Host…
                    </p>
                )}
                {state.terminalEntries.map(entry => (
                    <TerminalEntry
                        key={entry.id}
                        entry={entry}
                    />
                ))}
            </div>

            {!followingOutput && (
                <button
                    type="button"
                    className="broker95-follow-output"
                    onClick={() => {
                        const output =
                            outputRef.current;

                        if (output) {
                            output.scrollTop =
                                output.scrollHeight;
                        }

                        setFollowingOutput(true);
                    }}
                >
                    IR A LA RESPUESTA MÁS RECIENTE
                </button>
            )}

            <form
                className="broker95-terminal-input"
                onSubmit={submit}
                aria-busy={busy}
            >
                <label htmlFor="broker95-command">
                    &gt;
                </label>
                <input
                    id="broker95-command"
                    value={input}
                    maxLength={16384}
                    autoComplete="off"
                    spellCheck="false"
                    placeholder="ai -?"
                    aria-label="Comando de BROKER.95"
                    aria-describedby="broker95-terminal-help"
                    disabled={busy}
                    onChange={event =>
                        setInput(event.target.value)
                    }
                />
                <button
                    type="submit"
                    disabled={busy}
                >
                    ENVIAR
                </button>
            </form>
        </section>
    );
}

const TerminalEntry = memo(
    function TerminalEntry({ entry }) {
        return (
            <div className={
                `broker95-terminal-entry ${entry.kind}`
            }>
                <span>{entryPrefix(entry.kind)}</span>
                <pre>{entry.text}</pre>
            </div>
        );
    }
);

function LearningPanel({
    state,
    store,
    bridge
}) {
    const returnFocusLessonId = useRef(null);
    const openLesson = useCallback(
        lessonId => {
            if (
                store.openLearningLesson(
                    lessonId
                )
            ) {
                returnFocusLessonId.current =
                    lessonId;
            }
        },
        [store]
    );
    const showRoute = useCallback(
        () => store.showLearningRoute(),
        [store]
    );
    const showNetwork = useCallback(
        () => store.showLearningNetwork(),
        [store]
    );
    const openRoute = useCallback(
        routeId => store.openLearningRoute(routeId),
        [store]
    );
    const goToTerminal = useCallback(
        () => store.setActivePanel(
            Broker95Panel.TERMINAL
        ),
        [store]
    );
    const dismissNotice = useCallback(
        () => store
            .dismissLearningContractNotice(),
        [store]
    );
    const navigation =
        state.learningNavigation;
    const routeId = navigation.routeId;
    const learning = state.gameState?.learning;
    const catalog = learning
        ?.catalogs?.[routeId];
    const route = learning
        ?.progress?.[routeId];
    const routeSummary = learning?.routes?.find(
        item => item.routeId === routeId
    );

    if (!learning?.routes?.length) {
        return (
            <EmptyPanel
                eyebrow="RED DE FORMACIÓN"
                title="Sincronizando rutas"
                text="El Host está preparando el estado educativo persistente."
            />
        );
    }

    if (
        navigation.screen ===
        Broker95LearningScreen.NETWORK
    ) {
        return (
            <LearningRouteSelector
                learning={learning}
                selectedRouteId={routeId}
                onOpenRoute={openRoute}
            />
        );
    }

    if (!catalog || !route) {
        return (
            <EmptyPanel
                eyebrow="RUTA DE APRENDIZAJE"
                title="Ruta no disponible"
                text="Regresa a la Red de Formación para seleccionar una ruta disponible."
            />
        );
    }

    if (
        navigation.screen ===
        Broker95LearningScreen.LESSON
    ) {
        const lesson = catalog.lessons.find(
            item =>
                item.id ===
                navigation.lessonId
        );
        const routeLesson = route.lessons.find(
            item =>
                item.lessonId ===
                navigation.lessonId
        );
        const section = catalog.sections.find(
            item =>
                item.id === lesson?.sectionId
        );

        if (lesson && routeLesson && section) {
            return (
                <LearningLessonShell
                    onConfigure={() => store.setActivePanel(Broker95Panel.SETTINGS)}
                    lesson={lesson}
                    learningRouteId={routeId}
                    routeTitle={
                        routeSummary?.title ??
                        "Programación"
                    }
                    routeLesson={routeLesson}
                    section={section}
                    totalLessons={
                        catalog.lessonCount
                    }
                    state={state}
                    bridge={bridge}
                    onBack={showRoute}
                    onGoTerminal={goToTerminal}
                    onDismissNotice={
                        dismissNotice
                    }
                />
            );
        }
    }

    return (
        <LearningRouteShell
            catalog={catalog}
            route={route}
            routeTitle={
                routeSummary?.title ??
                "Programaci\u00f3n"
            }
            initialFocusLessonId={
                returnFocusLessonId.current
            }
            onOpenLesson={openLesson}
            onBack={showNetwork}
        />
    );
}

const LearningRouteSelector = memo(
    function LearningRouteSelector({
        learning,
        selectedRouteId,
        onOpenRoute
    }) {
        const model = useMemo(
            () =>
                createBroker95LearningRouteSelectorModel(
                    learning
                ),
            [learning]
        );
        const routeButtonRefs = useRef(new Map());
        const initialRouteId = model.routes.some(
            route => route.routeId === selectedRouteId
        )
            ? selectedRouteId
            : model.routes[0]?.routeId;
        const [focusedRouteId, setFocusedRouteId] =
            useState(initialRouteId);
        const [announcement, setAnnouncement] =
            useState("");
        const routeIds = useMemo(
            () => model.routes.map(
                route => route.routeId
            ),
            [model.routes]
        );
        const moveFocus = useCallback(
            (event, routeId) => {
                const nextRouteId =
                    moveBroker95LearningRouteFocus(
                        routeIds,
                        routeId,
                        event.key
                    );

                if (nextRouteId == null) {
                    return;
                }

                event.preventDefault();
                setFocusedRouteId(nextRouteId);
                routeButtonRefs.current
                    .get(nextRouteId)
                    ?.focus();
            },
            [routeIds]
        );

        useEffect(() => {
            if (!routeIds.includes(focusedRouteId)) {
                setFocusedRouteId(routeIds[0]);
            }
        }, [focusedRouteId, routeIds]);

        return (
            <section
                className="broker95-learning-network"
                aria-labelledby="broker95-learning-network-title"
            >
                <header className="broker95-panel-header">
                    <div>
                        <span>RED DE FORMACIÓN</span>
                        <h2 id="broker95-learning-network-title">
                            Aprendizaje
                        </h2>
                    </div>
                    <span className="broker95-learning-count">
                        {model.completedRoutes}/{model.totalRoutes} RUTAS
                    </span>
                </header>

                <div className="broker95-learning-network-intro">
                    <span>SECUENCIA FORMATIVA</span>
                    <h3>
                        Programar primero. Diseñar algoritmos después.
                    </h3>
                    <p>
                        Cada ruta conserva su propio avance. Completa Programación para habilitar Algoritmia.
                    </p>
                </div>

                <nav
                    className="broker95-learning-route-selector"
                    aria-label="Rutas de aprendizaje"
                    aria-describedby="broker95-learning-route-selector-help"
                >
                    <p
                        id="broker95-learning-route-selector-help"
                        className="broker95-visually-hidden"
                    >
                        Usa las flechas para recorrer las rutas, Inicio y Fin para ir a los extremos, y Entrar para abrir una ruta disponible.
                    </p>

                    {model.routes.map((route, index) => (
                        <article
                            key={route.routeId}
                            className={`broker95-learning-route-card ${route.status}`}
                        >
                            <button
                                ref={element => {
                                    if (element) {
                                        routeButtonRefs.current.set(
                                            route.routeId,
                                            element
                                        );
                                    } else {
                                        routeButtonRefs.current.delete(
                                            route.routeId
                                        );
                                    }
                                }}
                                type="button"
                                tabIndex={
                                    focusedRouteId === route.routeId
                                        ? 0
                                        : -1
                                }
                                aria-disabled={!route.canOpen}
                                aria-label={route.accessibleLabel}
                                onFocus={() => {
                                    setFocusedRouteId(route.routeId);
                                    setAnnouncement(
                                        route.accessibleLabel
                                    );
                                }}
                                onKeyDown={event => {
                                    moveFocus(event, route.routeId);

                                    if (
                                        !route.canOpen &&
                                        ["Enter", " "].includes(
                                            event.key
                                        )
                                    ) {
                                        event.preventDefault();
                                    }
                                }}
                                onClick={() => {
                                    if (route.canOpen) {
                                        onOpenRoute(route.routeId);
                                    } else {
                                        setAnnouncement(
                                            route.accessibleLabel
                                        );
                                    }
                                }}
                            >
                                <span className="broker95-learning-route-index">
                                    0{index + 1}
                                </span>
                                <span className="broker95-learning-route-card-copy">
                                    <small>{route.statusLabel}</small>
                                    <strong>{route.title}</strong>
                                    <span>{route.requirement}</span>
                                </span>
                                <span
                                    className="broker95-learning-route-status-icon"
                                    aria-hidden="true"
                                >
                                    {route.status === "completed"
                                        ? "✓"
                                        : route.status === "locked"
                                            ? "×"
                                            : "›"}
                                </span>
                            </button>

                            <div className="broker95-learning-route-card-progress">
                                <div>
                                    <span>PROGRESO</span>
                                    <strong>
                                        {route.totalLessons > 0
                                            ? `${route.completedLessons}/${route.totalLessons}`
                                            : "—"}
                                    </strong>
                                </div>
                                <div
                                    role="progressbar"
                                    aria-label={`Progreso de ${route.title}`}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={route.progressPercent}
                                    aria-valuetext={
                                        route.totalLessons > 0
                                            ? `${route.completedLessons} de ${route.totalLessons} lecciones completadas, ${route.progressPercent} por ciento`
                                            : "Ruta bloqueada, sin lecciones disponibles"
                                    }
                                >
                                    <i style={{
                                        width: `${route.progressPercent}%`
                                    }} />
                                </div>
                            </div>
                        </article>
                    ))}
                </nav>

                <p
                    className="broker95-visually-hidden"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {announcement}
                </p>
            </section>
        );
    }
);

const LearningRouteShell = memo(function LearningRouteShell({
    catalog,
    route,
    routeTitle,
    initialFocusLessonId,
    onOpenLesson,
    onBack
}) {
    const currentNodeRef = useRef(null);
    const routeEndRef = useRef(null);
    const lessonButtonRefs = useRef(
        new Map()
    );
    const restoredFocus = useRef(false);
    const model = useMemo(
        () => createBroker95LearningRouteModel(
            catalog,
            route
        ),
        [catalog, route]
    );
    const initialRovingLessonId =
        model.openLessonIds.includes(
            initialFocusLessonId
        )
            ? initialFocusLessonId
            : model.currentLessonId;
    const [focusedLessonId, setFocusedLessonId] =
        useState(initialRovingLessonId);
    const scrollToCurrent = useCallback(
        () =>
        scrollBroker95LearningTarget(
            model.routeCompleted
                ? routeEndRef.current
                : currentNodeRef.current,
            { focus: true }
        ),
        [model.routeCompleted]
    );
    const moveFocus = useCallback(
        (event, lessonId) => {
            const nextLessonId =
                moveBroker95LearningFocus(
                    model.openLessonIds,
                    lessonId,
                    event.key
                );

            if (nextLessonId == null) {
                return;
            }

            event.preventDefault();
            setFocusedLessonId(nextLessonId);
            lessonButtonRefs.current
                .get(nextLessonId)
                ?.focus();
        },
        [model.openLessonIds]
    );

    useEffect(
        () => {
            if (
                !model.openLessonIds.includes(
                    focusedLessonId
                )
            ) {
                setFocusedLessonId(
                    model.currentLessonId
                );
            }
        },
        [
            focusedLessonId,
            model.currentLessonId,
            model.openLessonIds
        ]
    );

    useEffect(
        () => {
            if (
                restoredFocus.current ||
                initialFocusLessonId == null
            ) {
                return;
            }

            restoredFocus.current = true;
            const targetLessonId =
                model.openLessonIds.includes(
                    initialFocusLessonId
                )
                    ? initialFocusLessonId
                    : model.currentLessonId;
            const target = lessonButtonRefs
                .current.get(targetLessonId);

            if (target) {
                setFocusedLessonId(
                    targetLessonId
                );
                scrollBroker95LearningTarget(
                    target,
                    { focus: true }
                );
            }
        },
        [
            initialFocusLessonId,
            model.currentLessonId,
            model.openLessonIds
        ]
    );

    return (
        <section
            className="broker95-learning-panel"
            aria-label={`Ruta de ${routeTitle}`}
        >
            <header className="broker95-panel-header">
                <div>
                    <span>
                        RUTA DE {routeTitle.toUpperCase()}
                    </span>
                    <h2>Aprendizaje</h2>
                </div>
                <span className="broker95-learning-count">
                    {route.completedLessons}/{route.totalLessons} · {route.progressPercent}%
                </span>
            </header>

            <button
                type="button"
                className="broker95-learning-network-back"
                onClick={onBack}
            >
                ← RED DE FORMACIÓN
            </button>

            <div className="broker95-learning-progress">
                <div>
                    <span>PROGRESO GLOBAL</span>
                    <strong>
                        {route.completedLessons} de {route.totalLessons} lecciones
                    </strong>
                </div>
                <div
                    role="progressbar"
                    aria-label="Progreso de Aprendizaje"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={
                        route.progressPercent
                    }
                    aria-valuetext={
                        `${route.completedLessons} de ${route.totalLessons} lecciones completadas, ${route.progressPercent} por ciento`
                    }
                >
                    <i style={{
                        width:
                            `${route.progressPercent}%`
                    }} />
                </div>
                <button
                    type="button"
                    onClick={scrollToCurrent}
                    aria-label={
                        model.routeCompleted
                            ? "Ir al final de la ruta completada"
                            : `Ir a la lección actual: ${model.currentLessonId}`
                    }
                >
                    {model.routeCompleted
                        ? "RUTA COMPLETADA"
                        : "IR A MI LECCIÓN"}
                </button>
            </div>

            <div className="broker95-learning-route-viewport">
            <nav
                className="broker95-learning-route"
                aria-label="Ruta curricular de Aprendizaje"
                aria-describedby="broker95-learning-route-help"
            >
                <p
                    id="broker95-learning-route-help"
                    className="broker95-visually-hidden"
                >
                    Usa las flechas para recorrer las lecciones disponibles, Inicio para ir a la primera y Fin para ir a la última. Presiona Entrar para abrir una lección.
                </p>
                <div
                    className="broker95-learning-terminal-node start"
                    aria-label="Inicio de la ruta"
                >
                    <b aria-hidden="true">01</b>
                    <span>INICIO</span>
                </div>

                {model.sections.map(({
                    section,
                    progress,
                    lessons
                }) => (
                        <section
                            key={section.id}
                            className={
                                `broker95-learning-section ${progress.status}`
                            }
                            aria-labelledby={
                                `broker95-learning-${section.id}`
                            }
                            aria-describedby={
                                `broker95-learning-${section.id}-status`
                            }
                        >
                            <span
                                id={
                                    `broker95-learning-${section.id}-status`
                                }
                                className="broker95-visually-hidden"
                            >
                                {createBroker95LearningSectionLabel({
                                    section,
                                    progress
                                })}
                            </span>
                            <header>
                                <b aria-hidden="true">
                                    {String(
                                        section.order
                                    ).padStart(2, "0")}
                                </b>
                                <div>
                                    <span>
                                        SECCIÓN {section.order}
                                    </span>
                                    <h3 id={
                                        `broker95-learning-${section.id}`
                                    }>
                                        {section.title}
                                    </h3>
                                    <p>
                                        {section.description}
                                    </p>
                                </div>
                                <small aria-hidden="true">
                                    {progress.completedLessons}/{progress.totalLessons}
                                </small>
                            </header>
                            <ol>
                                {lessons.map(({
                                    lesson,
                                    progress: routeLesson,
                                    side,
                                    current
                                }) => {
                                        const locked =
                                            routeLesson
                                                ?.canOpen !== true;

                                        return (
                                            <li
                                                key={lesson.id}
                                                className={
                                                    `broker95-learning-node-row ${side} ${routeLesson.status}`
                                                }
                                                data-learning-node={
                                                    lesson.id
                                                }
                                            >
                                                <button
                                                    ref={element => {
                                                        if (element) {
                                                            lessonButtonRefs
                                                                .current
                                                                .set(
                                                                    lesson.id,
                                                                    element
                                                                );
                                                        } else {
                                                            lessonButtonRefs
                                                                .current
                                                                .delete(
                                                                    lesson.id
                                                                );
                                                        }

                                                        if (
                                                            current &&
                                                            !model.routeCompleted
                                                        ) {
                                                            currentNodeRef.current =
                                                                element;
                                                        }
                                                    }}
                                                    type="button"
                                                    className={
                                                        routeLesson?.status ??
                                                        "locked"
                                                    }
                                                    disabled={locked}
                                                    tabIndex={
                                                        !locked &&
                                                        focusedLessonId ===
                                                            lesson.id
                                                            ? 0
                                                            : -1
                                                    }
                                                    aria-label={
                                                        createBroker95LearningLessonLabel({
                                                            lesson,
                                                            progress:
                                                                routeLesson,
                                                            section,
                                                            totalLessons:
                                                                model.totalLessons
                                                        })
                                                    }
                                                    aria-current={
                                                        current &&
                                                            !model.routeCompleted
                                                            ? "step"
                                                            : undefined
                                                    }
                                                    onClick={() =>
                                                        onOpenLesson(
                                                            lesson.id
                                                        )
                                                    }
                                                    onFocus={() =>
                                                        setFocusedLessonId(
                                                            lesson.id
                                                        )
                                                    }
                                                    onKeyDown={event =>
                                                        moveFocus(
                                                            event,
                                                            lesson.id
                                                        )
                                                    }
                                                >
                                                    <b aria-hidden="true">
                                                        {routeLesson.completed
                                                            ? "✓"
                                                            : routeLesson.status === "locked"
                                                                ? "×"
                                                                : String(lesson.order).padStart(2, "0")}
                                                    </b>
                                                    <span>
                                                        <em>
                                                            LECCIÓN {String(lesson.order).padStart(2, "0")}
                                                        </em>
                                                        <strong>
                                                            {lesson.title}
                                                        </strong>
                                                        <small>
                                                            {learningStatusLabel(
                                                                routeLesson?.status
                                                            )}
                                                        </small>
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    }
                                )}
                            </ol>
                        </section>
                ))}

                <div
                    ref={routeEndRef}
                    className={
                        `broker95-learning-terminal-node finish ${model.routeCompleted ? "completed" : "locked"}`
                    }
                    aria-label={
                        model.routeCompleted
                            ? "Fin de la ruta completada"
                            : "Fin de la ruta bloqueado"
                    }
                    tabIndex={-1}
                >
                    <b aria-hidden="true">
                        {model.routeCompleted ? "✓" : "×"}
                    </b>
                    <span>FIN</span>
                </div>
            </nav>
            </div>
        </section>
    );
});

function LearningLessonShell({
    lesson,
    learningRouteId,
    routeTitle,
    routeLesson,
    section,
    totalLessons,
    state,
    bridge,
    onBack,
    onGoTerminal,
    onDismissNotice,
    onConfigure
}) {
    const lessonTitleRef = useRef(null);
    const providerExperience = createBroker95ProviderExperience(state);
    const operationBusy =
        state.operation.status === "busy";
    const generating =
        operationBusy &&
        state.operation.operation ===
            "learning-contract/obtain";
    const [pendingRequestId, setPendingRequestId] =
        useState(null);
    const requestPending =
        pendingRequestId != null;
    const observedBusy = useRef(false);
    const model = useMemo(
        () => createBroker95LearningLessonModel({
            lesson,
            routeLesson,
            section,
            notice:
                state.learningContractNotice,
            busy:
                generating || requestPending
        }),
        [
            lesson,
            routeLesson,
            section,
            state.learningContractNotice,
            operationBusy,
            requestPending
        ]
    );

    useEffect(
        () => {
            lessonTitleRef.current?.focus({
                preventScroll: true
            });
        },
        [lesson.id]
    );

    useEffect(
        () => {
            if (!requestPending) {
                observedBusy.current = false;
                return;
            }

            if (generating) {
                observedBusy.current = true;
                return;
            }

            if (
                model.contractLinked ||
                model.notice ||
                (
                    observedBusy.current &&
                    !operationBusy
                )
            ) {
                setPendingRequestId(null);
                observedBusy.current = false;
            }
        },
        [
            requestPending,
            generating,
            operationBusy,
            model.contractLinked,
            model.notice,
            pendingRequestId
        ]
    );

    const obtainContract = () => {
        if (model.actionDisabled) {
            return;
        }

        const requestId =
            bridge.obtainLearningContract(
                lesson.id,
                learningRouteId
            );

        if (requestId != null) {
            observedBusy.current = false;
            setPendingRequestId(requestId);
        }
    };

    return (
        <section
            className="broker95-learning-panel broker95-learning-lesson"
            aria-labelledby="broker95-learning-lesson-title"
        >
            <button
                type="button"
                className="broker95-learning-back"
                onClick={onBack}
                aria-label={`Volver a la ruta desde la lección ${lesson.order}`}
            >
                ← Atrás
            </button>

            <header className="broker95-panel-header">
                <div>
                    <span>
                        RUTA DE {routeTitle.toUpperCase()} · SECCIÓN {section.order} · LECCIÓN {lesson.order} DE {totalLessons}
                    </span>
                    <h2
                        id="broker95-learning-lesson-title"
                        ref={lessonTitleRef}
                        tabIndex={-1}
                    >
                        {lesson.title}
                    </h2>
                </div>
                <span className={
                    `broker95-learning-status ${routeLesson.status}`
                }>
                    {learningStatusLabel(
                        routeLesson.status
                    )}
                </span>
            </header>

            <article className="broker95-learning-lesson-summary">
                <h3>OBJETIVO DE APRENDIZAJE</h3>
                <p>{lesson.objective}</p>
                <dl>
                    <div>
                        <dt>Sección</dt>
                        <dd>{section.title}</dd>
                    </div>
                    <div>
                        <dt>Conocimientos disponibles</dt>
                        <dd>
                            {lesson.accumulatedKnowledge.length}
                        </dd>
                    </div>
                    <div>
                        <dt>Paga potencial</dt>
                        <dd>
                            {formatMoney(
                                lesson.baseReward
                            )}
                        </dd>
                    </div>
                    {model.completed && (
                        <div>
                            <dt>Paga obtenida</dt>
                            <dd>
                                {formatMoney(
                                    model.earnedReward
                                )}
                                {model.bestScore != null && (
                                    <small>
                                        mejor nota {model.bestScore}/100
                                    </small>
                                )}
                            </dd>
                        </div>
                    )}
                </dl>
            </article>

            {lesson.problemStatement && (
                <section className="broker95-learning-problem">
                    <header>
                        <span aria-hidden="true">?</span>
                        <div>
                            <small>PROBLEMA ANTES DEL ALGORITMO</small>
                            <h3>Detente y razona</h3>
                        </div>
                    </header>
                    <p>{lesson.problemStatement}</p>
                </section>
            )}

            <div className="broker95-learning-lesson-grid">
                <div className="broker95-learning-content">
                    {lesson.concepts.length > 0 && (
                        <LearningKnowledgeCard
                            title="CONCEPTOS CLAVE"
                            items={lesson.concepts}
                            main
                        />
                    )}
                    <LearningContentSection
                        eyebrow="CONCEPTO"
                        title="Comprender antes de programar"
                        blocks={lesson.explanation}
                    />

                    {lesson.formulas.length > 0 && (
                        <section className="broker95-learning-content-section broker95-learning-formulas">
                            <header>
                                <span>MODELO MATEMÁTICO</span>
                                <h3>Fórmulas para razonar</h3>
                            </header>
                            <div className="broker95-learning-formula-list">
                                {lesson.formulas.map(
                                    formula => (
                                        <Broker95LearningFormula
                                            key={formula.id}
                                            formula={formula}
                                        />
                                    )
                                )}
                            </div>
                        </section>
                    )}

                    <section className="broker95-learning-content-section">
                        <header>
                            <span>REPRESENTACIÓN</span>
                            <h3>Modelos y ejemplos en CLRS</h3>
                        </header>
                        <div className="broker95-learning-examples">
                            {lesson.examples.map(
                                example => (
                                    <LearningExample
                                        key={example.id}
                                        example={example}
                                    />
                                )
                            )}
                        </div>
                    </section>

                    {lesson.comparativeNotes.length > 0 && (
                        <LearningContentSection
                            eyebrow="TRANSFERENCIA"
                            title="Más allá de CLRS"
                            blocks={
                                lesson.comparativeNotes
                            }
                            comparative
                        />
                    )}
                </div>

                <aside className="broker95-learning-sidebar">
                    <LearningKnowledgeCard
                        title="NUEVO EN ESTA LECCIÓN"
                        items={
                            lesson.introducedKnowledge
                        }
                        emphasized
                    />
                    <LearningKnowledgeCard
                        title="CONOCIMIENTOS ACUMULADOS"
                        items={
                            lesson.accumulatedKnowledge
                        }
                        collapsible
                    />

                    {lesson.expectedContract && (
                        <section className="broker95-learning-expected-contract">
                            <span>CONTRATO ESPERADO</span>
                            <h3>Práctica de la lección</h3>
                            <p>{lesson.expectedContract}</p>
                        </section>
                    )}

                    {lesson.recommendedTools.length > 0 && (
                        <LearningToolsCard
                            toolIds={
                                lesson.recommendedTools
                            }
                        />
                    )}

                    <section className="broker95-learning-contract-action">
                        {model.completed && (
                            <strong>
                                LECCIÓN COMPLETADA
                            </strong>
                        )}
                        <span>PRÁCTICA</span>
                        <h3>
                            {model.action ===
                                Broker95LearningLessonAction.REPEAT
                                ? "Reforzar el concepto"
                                : "Aplicar lo aprendido"}
                        </h3>
                        <p id="broker95-learning-practice-description">
                            CIPHER generará un ejercicio sencillo que sólo utilizará los conocimientos disponibles hasta esta lección.
                        </p>
                        {(!providerExperience.configured || providerExperience.tone === "warning") && (
                            <div className="broker95-learning-provider-help">
                                <p>{providerExperience.message}</p>
                                <p>Puedes continuar leyendo esta lección. Para pedir un ejercicio a CIPHER, revisa su configuración.</p>
                                <button type="button" onClick={onConfigure}>CONFIGURAR CIPHER</button>
                            </div>
                        )}
                        {model.contractLinked && (
                            <div className="broker95-learning-contract-linked">
                                <span>
                                    CONTRATO #{model.activeContractId}
                                </span>
                                <code>
                                    ai -read {model.activeContractId}
                                </code>
                                <code>
                                    ai -set {model.activeContractId}
                                </code>
                            </div>
                        )}
                        <button
                            type="button"
                            disabled={
                                model.actionDisabled ||
                                operationBusy ||
                                !providerExperience.configured
                            }
                            aria-busy={
                                generating ||
                                requestPending
                            }
                            aria-describedby="broker95-learning-practice-description"
                            onClick={obtainContract}
                        >
                            {model.actionLabel}
                        </button>
                    </section>
                </aside>
            </div>

            {model.notice && (
                <aside
                    className="broker95-learning-contract-notice"
                    role="status"
                    aria-live="polite"
                    aria-labelledby="broker95-learning-contract-notice-title"
                >
                    <button
                        type="button"
                        className="broker95-learning-notice-close"
                        aria-label="Cerrar notificación de contrato"
                        onClick={onDismissNotice}
                    >
                        ×
                    </button>
                    <span>NUEVO CONTRATO</span>
                    <h3 id="broker95-learning-contract-notice-title">
                        #{model.notice.contractId} · {model.notice.title}
                    </h3>
                    <p>
                        Broker.95 generó un ejercicio basado en esta lección.
                    </p>
                    <dl className="broker95-learning-notice-context">
                        <div>
                            <dt>Ruta</dt>
                            <dd>{model.notice.routeTitle}</dd>
                        </div>
                        <div>
                            <dt>Lección</dt>
                            <dd>
                                {model.notice.lessonOrder} · {model.notice.lessonTitle}
                            </dd>
                        </div>
                    </dl>
                    <span>SIGUIENTE PASO</span>
                    <code>
                        ai -set {model.notice.contractId}
                    </code>
                    <button
                        type="button"
                        onClick={onGoTerminal}
                    >
                        IR A TERMINAL
                    </button>
                </aside>
            )}
        </section>
    );
}

const LearningContentSection = memo(function LearningContentSection({
    eyebrow,
    title,
    blocks,
    comparative = false
}) {
    return (
        <section className={
            `broker95-learning-content-section${comparative ? " comparative" : ""}`
        }>
            <header>
                <span>{eyebrow}</span>
                <h3>{title}</h3>
            </header>
            {blocks.map((block, index) => (
                <LearningContentBlock
                    key={`${block.kind}:${index}`}
                    block={block}
                />
            ))}
        </section>
    );
});

const LearningContentBlock = memo(function LearningContentBlock({ block }) {
    if (block.kind === "paragraph") {
        return <p>{block.text}</p>;
    }

    if (block.kind === "list") {
        return (
            <ul>
                {block.items.map(item => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        );
    }

    return (
        <aside className="broker95-learning-callout">
            {block.title && (
                <strong>{block.title}</strong>
            )}
            <p>{
                formatBroker95LearningCalloutText(
                    block.text
                )
            }</p>
        </aside>
    );
});

const LearningExample = memo(function LearningExample({ example }) {
    return (
        <article className="broker95-learning-example">
            <header>
                <h4>{example.title ?? "Ejemplo"}</h4>
                <span>
                    {example.language === "clrs"
                        ? "CLRS"
                        : "MODELO"}
                </span>
            </header>
            <pre
                tabIndex={0}
                aria-label={
                    `${example.title ?? "Ejemplo"}, ${example.language === "clrs" ? "código CLRS" : "modelo conceptual"}`
                }
            ><code className={
                example.language === "clrs"
                    ? "language-clrs"
                    : undefined
            }>{example.content}</code></pre>
            {example.explanation && (
                <p>{example.explanation}</p>
            )}
        </article>
    );
});

const LearningKnowledgeCard = memo(function LearningKnowledgeCard({
    title,
    items,
    emphasized = false,
    collapsible = false,
    main = false
}) {
    const content = (
        <ul>
            {items.map(item => (
                <li key={item}>{item}</li>
            ))}
        </ul>
    );

    if (collapsible) {
        return (
            <details className="broker95-learning-knowledge accumulated">
                <summary aria-label={`${title}, ${items.length} elementos`}>
                    {title}
                    <b aria-hidden="true">{items.length}</b>
                </summary>
                {content}
            </details>
        );
    }

    return (
        <section className={
            `broker95-learning-knowledge${emphasized ? " emphasized" : ""}${main ? " main" : ""}`
        }>
            <h3>{title}</h3>
            {content}
        </section>
    );
});

const LearningToolsCard = memo(function LearningToolsCard({
    toolIds
}) {
    const tools = toolIds
        .map(toolId => ({
            id: toolId,
            descriptor:
                getBroker95LearningToolDescriptor(
                    toolId
                )
        }))
        .filter(tool => tool.descriptor != null);

    if (tools.length === 0) {
        return null;
    }

    return (
        <section className="broker95-learning-tools">
            <header>
                <span>SUGERENCIA DE EXPLORACIÓN</span>
                <b>OPCIONAL</b>
            </header>
            <p>
                Analiza primero por tu cuenta. Después puedes usar estas herramientas para contrastar tu razonamiento.
            </p>
            <ul>
                {tools.map(({ id, descriptor }) => (
                    <li key={id}>
                        <strong>{descriptor.name}</strong>
                        <small>{descriptor.purpose}</small>
                    </li>
                ))}
            </ul>
            <em>
                Estas herramientas no son requisitos del contrato ni afectan la evaluación.
            </em>
        </section>
    );
});

function learningStatusLabel(status) {
    return {
        locked: "BLOQUEADA",
        available: "ESTÁS AQUÍ",
        completed: "COMPLETADA"
    }[status] ?? "BLOQUEADA";
}

function ContractPanel({ gameState }) {
    const contracts = gameState?.contracts ?? [];
    const activeContract = contracts.find(
        contract =>
            contract.id ===
            gameState?.activeContractId
    ) ?? null;
    const pendingContracts = contracts
        .filter(contract =>
            contract.state === "pending"
        )
        .sort((left, right) =>
            right.createdOrder -
            left.createdOrder
        );
    const recentContracts = contracts
        .filter(contract =>
            contract.state === "completed" ||
            contract.state === "failed"
        )
        .sort((left, right) =>
            right.createdOrder -
            left.createdOrder
        )
        .slice(0, 6);

    if (
        !activeContract &&
        pendingContracts.length === 0 &&
        recentContracts.length === 0
    ) {
        return (
            <EmptyPanel
                eyebrow="MESA DE CONTRATOS"
                title="Sin operaciones registradas"
                text="Solicita contratos desde la terminal con ai -new. La terminal conserva el control del ciclo de juego."
            />
        );
    }

    return (
        <section className="broker95-contract-panel">
            <header className="broker95-panel-header">
                <div>
                    <span>MESA DE OPERACIONES</span>
                    <h2>Contratos</h2>
                </div>
                <span className="broker95-contract-count">
                    {activeContract
                        ? `ACTIVO #${activeContract.id}`
                        : `${pendingContracts.length} PENDIENTES`}
                </span>
            </header>

            {activeContract ? (
                <ActiveContractCard
                    contract={activeContract}
                />
            ) : (
                <p className="broker95-contract-note">
                    No hay un contrato activo. Selecciona uno desde la terminal con <code>ai -set &lt;id&gt;</code>.
                </p>
            )}

            {pendingContracts.length > 0 && (
                <ContractCollection
                    title="Bandeja pendiente"
                    contracts={pendingContracts}
                />
            )}

            {recentContracts.length > 0 && (
                <ContractCollection
                    title="Resultados recientes"
                    contracts={recentContracts}
                    recent
                />
            )}
        </section>
    );
}

function ActiveContractCard({ contract }) {
    return (
        <article className="broker95-active-contract">
            <header>
                <div>
                    <span>
                        CONTRATO #{contract.id}
                    </span>
                    <h3>{contract.title}</h3>
                </div>
                <span className={
                    `broker95-risk ${contract.risk}`
                }>
                    {RISK_LABELS[contract.risk]}
                </span>
            </header>

            <div className="broker95-contract-meta">
                <Metric
                    label="Cliente"
                    value={contract.client}
                />
                <Metric
                    label="Familia"
                    value={contract.familyName}
                />
                <Metric
                    label="Paga potencial"
                    value={formatMoney(
                        contract.payPotential
                    )}
                />
            </div>

            <section>
                <h4>Objetivo</h4>
                <p>{contract.description}</p>
            </section>
            <section>
                <h4>Requisitos</h4>
                <ol>
                    {contract.requirements.map(
                        (requirement, index) => (
                            <li key={
                                `${index}:${requirement}`
                            }>
                                {requirement}
                            </li>
                        )
                    )}
                </ol>
            </section>
            <section className="broker95-contract-tests">
                <header>
                    <h4>Casos de prueba</h4>
                    <span>
                        {contract.testCases?.length ?? 0}
                    </span>
                </header>
                <p>
                    El programa debe superar todos los casos para completar la evidencia funcional.
                </p>
                {contract.testCases?.length > 0 ? (
                    <div className="broker95-test-case-grid">
                        {contract.testCases.map(
                            testCase => (
                                <article
                                    key={testCase.id}
                                    className="broker95-test-case"
                                >
                                    <header>
                                        <strong>
                                            [{testCase.id}]
                                        </strong>
                                        <span>
                                            {testCaseKindLabel(
                                                testCase.kind
                                            )}
                                        </span>
                                    </header>
                                    <p>
                                        {testCase.explanation}
                                    </p>
                                    <dl>
                                        <TestCaseDatum
                                            label="Entrada"
                                            value={formatTestCaseData(
                                                testCase.stdin
                                            )}
                                            code
                                        />
                                        <TestCaseDatum
                                            label="Salida esperada"
                                            value={formatTestCaseData(
                                                testCase.expected
                                            )}
                                            code
                                        />
                                        <TestCaseDatum
                                            label="Comparador"
                                            value={testComparisonLabel(
                                                testCase.comparison
                                            )}
                                        />
                                        <TestCaseDatum
                                            label="Requisitos"
                                            value={
                                                testCase.requirementIds
                                                    .join(", ")
                                            }
                                        />
                                        <TestCaseDatum
                                            label="Tiempo máximo"
                                            value={
                                                String(
                                                    testCase.timeoutMs
                                                ) + " ms"
                                            }
                                        />
                                    </dl>
                                </article>
                            )
                        )}
                    </div>
                ) : (
                    <p className="broker95-contract-tests-empty">
                        Este contrato no contiene casos declarativos disponibles.
                    </p>
                )}
            </section>
        </article>
    );
}

function TestCaseDatum({
    label,
    value,
    code = false
}) {
    return (
        <div>
            <dt>{label}</dt>
            <dd>
                {code
                    ? <code>{value}</code>
                    : value}
            </dd>
        </div>
    );
}

function formatTestCaseData(value) {
    return JSON.stringify(value ?? "");
}

function testCaseKindLabel(kind) {
    return {
        normal: "NORMAL",
        boundary: "CASO LÍMITE",
        invalid: "ENTRADA INVÁLIDA"
    }[kind] ?? String(kind).toUpperCase();
}

function testComparisonLabel(comparison) {
    return {
        exact: "TEXTO EXACTO",
        trimmed: "SIN ESPACIOS EXTERIORES",
        "normalized-whitespace":
            "ESPACIOS NORMALIZADOS",
        lines: "LÍNEAS EN ORDEN",
        "unordered-lines":
            "LÍNEAS SIN ORDEN",
        number: "NÚMERO",
        "number-tolerance":
            "NÚMERO CON TOLERANCIA",
        json: "JSON",
        "array-ordered":
            "ARREGLO EN ORDEN",
        "array-unordered":
            "ARREGLO SIN ORDEN",
        boolean: "VALOR LÓGICO",
        contains: "CONTIENE TEXTO",
        "regex-safe": "PATRÓN SEGURO"
    }[comparison] ??
        String(comparison).toUpperCase();
}

function ContractCollection({
    title,
    contracts,
    recent = false
}) {
    return (
        <section className="broker95-contract-collection">
            <div>
                <h3>{title}</h3>
                <span>{contracts.length}</span>
            </div>
            <div className="broker95-contract-grid">
                {contracts.map(contract => (
                    <article key={contract.id}>
                        <header>
                            <span>#{contract.id}</span>
                            <b className={
                                `broker95-contract-state ${contract.state}`
                            }>
                                {contractStateLabel(
                                    contract.state
                                )}
                            </b>
                        </header>
                        <h4>{contract.title}</h4>
                        <p>
                            {contract.categoryName}
                        </p>
                        <footer>
                            <span className={
                                `broker95-risk ${contract.risk}`
                            }>
                                {RISK_LABELS[
                                    contract.risk
                                ]}
                            </span>
                            <dl className="broker95-contract-payment">
                                <div>
                                    <dt>Potencial</dt>
                                    <dd>
                                        {formatMoney(
                                            contract.payPotential
                                        )}
                                    </dd>
                                </div>
                                {recent && (
                                    <div>
                                        <dt>Final</dt>
                                        <dd>
                                            {formatMoney(
                                                contract.payout
                                            )}
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        </footer>
                    </article>
                ))}
            </div>
        </section>
    );
}

function contractStateLabel(state) {
    return {
        pending: "PENDIENTE",
        completed: "COMPLETADO",
        failed: "FALLIDO"
    }[state] ?? "REGISTRADO";
}

function StatisticsPanel({ gameState }) {
    const statistics =
        gameState?.statisticsView;

    if (!statistics) {
        return (
            <EmptyPanel
                eyebrow="PERFIL LOCAL"
                title="Sin datos disponibles"
                text="El Host está restaurando las estadísticas persistentes."
            />
        );
    }

    return (
        <section className="broker95-statistics-panel">
            <header className="broker95-panel-header">
                <div>
                    <span>
                        {statistics.summary.gameOver
                            ? "EXPEDIENTE FINAL"
                            : "EXPEDIENTE ACUMULATIVO"}
                    </span>
                    <h2>Estadísticas</h2>
                </div>
                <span className={
                    `broker95-stat-status ${
                        statistics.summary.gameOver
                            ? "final"
                            : "active"
                    }`
                }>
                    {statistics.summary.gameOver
                        ? "GAME OVER"
                        : "PARTIDA ACTIVA"}
                </span>
            </header>

            <div className="broker95-stat-grid">
                <Metric
                    label="Completados"
                    value={
                        statistics.summary
                            .completed
                    }
                />
                <Metric
                    label="Fallidos"
                    value={
                        statistics.summary.failed
                    }
                />
                <Metric
                    label="Tasa de éxito"
                    value={`${
                        statistics.summary
                            .successRate
                    }%`}
                />
                <Metric
                    label="Ganancia histórica"
                    value={formatMoney(
                        statistics.summary
                            .totalEarned
                    )}
                />
                <Metric
                    label="Saldo actual"
                    value={formatMoney(
                        statistics.summary
                            .currentMoney
                    )}
                />
                <Metric
                    label="Alerta"
                    value={
                        statistics.summary.gameOver
                            ? "11 — GAME OVER"
                            : `${statistics.summary.alertLevel}/${statistics.summary.alertLimit}`
                    }
                />
            </div>

            <div className="broker95-stat-sections">
                {statistics.learningRoutes?.length > 0 && (
                    <section className="broker95-learning-statistics">
                        <h3>Rutas de aprendizaje</h3>
                        {statistics.learningRoutes.map(
                            route => (
                                <div
                                    className="broker95-stat-row broker95-learning-stat-row"
                                    key={route.routeId}
                                >
                                    <span>{route.label}</span>
                                    <div
                                        className="broker95-stat-bar"
                                        role="progressbar"
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={
                                            route.progressPercent
                                        }
                                        aria-label={
                                            `${route.label}: ${route.progressPercent}% completado`
                                        }
                                    >
                                        <i style={{
                                            width:
                                                `${route.progressPercent}%`
                                        }} />
                                    </div>
                                    <strong>
                                        {route.completedLessons}/{route.totalLessons}
                                        <small>
                                            {formatMoney(
                                                route.totalPayout
                                            )} ganado
                                        </small>
                                    </strong>
                                </div>
                            )
                        )}
                    </section>
                )}

                <section>
                    <h3>Contratos por riesgo</h3>
                    {statistics.risks.map(
                        bucket => (
                        <div
                            className="broker95-stat-row"
                            key={bucket.risk}
                        >
                            <span>{bucket.label}</span>
                            <div
                                className="broker95-stat-bar"
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={
                                    bucket.distributionPercent
                                }
                                aria-label={
                                    `${bucket.distributionPercent}% de contratos de riesgo ${bucket.label}`
                                }
                            >
                                <i style={{
                                    width:
                                        `${bucket.distributionPercent}%`
                                }} />
                            </div>
                            <strong>
                                {bucket.total}
                                <small>
                                    {bucket.completed} aprobados · {bucket.failed} fallidos
                                </small>
                            </strong>
                        </div>
                    ))}
                </section>

                <section>
                    <h3>Perfil técnico</h3>
                    {statistics.technicalProfile
                        .map(bucket => (
                            <div
                                className="broker95-profile-row"
                                key={bucket.criterion}
                            >
                                <span>
                                    {bucket.label}
                                </span>
                                <div
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={
                                        bucket.score
                                    }
                                    aria-label={
                                        `${bucket.label}: ${bucket.score} de 100`
                                    }
                                >
                                    <i style={{
                                        width:
                                            `${bucket.score}%`
                                    }} />
                                </div>
                                <strong>
                                    {bucket.sampleCount === 0
                                        ? "—"
                                        : `${bucket.score}/100`}
                                    <small>
                                        {formatSamples(
                                            bucket.sampleCount
                                        )}
                                    </small>
                                </strong>
                            </div>
                        ))}
                </section>

                <section className="broker95-specialties">
                    <div className="broker95-specialties-heading">
                        <div>
                            <h3>Especialidades</h3>
                            <p>
                                La cobertura cuenta categorías completadas al menos una vez dentro de cada familia.
                            </p>
                        </div>
                        <span>
                            {statistics.families.length} FAMILIAS
                        </span>
                    </div>
                    <div className="broker95-specialty-grid">
                        {statistics.families.map(
                            family => (
                                <article
                                    className="broker95-specialty-row"
                                    key={family.familyId}
                                >
                                    <div>
                                        <strong>
                                            {family.familyName}
                                        </strong>
                                        <small>
                                            {family.completed} completados · {family.failed} fallidos
                                        </small>
                                    </div>
                                    <div
                                        className="broker95-specialty-bar"
                                        role="progressbar"
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={
                                            family.coveragePercent
                                        }
                                        aria-label={
                                            `${family.coveragePercent}% de cobertura en ${family.familyName}`
                                        }
                                    >
                                        <i style={{
                                            width:
                                                `${family.coveragePercent}%`
                                        }} />
                                    </div>
                                    <span>
                                        {family.completedCategories}/{family.categoryCount}
                                        <small>
                                            {family.coveragePercent}%
                                        </small>
                                    </span>
                                </article>
                            )
                        )}
                    </div>
                </section>
            </div>
        </section>
    );
}

function formatSamples(value) {
    return value === 1
        ? "1 contrato"
        : `${value} contratos`;
}

function EconomyPanel({ state, bridge }) {
    const game = state.gameState;
    const economy = game?.economy;
    const busy = state.operation.status ===
        "busy";

    if (!game || !economy) {
        return (
            <EmptyPanel
                eyebrow="ECONOMÍA LOCAL"
                title="Sin datos disponibles"
                text="El Host está restaurando el estado económico persistente."
            />
        );
    }

    return (
        <section className="broker95-economy-panel">
            <header className="broker95-panel-header">
                <div>
                    <span>CONTROL DE EXPOSICIÓN</span>
                    <h2>Economía y alerta</h2>
                </div>
                <span className={
                    `broker95-economy-status ${
                        game.gameOver
                            ? "critical"
                            : "active"
                    }`
                }>
                    {game.gameOver
                        ? "PARTIDA TERMINADA"
                        : "SISTEMA OPERATIVO"}
                </span>
            </header>

            <div className="broker95-economy-summary">
                <Metric
                    label="Saldo disponible"
                    value={formatMoney(game.money)}
                />
                <Metric
                    label="Nivel de alerta"
                    value={game.gameOver
                        ? "11 — GAME OVER"
                        : `${game.alertLevel}/${economy.alertLimit}`}
                />
            </div>

            {game.gameOver && (
                <div
                    className="broker95-game-over-notice"
                    role="alert"
                >
                    <strong>EXPOSICIÓN TOTAL</strong>
                    <p>
                        Las compras están bloqueadas porque la partida ha terminado.
                    </p>
                </div>
            )}

            {!game.gameOver &&
                game.alertLevel === 0 && (
                <p className="broker95-economy-note">
                    No hay alerta que reducir. Las contramedidas se habilitarán cuando el nivel sea mayor que cero.
                </p>
            )}

            <div className="broker95-countermeasure-grid">
                {economy.countermeasures.map(
                    countermeasure => (
                        <article
                            className="broker95-countermeasure"
                            key={countermeasure.id}
                        >
                            <div>
                                <span>
                                    {countermeasure.reset
                                        ? "REINICIO TOTAL"
                                        : `REDUCCIÓN −${countermeasure.reduction}`}
                                </span>
                                <h3>
                                    {countermeasure.name}
                                </h3>
                            </div>
                            <strong>
                                {formatMoney(
                                    countermeasure.price
                                )}
                            </strong>
                            <p id={
                                `broker95-countermeasure-${countermeasure.id}`
                            }>
                                {countermeasure.reset
                                    ? "Restablece inmediatamente la alerta a cero."
                                    : `Reduce inmediatamente ${countermeasure.reduction} ${countermeasure.reduction === 1 ? "nivel" : "niveles"} de alerta.`}
                            </p>
                            <button
                                type="button"
                                disabled={
                                    busy ||
                                    !countermeasure
                                        .available
                                }
                                aria-describedby={
                                    `broker95-countermeasure-${countermeasure.id}`
                                }
                                aria-label={
                                    countermeasure.available
                                        ? `Comprar ${countermeasure.name} por ${formatMoney(countermeasure.price)}`
                                        : `${countermeasure.name}: ${countermeasureUnavailableText(countermeasure.unavailableReason)}`
                                }
                                title={
                                    countermeasure
                                        .available
                                        ? `Comprar ${countermeasure.name}`
                                        : countermeasureUnavailableText(
                                            countermeasure
                                                .unavailableReason
                                        )
                                }
                                onClick={() =>
                                    bridge
                                        .purchaseCountermeasure(
                                            countermeasure.id
                                        )
                                }
                            >
                                {countermeasure.available
                                    ? "COMPRAR"
                                    : countermeasureUnavailableText(
                                        countermeasure
                                            .unavailableReason
                                    )}
                            </button>
                        </article>
                    )
                )}
            </div>

            <p className="broker95-economy-footnote">
                El costo y la reducción se aplican de forma inmediata y persistente en el Extension Host.
            </p>
        </section>
    );
}

function countermeasureUnavailableText(reason) {
    return {
        game_over: "BLOQUEADA",
        alert_zero: "ALERTA EN CERO",
        insufficient_funds: "SALDO INSUFICIENTE"
    }[reason] ?? "NO DISPONIBLE";
}

function SettingsPanel({
    state,
    bridge,
    audioEngine
}) {
    const [model, setModel] = useState(
        state.settings.model
    );
    const [baseUrl, setBaseUrl] = useState(
        state.settings.baseUrl ?? ""
    );
    const [apiKey, setApiKey] = useState("");
    const [audio, setAudio] = useState(
        state.settings.audio
    );
    const [confirmHistoryClear,
        setConfirmHistoryClear] = useState(false);
    const [confirmProgressReset,
        setConfirmProgressReset] = useState(false);
    const trackedCategoryCount = Object.keys(
        state.gameState?.categoryHistory ?? {}
    ).length;
    const experience = createBroker95ProviderExperience(state);
    const busy = experience.busy || state.connection !== "ready";
    const providers =
        state.settings.providers ?? [];
    const selectedProvider = providers.find(
        provider =>
            provider.id ===
                state.settings.providerId
    );
    const credentialKind =
        state.settings.credential?.kind ??
        "api-key";
    const credentialSupported =
        credentialKind !== "none";
    const credentialOptional =
        credentialKind === "optional-api-key";
    const credentialConfigured =
        state.settings.credential?.configured ??
        false;
    const localEndpoint =
        selectedProvider?.endpointKind ===
        "local";
    const lmStudioSelected =
        selectedProvider?.id === "lm-studio";
    const huggingFaceSelected =
        selectedProvider?.id === "hugging-face";
    const lmStudioCatalog =
        state.lmStudioModels?.providerId ===
            "lm-studio"
            ? state.lmStudioModels
            : null;

    useEffect(
        () => setModel(state.settings.model),
        [state.settings.model, state.settings.providerId]
    );

    useEffect(() => setApiKey(""), [state.settings.providerId]);

    useEffect(
        () => setBaseUrl(
            state.settings.baseUrl ?? ""
        ),
        [state.settings.baseUrl, state.settings.providerId]
    );

    const unsavedConfiguration = model.trim() !== state.settings.model ||
        (localEndpoint && baseUrl.trim() !== (state.settings.baseUrl ?? "")) ||
        apiKey.length > 0;

    useEffect(
        () => {
            setAudio(state.settings.audio);
            audioEngine.configure(
                state.settings.audio
            );
        },
        [audioEngine, state.settings.audio]
    );

    const updateLocalAudio = next => {
        setAudio(next);
        audioEngine.configure(next);
    };
    const persistAudio = next => {
        bridge.setAudioPreferences(next);
    };
    const persistSelectedVolume = event => {
        persistAudio({
            ...audio,
            volume: Number(
                event.currentTarget.value
            )
        });
    };

    return (
        <section className="broker95-settings-panel">
            <header className="broker95-panel-header">
                <div>
                    <span>ENLACE CON CIPHER</span>
                    <h2>Configuración</h2>
                </div>
                <span className={
                    `broker95-config-state ${
                        experience.verified
                            ? "configured"
                            : experience.configured && experience.tone !== "warning"
                            ? "pending" : "missing"
                    }`
                }>
                    {experience.title}
                </span>
            </header>

            <nav className="broker95-setup-steps" aria-label="Pasos para conectar a CIPHER">
                {experience.steps.map((step, index) => (
                    <button key={step.target + index} type="button"
                        disabled={busy}
                        className={step.complete ? "complete" : "pending"}
                        aria-label={`${index + 1}. ${step.label}. ${step.complete ? "Completado" : "Pendiente"}`}
                        onClick={() => focusBroker95Configuration(step.target)}>
                        <span className="broker95-setup-step-index" aria-hidden="true">
                            {step.complete ? "✓" : index + 1}
                        </span>
                        <span className="broker95-setup-step-label">
                            {step.label}
                        </span>
                    </button>
                ))}
            </nav>

            <div className="broker95-settings-form">
                <label htmlFor="broker95-provider">
                    Proveedor de CIPHER
                </label>
                <div>
                    <select
                        id="broker95-provider"
                        value={state.settings.providerId}
                        disabled={busy}
                        onChange={event => {
                            setApiKey("");
                            bridge.setProvider(
                                event.target.value
                            );
                        }}
                    >
                        {experience.groups.map(group => (
                            <optgroup key={group.label} label={group.label}>
                            {group.providers.map(provider => (
                            <option
                                key={provider.id}
                                value={provider.id}
                            >
                                {provider.label}
                            </option>
                            ))}
                            </optgroup>
                        ))}
                    </select>
                </div>
                <small>
                    Cada proveedor conserva su modelo y credencial. Cambiar de proveedor no reinicia tu partida ni las lecciones.
                </small>
            </div>

            <aside className="broker95-provider-guide" aria-labelledby="broker95-provider-guide-title">
                <strong id="broker95-provider-guide-title">{experience.endpointLabel}</strong>
                <p>{experience.dataHint}</p>
                <p>El proveedor ejecuta el modelo de IA; el modelo es quien genera las respuestas de CIPHER. Para contratos y evaluaciones, elige uno que admita JSON y siga instrucciones en español.</p>
            </aside>

            {localEndpoint && (
                <form
                    className="broker95-settings-form"
                    aria-busy={busy}
                    onSubmit={event => {
                        event.preventDefault();

                        if (
                            busy ||
                            baseUrl.length === 0
                        ) {
                            return;
                        }

                        bridge.setBaseUrl(baseUrl);
                    }}
                >
                    <label htmlFor="broker95-base-url">
                        URL del servidor local
                    </label>
                    <div>
                        <input
                            id="broker95-base-url"
                            disabled={busy}
                            aria-describedby="broker95-base-url-help"
                            type="url"
                            value={baseUrl}
                            maxLength={2048}
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="http://127.0.0.1:1234/v1"
                            onChange={event =>
                                setBaseUrl(
                                    event.target.value
                                )
                            }
                        />
                        <button
                            type="submit"
                            disabled={busy}
                        >
                            GUARDAR URL
                        </button>
                    </div>
                    <small id="broker95-base-url-help">
                        Por seguridad sólo se admiten direcciones HTTP de esta computadora: localhost, 127.0.0.1 o ::1, siempre con puerto explícito.
                    </small>
                </form>
            )}

            <form
                className="broker95-settings-form"
                aria-busy={busy}
                onSubmit={event => {
                    event.preventDefault();

                    if (busy) {
                        return;
                    }

                    bridge.setModel(model);
                }}
            >
                <label htmlFor="broker95-model">
                    {lmStudioSelected
                        ? "Modelo de LM Studio"
                        : "Identificador del modelo"}
                </label>
                <div>
                    <input
                        id="broker95-model"
                        disabled={busy}
                        aria-describedby="broker95-model-help"
                        list={lmStudioSelected
                            ? "broker95-lm-studio-models"
                            : undefined}
                        value={model}
                        maxLength={256}
                        autoComplete="off"
                        placeholder="Identificador exacto del modelo"
                        onChange={event =>
                            setModel(
                                event.target.value
                            )
                        }
                    />
                    {lmStudioSelected && (
                        <datalist id="broker95-lm-studio-models">
                            {(lmStudioCatalog?.models ?? [])
                                .map(availableModel => (
                                    <option
                                        key={availableModel}
                                        value={availableModel}
                                    />
                                ))}
                        </datalist>
                    )}
                    <button
                        type="submit"
                        disabled={busy}
                    >
                        GUARDAR MODELO
                    </button>
                </div>
                <small id="broker95-model-help">
                    {lmStudioSelected && lmStudioCatalog
                        ? lmStudioCatalog.models.length > 0
                            ? `${lmStudioCatalog.models.length} ${lmStudioCatalog.models.length === 1 ? "modelo disponible" : "modelos disponibles"}. Elige una sugerencia y guarda el modelo.`
                            : "El servidor respondió, pero no expone modelos. Descarga o carga uno en LM Studio y actualiza la lista."
                        : experience.modelHint}
                </small>
            </form>

            {lmStudioSelected && (
                <section className="broker95-lm-studio-discovery">
                    <div>
                        <span>CATÁLOGO LOCAL</span>
                        <p role="status" aria-live="polite">
                            {lmStudioCatalog
                                ? lmStudioCatalog.models.length > 0
                                    ? "LM Studio está activo y publicó sus modelos visibles."
                                    : "LM Studio está activo, sin modelos visibles para CIPHER."
                                : "Inicia el servidor de LM Studio para detectar sus modelos sin escribir el identificador manualmente."}
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                            bridge.discoverLmStudioModels()
                        }
                    >
                        {state.operation.operation ===
                            "llm/discover-lm-studio-models"
                            ? "BUSCANDO…"
                            : lmStudioCatalog
                                ? "ACTUALIZAR MODELOS"
                                : "BUSCAR MODELOS"}
                    </button>
                </section>
            )}

            {credentialSupported ? <form
                className="broker95-settings-form"
                aria-busy={busy}
                onSubmit={event => {
                    event.preventDefault();

                    if (
                        busy ||
                        apiKey.length === 0
                    ) {
                        return;
                    }

                    bridge.setApiKey(apiKey);
                    setApiKey("");
                }}
            >
                <label htmlFor="broker95-api-key">
                    {experience.credentialLabel}
                </label>
                <div>
                    <input
                        id="broker95-api-key"
                        disabled={busy}
                        aria-describedby="broker95-api-key-help"
                        type="password"
                        value={apiKey}
                        maxLength={16384}
                        autoComplete="new-password"
                        placeholder={
                            credentialConfigured
                                ? "••••••••••••••••"
                                : "Introduce una credencial"
                        }
                        onChange={event =>
                            setApiKey(
                                event.target.value
                            )
                        }
                    />
                    <button
                        type="submit"
                        disabled={busy}
                    >
                        {credentialConfigured
                            ? "ACTUALIZAR"
                            : "GUARDAR"}
                    </button>
                </div>
                <small id="broker95-api-key-help">
                    {credentialOptional
                        ? "LM Studio no requiere token de forma predeterminada. Si activaste uno en el servidor, se almacena exclusivamente en SecretStorage."
                        : huggingFaceSelected
                        ? 'Usa un token de Hugging Face con el permiso "Make calls to Inference Providers". Se guarda de forma segura para este proveedor.'
                        : "La clave se envía al Extension Host y se almacena exclusivamente en SecretStorage."}
                </small>
            </form> : (
                <div className="broker95-settings-form">
                    <label>Credencial</label>
                    <small>
                        {selectedProvider?.id === "ollama"
                            ? "Ollama se ejecuta localmente: inicia su servicio, descarga el modelo con ollama pull e introduce arriba su nombre exacto."
                            : "Este proveedor no necesita una API key."}
                    </small>
                </div>
            )}

            {credentialSupported && (
            <div className="broker95-settings-actions">
                <button
                    type="button"
                    disabled={
                        busy ||
                        !credentialConfigured
                    }
                    onClick={() =>
                        bridge.deleteApiKey()
                    }
                >
                    {credentialOptional || huggingFaceSelected
                        ? "ELIMINAR TOKEN"
                        : "ELIMINAR API KEY"}
                </button>
                <p>
                    BROKER.95 nunca muestra, registra ni devuelve la credencial guardada.
                </p>
            </div>
            )}

            <section className={`broker95-connection-test ${experience.tone}`} aria-busy={experience.testing}>
                <div>
                    <span>DIAGNÓSTICO DEL ENLACE</span>
                    <strong>
                        {selectedProvider?.label ??
                            state.settings.providerId}
                    </strong>
                    <p
                        role="status"
                        aria-live="polite"
                    >
                        {experience.message}
                    </p>
                    <small id="broker95-test-help">{unsavedConfiguration
                        ? "Guarda los cambios del modelo, la URL o la credencial antes de probar la conexión."
                        : experience.testHint}</small>
                </div>
                <button
                    id="broker95-connection-button"
                    type="button"
                    aria-describedby="broker95-test-help"
                    disabled={!experience.canTest || unsavedConfiguration}
                    onClick={() =>
                        bridge.testLlmConnection()
                    }
                >
                    {state.operation.operation ===
                        "llm/test-connection"
                        ? "COMPROBANDO…"
                        : "PROBAR CONEXIÓN"}
                </button>
            </section>

            <aside className="broker95-educational-help" aria-labelledby="broker95-educational-help-title">
                <h3 id="broker95-educational-help-title">Aprender con CIPHER</h3>
                <p>CIPHER es tu asistente de IA: puede darte pistas, responder preguntas y ayudarte a comprender tus resultados.</p>
                <p>La IA puede equivocarse. Comprueba siempre tu solución ejecutando el código y utilizando las herramientas de pruebas, depuración, análisis y visualización.</p>
                <p>Las reglas y el progreso del juego siguen siendo controlados por la extensión. Cambiar de modelo puede cambiar la calidad de las pistas, pero no esas reglas.</p>
            </aside>

            <section className="broker95-audio-settings">
                <header>
                    <div>
                        <span>SISTEMA SONORO</span>
                        <h3>Audio sintetizado</h3>
                    </div>
                    <b>
                        {audio.muted ||
                        audio.volume === 0
                            ? "SILENCIADO"
                            : "ACTIVO"}
                    </b>
                </header>

                <div className="broker95-audio-controls">
                    <button
                        type="button"
                        className="broker95-audio-toggle"
                        aria-pressed={audio.muted}
                        aria-label={
                            audio.muted
                                ? "Activar sonidos de BROKER.95"
                                : "Silenciar sonidos de BROKER.95"
                        }
                        onClick={() => {
                            const next = {
                                ...audio,
                                muted: !audio.muted
                            };

                            updateLocalAudio(next);
                            persistAudio(next);

                            if (!next.muted) {
                                void audioEngine
                                    .playFromGesture(
                                        Broker95SoundEffect
                                            .DIGITAL_CONFIRMATION,
                                        { force: true }
                                    );
                            }
                        }}
                    >
                        {audio.muted
                            ? "ACTIVAR SONIDO"
                            : "SILENCIAR"}
                    </button>

                    <label htmlFor="broker95-volume">
                        Volumen
                    </label>
                    <input
                        id="broker95-volume"
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={audio.volume}
                        aria-valuetext={
                            `${audio.volume} por ciento`
                        }
                        onChange={event => {
                            updateLocalAudio({
                                ...audio,
                                volume: Number(
                                    event.target.value
                                )
                            });
                        }}
                        onPointerUp={
                            persistSelectedVolume
                        }
                        onKeyUp={
                            persistSelectedVolume
                        }
                        onBlur={
                            persistSelectedVolume
                        }
                    />
                    <output htmlFor="broker95-volume">
                        {audio.volume}%
                    </output>

                    <button
                        type="button"
                        className="broker95-audio-test"
                        disabled={
                            audio.muted ||
                            audio.volume === 0
                        }
                        onClick={() => {
                            void audioEngine
                                .playFromGesture(
                                    Broker95SoundEffect
                                        .CIPHER_SIGNAL,
                                    { force: true }
                                );
                        }}
                    >
                        PROBAR SEÑAL
                    </button>
                </div>
                <small>
                    Ocho señales retro se generan localmente en el Webview. No se descargan archivos de audio ni se envía información fuera de VS Code.
                </small>
            </section>

            <section className="broker95-local-data">
                <header>
                    <div>
                        <span>PERSISTENCIA GLOBAL</span>
                        <h3>Datos locales</h3>
                    </div>
                    <b>
                        {trackedCategoryCount} CATEGORÍAS
                    </b>
                </header>
                <p>
                    La partida pertenece a este perfil de VS Code. Puedes reiniciar por separado el progreso de la partida o el historial usado para variar categorías.
                </p>

                <div className="broker95-local-data-actions">
                    {!confirmHistoryClear ? (
                        <button
                            type="button"
                            className="warning"
                            disabled={
                                busy ||
                                trackedCategoryCount === 0
                            }
                            onClick={() => {
                                setConfirmProgressReset(
                                    false
                                );
                                setConfirmHistoryClear(
                                    true
                                );
                            }}
                        >
                            LIMPIAR HISTORIAL DE CATEGORÍAS
                        </button>
                    ) : (
                        <div
                            className="broker95-confirm-action"
                            role="alert"
                        >
                            <span>
                                Se borrará únicamente la memoria de selección adaptativa. La partida, contratos, saldo, alerta y estadísticas se conservarán.
                            </span>
                            <button
                                type="button"
                                className="danger"
                                disabled={busy}
                                onClick={() => {
                                    bridge
                                        .clearCategoryHistory();
                                    setConfirmHistoryClear(
                                        false
                                    );
                                }}
                            >
                                CONFIRMAR LIMPIEZA
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    setConfirmHistoryClear(
                                        false
                                    )
                                }
                            >
                                CANCELAR
                            </button>
                        </div>
                    )}

                    {!confirmProgressReset ? (
                        <button
                            type="button"
                            className="danger"
                            disabled={busy}
                            onClick={() => {
                                setConfirmHistoryClear(
                                    false
                                );
                                setConfirmProgressReset(
                                    true
                                );
                            }}
                        >
                            BORRAR PROGRESO DE PARTIDA
                        </button>
                    ) : (
                        <div
                            className="broker95-confirm-action"
                            role="alert"
                        >
                            <span>
                                        Se borrarán todos los contratos, el contrato activo, el saldo, el nivel de alerta, las estadísticas, el perfil técnico y todo el progreso de Aprendizaje. La partida y ambas rutas educativas volverán a cero; Programación quedará disponible y Algoritmia volverá a estar bloqueada. El historial adaptativo de categorías y la configuración de CIPHER se conservarán.
                            </span>
                            <button
                                type="button"
                                className="danger"
                                disabled={busy}
                                onClick={() => {
                                    bridge
                                        .resetGameProgress();
                                    setConfirmProgressReset(
                                        false
                                    );
                                }}
                            >
                                CONFIRMAR BORRADO
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    setConfirmProgressReset(
                                        false
                                    )
                                }
                            >
                                CANCELAR
                            </button>
                        </div>
                    )}
                </div>
                <small>
                    El estado autoritativo continúa en el Extension Host; el Webview sólo solicita estas acciones.
                </small>
            </section>
        </section>
    );
}

function EmptyPanel({ eyebrow, title, text }) {
    return (
        <section className="broker95-empty-panel">
            <span>{eyebrow}</span>
            <div aria-hidden="true">[ ]</div>
            <h2>{title}</h2>
            <p>{text}</p>
        </section>
    );
}

function useBroker95State(store) {
    const [state, setState] = useState(
        store.getState
    );

    useEffect(
        () => store.subscribe(setState),
        [store]
    );

    return state;
}

function entryPrefix(kind) {
    return {
        user: "broker@95:~$",
        cipher: "cipher@95:~#",
        system: "system@95:~#",
        error: "error@95:~!",
        dim: "···"
    }[kind] ?? "system@95:~#";
}

function formatMoney(value) {
    return new Intl.NumberFormat(
        "es-MX",
        {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0
        }
    ).format(Number(value ?? 0));
}

function isMechanicalKeyEvent(event) {
    const tagName = event.target?.tagName
        ?.toLowerCase();
    const editable =
        tagName === "input" ||
        tagName === "textarea" ||
        event.target?.isContentEditable === true;

    if (!editable || event.ctrlKey || event.metaKey) {
        return false;
    }

    return event.key.length === 1 || [
        "Backspace",
        "Delete",
        "Enter",
        "Tab"
    ].includes(event.key);
}

function shortSession(sessionId) {
    if (!sessionId) {
        return "PENDIENTE";
    }

    return sessionId.length > 20
        ? `${sessionId.slice(0, 17)}…`
        : sessionId;
}
