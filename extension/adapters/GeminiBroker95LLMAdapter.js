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
    BrokerSSEReaderError,
    brokerSSEReader
} from "./BrokerSSEReader.js";

export const GEMINI_API_BASE_URL =
    "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_GEMINI_TIMEOUT_MS = 30_000;

export class GeminiBroker95LLMAdapterError extends Error {

    constructor(
        code,
        technicalMessage,
        publicMessage,
        diagnostics = [],
        cause
    ) {
        super(technicalMessage, { cause });
        this.name = "GeminiBroker95LLMAdapterError";
        this.code = code;
        this.publicMessage = publicMessage;
        this.providerId = BrokerLLMProviderId.GEMINI;
        this.failureKind = geminiFailureKind(code);
        this.httpStatus = diagnostics.find(
            item => Number.isInteger(item?.status)
        )?.status ?? null;
        this.diagnostics = Object.freeze(
            diagnostics.map(item => Object.freeze({ ...item }))
        );
    }
}

/**
 * Adaptador Gemini de infraestructura. Sólo el Extension Host lee la clave
 * privada; el Webview jamás conoce cabeceras, URL ni contenido de errores del
 * proveedor.
 */
export class GeminiBroker95LLMAdapter extends BrokerLLMPort {

    constructor(options = {}) {
        super({
            providerId: BrokerLLMProviderId.GEMINI,
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
            "geminiFetch"
        );
        this.sseReader = requireSSEReader(
            options.sseReader ?? brokerSSEReader
        );
        this.apiBaseUrl = requireUrl(
            options.apiBaseUrl ?? GEMINI_API_BASE_URL,
            "apiBaseUrl"
        );
        this.timeoutMs = requireTimeout(
            options.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS
        );
        this.developerLogger = options.developerLogger ?? console;
    }

    async performRequest(request, execution) {
        try {
            const settings = await this.configurationService
                .resolvePrivateLlmSettings(this.getProviderId());

            requireGeminiSettings(settings, this.getProviderId());

            const result = request.operation ===
                BrokerLLMOperation.TEST_CONNECTION
                ? await this.#testConnection(settings, execution.signal)
                : await this.#createCompletion(
                    request,
                    settings,
                    execution
                );

            this.availability?.recordSuccess();
            return result;
        } catch (error) {
            const availability = this.availability?.recordFailure(error);

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
            createGeminiModelUrl(this.apiBaseUrl, settings.model),
            {
                method: "GET",
                headers: createHeaders(settings.credential.value)
            },
            signal,
            BrokerLLMOperation.TEST_CONNECTION
        );

        try {
            const payload = await readGeminiJson(
                connection.response,
                BrokerLLMOperation.TEST_CONNECTION
            );
            rejectGeminiErrorPayload(
                payload,
                BrokerLLMOperation.TEST_CONNECTION
            );
            requireGeminiGenerationModel(
                payload,
                BrokerLLMOperation.TEST_CONNECTION
            );

            return createBrokerLLMTransportResult({
                output: JSON.stringify({
                    connected: true,
                    message: "Modelo disponible."
                }),
                model: payload?.baseModelId ?? payload?.name,
                fallbackModel: settings.model,
                finishReason: "STOP",
                usage: null,
                responseIds: [
                    responseIdentifier(connection.response, payload)
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

    async #createCompletion(request, settings, execution) {
        const connection = await this.#fetch(
            createGeminiGenerateUrl(
                this.apiBaseUrl,
                settings.model,
                request.stream
            ),
            {
                method: "POST",
                headers: createHeaders(settings.credential.value, true),
                body: JSON.stringify(
                    createGeminiCompletionPayload(request)
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
            throw this.#translateReadError(
                error,
                request.operation,
                connection
            );
        } finally {
            connection.dispose();
        }
    }

    async #readCompletion(response, fallbackModel, operation) {
        const payload = await readGeminiJson(response, operation);
        rejectGeminiErrorPayload(payload, operation);
        const content = extractGeminiText(payload);

        if (content.length === 0) {
            throw adapterError(
                "BROKER95_GEMINI_RESPONSE_INVALID",
                "Gemini returned a completion without text content.",
                "CIPHER devolvió una respuesta incompleta.",
                operation
            );
        }

        return createBrokerLLMTransportResult({
            output: content,
            model: payload?.modelVersion,
            fallbackModel,
            finishReason: payload?.candidates?.[0]?.finishReason,
            usage: normalizeGeminiUsage(
                payload?.usageMetadata
            ),
            responseIds: [responseIdentifier(response, payload)]
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
        let finishReason = BrokerLLMFinishReason.UNKNOWN;
        let usage = null;
        let responseId = responseIdentifier(response, null);
        let receivedPayload = false;

        try {
            for await (const event of this.sseReader.read(
                response.body,
                { signal: connection.signal }
            )) {
                if (event.data === "[DONE]") {
                    break;
                }

                const payload = parseGeminiStreamingPayload(
                    event.data,
                    request.operation
                );
                rejectGeminiErrorPayload(payload, request.operation);
                receivedPayload = true;
                model = normalizeBrokerLLMModel(
                    payload?.modelVersion,
                    model
                );
                responseId ??= responseIdentifier(response, payload);
                usage ??= normalizeGeminiUsage(
                    payload?.usageMetadata
                );

                const candidate = payload?.candidates?.[0];

                if (candidate?.finishReason != null) {
                    finishReason = normalizeBrokerLLMFinishReason(
                        candidate.finishReason
                    );
                }

                const delta = extractGeminiText(payload);

                if (delta.length > 0) {
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

        if (!receivedPayload || content.length === 0) {
            throw adapterError(
                "BROKER95_GEMINI_STREAM_INVALID",
                "Gemini streaming completion ended without text content.",
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

    async #fetch(url, init, parentSignal, operation) {
        const scope = createAbortScope(parentSignal, this.timeoutMs);
        let succeeded = false;

        try {
            const response = await this.fetch(url, {
                ...init,
                signal: scope.signal
            });

            if (!response?.ok) {
                const status = Number.isInteger(response?.status)
                    ? response.status
                    : 0;
                const error = httpError(
                    status,
                    operation,
                    await readGeminiHttpError(
                        response
                    )
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
                error instanceof GeminiBroker95LLMAdapterError ||
                error instanceof BrokerLLMProtocolError
            ) {
                throw error;
            }

            if (parentSignal?.aborted) {
                throw BrokerLLMProtocolError.aborted(operation);
            }

            const translated = scope.timedOut()
                ? adapterError(
                    "BROKER95_GEMINI_TIMEOUT",
                    "Gemini request timed out.",
                    "CIPHER tardó demasiado en responder.",
                    operation
                )
                : adapterError(
                    "BROKER95_GEMINI_NETWORK_FAILED",
                    "Gemini network request failed.",
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

    #translateStreamingError(error, operation, connection) {
        if (
            error instanceof GeminiBroker95LLMAdapterError ||
            error instanceof BrokerLLMProtocolError
        ) {
            return error;
        }

        if (connection.signal?.aborted) {
            return connection.timedOut()
                ? adapterError(
                    "BROKER95_GEMINI_TIMEOUT",
                    "Gemini streaming request timed out.",
                    "CIPHER tardó demasiado en responder.",
                    operation
                )
                : BrokerLLMProtocolError.aborted(operation);
        }

        return error instanceof BrokerSSEReaderError
            ? adapterError(
                "BROKER95_GEMINI_STREAM_INVALID",
                "Gemini SSE stream could not be decoded.",
                "La transmisión de CIPHER no pudo procesarse.",
                operation,
                [],
                error
            )
            : adapterError(
                "BROKER95_GEMINI_STREAM_FAILED",
                "Gemini streaming completion failed.",
                "La transmisión de CIPHER falló.",
                operation,
                [],
                error
            );
    }

    #translateReadError(error, operation, connection) {
        if (connection.signal?.aborted) {
            return connection.timedOut()
                ? adapterError(
                    "BROKER95_GEMINI_TIMEOUT",
                    "Gemini request timed out while reading a response.",
                    "CIPHER tardó demasiado en responder.",
                    operation
                )
                : BrokerLLMProtocolError.aborted(operation);
        }

        if (
            error instanceof GeminiBroker95LLMAdapterError ||
            error instanceof BrokerLLMProtocolError
        ) {
            return error;
        }

        if (error?.providerId === BrokerLLMProviderId.GEMINI) {
            return adapterError(
                "BROKER95_GEMINI_RESPONSE_INVALID",
                "Gemini returned invalid JSON.",
                "CIPHER devolvió una respuesta que no pudo procesarse.",
                operation,
                [],
                error
            );
        }

        return adapterError(
            "BROKER95_GEMINI_RESPONSE_INVALID",
            "Gemini response could not be read.",
            "CIPHER devolvió una respuesta que no pudo procesarse.",
            operation,
            [],
            error
        );
    }

    #log(error, operation, status = null) {
        try {
            this.developerLogger.error?.(
                "BROKER.95 Gemini adapter request failed.",
                { code: error.code, operation, status }
            );
        } catch {
            // Un logger no puede alterar el resultado del proveedor.
        }
    }
}

export function createGeminiCompletionPayload(request) {
    return Object.freeze({
        systemInstruction: Object.freeze({
            parts: Object.freeze([Object.freeze({
                text: createBrokerLLMSystemInstruction(request)
            })])
        }),
        contents: Object.freeze([
            ...request.conversation.map(message => Object.freeze({
                role: message.role === "assistant" ? "model" : "user",
                parts: Object.freeze([Object.freeze({
                    text: message.content
                })])
            })),
            Object.freeze({
                role: "user",
                parts: Object.freeze([Object.freeze({
                    text: createBrokerLLMOperationMessage(request)
                })])
            })
        ]),
        generationConfig: Object.freeze({
            responseMimeType:
                request.responseFormat ===
                    BrokerLLMResponseFormat.TEXT
                    ? "text/plain"
                    : "application/json",
            maxOutputTokens: brokerLLMCompletionTokenBudget(
                request.operation
            ),
            temperature: 0.2
        })
    });
}

export function createGeminiModelUrl(apiBaseUrl, model) {
    return `${requireUrl(apiBaseUrl, "apiBaseUrl")}/models/${encodeURIComponent(
        normalizeGeminiModelId(model)
    )}`;
}

export function createGeminiGenerateUrl(apiBaseUrl, model, streaming) {
    const action = streaming
        ? "streamGenerateContent?alt=sse"
        : "generateContent";
    return `${createGeminiModelUrl(apiBaseUrl, model)}:${action}`;
}

function requireGeminiSettings(settings, providerId) {
    if (
        settings?.providerId !== providerId ||
        settings.credential?.providerId !== providerId ||
        settings.credential?.kind !== BrokerLLMCredentialKind.API_KEY ||
        typeof settings.credential?.value !== "string"
    ) {
        throw BrokerLLMProtocolError.invalidRequest("credential");
    }
}

function createHeaders(apiKey, json = false) {
    return Object.freeze({
        "x-goog-api-key": apiKey,
        ...(json ? { "Content-Type": "application/json" } : {})
    });
}

async function readGeminiJson(response, operation) {
    let source;

    try {
        source = await response.text();
    } catch (cause) {
        throw adapterError(
            "BROKER95_GEMINI_RESPONSE_INVALID",
            "Gemini response text could not be read.",
            "CIPHER devolvió una respuesta que no pudo procesarse.",
            operation,
            [],
            cause
        );
    }

    try {
        return parseBrokerLLMProviderJson(source, {
            providerId: BrokerLLMProviderId.GEMINI,
            operation,
            streaming: false
        });
    } catch (cause) {
        throw adapterError(
            "BROKER95_GEMINI_RESPONSE_INVALID",
            "Gemini returned invalid JSON.",
            "CIPHER devolvió una respuesta que no pudo procesarse.",
            operation,
            [],
            cause
        );
    }
}

function parseGeminiStreamingPayload(source, operation) {
    try {
        return parseBrokerLLMProviderJson(source, {
            providerId: BrokerLLMProviderId.GEMINI,
            operation,
            streaming: true
        });
    } catch (cause) {
        throw adapterError(
            "BROKER95_GEMINI_STREAM_INVALID",
            "Gemini sent an invalid SSE JSON payload.",
            "La transmisión de CIPHER no pudo procesarse.",
            operation,
            [],
            cause
        );
    }
}

function rejectGeminiErrorPayload(payload, operation) {
    if (payload?.error == null) {
        return;
    }

    const status = Number.isInteger(payload.error.code)
        ? payload.error.code
        : null;
    throw status == null
        ? adapterError(
            "BROKER95_GEMINI_PROVIDER_FAILED",
            "Gemini returned an error payload.",
            "El proveedor no pudo procesar la solicitud de CIPHER.",
            operation
        )
        : httpError(
            status,
            operation,
            payload.error
        );
}

function requireGeminiGenerationModel(payload, operation) {
    if (
        !Array.isArray(
            payload?.supportedGenerationMethods
        ) ||
        !payload.supportedGenerationMethods
            .includes("generateContent")
    ) {
        throw adapterError(
            "BROKER95_GEMINI_MODEL_UNAVAILABLE",
            "The configured Gemini model does not support generateContent.",
            "El modelo configurado no está disponible para CIPHER.",
            operation
        );
    }
}

function normalizeGeminiUsage(value) {
    const inputTokens = value?.promptTokenCount;
    const totalTokens = value?.totalTokenCount;

    if (
        Number.isSafeInteger(inputTokens) &&
        inputTokens >= 0 &&
        Number.isSafeInteger(totalTokens) &&
        totalTokens >= inputTokens
    ) {
        return Object.freeze({
            inputTokens,
            outputTokens:
                totalTokens - inputTokens,
            totalTokens
        });
    }

    return normalizeBrokerLLMUsage(value);
}

async function readGeminiHttpError(response) {
    try {
        if (typeof response?.text !== "function") {
            return null;
        }

        const source = await response.text();

        if (
            typeof source !== "string" ||
            source.length === 0 ||
            source.length > 65_536
        ) {
            return null;
        }

        return JSON.parse(source)?.error ?? null;
    } catch {
        return null;
    }
}

function extractGeminiText(payload) {
    const parts = payload?.candidates?.[0]?.content?.parts;

    if (!Array.isArray(parts)) {
        return "";
    }

    return parts.map(part =>
        typeof part?.text === "string" ? part.text : ""
    ).join("");
}

function responseIdentifier(response, payload) {
    return normalizeBrokerLLMResponseId(
        payload?.responseId,
        response?.headers?.get?.("x-request-id"),
        response?.headers?.get?.("x-goog-request-id")
    );
}

function createAbortScope(parentSignal, timeoutMs) {
    const controller = new AbortController();
    let didTimeout = false;
    const abortFromParent = () => controller.abort();

    if (parentSignal) {
        parentSignal.addEventListener("abort", abortFromParent, {
            once: true
        });
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
            parentSignal?.removeEventListener?.(
                "abort",
                abortFromParent
            );
        }
    });
}

function requireSSEReader(value) {
    if (value == null || typeof value.read !== "function") {
        throw BrokerLLMProtocolError.invalidPort();
    }

    return value;
}

function requireUrl(value, field) {
    if (typeof value !== "string" || value.length > 2_048) {
        throw BrokerLLMProtocolError.invalidRequest(field);
    }

    try {
        const url = new URL(value);

        if (url.protocol !== "https:") {
            throw new TypeError("Only HTTPS endpoints are accepted.");
        }

        return url.toString().replace(/\/$/u, "");
    } catch {
        throw BrokerLLMProtocolError.invalidRequest(field);
    }
}

function normalizeGeminiModelId(value) {
    if (typeof value !== "string") {
        throw BrokerLLMProtocolError.invalidRequest("model");
    }

    const selected = value.trim().replace(/^models\//u, "");

    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/u.test(selected)) {
        throw BrokerLLMProtocolError.invalidRequest("model");
    }

    return selected;
}

function requireTimeout(value) {
    if (
        !Number.isSafeInteger(value) ||
        value < 1_000 ||
        value > 120_000
    ) {
        throw BrokerLLMProtocolError.invalidRequest("timeoutMs");
    }

    return value;
}

function httpError(status, operation, providerError = null) {
    const invalidApiKey =
        Array.isArray(providerError?.details) &&
        providerError.details.some(
            detail =>
                detail?.reason ===
                    "API_KEY_INVALID"
        );

    if (invalidApiKey || [401, 403].includes(status)) {
        return adapterError(
            "BROKER95_GEMINI_AUTHENTICATION_FAILED",
            `Gemini rejected the API key with HTTP ${status}.`,
            "El proveedor rechazó la credencial de CIPHER.",
            operation,
            [{ status }]
        );
    }

    if (status === 429) {
        return adapterError(
            "BROKER95_GEMINI_QUOTA_EXHAUSTED",
            "Gemini quota was exhausted.",
            "El proveedor agotó la cuota disponible para CIPHER.",
            operation,
            [{ status }]
        );
    }

    if (status === 404) {
        return adapterError(
            "BROKER95_GEMINI_MODEL_UNAVAILABLE",
            "The configured Gemini model is unavailable.",
            "El modelo configurado no está disponible para CIPHER.",
            operation,
            [{ status }]
        );
    }

    return adapterError(
        "BROKER95_GEMINI_HTTP_FAILED",
        `Gemini request failed with HTTP ${status}.`,
        "CIPHER no pudo completar la solicitud.",
        operation,
        [{ status }]
    );
}

function adapterError(code, technicalMessage, publicMessage, operation, diagnostics = [], cause) {
    return new GeminiBroker95LLMAdapterError(
        code,
        technicalMessage,
        publicMessage,
        [{ operation }, ...diagnostics],
        cause
    );
}

function geminiFailureKind(code) {
    switch (code) {
        case "BROKER95_GEMINI_NETWORK_FAILED":
            return BrokerLLMProviderFailureKind.NETWORK;
        case "BROKER95_GEMINI_TIMEOUT":
            return BrokerLLMProviderFailureKind.TIMEOUT;
        case "BROKER95_GEMINI_AUTHENTICATION_FAILED":
            return BrokerLLMProviderFailureKind.AUTHENTICATION;
        case "BROKER95_GEMINI_QUOTA_EXHAUSTED":
            return BrokerLLMProviderFailureKind.QUOTA;
        case "BROKER95_GEMINI_MODEL_UNAVAILABLE":
            return BrokerLLMProviderFailureKind.MODEL_UNAVAILABLE;
        case "BROKER95_GEMINI_RESPONSE_INVALID":
            return BrokerLLMProviderFailureKind.INVALID_RESPONSE;
        case "BROKER95_GEMINI_STREAM_INVALID":
            return BrokerLLMProviderFailureKind.INVALID_STREAM;
        case "BROKER95_GEMINI_STREAM_FAILED":
            return BrokerLLMProviderFailureKind.STREAM_FAILED;
        case "BROKER95_GEMINI_HTTP_FAILED":
            return BrokerLLMProviderFailureKind.HTTP;
        default:
            return BrokerLLMProviderFailureKind.PROVIDER;
    }
}
