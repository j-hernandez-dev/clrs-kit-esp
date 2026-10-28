import {
    BrokerGameError
} from "../core/BrokerGameError.js";

export class BrokerTerminalError extends BrokerGameError {

    constructor(
        code,
        publicMessage,
        diagnostics = []
    ) {
        super(
            `Invalid BROKER.95 terminal input: ${code}.`,
            publicMessage,
            code,
            diagnostics
        );

        this.name = "BrokerTerminalError";
    }
}
