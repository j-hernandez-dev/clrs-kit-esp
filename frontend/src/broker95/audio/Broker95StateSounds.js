import {
    Broker95SoundEffect
} from "./Broker95SoundCatalog.js";

export function deriveBroker95StateSoundEffects(
    previous,
    next
) {
    if (previous == null || next == null) {
        return Object.freeze([]);
    }

    if (
        becameGameOver(previous, next) ||
        changedError(previous, next)
    ) {
        return Object.freeze([
            Broker95SoundEffect.ERROR
        ]);
    }

    const effects = [];

    if (receivedPendingContract(previous, next)) {
        effects.push(
            Broker95SoundEffect
                .CONTRACT_RECEIVED
        );
    }

    if (
        finite(next.gameState?.money) >
        finite(previous.gameState?.money)
    ) {
        effects.push(Broker95SoundEffect.PAYMENT);
    }

    if (
        finite(next.gameState?.alertLevel) >
        finite(previous.gameState?.alertLevel)
    ) {
        effects.push(Broker95SoundEffect.ALERT);
    }

    if (
        effects.length === 0 &&
        next.cipherSignal?.sequence != null &&
        next.cipherSignal.sequence !==
            previous.cipherSignal?.sequence
    ) {
        effects.push(
            Broker95SoundEffect.CIPHER_SIGNAL
        );
    }

    if (
        effects.length === 0 &&
        previous.operation?.status === "busy" &&
        next.operation?.status === "idle" &&
        next.lastError == null
    ) {
        effects.push(
            Broker95SoundEffect
                .DIGITAL_CONFIRMATION
        );
    }

    return Object.freeze(effects);
}

function becameGameOver(previous, next) {
    return next.gameState?.gameOver === true &&
        previous.gameState?.gameOver !== true;
}

function changedError(previous, next) {
    return next.lastError != null &&
        (
            previous.lastError == null ||
            next.lastError.code !==
                previous.lastError.code ||
            next.lastError.message !==
                previous.lastError.message
        );
}

function receivedPendingContract(previous, next) {
    const known = new Set(
        pendingContractIds(
            previous.gameState
        )
    );

    return pendingContractIds(next.gameState)
        .some(id => !known.has(id));
}

function pendingContractIds(gameState) {
    return (gameState?.contracts ?? [])
        .filter(contract =>
            contract?.state === "pending"
        )
        .map(contract => contract.id);
}

function finite(value) {
    return Number.isFinite(value) ? value : 0;
}
