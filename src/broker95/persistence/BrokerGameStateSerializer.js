import {
    BROKER_GAME_SCHEMA_VERSION,
    createBrokerGameState
} from "../core/BrokerGameState.js";
import {
    BROKER_CONTRACT_TYPES
} from "../core/BrokerContract.js";
import {
    BrokerGamePersistenceError
} from "./BrokerGamePersistenceError.js";

export const BROKER_GAME_SNAPSHOT_FORMAT =
    "broker95-game-state";
export const BROKER_GAME_SNAPSHOT_VERSION = 4;

const GAME_STATE_KEYS = Object.freeze([
    "activeContractId",
    "alertLevel",
    "categoryHistory",
    "completedContractIds",
    "contracts",
    "failedContractIds",
    "learningProgress",
    "money",
    "nextContractId",
    "revision",
    "schemaVersion",
    "statistics",
    "status",
    "technicalProfile"
]);

export class BrokerGameStateSerializer {

    constructor(options = {}) {
        this.catalogs = options.catalogs;
    }

    encode(state) {
        let normalized;

        try {
            normalized =
                createBrokerGameState(
                    state,
                    { catalogs: this.catalogs }
                );
        } catch (error) {
            throw BrokerGamePersistenceError
                .invalidSnapshot(error);
        }

        return freezeJson({
            format:
                BROKER_GAME_SNAPSHOT_FORMAT,
            formatVersion:
                BROKER_GAME_SNAPSHOT_VERSION,
            state: cloneJson(normalized)
        });
    }

    decode(snapshot) {
        requireCurrentSnapshot(snapshot);
        let state;

        try {
            state = createBrokerGameState(
                snapshot.state,
                { catalogs: this.catalogs }
            );
        } catch (error) {
            if (
                error instanceof
                BrokerGamePersistenceError
            ) {
                throw error;
            }

            throw BrokerGamePersistenceError
                .invalidSnapshot(error);
        }

        const reconciled =
            !sameJsonValue(
                snapshot.state,
                state
            );

        return Object.freeze({
            state,
            reconciled
        });
    }
}

export const brokerGameStateSerializer =
    Object.freeze(
        new BrokerGameStateSerializer()
    );

function requireCurrentSnapshot(snapshot) {
    if (!isRecord(snapshot)) {
        throw BrokerGamePersistenceError
            .invalidSnapshot();
    }

    const keys = Object.keys(snapshot).sort();
    const expected = [
        "format",
        "formatVersion",
        "state"
    ];

    if (
        snapshot.format !==
            BROKER_GAME_SNAPSHOT_FORMAT ||
        !Number.isInteger(
            snapshot.formatVersion
        ) ||
        snapshot.formatVersion < 1 ||
        keys.length !== expected.length ||
        keys.some(
            (key, index) =>
                key !== expected[index]
        ) ||
        !isRecord(snapshot.state)
    ) {
        throw BrokerGamePersistenceError
            .invalidSnapshot();
    }

    if (
        snapshot.formatVersion >
        BROKER_GAME_SNAPSHOT_VERSION
    ) {
        throw BrokerGamePersistenceError
            .unsupportedVersion(
                "snapshot",
                snapshot.formatVersion
            );
    }

    if (
        snapshot.formatVersion !==
        BROKER_GAME_SNAPSHOT_VERSION
    ) {
        throw BrokerGamePersistenceError
            .invalidSnapshot();
    }

    const domainVersion =
        snapshot.state.schemaVersion;

    if (
        Number.isInteger(domainVersion) &&
        domainVersion >
            BROKER_GAME_SCHEMA_VERSION
    ) {
        throw BrokerGamePersistenceError
            .unsupportedVersion(
                "domain schema",
                domainVersion
            );
    }

    if (
        domainVersion !==
        BROKER_GAME_SCHEMA_VERSION
    ) {
        throw BrokerGamePersistenceError
            .invalidSnapshot();
    }

    requireCurrentGameStateShape(
        snapshot.state
    );
}

function requireCurrentGameStateShape(state) {
    const keys = Object.keys(state).sort();

    if (
        keys.length !== GAME_STATE_KEYS.length ||
        keys.some(
            (key, index) =>
                key !== GAME_STATE_KEYS[index]
        ) ||
        !Array.isArray(state.contracts)
    ) {
        throw BrokerGamePersistenceError
            .invalidSnapshot();
    }

    for (const contract of state.contracts) {
        if (
            !isRecord(contract) ||
            !BROKER_CONTRACT_TYPES.includes(
                contract.contractType
            ) ||
            !Array.isArray(contract.testCases)
        ) {
            throw BrokerGamePersistenceError
                .invalidSnapshot();
        }
    }
}

function cloneJson(value) {
    try {
        return JSON.parse(
            JSON.stringify(value)
        );
    } catch (error) {
        throw BrokerGamePersistenceError
            .invalidSnapshot(error);
    }
}

function sameJsonValue(left, right) {
    try {
        return JSON.stringify(left) ===
            JSON.stringify(right);
    } catch {
        return false;
    }
}

function freezeJson(value) {
    if (
        value == null ||
        typeof value !== "object"
    ) {
        return value;
    }

    for (
        const item
        of Object.values(value)
    ) {
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
