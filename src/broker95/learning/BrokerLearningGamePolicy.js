import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    BrokerCriterion,
    BrokerRisk,
    getBrokerRiskRule
} from "../core/BrokerRiskRules.js";

export const BROKER_LEARNING_GAME_POLICY =
    Object.freeze({
        risk: BrokerRisk.LOW,
        alertDelta: 0,
        evaluatedCriteria: Object.freeze([
            BrokerCriterion.FUNCTIONALITY
        ]),
        preserveProgressOnGameOver: true,
        resetProgressOnExplicitReset: true
    });

/**
 * Mantiene alineadas las reglas educativas con la tabla general del juego.
 * Si el riesgo bajo cambia en el futuro, un contrato de aprendizaje no debe
 * adquirir alerta ni dimensiones académicas adicionales silenciosamente.
 */
export function requireBrokerLearningGamePolicy() {
    const riskRule = getBrokerRiskRule(
        BROKER_LEARNING_GAME_POLICY.risk
    );
    const expectedCriteria =
        BROKER_LEARNING_GAME_POLICY
            .evaluatedCriteria;
    const criteriaMatch =
        riskRule.activeCriteria.length ===
            expectedCriteria.length &&
        expectedCriteria.every(
            (criterion, index) =>
                riskRule.activeCriteria[index] ===
                    criterion
        );

    if (
        riskRule.alertIncrement !==
            BROKER_LEARNING_GAME_POLICY
                .alertDelta ||
        !criteriaMatch ||
        riskRule.weights[
            BrokerCriterion.FUNCTIONALITY
        ] !== 1
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_LEARNING_GAME_POLICY_INVALID",
            "La política de aprendizaje no coincide con las reglas generales de BROKER.95.",
            []
        );
    }

    return BROKER_LEARNING_GAME_POLICY;
}
