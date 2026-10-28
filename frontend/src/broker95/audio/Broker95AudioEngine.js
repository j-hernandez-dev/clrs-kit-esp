import {
    BROKER_DEFAULT_AUDIO_PREFERENCES,
    normalizeBrokerAudioPreferences
} from "../../../../src/broker95/configuration/BrokerSettings.js";
import {
    getBroker95SoundRecipe
} from "./Broker95SoundCatalog.js";

const MASTER_GAIN = .2;
const MINIMUM_GAIN = .0001;

export class Broker95AudioEngine {

    constructor(options = {}) {
        this.contextFactory =
            options.contextFactory ??
            createBrowserAudioContext;
        this.renderRecipe =
            options.renderRecipe ??
            renderBroker95SoundRecipe;
        this.logger = options.logger ?? console;
        this.maximumSources =
            requireMaximumSources(
                options.maximumSources ?? 18
            );
        this.preferences =
            BROKER_DEFAULT_AUDIO_PREFERENCES;
        this.context = null;
        this.master = null;
        this.activeSources = new Set();
        this.lastPlayedAt = new Map();
        this.unlocked = false;
        this.disposed = false;
    }

    getPreferences() {
        return this.preferences;
    }

    configure(value) {
        this.#requireActive();
        this.preferences =
            normalizeBrokerAudioPreferences(
                value
            );
        this.#applyVolume();

        return this.preferences;
    }

    async unlock() {
        this.#requireActive();

        try {
            const context = this.#requireContext();

            if (
                context.state === "suspended" &&
                typeof context.resume === "function"
            ) {
                await context.resume();
            }

            this.unlocked =
                context.state === "running" ||
                context.state == null;
            return this.unlocked;
        } catch (error) {
            this.#log(error);
            return false;
        }
    }

    async playFromGesture(effect, options = {}) {
        if (!(await this.unlock())) {
            return false;
        }

        return this.play(effect, options);
    }

    play(effect, options = {}) {
        this.#requireActive();

        if (
            !this.unlocked ||
            this.context == null ||
            this.context.state === "closed" ||
            this.preferences.muted ||
            this.preferences.volume === 0
        ) {
            return false;
        }

        const recipe = getBroker95SoundRecipe(
            effect
        );
        const nowMs = this.context.currentTime *
            1_000;
        const lastPlayedAt =
            this.lastPlayedAt.get(effect) ??
            Number.NEGATIVE_INFINITY;

        if (
            options.force !== true &&
            nowMs - lastPlayedAt <
                recipe.cooldownMs
        ) {
            return false;
        }

        this.lastPlayedAt.set(effect, nowMs);
        this.#makeRoom(recipe.voices.length);

        const created = [];

        try {
            this.renderRecipe({
                context: this.context,
                destination: this.master,
                recipe,
                delayMs:
                    normalizeDelay(
                        options.delayMs
                    ),
                registerSource: source => {
                    created.push(source);
                    this.#registerSource(source);
                }
            });

            return true;
        } catch (error) {
            for (const source of created) {
                this.#releaseSource(source, true);
            }

            this.#log(error);
            return false;
        }
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;

        for (const source of [
            ...this.activeSources
        ]) {
            this.#releaseSource(source, true);
        }

        this.activeSources.clear();
        this.lastPlayedAt.clear();
        this.unlocked = false;

        try {
            void this.context?.close?.();
        } catch (error) {
            this.#log(error);
        }

        this.context = null;
        this.master = null;
    }

    #requireContext() {
        if (this.context) {
            return this.context;
        }

        const context = this.contextFactory();

        if (
            context == null ||
            typeof context.createGain !==
                "function"
        ) {
            throw new Error(
                "BROKER.95 Web Audio is unavailable."
            );
        }

        const master = context.createGain();

        this.context = context;
        this.master = master;
        this.#applyVolume({ immediate: true });
        master.connect(context.destination);

        return context;
    }

    #applyVolume({ immediate = false } = {}) {
        if (!this.master || !this.context) {
            return;
        }

        const selected = this.preferences.muted
            ? 0
            : MASTER_GAIN * Math.pow(
                this.preferences.volume / 100,
                1.35
            );
        const parameter = this.master.gain;

        if (immediate) {
            if (
                typeof parameter
                    ?.setValueAtTime ===
                    "function"
            ) {
                parameter.setValueAtTime(
                    selected,
                    this.context.currentTime
                );
            } else if (parameter) {
                parameter.value = selected;
            }

            return;
        }

        if (
            typeof parameter
                ?.setTargetAtTime ===
                "function"
        ) {
            parameter.setTargetAtTime(
                selected,
                this.context.currentTime,
                .012
            );
        } else if (parameter) {
            parameter.value = selected;
        }
    }

    #makeRoom(required) {
        while (
            this.activeSources.size + required >
                this.maximumSources &&
            this.activeSources.size > 0
        ) {
            const [oldest] =
                this.activeSources;

            this.#releaseSource(
                oldest,
                true
            );
        }
    }

    #registerSource(source) {
        if (
            source == null ||
            typeof source !== "object"
        ) {
            throw new TypeError(
                "BROKER.95 audio source is invalid."
            );
        }

        const previousOnEnded = source.onended;

        source.onended = event => {
            this.activeSources.delete(source);
            previousOnEnded?.call(source, event);
        };
        this.activeSources.add(source);
    }

    #releaseSource(source, stop) {
        this.activeSources.delete(source);

        if (stop) {
            try {
                source.stop?.();
            } catch {
                // Una fuente ya finalizada no requiere otra acciÃ³n.
            }
        }

        try {
            source.disconnect?.();
        } catch {
            // La desconexiÃ³n es una limpieza de mejor esfuerzo.
        }
    }

    #log(error) {
        try {
            this.logger.error?.(
                "BROKER.95 procedural audio failed.",
                error
            );
        } catch {
            // El audio nunca puede interrumpir el videojuego.
        }
    }

    #requireActive() {
        if (this.disposed) {
            throw new Error(
                "BROKER.95 audio engine is disposed."
            );
        }
    }
}

export function renderBroker95SoundRecipe({
    context,
    destination,
    recipe,
    delayMs = 0,
    registerSource
}) {
    const baseTime = context.currentTime +
        delayMs / 1_000;

    for (const voice of recipe.voices) {
        const gain = context.createGain();
        const start = baseTime +
            voice.startMs / 1_000;
        const end = start +
            voice.durationMs / 1_000;
        const source = voice.kind === "noise"
            ? createNoiseSource(context, voice)
            : createToneSource(
                context,
                voice,
                start,
                end
            );
        const attackEnd = Math.min(
            end,
            start + .008
        );

        gain.gain.setValueAtTime(
            MINIMUM_GAIN,
            start
        );
        gain.gain.exponentialRampToValueAtTime(
            voice.gain,
            attackEnd
        );
        gain.gain.exponentialRampToValueAtTime(
            MINIMUM_GAIN,
            end
        );
        source.output.connect(gain);
        gain.connect(destination);
        registerSource(source.node);
        source.node.start(start);
        source.node.stop(end + .012);
    }
}

function createToneSource(
    context,
    voice,
    start,
    end
) {
    const oscillator = context.createOscillator();

    oscillator.type = voice.waveform;
    oscillator.frequency.setValueAtTime(
        voice.startFrequency,
        start
    );
    oscillator.frequency.exponentialRampToValueAtTime(
        voice.endFrequency,
        end
    );

    return {
        node: oscillator,
        output: oscillator
    };
}

function createNoiseSource(context, voice) {
    const source = context.createBufferSource();
    const sampleCount = Math.max(
        1,
        Math.ceil(
            context.sampleRate *
            voice.durationMs / 1_000
        )
    );
    const buffer = context.createBuffer(
        1,
        sampleCount,
        context.sampleRate
    );
    const samples = buffer.getChannelData(0);

    for (let index = 0;
        index < samples.length;
        index += 1) {
        samples[index] = Math.random() * 2 - 1;
    }

    source.buffer = buffer;

    if (
        typeof context.createBiquadFilter !==
            "function"
    ) {
        return { node: source, output: source };
    }

    const filter = context.createBiquadFilter();

    filter.type = "bandpass";
    filter.frequency.value =
        voice.filterFrequency;
    filter.Q.value = .72;
    source.connect(filter);

    return { node: source, output: filter };
}

function createBrowserAudioContext() {
    const AudioContextType =
        globalThis.AudioContext ??
        globalThis.webkitAudioContext;

    if (typeof AudioContextType !== "function") {
        throw new Error(
            "Web Audio API is not supported."
        );
    }

    return new AudioContextType({
        latencyHint: "interactive"
    });
}

function normalizeDelay(value) {
    if (value == null) {
        return 0;
    }

    if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > 2_000
    ) {
        throw new TypeError(
            "BROKER.95 sound delay is invalid."
        );
    }

    return value;
}

function requireMaximumSources(value) {
    if (
        !Number.isInteger(value) ||
        value < 4 ||
        value > 64
    ) {
        throw new TypeError(
            "BROKER.95 maximum audio sources is invalid."
        );
    }

    return value;
}
