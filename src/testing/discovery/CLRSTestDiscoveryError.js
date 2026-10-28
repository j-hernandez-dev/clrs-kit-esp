import {
    ApplicationError
} from "../../errors/ApplicationError.js";

export class CLRSTestDiscoveryError extends ApplicationError {

    constructor(code, publicMessage, options = {}) {
        super(
            `CLRS test discovery failure: ${code}.`,
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

        this.name = "CLRSTestDiscoveryError";
    }

    static invalidPort(name, methods) {
        return new CLRSTestDiscoveryError(
            "CLRS_TEST_DISCOVERY_CONFIGURATION_INVALID",
            "El descubrimiento de pruebas CLRS no está disponible.",
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

    static invalidPath(definitionPath) {
        return new CLRSTestDiscoveryError(
            "CLRS_TEST_DISCOVERY_PATH_INVALID",
            "No fue posible identificar un archivo de pruebas CLRS.",
            {
                audience: "developer",
                diagnostics: [{
                    definitionPath:
                        typeof definitionPath === "string"
                            ? definitionPath
                            : null
                }]
            }
        );
    }

    static scanFailed(cause) {
        return new CLRSTestDiscoveryError(
            "CLRS_TEST_DISCOVERY_SCAN_FAILED",
            "No fue posible buscar pruebas CLRS en el espacio de trabajo.",
            { cause }
        );
    }

    static disposed() {
        return new CLRSTestDiscoveryError(
            "CLRS_TEST_DISCOVERY_DISPOSED",
            "El descubrimiento de pruebas CLRS ya no está disponible.",
            { audience: "developer" }
        );
    }
}
