import {
    BrokerConversationError
} from "./BrokerConversationError.js";

export const BROKER_CONVERSATION_SCHEMA_VERSION = 1;
export const BROKER_CONVERSATION_MAX_TURNS = 48;
export const BROKER_CONVERSATION_MAX_CHARACTERS =
    131072;
export const BROKER_CONVERSATION_MAX_MESSAGE_CHARACTERS =
    65536;

export const BrokerConversationRole =
    Object.freeze({
        USER: "user",
        ASSISTANT: "assistant"
    });

export function createBrokerConversationTurn(
    source = {}
) {
    return Object.freeze({
        id: requirePositiveSafeInteger(
            source.id
        ),
        userContent: requireContent(
            source.userContent
        ),
        assistantContent: requireContent(
            source.assistantContent
        )
    });
}

export function createBrokerConversationState(
    source = {}
) {
    const schemaVersion =
        source.schemaVersion ??
        BROKER_CONVERSATION_SCHEMA_VERSION;

    if (
        schemaVersion !==
        BROKER_CONVERSATION_SCHEMA_VERSION
    ) {
        throw BrokerConversationError
            .unsupportedVersion(
                "domain schema",
                schemaVersion
            );
    }

    if (
        source.turns != null &&
        !Array.isArray(source.turns)
    ) {
        throw BrokerConversationError
            .invalidState();
    }

    const turns = (source.turns ?? [])
        .map(createBrokerConversationTurn);

    requireOrderedTurns(turns);

    const nextTurnId =
        requirePositiveSafeInteger(
            source.nextTurnId ?? 1
        );
    const lastTurn = turns.at(-1);

    if (
        lastTurn &&
        lastTurn.id >= nextTurnId
    ) {
        throw BrokerConversationError
            .invalidState();
    }

    return Object.freeze({
        schemaVersion,
        revision: requireRevision(
            source.revision ?? 0
        ),
        nextTurnId,
        turns: Object.freeze(
            boundConversationTurns(turns)
        )
    });
}

export function appendBrokerConversationTurn(
    state,
    input
) {
    const current =
        createBrokerConversationState(state);

    if (
        current.nextTurnId >=
        Number.MAX_SAFE_INTEGER
    ) {
        throw BrokerConversationError
            .invalidState();
    }

    return createBrokerConversationState({
        ...current,
        revision: current.revision + 1,
        nextTurnId: current.nextTurnId + 1,
        turns: [
            ...current.turns,
            createBrokerConversationTurn({
                id: current.nextTurnId,
                userContent:
                    input?.userContent,
                assistantContent:
                    input?.assistantContent
            })
        ]
    });
}

export function clearBrokerConversation(
    state
) {
    const current =
        createBrokerConversationState(state);

    if (current.turns.length === 0) {
        return current;
    }

    return createBrokerConversationState({
        ...current,
        revision: current.revision + 1,
        turns: []
    });
}

export function createBrokerConversationSummary(
    state
) {
    const current =
        createBrokerConversationState(state);
    const totalCharacters =
        countConversationCharacters(
            current.turns
        );

    return Object.freeze({
        revision: current.revision,
        turnCount: current.turns.length,
        messageCount:
            current.turns.length * 2,
        totalCharacters,
        limits: Object.freeze({
            maximumTurns:
                BROKER_CONVERSATION_MAX_TURNS,
            maximumCharacters:
                BROKER_CONVERSATION_MAX_CHARACTERS,
            maximumMessageCharacters:
                BROKER_CONVERSATION_MAX_MESSAGE_CHARACTERS
        })
    });
}

export function createBrokerLlmConversationMessages(
    state
) {
    const current =
        createBrokerConversationState(state);

    return Object.freeze(
        current.turns.flatMap(turn => [
            Object.freeze({
                role:
                    BrokerConversationRole.USER,
                content: turn.userContent
            }),
            Object.freeze({
                role:
                    BrokerConversationRole
                        .ASSISTANT,
                content:
                    turn.assistantContent
            })
        ])
    );
}

export function countConversationCharacters(
    turns
) {
    return turns.reduce(
        (total, turn) =>
            total +
            turn.userContent.length +
            turn.assistantContent.length,
        0
    );
}

function boundConversationTurns(turns) {
    const retained = [...turns];
    let totalCharacters =
        countConversationCharacters(
            retained
        );

    while (
        retained.length >
            BROKER_CONVERSATION_MAX_TURNS ||
        totalCharacters >
            BROKER_CONVERSATION_MAX_CHARACTERS
    ) {
        const removed = retained.shift();

        totalCharacters -=
            removed.userContent.length +
            removed.assistantContent.length;
    }

    return retained;
}

function requireOrderedTurns(turns) {
    for (
        let index = 1;
        index < turns.length;
        index += 1
    ) {
        if (
            turns[index - 1].id >=
            turns[index].id
        ) {
            throw BrokerConversationError
                .invalidState();
        }
    }
}

function requireContent(value) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length >
            BROKER_CONVERSATION_MAX_MESSAGE_CHARACTERS ||
        value.includes("\u0000")
    ) {
        throw BrokerConversationError
            .invalidMessage();
    }

    return value;
}

function requirePositiveSafeInteger(value) {
    if (
        !Number.isSafeInteger(value) ||
        value <= 0
    ) {
        throw BrokerConversationError
            .invalidState();
    }

    return value;
}

function requireRevision(value) {
    if (
        !Number.isSafeInteger(value) ||
        value < 0
    ) {
        throw BrokerConversationError
            .invalidState();
    }

    return value;
}
