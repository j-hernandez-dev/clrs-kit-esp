import {
    BrokerLLMProtocolError
} from "./BrokerLLMProtocol.js";
import {
    BrokerLLMCredentialKind,
    createBrokerLLMProviderDescriptor,
    getBrokerLLMProviderDescriptor
} from "./BrokerLLMProvider.js";

export function createBrokerLLMCredential(
    providerId,
    value,
    descriptorSource = null
) {
    const descriptor =
        resolveProviderDescriptor(
            providerId,
            descriptorSource
        );

    if (
        descriptor.credentialKind ===
        BrokerLLMCredentialKind.NONE
    ) {
        if (value != null) {
            invalidCredential("value");
        }

        return Object.freeze({
            providerId: descriptor.id,
            kind: descriptor.credentialKind
        });
    }

    if (
        descriptor.credentialKind ===
            BrokerLLMCredentialKind
                .OPTIONAL_API_KEY &&
        value == null
    ) {
        return Object.freeze({
            providerId: descriptor.id,
            kind: descriptor.credentialKind
        });
    }

    return Object.freeze({
        providerId: descriptor.id,
        kind: descriptor.credentialKind,
        value: normalizeBrokerLLMCredentialValue(
            value
        )
    });
}

export function createBrokerPublicCredentialState(
    providerId,
    configured,
    descriptorSource = null
) {
    const descriptor =
        resolveProviderDescriptor(
            providerId,
            descriptorSource
        );

    if (typeof configured !== "boolean") {
        invalidCredential("configured");
    }

    const required =
        descriptor.credentialKind ===
        BrokerLLMCredentialKind.API_KEY;
    const supported =
        descriptor.credentialKind !==
        BrokerLLMCredentialKind.NONE;

    return Object.freeze({
        kind: descriptor.credentialKind,
        required,
        configured: supported
            ? configured
            : true
    });
}

export function normalizeBrokerLLMCredentialValue(
    value
) {
    if (typeof value !== "string") {
        invalidCredential("value");
    }

    const credential = value.trim();

    if (
        credential.length === 0 ||
        credential.length > 16_384 ||
        /[\u0000-\u0020\u007F]/u.test(
            credential
        )
    ) {
        invalidCredential("value");
    }

    return credential;
}

function invalidCredential(field) {
    throw BrokerLLMProtocolError
        .invalidRequest(
            `credential.${field}`
        );
}

function resolveProviderDescriptor(
    providerId,
    descriptorSource
) {
    const descriptor = descriptorSource == null
        ? getBrokerLLMProviderDescriptor(
            providerId
        )
        : createBrokerLLMProviderDescriptor(
            descriptorSource
        );

    if (descriptor?.id !== providerId) {
        invalidCredential("providerId");
    }

    return descriptor;
}
