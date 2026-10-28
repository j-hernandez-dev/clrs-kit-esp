import {
    requireFunction,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    BrokerLLMCredentialKind,
    BrokerLLMFinishReason,
    BrokerLLMOperation,
    BrokerLLMResponseFormat,
    BrokerLLMPort,
    BrokerLLMProviderFailureKind,
    BrokerLLMProviderId,
    BrokerLLMProtocolError,
    createBrokerLLMTransportResult,
    normalizeBrokerLLMFinishReason,
    normalizeBrokerLLMModel,
    normalizeBrokerLLMResponseId,
    normalizeBrokerLLMUsage,
    normalizeBrokerLocalLlmBaseUrl,
    parseBrokerLLMProviderJson
} from "../../src/broker95/llm/index.js";
import {
    brokerLLMCompletionTokenBudget,
    createBrokerLLMOperationMessage,
    createBrokerLLMStructuredResponseDefinition,
    createBrokerLLMSystemInstruction
} from "../../src/broker95/llm/BrokerLLMPrompt.js";
import {
    BrokerLlmAvailabilityError
} from "../../src/broker95/llm/BrokerLlmAvailability.js";
import {
    BrokerNdjsonReaderError,
    brokerNdjsonReader
} from "./BrokerNdjsonReader.js";

export const OLLAMA_LOCAL_API_BASE_URL =
    "http://127.0.0.1:11434/api";
export const DEFAULT_OLLAMA_TIMEOUT_MS = 120_000;

export class OllamaBroker95LLMAdapterError extends Error {

    constructor(code, technicalMessage, publicMessage, diagnostics = [], cause) {
        super(technicalMessage, { cause });
        this.name = "OllamaBroker95LLMAdapterError";
        this.code = code;
        this.publicMessage = publicMessage;
        this.providerId = BrokerLLMProviderId.OLLAMA;
        this.failureKind = ollamaFailureKind(code);
        this.httpStatus = diagnostics.find(
            item => Number.isInteger(item?.status)
        )?.status ?? null;
        this.diagnostics = Object.freeze(
            diagnostics.map(item => Object.freeze({ ...item }))
        );
    }
}

/**
 * Adaptador para el servidor local de Ollama. El endpoint se limita a loopback
 * para que seleccionar el proveedor jamás convierta a la extensión en un
 * cliente de un servidor remoto o en una vía de salida de red oculta.
 */
export class OllamaBroker95LLMAdapter extends BrokerLLMPort {

    constructor(options = {}) {
        super({
            providerId: BrokerLLMProviderId.OLLAMA,
            responseValidator: options.responseValidator
        });

        this.configurationService = requirePort(
            options.configurationService,
            "brokerConfigurationService",
            ["resolvePrivateLlmSettings"]
        );
        this.availability = options.availability == null
            ? null
            : requirePort(
                options.availability,
                "brokerLlmAvailabilityService",
                ["recordFailure", "recordSuccess"]
            );
        this.fetch = requireFunction(
            options.fetch ?? globalThis.fetch,
            "ollamaFetch"
        );
        this.ndjsonReader = requireNdjsonReader(
            options.ndjsonReader ?? brokerNdjsonReader
        );
        this.apiBaseUrl = requireLocalApiUrl(
            options.apiBaseUrl ?? OLLAMA_LOCAL_API_BASE_URL
        );
        this.timeoutMs = requireTimeout(
            options.timeoutMs ?? DEFAULT_OLLAMA_TIMEOUT_MS
        );
        this.developerLogger = options.developerLogger ?? console;
    }

    async performRequest(request, execution) {
        try {
            const settings = await this.configurationService
                .resolvePrivateLlmSettings(this.getProviderId());
            requireOllamaSettings(settings, this.getProviderId());

            const result = request.operation === BrokerLLMOperation.TEST_CONNECTION
                ? await this.#testConnection(settings, execution.signal)
                : await this.#createChat(request, settings, execution);

            this.availability?.recordSuccess();
            return result;
        } catch (error) {
            const availability = this.availability?.recordFailure(error);

            if (availability) {
                throw new BrokerLlmAvailabilityError(availability, error);
            }

            throw error;
        }
    }

    async #testConnection(settings, signal) {
        const apiBaseUrl = requireLocalApiUrl(
            settings.baseUrl ??
                this.apiBaseUrl
        );
        const connection = await this.#fetch(
            `${apiBaseUrl}/tags`,
            { method: "GET" },
            signal,
            BrokerLLMOperation.TEST_CONNECTION
        );

        try {
            const payload = await readOllamaJson(
                connection.response,
                BrokerLLMOperation.TEST_CONNECTION
            );

            if (!containsModel(payload, settings.model)) {
                throw adapterError(
                    "BROKER95_OLLAMA_MODEL_UNAVAILABLE",
                    "The configured Ollama model is not installed locally.",
                    "El modelo configurado no está disponible en Ollama local.",
                    BrokerLLMOperation.TEST_CONNECTION
                );
            }

            return createBrokerLLMTransportResult({
                output: JSON.stringify({
                    connected: true,
                    message: "Modelo local disponible."
                }),
                model: settings.model,
                fallbackModel: settings.model,
                finishReason: "stop",
                usage: null,
                responseIds: []
            });
        } catch (error) {
            throw this.#translateReadError(
                error,
                BrokerLLMOperation.TEST_CONNECTION,
                connection
            );
        } finally {
            connection.dispose();
        }
    }

    async #createChat(request, settings, execution) {
        const apiBaseUrl = requireLocalApiUrl(
            settings.baseUrl ??
                this.apiBaseUrl
        );
        const connection = await this.#fetch(
            `${apiBaseUrl}/chat`,
            {
                method: "POST",
                headers: createHeaders(),
                body: JSON.stringify(createOllamaChatPayload(
                    request,
                    settings.model
                ))
            },
            execution.signal,
            request.operation
        );

        try {
            return request.stream
                ? await this.#readStreamingChat(
                    connection.response,
                    settings.model,
                    request,
                    execution,
                    connection
                )
                : await this.#readChat(
                    connection.response,
                    settings.model,
                    request.operation
                );
        } catch (error) {
            throw this.#translateReadError(error, request.operation, connection);
        } finally {
            connection.dispose();
        }
    }

    async #readChat(response, fallbackModel, operation) {
        const payload = await readOllamaJson(response, operation);
        rejectOllamaErrorPayload(payload, operation);
        const content = extractOllamaText(payload);

        if (content.length === 0 || payload?.done !== true) {
            throw adapterError(
                "BROKER95_OLLAMA_RESPONSE_INVALID",
                "Ollama returned an incomplete chat response.",
                "CIPHER devolvió una respuesta local incompleta.",
                operation
            );
        }

        return createBrokerLLMTransportResult({
            output: content,
            model: payload?.model,
            fallbackModel,
            finishReason: payload?.done_reason,
            usage: payload,
            responseIds: [responseIdentifier(response, payload)]
        });
    }

    async #readStreamingChat(response, fallbackModel, request, execution, connection) {
        let content = "";
        let model = fallbackModel;
        let finishReason = BrokerLLMFinishReason.UNKNOWN;
        let usage = null;
        let responseId = responseIdentifier(response, null);
        let completed = false;

        try {
            for await (const line of this.ndjsonReader.read(response.body, {
                signal: connection.signal
            })) {
                const payload = parseOllamaStreamingPayload(
                    line,
                    request.operation
                );
                rejectOllamaErrorPayload(payload, request.operation);
                model = normalizeBrokerLLMModel(payload?.model, model);
                responseId ??= responseIdentifier(response, payload);

                const delta = extractOllamaText(payload);

                if (delta.length > 0) {
                    content += delta;
                    await execution.emitDelta(delta);
                }

                if (payload?.done === true) {
                    completed = true;
                    finishReason = normalizeBrokerLLMFinishReason(
                        payload.done_reason
                    );
                    usage = normalizeBrokerLLMUsage(payload) ?? usage;
                }
            }
        } catch (error) {
            throw this.#translateStreamingError(error, request.operation, connection);
        }

        if (!completed || content.length === 0) {
            throw adapterError(
                "BROKER95_OLLAMA_STREAM_INVALID",
                "Ollama streaming response ended before completion.",
                "La transmisión local de CIPHER terminó de forma incompleta.",
                request.operation
            );
        }

        return createBrokerLLMTransportResult({
            output: content,
            model,
            fallbackModel,
            finishReason,
            usage,
            responseIds: [responseId]
        });
    }

    async #fetch(url, init, parentSignal, operation) {
        const scope = createAbortScope(parentSignal, this.timeoutMs);
        let succeeded = false;

        try {
            const response = await this.fetch(url, {
                ...init,
                redirect: "error",
                signal: scope.signal
            });

            if (!response?.ok) {
                const status = Number.isInteger(response?.status)
                    ? response.status
                    : 0;
                const error = httpError(status, operation);
                this.#log(error, operation, status);
                throw error;
            }

            succeeded = true;
            return Object.freeze({
                response,
                signal: scope.signal,
                timedOut: scope.timedOut,
                dispose: scope.dispose
            });
        } catch (error) {
            if (
                error instanceof OllamaBroker95LLMAdapterError ||
                error instanceof BrokerLLMProtocolError
            ) {
                throw error;
            }

            if (parentSignal?.aborted) {
                throw BrokerLLMProtocolError.aborted(operation);
            }

            const translated = scope.timedOut()
                ? adapterError(
                    "BROKER95_OLLAMA_TIMEOUT",
                    "Ollama local request timed out.",
                    "CIPHER local tardó demasiado en responder.",
                    operation
                )
                : adapterError(
                    "BROKER95_OLLAMA_NETWORK_FAILED",
                    "Ollama local server could not be reached.",
                    "No fue posible conectar con Ollama local.",
                    operation
                );
            this.#log(translated, operation);
            throw translated;
        } finally {
            if (!succeeded) {
                scope.dispose();
            }
        }
    }

    #translateStreamingError(error, operation, connection) {
        if (
            error instanceof OllamaBroker95LLMAdapterError ||
            error instanceof BrokerLLMProtocolError
        ) {
            return error;
        }

        if (connection.signal?.aborted) {
            return connection.timedOut()
                ? adapterError(
                    "BROKER95_OLLAMA_TIMEOUT",
                    "Ollama local stream timed out.",
                    "CIPHER local tardó demasiado en responder.",
                    operation
                )
                : BrokerLLMProtocolError.aborted(operation);
        }

        return error instanceof BrokerNdjsonReaderError
            ? adapterError(
                "BROKER95_OLLAMA_STREAM_INVALID",
                "Ollama NDJSON stream could not be decoded.",
                "La transmisión local de CIPHER no pudo procesarse.",
                operation,
                [],
                error
            )
            : adapterError(
                "BROKER95_OLLAMA_STREAM_FAILED",
                "Ollama local stream failed.",
                "La transmisión local de CIPHER falló.",
                operation,
                [],
                error
            );
    }

    #translateReadError(error, operation, connection) {
        if (connection.signal?.aborted) {
            return connection.timedOut()
                ? adapterError(
                    "BROKER95_OLLAMA_TIMEOUT",
                    "Ollama local response timed out.",
                    "CIPHER local tardó demasiado en responder.",
                    operation
                )
                : BrokerLLMProtocolError.aborted(operation);
        }

        if (
            error instanceof OllamaBroker95LLMAdapterError ||
            error instanceof BrokerLLMProtocolError
        ) {
            return error;
        }

        return adapterError(
            "BROKER95_OLLAMA_RESPONSE_INVALID",
            "Ollama local response could not be read.",
            "CIPHER devolvió una respuesta local que no pudo procesarse.",
            operation,
            [],
            error
        );
    }

    #log(error, operation, status = null) {
        try {
            this.developerLogger.error?.(
                "BROKER.95 Ollama local adapter request failed.",
                { code: error.code, operation, status }
            );
        } catch {
            // La telemetría interna no modifica el resultado del usuario.
        }
    }
}

export function createOllamaChatPayload(request, model) {
    const structured = createBrokerLLMStructuredResponseDefinition(request);

    return Object.freeze({
        model: normalizeOllamaModel(model),
        messages: Object.freeze([
            Object.freeze({
                role: "system",
                content: createBrokerLLMSystemInstruction(request)
            }),
            ...request.conversation.map(message => Object.freeze({
                role: message.role,
                content: message.content
            })),
            Object.freeze({
                role: "user",
                content: createBrokerLLMOperationMessage(request)
            })
        ]),
        ...(request.responseFormat ===
            BrokerLLMResponseFormat.TEXT
            ? {}
            : {
                format:
                    structured?.schema ?? "json"
            }),
        options: Object.freeze({
            temperature: 0.2,
            num_predict: brokerLLMCompletionTokenBudget(request.operation)
        }),
        stream: request.stream
    });
}

function requireOllamaSettings(settings, providerId) {
    if (
        settings?.providerId !== providerId ||
        settings.credential?.providerId !== providerId ||
        settings.credential?.kind !== BrokerLLMCredentialKind.NONE ||
        Object.hasOwn(settings.credential, "value")
    ) {
        throw BrokerLLMProtocolError.invalidRequest("credential");
    }
}

function createHeaders() {
    return Object.freeze({ "Content-Type": "application/json" });
}

async function readOllamaJson(response, operation) {
    let source;

    try {
        source = await response.text();
    } catch (cause) {
        throw adapterError(
            "BROKER95_OLLAMA_RESPONSE_INVALID",
            "Ollama local response text could not be read.",
            "CIPHER devolvió una respuesta local que no pudo procesarse.",
            operation,
            [],
            cause
        );
    }

    try {
        return parseBrokerLLMProviderJson(source, {
            providerId: BrokerLLMProviderId.OLLAMA,
            operation,
            streaming: false
        });
    } catch (cause) {
        throw adapterError(
            "BROKER95_OLLAMA_RESPONSE_INVALID",
            "Ollama local response was not valid JSON.",
            "CIPHER devolvió una respuesta local que no pudo procesarse.",
            operation,
            [],
            cause
        );
    }
}

function parseOllamaStreamingPayload(source, operation) {
    try {
        return parseBrokerLLMProviderJson(source, {
            providerId: BrokerLLMProviderId.OLLAMA,
            operation,
            streaming: true
        });
    } catch (cause) {
        throw adapterError(
            "BROKER95_OLLAMA_STREAM_INVALID",
            "Ollama sent invalid NDJSON.",
            "La transmisión local de CIPHER no pudo procesarse.",
            operation,
            [],
            cause
        );
    }
}

function containsModel(payload, model) {
    const selected = normalizeOllamaModel(model);

    return Array.isArray(payload?.models) && payload.models.some(item =>
        item?.name === selected || item?.model === selected
    );
}

function rejectOllamaErrorPayload(payload, operation) {
    if (typeof payload?.error !== "string" || payload.error.length === 0) {
        return;
    }

    throw adapterError(
        "BROKER95_OLLAMA_PROVIDER_FAILED",
        "Ollama returned an error payload.",
        "Ollama local no pudo procesar la solicitud de CIPHER.",
        operation
    );
}

function extractOllamaText(payload) {
    return typeof payload?.message?.content === "string"
        ? payload.message.content
        : "";
}

function responseIdentifier(response, payload) {
    return normalizeBrokerLLMResponseId(
        payload?.created_at,
        payload?.digest,
        response?.headers?.get?.("x-request-id")
    );
}

function createAbortScope(parentSignal, timeoutMs) {
    const controller = new AbortController();
    let didTimeout = false;
    const abortFromParent = () => controller.abort();

    if (parentSignal) {
        parentSignal.addEventListener("abort", abortFromParent, { once: true });
    }

    const timeout = setTimeout(() => {
        didTimeout = true;
        controller.abort();
    }, timeoutMs);

    return Object.freeze({
        signal: controller.signal,
        timedOut: () => didTimeout,
        dispose() {
            clearTimeout(timeout);
            parentSignal?.removeEventListener?.("abort", abortFromParent);
        }
    });
}

function requireNdjsonReader(value) {
    if (value == null || typeof value.read !== "function") {
        throw BrokerLLMProtocolError.invalidPort();
    }

    return value;
}

function requireLocalApiUrl(value) {
    try {
        return normalizeBrokerLocalLlmBaseUrl(
            value
        );
    } catch {
        throw BrokerLLMProtocolError.invalidRequest("apiBaseUrl");
    }
}

function normalizeOllamaModel(value) {
    if (typeof value !== "string") {
        throw BrokerLLMProtocolError.invalidRequest("model");
    }

    const selected = value.trim();

    if (
        selected.length === 0 ||
        selected.length > 256 ||
        /[\u0000-\u001F\u007F]/u.test(selected)
    ) {
        throw BrokerLLMProtocolError.invalidRequest("model");
    }

    return selected;
}

function requireTimeout(value) {
    if (!Number.isSafeInteger(value) || value < 1_000 || value > 600_000) {
        throw BrokerLLMProtocolError.invalidRequest("timeoutMs");
    }

    return value;
}

function httpError(status, operation) {
    if (status === 404) {
        return adapterError(
            "BROKER95_OLLAMA_MODEL_UNAVAILABLE",
            "The configured Ollama model is unavailable.",
            "El modelo configurado no está disponible en Ollama local.",
            operation,
            [{ status }]
        );
    }

    return adapterError(
        "BROKER95_OLLAMA_HTTP_FAILED",
        `Ollama local request failed with HTTP ${status}.`,
        "Ollama local no pudo completar la solicitud de CIPHER.",
        operation,
        [{ status }]
    );
}

function adapterError(code, technicalMessage, publicMessage, operation, diagnostics = [], cause) {
    return new OllamaBroker95LLMAdapterError(
        code,
        technicalMessage,
        publicMessage,
        [{ operation }, ...diagnostics],
        cause
    );
}

function ollamaFailureKind(code) {
    switch (code) {
        case "BROKER95_OLLAMA_NETWORK_FAILED":
            return BrokerLLMProviderFailureKind.NETWORK;
        case "BROKER95_OLLAMA_TIMEOUT":
            return BrokerLLMProviderFailureKind.TIMEOUT;
        case "BROKER95_OLLAMA_MODEL_UNAVAILABLE":
            return BrokerLLMProviderFailureKind.MODEL_UNAVAILABLE;
        case "BROKER95_OLLAMA_RESPONSE_INVALID":
            return BrokerLLMProviderFailureKind.INVALID_RESPONSE;
        case "BROKER95_OLLAMA_STREAM_INVALID":
            return BrokerLLMProviderFailureKind.INVALID_STREAM;
        case "BROKER95_OLLAMA_STREAM_FAILED":
            return BrokerLLMProviderFailureKind.STREAM_FAILED;
        case "BROKER95_OLLAMA_HTTP_FAILED":
            return BrokerLLMProviderFailureKind.HTTP;
        default:
            return BrokerLLMProviderFailureKind.PROVIDER;
    }
}
