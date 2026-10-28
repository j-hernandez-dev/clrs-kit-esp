import {
    ApplicationError
} from "../../errors/ApplicationError.js";

export class BrokerConversationError
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

        this.name = "BrokerConversationError";
    }

    static invalidState(cause) {
        return new BrokerConversationError(
            "Invalid BROKER.95 conversation history.",
            "El historial conversacional de BROKER.95 no es válido.",
            "BROKER95_CONVERSATION_STATE_INVALID",
            { cause }
        );
    }

    static invalidMessage() {
        return new BrokerConversationError(
            "Invalid BROKER.95 conversation message.",
            "El mensaje dirigido a CIPHER no es válido.",
            "BROKER95_CONVERSATION_MESSAGE_INVALID"
        );
    }

    static unsupportedVersion(
        versionKind,
        value
    ) {
        return new BrokerConversationError(
            `Unsupported BROKER.95 conversation ${versionKind} version: ${String(value)}.`,
            "El historial pertenece a una versión incompatible de BROKER.95.",
            "BROKER95_CONVERSATION_VERSION_UNSUPPORTED",
            {
                diagnostics: [{
                    versionKind,
                    value
                }]
            }
        );
    }

    static storageFailure(operation, cause) {
        return new BrokerConversationError(
            `BROKER.95 conversation storage ${operation} failed.`,
            "No fue posible acceder al historial conversacional de BROKER.95.",
            "BROKER95_CONVERSATION_STORAGE_ERROR",
            {
                cause,
                diagnostics: [{ operation }]
            }
        );
    }

    static revisionConflict(
        expectedRevision,
        actualRevision
    ) {
        return new BrokerConversationError(
            `Stale BROKER.95 conversation revision: expected ${expectedRevision}, actual ${actualRevision}.`,
            "El historial cambió antes de completar la conversación.",
            "BROKER95_CONVERSATION_REVISION_CONFLICT",
            {
                diagnostics: [{
                    expectedRevision,
                    actualRevision
                }]
            }
        );
    }

    static notReady() {
        return new BrokerConversationError(
            "BROKER.95 conversation session is not initialized.",
            "El historial de CIPHER todavía no está listo.",
            "BROKER95_CONVERSATION_NOT_READY"
        );
    }

    static disposed() {
        return new BrokerConversationError(
            "BROKER.95 conversation session is disposed.",
            "El historial de CIPHER ya fue cerrado.",
            "BROKER95_CONVERSATION_DISPOSED"
        );
    }
}
