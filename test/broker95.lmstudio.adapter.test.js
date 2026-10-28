import assert from "node:assert/strict";
import test from "node:test";

import {
    LMStudioBroker95LocalService,
    MAX_LM_STUDIO_DISCOVERED_MODELS,
    normalizeLMStudioModelCatalog
} from "../extension/adapters/LMStudioBroker95LocalService.js";

test("descubre modelos locales sin exigir un modelo previamente configurado", async () => {
    const calls = [];
    const service = createService({
        model: "",
        fetch: async (url, init) => {
            calls.push({ url, init });
            return jsonResponse({
                object: "list",
                data: [
                    { id: "qwen/qwen3-8b" },
                    { id: "meta/llama-3.2" }
                ]
            });
        }
    });

    const result = await service.discoverModels();

    assert.deepEqual(result, {
        providerId: "lm-studio",
        baseUrl: "http://127.0.0.1:1234/v1",
        models: [
            "qwen/qwen3-8b",
            "meta/llama-3.2"
        ]
    });
    assert.equal(
        calls[0].url,
        "http://127.0.0.1:1234/v1/models"
    );
    assert.equal(calls[0].init.method, "GET");
    assert.equal(calls[0].init.redirect, "error");
    assert.equal(
        calls[0].init.headers.Authorization,
        undefined
    );
});

test("usa el token opcional sin publicarlo y acepta un catálogo vacío", async () => {
    const calls = [];
    const service = createService({
        token: "token-local-secreto",
        fetch: async (url, init) => {
            calls.push({ url, init });
            return jsonResponse({ data: [] });
        }
    });

    const result = await service.discoverModels();

    assert.deepEqual(result.models, []);
    assert.equal(
        calls[0].init.headers.Authorization,
        "Bearer token-local-secreto"
    );
    assert.equal(
        JSON.stringify(result).includes(
            "token-local-secreto"
        ),
        false
    );
});

test("conserva el orden del servidor y elimina IDs repetidos", () => {
    assert.deepEqual(
        normalizeLMStudioModelCatalog({
            data: [
                { id: "modelo-b" },
                { id: "modelo-a" },
                { id: "modelo-b" }
            ]
        }),
        ["modelo-b", "modelo-a"]
    );
});

test("rechaza catálogos malformados o desproporcionados", () => {
    for (const payload of [
        null,
        {},
        { error: { message: "interno" }, data: [] },
        { data: [{ id: "" }] },
        { data: [{ id: "modelo\ninyectado" }] },
        {
            data: Array.from(
                {
                    length:
                        MAX_LM_STUDIO_DISCOVERED_MODELS +
                        1
                },
                (_, index) => ({ id: `m-${index}` })
            )
        }
    ]) {
        assert.throws(
            () => normalizeLMStudioModelCatalog(
                payload
            ),
            error => error.failureKind ===
                "invalid-response"
        );
    }
});

test("clasifica autenticación y una ruta compatible ausente", async () => {
    for (const [status, kind, fragment] of [
        [401, "authentication", "token local"],
        [403, "authentication", "token local"],
        [404, "http", "OpenAI-compatible"]
    ]) {
        const service = createService({
            token: "secreto-que-no-debe-salir",
            fetch: async () => ({
                ok: false,
                status
            })
        });

        await assert.rejects(
            () => service.discoverModels(),
            error =>
                error.providerId === "lm-studio" &&
                error.failureKind === kind &&
                error.httpStatus === status &&
                error.publicMessage.includes(fragment) &&
                !JSON.stringify(error).includes(
                    "secreto-que-no-debe-salir"
                )
        );
    }
});

test("distingue servidor apagado, timeout y cancelación", async () => {
    const offline = createService({
        fetch: async () => {
            throw new Error("ECONNREFUSED secreto");
        }
    });

    await assert.rejects(
        () => offline.discoverModels(),
        error =>
            error.failureKind === "network" &&
            error.publicMessage.includes(
                "lms server start"
            )
    );

    const timeout = createService({
        timeoutMs: 5,
        fetch: async (url, init) =>
            new Promise((resolve, reject) => {
                init.signal.addEventListener(
                    "abort",
                    () => reject(
                        new Error("aborted")
                    ),
                    { once: true }
                );
            })
    });

    await assert.rejects(
        () => timeout.discoverModels(),
        error => error.failureKind === "timeout"
    );

    const controller = new AbortController();
    controller.abort();
    const cancelled = createService({
        fetch: async (url, init) => {
            assert.equal(init.signal.aborted, true);
            throw new Error("cancelled");
        }
    });

    await assert.rejects(
        () => cancelled.discoverModels({
            signal: controller.signal
        }),
        error => error.code ===
            "BROKER95_LLM_REQUEST_ABORTED"
    );
});

test("impide que el canal de LM Studio salga del loopback", async () => {
    const service = createService({
        baseUrl: "http://192.168.1.20:1234/v1",
        fetch: async () => {
            assert.fail(
                "No debía realizar una solicitud remota."
            );
        }
    });

    await assert.rejects(
        () => service.discoverModels(),
        error => error.code ===
            "BROKER95_LLM_REQUEST_INVALID"
    );
});

function createService({
    fetch,
    model = "",
    token = null,
    baseUrl = "http://127.0.0.1:1234/v1",
    timeoutMs = 1_000
}) {
    return new LMStudioBroker95LocalService({
        configurationService: {
            async resolvePrivateLlmEndpointSettings(
                providerId
            ) {
                assert.equal(providerId, "lm-studio");

                return Object.freeze({
                    providerId,
                    model,
                    credential: Object.freeze({
                        providerId,
                        kind: "optional-api-key",
                        ...(token == null
                            ? {}
                            : { value: token })
                    }),
                    baseUrl
                });
            }
        },
        fetch,
        timeoutMs,
        developerLogger: { error() {} }
    });
}

function jsonResponse(payload) {
    return {
        ok: true,
        status: 200,
        async text() {
            return JSON.stringify(payload);
        }
    };
}
