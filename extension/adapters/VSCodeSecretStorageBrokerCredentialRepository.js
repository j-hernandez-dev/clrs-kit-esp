import {
    requirePort
} from "../../src/application/ports/ApplicationPorts.js";
import {
    BrokerLLMProviderId,
    normalizeBrokerLLMCredentialValue,
    normalizeBrokerLLMProviderId
} from "../../src/broker95/llm/index.js";

export const BROKER95_PROVIDER_API_KEY_SECRET_PREFIX =
    "broker95.llm.credentials";

export const BROKER95_GROQ_API_KEY_SECRET =
    createBroker95ProviderApiKeySecret(
        BrokerLLMProviderId.GROQ
    );

export function createBroker95ProviderApiKeySecret(
    providerId,
    prefix =
        BROKER95_PROVIDER_API_KEY_SECRET_PREFIX
) {
    const selected =
        normalizeBrokerLLMProviderId(
            providerId
        );

    if (
        typeof prefix !== "string" ||
        prefix.trim().length === 0 ||
        /[\u0000-\u001F\u007F]/u.test(prefix)
    ) {
        throw new TypeError(
            "BROKER.95 credential prefix is invalid."
        );
    }

    return `${prefix.trim()}.${selected}.apiKey`;
}

export class VSCodeSecretStorageBrokerCredentialRepository {

    constructor(secretStorage, options = {}) {
        this.secretStorage = requirePort(
            secretStorage,
            "extensionContext.secrets",
            ["get", "store", "delete"]
        );
        this.secretPrefix =
            options.secretPrefix ??
            BROKER95_PROVIDER_API_KEY_SECRET_PREFIX;
    }

    async has(providerId) {
        return (
            await this.read(providerId)
        ) != null;
    }

    async read(providerId) {
        const selected =
            normalizeBrokerLLMProviderId(
                providerId
            );
        const value = await this.secretStorage.get(
            this.#secretKey(selected)
        );

        return value == null
            ? undefined
            : normalizeBrokerLLMCredentialValue(
                value
            );
    }

    async write(providerId, apiKey) {
        const selected =
            normalizeBrokerLLMProviderId(
                providerId
            );

        await this.secretStorage.store(
            this.#secretKey(selected),
            normalizeBrokerLLMCredentialValue(
                apiKey
            )
        );

    }

    async delete(providerId) {
        const selected =
            normalizeBrokerLLMProviderId(
                providerId
            );

        await this.secretStorage.delete(
            this.#secretKey(selected)
        );

    }

    #secretKey(providerId) {
        return createBroker95ProviderApiKeySecret(
            providerId,
            this.secretPrefix
        );
    }

}
