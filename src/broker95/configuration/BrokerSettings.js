import {
    BrokerConfigurationError
} from "./BrokerConfigurationError.js";
import {
    BROKER_DEFAULT_LLM_PROVIDER_ID,
    BrokerLLMEndpointKind,
    createBrokerLLMProviderDescriptor,
    listBrokerLLMProviderDescriptors,
    normalizeBrokerLLMProviderId
} from "../llm/BrokerLLMProvider.js";
import {
    createBrokerPublicCredentialState,
    normalizeBrokerLLMCredentialValue
} from "../llm/BrokerLLMCredential.js";
import {
    getBrokerDefaultLocalLlmBaseUrl,
    normalizeBrokerLocalLlmBaseUrl
} from "../llm/BrokerLLMEndpoint.js";

export const BROKER_SETTINGS_SCHEMA_VERSION = 5;

export const BROKER_DEFAULT_AUDIO_PREFERENCES =
    Object.freeze({
        muted: false,
        volume: 45
    });

export function createBrokerSettings(
    source = {}
) {
    const schemaVersion =
        source.schemaVersion ??
        BROKER_SETTINGS_SCHEMA_VERSION;

    if (
        schemaVersion !==
        BROKER_SETTINGS_SCHEMA_VERSION
    ) {
        throw BrokerConfigurationError
            .unsupportedVersion(
                "domain schema",
                schemaVersion
            );
    }

    const providerId =
        normalizeBrokerProviderId(
            source.providerId ??
                BROKER_DEFAULT_LLM_PROVIDER_ID
        );

    return Object.freeze({
        schemaVersion,
        revision: requireRevision(
            source.revision ?? 0
        ),
        providerId,
        models: normalizeBrokerProviderModels(
            source.models ?? {
                [providerId]:
                    source.model ?? ""
            },
            providerId
        ),
        baseUrls: normalizeBrokerProviderBaseUrls(
            source.baseUrls ?? {}
        ),
        audio: normalizeBrokerAudioPreferences(
            source.audio ??
                BROKER_DEFAULT_AUDIO_PREFERENCES
        )
    });
}

export function evolveBrokerSettings(
    settings,
    changes
) {
    const current = createBrokerSettings(
        settings
    );

    return createBrokerSettings({
        ...current,
        ...changes,
        revision: current.revision + 1
    });
}

export function createBrokerPublicSettings(
    settings,
    hasApiKey,
    providers =
        listBrokerLLMProviderDescriptors()
) {
    const normalized = createBrokerSettings(
        settings
    );

    if (typeof hasApiKey !== "boolean") {
        throw BrokerConfigurationError
            .invalidSettings();
    }

    const availableProviders =
        normalizeAvailableProviders(
            providers,
            normalized.providerId
        );
    const selectedDescriptor =
        availableProviders.find(
            provider =>
                provider.id ===
                    normalized.providerId
        );
    const credential =
        createBrokerPublicCredentialState(
            normalized.providerId,
            hasApiKey,
            selectedDescriptor
        );
    const baseUrl =
        selectedDescriptor.endpointKind ===
            BrokerLLMEndpointKind.LOCAL
            ? getBrokerSelectedBaseUrl(
                normalized
            )
            : null;

    return Object.freeze({
        providerId: normalized.providerId,
        providers: availableProviders,
        model: getBrokerSelectedModel(
            normalized
        ),
        credential,
        hasApiKey:
            credential.kind !== "none" &&
            credential.configured,
        ...(baseUrl == null
            ? {}
            : { baseUrl }),
        audio: normalized.audio
    });
}

export function getBrokerSelectedBaseUrl(settings) {
    const normalized = createBrokerSettings(
        settings
    );

    return normalized.baseUrls[
        normalized.providerId
    ] ?? getBrokerDefaultLocalLlmBaseUrl(
        normalized.providerId
    );
}

export function normalizeBrokerProviderBaseUrls(
    value
) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.getPrototypeOf(value) !==
            Object.prototype ||
        Object.keys(value).length > 16
    ) {
        throw BrokerConfigurationError
            .invalidSettings();
    }

    const baseUrls = {};

    for (const [providerId, baseUrl] of
        Object.entries(value)) {
        const selected =
            normalizeBrokerProviderId(
                providerId
            );
        const knownDescriptor =
            listBrokerLLMProviderDescriptors()
                .find(
                    descriptor =>
                        descriptor.id === selected
                );

        if (
            knownDescriptor != null &&
            knownDescriptor.endpointKind !==
                BrokerLLMEndpointKind.LOCAL
        ) {
            throw BrokerConfigurationError
                .invalidBaseUrl();
        }

        try {
            baseUrls[selected] =
                normalizeBrokerLocalLlmBaseUrl(
                    baseUrl
                );
        } catch {
            throw BrokerConfigurationError
                .invalidBaseUrl();
        }
    }

    return Object.freeze(baseUrls);
}

export function normalizeBrokerBaseUrl(value) {
    try {
        return normalizeBrokerLocalLlmBaseUrl(
            value
        );
    } catch {
        throw BrokerConfigurationError
            .invalidBaseUrl();
    }
}

export function getBrokerSelectedModel(settings) {
    const normalized = createBrokerSettings(
        settings
    );

    return normalized.models[
        normalized.providerId
    ] ?? "";
}

export function normalizeBrokerProviderModels(
    value,
    selectedProviderId =
        BROKER_DEFAULT_LLM_PROVIDER_ID
) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.getPrototypeOf(value) !==
            Object.prototype ||
        Object.keys(value).length > 32
    ) {
        throw BrokerConfigurationError
            .invalidSettings();
    }

    const selected =
        normalizeBrokerLLMProviderId(
            selectedProviderId
        );
    const models = {};

    for (const [providerId, model] of
        Object.entries(value)) {
        models[
            normalizeBrokerLLMProviderId(
                providerId
            )
        ] = normalizeBrokerModel(model);
    }

    if (!Object.hasOwn(models, selected)) {
        models[selected] = "";
    }

    return Object.freeze(models);
}

export function normalizeBrokerAudioPreferences(
    value
) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).length !== 2 ||
        !Object.hasOwn(value, "muted") ||
        !Object.hasOwn(value, "volume") ||
        typeof value.muted !== "boolean" ||
        !Number.isInteger(value.volume) ||
        value.volume < 0 ||
        value.volume > 100
    ) {
        throw BrokerConfigurationError
            .invalidSettings();
    }

    return Object.freeze({
        muted: value.muted,
        volume: value.volume
    });
}

export function normalizeBrokerProviderId(value) {
    try {
        return normalizeBrokerLLMProviderId(
            value
        );
    } catch (error) {
        throw BrokerConfigurationError
            .invalidProvider(error);
    }
}

export function normalizeBrokerModel(value) {
    if (typeof value !== "string") {
        throw BrokerConfigurationError
            .invalidModel();
    }

    const model = value.trim();

    if (
        model.length > 256 ||
        /[\u0000-\u001F\u007F]/u.test(model)
    ) {
        throw BrokerConfigurationError
            .invalidModel();
    }

    return model;
}

export function normalizeBrokerApiKey(value) {
    try {
        return normalizeBrokerLLMCredentialValue(
            value
        );
    } catch {
        throw BrokerConfigurationError
            .invalidApiKey();
    }
}

function requireRevision(value) {
    if (
        !Number.isInteger(value) ||
        value < 0
    ) {
        throw BrokerConfigurationError
            .invalidSettings();
    }

    return value;
}

function normalizeAvailableProviders(
    providers,
    selectedProviderId
) {
    if (
        !Array.isArray(providers) ||
        providers.length === 0 ||
        providers.length > 16
    ) {
        throw BrokerConfigurationError
            .invalidSettings();
    }

    const normalized = providers.map(
        provider =>
            createBrokerLLMProviderDescriptor(
                provider
            )
    );
    const ids = normalized.map(
        provider => provider.id
    );

    if (
        new Set(ids).size !== ids.length ||
        !ids.includes(selectedProviderId)
    ) {
        throw BrokerConfigurationError
            .invalidSettings();
    }

    return Object.freeze(normalized);
}
