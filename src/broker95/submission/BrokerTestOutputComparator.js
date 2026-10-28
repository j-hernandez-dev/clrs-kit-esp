import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    createBrokerTestCase
} from "../core/BrokerTestCase.js";
import {
    compareCLRSTestOutput
} from "../../testing/index.js";

/**
 * Compara la salida textual de un programa CLRS con el oraculo declarativo
 * validado del contrato. No evalua JavaScript ni regex sin acotar.
 */
export function compareBrokerTestOutput(
    testCase,
    actualOutput
) {
    const expectedCase = createBrokerTestCase(testCase);
    return compareCLRSTestOutput(
        {
            comparison: expectedCase.comparison,
            stdout: expectedCase.expected
        },
        requireOutput(actualOutput)
    );
}

function requireOutput(value) {
    if (typeof value !== "string") {
        throw BrokerGameError.invalidRule(
            "BROKER95_TEST_OUTPUT_INVALID",
            "La salida de la prueba no es valida.",
            []
        );
    }

    return value;
}
