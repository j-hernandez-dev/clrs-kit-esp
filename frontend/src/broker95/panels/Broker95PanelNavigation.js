import {
    Broker95Panel
} from "../Broker95ViewStore.js";

export const BROKER95_PANEL_DEFINITIONS =
    Object.freeze([
        panel(Broker95Panel.TERMINAL, "Terminal"),
        panel(Broker95Panel.CONTRACT, "Contratos"),
        panel(Broker95Panel.LEARNING, "Aprendizaje"),
        panel(Broker95Panel.ECONOMY, "Economía"),
        panel(Broker95Panel.STATISTICS, "Estadísticas"),
        panel(Broker95Panel.SETTINGS, "Configuración")
    ]);

const PANEL_IDS = Object.freeze(
    BROKER95_PANEL_DEFINITIONS.map(
        definition => definition.id
    )
);

export function moveBroker95Panel(
    currentPanel,
    key
) {
    const currentIndex = PANEL_IDS.indexOf(
        currentPanel
    );

    if (currentIndex < 0) {
        throw new TypeError(
            "Unknown BROKER.95 panel."
        );
    }

    switch (key) {
        case "ArrowRight":
            return PANEL_IDS[
                (currentIndex + 1) %
                PANEL_IDS.length
            ];

        case "ArrowLeft":
            return PANEL_IDS[
                (currentIndex - 1 +
                    PANEL_IDS.length) %
                PANEL_IDS.length
            ];

        case "Home":
            return PANEL_IDS[0];

        case "End":
            return PANEL_IDS.at(-1);

        default:
            return null;
    }
}

export function createBroker95PanelBadges(state) {
    const game = state?.gameState;
    const contracts = game?.contracts ?? [];
    const pending = contracts.filter(
        contract => contract.state === "pending"
    ).length;
    const settled =
        (game?.completedContractIds?.length ?? 0) +
        (game?.failedContractIds?.length ?? 0);
    const credential =
        state?.settings?.credential;
    const credentialReady = credential == null
        ? Boolean(state?.settings?.hasApiKey)
        : !credential.required ||
            credential.configured;
    const missingConfiguration =
        !credentialReady ||
        !String(
            state?.settings?.model ?? ""
        ).trim();

    return Object.freeze({
        [Broker95Panel.TERMINAL]: null,
        [Broker95Panel.CONTRACT]:
            game?.activeContractId != null
                ? `#${game.activeContractId}`
                : pending > 0
                    ? String(pending)
                    : null,
        [Broker95Panel.LEARNING]:
            game?.learning?.routes?.length
                ? createLearningBadge(
                    game.learning.routes
                )
                : null,
        [Broker95Panel.ECONOMY]:
            game?.alertLevel > 0
                ? String(game.alertLevel)
                : null,
        [Broker95Panel.STATISTICS]:
            settled > 0
                ? String(settled)
                : null,
        [Broker95Panel.SETTINGS]:
            missingConfiguration ? "!" : null
    });
}

function createLearningBadge(routes) {
    const completed = routes.reduce(
        (sum, route) =>
            sum + route.completedLessons,
        0
    );
    const total = routes.reduce(
        (sum, route) =>
            sum + route.totalLessons,
        0
    );

    return `${completed}/${total}`;
}

function panel(id, label) {
    return Object.freeze({
        id,
        label,
        tabId: `broker95-tab-${id}`,
        panelId: `broker95-panel-${id}`
    });
}
