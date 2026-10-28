import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER_DEFAULT_LLM_PROVIDER_ID,
    BrokerLLMCapabilitySupport,
    BrokerLLMCredentialKind,
    BrokerLLMEndpointKind,
    BrokerLLMPort,
    BrokerLLMProviderId,
    createBrokerLLMProviderDescriptor,
    getBrokerLLMProviderDescriptor,
    listBrokerLLMProviderDescriptors,
    requireRegisteredBrokerLLMProviderId
} from "../src/broker95/llm/index.js";

test(
    "registra los proveedores de CIPHER mediante descriptores neutrales verificables",
    () => {
        const providers =
            listBrokerLLMProviderDescriptors();
        const groq =
            getBrokerLLMProviderDescriptor(
                BrokerLLMProviderId.GROQ
            );
        const gemini =
            getBrokerLLMProviderDescriptor(
                BrokerLLMProviderId.GEMINI
            );
        const deepseek =
            getBrokerLLMProviderDescriptor(
                BrokerLLMProviderId.DEEPSEEK
            );
        const ollama =
            getBrokerLLMProviderDescriptor(
                BrokerLLMProviderId.OLLAMA
            );
        const openai =
            getBrokerLLMProviderDescriptor(
                BrokerLLMProviderId.OPENAI
            );
        const lmStudio =
            getBrokerLLMProviderDescriptor(
                BrokerLLMProviderId.LM_STUDIO
            );
        const xai =
            getBrokerLLMProviderDescriptor(
                BrokerLLMProviderId.XAI
            );
        const together =
            getBrokerLLMProviderDescriptor(
                BrokerLLMProviderId.TOGETHER
            );
        const zai =
            getBrokerLLMProviderDescriptor(
                BrokerLLMProviderId.ZAI
            );
        const huggingFace = getBrokerLLMProviderDescriptor(
            BrokerLLMProviderId.HUGGING_FACE
        );
        const openRouter = getBrokerLLMProviderDescriptor(
            BrokerLLMProviderId.OPENROUTER
        );

        assert.equal(
            BROKER_DEFAULT_LLM_PROVIDER_ID,
            BrokerLLMProviderId.GROQ
        );
        assert.deepEqual(
            providers,
            [
                groq,
                gemini,
                deepseek,
                ollama,
                openai,
                lmStudio,
                xai,
                together,
                zai,
                huggingFace,
                openRouter
            ]
        );
        assert.deepEqual(groq, {
            id: "groq",
            label: "Groq",
            credentialKind:
                BrokerLLMCredentialKind.API_KEY,
            endpointKind:
                BrokerLLMEndpointKind.REMOTE,
            capabilities: {
                streaming:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                jsonObject:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                strictJsonSchema:
                    BrokerLLMCapabilitySupport
                        .MODEL_DEPENDENT,
                connectionTest:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED
            }
        });
        assert.equal(Object.isFrozen(providers), true);
        assert.equal(Object.isFrozen(groq), true);
        assert.equal(
            Object.isFrozen(groq.capabilities),
            true
        );
        assert.deepEqual(gemini, {
            id: "gemini",
            label: "Gemini",
            credentialKind:
                BrokerLLMCredentialKind.API_KEY,
            endpointKind:
                BrokerLLMEndpointKind.REMOTE,
            capabilities: {
                streaming:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                jsonObject:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                strictJsonSchema:
                    BrokerLLMCapabilitySupport
                        .MODEL_DEPENDENT,
                connectionTest:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED
            }
        });
        assert.deepEqual(deepseek, {
            id: "deepseek",
            label: "DeepSeek",
            credentialKind:
                BrokerLLMCredentialKind.API_KEY,
            endpointKind:
                BrokerLLMEndpointKind.REMOTE,
            capabilities: {
                streaming:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                jsonObject:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                strictJsonSchema:
                    BrokerLLMCapabilitySupport
                        .UNSUPPORTED,
                connectionTest:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED
            }
        });
        assert.deepEqual(ollama, {
            id: "ollama",
            label: "Ollama (local)",
            credentialKind:
                BrokerLLMCredentialKind.NONE,
            endpointKind:
                BrokerLLMEndpointKind.LOCAL,
            capabilities: {
                streaming:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                jsonObject:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                strictJsonSchema:
                    BrokerLLMCapabilitySupport
                        .MODEL_DEPENDENT,
                connectionTest:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED
            }
        });
        assert.deepEqual(openai, {
            id: "openai",
            label: "OpenAI",
            credentialKind:
                BrokerLLMCredentialKind.API_KEY,
            endpointKind:
                BrokerLLMEndpointKind.REMOTE,
            capabilities: {
                streaming:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                jsonObject:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                strictJsonSchema:
                    BrokerLLMCapabilitySupport
                        .MODEL_DEPENDENT,
                connectionTest:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED
            }
        });
        assert.deepEqual(lmStudio, {
            id: "lm-studio",
            label: "LM Studio (local)",
            credentialKind:
                BrokerLLMCredentialKind
                    .OPTIONAL_API_KEY,
            endpointKind:
                BrokerLLMEndpointKind.LOCAL,
            capabilities: {
                streaming:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                jsonObject:
                    BrokerLLMCapabilitySupport
                        .MODEL_DEPENDENT,
                strictJsonSchema:
                    BrokerLLMCapabilitySupport
                        .MODEL_DEPENDENT,
                connectionTest:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED
            }
        });
        assert.deepEqual(xai, {
            id: "xai",
            label: "xAI",
            credentialKind:
                BrokerLLMCredentialKind.API_KEY,
            endpointKind:
                BrokerLLMEndpointKind.REMOTE,
            capabilities: {
                streaming:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                jsonObject:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                strictJsonSchema:
                    BrokerLLMCapabilitySupport
                        .MODEL_DEPENDENT,
                connectionTest:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED
            }
        });
        assert.deepEqual(huggingFace, {
            id: "hugging-face",
            label: "Hugging Face",
            credentialKind:
                BrokerLLMCredentialKind.API_KEY,
            endpointKind:
                BrokerLLMEndpointKind.REMOTE,
            capabilities: {
                streaming:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                jsonObject:
                    BrokerLLMCapabilitySupport
                        .MODEL_DEPENDENT,
                strictJsonSchema:
                    BrokerLLMCapabilitySupport
                        .MODEL_DEPENDENT,
                connectionTest:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED
            }
        });
        assert.deepEqual(openRouter, {
            ...huggingFace,
            id: "openrouter",
            label: "OpenRouter"
        });
        assert.deepEqual(together, {
            id: "together",
            label: "Together AI",
            credentialKind:
                BrokerLLMCredentialKind.API_KEY,
            endpointKind:
                BrokerLLMEndpointKind.REMOTE,
            capabilities: {
                streaming:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                jsonObject:
                    BrokerLLMCapabilitySupport
                        .MODEL_DEPENDENT,
                strictJsonSchema:
                    BrokerLLMCapabilitySupport
                        .MODEL_DEPENDENT,
                connectionTest:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED
            }
        });
        assert.deepEqual(zai, {
            id: "zai",
            label: "Z.AI",
            credentialKind:
                BrokerLLMCredentialKind.API_KEY,
            endpointKind:
                BrokerLLMEndpointKind.REMOTE,
            capabilities: {
                streaming:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                jsonObject:
                    BrokerLLMCapabilitySupport
                        .MODEL_DEPENDENT,
                strictJsonSchema:
                    BrokerLLMCapabilitySupport
                        .MODEL_DEPENDENT,
                connectionTest:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED
            }
        });
    }
);

test(
    "permite describir adaptadores futuros sin registrarlos prematuramente",
    () => {
        const local =
            createBrokerLLMProviderDescriptor({
                id: "local-test",
                label: "Proveedor local",
                credentialKind:
                    BrokerLLMCredentialKind.NONE,
                endpointKind:
                    BrokerLLMEndpointKind.LOCAL,
                capabilities: {
                    streaming:
                        BrokerLLMCapabilitySupport
                            .SUPPORTED,
                    jsonObject:
                        BrokerLLMCapabilitySupport
                            .MODEL_DEPENDENT,
                    strictJsonSchema:
                        BrokerLLMCapabilitySupport
                            .UNSUPPORTED,
                    connectionTest:
                        BrokerLLMCapabilitySupport
                            .SUPPORTED
                }
            });

        assert.equal(local.id, "local-test");
        assert.equal(
            local.endpointKind,
            BrokerLLMEndpointKind.LOCAL
        );
        assert.throws(
            () => requireRegisteredBrokerLLMProviderId(
                local.id
            ),
            error =>
                error.code ===
                    "BROKER95_LLM_REQUEST_INVALID"
        );
    }
);

test("no ofrece ni permite seleccionar el proveedor retirado", () => {
    assert.equal(Object.hasOwn(BrokerLLMProviderId, "ANTHROPIC"), false);
    assert.equal(listBrokerLLMProviderDescriptors().some(
        provider => provider.id === "anthropic"
    ), false);
    assert.throws(
        () => requireRegisteredBrokerLLMProviderId("anthropic"),
        providerError
    );
});

test(
    "el puerto conserva la identidad del adaptador en cada resultado",
    async () => {
        const port = new ProviderTestPort();
        const result = await port.testConnection({
            requestId: "provider:test:1",
            model: "modelo-local"
        });

        assert.equal(
            port.getProviderId(),
            "local-test"
        );
        assert.equal(
            result.providerId,
            "local-test"
        );
        assert.equal(result.output.connected, true);
        assert.equal(Object.isFrozen(result), true);
    }
);

test(
    "rechaza descriptores ambiguos o capacidades desconocidas",
    () => {
        const valid = {
            id: "provider-test",
            label: "Provider Test",
            credentialKind:
                BrokerLLMCredentialKind.API_KEY,
            endpointKind:
                BrokerLLMEndpointKind.REMOTE,
            capabilities: {
                streaming:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                jsonObject:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                strictJsonSchema:
                    BrokerLLMCapabilitySupport
                        .UNSUPPORTED,
                connectionTest:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED
            }
        };

        assert.throws(
            () => createBrokerLLMProviderDescriptor({
                ...valid,
                extra: true
            }),
            providerError
        );
        assert.throws(
            () => createBrokerLLMProviderDescriptor({
                ...valid,
                capabilities: {
                    ...valid.capabilities,
                    streaming: "sometimes"
                }
            }),
            providerError
        );
        assert.throws(
            () => getBrokerLLMProviderDescriptor(
                "unregistered-provider"
            ),
            providerError
        );
    }
);

class ProviderTestPort extends BrokerLLMPort {

    constructor() {
        super({ providerId: "local-test" });
    }

    async performRequest() {
        return {
            output: JSON.stringify({
                connected: true,
                message: "Proveedor disponible."
            })
        };
    }
}

function providerError(error) {
    return error?.code ===
        "BROKER95_LLM_REQUEST_INVALID";
}
