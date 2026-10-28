import {
    BrokerGameError
} from "./BrokerGameError.js";
import {
    requireBrokerScore
} from "./BrokerPaymentRules.js";
import {
    BROKER_CRITERIA,
    getBrokerRiskRule
} from "./BrokerRiskRules.js";

export const BrokerGameStatus = Object.freeze({
    PLAYING: "playing",
    GAME_OVER: "game_over"
});

export const BROKER_ALERT_LIMIT = 10;
export const BROKER_GAME_OVER_ALERT_LEVEL = 11;

export const BrokerCountermeasure =
    Object.freeze({
        SCRUB: "scrub",
        INFRASTRUCTURE: "infrastructure",
        IDENTITY: "identity",
        BRIBE: "bribe"
    });

const COUNTERMEASURES = Object.freeze({
    [BrokerCountermeasure.SCRUB]:
        countermeasure({
            name: "Borrar rastros",
            price: 250,
            reduction: 1
        }),
    [BrokerCountermeasure.INFRASTRUCTURE]:
        countermeasure({
            name: "Cambiar infraestructura",
            price: 650,
            reduction: 2
        }),
    [BrokerCountermeasure.IDENTITY]:
        countermeasure({
            name: "Quemar identidad",
            price: 1200,
            reduction: 3
        }),
    [BrokerCountermeasure.BRIBE]:
        countermeasure({
            name: "Sobornar investigador",
            price: 3500,
            reset: true
        })
});

const COUNTERMEASURE_CATALOG = Object.freeze(
    Object.entries(COUNTERMEASURES)
        .map(([id, rule]) => Object.freeze({
            id,
            ...rule
        }))
);

export function getBrokerCountermeasures() {
    return COUNTERMEASURE_CATALOG;
}

export function getBrokerCountermeasure(id) {
    const selected = COUNTERMEASURES[id];

    if (!selected) {
        throw BrokerGameError.invalidRule(
            "BROKER95_COUNTERMEASURE_INVALID",
            "La contramedida indicada no existe.",
            [{ id }]
        );
    }

    return selected;
}

export function calculateBrokerFinalScore(
    risk,
    dimensionScores
) {
    const rule = getBrokerRiskRule(risk);
    const scores = requireDimensionScores(
        rule.activeCriteria,
        dimensionScores
    );
    const weighted =
        rule.activeCriteria.reduce(
            (total, criterion) =>
                total +
                scores[criterion] *
                rule.weights[criterion],
            0
        );

    return Math.round(weighted);
}

export function nextBrokerAlertLevel(
    currentAlert,
    increment
) {
    requireAlert(currentAlert);

    if (
        !Number.isInteger(increment) ||
        increment < 0
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_ALERT_INCREMENT_INVALID",
            "El incremento de alerta no es válido.",
            [{ increment }]
        );
    }

    return Math.min(
        BROKER_GAME_OVER_ALERT_LEVEL,
        currentAlert + increment
    );
}

export function isBrokerGameOverAlert(alert) {
    requireAlert(alert);
    return alert >=
        BROKER_GAME_OVER_ALERT_LEVEL;
}

export function requireBrokerAlert(alert) {
    return requireAlert(alert);
}

function requireDimensionScores(
    activeCriteria,
    dimensionScores
) {
    if (
        dimensionScores == null ||
        typeof dimensionScores !==
            "object" ||
        Array.isArray(dimensionScores)
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_DIMENSION_SCORES_INVALID",
            "La evaluación no contiene puntuaciones válidas.",
            []
        );
    }

    const provided = Object.keys(
        dimensionScores
    );
    const invalid = provided.filter(
        criterion =>
            !BROKER_CRITERIA.includes(
                criterion
            ) ||
            !activeCriteria.includes(
                criterion
            )
    );
    const missing = activeCriteria.filter(
        criterion =>
            !Object.hasOwn(
                dimensionScores,
                criterion
            )
    );

    if (
        invalid.length > 0 ||
        missing.length > 0
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_DIMENSION_SCORES_MISMATCH",
            "La evaluación no coincide con los criterios activos del contrato.",
            [{ invalid, missing }]
        );
    }

    return Object.freeze(
        Object.fromEntries(
            activeCriteria.map(
                criterion => [
                    criterion,
                    requireBrokerScore(
                        dimensionScores[
                            criterion
                        ]
                    )
                ]
            )
        )
    );
}

function requireAlert(alert) {
    if (
        !Number.isInteger(alert) ||
        alert < 0 ||
        alert >
            BROKER_GAME_OVER_ALERT_LEVEL
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_ALERT_INVALID",
            "El nivel de alerta no es válido.",
            [{ alert }]
        );
    }

    return alert;
}

function countermeasure(options) {
    return Object.freeze({
        reset: false,
        reduction: 0,
        ...options
    });
}
