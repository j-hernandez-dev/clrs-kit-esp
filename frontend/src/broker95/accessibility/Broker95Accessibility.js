import {
    Broker95ConnectionStatus,
    Broker95Panel
} from "../Broker95ViewStore.js";

const OPERATION_LABELS = Object.freeze({
    "learning-contract/obtain":
        "generación del contrato de aprendizaje",
    "submission/review":
        "revisión del código",
    "submission/ask":
        "consulta contextual a CIPHER",
    "submission/push":
        "entrega definitiva",
    "economy/purchase-countermeasure":
        "compra de contramedida",
    "settings/clear-category-history":
        "limpieza del historial de categorías",
    "settings/reset-game-progress":
        "borrado del progreso de la partida",
    "llm/test-connection":
        "comprobación del enlace con CIPHER"
});

export function createBroker95PoliteStatus(state) {
    if (
        state?.connection ===
        Broker95ConnectionStatus.CONNECTING
    ) {
        return "Conectando BROKER.95 con el Extension Host.";
    }

    if (
        state?.connection ===
        Broker95ConnectionStatus.ERROR
    ) {
        return "Se perdió la conexión con el Extension Host.";
    }

    if (state?.operation?.status === "busy") {
        return `Operación en curso: ${operationLabel(
            state.operation.operation
        )}.`;
    }

    return state?.connection ===
        Broker95ConnectionStatus.READY
        ? "BROKER.95 conectado y listo."
        : "";
}

export function createBroker95AssertiveStatus(state) {
    if (state?.gameState?.gameOver === true) {
        return "Alerta máxima. La partida ha terminado. Se muestran las estadísticas finales.";
    }

    return String(
        state?.lastError?.message ?? ""
    ).trim();
}

export function createBroker95AlertAccessibility(
    game
) {
    const alertLimit = finiteNonNegative(
        game?.economy?.alertLimit,
        10
    );
    const gameOverAlertLevel =
        finiteNonNegative(
            game?.economy
                ?.gameOverAlertLevel,
            alertLimit + 1
        );
    const alertLevel = Math.min(
        finiteNonNegative(
            game?.alertLevel,
            0
        ),
        gameOverAlertLevel
    );
    const gameOver = game?.gameOver === true;

    return Object.freeze({
        role: "progressbar",
        "aria-valuemin": 0,
        "aria-valuemax":
            gameOverAlertLevel,
        "aria-valuenow": alertLevel,
        "aria-valuetext": gameOver
            ? `Nivel ${alertLevel}: partida terminada`
            : `Nivel ${alertLevel} de ${alertLimit}`
    });
}

export function createBroker95TabAccessibleLabel(
    panel,
    label,
    badge,
    state
) {
    if (!badge) {
        return label;
    }

    switch (panel) {
        case Broker95Panel.CONTRACT:
            return state?.gameState
                ?.activeContractId != null
                ? `${label}, contrato activo ${badge}`
                : `${label}, ${badge} pendientes`;

        case Broker95Panel.ECONOMY:
            return `${label}, alerta nivel ${badge}`;

        case Broker95Panel.LEARNING:
            return `${label}, ${badge} lecciones completadas`;

        case Broker95Panel.STATISTICS:
            return `${label}, ${badge} resultados`;

        case Broker95Panel.SETTINGS:
            return `${label}, configuración incompleta`;

        default:
            return `${label}, ${badge}`;
    }
}

function operationLabel(operation) {
    if (OPERATION_LABELS[operation]) {
        return OPERATION_LABELS[operation];
    }

    if (
        typeof operation === "string" &&
        operation.startsWith("terminal/")
    ) {
        return "comando de terminal";
    }

    return "procesamiento local";
}

function finiteNonNegative(value, fallback) {
    return Number.isFinite(value) && value >= 0
        ? value
        : fallback;
}
