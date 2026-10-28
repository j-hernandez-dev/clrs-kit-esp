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
    BrokerSSEReaderError,
    brokerSSEReader
} from "./BrokerSSEReader.js";

export const OPENAI_RESPONSES_URL =
    "https://api.openai.com/v1/responses";
export const OPENAI_MODELS_URL =
    "https://api.openai.com/v1/models";
export const DEFAULT_OPENAI_TIMEOUT_MS = 60_000;

export class OpenAIBroker95LLMAdapterError extends Error {

    constructor(
        code,
        technicalMessage,
        publicMessage,
        diagnostics = [],
        cause
    ) {
        super(technicalMessage, { cause });
        this.name = "OpenAIBroker95LLMAdapterError";
        this.code = code;
        this.publicMessage = publicMessage;
        this.providerId = BrokerLLMProviderId.OPENAI;
        this.failureKind = openAIFailureKind(code);
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
 * Adaptador REST para la API de Responses. La clave permanece en el
 * Extension Host y ninguna respuesta sin validar alcanza el estado del juego.
 */
export class OpenAIBroker95LLMAdapter extends BrokerLLMPort {

    constructor(options = {}) {
        super({
            providerId: BrokerLLMProviderId.OPENAI,
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
            "openAIFetch"
        );
        this.sseReader = requireSSEReader(
            options.sseReader ?? brokerSSEReader
        );
        this.responsesUrl = requireHttpsUrl(
            options.responsesUrl ?? OPENAI_RESPONSES_URL,
            "responsesUrl"
        );
        this.modelsUrl = requireHttpsUrl(
            options.modelsUrl ?? OPENAI_MODELS_URL,
            "modelsUrl"
        );
        this.timeoutMs = requireTimeout(
            options.timeoutMs ?? DEFAULT_OPENAI_TIMEOUT_MS
        );
        this.developerLogger = options.developerLogger ?? console;
    }

    async performRequest(request, execution) {
        try {
            const settings = await this.configurationService
                .resolvePrivateLlmSettings(this.getProviderId());

            requireOpenAISettings(settings, this.getProviderId());

            const result = request.operation ===
                BrokerLLMOperation.TEST_CONNECTION
                ? await this.#testConnection(
                    settings,
                    execution.signal
                )
                : await this.#createResponse(
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
            `${this.modelsUrl}/${encodeURIComponent(settings.model)}`,
            {
                method: "GET",
                headers: createHeaders(
                    settings.credential.value,
                    false
                )
            },
            signal,
            BrokerLLMOperation.TEST_CONNECTION
        );

        try {
            const payload = await readOpenAIJson(
                connection.response,
                BrokerLLMOperation.TEST_CONNECTION
            );
            rejectOpenAIErrorPayload(
                payload,
                BrokerLLMOperation.TEST_CONNECTION
            );

            return createBrokerLLMTransportResult({
                output: JSON.stringify({
                    connected: true,
                    message: "Modelo disponible."
                }),
                model: payload?.id,
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

    async #createResponse(request, settings, execution) {
        const connection = await this.#fetch(
            this.responsesUrl,
            {
                method: "POST",
                headers: createHeaders(
                    settings.credential.value,
                    true
                ),
                body: JSON.stringify(
                    createOpenAIResponsePayload(
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
                ? await this.#readStreamingResponse(
                    connection.response,
                    settings.model,
                    request,
                    execution,
                    connection
                )
                : await this.#readResponse(
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

    async #readResponse(response, fallbackModel, operation) {
        const payload = await readOpenAIJson(
            response,
            operation
        );
        rejectOpenAIErrorPayload(payload, operation);

        return createOpenAITransportResult(
            payload,
            fallbackModel,
            response
        );
    }

    async #readStreamingResponse(
        response,
        fallbackModel,
        request,
        execution,
        connection
    ) {
        const chunks = [];
        let completed = null;

        for await (const event of this.sseReader.read(
            response.body,
            { signal: connection.signal }
        )) {
            if (event.data.trim() === "[DONE]") {
                continue;
            }

            const payload = parseBrokerLLMProviderJson(
                event.data,
                {
                    providerId: BrokerLLMProviderId.OPENAI,
                    operation: request.operation,
                    streaming: true
                }
            );
            const type = payload?.type ?? event.event;

            if (type === "response.output_text.delta") {
                const delta = requireStreamDelta(payload?.delta);
                chunks.push(delta);
                await execution.emitDelta(delta);
                continue;
            }

            if (
                type === "response.completed" ||
                type === "response.incomplete"
            ) {
                completed = payload.response ?? payload;
                continue;
            }

            if (
                type === "response.failed" ||
                type === "error"
            ) {
                throw adapterError(
                    "BROKER95_OPENAI_STREAM_FAILED",
                    "OpenAI Responses stream reported a failure.",
                    "La transmisión de CIPHER falló.",
                    request.operation
                );
            }
        }

        if (completed == null) {
            throw adapterError(
                "BROKER95_OPENAI_STREAM_INVALID",
                "OpenAI Responses stream ended without a terminal event.",
                "La transmisión de CIPHER no pudo procesarse.",
                request.operation
            );
        }

        rejectOpenAIErrorPayload(completed, request.operation);
        const output = chunks.join("") ||
            extractOpenAIOutputText(completed, request.operation);

        return createOpenAITransportResult(
            completed,
            fallbackModel,
            response,
            output
        );
    }

    async #fetch(url, init, parentSignal, operation) {
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
                error instanceof OpenAIBroker95LLMAdapterError ||
                error instanceof BrokerLLMProtocolError
            ) {
                throw error;
            }

            if (parentSignal?.aborted) {
                throw BrokerLLMProtocolError.aborted(operation);
            }

            const translated = scope.timedOut()
                ? adapterError(
                    "BROKER95_OPENAI_TIMEOUT",
                    "OpenAI request timed out.",
                    "CIPHER tardó demasiado en responder.",
                    operation
                )
                : adapterError(
                    "BROKER95_OPENAI_NETWORK_FAILED",
                    "OpenAI network request failed.",
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
            error instanceof OpenAIBroker95LLMAdapterError ||
            error instanceof BrokerLLMProtocolError
        ) {
            return error;
        }

        if (connection.signal?.aborted) {
            return connection.timedOut()
                ? adapterError(
                    "BROKER95_OPENAI_TIMEOUT",
                    "OpenAI stream timed out.",
                    "CIPHER tardó demasiado en responder.",
                    operation
                )
                : BrokerLLMProtocolError.aborted(operation);
        }

        return error instanceof BrokerSSEReaderError
            ? adapterError(
                "BROKER95_OPENAI_STREAM_INVALID",
                "OpenAI SSE stream could not be decoded.",
                "La transmisión de CIPHER no pudo procesarse.",
                operation,
                [],
                error
            )
            : adapterError(
                "BROKER95_OPENAI_STREAM_FAILED",
                "OpenAI streaming response failed.",
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
                    "BROKER95_OPENAI_TIMEOUT",
                    "OpenAI response timed out while being read.",
                    "CIPHER tardó demasiado en responder.",
                    operation
                )
                : BrokerLLMProtocolError.aborted(operation);
        }

        if (
            error instanceof OpenAIBroker95LLMAdapterError ||
            error instanceof BrokerLLMProtocolError
        ) {
            return error;
        }

        return adapterError(
            "BROKER95_OPENAI_RESPONSE_INVALID",
            "OpenAI returned an unreadable response.",
            "CIPHER devolvió una respuesta que no pudo procesarse.",
            operation,
            [],
            error
        );
    }

    #log(error, operation, status = null) {
        try {
            this.developerLogger.error?.(
                "BROKER.95 OpenAI adapter request failed.",
                {
                    code: error.code,
                    operation,
                    ...(status == null ? {} : { status })
                }
            );
        } catch {
            // Un logger defectuoso no altera la operación.
        }
    }
}

export function createOpenAIResponsePayload(request, model) {
    const structured =
        createBrokerLLMStructuredResponseDefinition(request);
    const format = request.responseFormat ===
        BrokerLLMResponseFormat.TEXT
        ? Object.freeze({ type: "text" })
        : structured == null
        ? Object.freeze({ type: "json_object" })
        : Object.freeze({
            type: "json_schema",
            name: structured.name,
            strict: true,
            schema: structured.schema
        });

    return Object.freeze({
        model,
        instructions: createBrokerLLMSystemInstruction(request),
        input: createBrokerLLMOperationMessage(request),
        text: Object.freeze({ format }),
        max_output_tokens:
            brokerLLMCompletionTokenBudget(request.operation),
        stream: request.stream,
        store: false
    });
}

function createOpenAITransportResult(
    payload,
    fallbackModel,
    response,
    selectedOutput = null
) {
    const output = selectedOutput ??
        extractOpenAIOutputText(payload);

    return createBrokerLLMTransportResult({
        output,
        model: payload?.model,
        fallbackModel,
        finishReason: openAIFinishReason(payload),
        usage: payload?.usage ?? null,
        responseIds: [
            payload?.id,
            responseIdentifier(response, payload)
        ]
    });
}

function extractOpenAIOutputText(payload, operation = "response") {
    if (typeof payload?.output_text === "string" &&
        payload.output_text.length > 0) {
        return payload.output_text;
    }

    const texts = [];

    for (const item of payload?.output ?? []) {
        if (item?.type !== "message") {
            continue;
        }

        for (const content of item.content ?? []) {
            if (content?.type === "refusal") {
                throw adapterError(
                    "BROKER95_OPENAI_RESPONSE_REFUSED",
                    "OpenAI refused the requested structured response.",
                    "CIPHER no pudo responder a esta solicitud.",
                    operation
                );
            }

            if (
                content?.type === "output_text" &&
                typeof content.text === "string"
            ) {
                texts.push(content.text);
            }
        }
    }

    const output = texts.join("");

    if (output.length === 0) {
        throw adapterError(
            "BROKER95_OPENAI_RESPONSE_INVALID",
            "OpenAI response did not contain output text.",
            "CIPHER devolvió una respuesta que no pudo procesarse.",
            operation
        );
    }

    return output;
}

function openAIFinishReason(payload) {
    if (payload?.status === "completed") {
        return BrokerLLMFinishReason.STOP;
    }

    const reason = payload?.incomplete_details?.reason;

    if (reason === "max_output_tokens") {
        return BrokerLLMFinishReason.LENGTH;
    }

    if (reason === "content_filter") {
        return BrokerLLMFinishReason.CONTENT_FILTER;
    }

    return normalizeBrokerLLMFinishReason(
        reason ?? payload?.status
    );
}

async function readOpenAIJson(response, operation) {
    if (typeof response?.text !== "function") {
        throw adapterError(
            "BROKER95_OPENAI_RESPONSE_INVALID",
            "OpenAI response body is not readable.",
            "CIPHER devolvió una respuesta que no pudo procesarse.",
            operation
        );
    }

    const text = await response.text();
    return parseBrokerLLMProviderJson(text, {
        providerId: BrokerLLMProviderId.OPENAI,
        operation,
        streaming: false
    });
}

function rejectOpenAIErrorPayload(payload, operation) {
    if (payload?.error == null) {
        return;
    }

    throw adapterError(
        "BROKER95_OPENAI_PROVIDER_FAILED",
        "OpenAI returned an error payload.",
        "El proveedor no pudo procesar la solicitud de CIPHER.",
        operation
    );
}

function requireStreamDelta(value) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > 65_536 ||
        value.includes("\u0000")
    ) {
        throw BrokerLLMProtocolError.invalidResponse(
            "stream.delta"
        );
    }

    return value;
}

function requireOpenAISettings(settings, providerId) {
    if (
        settings?.providerId !== providerId ||
        settings.credential?.providerId !== providerId ||
        settings.credential?.kind !==
            BrokerLLMCredentialKind.API_KEY ||
        typeof settings.credential?.value !== "string" ||
        settings.credential.value.length === 0 ||
        typeof settings.model !== "string" ||
        settings.model.trim().length === 0
    ) {
        throw BrokerLLMProtocolError.invalidRequest("credential");
    }
}

function createHeaders(apiKey, withContentType) {
    return Object.freeze({
        Authorization: `Bearer ${apiKey}`,
        ...(withContentType
            ? { "Content-Type": "application/json" }
            : {})
    });
}

function responseIdentifier(response, payload) {
    return payload?.id ??
        response?.headers?.get?.("x-request-id") ??
        null;
}

function createAbortScope(parentSignal, timeoutMs) {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromParent = () => controller.abort();

    if (parentSignal?.aborted) {
        controller.abort();
    } else {
        parentSignal?.addEventListener?.(
            "abort",
            abortFromParent,
            { once: true }
        );
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

function httpError(status, operation) {
    if (status === 401 || status === 403) {
        return adapterError(
            "BROKER95_OPENAI_AUTHENTICATION_FAILED",
            "OpenAI rejected the configured API key.",
            "El proveedor rechazó la credencial de CIPHER.",
            operation,
            [{ status }]
        );
    }

    if (status === 429) {
        return adapterError(
            "BROKER95_OPENAI_QUOTA_EXHAUSTED",
            "OpenAI rate limit or quota was exhausted.",
            "El proveedor agotó la cuota disponible para CIPHER.",
            operation,
            [{ status }]
        );
    }

    if (status === 404) {
        return adapterError(
            "BROKER95_OPENAI_MODEL_UNAVAILABLE",
            "The configured OpenAI model is unavailable.",
            "El modelo configurado no está disponible para CIPHER.",
            operation,
            [{ status }]
        );
    }

    if (status === 408 || status === 504) {
        return adapterError(
            "BROKER95_OPENAI_TIMEOUT",
            `OpenAI request failed with HTTP ${status}.`,
            "CIPHER tardó demasiado en responder.",
            operation,
            [{ status }]
        );
    }

    return adapterError(
        "BROKER95_OPENAI_HTTP_FAILED",
        `OpenAI request failed with HTTP ${status}.`,
        "CIPHER no pudo completar la solicitud.",
        operation,
        [{ status }]
    );
}

function adapterError(
    code,
    technicalMessage,
    publicMessage,
    operation,
    diagnostics = [],
    cause
) {
    return new OpenAIBroker95LLMAdapterError(
        code,
        technicalMessage,
        publicMessage,
        [
            { providerId: BrokerLLMProviderId.OPENAI, operation },
            ...diagnostics
        ],
        cause
    );
}

function openAIFailureKind(code) {
    switch (code) {
        case "BROKER95_OPENAI_NETWORK_FAILED":
            return BrokerLLMProviderFailureKind.NETWORK;
        case "BROKER95_OPENAI_TIMEOUT":
            return BrokerLLMProviderFailureKind.TIMEOUT;
        case "BROKER95_OPENAI_AUTHENTICATION_FAILED":
            return BrokerLLMProviderFailureKind.AUTHENTICATION;
        case "BROKER95_OPENAI_QUOTA_EXHAUSTED":
            return BrokerLLMProviderFailureKind.QUOTA;
        case "BROKER95_OPENAI_MODEL_UNAVAILABLE":
            return BrokerLLMProviderFailureKind.MODEL_UNAVAILABLE;
        case "BROKER95_OPENAI_RESPONSE_INVALID":
            return BrokerLLMProviderFailureKind.INVALID_RESPONSE;
        case "BROKER95_OPENAI_STREAM_INVALID":
            return BrokerLLMProviderFailureKind.INVALID_STREAM;
        case "BROKER95_OPENAI_STREAM_FAILED":
            return BrokerLLMProviderFailureKind.STREAM_FAILED;
        case "BROKER95_OPENAI_HTTP_FAILED":
            return BrokerLLMProviderFailureKind.HTTP;
        default:
            return BrokerLLMProviderFailureKind.PROVIDER;
    }
}

function requireSSEReader(value) {
    if (value == null || typeof value.read !== "function") {
        throw BrokerLLMProtocolError.invalidPort();
    }

    return value;
}

function requireHttpsUrl(value, field) {
    let selected;

    try {
        selected = new URL(value);
    } catch {
        throw BrokerLLMProtocolError.invalidRequest(field);
    }

    if (
        selected.protocol !== "https:" ||
        selected.username ||
        selected.password ||
        selected.search ||
        selected.hash
    ) {
        throw BrokerLLMProtocolError.invalidRequest(field);
    }

    return selected.toString().replace(/\/$/u, "");
}

function requireTimeout(value) {
    if (
        !Number.isSafeInteger(value) ||
        value < 1 ||
        value > 300_000
    ) {
        throw BrokerLLMProtocolError.invalidRequest("timeoutMs");
    }

    return value;
}
