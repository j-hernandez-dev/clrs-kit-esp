import {
    BrokerLLMProtocolError
} from "./BrokerLLMProtocol.js";
import {
    BrokerLLMProviderId,
    normalizeBrokerLLMProviderId
} from "./BrokerLLMProvider.js";

export const BROKER_DEFAULT_LOCAL_LLM_BASE_URLS =
    Object.freeze({
        [BrokerLLMProviderId.OLLAMA]:
            "http://127.0.0.1:11434/api",
        [BrokerLLMProviderId.LM_STUDIO]:
            "http://127.0.0.1:1234/v1"
    });

export function getBrokerDefaultLocalLlmBaseUrl(
    providerId
) {
    const selected = normalizeBrokerLLMProviderId(
        providerId
    );

    return BROKER_DEFAULT_LOCAL_LLM_BASE_URLS[
        selected
    ] ?? null;
}

/**
 * Las URL configurables pertenecen exclusivamente a motores locales.
 * Se excluyen credenciales, consultas, fragmentos y hosts que puedan
 * convertir al Extension Host en un cliente involuntario de otra red.
 */
export function normalizeBrokerLocalLlmBaseUrl(
    value
) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > 2_048 ||
        /[\u0000-\u0020\u007F]/u.test(value)
    ) {
        invalidEndpoint();
    }

    let url;

    try {
        url = new URL(value);
    } catch {
        invalidEndpoint();
    }

    if (
        url.protocol !== "http:" ||
        !isLoopbackHost(url.hostname) ||
        url.port.length === 0 ||
        url.username.length > 0 ||
        url.password.length > 0 ||
        url.search.length > 0 ||
        url.hash.length > 0
    ) {
        invalidEndpoint();
    }

    const pathname = url.pathname.replace(
        /\/+$/u,
        ""
    );

    return `${url.origin}${pathname}`;
}

function isLoopbackHost(hostname) {
    return hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "[::1]";
}

function invalidEndpoint() {
    throw BrokerLLMProtocolError
        .invalidRequest("baseUrl");
}
