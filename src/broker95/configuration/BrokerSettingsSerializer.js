import {
    BROKER_SETTINGS_SCHEMA_VERSION,
    createBrokerSettings
} from "./BrokerSettings.js";
import {
    BrokerConfigurationError
} from "./BrokerConfigurationError.js";

export const BROKER_SETTINGS_SNAPSHOT_FORMAT =
    "broker95-settings";
export const BROKER_SETTINGS_SNAPSHOT_VERSION = 5;

const SNAPSHOT_KEYS = Object.freeze([
    "format",
    "formatVersion",
    "settings"
]);
const SETTINGS_KEYS = Object.freeze([
    "audio",
    "baseUrls",
    "models",
    "providerId",
    "revision",
    "schemaVersion"
]);
const LEGACY_SETTINGS_VERSION = 4;
const LEGACY_SETTINGS_KEYS = Object.freeze([
    "audio",
    "models",
    "providerId",
    "revision",
    "schemaVersion"
]);

export class BrokerSettingsSerializer {

    encode(settings) {
        let normalized;

        try {
            normalized = createBrokerSettings(
                settings
            );
        } catch (error) {
            if (isVersionError(error)) {
                throw error;
            }

            throw BrokerConfigurationError
                .invalidSettings(error);
        }

        return freezeJson({
            format:
                BROKER_SETTINGS_SNAPSHOT_FORMAT,
            formatVersion:
                BROKER_SETTINGS_SNAPSHOT_VERSION,
            settings: cloneJson(normalized)
        });
    }

    decode(source) {
        const version = requireSupportedSnapshot(
            source
        );

        if (version === LEGACY_SETTINGS_VERSION) {
            return migrateLegacySnapshot(source);
        }

        requireCurrentSnapshot(source);
        let settings;

        try {
            settings = createBrokerSettings(
                source.settings
            );
        } catch (error) {
            if (isVersionError(error)) {
                throw error;
            }

            throw BrokerConfigurationError
                .invalidSettings(error);
        }

        return Object.freeze({
            settings,
            migratedFrom: null
        });
    }
}

export const brokerSettingsSerializer =
    Object.freeze(
        new BrokerSettingsSerializer()
    );

function requireCurrentSnapshot(source) {
    if (
        !isRecord(source) ||
        !hasExactKeys(
            source,
            SNAPSHOT_KEYS
        ) ||
        source.format !==
            BROKER_SETTINGS_SNAPSHOT_FORMAT ||
        !Number.isInteger(
            source.formatVersion
        ) ||
        source.formatVersion < 1 ||
        !isRecord(source.settings) ||
        !hasExactKeys(
            source.settings,
            SETTINGS_KEYS
        )
    ) {
        throw BrokerConfigurationError
            .invalidSettings();
    }

    if (
        source.formatVersion >
        BROKER_SETTINGS_SNAPSHOT_VERSION
    ) {
        throw BrokerConfigurationError
            .unsupportedVersion(
                "snapshot",
                source.formatVersion
            );
    }

    if (
        source.formatVersion !==
        BROKER_SETTINGS_SNAPSHOT_VERSION
    ) {
        throw BrokerConfigurationError
            .invalidSettings();
    }

    const domainVersion =
        source.settings.schemaVersion;

    if (
        Number.isInteger(domainVersion) &&
        domainVersion >
            BROKER_SETTINGS_SCHEMA_VERSION
    ) {
        throw BrokerConfigurationError
            .unsupportedVersion(
                "domain schema",
                domainVersion
            );
    }

    if (
        domainVersion !==
        BROKER_SETTINGS_SCHEMA_VERSION
    ) {
        throw BrokerConfigurationError
            .invalidSettings();
    }
}

function requireSupportedSnapshot(source) {
    if (
        !isRecord(source) ||
        !hasExactKeys(source, SNAPSHOT_KEYS) ||
        source.format !==
            BROKER_SETTINGS_SNAPSHOT_FORMAT ||
        !Number.isInteger(source.formatVersion) ||
        source.formatVersion < 1
    ) {
        throw BrokerConfigurationError
            .invalidSettings();
    }

    if (
        source.formatVersion >
        BROKER_SETTINGS_SNAPSHOT_VERSION
    ) {
        throw BrokerConfigurationError
            .unsupportedVersion(
                "snapshot",
                source.formatVersion
            );
    }

    return source.formatVersion;
}

function migrateLegacySnapshot(source) {
    if (
        !isRecord(source.settings) ||
        !hasExactKeys(
            source.settings,
            LEGACY_SETTINGS_KEYS
        ) ||
        source.settings.schemaVersion !==
            LEGACY_SETTINGS_VERSION
    ) {
        throw BrokerConfigurationError
            .invalidSettings();
    }

    let settings;

    try {
        settings = createBrokerSettings({
            ...source.settings,
            schemaVersion:
                BROKER_SETTINGS_SCHEMA_VERSION,
            baseUrls: {}
        });
    } catch (error) {
        throw BrokerConfigurationError
            .invalidSettings(error);
    }

    return Object.freeze({
        settings,
        migratedFrom: LEGACY_SETTINGS_VERSION
    });
}

function hasExactKeys(value, expected) {
    const keys = Object.keys(value).sort();

    return keys.length === expected.length &&
        keys.every(
            (key, index) =>
                key === expected[index]
        );
}

function cloneJson(value) {
    try {
        return JSON.parse(
            JSON.stringify(value)
        );
    } catch (error) {
        throw BrokerConfigurationError
            .invalidSettings(error);
    }
}

function freezeJson(value) {
    if (
        value == null ||
        typeof value !== "object"
    ) {
        return value;
    }

    for (const item of Object.values(value)) {
        freezeJson(item);
    }

    return Object.freeze(value);
}

function isRecord(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) ===
            Object.prototype;
}

function isVersionError(error) {
    return error?.code ===
        "BROKER95_SETTINGS_VERSION_UNSUPPORTED";
}
