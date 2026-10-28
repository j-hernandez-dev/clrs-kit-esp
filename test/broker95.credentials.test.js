import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER95_GROQ_API_KEY_SECRET,
    VSCodeSecretStorageBrokerCredentialRepository,
    createBroker95ProviderApiKeySecret
} from "../extension/adapters/VSCodeSecretStorageBrokerCredentialRepository.js";
import {
    BrokerLLMCredentialKind,
    createBrokerLLMCredential,
    createBrokerPublicCredentialState
} from "../src/broker95/llm/index.js";

test(
    "separa la credencial privada de su estado público",
    () => {
        const secret = "credencial-super-secreta";
        const credential =
            createBrokerLLMCredential(
                "groq",
                secret
            );
        const publicState =
            createBrokerPublicCredentialState(
                "groq",
                true
            );

        assert.deepEqual(credential, {
            providerId: "groq",
            kind: "api-key",
            value: secret
        });
        assert.deepEqual(publicState, {
            kind: "api-key",
            required: true,
            configured: true
        });
        assert.equal(
            JSON.stringify(publicState)
                .includes(secret),
            false
        );
        assert.equal(Object.isFrozen(credential), true);
        assert.equal(Object.isFrozen(publicState), true);
    }
);

test(
    "permite el token opcional de LM Studio sin convertirlo en requisito",
    () => {
        assert.deepEqual(
            createBrokerLLMCredential(
                "lm-studio"
            ),
            {
                providerId: "lm-studio",
                kind:
                    BrokerLLMCredentialKind
                        .OPTIONAL_API_KEY
            }
        );
        assert.deepEqual(
            createBrokerPublicCredentialState(
                "lm-studio",
                false
            ),
            {
                kind: "optional-api-key",
                required: false,
                configured: false
            }
        );
    }
);

test(
    "almacena claves de proveedores distintos en espacios aislados",
    async () => {
        const secrets = new FakeSecrets();
        const repository =
            new VSCodeSecretStorageBrokerCredentialRepository(
                secrets,
                { developerLogger: silentLogger() }
            );

        const credentials = {
            groq: "clave-groq",
            gemini: "clave-gemini",
            deepseek: "clave-deepseek",
            "lm-studio": "token-lm-studio",
            xai: "clave-xai",
            together: "clave-together",
            zai: "clave-zai",
            "hugging-face": "hf_token_prueba",
            openrouter: "clave-openrouter"
        };

        for (const [providerId, credential] of
            Object.entries(credentials)) {
            await repository.write(
                providerId,
                credential
            );
        }

        assert.equal(
            await repository.read("groq"),
            "clave-groq"
        );
        assert.equal(
            await repository.read("gemini"),
            "clave-gemini"
        );
        assert.equal(
            await repository.read("deepseek"),
            "clave-deepseek"
        );
        assert.equal(
            await repository.read("lm-studio"),
            "token-lm-studio"
        );
        assert.equal(
            secrets.values.get(
                BROKER95_GROQ_API_KEY_SECRET
            ),
            "clave-groq"
        );
        assert.equal(
            secrets.values.get(
                createBroker95ProviderApiKeySecret(
                    "gemini"
                )
            ),
            "clave-gemini"
        );
        assert.equal(
            secrets.values.get(
                createBroker95ProviderApiKeySecret(
                    "deepseek"
                )
            ),
            "clave-deepseek"
        );

        for (const [providerId, credential] of
            Object.entries(credentials)) {
            assert.equal(
                secrets.values.get(
                    createBroker95ProviderApiKeySecret(
                        providerId
                    )
                ),
                credential
            );
        }

        await repository.delete("groq");

        assert.equal(
            await repository.has("groq"),
            false
        );
        assert.equal(
            await repository.has("gemini"),
            true
        );
        assert.equal(
            await repository.has("deepseek"),
            true
        );
        assert.equal(
            await repository.has("xai"),
            true
        );
    }
);

test(
    "ignora una clave global obsoleta sin copiarla al proveedor",
    async () => {
        const secrets = new FakeSecrets({
            "broker95.llm.apiKey":
                "clave-obsoleta"
        });
        const repository =
            new VSCodeSecretStorageBrokerCredentialRepository(
                secrets,
                { developerLogger: silentLogger() }
            );

        assert.equal(
            await repository.has("groq"),
            false
        );
        assert.equal(
            await repository.read("groq"),
            undefined
        );
        assert.equal(
            secrets.values.has(
                "broker95.llm.apiKey"
            ),
            true
        );
    }
);

test(
    "lee exclusivamente la credencial específica del proveedor",
    async () => {
        const secrets = new FakeSecrets({
            "broker95.llm.apiKey":
                "clave-obsoleta",
            [BROKER95_GROQ_API_KEY_SECRET]:
                "clave-actual"
        });
        const repository =
            new VSCodeSecretStorageBrokerCredentialRepository(
                secrets,
                { developerLogger: silentLogger() }
            );

        assert.equal(
            await repository.read("groq"),
            "clave-actual"
        );
        assert.equal(
            secrets.values.has(
                "broker95.llm.apiKey"
            ),
            true
        );
    }
);

test(
    "rechaza una credencial persistida que ya no cumple el contrato seguro",
    async () => {
        const secretKey =
            createBroker95ProviderApiKeySecret(
                "openrouter"
            );
        const repository =
            new VSCodeSecretStorageBrokerCredentialRepository(
                new FakeSecrets({
                    [secretKey]:
                        "credencial con espacios"
                }),
                { developerLogger: silentLogger() }
            );

        await assert.rejects(
            repository.read("openrouter"),
            error => error.code ===
                "BROKER95_LLM_REQUEST_INVALID"
        );
    }
);

test(
    "rechaza identificadores y valores inválidos sin revelar el secreto",
    async () => {
        const leaked = "SECRETO CON ESPACIOS";

        assert.throws(
            () => createBrokerLLMCredential(
                "groq",
                leaked
            ),
            error =>
                error.code ===
                    "BROKER95_LLM_REQUEST_INVALID" &&
                !JSON.stringify(error)
                    .includes(leaked)
        );
        assert.throws(
            () => createBroker95ProviderApiKeySecret(
                "PROVEEDOR INVALIDO"
            ),
            error =>
                error.code ===
                    "BROKER95_LLM_REQUEST_INVALID"
        );

        const repository =
            new VSCodeSecretStorageBrokerCredentialRepository(
                new FakeSecrets(),
                { developerLogger: silentLogger() }
            );

        await assert.rejects(
            repository.write("xai", leaked),
            error =>
                error.code ===
                    "BROKER95_LLM_REQUEST_INVALID" &&
                !JSON.stringify(error)
                    .includes(leaked)
        );
    }
);

class FakeSecrets {

    constructor(initial = {}) {
        this.values = new Map(
            Object.entries(initial)
        );
    }

    async get(key) {
        return this.values.get(key);
    }

    async store(key, value) {
        this.values.set(key, value);
    }

    async delete(key) {
        this.values.delete(key);
    }
}

function silentLogger() {
    return Object.freeze({
        warn() {}
    });
}
