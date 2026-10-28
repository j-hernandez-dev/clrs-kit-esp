import {
    BrokerProtocolError
} from "./BrokerProtocolError.js";

const DEFAULT_MAX_IN_FLIGHT = 8;
const DEFAULT_MAX_REMEMBERED = 512;
const DEFAULT_MAX_REQUESTS_PER_WINDOW = 120;
const DEFAULT_WINDOW_MS = 10_000;

/**
 * Protege el transporte Webview -> Host una vez validado el envelope.
 * El Webview nunca es una frontera de confianza, aunque el mensaje tenga
 * una forma protocolaria correcta.
 */
export class BrokerWebviewRequestGuard {

    constructor(options = {}) {
        this.maxInFlight = requirePositiveInteger(
            options.maxInFlight ??
                DEFAULT_MAX_IN_FLIGHT,
            "maxInFlight"
        );
        this.maxRemembered = requirePositiveInteger(
            options.maxRemembered ??
                DEFAULT_MAX_REMEMBERED,
            "maxRemembered"
        );
        this.maxRequestsPerWindow =
            requirePositiveInteger(
                options.maxRequestsPerWindow ??
                    DEFAULT_MAX_REQUESTS_PER_WINDOW,
                "maxRequestsPerWindow"
            );
        this.windowMs = requirePositiveInteger(
            options.windowMs ??
                DEFAULT_WINDOW_MS,
            "windowMs"
        );
        this.clock = requireClock(
            options.clock ?? Date.now
        );
        this.remembered = new Set();
        this.rememberedOrder = [];
        this.inFlight = new Map();
        this.requestTimes = [];
    }

    begin(message) {
        const requestId = message?.requestId;

        if (
            typeof requestId !== "string" ||
            requestId.length === 0
        ) {
            throw new BrokerProtocolError(
                "BROKER95_PROTOCOL_REQUEST_ID_INVALID",
                "La solicitud de BROKER.95 no tiene un identificador válido."
            );
        }

        if (this.remembered.has(requestId)) {
            throw new BrokerProtocolError(
                "BROKER95_PROTOCOL_REQUEST_REPLAYED",
                "La solicitud ya fue procesada y no puede repetirse."
            );
        }

        const now = requireTimestamp(
            this.clock()
        );

        this.#remember(requestId);
        this.#pruneRequestTimes(now);

        if (
            this.requestTimes.length >=
            this.maxRequestsPerWindow
        ) {
            throw new BrokerProtocolError(
                "BROKER95_PROTOCOL_RATE_LIMITED",
                "BROKER.95 recibió demasiadas solicitudes. Inténtalo de nuevo en unos momentos."
            );
        }

        this.requestTimes.push(now);

        if (
            this.inFlight.size >=
            this.maxInFlight
        ) {
            throw new BrokerProtocolError(
                "BROKER95_PROTOCOL_REQUEST_LIMIT_EXCEEDED",
                "BROKER.95 está procesando demasiadas solicitudes. Inténtalo de nuevo en unos momentos."
            );
        }

        const token = Symbol(requestId);

        this.inFlight.set(requestId, token);

        let released = false;

        return Object.freeze({
            release: () => {
                if (released) {
                    return;
                }

                released = true;

                if (
                    this.inFlight.get(requestId) ===
                    token
                ) {
                    this.inFlight.delete(requestId);
                }
            }
        });
    }

    reset() {
        this.remembered.clear();
        this.rememberedOrder.length = 0;
        this.inFlight.clear();
        this.requestTimes.length = 0;
    }

    #remember(requestId) {
        this.remembered.add(requestId);
        this.rememberedOrder.push(requestId);

        while (
            this.rememberedOrder.length >
            this.maxRemembered
        ) {
            const expired =
                this.rememberedOrder.shift();

            this.remembered.delete(expired);
        }
    }

    #pruneRequestTimes(now) {
        const threshold = now - this.windowMs;
        let firstCurrent = 0;

        while (
            firstCurrent <
                this.requestTimes.length &&
            this.requestTimes[firstCurrent] <=
                threshold
        ) {
            firstCurrent += 1;
        }

        if (firstCurrent > 0) {
            this.requestTimes.splice(
                0,
                firstCurrent
            );
        }
    }
}

function requirePositiveInteger(value, name) {
    if (
        !Number.isSafeInteger(value) ||
        value < 1
    ) {
        throw new TypeError(
            `BROKER.95 request guard ${name} must be a positive integer.`
        );
    }

    return value;
}

function requireClock(value) {
    if (typeof value !== "function") {
        throw new TypeError(
            "BROKER.95 request guard clock must be a function."
        );
    }

    return value;
}

function requireTimestamp(value) {
    if (
        !Number.isFinite(value) ||
        value < 0
    ) {
        throw new TypeError(
            "BROKER.95 request guard clock returned an invalid timestamp."
        );
    }

    return value;
}
