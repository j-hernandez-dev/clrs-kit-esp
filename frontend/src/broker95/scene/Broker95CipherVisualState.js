export const Broker95CipherVisualState =
    Object.freeze({
        OFFLINE: "offline",
        IDLE: "idle",
        ATTENTIVE: "attentive",
        WORKING: "working",
        SUCCESS: "success",
        WARNING: "warning",
        ERROR: "error"
    });

export const BROKER95_CIPHER_URGENT_ALERT_LEVEL = 8;

const SIGNAL_DURATION = Object.freeze({
    [Broker95CipherVisualState.ATTENTIVE]: 1800,
    [Broker95CipherVisualState.SUCCESS]: 3200,
    [Broker95CipherVisualState.WARNING]: 3200,
    [Broker95CipherVisualState.ERROR]: 4200
});

const VISUAL_STATES = new Set(
    Object.values(Broker95CipherVisualState)
);

export function deriveBroker95CipherVisualState(
    state
) {
    if (state?.gameState?.gameOver === true) {
        return Broker95CipherVisualState.ERROR;
    }

    if (state?.lastError != null) {
        return Broker95CipherVisualState.WARNING;
    }

    if (state?.operation?.status === "busy") {
        return Broker95CipherVisualState.WORKING;
    }

    if (
        state?.connection !== "ready" ||
        state?.llmStatus?.status !== "ready"
    ) {
        return Broker95CipherVisualState.OFFLINE;
    }

    if (
        state?.gameState?.alertLevel >=
            BROKER95_CIPHER_URGENT_ALERT_LEVEL
    ) {
        return Broker95CipherVisualState.WARNING;
    }

    if (
        state?.gameState?.activeContractId != null
    ) {
        return Broker95CipherVisualState.ATTENTIVE;
    }

    return Broker95CipherVisualState.IDLE;
}

export function createBroker95CipherSignal(
    sequence,
    visualState,
    durationMs = SIGNAL_DURATION[visualState]
) {
    if (
        !Number.isSafeInteger(sequence) ||
        sequence <= 0
    ) {
        throw new TypeError(
            "CIPHER signal sequence must be a positive safe integer."
        );
    }

    if (
        !isBroker95CipherVisualState(visualState) ||
        durationMs == null
    ) {
        throw new TypeError(
            "CIPHER signal visual state is not transient."
        );
    }

    if (
        !Number.isFinite(durationMs) ||
        durationMs <= 0 ||
        durationMs > 10_000
    ) {
        throw new TypeError(
            "CIPHER signal duration is outside the supported range."
        );
    }

    return Object.freeze({
        sequence,
        visualState,
        durationMs
    });
}

export function isBroker95CipherVisualState(
    value
) {
    return VISUAL_STATES.has(value);
}
