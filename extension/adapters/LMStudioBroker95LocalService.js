import {
    requireFunction,
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    BrokerLLMCredentialKind,
    BrokerLLMProviderError,
    BrokerLLMProviderFailureKind,
    BrokerLLMProviderId,
    BrokerLLMProtocolError,
    normalizeBrokerLocalLlmBaseUrl
} from "../../src/broker95/llm/index.js";

export const DEFAULT_LM_STUDIO_DISCOVERY_TIMEOUT_MS =
    10_000;
export const MAX_LM_STUDIO_DISCOVERED_MODELS = 512;

/**
 * Canal local y acotado para descubrir los modelos visibles mediante la
 * API OpenAI-compatible de LM Studio. No carga, descarga ni elimina modelos.
 */
export class LMStudioBroker95LocalService {

    constructor(options = {}) {
        this.configurationService = requirePort(
            options.configurationService,
            "brokerConfigurationService",
            ["resolvePrivateLlmEndpointSettings"]
        );
        this.fetch = requireFunction(
            options.fetch ?? globalThis.fetch,
            "lmStudioFetch"
        );
        this.timeoutMs = requireTimeout(
            options.timeoutMs ??
                DEFAULT_LM_STUDIO_DISCOVERY_TIMEOUT_MS
        );
        this.developerLogger =
            options.developerLogger ?? console;
    }

    async discoverModels(execution = {}) {
        const parentSignal = requireExecution(
            execution
        );
        const settings = await this
            .configurationService
            .resolvePrivateLlmEndpointSettings(
                BrokerLLMProviderId.LM_STUDIO
            );

        requireLMStudioSettings(settings);

        const baseUrl =
            normalizeBrokerLocalLlmBaseUrl(
                settings.baseUrl
            );
        const scope = createAbortScope(
            parentSignal,
            this.timeoutMs
        );
        const operation = "discoverModels";

        try {
            const response = await this.fetch(
                `${baseUrl}/models`,
                {
                    method: "GET",
                    headers: createHeaders(
                        settings.credential
                    ),
                    redirect: "error",
                    signal: scope.signal
                }
            );

            if (!response?.ok) {
                throw httpError(
                    Number.isInteger(response?.status)
                        ? response.status
                        : 0,
                    operation
                );
            }

            const payload = await readPayload(
                response,
                operation
            );
            const models = normalizeModels(
                payload,
                operation
            );

            return Object.freeze({
                providerId:
                    BrokerLLMProviderId.LM_STUDIO,
                baseUrl,
                models
            });
        } catch (error) {
            const translated = translateError(
                error,
                operation,
                parentSignal,
                scope
            );

            this.#log(translated);
            throw translated;
        } finally {
            scope.dispose();
        }
    }

    #log(error) {
        try {
            this.developerLogger.error?.(
                "BROKER.95 LM Studio model discovery failed.",
                {
                    providerId:
                        BrokerLLMProviderId.LM_STUDIO,
                    code: error?.code ?? null,
                    status: error?.httpStatus ?? null
                }
            );
        } catch {
            // Un logger defectuoso no altera el resultado local.
        }
    }
}

export function normalizeLMStudioModelCatalog(
    payload
) {
    return normalizeModels(payload, "discoverModels");
}

function requireLMStudioSettings(settings) {
    const credential = settings?.credential;

    if (
        settings?.providerId !==
            BrokerLLMProviderId.LM_STUDIO ||
        credential?.providerId !==
            BrokerLLMProviderId.LM_STUDIO ||
        credential?.kind !==
            BrokerLLMCredentialKind.OPTIONAL_API_KEY ||
        (
            Object.hasOwn(credential, "value") &&
            (
                typeof credential.value !== "string" ||
                credential.value.length === 0
            )
        )
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("lmStudioSettings");
    }

    normalizeBrokerLocalLlmBaseUrl(
        settings.baseUrl
    );
}

function createHeaders(credential) {
    return Object.freeze({
        ...(typeof credential?.value === "string"
            ? {
                Authorization:
                    `Bearer ${credential.value}`
            }
            : {})
    });
}

async function readPayload(response, operation) {
    try {
        const text = await response.text();

        if (
            typeof text !== "string" ||
            text.length === 0 ||
            text.length > 1_048_576
        ) {
            throw new TypeError(
                "Invalid LM Studio response length."
            );
        }

        return JSON.parse(text);
    } catch (cause) {
        throw providerError({
            operation,
            failureKind:
                BrokerLLMProviderFailureKind
                    .INVALID_RESPONSE,
            publicMessage:
                "LM Studio devolvió una lista de modelos que no pudo procesarse.",
            technicalMessage:
                "LM Studio returned an invalid model catalog.",
            cause
        });
    }
}

function normalizeModels(payload, operation) {
    if (
        payload == null ||
        typeof payload !== "object" ||
        Array.isArray(payload) ||
        payload.error != null ||
        !Array.isArray(payload.data) ||
        payload.data.length >
            MAX_LM_STUDIO_DISCOVERED_MODELS
    ) {
        invalidCatalog(operation);
    }

    const seen = new Set();
    const models = [];

    for (const entry of payload.data) {
        const id = entry?.id;

        if (
            typeof id !== "string" ||
            id.trim().length === 0 ||
            id.length > 256 ||
            /[\u0000-\u001F\u007F]/u.test(id)
        ) {
            invalidCatalog(operation);
        }

        const normalized = id.trim();

        if (!seen.has(normalized)) {
            seen.add(normalized);
            models.push(normalized);
        }
    }

    return Object.freeze(models);
}

function invalidCatalog(operation) {
    throw providerError({
        operation,
        failureKind:
            BrokerLLMProviderFailureKind
                .INVALID_RESPONSE,
        publicMessage:
            "LM Studio devolvió una lista de modelos que no pudo procesarse.",
        technicalMessage:
            "LM Studio returned a malformed model catalog."
    });
}

function httpError(status, operation) {
    const authentication =
        status === 401 || status === 403;

    return providerError({
        operation,
        status,
        failureKind: authentication
            ? BrokerLLMProviderFailureKind
                .AUTHENTICATION
            : BrokerLLMProviderFailureKind.HTTP,
        publicMessage: authentication
            ? "LM Studio rechazó el token local. Comprueba el token configurado en el servidor."
            : status === 404
                ? "El servidor local no expone la API OpenAI-compatible de LM Studio en esa URL."
                : "LM Studio no pudo devolver sus modelos disponibles.",
        technicalMessage:
            `LM Studio model discovery failed with HTTP ${status}.`
    });
}

function translateError(
    error,
    operation,
    parentSignal,
    scope
) {
    if (
        error instanceof BrokerLLMProviderError ||
        error instanceof BrokerLLMProtocolError
    ) {
        return error;
    }

    if (parentSignal?.aborted) {
        return BrokerLLMProtocolError
            .aborted(operation);
    }

    if (scope.timedOut()) {
        return providerError({
            operation,
            failureKind:
                BrokerLLMProviderFailureKind.TIMEOUT,
            publicMessage:
                "LM Studio tardó demasiado en responder. Comprueba que su servidor local esté activo.",
            technicalMessage:
                "LM Studio model discovery timed out.",
            cause: error
        });
    }

    return providerError({
        operation,
        failureKind:
            BrokerLLMProviderFailureKind.NETWORK,
        publicMessage:
            "No se encontró el servidor local de LM Studio. Inícialo desde Developer o con «lms server start».",
        technicalMessage:
            "LM Studio local server is unreachable.",
        cause: error
    });
}

function providerError(source) {
    return new BrokerLLMProviderError({
        providerId: BrokerLLMProviderId.LM_STUDIO,
        ...source
    });
}

function requireExecution(value) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).some(
            key => key !== "signal"
        )
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("execution");
    }

    const signal = value.signal ?? null;

    if (
        signal != null &&
        (
            typeof signal !== "object" ||
            typeof signal.aborted !== "boolean" ||
            typeof signal.addEventListener !==
                "function"
        )
    ) {
        throw BrokerLLMProtocolError
            .invalidRequest("execution.signal");
    }

    return signal;
}

function requireTimeout(value) {
    if (
        !Number.isSafeInteger(value) ||
        value < 1 ||
        value > 60_000
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

    parentSignal?.addEventListener?.(
        "abort",
        abortFromParent,
        { once: true }
    );

    if (parentSignal?.aborted) {
        abortFromParent();
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
