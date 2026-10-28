import {
    BrokerLLMProtocolError
} from "./BrokerLLMProtocol.js";
import {
    createBrokerLLMProviderDescriptor,
    normalizeBrokerLLMProviderId
} from "./BrokerLLMProvider.js";
import {
    isBrokerLLMPort
} from "./BrokerLLMPort.js";
import {
    BrokerLLMResiliencePolicy
} from "./BrokerLLMResiliencePolicy.js";

const OPERATION_METHODS = Object.freeze([
    "generateContract",
    "reviewSubmission",
    "askSubmission",
    "evaluateSubmission",
    "chat",
    "testConnection"
]);

export class BrokerLLMProviderRegistry {

    constructor(options = {}) {
        this.providers = new Map();
        this.resolveSelectedProviderId =
            options.resolveSelectedProviderId ??
            null;
        this.resiliencePolicy =
            options.resiliencePolicy ??
            new BrokerLLMResiliencePolicy({
                developerLogger:
                    options.developerLogger
            });

        if (
            this.resolveSelectedProviderId != null &&
            typeof this.resolveSelectedProviderId !==
                "function"
        ) {
            throw BrokerLLMProtocolError
                .invalidPort();
        }

        if (
            this.resiliencePolicy == null ||
            typeof this.resiliencePolicy.execute !==
                "function"
        ) {
            throw BrokerLLMProtocolError
                .invalidPort();
        }
    }

    register(descriptorSource, adapter) {
        const descriptor =
            createBrokerLLMProviderDescriptor(
                descriptorSource
            );

        if (
            !isBrokerLLMPort(adapter) ||
            typeof adapter.getProviderId !==
                "function" ||
            adapter.getProviderId() !==
                descriptor.id ||
            this.providers.has(descriptor.id) ||
            this.providers.size >= 16
        ) {
            throw BrokerLLMProtocolError
                .invalidPort();
        }

        this.providers.set(
            descriptor.id,
            Object.freeze({
                descriptor,
                adapter
            })
        );

        return descriptor;
    }

    has(providerId) {
        return this.providers.has(
            normalizeBrokerLLMProviderId(
                providerId
            )
        );
    }

    getDescriptor(providerId) {
        return this.#requireEntry(
            providerId
        ).descriptor;
    }

    listDescriptors() {
        return Object.freeze(
            [...this.providers.values()]
                .map(entry => entry.descriptor)
        );
    }

    generateContract(request, execution) {
        return this.#invoke(
            "generateContract",
            request,
            execution
        );
    }

    reviewSubmission(request, execution) {
        return this.#invoke(
            "reviewSubmission",
            request,
            execution
        );
    }

    askSubmission(request, execution) {
        return this.#invoke(
            "askSubmission",
            request,
            execution
        );
    }

    evaluateSubmission(request, execution) {
        return this.#invoke(
            "evaluateSubmission",
            request,
            execution
        );
    }

    chat(request, execution) {
        return this.#invoke(
            "chat",
            request,
            execution
        );
    }

    testConnection(request, execution) {
        return this.#invoke(
            "testConnection",
            request,
            execution
        );
    }

    #invoke(method, request, execution) {
        if (!OPERATION_METHODS.includes(method)) {
            throw BrokerLLMProtocolError
                .invalidPort();
        }

        const providerId =
            this.#selectedProviderId();
        const adapter = this.#requireEntry(
            providerId
        ).adapter;

        return this.resiliencePolicy.execute({
            providerId,
            operation: method,
            signal: execution?.signal ?? null,
            streaming:
                execution?.onDelta != null,
            invoke: () => adapter[method](
                request,
                execution
            )
        });
    }

    #selectedProviderId() {
        if (
            typeof this.resolveSelectedProviderId !==
            "function"
        ) {
            throw BrokerLLMProtocolError
                .invalidPort();
        }

        return normalizeBrokerLLMProviderId(
            this.resolveSelectedProviderId()
        );
    }

    #requireEntry(providerId) {
        const selected =
            normalizeBrokerLLMProviderId(
                providerId
            );
        const entry = this.providers.get(
            selected
        );

        if (!entry) {
            throw BrokerLLMProtocolError
                .invalidRequest("providerId");
        }

        return entry;
    }
}
