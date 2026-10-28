import test from "node:test";
import assert from "node:assert/strict";

import {
    BrokerLLMProviderRegistry,
    BrokerLLMCapabilitySupport,
    BrokerLLMCredentialKind,
    BrokerLLMEndpointKind,
    createBrokerLLMProviderDescriptor
} from "../src/broker95/llm/index.js";

test("enruta cada operación al proveedor seleccionado en tiempo de ejecución", async () => {
    let selected = "provider-a";
    const calls = [];
    const registry = new BrokerLLMProviderRegistry({
        resolveSelectedProviderId: () => selected
    });

    registry.register(
        descriptor("provider-a", "Proveedor A"),
        adapter("provider-a", calls)
    );
    registry.register(
        descriptor("provider-b", "Proveedor B"),
        adapter("provider-b", calls)
    );

    assert.deepEqual(
        await registry.generateContract(
            { requestId: "req-a" },
            { signal: null }
        ),
        {
            providerId: "provider-a",
            operation: "generateContract"
        }
    );

    selected = "provider-b";

    assert.deepEqual(
        await registry.askSubmission(
            { requestId: "req-ask" },
            { signal: null }
        ),
        {
            providerId: "provider-b",
            operation: "askSubmission"
        }
    );

    assert.deepEqual(
        await registry.evaluateSubmission(
            { requestId: "req-b" },
            { signal: null }
        ),
        {
            providerId: "provider-b",
            operation: "evaluateSubmission"
        }
    );
    assert.deepEqual(calls, [
        ["provider-a", "generateContract", "req-a"],
        ["provider-b", "askSubmission", "req-ask"],
        ["provider-b", "evaluateSubmission", "req-b"]
    ]);
});

test("publica únicamente descriptores de adaptadores realmente registrados", () => {
    const registry = new BrokerLLMProviderRegistry({
        resolveSelectedProviderId: () => "provider-a"
    });
    const first = descriptor(
        "provider-a",
        "Proveedor A"
    );

    registry.register(
        first,
        adapter("provider-a", [])
    );

    assert.deepEqual(
        registry.listDescriptors(),
        [first]
    );
    assert.equal(
        Object.isFrozen(
            registry.listDescriptors()
        ),
        true
    );
    assert.equal(
        registry.has("provider-b"),
        false
    );
});

test("rechaza duplicados, adaptadores discordantes y selecciones no registradas", async () => {
    const registry = new BrokerLLMProviderRegistry({
        resolveSelectedProviderId: () => "provider-b"
    });
    const first = descriptor(
        "provider-a",
        "Proveedor A"
    );

    registry.register(
        first,
        adapter("provider-a", [])
    );

    assert.throws(
        () => registry.register(
            first,
            adapter("provider-a", [])
        ),
        error =>
            error.code ===
                "BROKER95_LLM_PORT_CONFIGURATION_INVALID"
    );
    assert.throws(
        () => new BrokerLLMProviderRegistry({
            resolveSelectedProviderId: 1
        }),
        error =>
            error.code ===
                "BROKER95_LLM_PORT_CONFIGURATION_INVALID"
    );
    assert.throws(
        () => {
            const mismatched =
                new BrokerLLMProviderRegistry();

            mismatched.register(
                first,
                adapter("provider-b", [])
            );
        },
        error =>
            error.code ===
                "BROKER95_LLM_PORT_CONFIGURATION_INVALID"
    );
    assert.throws(
        () => registry.testConnection(
            { requestId: "missing" },
            {}
        ),
        error =>
            error.code ===
                "BROKER95_LLM_REQUEST_INVALID"
    );
});

function descriptor(id, label) {
    return createBrokerLLMProviderDescriptor({
        id,
        label,
        credentialKind:
            BrokerLLMCredentialKind.API_KEY,
        endpointKind:
            BrokerLLMEndpointKind.REMOTE,
        capabilities: {
            streaming:
                BrokerLLMCapabilitySupport.SUPPORTED,
            jsonObject:
                BrokerLLMCapabilitySupport.SUPPORTED,
            strictJsonSchema:
                BrokerLLMCapabilitySupport
                    .MODEL_DEPENDENT,
            connectionTest:
                BrokerLLMCapabilitySupport.SUPPORTED
        }
    });
}

function adapter(providerId, calls) {
    const invoke = operation => async request => {
        calls.push([
            providerId,
            operation,
            request.requestId
        ]);

        return Object.freeze({
            providerId,
            operation
        });
    };

    return Object.freeze({
        getProviderId() {
            return providerId;
        },
        generateContract:
            invoke("generateContract"),
        reviewSubmission:
            invoke("reviewSubmission"),
        askSubmission:
            invoke("askSubmission"),
        evaluateSubmission:
            invoke("evaluateSubmission"),
        chat: invoke("chat"),
        testConnection:
            invoke("testConnection")
    });
}
