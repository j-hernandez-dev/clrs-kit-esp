import test from "node:test";
import assert from "node:assert/strict";

import {
    BrokerLLMProviderFailureKind,
    BrokerLLMProviderRegistry,
    BrokerLLMResiliencePolicy,
    BrokerLLMProtocolError,
    BrokerLlmAvailabilityError,
    createBrokerLlmAvailability,
    createBrokerLLMProviderError
} from "../src/broker95/llm/index.js";

test("reintenta una vez una respuesta neutral inválida y conserva el resultado válido", async () => {
    let calls = 0;
    const registry = createRegistry({
        async generateContract() {
            calls += 1;

            if (calls === 1) {
                throw invalidResponse();
            }

            return { recovered: true };
        }
    });

    assert.deepEqual(
        await registry.generateContract({
            requestId: "resilience:invalid"
        }),
        { recovered: true }
    );
    assert.equal(calls, 2);
});

test("reintenta red, timeout y HTTP recuperable incluso dentro del error público", async () => {
    for (const failure of [
        providerFailure(
            BrokerLLMProviderFailureKind.NETWORK
        ),
        providerFailure(
            BrokerLLMProviderFailureKind.TIMEOUT
        ),
        providerFailure(
            BrokerLLMProviderFailureKind.HTTP,
            503
        )
    ]) {
        let calls = 0;
        const wrapped = new BrokerLlmAvailabilityError(
            createBrokerLlmAvailability(
                failure.failureKind ===
                    BrokerLLMProviderFailureKind.TIMEOUT
                    ? "timeout"
                    : "offline"
            ),
            failure
        );
        const registry = createRegistry({
            async generateContract() {
                calls += 1;

                if (calls === 1) {
                    throw wrapped;
                }

                return { recovered: true };
            }
        });

        await registry.generateContract({
            requestId: `resilience:${calls}`
        });
        assert.equal(calls, 2);
    }
});

test("no reintenta autenticación, cuota, modelo, 429, cancelación ni streaming", async () => {
    const cases = [
        providerFailure(
            BrokerLLMProviderFailureKind.AUTHENTICATION,
            401
        ),
        providerFailure(
            BrokerLLMProviderFailureKind.QUOTA,
            429
        ),
        providerFailure(
            BrokerLLMProviderFailureKind.MODEL_UNAVAILABLE,
            404
        ),
        providerFailure(
            BrokerLLMProviderFailureKind.HTTP,
            429
        ),
        Object.assign(new Error("aborted"), {
            code: "BROKER95_LLM_REQUEST_ABORTED"
        })
    ];

    for (const failure of cases) {
        let calls = 0;
        const registry = createRegistry({
            async reviewSubmission() {
                calls += 1;
                throw failure;
            }
        });

        await assert.rejects(
            registry.reviewSubmission({
                requestId: "resilience:terminal"
            }),
            error => error === failure
        );
        assert.equal(calls, 1);
    }

    let streamCalls = 0;
    const streamingRegistry = createRegistry({
        async reviewSubmission() {
            streamCalls += 1;
            throw invalidResponse();
        }
    });

    await assert.rejects(
        streamingRegistry.reviewSubmission(
            { requestId: "resilience:stream" },
            { onDelta() {} }
        )
    );
    assert.equal(streamCalls, 1);
});

test("cancela un reintento durante la espera y registra sólo metadatos seguros", async () => {
    const controller = new AbortController();
    const logs = [];
    const policy = new BrokerLLMResiliencePolicy({
        retryDelayMs: 1_000,
        delay(_milliseconds, _signal, operation) {
            controller.abort();
            throw BrokerLLMProtocolError
                .aborted(operation);
        },
        developerLogger: {
            warn(message, metadata) {
                logs.push([message, metadata]);
            }
        }
    });
    let calls = 0;
    const registry = createRegistry(
        {
            async generateContract() {
                calls += 1;
                throw providerFailure(
                    BrokerLLMProviderFailureKind.NETWORK
                );
            }
        },
        { resiliencePolicy: policy }
    );
    const pending = registry.generateContract(
        { requestId: "resilience:abort" },
        { signal: controller.signal }
    );

    await assert.rejects(
        pending,
        error => error.code ===
            "BROKER95_LLM_REQUEST_ABORTED"
    );
    assert.equal(calls, 1);
    assert.equal(logs.length, 1);
    assert.deepEqual(
        Object.keys(logs[0][1]).sort(),
        ["attempt", "code", "operation", "providerId"]
    );
});

function createRegistry(overrides, options = {}) {
    const registry = new BrokerLLMProviderRegistry({
        resolveSelectedProviderId: () => "custom",
        resiliencePolicy:
            options.resiliencePolicy ??
            new BrokerLLMResiliencePolicy({
                retryDelayMs: 0,
                developerLogger: {
                    warn() {}
                }
            })
    });
    const invoke = operation => async () => ({
        operation
    });
    const adapter = {
        getProviderId: () => "custom",
        generateContract:
            overrides.generateContract ??
            invoke("generateContract"),
        reviewSubmission:
            overrides.reviewSubmission ??
            invoke("reviewSubmission"),
        askSubmission:
            overrides.askSubmission ??
            invoke("askSubmission"),
        evaluateSubmission:
            invoke("evaluateSubmission"),
        chat: invoke("chat"),
        testConnection: invoke("testConnection")
    };

    registry.register({
        id: "custom",
        label: "Personalizado",
        credentialKind: "api-key",
        endpointKind: "remote",
        capabilities: {
            streaming: "supported",
            jsonObject: "supported",
            strictJsonSchema: "unsupported",
            connectionTest: "supported"
        }
    }, adapter);

    return registry;
}

function invalidResponse() {
    return Object.assign(
        new Error("invalid response"),
        {
            code:
                "BROKER95_LLM_RESPONSE_INVALID"
        }
    );
}

function providerFailure(failureKind, status) {
    return createBrokerLLMProviderError({
        providerId: "custom",
        operation: "generateContract",
        failureKind,
        status
    });
}
