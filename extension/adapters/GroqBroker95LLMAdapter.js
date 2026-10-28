import {
    requireFunction,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    BrokerLLMFinishReason,
    BrokerLLMCredentialKind,
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
    parseBrokerLLMProviderJson
} from "../../src/broker95/llm/index.js";
import {
    BrokerLlmAvailabilityError
} from "../../src/broker95/llm/BrokerLlmAvailability.js";
import {
    brokerLLMCompletionTokenBudget,
    createBrokerLLMOperationMessage,
    createBrokerLLMStructuredResponseDefinition,
    createBrokerLLMSystemInstruction
} from "../../src/broker95/llm/BrokerLLMPrompt.js";
import {
    BrokerSSEReader,
    BrokerSSEReaderError,
    brokerSSEReader
} from "./BrokerSSEReader.js";

export const GROQ_CHAT_COMPLETIONS_URL =
    "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_GROQ_TIMEOUT_MS = 30_000;
export const GROQ_STRICT_STRUCTURED_OUTPUT_MODELS =
    Object.freeze([
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b"
    ]);

const STRICT_STRUCTURED_OUTPUT_MODELS = new Set(
    GROQ_STRICT_STRUCTURED_OUTPUT_MODELS
);

export class GroqBroker95LLMAdapterError extends Error {

    constructor(
        code,
        technicalMessage,
        publicMessage,
        diagnostics = [],
        cause
    ) {
        super(technicalMessage, { cause });
        this.name =
            "GroqBroker95LLMAdapterError";
        this.code = code;
        this.publicMessage = publicMessage;
        this.providerId =
            BrokerLLMProviderId.GROQ;
        this.failureKind =
            groqFailureKind(code);
        this.httpStatus = diagnostics.find(
            item =>
                Number.isInteger(item?.status)
        )?.status ?? null;
        this.diagnostics = Object.freeze(
            diagnostics.map(item =>
                Object.freeze({ ...item })
            )
        );
    }
}

/**
 * Adaptador de infraestructura. Las credenciales se obtienen únicamente de
 * BrokerConfigurationService dentro del Extension Host.
 */
export class GroqBroker95LLMAdapter
    extends BrokerLLMPort {

    constructor(options = {}) {
        super({
            providerId:
                BrokerLLMProviderId.GROQ,
            responseValidator:
                options.responseValidator
        });

        this.configurationService = requirePort(
            options.configurationService,
            "brokerConfigurationService",
            ["resolvePrivateLlmSettings"]
        );
        this.availability =
            options.availability == null
                ? null
                : requirePort(
                    options.availability,
                    "brokerLlmAvailabilityService",
                    ["recordFailure", "recordSuccess"]
                );
        this.fetch = requireFunction(
            options.fetch ?? globalThis.fetch,
            "groqFetch"
        );
        this.sseReader = requireSSEReader(
            options.sseReader ?? brokerSSEReader
        );
        this.chatCompletionsUrl = requireUrl(
            options.chatCompletionsUrl ??
                GROQ_CHAT_COMPLETIONS_URL,
            "chatCompletionsUrl"
        );
        this.timeoutMs = requireTimeout(
            options.timeoutMs ??
                DEFAULT_GROQ_TIMEOUT_MS
        );
        this.developerLogger =
            options.developerLogger ?? console;
    }

    async performRequest(request, execution) {
        try {
            const settings = await this
                .configurationService
                .resolvePrivateLlmSettings(
                    this.getProviderId()
                );

            if (
                settings.providerId !==
                    this.getProviderId() ||
                settings.credential?.providerId !==
                    this.getProviderId() ||
                settings.credential?.kind !==
                    BrokerLLMCredentialKind.API_KEY ||
                typeof settings.credential?.value !==
                    "string"
            ) {
                throw BrokerLLMProtocolError
                    .invalidRequest("credential");
            }

            const result = request.operation ===
                BrokerLLMOperation.TEST_CONNECTION
                ? await this.#testConnection(
                    settings,
                    execution.signal
                )
                : await this.#createCompletion(
                    request,
                    settings,
                    execution
                );

            this.availability?.recordSuccess();

            return result;
        } catch (error) {
            const availability = this.availability
                ?.recordFailure(error);

            if (availability) {
                throw new BrokerLlmAvailabilityError(
                    availability,
                    error
                );
            }

            throw error;
        }
    }

    async #testConnection(settings, signal) {
        // La inferencia mínima comprueba en una sola operación la credencial,
        // el acceso de la cuenta y el ID exacto (incluidos los namespaces).
        const connection = await this.#fetch(
            this.chatCompletionsUrl,
            {
                method: "POST",
                headers: createHeaders(
                    settings.credential.value,
                    true
                ),
                body: JSON.stringify(
                    createGroqConnectionProbePayload(
                        settings.model
                    )
                )
            },
            signal,
            BrokerLLMOperation.TEST_CONNECTION
        );

        try {
            const payload = await readJsonResponse(
                connection.response,
                BrokerLLMOperation.TEST_CONNECTION
            );
            requireGroqConnectionCompletion(payload);

            return createBrokerLLMTransportResult({
                output: JSON.stringify({
                    connected: true,
                    message: "Modelo disponible."
                }),
                model: payload?.model,
                fallbackModel: settings.model,
                finishReason:
                    payload?.choices?.[0]
                        ?.finish_reason,
                usage: payload?.usage,
                responseIds: [
                    payload?.id,
                    responseIdentifier(
                        connection.response
                    )
                ]
            });
        } catch (error) {
            const translated = this.#translateReadError(
                error,
                BrokerLLMOperation.TEST_CONNECTION,
                connection
            );

            if (
                translated instanceof
                GroqBroker95LLMAdapterError
            ) {
                this.#log(
                    translated,
                    BrokerLLMOperation
                        .TEST_CONNECTION
                );
            }

            throw translated;
        } finally {
            connection.dispose();
        }
    }

    async #createCompletion(
        request,
        settings,
        execution
    ) {
        const connection = await this.#fetch(
            this.chatCompletionsUrl,
            {
                method: "POST",
                headers: createHeaders(
                    settings.credential.value,
                    true
                ),
                body: JSON.stringify(
                    createGroqCompletionPayload(
                        request,
                        settings.model
                    )
                )
            },
            execution.signal,
            request.operation
        );

        try {
            return request.stream
                ? await this.#readStreamingCompletion(
                    connection.response,
                    settings.model,
                    request,
                    execution,
                    connection
                )
                : await this.#readCompletion(
                    connection.response,
                    settings.model,
                    request.operation
                );
        } catch (error) {
            const translated = this.#translateReadError(
                error,
                request.operation,
                connection
            );

            if (
                translated instanceof
                GroqBroker95LLMAdapterError
            ) {
                this.#log(
                    translated,
                    request.operation
                );
            }

            throw translated;
        } finally {
            connection.dispose();
        }
    }

    async #readCompletion(
        response,
        fallbackModel,
        operation
    ) {
        const payload = await readJsonResponse(
            response,
            operation
        );
        const choice = payload?.choices?.[0];
        const content = choice?.message?.content;

        if (
            typeof content !== "string" ||
            content.length === 0
        ) {
            throw adapterError(
                "BROKER95_GROQ_RESPONSE_INVALID",
                "Groq returned a completion without message content.",
                "CIPHER devolvió una respuesta incompleta.",
                operation
            );
        }

        return createBrokerLLMTransportResult({
            output: content,
            model: payload?.model,
            fallbackModel,
            finishReason:
                choice.finish_reason,
            usage: payload?.usage,
            responseIds: [
                payload?.id,
                responseIdentifier(response)
            ]
        });
    }

    async #readStreamingCompletion(
        response,
        fallbackModel,
        request,
        execution,
        connection
    ) {
        let content = "";
        let model = fallbackModel;
        let finishReason =
            BrokerLLMFinishReason.UNKNOWN;
        let usage = null;
        let responseId = responseIdentifier(
            response,
            null
        );
        let completed = false;

        try {
            for await (
                const event of this.sseReader.read(
                    response.body,
                    { signal: connection.signal }
                )
            ) {
                if (event.data === "[DONE]") {
                    completed = true;
                    break;
                }

                const payload = parseStreamingPayload(
                    event.data,
                    request.operation
                );
                const choice = payload.choices?.[0];

                model = normalizeBrokerLLMModel(
                    payload.model,
                    model
                );
                responseId ??= responseIdentifier(
                    response,
                    payload
                );
                usage ??=
                    normalizeBrokerLLMUsage(
                        payload.usage
                    );

                if (choice?.finish_reason != null) {
                    finishReason =
                        normalizeBrokerLLMFinishReason(
                            choice.finish_reason
                        );
                }

                const delta = choice?.delta?.content;

                if (typeof delta === "string") {
                    content += delta;
                    await execution.emitDelta(delta);
                }
            }
        } catch (error) {
            throw this.#translateStreamingError(
                error,
                request.operation,
                connection
            );
        }

        if (!completed || content.length === 0) {
            throw adapterError(
                "BROKER95_GROQ_STREAM_INVALID",
                "Groq streaming completion ended before a complete response.",
                "La transmisión de CIPHER terminó de forma incompleta.",
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

    async #fetch(
        url,
        init,
        parentSignal,
        operation
    ) {
        const scope = createAbortScope(
            parentSignal,
            this.timeoutMs
        );
        let succeeded = false;

        try {
            const response = await this.fetch(url, {
                ...init,
                signal: scope.signal
            });

            if (!response?.ok) {
                const status = Number.isInteger(
                    response?.status
                )
                    ? response.status
                    : 0;
                const error = groqHttpError(
                    status,
                    operation
                );

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
                error instanceof
                    GroqBroker95LLMAdapterError ||
                error instanceof BrokerLLMProtocolError
            ) {
                throw error;
            }

            if (parentSignal?.aborted) {
                throw BrokerLLMProtocolError
                    .aborted(operation);
            }

            const translated = scope.timedOut()
                ? adapterError(
                    "BROKER95_GROQ_TIMEOUT",
                    "Groq request timed out.",
                    "CIPHER tardó demasiado en responder.",
                    operation
                )
                : adapterError(
                    "BROKER95_GROQ_NETWORK_FAILED",
                    "Groq network request failed.",
                    "No fue posible conectar con CIPHER.",
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

    #translateStreamingError(
        error,
        operation,
        connection
    ) {
        if (
            error instanceof
                GroqBroker95LLMAdapterError ||
            error instanceof BrokerLLMProtocolError
        ) {
            return error;
        }

        if (connection.signal?.aborted) {
            if (connection.timedOut()) {
                return adapterError(
                    "BROKER95_GROQ_TIMEOUT",
                    "Groq streaming request timed out.",
                    "CIPHER tardó demasiado en responder.",
                    operation
                );
            }

            return BrokerLLMProtocolError
                .aborted(operation);
        }

        const translated = error instanceof
            BrokerSSEReaderError
            ? adapterError(
                "BROKER95_GROQ_STREAM_INVALID",
                "Groq SSE stream could not be decoded.",
                "La transmisión de CIPHER no pudo procesarse.",
                operation
            )
            : adapterError(
                "BROKER95_GROQ_STREAM_FAILED",
                "Groq streaming completion failed.",
                "La transmisión de CIPHER falló.",
                operation
            );

        this.#log(translated, operation);
        return translated;
    }

    #translateReadError(
        error,
        operation,
        connection
    ) {
        if (connection.signal?.aborted) {
            return connection.timedOut()
                ? adapterError(
                    "BROKER95_GROQ_TIMEOUT",
                    "Groq request timed out while reading a response.",
                    "CIPHER tardó demasiado en responder.",
                    operation
                )
                : BrokerLLMProtocolError
                    .aborted(operation);
        }

        if (
            error instanceof
                GroqBroker95LLMAdapterError ||
            error instanceof BrokerLLMProtocolError
        ) {
            return error;
        }

        return adapterError(
            "BROKER95_GROQ_RESPONSE_INVALID",
            "Groq response could not be read.",
            "CIPHER devolvió una respuesta que no pudo procesarse.",
            operation,
            [],
            error
        );
    }

    #log(error, operation, status = null) {
        try {
            this.developerLogger.error?.(
                "BROKER.95 Groq adapter request failed.",
                {
                    code: error.code,
                    operation,
                    status
                }
            );
        } catch {
            // El registro interno no puede modificar el resultado.
        }
    }
}

export function createGroqCompletionPayload(request, model) {
    const responseFormat = createResponseFormat(
        request,
        model
    );

    return Object.freeze({
        model,
        messages: Object.freeze([
            Object.freeze({
                role: "system",
                content: createBrokerLLMSystemInstruction(
                    request
                )
            }),
            ...request.conversation.map(message =>
                Object.freeze({
                    role: message.role,
                    content: message.content
                })
            ),
            Object.freeze({
                role: "user",
                content: createBrokerLLMOperationMessage(
                    request
                )
            })
        ]),
        ...(responseFormat == null
            ? {}
            : { response_format: responseFormat }),
        max_completion_tokens:
            brokerLLMCompletionTokenBudget(
                request.operation
            ),
        temperature: 0.2,
        stream: request.stream
    });
}

export function createGroqConnectionProbePayload(model) {
    if (
        typeof model !== "string" ||
        model.trim().length === 0 ||
        model.length > 256 ||
        /[\u0000-\u001F\u007F]/u.test(model)
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("model");
    }

    const selected = model.trim();

    return Object.freeze({
        model: selected,
        messages: Object.freeze([
            Object.freeze({
                role: "user",
                content:
                    "Responde únicamente con OK."
            })
        ]),
        max_completion_tokens: 64,
        ...(selected.startsWith("qwen/qwen3")
            ? { reasoning_effort: "none" }
            : {}),
        stream: false
    });
}

function createResponseFormat(request, model) {
    if (
        request.responseFormat ===
            BrokerLLMResponseFormat.TEXT
    ) {
        return null;
    }

    const structured =
        createBrokerLLMStructuredResponseDefinition(
            request
        );

    if (
        structured != null &&
        STRICT_STRUCTURED_OUTPUT_MODELS.has(model)
    ) {
        return Object.freeze({
            type: "json_schema",
            json_schema: Object.freeze({
                name: structured.name,
                strict: true,
                schema: structured.schema
            })
        });
    }

    return Object.freeze({
        type: "json_object"
    });
}

function createHeaders(apiKey, json = false) {
    return Object.freeze({
        Authorization: `Bearer ${apiKey}`,
        ...(json
            ? { "Content-Type": "application/json" }
            : {})
    });
}

function requireGroqConnectionCompletion(payload) {
    const operation = BrokerLLMOperation.TEST_CONNECTION;
    const choice = payload?.choices?.[0];
    const message = choice?.message;

    if (
        payload?.error != null ||
        !Array.isArray(payload?.choices) ||
        payload.choices.length === 0 ||
        payload.choices.length > 8 ||
        message == null ||
        typeof message !== "object"
    ) {
        throw adapterError(
            "BROKER95_GROQ_RESPONSE_INVALID",
            "Groq returned an invalid connection probe response.",
            "CIPHER devolvió una respuesta que no pudo procesarse.",
            operation
        );
    }

    const hasContent =
        typeof message.content === "string" &&
        message.content.trim().length > 0;
    const completedReasoning =
        choice?.finish_reason === "length" &&
        message?.role === "assistant" &&
        Number.isSafeInteger(
            payload?.usage?.completion_tokens
        ) &&
        payload.usage.completion_tokens > 0;

    if (!hasContent && !completedReasoning) {
        throw adapterError(
            "BROKER95_GROQ_RESPONSE_INVALID",
            "Groq returned a connection probe without completion content.",
            "CIPHER devolvió una respuesta que no pudo procesarse.",
            operation
        );
    }
}

function groqHttpError(status, operation) {
    if ([401, 403].includes(status)) {
        return adapterError(
            "BROKER95_GROQ_AUTHENTICATION_FAILED",
            `Groq rejected the credential with HTTP ${status}.`,
            "El proveedor rechazó la credencial de CIPHER.",
            operation,
            [{ status }]
        );
    }

    if (status === 429) {
        return adapterError(
            "BROKER95_GROQ_QUOTA_EXHAUSTED",
            "Groq rejected the request because a usage limit was reached.",
            "El proveedor alcanzó un límite de uso para CIPHER.",
            operation,
            [{ status }]
        );
    }

    if (status === 404) {
        return adapterError(
            "BROKER95_GROQ_MODEL_UNAVAILABLE",
            "Groq could not find or grant access to the configured model.",
            "El modelo configurado no está disponible para CIPHER.",
            operation,
            [{ status }]
        );
    }

    return adapterError(
        "BROKER95_GROQ_HTTP_FAILED",
        `Groq request failed with HTTP ${status}.`,
        "CIPHER no pudo completar la solicitud.",
        operation,
        [{ status }]
    );
}

async function readJsonResponse(response, operation) {
    let source;

    try {
        source = await response.text();
        return parseBrokerLLMProviderJson(
            source,
            {
                providerId:
                    BrokerLLMProviderId.GROQ,
                operation
            }
        );
    } catch (cause) {
        throw adapterError(
            "BROKER95_GROQ_RESPONSE_INVALID",
            "Groq returned an invalid JSON response.",
            "CIPHER devolvió una respuesta que no pudo procesarse.",
            operation,
            [],
            cause
        );
    }
}

function parseStreamingPayload(source, operation) {
    try {
        return parseBrokerLLMProviderJson(
            source,
            {
                providerId:
                    BrokerLLMProviderId.GROQ,
                operation,
                streaming: true
            }
        );
    } catch (cause) {
        throw adapterError(
            "BROKER95_GROQ_STREAM_INVALID",
            "Groq sent an invalid SSE JSON payload.",
            "La transmisión de CIPHER no pudo procesarse.",
            operation,
            [],
            cause
        );
    }
}

function responseIdentifier(response, payload) {
    return normalizeBrokerLLMResponseId(
        payload?.id,
        response?.headers?.get?.(
            "x-request-id"
        )
    );
}

function createAbortScope(parentSignal, timeoutMs) {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromParent = () => {
        controller.abort(parentSignal?.reason);
    };

    if (parentSignal) {
        parentSignal.addEventListener(
            "abort",
            abortFromParent,
            { once: true }
        );

        if (parentSignal.aborted) {
            abortFromParent();
        }
    }

    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    return Object.freeze({
        signal: controller.signal,
        timedOut: () => timedOut,
        dispose() {
            clearTimeout(timeout);
            parentSignal?.removeEventListener?.(
                "abort",
                abortFromParent
            );
        }
    });
}

function requireSSEReader(value) {
    if (
        !(value instanceof BrokerSSEReader) &&
        typeof value?.read !== "function"
    ) {
        throw new TypeError(
            "brokerSSEReader must implement read."
        );
    }

    return value;
}

function requireUrl(value, field) {
    if (
        typeof value !== "string" ||
        !/^https:\/\//u.test(value)
    ) {
        throw new TypeError(
            `${field} must be an HTTPS URL.`
        );
    }

    return value;
}

function requireTimeout(value) {
    if (
        !Number.isSafeInteger(value) ||
        value < 1_000 ||
        value > 120_000
    ) {
        throw new TypeError(
            "groqTimeoutMs must be between 1000 and 120000."
        );
    }

    return value;
}

function adapterError(
    code,
    technicalMessage,
    publicMessage,
    operation,
    diagnostics = [],
    cause
) {
    return new GroqBroker95LLMAdapterError(
        code,
        technicalMessage,
        publicMessage,
        [
            { operation },
            ...diagnostics
        ],
        cause
    );
}

function groqFailureKind(code) {
    switch (code) {
        case "BROKER95_GROQ_NETWORK_FAILED":
            return BrokerLLMProviderFailureKind
                .NETWORK;

        case "BROKER95_GROQ_TIMEOUT":
            return BrokerLLMProviderFailureKind
                .TIMEOUT;

        case "BROKER95_GROQ_AUTHENTICATION_FAILED":
            return BrokerLLMProviderFailureKind
                .AUTHENTICATION;

        case "BROKER95_GROQ_QUOTA_EXHAUSTED":
            return BrokerLLMProviderFailureKind
                .QUOTA;

        case "BROKER95_GROQ_HTTP_FAILED":
            return BrokerLLMProviderFailureKind
                .HTTP;

        case "BROKER95_GROQ_MODEL_UNAVAILABLE":
            return BrokerLLMProviderFailureKind
                .MODEL_UNAVAILABLE;

        case "BROKER95_GROQ_RESPONSE_INVALID":
            return BrokerLLMProviderFailureKind
                .INVALID_RESPONSE;

        case "BROKER95_GROQ_STREAM_INVALID":
            return BrokerLLMProviderFailureKind
                .INVALID_STREAM;

        case "BROKER95_GROQ_STREAM_FAILED":
            return BrokerLLMProviderFailureKind
                .STREAM_FAILED;

        default:
            return BrokerLLMProviderFailureKind
                .PROVIDER;
    }
}
