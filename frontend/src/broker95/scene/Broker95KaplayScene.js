import {
    Broker95CipherVisualState,
    isBroker95CipherVisualState
} from "./Broker95CipherVisualState.js";

export const BROKER95_SCENE_SIZE =
    Object.freeze({
        width: 1536,
        height: 1024
    });

const CIPHER_ATLAS_SIZE = Object.freeze({
    width: 1536,
    height: 1024
});

export const BROKER95_VISUAL_ASSETS =
    Object.freeze({
        room: new URL(
            "../assets/broker95-room.png",
            import.meta.url
        ).href,
        rain: new URL(
            "../assets/broker95-rain.png",
            import.meta.url
        ).href,
        cipher: new URL(
            "../assets/broker95-cipher-sheet.png",
            import.meta.url
        ).href
    });

export const BROKER95_CIPHER_FRAME =
    Object.freeze({
        IDLE: 0,
        CALM: 1,
        BLINKING: 2,
        SLEEPING: 3,
        ATTENTIVE: 4,
        HAPPY: 5,
        ERROR: 6,
        SUSPICIOUS: 7,
        ANGRY: 8
    });

const ASSET_NAME = Object.freeze({
    ROOM: "broker95-room",
    RAIN: "broker95-rain",
    CIPHER: "broker95-cipher"
});

const MONITOR = Object.freeze({
    x: 666,
    y: 368,
    width: 218,
    height: 142
});

const CIPHER_FRAME_RECTS = Object.freeze([
    atlasFrameRect(356, 244, 201, 126),
    atlasFrameRect(660, 244, 212, 126),
    atlasFrameRect(979, 244, 201, 126),
    atlasFrameRect(356, 454, 201, 125),
    atlasFrameRect(660, 454, 212, 125),
    atlasFrameRect(979, 454, 201, 125),
    atlasFrameRect(356, 662, 201, 123),
    atlasFrameRect(660, 662, 212, 123),
    atlasFrameRect(979, 662, 201, 123)
]);

const RAIN_PANES = Object.freeze([
    Object.freeze({
        x: 176,
        y: 153,
        width: 151,
        height: 337,
        speed: 92
    }),
    Object.freeze({
        x: 352,
        y: 153,
        width: 151,
        height: 337,
        speed: 78
    })
]);

// Trazos deterministas superpuestos a la textura ambiental. La imagen de la
// habitación ya contiene lluvia, por lo que desplazar únicamente otra textura
// completa resulta casi imperceptible al reducir la escena a miniatura.
// Estos trazos permanecen dentro de cada cristal y hacen observable la caída.
const RAIN_DROP_TEMPLATES = Object.freeze([
    rainDrop(0.08, 0.04, 1, 13, 0.86, 0.2),
    rainDrop(0.2, 0.46, 1, 8, 1.18, 0.14),
    rainDrop(0.31, 0.2, 2, 17, 1.04, 0.22),
    rainDrop(0.43, 0.7, 1, 11, 0.76, 0.16),
    rainDrop(0.55, 0.08, 1, 7, 1.34, 0.13),
    rainDrop(0.67, 0.56, 2, 15, 0.94, 0.2),
    rainDrop(0.79, 0.31, 1, 10, 1.22, 0.16),
    rainDrop(0.91, 0.78, 1, 18, 0.82, 0.21)
]);

const AMBIENT_RAIN_SPEED = 0.72;
const ACTIVE_RENDER_FPS = 20;
// Kaplay consulta maxFPS en cada frame. Una frecuencia casi nula conserva el
// contexto y la imagen ya dibujada, pero evita trabajo WebGL durante la pausa.
// Así no es necesario destruir y recrear el singleton global de Kaplay.
const SUSPENDED_RENDER_FPS = 0.001;

const BASE_FRAME = Object.freeze({
    [Broker95CipherVisualState.OFFLINE]:
        BROKER95_CIPHER_FRAME.SLEEPING,
    [Broker95CipherVisualState.IDLE]:
        BROKER95_CIPHER_FRAME.IDLE,
    [Broker95CipherVisualState.ATTENTIVE]:
        BROKER95_CIPHER_FRAME.ATTENTIVE,
    [Broker95CipherVisualState.WORKING]:
        BROKER95_CIPHER_FRAME.ATTENTIVE,
    [Broker95CipherVisualState.SUCCESS]:
        BROKER95_CIPHER_FRAME.HAPPY,
    [Broker95CipherVisualState.WARNING]:
        BROKER95_CIPHER_FRAME.SUSPICIOUS,
    [Broker95CipherVisualState.ERROR]:
        BROKER95_CIPHER_FRAME.ERROR
});

const VISUAL_TONE = Object.freeze({
    [Broker95CipherVisualState.OFFLINE]: tone(
        [52, 79, 43], 0.025, 0.008, 0.45, 0
    ),
    [Broker95CipherVisualState.IDLE]: tone(
        [119, 255, 74], 0.055, 0.018, 1, 0.07
    ),
    [Broker95CipherVisualState.ATTENTIVE]: tone(
        [151, 255, 92], 0.072, 0.022, 1.05, 0.1
    ),
    [Broker95CipherVisualState.WORKING]: tone(
        [205, 255, 84], 0.082, 0.027, 1.12, 0.13
    ),
    [Broker95CipherVisualState.SUCCESS]: tone(
        [127, 255, 112], 0.095, 0.03, 1, 0.11
    ),
    [Broker95CipherVisualState.WARNING]: tone(
        [255, 181, 70], 0.09, 0.035, 1.2, 0.14
    ),
    [Broker95CipherVisualState.ERROR]: tone(
        [255, 82, 61], 0.105, 0.045, 1.3, 0.17
    )
});

const VISUAL_PRIORITY = Object.freeze({
    [Broker95CipherVisualState.IDLE]: 10,
    [Broker95CipherVisualState.ATTENTIVE]: 30,
    [Broker95CipherVisualState.SUCCESS]: 40,
    [Broker95CipherVisualState.WORKING]: 50,
    [Broker95CipherVisualState.WARNING]: 70,
    [Broker95CipherVisualState.ERROR]: 80,
    [Broker95CipherVisualState.OFFLINE]: 90
});

export class Broker95KaplaySceneError
    extends Error {

    constructor(code, message, options = {}) {
        super(message, options);
        this.name = "Broker95KaplaySceneError";
        this.code = code;
    }
}

export class Broker95KaplayScene {

    constructor(options = {}) {
        this.kaplayLoader =
            options.kaplayLoader ??
            (() => import("kaplay"));
        this.assets =
            options.assets ??
            BROKER95_VISUAL_ASSETS;
        this.onReady =
            options.onReady ?? (() => {});
        this.onError =
            options.onError ?? (() => {});
        this.visualState =
            options.visualState ??
            Broker95CipherVisualState.OFFLINE;
        this.motionEnabled =
            options.motionEnabled !== false;
        this.visible =
            options.visible !== false;
        this.context = null;
        this.objects = null;
        this.elapsed = 0;
        this.signalElapsed = 0;
        this.activeSignal = null;
        this.lastSignalSequence = 0;
        this.mounted = false;
        this.disposed = false;
        this.failed = false;

        requireVisualState(this.visualState);
        requireAssetUrls(this.assets);
    }

    async mount(canvas, options = {}) {
        if (this.mounted) {
            throw new Broker95KaplaySceneError(
                "BROKER95_KAPLAY_ALREADY_MOUNTED",
                "The BROKER.95 Kaplay scene is already mounted."
            );
        }

        if (
            canvas == null ||
            typeof canvas.getContext !== "function"
        ) {
            throw new Broker95KaplaySceneError(
                "BROKER95_KAPLAY_CANVAS_INVALID",
                "A canvas is required to mount the BROKER.95 Kaplay scene."
            );
        }

        this.mounted = true;

        if (
            this.disposed ||
            options.signal?.aborted === true
        ) {
            return false;
        }

        try {
            const kaplayModule =
                await this.kaplayLoader();

            if (
                this.disposed ||
                options.signal?.aborted === true
            ) {
                return false;
            }

            const createKaplay =
                kaplayModule?.default ??
                kaplayModule;

            if (typeof createKaplay !== "function") {
                throw new Broker95KaplaySceneError(
                    "BROKER95_KAPLAY_MODULE_INVALID",
                    "The installed Kaplay module has no default factory."
                );
            }

            const scene = this;

            this.context = createKaplay({
                width: BROKER95_SCENE_SIZE.width,
                height: BROKER95_SCENE_SIZE.height,
                canvas,
                global: false,
                debug: false,
                focus: false,
                touchToMouse: false,
                loadingScreen: false,
                crisp: true,
                texFilter: "nearest",
                pixelDensity: 1,
                stretch: true,
                letterbox: true,
                background: [0, 0, 0],
                // El Webview no necesita una tasa de juego completa. Un
                // límite moderado conserva la lluvia y el parpadeo mientras
                // reduce el trabajo continuo del compositor de Electron.
                get maxFPS() {
                    return scene.visible
                        ? ACTIVE_RENDER_FPS
                        : SUSPENDED_RENDER_FPS;
                }
            });

            this.#loadAssets();
            this.context.onLoad(
                () => this.#buildScene()
            );
            this.#applyVisibility();

            return true;
        } catch (cause) {
            const error = cause instanceof
                Broker95KaplaySceneError
                ? cause
                : new Broker95KaplaySceneError(
                    "BROKER95_KAPLAY_INITIALIZATION_FAILED",
                    "Kaplay could not initialize the BROKER.95 scene.",
                    { cause }
                );

            this.#reportFailure(error);
            throw error;
        }
    }

    setVisualState(visualState) {
        requireVisualState(visualState);

        if (visualState === this.visualState) {
            return;
        }

        this.visualState = visualState;
        this.elapsed = 0;
        this.#applyCipherFrame();
        this.#applyVisualTone();
    }

    playSignal(signal) {
        requireSignal(signal);

        if (
            this.disposed ||
            signal.sequence <=
                this.lastSignalSequence
        ) {
            return false;
        }

        this.lastSignalSequence = signal.sequence;
        this.signalElapsed = 0;
        this.activeSignal = Object.freeze({
            ...signal,
            durationSeconds:
                signal.durationMs / 1000
        });
        this.#applyCipherFrame();
        this.#applyVisualTone();

        return true;
    }

    setMotionEnabled(enabled) {
        this.motionEnabled = enabled === true;
        this.elapsed = 0;
        this.#applyCipherFrame();
        this.#applyVisualTone();
    }

    setVisible(visible) {
        this.visible = visible === true;
        this.#applyVisibility();
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.objects = null;

        if (this.context != null) {
            try {
                this.context.quit();
            } catch {
                // Kaplay cleanup must remain idempotent during Webview disposal.
            }
        }

        this.context = null;
    }

    #loadAssets() {
        const k = this.context;
        const frames = CIPHER_FRAME_RECTS.map(
            frame => k.quad(
                frame.x,
                frame.y,
                frame.w,
                frame.h
            )
        );
        const assets = [
            k.loadSprite(
                ASSET_NAME.ROOM,
                this.assets.room,
                { singular: true }
            ),
            k.loadSprite(
                ASSET_NAME.RAIN,
                this.assets.rain,
                { singular: true }
            ),
            k.loadSprite(
                ASSET_NAME.CIPHER,
                this.assets.cipher,
                { frames }
            )
        ];

        for (const asset of assets) {
            asset.onError(cause => {
                this.#reportFailure(
                    new Broker95KaplaySceneError(
                        "BROKER95_KAPLAY_ASSET_LOAD_FAILED",
                        "A local BROKER.95 visual asset could not be loaded.",
                        { cause }
                    )
                );
            });
        }
    }

    #buildScene() {
        if (
            this.disposed ||
            this.failed ||
            this.objects != null
        ) {
            return;
        }

        const k = this.context;

        k.add([
            k.sprite(ASSET_NAME.ROOM, {
                width: BROKER95_SCENE_SIZE.width,
                height: BROKER95_SCENE_SIZE.height
            }),
            k.pos(0, 0),
            k.z(0)
        ]);

        const rain = RAIN_PANES.flatMap(
            pane => [0, 1].map(layer => {
                const initialY =
                    pane.y +
                    ((layer - 1) * pane.height);
                const object = k.add([
                    k.sprite(ASSET_NAME.RAIN, {
                        quad: k.quad(
                            0.28,
                            0.08,
                            0.44,
                            0.78
                        ),
                        width: pane.width,
                        height: pane.height
                    }),
                    k.pos(pane.x, initialY),
                    k.opacity(0.3),
                    k.z(1)
                ]);

                return Object.freeze({
                    object,
                    pane,
                    initialY
                });
            })
        );
        const rainDrops = RAIN_PANES.flatMap(
            pane => RAIN_DROP_TEMPLATES.map(
                drop => {
                    const initialY = pane.y +
                        (drop.y * pane.height);
                    const object = k.add([
                        k.rect(
                            drop.width,
                            drop.height
                        ),
                        k.pos(
                            pane.x +
                                (drop.x * pane.width),
                            initialY
                        ),
                        k.color(164, 255, 91),
                        k.opacity(drop.opacity),
                        k.z(1)
                    ]);

                    return Object.freeze({
                        object,
                        pane,
                        drop,
                        initialY
                    });
                }
            )
        );

        const glow = k.add([
            k.rect(
                MONITOR.width + 58,
                MONITOR.height + 52
            ),
            k.pos(
                MONITOR.x + MONITOR.width / 2,
                MONITOR.y + MONITOR.height / 2
            ),
            k.anchor("center"),
            k.color(119, 255, 74),
            k.opacity(0.055),
            k.z(2)
        ]);

        const cipher = k.add([
            k.sprite(ASSET_NAME.CIPHER, {
                frame: BASE_FRAME[this.visualState],
                width: MONITOR.width,
                height: MONITOR.height
            }),
            k.pos(MONITOR.x, MONITOR.y),
            k.opacity(0.96),
            k.z(3)
        ]);

        const scanLine = k.add([
            k.rect(MONITOR.width, 2),
            k.pos(MONITOR.x, MONITOR.y),
            k.color(202, 255, 151),
            k.opacity(0.08),
            k.z(4)
        ]);

        const statusLed = k.add([
            k.rect(10, 4),
            k.pos(
                MONITOR.x + MONITOR.width - 17,
                MONITOR.y + MONITOR.height - 10
            ),
            k.color(119, 255, 74),
            k.opacity(0.72),
            k.z(5)
        ]);

        this.objects = Object.freeze({
            rain: Object.freeze(rain),
            rainDrops: Object.freeze(
                rainDrops
            ),
            glow,
            cipher,
            scanLine,
            statusLed
        });

        k.onUpdate(() => this.#update());
        this.#applyCipherFrame();
        this.#applyVisualTone();
        this.onReady();
    }

    #update() {
        if (
            this.disposed ||
            this.objects == null
        ) {
            return;
        }

        const delta = Math.min(
            Math.max(this.context.dt(), 0),
            0.1
        );

        this.elapsed += delta;

        let signalExpired = false;

        if (this.activeSignal != null) {
            this.signalElapsed += delta;

            if (
                this.signalElapsed >=
                    this.activeSignal
                        .durationSeconds
            ) {
                this.activeSignal = null;
                this.signalElapsed = 0;
                signalExpired = true;
            }
        }

        if (!this.motionEnabled) {
            if (signalExpired) {
                this.#applyCipherFrame();
                this.#applyVisualTone();
            }

            return;
        }

        const tone = VISUAL_TONE[
            this.#effectiveVisualState()
        ];
        const rainSpeed = Math.max(
            AMBIENT_RAIN_SPEED,
            tone.rainSpeed
        );

        for (const rain of this.objects.rain) {
            rain.object.pos.y +=
                rain.pane.speed *
                rainSpeed * delta;

            if (
                rain.object.pos.y >=
                rain.pane.y +
                    rain.pane.height
            ) {
                rain.object.pos.y -=
                    rain.pane.height * 2;
            }
        }

        for (const rain of this.objects.rainDrops) {
            rain.object.pos.y +=
                rain.pane.speed *
                rain.drop.speed *
                rainSpeed * delta;

            if (
                rain.object.pos.y >=
                    rain.pane.y +
                        rain.pane.height
            ) {
                rain.object.pos.y =
                    rain.pane.y -
                    rain.drop.height;
            }
        }

        this.#applyCipherFrame();
        this.#applyVisualTone();
    }

    #applyCipherFrame() {
        if (this.objects == null) {
            return;
        }

        this.objects.cipher.frame =
            this.motionEnabled
                ? animatedFrame(
                    this.#effectiveVisualState(),
                    this.activeSignal == null
                        ? this.elapsed
                        : this.signalElapsed
                )
                : BASE_FRAME[
                    this.#effectiveVisualState()
                ];
    }

    #applyVisualTone() {
        if (this.objects == null) {
            return;
        }

        const visualState =
            this.#effectiveVisualState();
        const tone = VISUAL_TONE[visualState];
        const pulse = this.motionEnabled
            ? (Math.sin(this.elapsed * 2.4) + 1) /
                2
            : 0.5;

        this.objects.glow.opacity =
            tone.glowOpacity +
            (pulse * tone.glowPulse);
        applyColor(
            this.objects.glow,
            tone.color
        );
        applyColor(
            this.objects.statusLed,
            tone.color
        );
        this.objects.statusLed.opacity =
            this.motionEnabled
                ? 0.48 + (pulse * 0.42)
                : 0.72;
        this.objects.scanLine.opacity =
            this.motionEnabled
                ? tone.scanOpacity
                : 0;
        this.objects.scanLine.pos.y =
            MONITOR.y +
            ((this.elapsed * 54) %
                MONITOR.height);
    }

    #effectiveVisualState() {
        if (this.activeSignal == null) {
            return this.visualState;
        }

        return VISUAL_PRIORITY[
            this.activeSignal.visualState
        ] > VISUAL_PRIORITY[this.visualState]
            ? this.activeSignal.visualState
            : this.visualState;
    }

    #applyVisibility() {
        if (this.context?.debug != null) {
            this.context.debug.paused =
                !this.visible;
        }
    }

    #reportFailure(error) {
        if (this.failed || this.disposed) {
            return;
        }

        this.failed = true;

        if (this.context?.debug != null) {
            this.context.debug.paused = true;
        }

        this.onError(error);
    }
}

function animatedFrame(visualState, elapsed) {
    switch (visualState) {
        case Broker95CipherVisualState.IDLE: {
            const phase = elapsed % 5.2;

            if (phase >= 4.72 && phase < 4.84) {
                return BROKER95_CIPHER_FRAME.BLINKING;
            }

            if (phase >= 4.84 && phase < 4.94) {
                return BROKER95_CIPHER_FRAME.SLEEPING;
            }

            if (phase >= 4.94 && phase < 5.06) {
                return BROKER95_CIPHER_FRAME.BLINKING;
            }

            return BROKER95_CIPHER_FRAME.IDLE;
        }

        case Broker95CipherVisualState.WORKING:
            return Math.floor(elapsed / 0.62) % 2 === 0
                ? BROKER95_CIPHER_FRAME.ATTENTIVE
                : BROKER95_CIPHER_FRAME.CALM;

        case Broker95CipherVisualState.ATTENTIVE:
            return elapsed % 2.8 < 2.55
                ? BROKER95_CIPHER_FRAME.ATTENTIVE
                : BROKER95_CIPHER_FRAME.CALM;

        case Broker95CipherVisualState.SUCCESS:
            return Math.floor(elapsed / 1.2) % 2 === 0
                ? BROKER95_CIPHER_FRAME.HAPPY
                : BROKER95_CIPHER_FRAME.CALM;

        case Broker95CipherVisualState.WARNING:
            return Math.floor(elapsed / 1.45) % 2 === 0
                ? BROKER95_CIPHER_FRAME.SUSPICIOUS
                : BROKER95_CIPHER_FRAME.ERROR;

        case Broker95CipherVisualState.ERROR:
            return Math.floor(elapsed / 1.1) % 2 === 0
                ? BROKER95_CIPHER_FRAME.ERROR
                : BROKER95_CIPHER_FRAME.ANGRY;

        default:
            return BASE_FRAME[visualState];
    }
}

function requireVisualState(value) {
    if (!isBroker95CipherVisualState(value)) {
        throw new Broker95KaplaySceneError(
            "BROKER95_CIPHER_VISUAL_STATE_INVALID",
            "The CIPHER visual state is not supported."
        );
    }
}

function requireSignal(signal) {
    if (
        signal == null ||
        !Number.isSafeInteger(signal.sequence) ||
        signal.sequence <= 0 ||
        !isBroker95CipherVisualState(
            signal.visualState
        ) ||
        !Number.isFinite(signal.durationMs) ||
        signal.durationMs <= 0 ||
        signal.durationMs > 10_000
    ) {
        throw new Broker95KaplaySceneError(
            "BROKER95_CIPHER_SIGNAL_INVALID",
            "The CIPHER visual signal is invalid."
        );
    }
}

function requireAssetUrls(assets) {
    for (const key of ["room", "rain", "cipher"]) {
        if (
            typeof assets?.[key] !== "string" ||
            assets[key].length === 0
        ) {
            throw new Broker95KaplaySceneError(
                "BROKER95_KAPLAY_ASSET_URL_INVALID",
                `The local ${key} asset URL is invalid.`
            );
        }
    }
}

function atlasFrameRect(x, y, w, h) {
    return Object.freeze({
        x: x / CIPHER_ATLAS_SIZE.width,
        y: y / CIPHER_ATLAS_SIZE.height,
        w: w / CIPHER_ATLAS_SIZE.width,
        h: h / CIPHER_ATLAS_SIZE.height
    });
}

function rainDrop(
    x,
    y,
    width,
    height,
    speed,
    opacity
) {
    return Object.freeze({
        x,
        y,
        width,
        height,
        speed,
        opacity
    });
}

function tone(
    color,
    glowOpacity,
    glowPulse,
    rainSpeed,
    scanOpacity
) {
    return Object.freeze({
        color: Object.freeze(color),
        glowOpacity,
        glowPulse,
        rainSpeed,
        scanOpacity
    });
}

function applyColor(object, [r, g, b]) {
    object.color.r = r;
    object.color.g = g;
    object.color.b = b;
}
