import {
    requireFunction
} from "../../application/ports/ApplicationPorts.js";
import {
    BrokerLLMProtocolError
} from "./BrokerLLMProtocol.js";
import {
    BrokerLLMProviderFailureKind
} from "./BrokerLLMProviderNormalization.js";

const RETRYABLE_CODES = new Set([
    "BROKER95_LLM_PROVIDER_NETWORK_FAILED",
    "BROKER95_LLM_PROVIDER_TIMEOUT",
    "BROKER95_LLM_PROVIDER_RESPONSE_INVALID",
    "BROKER95_LLM_PROVIDER_STREAM_INVALID",
    "BROKER95_LLM_PROVIDER_STREAM_FAILED",
    "BROKER95_LLM_RESPONSE_INVALID",
    "BROKER95_GROQ_NETWORK_FAILED",
    "BROKER95_GROQ_TIMEOUT",
    "BROKER95_GROQ_RESPONSE_INVALID",
    "BROKER95_GROQ_STREAM_INVALID",
    "BROKER95_GROQ_STREAM_FAILED"
]);

const RETRYABLE_FAILURE_KINDS = new Set([
    BrokerLLMProviderFailureKind.NETWORK,
    BrokerLLMProviderFailureKind.TIMEOUT,
    BrokerLLMProviderFailureKind.INVALID_RESPONSE,
    BrokerLLMProviderFailureKind.INVALID_STREAM,
    BrokerLLMProviderFailureKind.STREAM_FAILED
]);

const RETRYABLE_HTTP_STATUSES = new Set([
    408,
    425,
    500,
    502,
    503,
    504
]);

/**
 * Reintento neutral y acotado para fallos transitorios del proveedor.
 * Nunca reintenta cuota, autenticación, modelo inexistente, cancelación ni
 * una operación que ya haya emitido contenido al Webview.
 */
export class BrokerLLMResiliencePolicy {

    constructor(options = {}) {
        this.maxAttempts = requireAttemptCount(
            options.maxAttempts ?? 2
        );
        this.retryDelayMs = requireDelay(
            options.retryDelayMs ?? 250
        );
        this.delay = requireFunction(
            options.delay ?? abortableDelay,
            "brokerLlmRetryDelay"
        );
        this.developerLogger =
            options.developerLogger ?? console;
    }

    async execute(source = {}) {
        const invoke = requireFunction(
            source.invoke,
            "brokerLlmResilientInvocation"
        );
        const operation = requireOperation(
            source.operation
        );
        const providerId = requireProviderId(
            source.providerId
        );
        const signal = source.signal ?? null;
        const streaming = source.streaming === true;

        for (
            let attempt = 1;
            attempt <= this.maxAttempts;
            attempt += 1
        ) {
            requireNotAborted(signal, operation);

            try {
                return await invoke(attempt);
            } catch (error) {
                if (signal?.aborted) {
                    throw BrokerLLMProtocolError
                        .aborted(operation);
                }

                const retry =
                    attempt < this.maxAttempts &&
                    !streaming &&
                    isBrokerLLMRetryableFailure(error);

                if (!retry) {
                    throw error;
                }

                this.#logRetry({
                    providerId,
                    operation,
                    attempt,
                    error
                });
                await this.delay(
                    this.retryDelayMs,
                    signal,
                    operation
                );
            }
        }

        throw BrokerLLMProtocolError
            .invalidPort();
    }

    #logRetry({
        providerId,
        operation,
        attempt,
        error
    }) {
        try {
            this.developerLogger.warn?.(
                "BROKER.95 transient LLM operation will be retried.",
                {
                    providerId,
                    operation,
                    attempt,
                    code: retryableErrorCode(error)
                }
            );
        } catch {
            // Los logs de desarrollo nunca alteran la operación.
        }
    }
}

export function isBrokerLLMRetryableFailure(error) {
    for (const candidate of errorChain(error)) {
        if (
            candidate?.code ===
                "BROKER95_LLM_REQUEST_ABORTED"
        ) {
            return false;
        }

        if (
            RETRYABLE_FAILURE_KINDS.has(
                candidate?.failureKind
            )
        ) {
            return true;
        }

        if (
            candidate?.failureKind ===
                BrokerLLMProviderFailureKind.HTTP
        ) {
            return RETRYABLE_HTTP_STATUSES.has(
                candidate.httpStatus
            );
        }

        if (RETRYABLE_CODES.has(candidate?.code)) {
            return true;
        }

        if (
            candidate?.code ===
                "BROKER95_LLM_PROVIDER_HTTP_FAILED"
        ) {
            return RETRYABLE_HTTP_STATUSES.has(
                candidate.httpStatus ??
                    diagnosticStatus(candidate)
            );
        }
    }

    return false;
}

function errorChain(error) {
    const result = [];
    const visited = new Set();
    let current = error;

    while (
        current != null &&
        typeof current === "object" &&
        !visited.has(current) &&
        result.length < 6
    ) {
        result.push(current);
        visited.add(current);
        current = current.cause;
    }

    return result;
}

function retryableErrorCode(error) {
    return errorChain(error)
        .map(candidate => candidate?.code)
        .find(code =>
            typeof code === "string" &&
            code.length <= 128
        ) ?? "BROKER95_LLM_TRANSIENT_FAILURE";
}

function diagnosticStatus(error) {
    const value = error?.diagnostics?.find(
        diagnostic =>
            Number.isInteger(diagnostic?.status)
    )?.status;

    return value ?? null;
}

function abortableDelay(
    milliseconds,
    signal,
    operation
) {
    requireNotAborted(signal, operation);

    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = callback => {
            if (settled) {
                return;
            }

            settled = true;
            signal?.removeEventListener?.(
                "abort",
                onAbort
            );
            callback();
        };
        const timer = setTimeout(
            () => finish(resolve),
            milliseconds
        );
        const onAbort = () => {
            clearTimeout(timer);
            finish(() => reject(
                BrokerLLMProtocolError
                    .aborted(operation)
            ));
        };

        signal?.addEventListener?.(
            "abort",
            onAbort,
            { once: true }
        );
    });
}

function requireNotAborted(signal, operation) {
    if (signal?.aborted) {
        throw BrokerLLMProtocolError
            .aborted(operation);
    }
}

function requireAttemptCount(value) {
    if (
        !Number.isSafeInteger(value) ||
        value < 1 ||
        value > 3
    ) {
        throw BrokerLLMProtocolError
            .invalidPort();
    }

    return value;
}

function requireDelay(value) {
    if (
        !Number.isSafeInteger(value) ||
        value < 0 ||
        value > 5_000
    ) {
        throw BrokerLLMProtocolError
            .invalidPort();
    }

    return value;
}

function requireOperation(value) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > 64
    ) {
        throw BrokerLLMProtocolError
            .invalidPort();
    }

    return value;
}

function requireProviderId(value) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > 32
    ) {
        throw BrokerLLMProtocolError
            .invalidPort();
    }

    return value;
}
