import {
    BrokerGameError
} from "./BrokerGameError.js";
import {
    getBrokerRiskRule
} from "./BrokerRiskRules.js";

export function getBrokerPayoutMultiplier(
    finalScore
) {
    requireScore(finalScore);

    if (finalScore >= 90) {
        return 1;
    }

    if (finalScore >= 80) {
        return 0.9;
    }

    if (finalScore >= 70) {
        return 0.75;
    }

    if (finalScore >= 60) {
        return 0.5;
    }

    return 0;
}

export function calculateBrokerPayout(
    payPotential,
    finalScore
) {
    requireMoney(
        payPotential,
        "BROKER95_PAY_POTENTIAL_INVALID"
    );

    return Math.round(
        payPotential *
        getBrokerPayoutMultiplier(
            finalScore
        )
    );
}

export function requireBrokerPayPotential(
    risk,
    payPotential
) {
    requireMoney(
        payPotential,
        "BROKER95_PAY_POTENTIAL_INVALID"
    );

    const [minimum, maximum] =
        getBrokerRiskRule(risk)
            .payRange;

    if (
        payPotential < minimum ||
        payPotential > maximum
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_PAY_OUT_OF_RANGE",
            "La paga potencial no corresponde al nivel de riesgo del contrato.",
            [{
                risk,
                payPotential,
                minimum,
                maximum
            }]
        );
    }

    return payPotential;
}

export function requireBrokerScore(score) {
    return requireScore(score);
}

export function requireBrokerMoney(value) {
    return requireMoney(
        value,
        "BROKER95_MONEY_INVALID"
    );
}

function requireScore(score) {
    if (
        !Number.isInteger(score) ||
        score < 0 ||
        score > 100
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_SCORE_INVALID",
            "Las puntuaciones deben ser números enteros entre 0 y 100.",
            [{ score }]
        );
    }

    return score;
}

function requireMoney(value, code) {
    if (
        !Number.isInteger(value) ||
        value < 0
    ) {
        throw BrokerGameError.invalidRule(
            code,
            "El monto indicado no es válido.",
            [{ value }]
        );
    }

    return value;
}
