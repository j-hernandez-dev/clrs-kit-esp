import {
    requireFunction,
    requirePort
} from "../../application/ports/ApplicationPorts.js";
import {
    BrokerConversationError
} from "./BrokerConversationError.js";
import {
    appendBrokerConversationTurn,
    clearBrokerConversation,
    createBrokerConversationState,
    createBrokerConversationSummary,
    createBrokerLlmConversationMessages
} from "./BrokerConversationState.js";
import {
    brokerConversationSerializer
} from "./BrokerConversationSerializer.js";

export const BrokerConversationLoadSource =
    Object.freeze({
        CREATED: "created",
        RESTORED: "restored",
        RECOVERED: "recovered",
        COMPACTED: "compacted"
    });

export class BrokerConversationSession {

    constructor(options = {}) {
        this.repository = requirePort(
            options.repository,
            "brokerConversationRepository",
            ["read", "write", "quarantine"]
        );
        this.serializer = requirePort(
            options.serializer ??
                brokerConversationSerializer,
            "brokerConversationSerializer",
            ["encode", "decode"]
        );
        this.developerLogger =
            options.developerLogger ??
            console;
        this.state = null;
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

    getState() {
        this.#requireReady();
        return this.state;
    }

    getTurns() {
        return this.getState().turns;
    }

    getLlmMessages() {
        return createBrokerLlmConversationMessages(
            this.getState()
        );
    }

    getSummary() {
        return createBrokerConversationSummary(
            this.getState()
        );
    }

    async appendTurn(input, options = {}) {
        await this.initialize();

        return this.#enqueue(async () => {
            this.#requireActive();
            const current = this.state;

            requireExpectedRevision(
                options.expectedRevision,
                current.revision
            );

            const next =
                appendBrokerConversationTurn(
                    current,
                    input
                );
            const addedTurnId =
                current.nextTurnId;
            const trimmedTurnCount =
                current.turns.length + 1 -
                next.turns.length;

            await this.#write(next);
            this.state = next;

            const result = Object.freeze({
                state: next,
                addedTurnId,
                trimmedTurnCount
            });

            this.#notify(
                result,
                "conversation/turn-appended"
            );

            return result;
        });
    }

    async clear(options = {}) {
        await this.initialize();

        return this.#enqueue(async () => {
            this.#requireActive();
            const current = this.state;

            requireExpectedRevision(
                options.expectedRevision,
                current.revision
            );

            const next =
                clearBrokerConversation(
                    current
                );

            if (
                next.turns.length ===
                    current.turns.length &&
                next.revision ===
                    current.revision
            ) {
                return Object.freeze({
                    state: current,
                    clearedTurnCount: 0
                });
            }

            await this.#write(next);
            this.state = next;

            const result = Object.freeze({
                state: next,
                clearedTurnCount:
                    current.turns.length
            });

            this.#notify(
                result,
                "conversation/cleared"
            );

            return result;
        });
    }

    subscribe(listener) {
        this.#requireActive();
        requireFunction(
            listener,
            "brokerConversationListener"
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
        const stored = await this.#read();

        if (stored === undefined) {
            const state =
                createBrokerConversationState();

            await this.#write(state);

            return this.#finishLoad(
                state,
                BrokerConversationLoadSource
                    .CREATED
            );
        }

        let decoded;

        try {
            decoded = this.serializer.decode(
                stored
            );
        } catch (error) {
            if (
                error?.code ===
                "BROKER95_CONVERSATION_VERSION_UNSUPPORTED"
            ) {
                throw error;
            }

            const invalid =
                error instanceof
                    BrokerConversationError
                    ? error
                    : BrokerConversationError
                        .invalidState(error);

            await this.#quarantine(
                stored,
                invalid.code
            );

            const state =
                createBrokerConversationState();

            await this.#write(state);

            return this.#finishLoad(
                state,
                BrokerConversationLoadSource
                    .RECOVERED,
                invalid.code
            );
        }

        if (decoded.retentionApplied) {
            await this.#write(decoded.state);
        }

        return this.#finishLoad(
            decoded.state,
            decoded.retentionApplied
                ? BrokerConversationLoadSource
                    .COMPACTED
                : BrokerConversationLoadSource
                    .RESTORED,
            null,
            decoded.retentionApplied === true
        );
    }

    #finishLoad(
        state,
        source,
        recoveryCode = null,
        retentionApplied = false
    ) {
        this.state = state;
        this.loadResult = Object.freeze({
            state,
            source,
            retentionApplied,
            recoveryCode
        });
        this.#notify(
            this.loadResult,
            "conversation/initialized"
        );

        return this.loadResult;
    }

    async #read() {
        try {
            return await this.repository
                .read();
        } catch (error) {
            throw BrokerConversationError
                .storageFailure(
                    "read",
                    error
                );
        }
    }

    async #write(state) {
        try {
            const snapshot =
                this.serializer.encode(state);

            await this.repository.write(
                snapshot
            );
        } catch (error) {
            if (
                error instanceof
                    BrokerConversationError &&
                error.code !==
                    "BROKER95_CONVERSATION_STORAGE_ERROR"
            ) {
                throw error;
            }

            throw BrokerConversationError
                .storageFailure(
                    "write",
                    error
                );
        }
    }

    async #quarantine(snapshot, errorCode) {
        try {
            await this.repository.quarantine(
                snapshot,
                errorCode
            );
        } catch (error) {
            throw BrokerConversationError
                .storageFailure(
                    "quarantine",
                    error
                );
        }
    }

    #notify(result, reason) {
        const event = Object.freeze({
            ...result,
            reason
        });

        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                try {
                    this.developerLogger.error?.(
                        "BROKER.95 conversation listener failed.",
                        error
                    );
                } catch {
                    // El log no altera un turno ya persistido.
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

        if (!this.state) {
            throw BrokerConversationError
                .notReady();
        }
    }

    #requireActive() {
        if (this.disposed) {
            throw BrokerConversationError
                .disposed();
        }
    }
}

export function createBrokerConversationSummaryView(
    session
) {
    const selected = requirePort(
        session,
        "brokerConversationSession",
        ["getSummary", "subscribe"]
    );

    return Object.freeze({
        getSummary: () =>
            selected.getSummary(),
        subscribe(listener) {
            requireFunction(
                listener,
                "brokerConversationSummaryListener"
            );

            return selected.subscribe(event => {
                listener(Object.freeze({
                    summary:
                        createBrokerConversationSummary(
                            event.state
                        ),
                    reason: event.reason,
                    trimmedTurnCount:
                        event.trimmedTurnCount ??
                        0,
                    clearedTurnCount:
                        event.clearedTurnCount ??
                        0
                }));
            });
        }
    });
}

function requireExpectedRevision(
    expected,
    actual
) {
    if (expected == null) {
        return;
    }

    if (
        !Number.isSafeInteger(expected) ||
        expected < 0 ||
        expected !== actual
    ) {
        throw BrokerConversationError
            .revisionConflict(
                expected,
                actual
            );
    }
}
