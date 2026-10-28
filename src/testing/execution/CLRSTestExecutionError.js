import {
    ApplicationError
} from "../../errors/ApplicationError.js";

/**
 * Error de infraestructura o configuración de la ejecución de pruebas.
 */
export class CLRSTestExecutionError extends ApplicationError {

    constructor(code, publicMessage, options = {}) {
        super(
            `CLRS test execution failure: ${code}.`,
            {
                code,
                publicMessage,
                cause: options.cause,
                audience:
                    options.audience ?? "user",
                diagnostics:
                    options.diagnostics ?? []
            }
        );

        this.name = "CLRSTestExecutionError";
    }

    static invalidRequest(code, field = null) {
        return new CLRSTestExecutionError(
            code,
            "No fue posible preparar la ejecución de la prueba CLRS.",
            {
                diagnostics: field == null
                    ? []
                    : [{ field }]
            }
        );
    }

    static invalidPort(name, methods) {
        return new CLRSTestExecutionError(
            "CLRS_TEST_EXECUTION_CONFIGURATION_INVALID",
            "El servicio de pruebas CLRS no está disponible.",
            {
                audience: "developer",
                diagnostics: [{
                    dependency: name,
                    expected: methods
                        .map(method => `${method}()`)
                        .join(", ")
                }]
            }
        );
    }
}
