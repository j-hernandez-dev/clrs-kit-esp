import {
    createBrokerRequirementIds,
    createBrokerTestCases
} from "../core/BrokerTestCase.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";

/**
 * Valida la respuesta declarativa de CIPHER sin ejecutar ninguna parte de
 * ella. La ejecuciÃ³n controlada corresponde al bloque 5.2.
 */
export class BrokerTestCaseValidator {

    validate(proposal, options = {}) {
        if (!Array.isArray(options.requirements)) {
            throw BrokerGameError.invalidRule(
                "BROKER95_TEST_CASE_REQUIREMENTS_INVALID",
                "No fue posible validar los casos de prueba del contrato.",
                []
            );
        }

        const requirementIds = createBrokerRequirementIds(
            options.requirements,
            options.requirementIds
        );

        return createBrokerTestCases(
            proposal,
            requirementIds,
            {
                requireAtLeastOne: true,
                requireExplanation: true
            }
        );
    }
}

export const brokerTestCaseValidator =
    Object.freeze(new BrokerTestCaseValidator());

export function validateBrokerTestCases(
    proposal,
    options
) {
    return brokerTestCaseValidator.validate(
        proposal,
        options
    );
}
