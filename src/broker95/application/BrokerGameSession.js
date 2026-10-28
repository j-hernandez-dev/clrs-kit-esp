import {
    requireFunction,
    requirePort
} from "../../application/ports/ApplicationPorts.js";
import {
    createBrokerGameState
} from "../core/BrokerGameState.js";
import {
    createInitialBrokerGameState
} from "../core/BrokerStateTransition.js";
import {
    BrokerGamePersistenceError
} from "../persistence/BrokerGamePersistenceError.js";
import {
    BrokerGameStateSerializer,
    brokerGameStateSerializer
} from "../persistence/BrokerGameStateSerializer.js";

export const BrokerGameLoadSource =
    Object.freeze({
        CREATED: "created",
        RESTORED: "restored",
        RECOVERED: "recovered",
        RECONCILED: "reconciled"
    });

export class BrokerGameSession {

    constructor(options = {}) {
        this.repository = requirePort(
            options.repository,
            "brokerGameRepository",
            ["read", "write", "quarantine"]
        );
        this.catalogs = options.catalogs;
        this.serializer = requirePort(
            options.serializer ??
                (
                    options.catalogs == null
                        ? brokerGameStateSerializer
                        : new BrokerGameStateSerializer({
                            catalogs: options.catalogs
                        })
                ),
            "brokerGameStateSerializer",
            ["encode", "decode"]
        );
        this.createInitialState =
            requireFunction(
                options.createInitialState ??
                    createInitialBrokerGameState,
                "createInitialBrokerGameState"
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
        this.#requireActive();

        if (!this.state) {
            throw BrokerGamePersistenceError
                .notReady();
        }

        return this.state;
    }

    getLoadResult() {
        this.#requireActive();

        if (!this.loadResult) {
            throw BrokerGamePersistenceError
                .notReady();
        }

        return this.loadResult;
    }

    async transact(
        transition,
        options = {}
    ) {
        requireFunction(
            transition,
            "brokerGameTransition"
        );
        await this.initialize();

        return this.#enqueue(async () => {
            this.#requireActive();
            const current = this.state;

            requireExpectedRevision(
                options.expectedRevision,
                current.revision
            );

            const candidate = transition(
                current,
                Object.freeze({
                    catalogs: this.catalogs
                })
            );

            if (isPromiseLike(candidate)) {
                throw BrokerGamePersistenceError
                    .invalidTransition(
                        "transition must be synchronous"
                    );
            }

            if (candidate === current) {
                return current;
            }

            let next;

            try {
                next = createBrokerGameState(
                    candidate,
                    { catalogs: this.catalogs }
                );
            } catch (error) {
                throw BrokerGamePersistenceError
                    .invalidTransition(
                        error.code ??
                        "invalid state"
                    );
            }

            if (
                next.revision !==
                current.revision + 1
            ) {
                throw BrokerGamePersistenceError
                    .invalidTransition(
                        "revision must advance exactly once"
                    );
            }

            await this.#write(next);
            this.state = next;
            this.#notify(next);

            return next;
        });
    }

    subscribe(listener) {
        this.#requireActive();
        requireFunction(
            listener,
            "brokerGameStateListener"
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
                this.#createInitial();

            await this.#write(state);

            return this.#finishLoad(
                state,
                BrokerGameLoadSource.CREATED
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
                "BROKER95_PERSISTENCE_VERSION_UNSUPPORTED"
            ) {
                throw error;
            }

            const invalid =
                error instanceof
                    BrokerGamePersistenceError
                    ? error
                    : BrokerGamePersistenceError
                        .invalidSnapshot(error);

            await this.#quarantine(
                stored,
                invalid.code
            );

            const state =
                this.#createInitial();

            await this.#write(state);

            return this.#finishLoad(
                state,
                BrokerGameLoadSource.RECOVERED,
                invalid.code
            );
        }

        if (decoded.reconciled) {
            await this.#write(decoded.state);
        }

        return this.#finishLoad(
            decoded.state,
            decoded.reconciled
                ? BrokerGameLoadSource
                    .RECONCILED
                : BrokerGameLoadSource
                    .RESTORED,
            null,
            decoded.reconciled === true
        );
    }

    #createInitial() {
        try {
            return createBrokerGameState(
                this.createInitialState(),
                { catalogs: this.catalogs }
            );
        } catch (error) {
            throw BrokerGamePersistenceError
                .invalidSnapshot(error);
        }
    }

    #finishLoad(
        state,
        source,
        recoveryCode = null,
        reconciled = false
    ) {
        this.state = state;
        this.loadResult = Object.freeze({
            state,
            source,
            reconciled,
            recoveryCode
        });
        this.#notify(state);

        return this.loadResult;
    }

    async #read() {
        try {
            return await this.repository
                .read();
        } catch (error) {
            throw BrokerGamePersistenceError
                .storageFailure(
                    "read",
                    error
                );
        }
    }

    async #write(state) {
        try {
            await this.repository.write(
                this.serializer.encode(
                    state
                )
            );
        } catch (error) {
            if (
                error instanceof
                BrokerGamePersistenceError &&
                error.code !==
                    "BROKER95_PERSISTENCE_STORAGE_ERROR"
            ) {
                throw error;
            }

            throw BrokerGamePersistenceError
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
            throw BrokerGamePersistenceError
                .storageFailure(
                    "quarantine",
                    error
                );
        }
    }

    #notify(state) {
        for (const listener of this.listeners) {
            try {
                listener(state);
            } catch (error) {
                try {
                    this.developerLogger.error?.(
                        "BROKER.95 game state listener failed.",
                        error
                    );
                } catch {
                    // El registro no altera una transacción ya persistida.
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

    #requireActive() {
        if (this.disposed) {
            throw BrokerGamePersistenceError
                .disposed();
        }
    }
}

function requireExpectedRevision(
    expected,
    actual
) {
    if (expected == null) {
        return;
    }

    if (
        !Number.isInteger(expected) ||
        expected < 0 ||
        expected !== actual
    ) {
        throw BrokerGamePersistenceError
            .revisionConflict(
                expected,
                actual
            );
    }
}

function isPromiseLike(value) {
    return value != null &&
        (
            typeof value === "object" ||
            typeof value === "function"
        ) &&
        typeof value.then === "function";
}
