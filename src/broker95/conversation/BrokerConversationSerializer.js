import {
    BROKER_CONVERSATION_SCHEMA_VERSION,
    createBrokerConversationState
} from "./BrokerConversationState.js";
import {
    BrokerConversationError
} from "./BrokerConversationError.js";

export const BROKER_CONVERSATION_SNAPSHOT_FORMAT =
    "broker95-conversation-history";
export const BROKER_CONVERSATION_SNAPSHOT_VERSION = 1;

const STATE_KEYS = Object.freeze([
    "nextTurnId",
    "revision",
    "schemaVersion",
    "turns"
]);
const TURN_KEYS = Object.freeze([
    "assistantContent",
    "id",
    "userContent"
]);

export class BrokerConversationSerializer {

    encode(state) {
        let normalized;

        try {
            normalized =
                createBrokerConversationState(
                    state
                );
        } catch (error) {
            if (isVersionError(error)) {
                throw error;
            }

            throw BrokerConversationError
                .invalidState(error);
        }

        return freezeJson({
            format:
                BROKER_CONVERSATION_SNAPSHOT_FORMAT,
            formatVersion:
                BROKER_CONVERSATION_SNAPSHOT_VERSION,
            state: cloneJson(normalized)
        });
    }

    decode(source) {
        requireCurrentSnapshot(source);
        const sourceTurnCount =
            source.state.turns.length;
        let state;

        try {
            state = createBrokerConversationState(
                source.state
            );
        } catch (error) {
            if (isVersionError(error)) {
                throw error;
            }

            throw BrokerConversationError
                .invalidState(error);
        }

        const retentionApplied =
            state.turns.length <
            sourceTurnCount;

        return Object.freeze({
            state,
            retentionApplied
        });
    }
}

export const brokerConversationSerializer =
    Object.freeze(
        new BrokerConversationSerializer()
    );

function requireCurrentSnapshot(source) {
    if (!isRecord(source)) {
        throw BrokerConversationError
            .invalidState();
    }

    if (
        source.format !==
            BROKER_CONVERSATION_SNAPSHOT_FORMAT ||
        !Number.isInteger(
            source.formatVersion
        ) ||
        source.formatVersion < 1
    ) {
        throw BrokerConversationError
            .invalidState();
    }

    if (
        source.formatVersion >
        BROKER_CONVERSATION_SNAPSHOT_VERSION
    ) {
        throw BrokerConversationError
            .unsupportedVersion(
                "snapshot",
                source.formatVersion
            );
    }

    if (
        source.formatVersion !==
        BROKER_CONVERSATION_SNAPSHOT_VERSION
    ) {
        throw BrokerConversationError
            .invalidState();
    }

    const keys = Object.keys(source).sort();
    const expected = [
        "format",
        "formatVersion",
        "state"
    ];

    if (
        keys.length !== expected.length ||
        keys.some(
            (key, index) =>
                key !== expected[index]
        ) ||
        !isRecord(source.state)
    ) {
        throw BrokerConversationError
            .invalidState();
    }

    requireExactState(source.state);
    requireDomainVersion(
        source.state.schemaVersion
    );
}

function requireExactState(state) {
    if (!isRecord(state)) {
        throw BrokerConversationError
            .invalidState();
    }

    const keys = Object.keys(state).sort();

    if (
        keys.length !== STATE_KEYS.length ||
        keys.some(
            (key, index) =>
                key !== STATE_KEYS[index]
        ) ||
        !Array.isArray(state.turns)
    ) {
        throw BrokerConversationError
            .invalidState();
    }

    for (const turn of state.turns) {
        const turnKeys = isRecord(turn)
            ? Object.keys(turn).sort()
            : [];

        if (
            !isRecord(turn) ||
            turnKeys.length !==
                TURN_KEYS.length ||
            turnKeys.some(
                (key, index) =>
                    key !== TURN_KEYS[index]
            )
        ) {
            throw BrokerConversationError
                .invalidState();
        }
    }
}

function requireDomainVersion(value) {
    if (
        Number.isInteger(value) &&
        value >
            BROKER_CONVERSATION_SCHEMA_VERSION
    ) {
        throw BrokerConversationError
            .unsupportedVersion(
                "domain schema",
                value
            );
    }

    if (
        value !==
        BROKER_CONVERSATION_SCHEMA_VERSION
    ) {
        throw BrokerConversationError
            .invalidState();
    }
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
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
        "BROKER95_CONVERSATION_VERSION_UNSUPPORTED";
}
