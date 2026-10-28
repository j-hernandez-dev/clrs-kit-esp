import {
    ApplicationError
} from "../../errors/ApplicationError.js";
import {
    requireFunction,
    requirePort
} from "../../application/ports/ApplicationPorts.js";
import {
    BrokerLlmStatus,
    BrokerLlmStatusReason
} from "../protocol/BrokerProtocolTypes.js";
import {
    BrokerLLMProviderFailureKind
} from "./BrokerLLMProviderNormalization.js";

/** Causas canónicas y seguras para presentar el enlace con CIPHER. */
export const BrokerLlmAvailabilityReason =
    Object.freeze({
        MODEL_MISSING:
            BrokerLlmStatusReason.MODEL_MISSING,
        API_KEY_MISSING:
            BrokerLlmStatusReason.API_KEY_MISSING,
        OFFLINE: BrokerLlmStatusReason.OFFLINE,
        QUOTA_EXHAUSTED:
            BrokerLlmStatusReason.QUOTA_EXHAUSTED,
        AUTHENTICATION_FAILED:
            BrokerLlmStatusReason
                .AUTHENTICATION_FAILED,
        MODEL_UNAVAILABLE:
            BrokerLlmStatusReason
                .MODEL_UNAVAILABLE,
        TIMEOUT: BrokerLlmStatusReason.TIMEOUT,
        PROVIDER_ERROR:
            BrokerLlmStatusReason.PROVIDER_ERROR,
        INVALID_RESPONSE:
            BrokerLlmStatusReason.INVALID_RESPONSE
    });

const READY_AVAILABILITY = availability(
    BrokerLlmStatus.READY,
    BrokerLlmStatusReason.READY,
    "CIPHER está configurado.",
    "CIPHER está listo para recibir una solicitud.",
    null
);

const RETRYABLE_FAILURE_REASONS = new Set([
    BrokerLlmAvailabilityReason.OFFLINE,
    BrokerLlmAvailabilityReason.QUOTA_EXHAUSTED,
    BrokerLlmAvailabilityReason.TIMEOUT,
    BrokerLlmAvailabilityReason.PROVIDER_ERROR,
    BrokerLlmAvailabilityReason.INVALID_RESPONSE
]);

const AVAILABILITY_BY_REASON = Object.freeze({
    [BrokerLlmAvailabilityReason.MODEL_MISSING]:
        availability(
            BrokerLlmStatus.UNCONFIGURED,
            BrokerLlmAvailabilityReason
                .MODEL_MISSING,
            "CIPHER DESCONECTADO. No se configuró un modelo. Abre Configuración e introduce su identificador.",
            "CIPHER DESCONECTADO\nNo se configuró un modelo. Abre Configuración e introduce su identificador.",
            "BROKER95_LLM_MODEL_MISSING"
        ),
    [BrokerLlmAvailabilityReason.API_KEY_MISSING]:
        availability(
            BrokerLlmStatus.UNCONFIGURED,
            BrokerLlmAvailabilityReason
                .API_KEY_MISSING,
            "CIPHER DESCONECTADO. No se configuró una API key. Abre Configuración e introduce una credencial.",
            "CIPHER DESCONECTADO\nNo se configuró una API key. Abre Configuración e introduce una credencial.",
            "BROKER95_LLM_API_KEY_MISSING"
        ),
    [BrokerLlmAvailabilityReason.OFFLINE]:
        availability(
            BrokerLlmStatus.OFFLINE,
            BrokerLlmAvailabilityReason.OFFLINE,
            "CIPHER SIN ENLACE. No fue posible establecer conexión con el proveedor. Comprueba tu conexión a internet e inténtalo de nuevo.",
            "CIPHER SIN ENLACE\nNo fue posible establecer conexión con el proveedor. Comprueba tu conexión a internet e inténtalo de nuevo.",
            "BROKER95_LLM_OFFLINE"
        ),
    [BrokerLlmAvailabilityReason.QUOTA_EXHAUSTED]:
        availability(
            BrokerLlmStatus.RATE_LIMITED,
            BrokerLlmAvailabilityReason
                .QUOTA_EXHAUSTED,
            "CIPHER NO DISPONIBLE. El proveedor rechazó la solicitud porque la cuota o los tokens disponibles se agotaron.",
            "CIPHER NO DISPONIBLE\nEl proveedor rechazó la solicitud porque la cuota o los tokens disponibles se agotaron.",
            "BROKER95_LLM_QUOTA_EXHAUSTED"
        ),
    [BrokerLlmAvailabilityReason.AUTHENTICATION_FAILED]:
        availability(
            BrokerLlmStatus.UNAVAILABLE,
            BrokerLlmAvailabilityReason
                .AUTHENTICATION_FAILED,
            "CIPHER NO DISPONIBLE. El proveedor rechazó la API key. Revísala en Configuración e inténtalo de nuevo.",
            "CIPHER NO DISPONIBLE\nEl proveedor rechazó la API key. Revísala en Configuración e inténtalo de nuevo.",
            "BROKER95_LLM_AUTHENTICATION_FAILED"
        ),
    [BrokerLlmAvailabilityReason.MODEL_UNAVAILABLE]:
        availability(
            BrokerLlmStatus.UNAVAILABLE,
            BrokerLlmAvailabilityReason
                .MODEL_UNAVAILABLE,
            "CIPHER NO DISPONIBLE. El modelo configurado no está disponible para este proveedor. Revísalo en Configuración.",
            "CIPHER NO DISPONIBLE\nEl modelo configurado no está disponible para este proveedor. Revísalo en Configuración.",
            "BROKER95_LLM_MODEL_UNAVAILABLE"
        ),
    [BrokerLlmAvailabilityReason.TIMEOUT]:
        availability(
            BrokerLlmStatus.OFFLINE,
            BrokerLlmAvailabilityReason.TIMEOUT,
            "CIPHER NO DISPONIBLE. El proveedor tardó demasiado en responder. Inténtalo de nuevo.",
            "CIPHER NO DISPONIBLE\nEl proveedor tardó demasiado en responder. Inténtalo de nuevo.",
            "BROKER95_LLM_TIMEOUT"
        ),
    [BrokerLlmAvailabilityReason.PROVIDER_ERROR]:
        availability(
            BrokerLlmStatus.UNAVAILABLE,
            BrokerLlmAvailabilityReason
                .PROVIDER_ERROR,
            "CIPHER NO DISPONIBLE. El proveedor no pudo procesar la solicitud. Inténtalo de nuevo más tarde.",
            "CIPHER NO DISPONIBLE\nEl proveedor no pudo procesar la solicitud. Inténtalo de nuevo más tarde.",
            "BROKER95_LLM_PROVIDER_ERROR"
        ),
    [BrokerLlmAvailabilityReason.INVALID_RESPONSE]:
        availability(
            BrokerLlmStatus.UNAVAILABLE,
            BrokerLlmAvailabilityReason
                .INVALID_RESPONSE,
            "CIPHER NO DISPONIBLE. La respuesta del proveedor no pudo validarse. Inténtalo de nuevo.",
            "CIPHER NO DISPONIBLE\nLa respuesta del proveedor no pudo validarse. Inténtalo de nuevo.",
            "BROKER95_LLM_INVALID_RESPONSE"
        )
});

export class BrokerLlmAvailabilityError
    extends ApplicationError {

    constructor(availabilityValue, cause) {
        super(
            `BROKER.95 LLM is unavailable: ${availabilityValue.reason}.`,
            {
                code: availabilityValue.code,
                publicMessage:
                    availabilityValue.terminalMessage,
                diagnostics: [{
                    status: availabilityValue.status,
                    reason: availabilityValue.reason
                }],
                cause
            }
        );

        this.name = "BrokerLlmAvailabilityError";
        this.availability = availabilityValue;
    }
}

export function createBrokerLlmAvailability(reason) {
    if (reason === BrokerLlmStatusReason.READY) {
        return READY_AVAILABILITY;
    }

    const selected = AVAILABILITY_BY_REASON[reason];

    if (!selected) {
        throw new TypeError(
            "Unknown BROKER.95 LLM availability reason."
        );
    }

    return selected;
}

export function availabilityFromBrokerLlmStatus(llmStatus) {
    if (
        llmStatus == null ||
        typeof llmStatus !== "object" ||
        Array.isArray(llmStatus)
    ) {
        throw new TypeError(
            "brokerLlmStatus must be a record."
        );
    }

    const availabilityValue =
        createBrokerLlmAvailability(
            llmStatus.reason
        );

    if (llmStatus.status !== availabilityValue.status) {
        throw new TypeError(
            "brokerLlmStatus has an inconsistent status."
        );
    }

    return availabilityValue;
}

export function classifyBrokerLlmFailure(error) {
    const code = error?.code;

    if (code === "BROKER95_LLM_REQUEST_ABORTED") {
        return null;
    }

    if (error?.failureKind != null) {
        return availabilityFromProviderFailure(
            error.failureKind,
            error.httpStatus ??
                diagnosticHttpStatus(error)
        );
    }

    switch (code) {
        case "BROKER95_LLM_UNCONFIGURED":
            return createBrokerLlmAvailability(
                configuredReason(error)
            );

        case "BROKER95_GROQ_NETWORK_FAILED":
        case "BROKER95_GROQ_STREAM_FAILED":
        case "BROKER95_LLM_PROVIDER_NETWORK_FAILED":
        case "BROKER95_LLM_PROVIDER_STREAM_FAILED":
            return createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason.OFFLINE
            );

        case "BROKER95_GROQ_TIMEOUT":
        case "BROKER95_LLM_PROVIDER_TIMEOUT":
            return createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason.TIMEOUT
            );

        case "BROKER95_GROQ_RESPONSE_INVALID":
        case "BROKER95_GROQ_STREAM_INVALID":
        case "BROKER95_LLM_PROVIDER_RESPONSE_INVALID":
        case "BROKER95_LLM_PROVIDER_STREAM_INVALID":
        case "BROKER95_LLM_RESPONSE_INVALID":
            return createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason
                    .INVALID_RESPONSE
            );

        case "BROKER95_GROQ_HTTP_FAILED":
        case "BROKER95_LLM_PROVIDER_HTTP_FAILED":
            return availabilityFromHttpStatus(
                diagnosticHttpStatus(error)
            );

        case "BROKER95_LLM_PROVIDER_AUTHENTICATION_FAILED":
            return createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason
                    .AUTHENTICATION_FAILED
            );

        case "BROKER95_LLM_PROVIDER_QUOTA_EXHAUSTED":
            return createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason
                    .QUOTA_EXHAUSTED
            );

        case "BROKER95_LLM_PROVIDER_MODEL_UNAVAILABLE":
            return createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason
                    .MODEL_UNAVAILABLE
            );

        default:
            return createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason
                    .PROVIDER_ERROR
            );
    }
}

function availabilityFromProviderFailure(
    failureKind,
    status
) {
    switch (failureKind) {
        case BrokerLLMProviderFailureKind.NETWORK:
        case BrokerLLMProviderFailureKind.STREAM_FAILED:
            return createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason.OFFLINE
            );

        case BrokerLLMProviderFailureKind.TIMEOUT:
            return createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason.TIMEOUT
            );

        case BrokerLLMProviderFailureKind.HTTP:
            return availabilityFromHttpStatus(
                status
            );

        case BrokerLLMProviderFailureKind.AUTHENTICATION:
            return createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason
                    .AUTHENTICATION_FAILED
            );

        case BrokerLLMProviderFailureKind.QUOTA:
            return createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason
                    .QUOTA_EXHAUSTED
            );

        case BrokerLLMProviderFailureKind.MODEL_UNAVAILABLE:
            return createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason
                    .MODEL_UNAVAILABLE
            );

        case BrokerLLMProviderFailureKind.INVALID_RESPONSE:
        case BrokerLLMProviderFailureKind.INVALID_STREAM:
            return createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason
                    .INVALID_RESPONSE
            );

        default:
            return createBrokerLlmAvailability(
                BrokerLlmAvailabilityReason
                    .PROVIDER_ERROR
            );
    }
}

export function assertBrokerLlmAvailable(
    llmStatus,
    cause
) {
    const availabilityValue =
        availabilityFromBrokerLlmStatus(llmStatus);

    if (
        availabilityValue.status ===
        BrokerLlmStatus.READY
    ) {
        return availabilityValue;
    }

    throw new BrokerLlmAvailabilityError(
        availabilityValue,
        cause
    );
}

/** Estado dinámico no persistente. Un cambio de configuración lo restablece. */
export class BrokerLlmAvailabilityService {

    constructor(options = {}) {
        this.configuration = requirePort(
            options.configuration,
            "brokerPublicConfiguration",
            ["getSnapshot", "subscribe"]
        );
        this.developerLogger =
            options.developerLogger ?? console;
        this.listeners = new Set();
        this.configurationSignature = null;
        this.current = null;
        this.disposed = false;
        this.configurationSubscription =
            this.configuration.subscribe(snapshot => {
                this.#applyConfiguration(
                    snapshot,
                    true
                );
            });
    }

    getSnapshot() {
        this.#requireActive();
        const source = this.configuration.getSnapshot();

        this.#applyConfiguration(source, false);

        return publicSnapshot(source, this.current);
    }

    getLlmStatus() {
        return this.getSnapshot().llmStatus;
    }

    recordFailure(error) {
        this.#requireActive();
        const source = this.configuration.getSnapshot();

        this.#applyConfiguration(source, false);
        const availabilityValue =
            classifyBrokerLlmFailure(error);

        if (availabilityValue == null) {
            return null;
        }

        if (
            !RETRYABLE_FAILURE_REASONS.has(
                availabilityValue.reason
            )
        ) {
            this.#setCurrent(
                availabilityValue,
                true
            );
        }

        return availabilityValue;
    }

    recordSuccess() {
        this.#requireActive();
        const source = this.configuration.getSnapshot();

        this.configurationSignature =
            configurationSignature(source);
        this.#setCurrent(
            availabilityFromBrokerLlmStatus(
                source.llmStatus
            ),
            true
        );

        return this.current;
    }

    subscribe(listener) {
        this.#requireActive();
        requireFunction(
            listener,
            "brokerLlmAvailabilityListener"
        );
        this.listeners.add(listener);
        let subscribed = true;

        return Object.freeze({
            dispose: () => {
                if (!subscribed) {
                    return;
                }

                subscribed = false;
                this.listeners.delete(listener);
            }
        });
    }

    dispose() {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.listeners.clear();
        this.configurationSubscription?.dispose?.();
    }

    #applyConfiguration(source, notify) {
        const signature = configurationSignature(source);

        if (signature === this.configurationSignature) {
            if (this.current == null) {
                this.current = availabilityFromBrokerLlmStatus(
                    source.llmStatus
                );
            }

            return;
        }

        this.configurationSignature = signature;
        this.#setCurrent(
            availabilityFromBrokerLlmStatus(
                source.llmStatus
            ),
            notify
        );
    }

    #setCurrent(next, notify) {
        const changed = this.current?.reason !==
            next.reason;

        this.current = next;

        if (notify && changed) {
            this.#notify();
        }
    }

    #notify() {
        const snapshot = this.getSnapshot();

        for (const listener of this.listeners) {
            try {
                listener(snapshot);
            } catch (error) {
                try {
                    this.developerLogger.error?.(
                        "BROKER.95 LLM availability listener failed.",
                        error
                    );
                } catch {
                    // Un listener no puede cambiar el estado local.
                }
            }
        }
    }

    #requireActive() {
        if (this.disposed) {
            throw new Error(
                "BROKER.95 LLM availability service is disposed."
            );
        }
    }
}

export function createBrokerPublicLlmAvailabilityView(
    service
) {
    const selected = requirePort(
        service,
        "brokerLlmAvailabilityService",
        ["getSnapshot", "getLlmStatus", "subscribe"]
    );

    return Object.freeze({
        getSnapshot: () => selected.getSnapshot(),
        getLlmStatus: () => selected.getLlmStatus(),
        subscribe: listener => selected.subscribe(listener)
    });
}

function availability(status, reason, message, terminalMessage, code) {
    return Object.freeze({
        status,
        reason,
        message,
        terminalMessage,
        code
    });
}

function configuredReason(error) {
    const reason = error?.diagnostics
        ?.find(item =>
            typeof item?.reason === "string"
        )?.reason;

    return reason === "missing_model" ||
        reason === BrokerLlmAvailabilityReason
            .MODEL_MISSING
        ? BrokerLlmAvailabilityReason
            .MODEL_MISSING
        : BrokerLlmAvailabilityReason
            .API_KEY_MISSING;
}

function diagnosticHttpStatus(error) {
    return error?.diagnostics
        ?.find(item =>
            Number.isInteger(item?.status)
        )?.status ?? 0;
}

function availabilityFromHttpStatus(status) {
    if (status === 401 || status === 403) {
        return createBrokerLlmAvailability(
            BrokerLlmAvailabilityReason
                .AUTHENTICATION_FAILED
        );
    }

    if (status === 404) {
        return createBrokerLlmAvailability(
            BrokerLlmAvailabilityReason
                .MODEL_UNAVAILABLE
        );
    }

    if (status === 408 || status === 504) {
        return createBrokerLlmAvailability(
            BrokerLlmAvailabilityReason.TIMEOUT
        );
    }

    if (status === 429) {
        return createBrokerLlmAvailability(
            BrokerLlmAvailabilityReason
                .QUOTA_EXHAUSTED
        );
    }

    return createBrokerLlmAvailability(
        BrokerLlmAvailabilityReason
            .PROVIDER_ERROR
    );
}

function configurationSignature(snapshot) {
    if (
        snapshot == null ||
        typeof snapshot !== "object" ||
        snapshot.settings == null ||
        typeof snapshot.settings !== "object"
    ) {
        throw new TypeError(
            "brokerPublicConfiguration snapshot is invalid."
        );
    }

    return JSON.stringify([
        snapshot.settings.providerId,
        snapshot.settings.model,
        snapshot.settings.credential?.kind,
        snapshot.settings.credential
            ?.configured,
        snapshot.settings.hasApiKey,
        snapshot.llmStatus?.status,
        snapshot.llmStatus?.reason
    ]);
}

function publicSnapshot(source, availabilityValue) {
    return Object.freeze({
        settings: source.settings,
        llmStatus: Object.freeze({
            status: availabilityValue.status,
            reason: availabilityValue.reason,
            message: availabilityValue.message
        })
    });
}
