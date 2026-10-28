import {
    ApplicationError
} from "../../errors/ApplicationError.js";

/**
 * Error estructurado de las reglas deterministas de BROKER.95.
 * El mensaje técnico permanece en inglés y la superficie pública en español.
 */
export class BrokerGameError extends ApplicationError {

    constructor(
        technicalMessage,
        publicMessage,
        code,
        diagnostics = []
    ) {
        super(technicalMessage, {
            code,
            publicMessage,
            diagnostics
        });

        this.name = "BrokerGameError";
    }

    static invalidRule(
        code,
        publicMessage,
        diagnostics = []
    ) {
        return new BrokerGameError(
            `Invalid BROKER.95 game rule: ${code}.`,
            publicMessage,
            code,
            diagnostics
        );
    }
}
