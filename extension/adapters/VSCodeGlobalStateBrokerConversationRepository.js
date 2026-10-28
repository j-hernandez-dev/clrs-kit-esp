import {
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";

export const BROKER95_GLOBAL_CONVERSATION_KEY =
    "broker95.conversation";
export const BROKER95_CORRUPT_CONVERSATION_KEY =
    "broker95.conversation.corrupt";

export class VSCodeGlobalStateBrokerConversationRepository {

    constructor(globalState, options = {}) {
        this.globalState = requirePort(
            globalState,
            "extensionContext.globalState",
            ["get", "update"]
        );
        this.conversationKey =
            options.conversationKey ??
            BROKER95_GLOBAL_CONVERSATION_KEY;
        this.corruptConversationKey =
            options.corruptConversationKey ??
            BROKER95_CORRUPT_CONVERSATION_KEY;
    }

    async read() {
        return this.globalState.get(
            this.conversationKey
        );
    }

    async write(snapshot) {
        await this.globalState.update(
            this.conversationKey,
            snapshot
        );
    }

    async quarantine(
        snapshot,
        errorCode
    ) {
        await this.globalState.update(
            this.corruptConversationKey,
            Object.freeze({
                format:
                    "broker95-corrupt-conversation",
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
    const state = isObject &&
        snapshot.state != null &&
        typeof snapshot.state === "object" &&
        !Array.isArray(snapshot.state)
        ? snapshot.state
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
                "broker95-conversation-history",
        formatVersion:
            isObject &&
            Number.isInteger(
                snapshot.formatVersion
            )
                ? snapshot.formatVersion
                : null,
        declaredTurnCount:
            Array.isArray(state?.turns)
                ? state.turns.length
                : null
    });
}
