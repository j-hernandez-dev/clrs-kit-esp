import {
    BrokerLLMOperation,
    BrokerLLMProtocolError
} from "./BrokerLLMProtocol.js";
import {
    createBrokerLLMRequest
} from "./BrokerLLMRequest.js";
import {
    createBrokerLLMResult,
    createBrokerLLMStreamDelta
} from "./BrokerLLMResult.js";
import {
    BrokerLLMResponseValidator
} from "./BrokerLLMResponseValidator.js";
import {
    normalizeBrokerLLMProviderId
} from "./BrokerLLMProvider.js";

export class BrokerLLMPort {

    constructor(options = {}) {
        this.responseValidator =
            options.responseValidator ??
            new BrokerLLMResponseValidator();
        this.providerId =
            normalizeBrokerLLMProviderId(
                options.providerId ?? "custom"
            );

        if (
            typeof this.responseValidator
                .validate !== "function"
        ) {
            throw BrokerLLMProtocolError
                .invalidPort();
        }
    }

    getProviderId() {
        return this.providerId;
    }

    generateContract(request, execution) {
        return this.#invoke(
            BrokerLLMOperation
                .GENERATE_CONTRACT,
            request,
            execution
        );
    }

    reviewSubmission(request, execution) {
        return this.#invoke(
            BrokerLLMOperation
                .REVIEW_SUBMISSION,
            request,
            execution
        );
    }

    askSubmission(request, execution) {
        return this.#invoke(
            BrokerLLMOperation
                .ASK_SUBMISSION,
            request,
            execution
        );
    }

    evaluateSubmission(request, execution) {
        return this.#invoke(
            BrokerLLMOperation
                .EVALUATE_SUBMISSION,
            request,
            execution
        );
    }

    chat(request, execution) {
        return this.#invoke(
            BrokerLLMOperation.CHAT,
            request,
            execution
        );
    }

    testConnection(request, execution) {
        return this.#invoke(
            BrokerLLMOperation
                .TEST_CONNECTION,
            request,
            execution
        );
    }

    async performRequest(request) {
        throw BrokerLLMProtocolError
            .notImplemented(
                request.operation
            );
    }

    async #invoke(
        operation,
        requestSource,
        executionSource = {}
    ) {
        const request = createBrokerLLMRequest(
            operation,
            requestSource
        );
        const execution =
            createExecutionContext(
                request,
                executionSource
            );

        requireNotAborted(
            execution.signal,
            operation
        );

        const transportResult =
            await this.performRequest(
                request,
                execution
            );

        requireNotAborted(
            execution.signal,
            operation
        );

        return createBrokerLLMResult(
            request,
            transportResult,
            this.responseValidator,
            this.providerId
        );
    }
}

export function isBrokerLLMPort(value) {
    return value != null &&
        [
            "generateContract",
            "reviewSubmission",
            "askSubmission",
            "evaluateSubmission",
            "chat",
            "testConnection"
        ].every(
            method =>
                typeof value[method] ===
                    "function"
        );
}

function createExecutionContext(
    request,
    source
) {
    if (
        source == null ||
        typeof source !== "object" ||
        Array.isArray(source) ||
        Object.keys(source).some(
            key => ![
                "signal",
                "onDelta"
            ].includes(key)
        )
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("execution");
    }

    const signal = source.signal ?? null;

    if (
        signal != null &&
        (
            typeof signal !== "object" ||
            typeof signal.aborted !==
                "boolean" ||
            typeof signal.addEventListener !==
                "function"
        )
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("execution.signal");
    }

    if (
        source.onDelta != null &&
        typeof source.onDelta !== "function"
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest(
                "execution.onDelta"
            );
    }

    let sequence = 0;
    let streamedCharacters = 0;

    return Object.freeze({
        signal,
        streaming: request.stream,
        async emitDelta(text) {
            requireNotAborted(
                signal,
                request.operation
            );

            if (!request.stream) {
                throw BrokerLLMProtocolError
                    .invalidResponse("stream");
            }

            const delta =
                createBrokerLLMStreamDelta({
                    request,
                    sequence,
                    text
                });

            streamedCharacters +=
                delta.text.length;

            if (
                streamedCharacters >
                    1_048_576
            ) {
                throw BrokerLLMProtocolError
                    .invalidResponse("stream");
            }

            sequence += 1;

            if (source.onDelta) {
                await source.onDelta(delta);
            }

            return delta;
        }
    });
}

function requireNotAborted(signal, operation) {
    if (signal?.aborted) {
        throw BrokerLLMProtocolError
            .aborted(operation);
    }
}
