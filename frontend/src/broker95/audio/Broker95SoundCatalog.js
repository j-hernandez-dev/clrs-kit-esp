export const Broker95SoundEffect = Object.freeze({
    CRT_CLICK: "crt-click",
    MECHANICAL_KEY: "mechanical-key",
    DIGITAL_CONFIRMATION:
        "digital-confirmation",
    ALERT: "alert",
    ERROR: "error",
    CONTRACT_RECEIVED:
        "contract-received",
    PAYMENT: "payment",
    CIPHER_SIGNAL: "cipher-signal"
});

const RECIPES = Object.freeze({
    [Broker95SoundEffect.CRT_CLICK]: recipe(
        74,
        34,
        [
            tone("square", 0, 52, 1_480, 190, .34),
            noise(0, 28, 2_600, .18)
        ]
    ),
    [Broker95SoundEffect.MECHANICAL_KEY]: recipe(
        62,
        28,
        [
            tone("triangle", 0, 42, 185, 104, .38),
            noise(1, 24, 1_250, .24)
        ]
    ),
    [Broker95SoundEffect.DIGITAL_CONFIRMATION]: recipe(
        286,
        130,
        [
            tone("sine", 0, 112, 520, 520, .36),
            tone("triangle", 112, 154, 780, 940, .34)
        ]
    ),
    [Broker95SoundEffect.ALERT]: recipe(
        590,
        420,
        [
            tone("sawtooth", 0, 145, 286, 230, .28),
            tone("sawtooth", 190, 145, 252, 198, .3),
            tone("square", 380, 170, 218, 154, .28)
        ]
    ),
    [Broker95SoundEffect.ERROR]: recipe(
        510,
        360,
        [
            tone("square", 0, 230, 190, 72, .34),
            tone("sawtooth", 145, 310, 124, 48, .25),
            noise(0, 165, 760, .18)
        ]
    ),
    [Broker95SoundEffect.CONTRACT_RECEIVED]: recipe(
        770,
        520,
        [
            tone("square", 0, 86, 420, 580, .24),
            tone("square", 112, 86, 910, 760, .22),
            tone("triangle", 236, 108, 610, 740, .27),
            tone("square", 390, 94, 1_060, 920, .2),
            tone("sine", 520, 210, 720, 520, .3)
        ]
    ),
    [Broker95SoundEffect.PAYMENT]: recipe(
        720,
        480,
        [
            tone("triangle", 0, 130, 440, 520, .3),
            tone("triangle", 125, 140, 660, 740, .32),
            tone("sine", 260, 160, 880, 1_040, .32),
            tone("sine", 420, 245, 1_320, 1_180, .3)
        ]
    ),
    [Broker95SoundEffect.CIPHER_SIGNAL]: recipe(
        430,
        210,
        [
            tone("sine", 0, 96, 720, 980, .26),
            tone("triangle", 88, 126, 1_040, 810, .27),
            tone("sine", 205, 178, 860, 940, .24)
        ]
    )
});

export function getBroker95SoundRecipe(effect) {
    const selected = RECIPES[effect];

    if (!selected) {
        throw new TypeError(
            "Unknown BROKER.95 sound effect."
        );
    }

    return selected;
}

export function listBroker95SoundEffects() {
    return Object.freeze(
        Object.values(Broker95SoundEffect)
    );
}

function recipe(durationMs, cooldownMs, voices) {
    return deepFreeze({
        durationMs,
        cooldownMs,
        voices
    });
}

function tone(
    waveform,
    startMs,
    durationMs,
    startFrequency,
    endFrequency,
    gain
) {
    return {
        kind: "tone",
        waveform,
        startMs,
        durationMs,
        startFrequency,
        endFrequency,
        gain
    };
}

function noise(
    startMs,
    durationMs,
    filterFrequency,
    gain
) {
    return {
        kind: "noise",
        startMs,
        durationMs,
        filterFrequency,
        gain
    };
}

function deepFreeze(value) {
    if (
        value != null &&
        typeof value === "object" &&
        !Object.isFrozen(value)
    ) {
        Object.freeze(value);

        for (const child of Object.values(value)) {
            deepFreeze(child);
        }
    }

    return value;
}
