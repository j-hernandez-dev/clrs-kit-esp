import {
    ApplicationError
} from "../../errors/ApplicationError.js";

/**
 * Error de invariantes del dominio de pruebas CLRS.
 */
export class CLRSTestDomainError extends ApplicationError {

    constructor(code, publicMessage, diagnostics = []) {
        super(
            `Invalid CLRS testing domain value: ${code}.`,
            {
                code,
                publicMessage,
                diagnostics
            }
        );

        this.name = "CLRSTestDomainError";
    }

    static invalid(code, field = null) {
        return new CLRSTestDomainError(
            code,
            "La definición de la prueba CLRS no es válida.",
            field == null
                ? []
                : [{ field }]
        );
    }
}
