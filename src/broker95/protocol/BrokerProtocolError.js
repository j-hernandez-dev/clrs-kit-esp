import {
    BrokerGameError
} from "../core/BrokerGameError.js";

export class BrokerProtocolError extends BrokerGameError {

    constructor(
        code,
        publicMessage,
        diagnostics = []
    ) {
        super(
            `Invalid BROKER.95 protocol message: ${code}.`,
            publicMessage,
            code,
            diagnostics
        );

        this.name = "BrokerProtocolError";
    }
}
