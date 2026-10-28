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
    parseBrokerLLMProviderJson
} from "../../src/broker95/llm/index.js";
import {
    brokerLLMCompletionTokenBudget,
    createBrokerLLMOperationMessage,
    createBrokerLLMSystemInstruction
} from "../../src/broker95/llm/BrokerLLMPrompt.js";
import {
    BrokerLlmAvailabilityError
} from "../../src/broker95/llm/BrokerLlmAvailability.js";
import {
    BrokerSSEReader,
    BrokerSSEReaderError,
    brokerSSEReader
} from "./BrokerSSEReader.js";

export const DEEPSEEK_CHAT_COMPLETIONS_URL =
    "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_MODELS_URL =
    "https://api.deepseek.com/models";
export const DEFAULT_DEEPSEEK_TIMEOUT_MS = 120_000;

export class DeepSeekBroker95LLMAdapterError extends Error {

    constructor(
        code,
        technicalMessage,
        publicMessage,
        diagnostics = [],
        cause
    ) {
        super(technicalMessage, { cause });
        this.name =
            "DeepSeekBroker95LLMAdapterError";
        this.code = code;
        this.publicMessage = publicMessage;
        this.providerId =
            BrokerLLMProviderId.DEEPSEEK;
        this.failureKind =
            deepSeekFailureKind(code);
        this.httpStatus = diagnostics.find(
            item => Number.isInteger(item?.status)
        )?.status ?? null;
        this.diagnostics = Object.freeze(
            diagnostics.map(item =>
                Object.freeze({ ...item })
            )
        );
    }
}

/**
 * Adaptador del Extension Host para la API oficial de DeepSeek. Usa la
 * superficie estable de Chat Completions y conserva la clave fuera del
 * Webview y del estado determinista del juego.
 */
export class DeepSeekBroker95LLMAdapter
    extends BrokerLLMPort {

    constructor(options = {}) {
        super({
            providerId:
                BrokerLLMProviderId.DEEPSEEK,
            responseValidator:
                options.responseValidator
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
            "deepSeekFetch"
        );
        this.sseReader = requireSSEReader(
            options.sseReader ?? brokerSSEReader
        );
        this.chatCompletionsUrl = requireHttpsUrl(
            options.chatCompletionsUrl ??
                DEEPSEEK_CHAT_COMPLETIONS_URL,
            "chatCompletionsUrl"
        );
        this.modelsUrl = requireHttpsUrl(
            options.modelsUrl ??
                DEEPSEEK_MODELS_URL,
            "modelsUrl"
        );
        this.timeoutMs = requireTimeout(
            options.timeoutMs ??
                DEFAULT_DEEPSEEK_TIMEOUT_MS
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

            requireDeepSeekSettings(
                settings,
                this.getProviderId()
            );

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
        const connection = await this.#fetch(
            this.modelsUrl,
            {
                method: "GET",
                headers: createHeaders(
                    settings.credential.value
                )
            },
            signal,
            BrokerLLMOperation.TEST_CONNECTION
        );

        try {
            const payload = await readDeepSeekJson(
                connection.response,
                BrokerLLMOperation.TEST_CONNECTION
            );
            rejectDeepSeekErrorPayload(
                payload,
                BrokerLLMOperation.TEST_CONNECTION
            );
            const models = requireModelList(
                payload,
                BrokerLLMOperation.TEST_CONNECTION
            );

            if (!models.includes(settings.model)) {
                throw adapterError(
                    "BROKER95_DEEPSEEK_MODEL_UNAVAILABLE",
                    "The configured DeepSeek model is not present in the provider model list.",
                    "El modelo configurado no está disponible para CIPHER.",
                    BrokerLLMOperation.TEST_CONNECTION
                );
            }

            return createBrokerLLMTransportResult({
                output: JSON.stringify({
                    connected: true,
                    message: "Modelo disponible."
                }),
                model: settings.model,
                fallbackModel: settings.model,
                finishReason: "stop",
                usage: null,
                responseIds: [
                    responseIdentifier(
                        connection.response,
                        payload
                    )
                ]
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
                    createDeepSeekChatPayload(
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
            throw request.stream
                ? this.#translateStreamingError(
                    error,
                    request.operation,
                    connection
                )
                : this.#translateReadError(
                    error,
                    request.operation,
                    connection
                );
        } finally {
            connection.dispose();
        }
    }

    async #readCompletion(
        response,
        fallbackModel,
        operation
    ) {
        const payload = await readDeepSeekJson(
            response,
            operation
        );
        rejectDeepSeekErrorPayload(payload, operation);

        const choice = payload?.choices?.[0];
        const content = choice?.message?.content;

        if (
            typeof content !== "string" ||
            content.trim().length === 0
        ) {
            throw adapterError(
                "BROKER95_DEEPSEEK_RESPONSE_INVALID",
                "DeepSeek returned a completion without final message content.",
                "CIPHER devolvió una respuesta incompleta.",
                operation
            );
        }

        return createBrokerLLMTransportResult({
            output: content,
            model: payload?.model,
            fallbackModel,
            finishReason: choice?.finish_reason,
            usage: payload?.usage,
            responseIds: [
                payload?.id,
                responseIdentifier(response, payload)
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

        for await (const event of this.sseReader.read(
            response.body,
            { signal: connection.signal }
        )) {
            if (event.data.trim() === "[DONE]") {
                completed = true;
                break;
            }

            const payload = parseStreamingPayload(
                event.data,
                request.operation
            );
            rejectDeepSeekErrorPayload(
                payload,
                request.operation,
                true
            );
            const choice = payload?.choices?.[0];

            model = normalizeBrokerLLMModel(
                payload?.model,
                model
            );
            responseId ??= responseIdentifier(
                response,
                payload
            );
            usage = normalizeBrokerLLMUsage(
                payload?.usage
            ) ?? usage;

            if (choice?.finish_reason != null) {
                finishReason =
                    normalizeBrokerLLMFinishReason(
                        choice.finish_reason
                    );
            }

            const delta = choice?.delta?.content;

            if (
                typeof delta === "string" &&
                delta.length > 0
            ) {
                content += delta;
                await execution.emitDelta(delta);
            }
        }

        if (!completed || content.trim().length === 0) {
            throw adapterError(
                "BROKER95_DEEPSEEK_STREAM_INVALID",
                "DeepSeek streaming completion ended before a complete final response.",
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
                const error = httpError(
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
                    DeepSeekBroker95LLMAdapterError ||
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
                    "BROKER95_DEEPSEEK_TIMEOUT",
                    "DeepSeek request timed out.",
                    "CIPHER tardó demasiado en responder.",
                    operation
                )
                : adapterError(
                    "BROKER95_DEEPSEEK_NETWORK_FAILED",
                    "DeepSeek network request failed.",
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
                DeepSeekBroker95LLMAdapterError ||
            error instanceof BrokerLLMProtocolError
        ) {
            return error;
        }

        if (connection.signal?.aborted) {
            return connection.timedOut()
                ? adapterError(
                    "BROKER95_DEEPSEEK_TIMEOUT",
                    "DeepSeek stream timed out.",
                    "CIPHER tardó demasiado en responder.",
                    operation
                )
                : BrokerLLMProtocolError
                    .aborted(operation);
        }

        const translated = error instanceof
            BrokerSSEReaderError
            ? adapterError(
                "BROKER95_DEEPSEEK_STREAM_INVALID",
                "DeepSeek SSE stream could not be decoded.",
                "La transmisión de CIPHER no pudo procesarse.",
                operation,
                [],
                error
            )
            : adapterError(
                "BROKER95_DEEPSEEK_STREAM_FAILED",
                "DeepSeek streaming completion failed.",
                "La transmisión de CIPHER falló.",
                operation,
                [],
                error
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
                    "BROKER95_DEEPSEEK_TIMEOUT",
                    "DeepSeek request timed out while reading a response.",
                    "CIPHER tardó demasiado en responder.",
                    operation
                )
                : BrokerLLMProtocolError
                    .aborted(operation);
        }

        if (
            error instanceof
                DeepSeekBroker95LLMAdapterError ||
            error instanceof BrokerLLMProtocolError
        ) {
            return error;
        }

        return adapterError(
            "BROKER95_DEEPSEEK_RESPONSE_INVALID",
            "DeepSeek response could not be read.",
            "CIPHER devolvió una respuesta que no pudo procesarse.",
            operation,
            [],
            error
        );
    }

    #log(error, operation, status = null) {
        try {
            this.developerLogger.error?.(
                "BROKER.95 DeepSeek adapter request failed.",
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

export function createDeepSeekChatPayload(
    request,
    model
) {
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
        ...(request.responseFormat ===
            BrokerLLMResponseFormat.TEXT
            ? {}
            : {
                response_format: Object.freeze({
                    type: "json_object"
                })
            }),
        max_tokens: brokerLLMCompletionTokenBudget(
            request.operation
        ),
        stream: request.stream
    });
}

function requireDeepSeekSettings(settings, providerId) {
    if (
        settings?.providerId !== providerId ||
        settings?.credential?.providerId !== providerId ||
        settings?.credential?.kind !==
            BrokerLLMCredentialKind.API_KEY ||
        typeof settings?.credential?.value !== "string" ||
        settings.credential.value.length === 0 ||
        typeof settings?.model !== "string" ||
        settings.model.trim().length === 0
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("credential");
    }
}

function createHeaders(apiKey, json = false) {
    return Object.freeze({
        Authorization: `Bearer ${apiKey}`,
        ...(json
            ? { "Content-Type": "application/json" }
            : {})
    });
}

async function readDeepSeekJson(response, operation) {
    try {
        return parseBrokerLLMProviderJson(
            await response.text(),
            {
                providerId:
                    BrokerLLMProviderId.DEEPSEEK,
                operation
            }
        );
    } catch (cause) {
        if (
            cause instanceof
                DeepSeekBroker95LLMAdapterError
        ) {
            throw cause;
        }

        throw adapterError(
            "BROKER95_DEEPSEEK_RESPONSE_INVALID",
            "DeepSeek returned an invalid JSON response.",
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
                    BrokerLLMProviderId.DEEPSEEK,
                operation,
                streaming: true
            }
        );
    } catch (cause) {
        throw adapterError(
            "BROKER95_DEEPSEEK_STREAM_INVALID",
            "DeepSeek sent an invalid SSE JSON payload.",
            "La transmisión de CIPHER no pudo procesarse.",
            operation,
            [],
            cause
        );
    }
}

function rejectDeepSeekErrorPayload(
    payload,
    operation,
    streaming = false
) {
    if (payload?.error == null) {
        return;
    }

    throw adapterError(
        streaming
            ? "BROKER95_DEEPSEEK_STREAM_FAILED"
            : "BROKER95_DEEPSEEK_RESPONSE_INVALID",
        "DeepSeek returned an error payload in a successful HTTP response.",
        streaming
            ? "La transmisión de CIPHER falló."
            : "CIPHER devolvió una respuesta que no pudo procesarse.",
        operation
    );
}

function requireModelList(payload, operation) {
    if (!Array.isArray(payload?.data)) {
        throw adapterError(
            "BROKER95_DEEPSEEK_RESPONSE_INVALID",
            "DeepSeek returned an invalid model list.",
            "La lista de modelos de CIPHER no pudo procesarse.",
            operation
        );
    }

    return payload.data
        .map(model => model?.id)
        .filter(model =>
            typeof model === "string" &&
            model.length > 0
        );
}

function responseIdentifier(response, payload) {
    return normalizeBrokerLLMResponseId(
        payload?.id,
        response?.headers?.get?.(
            "x-request-id"
        )
    );
}

function httpError(status, operation) {
    switch (status) {
        case 401:
            return adapterError(
                "BROKER95_DEEPSEEK_AUTHENTICATION_FAILED",
                "DeepSeek rejected the configured API key.",
                "El proveedor rechazó la API key de CIPHER.",
                operation,
                [{ status }]
            );

        case 402:
        case 429:
            return adapterError(
                "BROKER95_DEEPSEEK_QUOTA_EXHAUSTED",
                "DeepSeek rejected the request because balance or capacity is unavailable.",
                "El proveedor no tiene saldo o capacidad disponible para CIPHER.",
                operation,
                [{ status }]
            );

        case 404:
            return adapterError(
                "BROKER95_DEEPSEEK_MODEL_UNAVAILABLE",
                "DeepSeek could not find the configured model.",
                "El modelo configurado no está disponible para CIPHER.",
                operation,
                [{ status }]
            );

        default:
            return adapterError(
                "BROKER95_DEEPSEEK_HTTP_FAILED",
                `DeepSeek request failed with HTTP ${status}.`,
                "CIPHER no pudo completar la solicitud.",
                operation,
                [{ status }]
            );
    }
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

function requireHttpsUrl(value, field) {
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
        value > 600_000
    ) {
        throw new TypeError(
            "deepSeekTimeoutMs must be between 1000 and 600000."
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
    return new DeepSeekBroker95LLMAdapterError(
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

function deepSeekFailureKind(code) {
    switch (code) {
        case "BROKER95_DEEPSEEK_NETWORK_FAILED":
            return BrokerLLMProviderFailureKind.NETWORK;
        case "BROKER95_DEEPSEEK_TIMEOUT":
            return BrokerLLMProviderFailureKind.TIMEOUT;
        case "BROKER95_DEEPSEEK_AUTHENTICATION_FAILED":
            return BrokerLLMProviderFailureKind
                .AUTHENTICATION;
        case "BROKER95_DEEPSEEK_QUOTA_EXHAUSTED":
            return BrokerLLMProviderFailureKind.QUOTA;
        case "BROKER95_DEEPSEEK_MODEL_UNAVAILABLE":
            return BrokerLLMProviderFailureKind
                .MODEL_UNAVAILABLE;
        case "BROKER95_DEEPSEEK_HTTP_FAILED":
            return BrokerLLMProviderFailureKind.HTTP;
        case "BROKER95_DEEPSEEK_RESPONSE_INVALID":
            return BrokerLLMProviderFailureKind
                .INVALID_RESPONSE;
        case "BROKER95_DEEPSEEK_STREAM_INVALID":
            return BrokerLLMProviderFailureKind
                .INVALID_STREAM;
        case "BROKER95_DEEPSEEK_STREAM_FAILED":
            return BrokerLLMProviderFailureKind
                .STREAM_FAILED;
        default:
            return BrokerLLMProviderFailureKind.PROVIDER;
    }
}
