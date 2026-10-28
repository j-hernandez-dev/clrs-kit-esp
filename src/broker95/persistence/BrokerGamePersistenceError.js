import {
    ApplicationError
} from "../../errors/ApplicationError.js";

export class BrokerGamePersistenceError
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
            "BrokerGamePersistenceError";
    }

    static invalidSnapshot(cause) {
        return new BrokerGamePersistenceError(
            "Invalid BROKER.95 persisted game snapshot.",
            "La partida guardada de BROKER.95 no es válida.",
            "BROKER95_PERSISTENCE_SNAPSHOT_INVALID",
            { cause }
        );
    }

    static unsupportedVersion(
        versionKind,
        value
    ) {
        return new BrokerGamePersistenceError(
            `Unsupported BROKER.95 ${versionKind} version: ${String(value)}.`,
            "La partida fue creada con una versión incompatible de BROKER.95.",
            "BROKER95_PERSISTENCE_VERSION_UNSUPPORTED",
            {
                diagnostics: [{
                    versionKind,
                    value
                }]
            }
        );
    }

    static storageFailure(operation, cause) {
        return new BrokerGamePersistenceError(
            `BROKER.95 global storage ${operation} failed.`,
            "No fue posible acceder a la partida guardada de BROKER.95.",
            "BROKER95_PERSISTENCE_STORAGE_ERROR",
            {
                cause,
                diagnostics: [{ operation }]
            }
        );
    }

    static notReady() {
        return new BrokerGamePersistenceError(
            "BROKER.95 game session is not initialized.",
            "La partida de BROKER.95 todavía no está lista.",
            "BROKER95_SESSION_NOT_READY"
        );
    }

    static disposed() {
        return new BrokerGamePersistenceError(
            "BROKER.95 game session is disposed.",
            "La sesión de BROKER.95 ya fue cerrada.",
            "BROKER95_SESSION_DISPOSED"
        );
    }

    static revisionConflict(
        expectedRevision,
        actualRevision
    ) {
        return new BrokerGamePersistenceError(
            `Stale BROKER.95 game revision: expected ${expectedRevision}, actual ${actualRevision}.`,
            "La partida cambió antes de completar la acción. Inténtalo de nuevo.",
            "BROKER95_SESSION_REVISION_CONFLICT",
            {
                diagnostics: [{
                    expectedRevision,
                    actualRevision
                }]
            }
        );
    }

    static invalidTransition(reason) {
        return new BrokerGamePersistenceError(
            `Invalid BROKER.95 persisted transition: ${reason}.`,
            "No fue posible guardar el cambio de la partida.",
            "BROKER95_SESSION_TRANSITION_INVALID",
            {
                diagnostics: [{ reason }]
            }
        );
    }
}
