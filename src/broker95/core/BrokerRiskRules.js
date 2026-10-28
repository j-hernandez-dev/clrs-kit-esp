import {
    BrokerGameError
} from "./BrokerGameError.js";

export const BrokerRisk = Object.freeze({
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    EXTREME: "extreme"
});

export const BrokerCriterion = Object.freeze({
    FUNCTIONALITY: "functionality",
    ROBUSTNESS: "robustness",
    DESIGN: "design"
});

export const BROKER_CRITERIA = Object.freeze([
    BrokerCriterion.FUNCTIONALITY,
    BrokerCriterion.ROBUSTNESS,
    BrokerCriterion.DESIGN
]);

const RULES = Object.freeze({
    [BrokerRisk.LOW]: rule({
        label: "Bajo",
        alertIncrement: 0,
        payRange: [100, 250],
        weights: {
            functionality: 1
        }
    }),
    [BrokerRisk.MEDIUM]: rule({
        label: "Medio",
        alertIncrement: 1,
        payRange: [300, 650],
        weights: {
            functionality: 0.7,
            robustness: 0.3
        }
    }),
    [BrokerRisk.HIGH]: rule({
        label: "Alto",
        alertIncrement: 2,
        payRange: [800, 1500],
        weights: {
            functionality: 0.5,
            robustness: 0.2,
            design: 0.3
        }
    }),
    [BrokerRisk.EXTREME]: rule({
        label: "Extremo",
        alertIncrement: 4,
        payRange: [2000, 4000],
        weights: {
            functionality: 0.5,
            robustness: 0.125,
            design: 0.375
        }
    })
});

export const BROKER_RISKS = Object.freeze(
    Object.values(BrokerRisk)
);

export function getBrokerRiskRule(risk) {
    const selected = RULES[risk];

    if (!selected) {
        throw BrokerGameError.invalidRule(
            "BROKER95_RISK_INVALID",
            "El nivel de riesgo indicado no es válido.",
            [{ risk }]
        );
    }

    return selected;
}

export function isBrokerRisk(value) {
    return BROKER_RISKS.includes(value);
}

function rule({
    label,
    alertIncrement,
    payRange,
    weights
}) {
    const frozenWeights = Object.freeze({
        ...weights
    });

    return Object.freeze({
        label,
        alertIncrement,
        payRange: Object.freeze([
            ...payRange
        ]),
        weights: frozenWeights,
        activeCriteria: Object.freeze(
            Object.keys(frozenWeights)
        )
    });
}
