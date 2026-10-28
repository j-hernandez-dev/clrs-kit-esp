import {
    BrokerLLMProtocolError
} from "./BrokerLLMProtocol.js";

export const BrokerLLMProviderId =
    Object.freeze({
        GROQ: "groq",
        GEMINI: "gemini",
        DEEPSEEK: "deepseek",
        OLLAMA: "ollama",
        OPENAI: "openai",
        LM_STUDIO: "lm-studio",
        XAI: "xai",
        TOGETHER: "together",
        ZAI: "zai",
        HUGGING_FACE: "hugging-face",
        OPENROUTER: "openrouter"
    });

export const BROKER_DEFAULT_LLM_PROVIDER_ID =
    BrokerLLMProviderId.GROQ;

export const BrokerLLMCredentialKind =
    Object.freeze({
        API_KEY: "api-key",
        OPTIONAL_API_KEY: "optional-api-key",
        NONE: "none"
    });

export const BrokerLLMEndpointKind =
    Object.freeze({
        REMOTE: "remote",
        LOCAL: "local"
    });

export const BrokerLLMCapabilitySupport =
    Object.freeze({
        SUPPORTED: "supported",
        MODEL_DEPENDENT: "model-dependent",
        UNSUPPORTED: "unsupported"
    });

const PROVIDERS = Object.freeze({
    [BrokerLLMProviderId.GROQ]:
        createBrokerLLMProviderDescriptor({
            id: BrokerLLMProviderId.GROQ,
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
        }),
    [BrokerLLMProviderId.GEMINI]:
        createBrokerLLMProviderDescriptor({
            id: BrokerLLMProviderId.GEMINI,
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
        }),
    [BrokerLLMProviderId.DEEPSEEK]:
        createBrokerLLMProviderDescriptor({
            id: BrokerLLMProviderId.DEEPSEEK,
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
        }),
    [BrokerLLMProviderId.OLLAMA]:
        createBrokerLLMProviderDescriptor({
            id: BrokerLLMProviderId.OLLAMA,
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
        }),
    [BrokerLLMProviderId.OPENAI]:
        createBrokerLLMProviderDescriptor({
            id: BrokerLLMProviderId.OPENAI,
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
        }),
    [BrokerLLMProviderId.LM_STUDIO]:
        createBrokerLLMProviderDescriptor({
            id: BrokerLLMProviderId.LM_STUDIO,
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
        }),
    [BrokerLLMProviderId.XAI]:
        createBrokerLLMProviderDescriptor({
            id: BrokerLLMProviderId.XAI,
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
        }),
    [BrokerLLMProviderId.TOGETHER]:
        createBrokerLLMProviderDescriptor({
            id: BrokerLLMProviderId.TOGETHER,
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
        }),
    [BrokerLLMProviderId.ZAI]:
        createBrokerLLMProviderDescriptor({
            id: BrokerLLMProviderId.ZAI,
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
        }),
    [BrokerLLMProviderId.HUGGING_FACE]:
        createBrokerLLMProviderDescriptor({
            id: BrokerLLMProviderId.HUGGING_FACE,
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
        }),
    [BrokerLLMProviderId.OPENROUTER]:
        createBrokerLLMProviderDescriptor({
            id: BrokerLLMProviderId.OPENROUTER,
            label: "OpenRouter",
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
        })
});

export function createBrokerLLMProviderDescriptor(
    source
) {
    if (!isRecord(source)) {
        invalidProvider("descriptor");
    }

    requireExactKeys(source, [
        "id",
        "label",
        "credentialKind",
        "endpointKind",
        "capabilities"
    ]);

    const capabilities = source.capabilities;

    if (!isRecord(capabilities)) {
        invalidProvider("capabilities");
    }

    requireExactKeys(capabilities, [
        "streaming",
        "jsonObject",
        "strictJsonSchema",
        "connectionTest"
    ]);

    return Object.freeze({
        id: normalizeBrokerLLMProviderId(
            source.id
        ),
        label: requireLabel(source.label),
        credentialKind: requireEnum(
            source.credentialKind,
            BrokerLLMCredentialKind,
            "credentialKind"
        ),
        endpointKind: requireEnum(
            source.endpointKind,
            BrokerLLMEndpointKind,
            "endpointKind"
        ),
        capabilities: Object.freeze({
            streaming: requireSupport(
                capabilities.streaming
            ),
            jsonObject: requireSupport(
                capabilities.jsonObject
            ),
            strictJsonSchema: requireSupport(
                capabilities.strictJsonSchema
            ),
            connectionTest: requireSupport(
                capabilities.connectionTest
            )
        })
    });
}

export function normalizeBrokerLLMProviderId(
    value
) {
    if (
        typeof value !== "string" ||
        !/^[a-z][a-z0-9-]{1,31}$/u.test(value)
    ) {
        invalidProvider("providerId");
    }

    return value;
}

export function requireRegisteredBrokerLLMProviderId(
    value
) {
    const providerId =
        normalizeBrokerLLMProviderId(value);

    if (!Object.hasOwn(PROVIDERS, providerId)) {
        invalidProvider("providerId");
    }

    return providerId;
}

export function getBrokerLLMProviderDescriptor(
    providerId
) {
    return PROVIDERS[
        requireRegisteredBrokerLLMProviderId(
            providerId
        )
    ];
}

export function listBrokerLLMProviderDescriptors() {
    return Object.freeze(
        Object.values(PROVIDERS)
    );
}

function requireSupport(value) {
    return requireEnum(
        value,
        BrokerLLMCapabilitySupport,
        "capability"
    );
}

function requireEnum(value, enumeration, field) {
    if (!Object.values(enumeration).includes(value)) {
        invalidProvider(field);
    }

    return value;
}

function requireLabel(value) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > 64 ||
        /[\u0000-\u001F\u007F]/u.test(value)
    ) {
        invalidProvider("label");
    }

    return value.trim();
}

function requireExactKeys(value, expected) {
    const keys = Object.keys(value).sort();
    const selected = [...expected].sort();

    if (
        keys.length !== selected.length ||
        keys.some(
            (key, index) =>
                key !== selected[index]
        )
    ) {
        invalidProvider("descriptor");
    }
}

function isRecord(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) ===
            Object.prototype;
}

function invalidProvider(field) {
    throw BrokerLLMProtocolError
        .invalidRequest(field);
}
