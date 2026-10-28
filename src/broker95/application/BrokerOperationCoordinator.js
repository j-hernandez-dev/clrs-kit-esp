import {
    createHash
} from "node:crypto";

import {
    requireFunction
} from "../../application/ports/ApplicationPorts.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";

const DEFAULT_MAX_COMPLETED = 64;
const MAX_FINGERPRINT_SOURCE_LENGTH =
    131_072;
const NAME_PATTERN =
    /^[a-z][a-z0-9._/-]{0,127}$/u;
const REQUEST_ID_PATTERN =
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const FINGERPRINT_PATTERN =
    /^[a-f0-9]{64}$/u;

/**
 * Coordina una operación lógica completa, no sólo su escritura final.
 * Proporciona single-flight, idempotencia acotada y exclusión por recurso.
 */
export class BrokerOperationCoordinator {

    constructor(options = {}) {
        this.maxCompleted =
            requirePositiveInteger(
                options.maxCompleted ??
                    DEFAULT_MAX_COMPLETED,
                "maxCompleted"
            );
        this.records = new Map();
        this.completedOrder = [];
        this.lanes = new Map();
    }

    execute(descriptor, operation) {
        const selected =
            normalizeDescriptor(descriptor);
        const run = requireFunction(
            operation,
            "brokerIdempotentOperation"
        );

        if (selected.requestId != null) {
            const existing = this.records.get(
                selected.requestId
            );

            if (existing) {
                requireCompatibleRequest(
                    existing,
                    selected
                );

                return existing.promise;
            }
        }

        const promise = this.#enqueue(
            selected.lane,
            run
        );

        if (selected.requestId == null) {
            return promise;
        }

        const record = {
            operation: selected.operation,
            fingerprint:
                selected.fingerprint,
            status: "in-flight",
            promise,
            result: null
        };

        this.records.set(
            selected.requestId,
            record
        );

        void promise.then(
            result => {
                if (
                    this.records.get(
                        selected.requestId
                    ) !== record
                ) {
                    return;
                }

                record.status = "completed";
                record.result = result;
                this.completedOrder.push(
                    selected.requestId
                );
                this.#evictCompleted();
            },
            () => {
                if (
                    this.records.get(
                        selected.requestId
                    ) === record
                ) {
                    this.records.delete(
                        selected.requestId
                    );
                }
            }
        );

        return promise;
    }

    getSnapshot() {
        let inFlightCount = 0;
        let completedCount = 0;

        for (const record of this.records.values()) {
            if (record.status === "in-flight") {
                inFlightCount += 1;
            } else {
                completedCount += 1;
            }
        }

        return Object.freeze({
            inFlightCount,
            completedCount,
            laneCount: this.lanes.size
        });
    }

    clearCompleted() {
        for (const requestId of this.completedOrder) {
            const record = this.records.get(
                requestId
            );

            if (record?.status === "completed") {
                this.records.delete(requestId);
            }
        }

        this.completedOrder.length = 0;
    }

    #enqueue(lane, operation) {
        if (lane == null) {
            return Promise.resolve().then(
                operation
            );
        }

        const previous =
            this.lanes.get(lane) ??
            Promise.resolve();
        const result = previous.then(
            operation,
            operation
        );
        const tail = result.then(
            () => undefined,
            () => undefined
        );

        this.lanes.set(lane, tail);

        void tail.then(() => {
            if (this.lanes.get(lane) === tail) {
                this.lanes.delete(lane);
            }
        });

        return result;
    }

    #evictCompleted() {
        while (
            this.completedOrder.length >
            this.maxCompleted
        ) {
            const requestId =
                this.completedOrder.shift();
            const record = this.records.get(
                requestId
            );

            if (record?.status === "completed") {
                this.records.delete(requestId);
            }
        }
    }
}

export function createBrokerOperationFingerprint(
    value
) {
    const serialized = canonicalize(
        value,
        new Set()
    );

    if (
        serialized.length >
        MAX_FINGERPRINT_SOURCE_LENGTH
    ) {
        invalid(
            "BROKER95_OPERATION_FINGERPRINT_TOO_LARGE",
            "La solicitud de BROKER.95 es demasiado grande para coordinarse."
        );
    }

    return createHash("sha256")
        .update(serialized, "utf8")
        .digest("hex");
}

function normalizeDescriptor(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).some(key =>
            ![
                "operation",
                "requestId",
                "fingerprint",
                "lane"
            ].includes(key)
        ) ||
        typeof value.operation !== "string" ||
        !NAME_PATTERN.test(value.operation) ||
        (
            value.requestId != null &&
            (
                typeof value.requestId !==
                    "string" ||
                !REQUEST_ID_PATTERN.test(
                    value.requestId
                )
            )
        ) ||
        (
            value.lane != null &&
            (
                typeof value.lane !== "string" ||
                !NAME_PATTERN.test(value.lane)
            )
        ) ||
        (
            value.requestId != null &&
            (
                typeof value.fingerprint !==
                    "string" ||
                !FINGERPRINT_PATTERN.test(
                    value.fingerprint
                )
            )
        ) ||
        (
            value.requestId == null &&
            value.fingerprint != null
        )
    ) {
        invalid(
            "BROKER95_OPERATION_DESCRIPTOR_INVALID",
            "La operación de BROKER.95 no pudo coordinarse."
        );
    }

    return Object.freeze({
        operation: value.operation,
        requestId: value.requestId ?? null,
        fingerprint:
            value.fingerprint ?? null,
        lane: value.lane ?? null
    });
}

function requireCompatibleRequest(
    existing,
    requested
) {
    if (
        existing.operation !==
            requested.operation ||
        existing.fingerprint !==
            requested.fingerprint
    ) {
        invalid(
            "BROKER95_OPERATION_IDEMPOTENCY_CONFLICT",
            "La solicitud reutilizó un identificador con datos diferentes. Vuelve a intentarlo."
        );
    }
}

function canonicalize(value, ancestors) {
    if (value === null) {
        return "null";
    }

    if (typeof value === "string") {
        return JSON.stringify(value);
    }

    if (
        typeof value === "boolean" ||
        (
            typeof value === "number" &&
            Number.isFinite(value)
        )
    ) {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        requireAcyclic(value, ancestors);
        const result = `[${value.map(item =>
            canonicalize(item, ancestors)
        ).join(",")}]`;

        ancestors.delete(value);
        return result;
    }

    if (
        typeof value === "object" &&
        (
            Object.getPrototypeOf(value) ===
                Object.prototype ||
            Object.getPrototypeOf(value) === null
        )
    ) {
        requireAcyclic(value, ancestors);
        const result = `{${Object.keys(value)
            .sort()
            .map(key =>
                `${JSON.stringify(key)}:${canonicalize(value[key], ancestors)}`
            )
            .join(",")}}`;

        ancestors.delete(value);
        return result;
    }

    invalid(
        "BROKER95_OPERATION_FINGERPRINT_INVALID",
        "La solicitud contiene datos que no pueden coordinarse de forma segura."
    );
}

function requireAcyclic(value, ancestors) {
    if (ancestors.has(value)) {
        invalid(
            "BROKER95_OPERATION_FINGERPRINT_INVALID",
            "La solicitud contiene datos que no pueden coordinarse de forma segura."
        );
    }

    ancestors.add(value);
}

function requirePositiveInteger(value, name) {
    if (
        !Number.isSafeInteger(value) ||
        value < 1
    ) {
        throw new TypeError(
            `BROKER.95 operation coordinator ${name} must be a positive integer.`
        );
    }

    return value;
}

function invalid(code, publicMessage) {
    throw BrokerGameError.invalidRule(
        code,
        publicMessage,
        []
    );
}
