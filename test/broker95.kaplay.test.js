import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
    fileURLToPath
} from "node:url";

import {
    Broker95CipherVisualState,
    createBroker95CipherSignal,
    deriveBroker95CipherVisualState
} from "../frontend/src/broker95/scene/Broker95CipherVisualState.js";
import {
    BROKER95_CIPHER_FRAME,
    BROKER95_VISUAL_ASSETS,
    Broker95KaplayScene
} from "../frontend/src/broker95/scene/Broker95KaplayScene.js";
import {
    observeBroker95SceneVisibility
} from "../frontend/src/broker95/scene/Broker95SceneVisibility.js";

test(
    "deriva el estado visual de CIPHER sin transferir autoridad a Kaplay",
    () => {
        assert.equal(
            deriveBroker95CipherVisualState({}),
            Broker95CipherVisualState.OFFLINE
        );
        assert.equal(
            deriveBroker95CipherVisualState({
                connection: "ready",
                llmStatus: { status: "ready" },
                operation: { status: "idle" },
                gameState: {
                    activeContractId: 7,
                    alertLevel: 0
                }
            }),
            Broker95CipherVisualState.ATTENTIVE
        );
        assert.equal(
            deriveBroker95CipherVisualState({
                connection: "ready",
                llmStatus: { status: "ready" },
                operation: { status: "idle" },
                gameState: {
                    activeContractId: 7,
                    alertLevel: 8
                }
            }),
            Broker95CipherVisualState.WARNING
        );
        assert.equal(
            deriveBroker95CipherVisualState({
                connection: "ready",
                llmStatus: { status: "ready" },
                operation: { status: "idle" }
            }),
            Broker95CipherVisualState.IDLE
        );
        assert.equal(
            deriveBroker95CipherVisualState({
                connection: "ready",
                llmStatus: { status: "ready" },
                operation: { status: "busy" }
            }),
            Broker95CipherVisualState.WORKING
        );
        assert.equal(
            deriveBroker95CipherVisualState({
                lastError: { code: "TEST" },
                operation: { status: "busy" }
            }),
            Broker95CipherVisualState.WARNING
        );
        assert.equal(
            deriveBroker95CipherVisualState({
                gameState: { gameOver: true },
                lastError: { code: "TEST" }
            }),
            Broker95CipherVisualState.ERROR
        );
    }
);

test(
    "monta assets locales, anima la escena y libera Kaplay una sola vez",
    async () => {
        const fake = createFakeKaplay();
        let readyCount = 0;
        const scene = new Broker95KaplayScene({
            kaplayLoader: async () => ({
                default: fake.create
            }),
            assets: {
                room: "local:room",
                rain: "local:rain",
                cipher: "local:cipher"
            },
            visualState:
                Broker95CipherVisualState.IDLE,
            onReady() {
                readyCount += 1;
            }
        });

        assert.equal(
            await scene.mount({
                getContext() {
                    return {};
                }
            }),
            true
        );
        assert.equal(fake.loaded.length, 3);
        assert.deepEqual(
            fake.loaded.map(asset => asset.url),
            [
                "local:room",
                "local:rain",
                "local:cipher"
            ]
        );
        assert.equal(
            fake.loaded[2].options.frames.length,
            9
        );
        for (
            const frame of
            fake.loaded[2].options.frames
        ) {
            assert.ok(frame.x >= 0);
            assert.ok(frame.y >= 0);
            assert.ok(frame.w > 0);
            assert.ok(frame.h > 0);
            assert.ok(frame.x + frame.w <= 1);
            assert.ok(frame.y + frame.h <= 1);
        }

        fake.finishLoading();

        assert.equal(readyCount, 1);
        assert.equal(fake.objects.length, 25);

        const cipher = fake.objects.find(
            object =>
                object.sprite ===
                "broker95-cipher"
        );
        const rain = fake.objects.find(
            object =>
                object.sprite ===
                "broker95-rain"
        );
        const rainDrops = fake.objects.filter(
            object =>
                object.sprite == null &&
                object.width <= 2 &&
                object.height >= 7 &&
                object.height <= 18
        );
        const scanLine = fake.objects.find(
            object =>
                object.width === 218 &&
                object.height === 2
        );
        const statusLed = fake.objects.find(
            object =>
                object.width === 10 &&
                object.height === 4
        );

        assert.equal(
            cipher.frame,
            BROKER95_CIPHER_FRAME.IDLE
        );
        assert.ok(scanLine);
        assert.ok(statusLed);
        assert.equal(rainDrops.length, 16);

        scene.setVisualState(
            Broker95CipherVisualState.WORKING
        );
        assert.equal(
            cipher.frame,
            BROKER95_CIPHER_FRAME.ATTENTIVE
        );

        const initialRainY = rain.pos.y;
        const initialDropPositions =
            rainDrops.map(drop => drop.pos.y);
        fake.setDelta(0.1);

        for (let tick = 0; tick < 7; tick += 1) {
            fake.update();
        }

        assert.equal(
            cipher.frame,
            BROKER95_CIPHER_FRAME.CALM
        );
        assert.notEqual(rain.pos.y, initialRainY);
        assert.equal(
            rainDrops.some((drop, index) =>
                drop.pos.y !==
                    initialDropPositions[index]
            ),
            true
        );
        assert.notEqual(scanLine.pos.y, 368);

        scene.setMotionEnabled(false);
        const pausedRainY = rain.pos.y;
        const pausedDropPositions =
            rainDrops.map(drop => drop.pos.y);
        fake.update();
        assert.equal(rain.pos.y, pausedRainY);
        assert.deepEqual(
            rainDrops.map(drop => drop.pos.y),
            pausedDropPositions
        );
        assert.equal(
            cipher.frame,
            BROKER95_CIPHER_FRAME.ATTENTIVE
        );
        assert.equal(scanLine.opacity, 0);

        scene.setVisible(false);
        assert.equal(fake.context.debug.paused, true);
        assert.equal(
            fake.configuration().maxFPS,
            0.001
        );
        assert.equal(fake.quitCount(), 0);
        scene.setVisible(true);
        assert.equal(fake.context.debug.paused, false);
        assert.equal(
            fake.configuration().maxFPS,
            20
        );

        scene.dispose();
        scene.dispose();
        assert.equal(fake.quitCount(), 1);
    }
);

test(
    "CIPHER conserva el ciclo visible de parpadeo durante el estado inactivo",
    async () => {
        const fake = createFakeKaplay();
        const scene = new Broker95KaplayScene({
            kaplayLoader: async () => ({
                default: fake.create
            }),
            assets: {
                room: "local:room",
                rain: "local:rain",
                cipher: "local:cipher"
            },
            visualState:
                Broker95CipherVisualState.IDLE
        });

        await scene.mount({ getContext() {} });
        fake.finishLoading();

        const cipher = fake.objects.find(
            object =>
                object.sprite ===
                "broker95-cipher"
        );

        fake.setDelta(0.1);

        for (let tick = 0; tick < 48; tick += 1) {
            fake.update();
        }

        assert.equal(
            cipher.frame,
            BROKER95_CIPHER_FRAME.BLINKING
        );

        fake.update();
        assert.equal(
            cipher.frame,
            BROKER95_CIPHER_FRAME.SLEEPING
        );

        fake.update();
        assert.equal(
            cipher.frame,
            BROKER95_CIPHER_FRAME.BLINKING
        );

        fake.update();
        assert.equal(
            cipher.frame,
            BROKER95_CIPHER_FRAME.IDLE
        );

        scene.dispose();
    }
);

test(
    "la lluvia ambiental cae aunque CIPHER permanezca desconectado",
    async () => {
        const fake = createFakeKaplay();
        const scene = new Broker95KaplayScene({
            kaplayLoader: async () => ({
                default: fake.create
            }),
            assets: {
                room: "local:room",
                rain: "local:rain",
                cipher: "local:cipher"
            },
            visualState:
                Broker95CipherVisualState.OFFLINE
        });

        await scene.mount({ getContext() {} });
        fake.finishLoading();

        const rain = fake.objects.filter(
            object =>
                object.sprite ===
                "broker95-rain"
        );
        const initialPositions = rain.map(
            object => object.pos.y
        );

        fake.setDelta(0.1);
        fake.update();

        assert.equal(rain.length, 4);
        assert.equal(
            rain.every((object, index) =>
                object.pos.y >
                    initialPositions[index]
            ),
            true
        );

        scene.setMotionEnabled(false);
        const pausedPositions = rain.map(
            object => object.pos.y
        );

        fake.update();
        assert.deepEqual(
            rain.map(object => object.pos.y),
            pausedPositions
        );
        scene.dispose();
    }
);

test(
    "presenta y expira se\u00f1ales de CIPHER sin alterar el estado estable",
    async () => {
        const fake = createFakeKaplay();
        const scene = new Broker95KaplayScene({
            kaplayLoader: async () => ({
                default: fake.create
            }),
            assets: {
                room: "local:room",
                rain: "local:rain",
                cipher: "local:cipher"
            },
            visualState:
                Broker95CipherVisualState.IDLE
        });

        await scene.mount({ getContext() {} });
        fake.finishLoading();

        const cipher = fake.objects.find(
            object =>
                object.sprite ===
                "broker95-cipher"
        );
        const glow = fake.objects.find(
            object => object.anchor === "center"
        );
        const success = createBroker95CipherSignal(
            1,
            Broker95CipherVisualState.SUCCESS,
            300
        );

        assert.equal(scene.playSignal(success), true);
        assert.equal(
            cipher.frame,
            BROKER95_CIPHER_FRAME.HAPPY
        );
        assert.deepEqual(
            glow.color,
            { r: 127, g: 255, b: 112 }
        );
        assert.equal(scene.playSignal(success), false);

        fake.setDelta(0.1);
        fake.update();
        fake.update();
        fake.update();

        assert.equal(
            cipher.frame,
            BROKER95_CIPHER_FRAME.IDLE
        );
        assert.deepEqual(
            glow.color,
            { r: 119, g: 255, b: 74 }
        );

        scene.setMotionEnabled(false);
        assert.equal(
            scene.playSignal(
                createBroker95CipherSignal(
                    2,
                    Broker95CipherVisualState.ATTENTIVE,
                    200
                )
            ),
            true
        );
        assert.equal(
            cipher.frame,
            BROKER95_CIPHER_FRAME.ATTENTIVE
        );

        fake.update();
        fake.update();

        assert.equal(
            cipher.frame,
            BROKER95_CIPHER_FRAME.IDLE
        );
        scene.dispose();
    }
);

test(
    "un estado cr\u00edtico estable prevalece sobre una se\u00f1al positiva",
    async () => {
        const fake = createFakeKaplay();
        const scene = new Broker95KaplayScene({
            kaplayLoader: async () => ({
                default: fake.create
            }),
            assets: {
                room: "local:room",
                rain: "local:rain",
                cipher: "local:cipher"
            },
            visualState:
                Broker95CipherVisualState.WARNING
        });

        await scene.mount({ getContext() {} });
        fake.finishLoading();
        scene.playSignal(
            createBroker95CipherSignal(
                1,
                Broker95CipherVisualState.SUCCESS
            )
        );

        const cipher = fake.objects.find(
            object =>
                object.sprite ===
                "broker95-cipher"
        );

        assert.equal(
            cipher.frame,
            BROKER95_CIPHER_FRAME.SUSPICIOUS
        );
        scene.dispose();
    }
);

test(
    "detiene la escena y reporta un error estructurado si falla un asset",
    async () => {
        const fake = createFakeKaplay();
        let reportedError = null;
        const scene = new Broker95KaplayScene({
            kaplayLoader: async () => ({
                default: fake.create
            }),
            assets: {
                room: "local:room",
                rain: "local:rain",
                cipher: "local:cipher"
            },
            onError(error) {
                reportedError = error;
            }
        });

        assert.equal(
            await scene.mount({ getContext() {} }),
            true
        );

        fake.loaded[0].errorListener(
            new Error("asset unavailable")
        );

        assert.equal(fake.context.debug.paused, true);
        assert.equal(
            reportedError?.code,
            "BROKER95_KAPLAY_ASSET_LOAD_FAILED"
        );

        fake.finishLoading();
        assert.equal(fake.objects.length, 0);
        scene.dispose();
    }
);

test(
    "una cancelación previa evita inicializar un contexto Kaplay tardío",
    async () => {
        let release;
        let createCount = 0;
        const waiting = new Promise(
            resolve => {
                release = resolve;
            }
        );
        const abortController =
            new AbortController();
        const scene = new Broker95KaplayScene({
            kaplayLoader: async () => {
                await waiting;
                return {
                    default() {
                        createCount += 1;
                    }
                };
            },
            assets: {
                room: "local:room",
                rain: "local:rain",
                cipher: "local:cipher"
            }
        });
        const mounted = scene.mount(
            { getContext() {} },
            { signal: abortController.signal }
        );

        abortController.abort();
        release();

        assert.equal(await mounted, false);
        assert.equal(createCount, 0);
        scene.dispose();
    }
);

test(
    "los tres assets visuales pertenecen al paquete local",
    () => {
        for (
            const assetUrl of
            Object.values(BROKER95_VISUAL_ASSETS)
        ) {
            const path = fileURLToPath(assetUrl);
            const stats = fs.statSync(path);

            assert.equal(stats.isFile(), true);
            assert.ok(stats.size > 100_000);
        }
    }
);

test(
    "pausa la escena fuera del viewport y libera sus observadores",
    () => {
        const element = {};
        const documentTarget =
            createVisibilityDocument();
        const intersection =
            createIntersectionObserver();
        const states = [];
        const dispose =
            observeBroker95SceneVisibility(
                element,
                visible =>
                    states.push(visible),
                {
                    documentTarget,
                    IntersectionObserverClass:
                        intersection.Class
                }
            );

        assert.deepEqual(states, [true]);
        intersection.emit({
            target: element,
            isIntersecting: false,
            intersectionRatio: 0
        });
        assert.deepEqual(states, [true, false]);

        documentTarget.visibilityState =
            "hidden";
        documentTarget.emit();
        intersection.emit({
            target: element,
            isIntersecting: true,
            intersectionRatio: 1
        });
        assert.deepEqual(states, [true, false]);

        documentTarget.visibilityState =
            "visible";
        documentTarget.emit();
        assert.deepEqual(states, [true, false, true]);

        dispose();
        dispose();
        assert.equal(
            intersection.disconnectCount(),
            1
        );
        assert.equal(
            documentTarget.listeners.size,
            0
        );
    }
);

test(
    "suspende el render por foco o inactividad y lo reactiva con actividad",
    () => {
        const element = {};
        const documentTarget =
            createVisibilityDocument();
        const focusTarget =
            createListenerTarget();
        const activityTarget =
            createListenerTarget();
        const timers =
            createManualTimers();
        const states = [];
        const dispose =
            observeBroker95SceneVisibility(
                element,
                visible =>
                    states.push(visible),
                {
                    documentTarget,
                    focusTarget,
                    activityTarget,
                    IntersectionObserverClass:
                        null,
                    idleTimeoutMs: 100,
                    setTimeout:
                        timers.setTimeout,
                    clearTimeout:
                        timers.clearTimeout
                }
            );

        assert.deepEqual(states, [true]);

        timers.run();
        assert.deepEqual(states, [true, false]);

        activityTarget.emit("pointermove");
        assert.deepEqual(
            states,
            [true, false, true]
        );

        focusTarget.emit("blur");
        assert.deepEqual(
            states,
            [true, false, true, false]
        );

        focusTarget.emit("focus");
        assert.deepEqual(
            states,
            [true, false, true, false, true]
        );

        dispose();
        assert.equal(
            focusTarget.listenerCount(),
            0
        );
        assert.equal(
            activityTarget.listenerCount(),
            0
        );
        assert.equal(timers.pending(), 0);
    }
);

function createFakeKaplay() {
    const loaded = [];
    const objects = [];
    let loadListener = null;
    let updateListener = null;
    let delta = 0.016;
    let quits = 0;
    let configuration = null;

    const context = {
        debug: { paused: false },
        quad(x, y, w, h) {
            return { x, y, w, h };
        },
        loadSprite(name, url, options = {}) {
            const asset = {
                name,
                url,
                options,
                errorListener: null,
                onError(listener) {
                    this.errorListener = listener;
                    return this;
                }
            };

            loaded.push(asset);
            return asset;
        },
        sprite(name, options = {}) {
            return component("sprite", {
                sprite: name,
                ...options
            });
        },
        pos(x, y) {
            return component("pos", {
                pos: { x, y }
            });
        },
        opacity(value) {
            return component("opacity", {
                opacity: value
            });
        },
        z(value) {
            return component("z", { z: value });
        },
        rect(width, height) {
            return component("rect", {
                width,
                height
            });
        },
        anchor(value) {
            return component("anchor", {
                anchor: value
            });
        },
        color(r, g, b) {
            return component("color", {
                color: { r, g, b }
            });
        },
        add(components) {
            const object = {};

            for (const item of components) {
                Object.assign(object, item.values);
            }

            objects.push(object);
            return object;
        },
        onLoad(listener) {
            loadListener = listener;
        },
        onUpdate(listener) {
            updateListener = listener;
        },
        dt() {
            return delta;
        },
        quit() {
            quits += 1;
        }
    };

    return {
        context,
        loaded,
        objects,
        create(options) {
            configuration = options;
            return context;
        },
        finishLoading() {
            loadListener();
        },
        update() {
            updateListener();
        },
        setDelta(value) {
            delta = value;
        },
        quitCount() {
            return quits;
        },
        configuration() {
            return configuration;
        }
    };
}

function createVisibilityDocument() {
    const listeners = new Set();

    return {
        visibilityState: "visible",
        listeners,
        addEventListener(type, listener) {
            if (type === "visibilitychange") {
                listeners.add(listener);
            }
        },
        removeEventListener(type, listener) {
            if (type === "visibilitychange") {
                listeners.delete(listener);
            }
        },
        emit() {
            for (const listener of listeners) {
                listener();
            }
        }
    };
}

function createIntersectionObserver() {
    let callback = null;
    let disconnected = 0;

    return {
        Class: class {
            constructor(listener) {
                callback = listener;
            }

            observe() {}

            disconnect() {
                disconnected += 1;
            }
        },
        emit(entry) {
            callback([entry]);
        },
        disconnectCount() {
            return disconnected;
        }
    };
}

function createListenerTarget() {
    const listeners = new Map();

    return {
        addEventListener(type, listener) {
            const values =
                listeners.get(type) ??
                new Set();

            values.add(listener);
            listeners.set(type, values);
        },
        removeEventListener(type, listener) {
            listeners.get(type)
                ?.delete(listener);
        },
        emit(type) {
            for (
                const listener of
                listeners.get(type) ?? []
            ) {
                listener();
            }
        },
        listenerCount() {
            return [...listeners.values()]
                .reduce(
                    (total, values) =>
                        total + values.size,
                    0
                );
        }
    };
}

function createManualTimers() {
    let nextId = 1;
    const callbacks = new Map();

    return {
        setTimeout(callback) {
            const id = nextId++;

            callbacks.set(id, callback);
            return id;
        },
        clearTimeout(id) {
            callbacks.delete(id);
        },
        run() {
            const pending = [
                ...callbacks.values()
            ];

            callbacks.clear();
            pending.forEach(callback =>
                callback()
            );
        },
        pending() {
            return callbacks.size;
        }
    };
}

function component(id, values) {
    return { id, values };
}
