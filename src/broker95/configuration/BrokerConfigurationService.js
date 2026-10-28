import {
    requireFunction,
    requirePort
} from "../../application/ports/ApplicationPorts.js";
import {
    BrokerLlmStatusReason
} from "../protocol/BrokerProtocolTypes.js";
import {
    BrokerConfigurationError
} from "./BrokerConfigurationError.js";
import {
    createBrokerLlmConfigurationStatus
} from "./BrokerLlmConfigurationStatus.js";
import {
    createBrokerPublicSettings,
    createBrokerSettings,
    evolveBrokerSettings,
    getBrokerSelectedBaseUrl,
    getBrokerSelectedModel,
    normalizeBrokerAudioPreferences,
    normalizeBrokerApiKey,
    normalizeBrokerBaseUrl,
    normalizeBrokerModel,
    normalizeBrokerProviderId
} from "./BrokerSettings.js";
import {
    BrokerLLMCredentialKind,
    BrokerLLMEndpointKind,
    createBrokerLLMCredential,
    getBrokerLLMProviderDescriptor,
    listBrokerLLMProviderDescriptors
} from "../llm/index.js";
import {
    brokerSettingsSerializer
} from "./BrokerSettingsSerializer.js";

export const BrokerSettingsLoadSource =
    Object.freeze({
        CREATED: "created",
        RESTORED: "restored",
        RECOVERED: "recovered",
        MIGRATED: "migrated"
    });

export class BrokerConfigurationService {

    constructor(options = {}) {
        this.settingsRepository =
            requirePort(
                options.settingsRepository,
                "brokerSettingsRepository",
                [
                    "read",
                    "write",
                    "quarantine"
                ]
            );
        this.credentialRepository =
            requirePort(
                options.credentialRepository,
                "brokerCredentialRepository",
                [
                    "has",
                    "read",
                    "write",
                    "delete"
                ]
            );
        this.serializer = requirePort(
            options.serializer ??
                brokerSettingsSerializer,
            "brokerSettingsSerializer",
            ["encode", "decode"]
        );
        this.providerRegistry = requirePort(
            options.providerRegistry ??
                createStaticProviderCatalog(),
            "brokerLlmProviderRegistry",
            [
                "has",
                "getDescriptor",
                "listDescriptors"
            ]
        );
        this.developerLogger =
            options.developerLogger ??
            console;
        this.settings = null;
        this.hasApiKey = false;
        this.loadResult = null;
        this.initialization = null;
        this.queue = Promise.resolve();
        this.listeners = new Set();
        this.disposed = false;
    }

    initialize() {
        this.#requireActive();

        if (!this.initialization) {
            this.initialization =
                this.#enqueue(
                    () => this.#load()
                );
        }

        return this.initialization;
    }

    getPublicSettings() {
        this.#requireReady();

        return createBrokerPublicSettings(
            this.settings,
            this.hasApiKey,
            this.providerRegistry
                .listDescriptors()
        );
    }

    getLlmStatus() {
        return createBrokerLlmConfigurationStatus(
            this.getPublicSettings()
        );
    }

    getPublicSnapshot() {
        return Object.freeze({
            settings:
                this.getPublicSettings(),
            llmStatus:
                this.getLlmStatus()
        });
    }

    async setModel(value) {
        const model = normalizeBrokerModel(
            value
        );

        await this.initialize();

        return this.#enqueue(async () => {
            this.#requireActive();

            if (
                model ===
                    getBrokerSelectedModel(
                        this.settings
                    )
            ) {
                return this.getPublicSnapshot();
            }

            const next = evolveBrokerSettings(
                this.settings,
                {
                    models: {
                        ...this.settings.models,
                        [this.settings.providerId]:
                            model
                    }
                }
            );

            await this.#writeSettings(next);
            this.settings = next;

            return this.#publish(
                "settings/model-updated"
            );
        });
    }

    async setProvider(value) {
        const providerId =
            normalizeBrokerProviderId(value);

        await this.initialize();

        return this.#enqueue(async () => {
            this.#requireActive();
            this.#requireRegisteredProvider(
                providerId
            );

            if (
                providerId ===
                    this.settings.providerId
            ) {
                return this.getPublicSnapshot();
            }

            const next = evolveBrokerSettings(
                this.settings,
                {
                    providerId,
                    models: {
                        ...this.settings.models,
                        [providerId]:
                            this.settings.models[
                                providerId
                            ] ?? ""
                    }
                }
            );
            const hasApiKey =
                await this.#hasStoredApiKey(
                    providerId
                );

            await this.#writeSettings(next);
            this.settings = next;
            this.hasApiKey = hasApiKey;

            return this.#publish(
                "settings/provider-updated"
            );
        });
    }

    async setAudioPreferences(value) {
        const audio =
            normalizeBrokerAudioPreferences(
                value
            );

        await this.initialize();

        return this.#enqueue(async () => {
            this.#requireActive();

            if (
                audio.muted ===
                    this.settings.audio.muted &&
                audio.volume ===
                    this.settings.audio.volume
            ) {
                return this.getPublicSnapshot();
            }

            const next = evolveBrokerSettings(
                this.settings,
                { audio }
            );

            await this.#writeSettings(next);
            this.settings = next;

            return this.#publish(
                "settings/audio-updated"
            );
        });
    }

    async setBaseUrl(value, providerId = null) {
        const baseUrl = normalizeBrokerBaseUrl(
            value
        );

        await this.initialize();

        return this.#enqueue(async () => {
            this.#requireActive();
            const selected =
                this.#selectProviderId(
                    providerId
                );
            const descriptor =
                this.providerRegistry
                    .getDescriptor(selected);

            if (
                descriptor.endpointKind !==
                BrokerLLMEndpointKind.LOCAL
            ) {
                throw BrokerConfigurationError
                    .baseUrlUnsupported(
                        selected
                    );
            }

            const next = evolveBrokerSettings(
                this.settings,
                {
                    baseUrls: {
                        ...this.settings.baseUrls,
                        [selected]: baseUrl
                    }
                }
            );

            await this.#writeSettings(next);
            this.settings = next;

            return this.#publish(
                "settings/base-url-updated"
            );
        });
    }

    async setApiKey(value, providerId = null) {
        const apiKey = normalizeBrokerApiKey(
            value
        );

        await this.initialize();

        return this.#enqueue(async () => {
            this.#requireActive();
            const selected =
                this.#selectProviderId(
                    providerId
                );
            const descriptor =
                this.providerRegistry
                    .getDescriptor(selected);

            if (
                descriptor.credentialKind ===
                BrokerLLMCredentialKind.NONE
            ) {
                throw BrokerConfigurationError
                    .credentialUnsupported(
                        selected
                    );
            }
            await this.#writeApiKey(
                selected,
                apiKey
            );

            if (
                selected ===
                this.settings.providerId
            ) {
                this.hasApiKey = true;
            }

            return this.#publish(
                "settings/api-key-updated"
            );
        });
    }

    async deleteApiKey(providerId = null) {
        await this.initialize();

        return this.#enqueue(async () => {
            this.#requireActive();
            const selected =
                this.#selectProviderId(
                    providerId
                );
            const descriptor =
                this.providerRegistry
                    .getDescriptor(selected);

            if (
                descriptor.credentialKind ===
                BrokerLLMCredentialKind.NONE
            ) {
                throw BrokerConfigurationError
                    .credentialUnsupported(
                        selected
                    );
            }
            await this.#deleteApiKey(
                selected
            );

            if (
                selected ===
                this.settings.providerId
            ) {
                this.hasApiKey = false;
            }

            return this.#publish(
                "settings/api-key-deleted"
            );
        });
    }

    async resolvePrivateLlmSettings(
        providerId = null
    ) {
        await this.initialize();

        return this.#enqueue(() =>
            this.#resolvePrivateLlmSettings(
                providerId,
                true
            )
        );
    }

    /**
     * Resuelve únicamente el enlace y su credencial. Permite comprobar un
     * servidor local y descubrir modelos antes de elegir uno.
     */
    async resolvePrivateLlmEndpointSettings(
        providerId = null
    ) {
        await this.initialize();

        return this.#enqueue(() =>
            this.#resolvePrivateLlmSettings(
                providerId,
                false
            )
        );
    }

    subscribe(listener) {
        this.#requireActive();
        requireFunction(
            listener,
            "brokerConfigurationListener"
        );
        this.listeners.add(listener);
        let subscribed = true;

        return Object.freeze({
            dispose: () => {
                if (!subscribed) {
                    return;
                }

                subscribed = false;
                this.listeners.delete(
                    listener
                );
            }
        });
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.listeners.clear();
    }

    async #load() {
        const stored = await this.#readSettings();
        let settings;
        let source;
        let recoveryCode = null;

        if (stored === undefined) {
            settings = createBrokerSettings();
            await this.#writeSettings(settings);
            source = BrokerSettingsLoadSource
                .CREATED;
        } else {
            let decoded = null;

            try {
                decoded = this.serializer.decode(
                    stored
                );
            } catch (error) {
                if (
                    error?.code ===
                    "BROKER95_SETTINGS_VERSION_UNSUPPORTED"
                ) {
                    throw error;
                }

                const invalid =
                    error instanceof
                        BrokerConfigurationError
                        ? error
                        : BrokerConfigurationError
                            .invalidSettings(
                                error
                            );

                await this.#quarantineSettings(
                    stored,
                    invalid.code
                );
                settings = createBrokerSettings();
                await this.#writeSettings(
                    settings
                );
                source =
                    BrokerSettingsLoadSource
                        .RECOVERED;
                recoveryCode = invalid.code;
            }

            if (decoded) {
                settings = decoded.settings;

                if (
                    decoded.migratedFrom != null
                ) {
                    await this.#writeSettings(
                        settings
                    );
                    source =
                        BrokerSettingsLoadSource
                            .MIGRATED;
                } else {
                    source =
                        BrokerSettingsLoadSource
                            .RESTORED;
                }
            }
        }

        this.#requireRegisteredProvider(
            settings.providerId
        );
        const hasApiKey =
            await this.#hasStoredApiKey(
                settings.providerId
            );

        this.settings = settings;
        this.hasApiKey = hasApiKey;
        const snapshot =
            this.getPublicSnapshot();

        this.loadResult = Object.freeze({
            ...snapshot,
            source,
            recoveryCode
        });
        this.#notify(
            snapshot,
            "settings/initialized"
        );

        return this.loadResult;
    }

    #publish(reason) {
        const snapshot =
            this.getPublicSnapshot();

        this.#notify(snapshot, reason);

        return snapshot;
    }

    async #readSettings() {
        try {
            return await this.settingsRepository
                .read();
        } catch (error) {
            throw BrokerConfigurationError
                .settingsStorageFailure(
                    "read",
                    error
                );
        }
    }

    async #writeSettings(settings) {
        try {
            const snapshot =
                this.serializer.encode(
                    settings
                );

            await this.settingsRepository
                .write(snapshot);
        } catch (error) {
            if (
                error instanceof
                    BrokerConfigurationError &&
                error.code !==
                    "BROKER95_SETTINGS_STORAGE_ERROR"
            ) {
                throw error;
            }

            throw BrokerConfigurationError
                .settingsStorageFailure(
                    "write",
                    error
                );
        }
    }

    async #quarantineSettings(
        snapshot,
        errorCode
    ) {
        try {
            await this.settingsRepository
                .quarantine(
                    snapshot,
                    errorCode
                );
        } catch (error) {
            throw BrokerConfigurationError
                .settingsStorageFailure(
                    "quarantine",
                    error
                );
        }
    }

    async #hasStoredApiKey(providerId) {
        const descriptor =
            this.providerRegistry.getDescriptor(
                providerId
            );

        if (
            descriptor.credentialKind ===
            BrokerLLMCredentialKind.NONE
        ) {
            return false;
        }

        try {
            return await this
                .credentialRepository.has(
                    providerId
                );
        } catch {
            throw BrokerConfigurationError
                .secretStorageFailure("read");
        }
    }

    async #readApiKey(providerId) {
        try {
            return await this
                .credentialRepository.read(
                    providerId
                );
        } catch {
            throw BrokerConfigurationError
                .secretStorageFailure("read");
        }
    }

    async #writeApiKey(providerId, apiKey) {
        try {
            await this.credentialRepository
                .write(providerId, apiKey);
        } catch {
            throw BrokerConfigurationError
                .secretStorageFailure("write");
        }
    }

    async #deleteApiKey(providerId) {
        try {
            await this.credentialRepository
                .delete(providerId);
        } catch {
            throw BrokerConfigurationError
                .secretStorageFailure(
                    "delete"
                );
        }
    }

    async #resolvePrivateLlmSettings(
        providerId,
        requireModel
    ) {
        this.#requireActive();

        const model = getBrokerSelectedModel(
            this.settings
        );

        if (requireModel && model.length === 0) {
            throw BrokerConfigurationError
                .unconfigured(
                    BrokerLlmStatusReason
                        .MISSING_MODEL
                );
        }

        const selected = this.#selectProviderId(
            providerId
        );

        if (selected !== this.settings.providerId) {
            throw BrokerConfigurationError
                .providerMismatch(
                    selected,
                    this.settings.providerId
                );
        }

        const descriptor =
            this.providerRegistry.getDescriptor(
                selected
            );
        const baseUrl =
            descriptor.endpointKind ===
                BrokerLLMEndpointKind.LOCAL
                ? getBrokerSelectedBaseUrl(
                    this.settings
                )
                : null;

        if (
            descriptor.credentialKind ===
            BrokerLLMCredentialKind.NONE
        ) {
            return privateSettings({
                providerId: selected,
                model,
                credential:
                    createBrokerLLMCredential(
                        selected,
                        undefined,
                        descriptor
                    ),
                baseUrl
            });
        }

        const apiKey = await this.#readApiKey(
            selected
        );

        if (
            descriptor.credentialKind ===
                BrokerLLMCredentialKind
                    .OPTIONAL_API_KEY &&
            !apiKey
        ) {
            return privateSettings({
                providerId: selected,
                model,
                credential:
                    createBrokerLLMCredential(
                        selected,
                        undefined,
                        descriptor
                    ),
                baseUrl
            });
        }

        if (!apiKey) {
            const changed = this.hasApiKey;

            this.hasApiKey = false;

            if (changed) {
                this.#publish(
                    "settings/api-key-missing"
                );
            }

            throw BrokerConfigurationError
                .unconfigured(
                    BrokerLlmStatusReason
                        .MISSING_API_KEY
                );
        }

        return privateSettings({
            providerId: selected,
            model,
            credential:
                createBrokerLLMCredential(
                    selected,
                    apiKey,
                    descriptor
                ),
            baseUrl
        });
    }

    #selectProviderId(providerId) {
        const selected = normalizeBrokerProviderId(
            providerId ??
                this.settings.providerId
        );

        this.#requireRegisteredProvider(selected);

        return selected;
    }

    #requireRegisteredProvider(providerId) {
        if (!this.providerRegistry.has(providerId)) {
            throw BrokerConfigurationError
                .providerUnavailable(providerId);
        }

        return providerId;
    }

    #notify(snapshot, reason) {
        const event = Object.freeze({
            ...snapshot,
            reason
        });

        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                try {
                    this.developerLogger.error?.(
                        "BROKER.95 public configuration listener failed.",
                        error
                    );
                } catch {
                    // El log no altera una configuración ya persistida.
                }
            }
        }
    }

    #enqueue(operation) {
        const result = this.queue.then(
            operation,
            operation
        );

        this.queue = result.then(
            () => undefined,
            () => undefined
        );

        return result;
    }

    #requireReady() {
        this.#requireActive();

        if (!this.settings) {
            throw BrokerConfigurationError
                .notReady();
        }
    }

    #requireActive() {
        if (this.disposed) {
            throw BrokerConfigurationError
                .disposed();
        }
    }
}

function privateSettings({
    providerId,
    model,
    credential,
    baseUrl = null
}) {
    return Object.freeze({
        providerId,
        model,
        credential,
        ...(baseUrl == null
            ? {}
            : { baseUrl })
    });
}

function createStaticProviderCatalog() {
    const descriptors =
        listBrokerLLMProviderDescriptors();

    return Object.freeze({
        has(providerId) {
            return descriptors.some(
                descriptor =>
                    descriptor.id === providerId
            );
        },
        getDescriptor(providerId) {
            return getBrokerLLMProviderDescriptor(
                providerId
            );
        },
        listDescriptors() {
            return descriptors;
        }
    });
}

export function createBrokerPublicConfigurationView(
    service
) {
    const selected = requirePort(
        service,
        "brokerConfigurationService",
        [
            "getPublicSettings",
            "getLlmStatus",
            "getPublicSnapshot",
            "subscribe"
        ]
    );

    return Object.freeze({
        getSettings: () =>
            selected.getPublicSettings(),
        getLlmStatus: () =>
            selected.getLlmStatus(),
        getSnapshot: () =>
            selected.getPublicSnapshot(),
        subscribe: listener =>
            selected.subscribe(listener)
    });
}
