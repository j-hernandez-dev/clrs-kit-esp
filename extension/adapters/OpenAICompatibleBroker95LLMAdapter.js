import {
    requireFunction,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    BrokerLLMCredentialKind,
    BrokerLLMEndpointKind,
    BrokerLLMFinishReason,
    BrokerLLMOperation,
    BrokerLLMPort,
    BrokerLLMProviderError,
    BrokerLLMProviderFailureKind,
    BrokerLLMProviderId,
    BrokerLLMProtocolError,
    BrokerLLMResponseFormat,
    createBrokerLLMTransportResult,
    getBrokerLLMProviderDescriptor,
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
    createBrokerLLMSystemInstruction
} from "../../src/broker95/llm/BrokerLLMPrompt.js";
import {
    BrokerLlmAvailabilityError
} from "../../src/broker95/llm/BrokerLlmAvailability.js";
import {
    BrokerSSEReaderError,
    brokerSSEReader
} from "./BrokerSSEReader.js";

export const DEFAULT_OPENAI_COMPATIBLE_TIMEOUT_MS =
    120_000;
export const MAX_OPENAI_COMPATIBLE_JSON_CHARACTERS =
    2_097_152;

export const OpenAICompatibleConnectionProbe =
    Object.freeze({
        MODELS: "models",
        CHAT_COMPLETION: "chat-completion"
    });

export const OPENAI_COMPATIBLE_PROVIDER_PROFILES =
    Object.freeze({
        [BrokerLLMProviderId.LM_STUDIO]:
            profile({
                providerId:
                    BrokerLLMProviderId.LM_STUDIO,
                baseUrl: null,
                connectionProbe:
                    OpenAICompatibleConnectionProbe
                        .MODELS
            }),
        [BrokerLLMProviderId.XAI]: profile({
            providerId: BrokerLLMProviderId.XAI,
            baseUrl: "https://api.x.ai/v1",
            connectionProbe:
                OpenAICompatibleConnectionProbe
                    .MODELS
        }),
        [BrokerLLMProviderId.TOGETHER]:
            profile({
                providerId:
                    BrokerLLMProviderId.TOGETHER,
                baseUrl:
                    "https://api.together.ai/v1",
                connectionProbe:
                    OpenAICompatibleConnectionProbe
                        .CHAT_COMPLETION
            }),
        [BrokerLLMProviderId.ZAI]: profile({
            providerId: BrokerLLMProviderId.ZAI,
            baseUrl:
                "https://api.z.ai/api/paas/v4",
            connectionProbe:
                OpenAICompatibleConnectionProbe
                    .CHAT_COMPLETION
        }),
        [BrokerLLMProviderId.HUGGING_FACE]:
            profile({
                providerId:
                    BrokerLLMProviderId.HUGGING_FACE,
                baseUrl:
                    "https://router.huggingface.co/v1",
                connectionProbe:
                    OpenAICompatibleConnectionProbe
                        .CHAT_COMPLETION
            }),
        [BrokerLLMProviderId.OPENROUTER]:
            profile({
                providerId:
                    BrokerLLMProviderId.OPENROUTER,
                baseUrl:
                    "https://openrouter.ai/api/v1",
                connectionProbe:
                    OpenAICompatibleConnectionProbe
                        .CHAT_COMPLETION
            })
    });

export class OpenAICompatibleBroker95LLMAdapterError
    extends BrokerLLMProviderError {

    constructor(source = {}) {
        super(source);
        this.name =
            "OpenAICompatibleBroker95LLMAdapterError";
    }
}

/**
 * Transporte común para proveedores que implementan Chat Completions.
 * Los perfiles remotos tienen un origen fijo; sólo el perfil local obtiene
 * su URL validada desde BrokerConfigurationService.
 */
export class OpenAICompatibleBroker95LLMAdapter
    extends BrokerLLMPort {

    constructor(options = {}) {
        const selectedProfile =
            getOpenAICompatibleBroker95Profile(
                options.providerId
            );

        super({
            providerId:
                selectedProfile.providerId,
            responseValidator:
                options.responseValidator
        });

        this.profile = selectedProfile;
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
            "openAICompatibleFetch"
        );
        this.sseReader = requireSSEReader(
            options.sseReader ?? brokerSSEReader
        );
        this.timeoutMs = requireTimeout(
            options.timeoutMs ??
                DEFAULT_OPENAI_COMPATIBLE_TIMEOUT_MS
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

            requireCompatibleSettings(
                settings,
                this.profile
            );
            const baseUrl = resolveBaseUrl(
                settings,
                this.profile
            );
            const result = request.operation ===
                BrokerLLMOperation.TEST_CONNECTION
                ? await this.#testConnection(
                    settings,
                    baseUrl,
                    execution.signal
                )
                : await this.#createCompletion(
                    request,
                    settings,
                    baseUrl,
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

    async #testConnection(
        settings,
        baseUrl,
        signal
    ) {
        return this.profile.connectionProbe ===
            OpenAICompatibleConnectionProbe
                .CHAT_COMPLETION
            ? this.#testConnectionWithCompletion(
                settings,
                baseUrl,
                signal
            )
            : this.#testConnectionWithModels(
                settings,
                baseUrl,
                signal
            );
    }

    async #testConnectionWithModels(
        settings,
        baseUrl,
        signal
    ) {
        const operation =
            BrokerLLMOperation.TEST_CONNECTION;
        // El catálogo de lenguaje de xAI incluye los alias que no aparecen
        // en la lista simplificada compatible con OpenAI (/models).
        const modelsPath = this.getProviderId() === BrokerLLMProviderId.XAI
            ? "language-models" : "models";
        const connection = await this.#fetch(
            `${baseUrl}/${modelsPath}`,
            {
                method: "GET",
                headers: createHeaders(
                    settings.credential
                )
            },
            signal,
            operation
        );

        try {
            const payload = await readJson(
                connection.response,
                this.getProviderId(),
                operation
            );

            rejectProviderPayload(
                payload,
                this.getProviderId(),
                operation
            );

            if (!modelList(payload, this.getProviderId()).includes(
                settings.model
            )) {
                throw adapterError({
                    providerId:
                        this.getProviderId(),
                    operation,
                    failureKind:
                        BrokerLLMProviderFailureKind
                            .MODEL_UNAVAILABLE,
                    technicalMessage:
                        "The configured model is absent from the OpenAI-compatible model list."
                });
            }

            return createBrokerLLMTransportResult({
                output: JSON.stringify({
                    connected: true,
                    message: this.profile.endpointKind ===
                        BrokerLLMEndpointKind.LOCAL
                        ? "Modelo local disponible."
                        : "Modelo disponible."
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
                operation,
                connection
            );
        } finally {
            connection.dispose();
        }
    }

    async #testConnectionWithCompletion(
        settings,
        baseUrl,
        signal
    ) {
        const operation =
            BrokerLLMOperation.TEST_CONNECTION;
        const connection = await this.#fetch(
            `${baseUrl}/chat/completions`,
            {
                method: "POST",
                headers: createHeaders(
                    settings.credential,
                    true
                ),
                body: JSON.stringify(
                    createOpenAICompatibleConnectionProbePayload(
                        settings.model
                    )
                )
            },
            signal,
            operation
        );

        try {
            const payload = await readJson(
                connection.response,
                this.getProviderId(),
                operation
            );

            rejectProviderPayload(
                payload,
                this.getProviderId(),
                operation
            );
            rejectProviderFinishReason(
                payload,
                this.getProviderId(),
                operation
            );
            if (!hasConnectionProbeCompletion(payload)) {
                throw adapterError({
                    providerId:
                        this.getProviderId(),
                    operation,
                    failureKind:
                        BrokerLLMProviderFailureKind
                            .INVALID_RESPONSE,
                    technicalMessage:
                        "The OpenAI-compatible connection probe returned no completion."
                });
            }

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
                    payload?.request_id,
                    responseIdentifier(
                        connection.response,
                        payload
                    )
                ]
            });
        } catch (error) {
            throw this.#translateReadError(
                error,
                operation,
                connection
            );
        } finally {
            connection.dispose();
        }
    }

    async #createCompletion(
        request,
        settings,
        baseUrl,
        execution
    ) {
        const connection = await this.#fetch(
            `${baseUrl}/chat/completions`,
            {
                method: "POST",
                headers: createHeaders(
                    settings.credential,
                    true
                ),
                body: JSON.stringify(
                    createOpenAICompatibleChatPayload(
                        request,
                        settings.model,
                        this.getProviderId()
                    )
                )
            },
            execution.signal,
            request.operation
        );

        try {
            return request.stream
                ? await this.#readStream(
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
        const payload = await readJson(
            response,
            this.getProviderId(),
            operation
        );

        rejectProviderPayload(
            payload,
            this.getProviderId(),
            operation
        );
        rejectProviderFinishReason(
            payload,
            this.getProviderId(),
            operation
        );
        const choice = payload?.choices?.[0];
        const content = choice?.message?.content;

        if (
            typeof content !== "string" ||
            content.trim().length === 0
        ) {
            throw adapterError({
                providerId:
                    this.getProviderId(),
                operation,
                failureKind:
                    BrokerLLMProviderFailureKind
                        .INVALID_RESPONSE,
                technicalMessage:
                    "The OpenAI-compatible response has no final message content."
            });
        }

        return createBrokerLLMTransportResult({
            output: content,
            model: payload?.model,
            fallbackModel,
            finishReason:
                choice?.finish_reason,
            usage: payload?.usage,
            responseIds: [
                payload?.id,
                responseIdentifier(
                    response,
                    payload
                )
            ]
        });
    }

    async #readStream(
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
                continue;
            }

            const payload = parseBrokerLLMProviderJson(
                event.data,
                {
                    providerId:
                        this.getProviderId(),
                    operation:
                        request.operation,
                    streaming: true
                }
            );

            rejectProviderPayload(
                payload,
                this.getProviderId(),
                request.operation,
                true
            );
            rejectProviderFinishReason(
                payload,
                this.getProviderId(),
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
                completed = true;
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

        if (
            !completed ||
            content.trim().length === 0
        ) {
            throw adapterError({
                providerId:
                    this.getProviderId(),
                operation: request.operation,
                failureKind:
                    BrokerLLMProviderFailureKind
                        .INVALID_STREAM,
                technicalMessage:
                    "The OpenAI-compatible stream ended before a complete response."
            });
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
                redirect: "error",
                signal: scope.signal
            });

            if (!response?.ok) {
                const status = Number.isInteger(
                    response?.status
                )
                    ? response.status
                    : 0;
                const error = providerHttpError(
                    this.getProviderId(),
                    operation,
                    status,
                    await readProviderError(
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
                error instanceof
                    BrokerLLMProviderError ||
                error instanceof
                    BrokerLLMProtocolError
            ) {
                throw error;
            }

            if (parentSignal?.aborted) {
                throw BrokerLLMProtocolError
                    .aborted(operation);
            }

            const translated = adapterError({
                providerId:
                    this.getProviderId(),
                operation,
                failureKind: scope.timedOut()
                    ? BrokerLLMProviderFailureKind
                        .TIMEOUT
                    : BrokerLLMProviderFailureKind
                        .NETWORK,
                technicalMessage: scope.timedOut()
                    ? "The OpenAI-compatible request timed out."
                    : "The OpenAI-compatible network request failed.",
                cause: error
            });

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
        if (connection.signal?.aborted) {
            return connection.timedOut()
                ? adapterError({
                    providerId:
                        this.getProviderId(),
                    operation,
                    failureKind:
                        BrokerLLMProviderFailureKind
                            .TIMEOUT,
                    technicalMessage:
                        "The OpenAI-compatible stream timed out."
                })
                : BrokerLLMProtocolError
                    .aborted(operation);
        }

        if (
            error instanceof
                BrokerLLMProviderError ||
            error instanceof
                BrokerLLMProtocolError
        ) {
            return error;
        }

        return adapterError({
            providerId:
                this.getProviderId(),
            operation,
            failureKind:
                error instanceof
                    BrokerSSEReaderError
                    ? BrokerLLMProviderFailureKind
                        .INVALID_STREAM
                    : BrokerLLMProviderFailureKind
                        .STREAM_FAILED,
            technicalMessage:
                "The OpenAI-compatible stream failed.",
            cause: error
        });
    }

    #translateReadError(
        error,
        operation,
        connection
    ) {
        if (connection.signal?.aborted) {
            return connection.timedOut()
                ? adapterError({
                    providerId:
                        this.getProviderId(),
                    operation,
                    failureKind:
                        BrokerLLMProviderFailureKind
                            .TIMEOUT,
                    technicalMessage:
                        "The OpenAI-compatible response timed out."
                })
                : BrokerLLMProtocolError
                    .aborted(operation);
        }

        if (
            error instanceof
                BrokerLLMProviderError ||
            error instanceof
                BrokerLLMProtocolError
        ) {
            return error;
        }

        return adapterError({
            providerId:
                this.getProviderId(),
            operation,
            failureKind:
                BrokerLLMProviderFailureKind
                    .INVALID_RESPONSE,
            technicalMessage:
                "The OpenAI-compatible response could not be read.",
            cause: error
        });
    }

    #log(error, operation, status = null) {
        try {
            this.developerLogger.error?.(
                "BROKER.95 OpenAI-compatible adapter request failed.",
                {
                    providerId:
                        this.getProviderId(),
                    code: error.code,
                    operation,
                    ...(status == null
                        ? {}
                        : { status })
                }
            );
        } catch {
            // Un logger defectuoso no altera la operación.
        }
    }
}

export function getOpenAICompatibleBroker95Profile(
    providerId
) {
    const selected =
        OPENAI_COMPATIBLE_PROVIDER_PROFILES[
            providerId
        ];

    if (!selected) {
        throw BrokerLLMProtocolError
            .invalidRequest("providerId");
    }

    return selected;
}

export function createOpenAICompatibleChatPayload(
    request,
    model,
    providerId = null
) {
    return Object.freeze({
        model,
        messages: Object.freeze([
            Object.freeze({
                role: "system",
                content:
                    createBrokerLLMSystemInstruction(
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
                content:
                    createBrokerLLMOperationMessage(
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
        max_tokens:
            brokerLLMCompletionTokenBudget(
                request.operation
            ),
        ...(providerId === BrokerLLMProviderId.OPENROUTER &&
            request.responseFormat !== BrokerLLMResponseFormat.TEXT
            ? { provider: Object.freeze({ require_parameters: true }) }
            : {}),
        ...(request.stream && [
            BrokerLLMProviderId.HUGGING_FACE,
            BrokerLLMProviderId.OPENROUTER
        ].includes(providerId)
            ? { stream_options: Object.freeze({ include_usage: true }) }
            : {}),
        stream: request.stream
    });
}

export function createOpenAICompatibleConnectionProbePayload(
    model
) {
    if (
        typeof model !== "string" ||
        model.trim().length === 0 ||
        model.length > 256 ||
        /[\u0000-\u001F\u007F]/u.test(model)
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("model");
    }
    const normalized = model.trim();

    return Object.freeze({
        model: normalized,
        messages: Object.freeze([
            Object.freeze({
                role: "user",
                content: "Responde únicamente con OK."
            })
        ]),
        // Algunos destinos de OpenRouter exigen un mínimo de 16 tokens.
        // Conserva una sonda breve compatible con ese límite.
        max_tokens: 32,
        stream: false
    });
}

function hasConnectionProbeCompletion(payload) {
    const choice = payload?.choices?.[0];
    const message = choice?.message;

    if (
        typeof message?.content === "string" &&
        message.content.trim().length > 0
    ) {
        return true;
    }

    // Una sonda breve puede agotar sus tokens durante el razonamiento.
    // Confirma transporte y acceso sin exigir ni exponer una respuesta final.
    return choice?.finish_reason === "length" &&
        message?.role === "assistant" &&
        Number.isSafeInteger(
            payload?.usage?.completion_tokens
        ) &&
        payload.usage.completion_tokens > 0;
}

function profile({
    providerId,
    baseUrl,
    connectionProbe
}) {
    const descriptor =
        getBrokerLLMProviderDescriptor(
            providerId
        );

    if (
        descriptor.endpointKind ===
            BrokerLLMEndpointKind.LOCAL &&
        baseUrl != null
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("profile.baseUrl");
    }

    return Object.freeze({
        providerId,
        credentialKind:
            descriptor.credentialKind,
        endpointKind:
            descriptor.endpointKind,
        baseUrl: baseUrl == null
            ? null
            : requireRemoteBaseUrl(baseUrl),
        connectionProbe:
            requireConnectionProbe(
                connectionProbe
            )
    });
}

function resolveBaseUrl(settings, selectedProfile) {
    return selectedProfile.endpointKind ===
        BrokerLLMEndpointKind.LOCAL
        ? normalizeBrokerLocalLlmBaseUrl(
            settings.baseUrl
        )
        : selectedProfile.baseUrl;
}

function requireCompatibleSettings(
    settings,
    selectedProfile
) {
    const credential = settings?.credential;
    const optionalCredential =
        selectedProfile.credentialKind ===
            BrokerLLMCredentialKind
                .OPTIONAL_API_KEY;
    const validValue =
        typeof credential?.value === "string" &&
        credential.value.length > 0;

    if (
        settings?.providerId !==
            selectedProfile.providerId ||
        credential?.providerId !==
            selectedProfile.providerId ||
        credential?.kind !==
            selectedProfile.credentialKind ||
        (
            optionalCredential
                ? Object.hasOwn(
                    credential,
                    "value"
                ) && !validValue
                : !validValue
        ) ||
        typeof settings?.model !== "string" ||
        settings.model.trim().length === 0
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("credential");
    }

    if (
        selectedProfile.endpointKind ===
            BrokerLLMEndpointKind.LOCAL
    ) {
        normalizeBrokerLocalLlmBaseUrl(
            settings.baseUrl
        );
    }
}

function createHeaders(
    credential,
    json = false
) {
    const value = credential?.value;

    return Object.freeze({
        ...(typeof value === "string" &&
            value.length > 0
            ? {
                Authorization:
                    `Bearer ${value}`
            }
            : {}),
        ...(json
            ? {
                "Content-Type":
                    "application/json"
            }
            : {})
    });
}

async function readJson(
    response,
    providerId,
    operation
) {
    try {
        const source = await response.text();

        if (
            typeof source !== "string" ||
            source.length === 0 ||
            source.length >
                MAX_OPENAI_COMPATIBLE_JSON_CHARACTERS
        ) {
            throw new TypeError(
                "The OpenAI-compatible JSON response has an invalid length."
            );
        }

        return parseBrokerLLMProviderJson(
            source,
            { providerId, operation }
        );
    } catch (error) {
        if (
            error instanceof
                BrokerLLMProviderError
        ) {
            throw error;
        }

        throw adapterError({
            providerId,
            operation,
            failureKind:
                BrokerLLMProviderFailureKind
                    .INVALID_RESPONSE,
            technicalMessage:
                "The OpenAI-compatible provider returned invalid JSON.",
            cause: error
        });
    }
}

function rejectProviderPayload(
    payload,
    providerId,
    operation,
    streaming = false
) {
    const providerError = payload?.error ??
        (providerId ===
            BrokerLLMProviderId.OPENROUTER
            ? payload?.choices?.find(
                choice => choice?.error != null
            )?.error
            : null);

    if (providerError == null) {
        return;
    }

    const classified = classifyProviderError(
        providerId,
        providerError
    );

    throw adapterError({
        providerId,
        operation,
        failureKind: streaming
            ? BrokerLLMProviderFailureKind
                .STREAM_FAILED
            : classified.failureKind,
        status: classified.status,
        technicalMessage:
            "The OpenAI-compatible provider returned an error payload."
    });
}

function rejectProviderFinishReason(
    payload,
    providerId,
    operation,
    streaming = false
) {
    if (providerId !== BrokerLLMProviderId.ZAI) {
        return;
    }

    const finishReason =
        payload?.choices?.[0]?.finish_reason;

    if (!["sensitive", "model_context_window_exceeded", "network_error"]
        .includes(finishReason)) {
        return;
    }

    throw adapterError({
        providerId,
        operation,
        failureKind: finishReason === "network_error"
            ? BrokerLLMProviderFailureKind.NETWORK
            : streaming
                ? BrokerLLMProviderFailureKind.STREAM_FAILED
                : BrokerLLMProviderFailureKind.PROVIDER,
        technicalMessage:
            `Z.AI ended the completion with ${finishReason}.`
    });
}

function modelList(payload, providerId) {
    // xAI /language-models incluye alias en { models: [...] }; Together
    // publica un array o { data: [...] }, y LM Studio usa { data: [...] }.
    const models = providerId === BrokerLLMProviderId.XAI
        ? payload?.models
        : providerId === BrokerLLMProviderId.TOGETHER && Array.isArray(payload)
            ? payload : payload?.data;
    if (
        !Array.isArray(models) ||
        models.length > 4_096
    ) {
        throw BrokerLLMProtocolError
            .invalidResponse("models");
    }

    return models
        .flatMap(model => [
            model?.id,
            ...(Array.isArray(model?.aliases)
                ? model.aliases
                : [])
        ])
        .filter(model =>
            typeof model === "string" &&
            model.length > 0 &&
            model.length <= 256 &&
            !/[\u0000-\u001F\u007F]/u
                .test(model)
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

function providerHttpError(
    providerId,
    operation,
    status,
    providerError = null
) {
    const classified = classifyProviderError(
        providerId,
        providerError,
        status
    );

    return adapterError({
        providerId,
        operation,
        failureKind: classified.failureKind,
        status,
        technicalMessage:
            `OpenAI-compatible request failed with HTTP ${status}.`
    });
}

function classifyProviderError(
    providerId,
    providerError,
    httpStatus = null
) {
    const code = providerError?.code;

    if (providerId === BrokerLLMProviderId.ZAI) {
        const businessCode = Number(code);

        if (businessCode >= 1000 && businessCode <= 1004) {
            return Object.freeze({
                failureKind:
                    BrokerLLMProviderFailureKind
                        .AUTHENTICATION,
                status: normalizeProviderStatus(httpStatus)
            });
        }

        if (businessCode === 1113) {
            return Object.freeze({
                failureKind:
                    BrokerLLMProviderFailureKind.QUOTA,
                status: normalizeProviderStatus(httpStatus)
            });
        }

        if (businessCode === 1211) {
            return Object.freeze({
                failureKind:
                    BrokerLLMProviderFailureKind
                        .MODEL_UNAVAILABLE,
                status: normalizeProviderStatus(httpStatus)
            });
        }
    }

    const status = normalizeProviderStatus(
        httpStatus ?? code
    );
    let failureKind;

    switch (status) {
        case 401:
            failureKind =
                BrokerLLMProviderFailureKind
                    .AUTHENTICATION;
            break;

        case 403:
            failureKind = [
                BrokerLLMProviderId.OPENROUTER,
                BrokerLLMProviderId.TOGETHER
            ].includes(providerId)
                ? BrokerLLMProviderFailureKind
                    .PROVIDER
                : BrokerLLMProviderFailureKind
                    .AUTHENTICATION;
            break;

        case 402:
        case 429:
            failureKind =
                BrokerLLMProviderFailureKind
                    .QUOTA;
            break;

        case 404:
            failureKind =
                BrokerLLMProviderFailureKind
                    .MODEL_UNAVAILABLE;
            break;

        default:
            failureKind = status == null
                ? BrokerLLMProviderFailureKind
                    .PROVIDER
                : BrokerLLMProviderFailureKind.HTTP;
            break;
    }

    return Object.freeze({
        failureKind,
        status
    });
}

async function readProviderError(response) {
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

        const payload = JSON.parse(source);

        return payload?.error != null &&
            typeof payload.error === "object"
            ? Object.freeze({
                code: payload.error.code,
                type: payload.error.type
            })
            : null;
    } catch {
        return null;
    }
}

function normalizeProviderStatus(value) {
    const status = Number(value);

    return Number.isInteger(status) &&
        status >= 100 &&
        status <= 599
        ? status
        : null;
}

function adapterError(source) {
    return new OpenAICompatibleBroker95LLMAdapterError(
        source
    );
}

function requireRemoteBaseUrl(value) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > 2_048
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("profile.baseUrl");
    }

    try {
        const url = new URL(value);

        if (
            url.protocol !== "https:" ||
            url.username.length > 0 ||
            url.password.length > 0 ||
            url.search.length > 0 ||
            url.hash.length > 0
        ) {
            throw new TypeError(
                "Remote provider URL must be HTTPS."
            );
        }

        return url.toString()
            .replace(/\/+$/u, "");
    } catch {
        throw BrokerLLMProtocolError
            .invalidRequest("profile.baseUrl");
    }
}

function requireConnectionProbe(value) {
    if (
        !Object.values(
            OpenAICompatibleConnectionProbe
        ).includes(value)
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest(
                "profile.connectionProbe"
            );
    }

    return value;
}

function requireSSEReader(value) {
    if (
        value == null ||
        typeof value.read !== "function"
    ) {
        throw BrokerLLMProtocolError
            .invalidPort();
    }

    return value;
}

function requireTimeout(value) {
    if (
        !Number.isSafeInteger(value) ||
        value < 1 ||
        value > 3_600_000
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("timeoutMs");
    }

    return value;
}

function createAbortScope(
    parentSignal,
    timeoutMs
) {
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
