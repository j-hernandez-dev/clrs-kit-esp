import test from "node:test";
import assert from "node:assert/strict";

import {
    BrokerConfigurationError
} from "../src/broker95/configuration/BrokerConfigurationError.js";
import {
    BrokerConfigurationService,
    BrokerSettingsLoadSource,
    createBrokerPublicConfigurationView
} from "../src/broker95/configuration/BrokerConfigurationService.js";
import {
    createBrokerLlmConfigurationStatus
} from "../src/broker95/configuration/BrokerLlmConfigurationStatus.js";
import {
    createBrokerPublicSettings,
    createBrokerSettings,
    evolveBrokerSettings,
    getBrokerSelectedBaseUrl,
    normalizeBrokerApiKey,
    normalizeBrokerAudioPreferences,
    normalizeBrokerBaseUrl,
    normalizeBrokerModel,
    normalizeBrokerProviderId
} from "../src/broker95/configuration/BrokerSettings.js";
import {
    BrokerLLMCapabilitySupport,
    BrokerLLMCredentialKind,
    BrokerLLMEndpointKind,
    BrokerLLMProviderId,
    createBrokerLLMProviderDescriptor,
    listBrokerLLMProviderDescriptors
} from "../src/broker95/llm/index.js";
import {
    BROKER_SETTINGS_SNAPSHOT_FORMAT,
    BROKER_SETTINGS_SNAPSHOT_VERSION,
    brokerSettingsSerializer
} from "../src/broker95/configuration/BrokerSettingsSerializer.js";
import {
    BrokerLlmStatus,
    BrokerLlmStatusReason
} from "../src/broker95/protocol/BrokerProtocolTypes.js";
import {
    BROKER95_CORRUPT_SETTINGS_KEY,
    BROKER95_GLOBAL_SETTINGS_KEY,
    VSCodeGlobalStateBrokerSettingsRepository
} from "../extension/adapters/VSCodeGlobalStateBrokerSettingsRepository.js";
import {
    BROKER95_GROQ_API_KEY_SECRET,
    VSCodeSecretStorageBrokerCredentialRepository
} from "../extension/adapters/VSCodeSecretStorageBrokerCredentialRepository.js";

test("crea configuración vacía e inmutable sin una credencial pública", () => {
    const settings = createBrokerSettings();
    const publicSettings =
        createBrokerPublicSettings(
            settings,
            false
        );

    assert.deepEqual(settings, {
        schemaVersion: 5,
        revision: 0,
        providerId: "groq",
        models: {
            groq: ""
        },
        baseUrls: {},
        audio: {
            muted: false,
            volume: 45
        }
    });
    assert.deepEqual(publicSettings, {
        providerId: "groq",
        providers:
            listBrokerLLMProviderDescriptors(),
        model: "",
        credential: {
            kind: "api-key",
            required: true,
            configured: false
        },
        hasApiKey: false,
        audio: {
            muted: false,
            volume: 45
        }
    });
    assert.equal(
        Object.isFrozen(settings),
        true
    );
    assert.equal(
        Object.hasOwn(
            publicSettings,
            "apiKey"
        ),
        false
    );
});

test("normaliza modelos y credenciales sin incluir el valor en errores", () => {
    assert.equal(
        normalizeBrokerModel(
            "  modelo-prueba  "
        ),
        "modelo-prueba"
    );
    assert.equal(
        normalizeBrokerApiKey(
            "  clave-prueba  "
        ),
        "clave-prueba"
    );

    const secret = `SECRETO-${"x".repeat(17000)}`;

    assert.throws(
        () => normalizeBrokerApiKey(secret),
        error =>
            error.code ===
                "BROKER95_SECRET_API_KEY_INVALID" &&
            !serializeError(error)
                .includes("SECRETO-")
    );
    assert.throws(
        () => normalizeBrokerModel(
            "modelo\ninvalido"
        ),
        error =>
            error.code ===
                "BROKER95_SETTINGS_MODEL_INVALID"
    );
    assert.equal(
        normalizeBrokerProviderId("groq"),
        "groq"
    );
    assert.equal(
        normalizeBrokerProviderId(
            "proveedor-inexistente"
        ),
        "proveedor-inexistente"
    );
    assert.throws(
        () => normalizeBrokerProviderId("Groq"),
        error =>
            error.code ===
                "BROKER95_SETTINGS_PROVIDER_INVALID"
    );
    assert.deepEqual(
        normalizeBrokerAudioPreferences({
            muted: true,
            volume: 72
        }),
        {
            muted: true,
            volume: 72
        }
    );
    assert.throws(
        () => normalizeBrokerAudioPreferences({
            muted: false,
            volume: 101
        }),
        error =>
            error.code ===
                "BROKER95_SETTINGS_SNAPSHOT_INVALID"
    );
});

test("serializa únicamente la configuración pública persistente", () => {
    const settings = evolveBrokerSettings(
        createBrokerSettings(),
        {
            models: {
                groq: "llama-prueba"
            }
        }
    );
    const snapshot =
        brokerSettingsSerializer.encode(
            settings
        );
    const decoded =
        brokerSettingsSerializer.decode(
            snapshot
        );

    assert.equal(
        snapshot.format,
        BROKER_SETTINGS_SNAPSHOT_FORMAT
    );
    assert.equal(
        snapshot.formatVersion,
        BROKER_SETTINGS_SNAPSHOT_VERSION
    );
    assert.deepEqual(
        decoded.settings,
        settings
    );
    assert.equal(
        JSON.stringify(snapshot)
            .includes("apiKey"),
        false
    );
});

test("migra de forma segura la configuración v4 y conserva sus perfiles", async () => {
    const legacy = {
        format:
            BROKER_SETTINGS_SNAPSHOT_FORMAT,
        formatVersion: 4,
        settings: {
            schemaVersion: 4,
            revision: 8,
            providerId: "groq",
            models: {
                groq: "modelo-legado",
                gemini: "modelo-gemini"
            },
            audio: {
                muted: true,
                volume: 31
            }
        }
    };
    const globalState = new FakeMemento({
        [BROKER95_GLOBAL_SETTINGS_KEY]:
            legacy
    });
    const service = createService(
        globalState,
        new FakeSecrets()
    );
    const loaded = await service.initialize();
    const persisted = globalState.get(
        BROKER95_GLOBAL_SETTINGS_KEY
    );

    assert.equal(
        loaded.source,
        BrokerSettingsLoadSource.MIGRATED
    );
    assert.equal(
        loaded.settings.model,
        "modelo-legado"
    );
    assert.deepEqual(
        loaded.settings.audio,
        legacy.settings.audio
    );
    assert.equal(persisted.formatVersion, 5);
    assert.equal(
        persisted.settings.schemaVersion,
        5
    );
    assert.deepEqual(
        persisted.settings.models,
        legacy.settings.models
    );
    assert.deepEqual(
        persisted.settings.baseUrls,
        {}
    );
    assert.equal(
        JSON.stringify(persisted)
            .includes("apiKey"),
        false
    );
});

test("rechaza configuraciones antiguas y valores secretos persistidos", () => {
    assert.throws(
        () => brokerSettingsSerializer.decode({
            model: "modelo-obsoleto"
        }),
        error => error.code ===
            "BROKER95_SETTINGS_SNAPSHOT_INVALID"
    );
    assert.throws(
        () => brokerSettingsSerializer.decode({
            format:
                BROKER_SETTINGS_SNAPSHOT_FORMAT,
            formatVersion: 3,
            settings: {
                schemaVersion: 3,
                revision: 7,
                providerId: "groq",
                model: "modelo-v3",
                audio: {
                    muted: false,
                    volume: 64
                }
            }
        }),
        error => error.code ===
            "BROKER95_SETTINGS_SNAPSHOT_INVALID"
    );
    assert.throws(
        () => brokerSettingsSerializer
            .decode({
                model: "modelo",
                apiKey: "no-debe-persistirse"
            }),
        error =>
            error.code ===
                "BROKER95_SETTINGS_SNAPSHOT_INVALID"
    );
});

test("preserva una versión futura sin reiniciar la configuración", async () => {
    const future = {
        format:
            BROKER_SETTINGS_SNAPSHOT_FORMAT,
        formatVersion:
            BROKER_SETTINGS_SNAPSHOT_VERSION + 1,
        settings: structuredClone(
            createBrokerSettings()
        )
    };
    const globalState = new FakeMemento({
        [BROKER95_GLOBAL_SETTINGS_KEY]:
            future
    });
    const service = createService(
        globalState,
        new FakeSecrets()
    );

    await assert.rejects(
        service.initialize(),
        error =>
            error.code ===
                "BROKER95_SETTINGS_VERSION_UNSUPPORTED"
    );
    assert.deepEqual(
        globalState.get(
            BROKER95_GLOBAL_SETTINGS_KEY
        ),
        future
    );
    assert.equal(
        globalState.updates.length,
        0
    );
});

test("crea y restaura el modelo global del perfil", async () => {
    const globalState = new FakeMemento();
    const secrets = new FakeSecrets();
    const first = createService(
        globalState,
        secrets
    );
    const created = await first.initialize();

    assert.equal(
        created.source,
        BrokerSettingsLoadSource.CREATED
    );
    assert.equal(created.settings.model, "");

    await first.setModel("  modelo-global  ");

    const second = createService(
        globalState,
        secrets
    );
    const restored =
        await second.initialize();

    assert.equal(
        restored.source,
        BrokerSettingsLoadSource.RESTORED
    );
    assert.equal(
        restored.settings.model,
        "modelo-global"
    );
});

test("persiste volumen y silencio como preferencias globales", async () => {
    const globalState = new FakeMemento();
    const secrets = new FakeSecrets();
    const first = createService(
        globalState,
        secrets
    );

    await first.initialize();
    const updated =
        await first.setAudioPreferences({
            muted: true,
            volume: 72
        });

    assert.deepEqual(updated.settings.audio, {
        muted: true,
        volume: 72
    });
    const second = createService(
        globalState,
        secrets
    );
    const restored = await second.initialize();

    assert.deepEqual(restored.settings.audio, {
        muted: true,
        volume: 72
    });
});

test("selecciona proveedores registrados y conserva modelo y credencial por proveedor", async () => {
    const groq =
        listBrokerLLMProviderDescriptors()[0];
    const local = providerDescriptor({
        id: "local-test",
        label: "Proveedor local",
        credentialKind:
            BrokerLLMCredentialKind.NONE,
        endpointKind:
            BrokerLLMEndpointKind.LOCAL
    });
    const catalog = providerCatalog([
        groq,
        local
    ]);
    const globalState = new FakeMemento();
    const secrets = new FakeSecrets();
    const service = createService(
        globalState,
        secrets,
        catalog
    );

    await service.initialize();
    await service.setModel("modelo-groq");
    await service.setApiKey("clave-groq");

    const selectedLocal =
        await service.setProvider(
            "local-test"
        );

    assert.equal(
        selectedLocal.settings.providerId,
        "local-test"
    );
    assert.equal(
        selectedLocal.settings.model,
        ""
    );
    assert.deepEqual(
        selectedLocal.settings.credential,
        {
            kind: "none",
            required: false,
            configured: true
        }
    );
    await service.setModel("modelo-local");
    assert.deepEqual(
        await service.resolvePrivateLlmSettings(),
        {
            providerId: "local-test",
            model: "modelo-local",
            credential: {
                providerId: "local-test",
                kind: "none"
            }
        }
    );

    const restoredGroq =
        await service.setProvider("groq");

    assert.equal(
        restoredGroq.settings.model,
        "modelo-groq"
    );
    assert.equal(
        restoredGroq.settings
            .credential.configured,
        true
    );
    assert.deepEqual(
        restoredGroq.settings.providers,
        [groq, local]
    );

    const restoredService = createService(
        globalState,
        secrets,
        catalog
    );
    const restored =
        await restoredService.initialize();

    assert.equal(
        restored.settings.providerId,
        "groq"
    );
    assert.equal(
        restored.settings.model,
        "modelo-groq"
    );
    assert.equal(
        (
            await restoredService.setProvider(
                "local-test"
            )
        ).settings.model,
        "modelo-local"
    );
});

test("Hugging Face y OpenRouter conservan modelos y credenciales al cambiar y reiniciar", async () => {
    const globalState = new FakeMemento();
    const secrets = new FakeSecrets();
    const service = createService(globalState, secrets);
    await service.initialize();

    for (const [providerId, model, key] of [
        ["hugging-face", "organizacion/modelo:cheapest", "hf_token_prueba"],
        ["openrouter", "organizacion/modelo:free", "router_token_prueba"]
    ]) {
        const selected = await service.setProvider(providerId);
        assert.equal(selected.settings.model, "");
        assert.equal(selected.settings.credential.configured, false);
        await service.setModel(model);
        await service.setApiKey(key);
        const privateSettings = await service.resolvePrivateLlmSettings();
        assert.equal(privateSettings.model, model);
        assert.equal(privateSettings.credential.value, key);
        assert.equal(privateSettings.credential.providerId, providerId);
        assert.equal(JSON.stringify(service.getPublicSnapshot()).includes(key), false);
    }

    const restored = createService(globalState, secrets);
    await restored.initialize();
    assert.equal(restored.getPublicSettings().providerId, "openrouter");
    assert.equal(restored.getPublicSettings().model, "organizacion/modelo:free");
    await restored.setProvider("hugging-face");
    assert.equal(restored.getPublicSettings().model, "organizacion/modelo:cheapest");
    assert.equal(restored.getPublicSettings().credential.configured, true);
    await restored.deleteApiKey();
    await restored.setProvider("openrouter");
    assert.equal(restored.getPublicSettings().credential.configured, true);
    await assert.rejects(restored.setProvider("anthropic"));
    assert.equal(restored.getPublicSettings().providerId, "openrouter");
});

test("configura LM Studio local con token opcional y perfil persistente", async () => {
    const descriptors =
        listBrokerLLMProviderDescriptors();
    const lmStudio = descriptors.find(
        provider =>
            provider.id ===
                BrokerLLMProviderId.LM_STUDIO
    );
    const groq = descriptors.find(
        provider =>
            provider.id ===
                BrokerLLMProviderId.GROQ
    );
    const globalState = new FakeMemento();
    const secrets = new FakeSecrets();
    const service = createService(
        globalState,
        secrets,
        providerCatalog([groq, lmStudio])
    );

    await service.initialize();
    await service.setProvider(
        BrokerLLMProviderId.LM_STUDIO
    );

    assert.deepEqual(
        await service
            .resolvePrivateLlmEndpointSettings(),
        {
            providerId: "lm-studio",
            model: "",
            credential: {
                providerId: "lm-studio",
                kind: "optional-api-key"
            },
            baseUrl:
                "http://127.0.0.1:1234/v1"
        }
    );
    await assert.rejects(
        () => service.resolvePrivateLlmSettings(),
        error =>
            error.code ===
                "BROKER95_LLM_UNCONFIGURED" &&
            error.diagnostics?.[0]?.reason ===
                BrokerLlmStatusReason.MISSING_MODEL
    );

    await service.setModel("qwen-local");

    assert.deepEqual(
        service.getPublicSettings().credential,
        {
            kind: "optional-api-key",
            required: false,
            configured: false
        }
    );
    assert.equal(
        service.getLlmStatus().status,
        BrokerLlmStatus.READY
    );
    assert.deepEqual(
        await service.resolvePrivateLlmSettings(),
        {
            providerId: "lm-studio",
            model: "qwen-local",
            credential: {
                providerId: "lm-studio",
                kind: "optional-api-key"
            },
            baseUrl:
                "http://127.0.0.1:1234/v1"
        }
    );

    const updated = await service.setBaseUrl(
        "http://localhost:1234/v1/"
    );
    assert.equal(
        updated.settings.baseUrl,
        "http://localhost:1234/v1"
    );
    await service.setApiKey("token-local");

    assert.equal(
        service.getPublicSettings()
            .credential.configured,
        true
    );
    assert.deepEqual(
        await service.resolvePrivateLlmSettings(),
        {
            providerId: "lm-studio",
            model: "qwen-local",
            credential: {
                providerId: "lm-studio",
                kind: "optional-api-key",
                value: "token-local"
            },
            baseUrl:
                "http://localhost:1234/v1"
        }
    );

    const restored = createService(
        globalState,
        secrets,
        providerCatalog([groq, lmStudio])
    );
    const snapshot = await restored.initialize();

    assert.equal(snapshot.settings.model, "qwen-local");
    assert.equal(
        snapshot.settings.baseUrl,
        "http://localhost:1234/v1"
    );
    assert.equal(snapshot.settings.hasApiKey, true);
});

test("limita las URL configurables a servidores locales y al proveedor local", async () => {
    assert.equal(
        normalizeBrokerBaseUrl(
            "http://127.0.0.1:11434/api/"
        ),
        "http://127.0.0.1:11434/api"
    );

    for (const invalid of [
        "https://127.0.0.1:1234/v1",
        "http://192.168.1.8:1234/v1",
        "http://example.com:1234/v1",
        "http://user:pass@localhost:1234/v1",
        "http://localhost:1234/v1?token=secret",
        "http://localhost/v1"
    ]) {
        assert.throws(
            () => normalizeBrokerBaseUrl(invalid),
            error => error.code ===
                "BROKER95_SETTINGS_BASE_URL_INVALID"
        );
    }

    const service = createService(
        new FakeMemento(),
        new FakeSecrets()
    );

    await service.initialize();
    await assert.rejects(
        service.setBaseUrl(
            "http://localhost:1234/v1"
        ),
        error => error.code ===
            "BROKER95_SETTINGS_BASE_URL_UNSUPPORTED"
    );
    await service.setProvider(
        BrokerLLMProviderId.OLLAMA
    );
    await service.setBaseUrl(
        "http://[::1]:11434/api"
    );
    assert.equal(
        getBrokerSelectedBaseUrl(
            service.settings
        ),
        "http://[::1]:11434/api"
    );
    await assert.rejects(
        service.setApiKey("no-admitida"),
        error => error.code ===
            "BROKER95_SECRET_CREDENTIAL_UNSUPPORTED"
    );
});

test("rechaza seleccionar un proveedor sin adaptador registrado", async () => {
    const service = createService(
        new FakeMemento(),
        new FakeSecrets()
    );

    await service.initialize();

    await assert.rejects(
        service.setProvider("local-test"),
        error =>
            error.code ===
                "BROKER95_SETTINGS_PROVIDER_UNAVAILABLE"
    );
    assert.equal(
        service.getPublicSettings().providerId,
        "groq"
    );
});

test("guarda la API key sólo en SecretStorage y expone únicamente su presencia", async () => {
    const secret = "gsk-clave-super-secreta";
    const globalState = new FakeMemento();
    const secrets = new FakeSecrets();
    const service = createService(
        globalState,
        secrets
    );

    await service.initialize();
    await service.setModel("modelo");
    const snapshot =
        await service.setApiKey(secret);

    assert.equal(
        secrets.values.get(
            BROKER95_GROQ_API_KEY_SECRET
        ),
        secret
    );
    assert.deepEqual(snapshot.settings, {
        providerId: "groq",
        providers:
            listBrokerLLMProviderDescriptors(),
        model: "modelo",
        credential: {
            kind: "api-key",
            required: true,
            configured: true
        },
        hasApiKey: true,
        audio: {
            muted: false,
            volume: 45
        }
    });
    assert.equal(
        JSON.stringify([
            ...globalState.values.values()
        ]).includes(secret),
        false
    );
    assert.equal(
        JSON.stringify(snapshot)
            .includes(secret),
        false
    );
});

test("entrega la credencial sólo mediante la resolución privada del host", async () => {
    const service = createService(
        new FakeMemento(),
        new FakeSecrets()
    );

    await service.initialize();
    await assert.rejects(
        service.resolvePrivateLlmSettings(),
        error =>
            error.code ===
                "BROKER95_LLM_UNCONFIGURED" &&
            error.diagnostics[0].reason ===
                BrokerLlmStatusReason
                    .MISSING_MODEL
    );
    await service.setModel("modelo");
    await assert.rejects(
        service.resolvePrivateLlmSettings(),
        error =>
            error.diagnostics[0].reason ===
                BrokerLlmStatusReason
                    .MISSING_API_KEY
    );
    await service.setApiKey("clave");

    assert.deepEqual(
        await service
            .resolvePrivateLlmSettings(),
        {
            providerId: "groq",
            model: "modelo",
            credential: {
                providerId: "groq",
                kind: "api-key",
                value: "clave"
            }
        }
    );
});

test("elimina realmente la credencial aunque la caché pública estuviera desactualizada", async () => {
    const secrets = new FakeSecrets();
    const service = createService(
        new FakeMemento(),
        secrets
    );

    await service.initialize();
    secrets.values.set(
        BROKER95_GROQ_API_KEY_SECRET,
        "clave-externa"
    );
    const snapshot =
        await service.deleteApiKey();

    assert.equal(
        secrets.values.has(
            BROKER95_GROQ_API_KEY_SECRET
        ),
        false
    );
    assert.equal(
        snapshot.settings.hasApiKey,
        false
    );
});

test("deriva los tres estados locales de disponibilidad de CIPHER", () => {
    const missingModel =
        createBrokerLlmConfigurationStatus({
            model: "",
            hasApiKey: false
        });
    const missingKey =
        createBrokerLlmConfigurationStatus({
            model: "modelo",
            hasApiKey: false
        });
    const ready =
        createBrokerLlmConfigurationStatus({
            model: "modelo",
            hasApiKey: true
        });

    assert.deepEqual(
        [
            missingModel.status,
            missingModel.reason,
            missingKey.status,
            missingKey.reason,
            ready.status,
            ready.reason
        ],
        [
            BrokerLlmStatus.UNCONFIGURED,
            BrokerLlmStatusReason
                .MISSING_MODEL,
            BrokerLlmStatus.UNCONFIGURED,
            BrokerLlmStatusReason
                .MISSING_API_KEY,
            BrokerLlmStatus.READY,
            BrokerLlmStatusReason.READY
        ]
    );
});

test("recupera configuración corrupta sin borrar una credencial segura", async () => {
    const corrupt = {
        format:
            BROKER_SETTINGS_SNAPSHOT_FORMAT,
        formatVersion: 1,
        settings: {
            schemaVersion: 1,
            revision: -1,
            model: "modelo"
        }
    };
    const globalState = new FakeMemento({
        [BROKER95_GLOBAL_SETTINGS_KEY]:
            corrupt
    });
    const secrets = new FakeSecrets({
        [BROKER95_GROQ_API_KEY_SECRET]:
            "clave-conservada"
    });
    const service = createService(
        globalState,
        secrets
    );
    const loaded = await service.initialize();

    assert.equal(
        loaded.source,
        BrokerSettingsLoadSource.RECOVERED
    );
    assert.equal(loaded.settings.model, "");
    assert.equal(
        loaded.settings.hasApiKey,
        true
    );
    assert.deepEqual(
        globalState.get(
            BROKER95_CORRUPT_SETTINGS_KEY
        ).snapshotMetadata,
        {
            valueType: "object",
            recognizedFormat: true,
            formatVersion: 1,
            hasSettingsObject: true
        }
    );
    assert.equal(
        secrets.values.get(
            BROKER95_GROQ_API_KEY_SECRET
        ),
        "clave-conservada"
    );
});

test("la cuarentena nunca copia posibles secretos del snapshot corrupto", async () => {
    const leakedSecret =
        "SECRETO-LEGACY-NO-COPIABLE";
    const corrupt = {
        model: "modelo",
        apiKey: leakedSecret
    };
    const globalState = new FakeMemento({
        [BROKER95_GLOBAL_SETTINGS_KEY]:
            corrupt
    });
    const service = createService(
        globalState,
        new FakeSecrets()
    );

    await service.initialize();

    assert.equal(
        JSON.stringify(
            globalState.get(
                BROKER95_CORRUPT_SETTINGS_KEY
            )
        ).includes(leakedSecret),
        false
    );
});

test("una escritura pública fallida no cambia el modelo en memoria", async () => {
    const globalState = new FakeMemento();
    const service = createService(
        globalState,
        new FakeSecrets()
    );

    await service.initialize();
    globalState.failOnKey =
        BROKER95_GLOBAL_SETTINGS_KEY;

    await assert.rejects(
        service.setModel("modelo-no-guardado"),
        error =>
            error.code ===
                "BROKER95_SETTINGS_STORAGE_ERROR"
    );
    assert.equal(
        service.getPublicSettings().model,
        ""
    );
});

test("los fallos de SecretStorage no filtran la credencial ni alteran el indicador", async () => {
    const secret = "SECRETO-NUNCA-EXPUESTO";
    const secrets = new FakeSecrets();
    const service = createService(
        new FakeMemento(),
        secrets
    );

    await service.initialize();
    secrets.failOperation = "store";
    secrets.failureSecret = secret;

    await assert.rejects(
        service.setApiKey(secret),
        error =>
            error instanceof
                BrokerConfigurationError &&
            error.code ===
                "BROKER95_SECRET_STORAGE_ERROR" &&
            !serializeError(error)
                .includes(secret)
    );
    assert.equal(
        service.getPublicSettings()
            .hasApiKey,
        false
    );
});

test("los eventos públicos nunca transportan la API key", async () => {
    const service = createService(
        new FakeMemento(),
        new FakeSecrets()
    );
    const events = [];

    service.subscribe(event => {
        events.push(event);
    });
    await service.initialize();
    await service.setApiKey(
        "clave-no-publicable"
    );

    assert.equal(events.length, 2);
    assert.equal(
        JSON.stringify(events)
            .includes("clave-no-publicable"),
        false
    );
    assert.equal(
        events[1].reason,
        "settings/api-key-updated"
    );
});

test("la vista pública no permite leer ni modificar secretos", async () => {
    const service = createService(
        new FakeMemento(),
        new FakeSecrets()
    );
    const view =
        createBrokerPublicConfigurationView(
            service
        );

    await service.initialize();

    assert.deepEqual(view.getSettings(), {
        providerId: "groq",
        providers:
            listBrokerLLMProviderDescriptors(),
        model: "",
        credential: {
            kind: "api-key",
            required: true,
            configured: false
        },
        hasApiKey: false,
        audio: {
            muted: false,
            volume: 45
        }
    });
    assert.equal(view.setApiKey, undefined);
    assert.equal(view.deleteApiKey, undefined);
    assert.equal(
        view.resolvePrivateLlmSettings,
        undefined
    );
});

function createService(
    globalState,
    secrets,
    providerRegistry = undefined
) {
    return new BrokerConfigurationService({
        settingsRepository:
            new VSCodeGlobalStateBrokerSettingsRepository(
                globalState
            ),
        credentialRepository:
            new VSCodeSecretStorageBrokerCredentialRepository(
                secrets
            ),
        providerRegistry,
        developerLogger: {
            error() {}
        }
    });
}

function providerDescriptor({
    id,
    label,
    credentialKind,
    endpointKind
}) {
    return createBrokerLLMProviderDescriptor({
        id,
        label,
        credentialKind,
        endpointKind,
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

function providerCatalog(descriptors) {
    return Object.freeze({
        has(providerId) {
            return descriptors.some(
                descriptor =>
                    descriptor.id === providerId
            );
        },
        getDescriptor(providerId) {
            return descriptors.find(
                descriptor =>
                    descriptor.id === providerId
            );
        },
        listDescriptors() {
            return descriptors;
        }
    });
}

function serializeError(error) {
    return JSON.stringify({
        message: error.message,
        publicMessage:
            error.publicMessage,
        diagnostics: error.diagnostics,
        cause: error.cause?.message
    });
}

class FakeMemento {

    constructor(initial = {}) {
        this.values = new Map(
            Object.entries(initial).map(
                ([key, value]) => [
                    key,
                    structuredClone(value)
                ]
            )
        );
        this.updates = [];
        this.failOnKey = null;
    }

    get(key) {
        const value = this.values.get(key);

        return value === undefined
            ? undefined
            : structuredClone(value);
    }

    async update(key, value) {
        if (key === this.failOnKey) {
            throw new Error(
                "simulated globalState failure"
            );
        }

        const stored = value === undefined
            ? undefined
            : structuredClone(value);

        this.updates.push({ key, value: stored });

        if (stored === undefined) {
            this.values.delete(key);
        } else {
            this.values.set(key, stored);
        }
    }
}

class FakeSecrets {

    constructor(initial = {}) {
        this.values = new Map(
            Object.entries(initial)
        );
        this.failOperation = null;
        this.failureSecret = "";
    }

    async get(key) {
        this.#fail("get");
        return this.values.get(key);
    }

    async store(key, value) {
        this.#fail("store");
        this.values.set(key, value);
    }

    async delete(key) {
        this.#fail("delete");
        this.values.delete(key);
    }

    #fail(operation) {
        if (this.failOperation === operation) {
            throw new Error(
                `failure ${this.failureSecret}`
            );
        }
    }
}
