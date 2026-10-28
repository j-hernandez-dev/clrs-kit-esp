import {
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

export const BROKER95_GLOBAL_SETTINGS_KEY =
    "broker95.settings";
export const BROKER95_CORRUPT_SETTINGS_KEY =
    "broker95.settings.corrupt";

export class VSCodeGlobalStateBrokerSettingsRepository {

    constructor(globalState, options = {}) {
        this.globalState = requirePort(
            globalState,
            "extensionContext.globalState",
            ["get", "update"]
        );
        this.settingsKey =
            options.settingsKey ??
            BROKER95_GLOBAL_SETTINGS_KEY;
        this.corruptSettingsKey =
            options.corruptSettingsKey ??
            BROKER95_CORRUPT_SETTINGS_KEY;
    }

    async read() {
        return this.globalState.get(
            this.settingsKey
        );
    }

    async write(snapshot) {
        await this.globalState.update(
            this.settingsKey,
            snapshot
        );
    }

    async quarantine(
        snapshot,
        errorCode
    ) {
        await this.globalState.update(
            this.corruptSettingsKey,
            Object.freeze({
                format:
                    "broker95-corrupt-settings",
                formatVersion: 1,
                errorCode,
                snapshotMetadata:
                    describeSnapshot(snapshot)
            })
        );
    }
}

function describeSnapshot(snapshot) {
    const isObject =
        snapshot != null &&
        typeof snapshot === "object" &&
        !Array.isArray(snapshot);
    const formatVersion =
        isObject &&
        Number.isInteger(
            snapshot.formatVersion
        )
            ? snapshot.formatVersion
            : null;

    return Object.freeze({
        valueType: Array.isArray(snapshot)
            ? "array"
            : snapshot === null
                ? "null"
                : typeof snapshot,
        recognizedFormat:
            isObject &&
            snapshot.format ===
                "broker95-settings",
        formatVersion,
        hasSettingsObject:
            isObject &&
            snapshot.settings != null &&
            typeof snapshot.settings ===
                "object" &&
            !Array.isArray(
                snapshot.settings
            )
    });
}
