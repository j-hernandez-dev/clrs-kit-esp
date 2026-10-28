import assert from "node:assert/strict";
import test from "node:test";

import {
    BrokerLlmAvailabilityError,
    BrokerLlmAvailabilityReason,
    BrokerLlmAvailabilityService,
    BrokerLlmStatus,
    BrokerLlmStatusReason,
    assertBrokerLlmAvailable,
    classifyBrokerLlmFailure,
    createBrokerLlmAvailability
} from "../src/broker95/index.js";

test("cada indisponibilidad de CIPHER tiene un estado y mensaje propio", () => {
    const reasons = [
        BrokerLlmAvailabilityReason.MODEL_MISSING,
        BrokerLlmAvailabilityReason.API_KEY_MISSING,
        BrokerLlmAvailabilityReason.OFFLINE,
        BrokerLlmAvailabilityReason.QUOTA_EXHAUSTED,
        BrokerLlmAvailabilityReason.AUTHENTICATION_FAILED,
        BrokerLlmAvailabilityReason.MODEL_UNAVAILABLE,
        BrokerLlmAvailabilityReason.TIMEOUT,
        BrokerLlmAvailabilityReason.PROVIDER_ERROR,
        BrokerLlmAvailabilityReason.INVALID_RESPONSE
    ];
    const messages = reasons.map(reason => {
        const availability =
            createBrokerLlmAvailability(reason);

        assert.notEqual(
            availability.status,
            BrokerLlmStatus.READY
        );
        assert.ok(
            availability.terminalMessage.startsWith(
                "CIPHER "
            )
        );
        assert.ok(
            availability.code.startsWith("BROKER95_LLM_")
        );

        return availability.terminalMessage;
    });

    assert.equal(new Set(messages).size, reasons.length);
});

test("clasifica configuración, HTTP y fallos de transporte sin exponer detalles", () => {
    const cases = [
        [
            {
                code: "BROKER95_LLM_UNCONFIGURED",
                diagnostics: [{
                    reason: "model_missing"
                }]
            },
            BrokerLlmAvailabilityReason.MODEL_MISSING
        ],
        [
            {
                code: "BROKER95_LLM_UNCONFIGURED",
                diagnostics: [{
                    reason: "api_key_missing"
                }]
            },
            BrokerLlmAvailabilityReason.API_KEY_MISSING
        ],
        [
            {
                code: "BROKER95_GROQ_HTTP_FAILED",
                diagnostics: [{ status: 401 }]
            },
            BrokerLlmAvailabilityReason
                .AUTHENTICATION_FAILED
        ],
        [
            {
                code: "BROKER95_GROQ_HTTP_FAILED",
                diagnostics: [{ status: 404 }]
            },
            BrokerLlmAvailabilityReason
                .MODEL_UNAVAILABLE
        ],
        [
            {
                code: "BROKER95_GROQ_HTTP_FAILED",
                diagnostics: [{ status: 429 }]
            },
            BrokerLlmAvailabilityReason.QUOTA_EXHAUSTED
        ],
        [
            { code: "BROKER95_GROQ_NETWORK_FAILED" },
            BrokerLlmAvailabilityReason.OFFLINE
        ],
        [
            { code: "BROKER95_GROQ_TIMEOUT" },
            BrokerLlmAvailabilityReason.TIMEOUT
        ],
        [
            { code: "BROKER95_GROQ_RESPONSE_INVALID" },
            BrokerLlmAvailabilityReason.INVALID_RESPONSE
        ]
    ];

    for (const [error, reason] of cases) {
        const availability =
            classifyBrokerLlmFailure(error);

        assert.equal(availability.reason, reason);
        assert.equal(
            availability.terminalMessage
                .includes("GROQ"),
            false
        );
    }

    assert.equal(
        classifyBrokerLlmFailure({
            code: "BROKER95_LLM_REQUEST_ABORTED"
        }),
        null
    );
});

test("los fallos transitorios no bloquean las solicitudes posteriores", () => {
    const source = createConfigurationSource(
        configuredSnapshot()
    );
    const service = new BrokerLlmAvailabilityService({
        configuration: source,
        developerLogger: { error() {} }
    });
    const received = [];
    const subscription = service.subscribe(snapshot => {
        received.push(snapshot.llmStatus);
    });

    assert.equal(
        service.getLlmStatus().status,
        BrokerLlmStatus.READY
    );
    for (const error of [
        { code: "BROKER95_GROQ_RESPONSE_INVALID" },
        { code: "BROKER95_GROQ_TIMEOUT" },
        {
            code: "BROKER95_GROQ_HTTP_FAILED",
            diagnostics: [{ status: 429 }]
        }
    ]) {
        const failure = service.recordFailure(error);

        assert.notEqual(
            failure.reason,
            BrokerLlmStatusReason.READY
        );
        assert.equal(
            service.getLlmStatus().reason,
            BrokerLlmStatusReason.READY
        );
    }

    assert.equal(received.length, 0);

    subscription.dispose();
    service.dispose();
});

test("los fallos de credencial o modelo permanecen hasta corregir la configuración", () => {
    const source = createConfigurationSource(
        configuredSnapshot()
    );
    const service = new BrokerLlmAvailabilityService({
        configuration: source,
        developerLogger: { error() {} }
    });
    const received = [];
    const subscription = service.subscribe(snapshot => {
        received.push(snapshot.llmStatus);
    });

    service.recordFailure({
        code: "BROKER95_GROQ_HTTP_FAILED",
        diagnostics: [{ status: 401 }]
    });

    assert.equal(
        service.getLlmStatus().reason,
        BrokerLlmAvailabilityReason
            .AUTHENTICATION_FAILED
    );
    assert.equal(received.length, 1);

    source.publish(configuredSnapshot({
        model: "modelo-corregido"
    }));

    assert.equal(
        service.getLlmStatus().reason,
        BrokerLlmStatusReason.READY
    );
    assert.equal(received.length, 2);

    subscription.dispose();
    service.dispose();
});

test("la compuerta rechaza solicitudes LLM sin tocar la operación", () => {
    const unavailable = createBrokerLlmAvailability(
        BrokerLlmAvailabilityReason.MODEL_MISSING
    );

    assert.throws(
        () => assertBrokerLlmAvailable({
            status: unavailable.status,
            reason: unavailable.reason,
            message: unavailable.message
        }),
        error =>
            error instanceof BrokerLlmAvailabilityError &&
            error.code ===
                "BROKER95_LLM_MODEL_MISSING" &&
            error.publicMessage.includes(
                "CIPHER DESCONECTADO"
            )
    );
});

function configuredSnapshot(options = {}) {
    const model = options.model ?? "modelo";

    return Object.freeze({
        settings: Object.freeze({
            model,
            hasApiKey: true
        }),
        llmStatus: Object.freeze({
            status: BrokerLlmStatus.READY,
            reason: BrokerLlmStatusReason.READY,
            message: "CIPHER está configurado."
        })
    });
}

function createConfigurationSource(initial) {
    let current = initial;
    const listeners = new Set();

    return {
        getSnapshot() {
            return current;
        },
        subscribe(listener) {
            listeners.add(listener);

            return {
                dispose() {
                    listeners.delete(listener);
                }
            };
        },
        publish(next) {
            current = next;

            for (const listener of listeners) {
                listener(next);
            }
        }
    };
}
