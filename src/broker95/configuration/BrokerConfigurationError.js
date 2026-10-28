import {
    ApplicationError
} from "../../errors/ApplicationError.js";

export class BrokerConfigurationError
    extends ApplicationError {

    constructor(
        technicalMessage,
        publicMessage,
        code,
        options = {}
    ) {
        super(technicalMessage, {
            code,
            publicMessage,
            diagnostics:
                options.diagnostics ?? [],
            cause: options.cause
        });

        this.name =
            "BrokerConfigurationError";
    }

    static invalidSettings(cause) {
        return new BrokerConfigurationError(
            "Invalid BROKER.95 persisted settings snapshot.",
            "La configuración guardada de BROKER.95 no es válida.",
            "BROKER95_SETTINGS_SNAPSHOT_INVALID",
            { cause }
        );
    }

    static invalidModel() {
        return new BrokerConfigurationError(
            "Invalid BROKER.95 LLM model identifier.",
            "El identificador del modelo no es válido.",
            "BROKER95_SETTINGS_MODEL_INVALID"
        );
    }

    static invalidProvider() {
        return new BrokerConfigurationError(
            "Invalid BROKER.95 LLM provider identifier.",
            "El identificador del proveedor no es válido.",
            "BROKER95_SETTINGS_PROVIDER_INVALID"
        );
    }

    static invalidApiKey() {
        return new BrokerConfigurationError(
            "Invalid BROKER.95 API credential.",
            "La API key no es válida.",
            "BROKER95_SECRET_API_KEY_INVALID"
        );
    }

    static invalidBaseUrl() {
        return new BrokerConfigurationError(
            "Invalid BROKER.95 local LLM base URL.",
            "La URL del servidor local no es válida. Usa localhost, 127.0.0.1 o ::1 con un puerto explícito.",
            "BROKER95_SETTINGS_BASE_URL_INVALID"
        );
    }

    static credentialUnsupported(providerId) {
        return new BrokerConfigurationError(
            `BROKER.95 provider ${providerId} does not accept credentials.`,
            "El proveedor seleccionado no admite una API key.",
            "BROKER95_SECRET_CREDENTIAL_UNSUPPORTED",
            { diagnostics: [{ providerId }] }
        );
    }

    static baseUrlUnsupported(providerId) {
        return new BrokerConfigurationError(
            `BROKER.95 provider ${providerId} does not accept a local base URL.`,
            "Sólo los proveedores locales permiten configurar la URL del servidor.",
            "BROKER95_SETTINGS_BASE_URL_UNSUPPORTED",
            { diagnostics: [{ providerId }] }
        );
    }

    static providerMismatch(requested, selected) {
        return new BrokerConfigurationError(
            `BROKER.95 provider ${requested} does not match selected provider ${selected}.`,
            "El proveedor solicitado no coincide con el proveedor activo de CIPHER.",
            "BROKER95_SETTINGS_PROVIDER_MISMATCH",
            {
                diagnostics: [{
                    requested,
                    selected
                }]
            }
        );
    }

    static providerUnavailable(providerId) {
        return new BrokerConfigurationError(
            `BROKER.95 provider ${providerId} is not registered in the Extension Host.`,
            "El proveedor seleccionado no está disponible en esta instalación.",
            "BROKER95_SETTINGS_PROVIDER_UNAVAILABLE",
            {
                diagnostics: [{ providerId }]
            }
        );
    }

    static unsupportedVersion(
        versionKind,
        value
    ) {
        return new BrokerConfigurationError(
            `Unsupported BROKER.95 settings ${versionKind} version: ${String(value)}.`,
            "La configuración pertenece a una versión incompatible de BROKER.95.",
            "BROKER95_SETTINGS_VERSION_UNSUPPORTED",
            {
                diagnostics: [{
                    versionKind,
                    value
                }]
            }
        );
    }

    static settingsStorageFailure(
        operation,
        cause
    ) {
        return new BrokerConfigurationError(
            `BROKER.95 public settings storage ${operation} failed.`,
            "No fue posible acceder a la configuración de BROKER.95.",
            "BROKER95_SETTINGS_STORAGE_ERROR",
            {
                cause,
                diagnostics: [{ operation }]
            }
        );
    }

    static secretStorageFailure(operation) {
        return new BrokerConfigurationError(
            `BROKER.95 secret storage ${operation} failed.`,
            "No fue posible acceder de forma segura a la API key de BROKER.95.",
            "BROKER95_SECRET_STORAGE_ERROR",
            {
                diagnostics: [{ operation }]
            }
        );
    }

    static notReady() {
        return new BrokerConfigurationError(
            "BROKER.95 configuration is not initialized.",
            "La configuración de BROKER.95 todavía no está lista.",
            "BROKER95_CONFIGURATION_NOT_READY"
        );
    }

    static disposed() {
        return new BrokerConfigurationError(
            "BROKER.95 configuration service is disposed.",
            "La configuración de BROKER.95 ya fue cerrada.",
            "BROKER95_CONFIGURATION_DISPOSED"
        );
    }

    static unconfigured(reason) {
        return new BrokerConfigurationError(
            `BROKER.95 LLM configuration is incomplete: ${reason}.`,
            reason === "model_missing"
                ? "Introduce un modelo para conectar a CIPHER."
                : "Introduce una API key para conectar a CIPHER.",
            "BROKER95_LLM_UNCONFIGURED",
            {
                diagnostics: [{ reason }]
            }
        );
    }
}
