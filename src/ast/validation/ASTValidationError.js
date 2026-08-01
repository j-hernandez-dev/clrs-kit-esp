import { FrontendError } from "../../errors/FrontendErrors.js";

export class ASTValidationError extends FrontendError {

    constructor(message, location = null, options = {}) {
        super(
            message,
            "ASTValidationError",
            "ast-validation",
            "CLRS_INVALID_AST",
            location,
            {
                ...options,
                audience:
                    options.audience ??
                    "developer",
                publicMessage:
                    options.publicMessage ??
                    "Ocurrió un error interno al validar el programa.",
                technicalMessage:
                    options.technicalMessage ??
                    message
            }
        );
    }
}
