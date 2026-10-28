import { BrokerGameError } from "../core/BrokerGameError.js";

/** Una dependencia de infraestructura ausente no debe convertirse en una nota. */
export function assertBrokerTestEnvironment(execution) {
    if (execution.testCases?.some(item => item.reason === "runtime-preparation-failed")) {
        throw BrokerGameError.invalidRule("BROKER95_TEST_EXECUTION_GENERATION_FAILED",
            "No se puede evaluar el programa porque no fue posible preparar el runtime gráfico. Revisa el diagnóstico GUI en las pruebas y vuelve a intentarlo. No se ha calificado ni liquidado el contrato.", []);
    }
    if (execution.testCases?.some(item => item.reason === "cancelled")) {
        throw BrokerGameError.invalidRule("BROKER95_TEST_EXECUTION_GENERATION_FAILED",
            "Las pruebas fueron canceladas. No se ha calificado ni liquidado el contrato.", []);
    }
}
