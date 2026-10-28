import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
    OPENAI_COMPATIBLE_PROVIDER_PROFILES,
    OpenAICompatibleBroker95LLMAdapter
} from "../extension/adapters/OpenAICompatibleBroker95LLMAdapter.js";
import {
    BrokerLLMOperation,
    BrokerLLMProviderId,
    BrokerLLMProviderRegistry,
    BrokerLLMResiliencePolicy,
    getBrokerLLMProviderDescriptor
} from "../src/broker95/llm/index.js";

const SECRET = "corpus-private-credential";
const PRIVATE_CONTEXT = "corpus-private-source";
const ANSWER = "Revisa el tamaño de entrada. 🧩";
const profiles = Object.values(OPENAI_COMPATIBLE_PROVIDER_PROFILES);

test("el corpus de proveedores cubre once motores y sus evidencias se ejecutan en release", async () => {
    const corpus = JSON.parse(await source("test/fixtures/broker95-providers-corpus.v1.json"));
    const manifest = JSON.parse(await source("package.json"));
    assert.equal(corpus.schemaVersion, 1);
    assert.deepEqual(Object.keys(corpus.providers), Object.values(BrokerLLMProviderId));
    assert.equal(Object.keys(corpus.providers).length, 11);
    assert.deepEqual(Object.keys(corpus.areas), [
        "contract-routing", "security-persistence", "compatible-transport",
        "local-discovery", "educational-experience", "resilience",
        "domain-authority", "composition"
    ]);

    // Sigue el grafo real de scripts y sus prehooks; declarar un script
    // aislado no basta para considerar su evidencia parte del release.
    const visited = new Set();
    const commands = [];
    function visit(name) {
        if (visited.has(name)) { return; }
        visited.add(name);
        const script = manifest.scripts[name];
        assert.equal(typeof script, "string", `Script ausente: ${name}`);
        if (manifest.scripts[`pre${name}`]) { visit(`pre${name}`); }
        commands.push(script);
        for (const match of script.matchAll(/npm run ([\w:-]+)/gu)) {
            visit(match[1]);
        }
    }
    visit("release:check");
    const executedFiles = new Set(commands.join(" ").match(/test\/[\w.-]+\.test\.js/gu));
    for (const files of Object.values(corpus.areas)) { assert.ok(files.length > 0); }
    for (const file of new Set([
        ...Object.values(corpus.providers), ...Object.values(corpus.areas).flat()
    ])) {
        assert.match(file, /^test\/[a-z0-9.-]+\.test\.js$/u);
        assert.ok(executedFiles.has(file), `No se ejecuta en release: ${file}`);
        assert.match(await source(file), /\btest\(/u);
    }
});

for (const profile of profiles) {
    test(`${profile.providerId}: registro y transporte cubren las seis operaciones neutrales`, async () => {
        const harness = createHarness(profile, successfulResponse);
        for (const operation of Object.values(BrokerLLMOperation)) {
            const result = await harness.registry[operation](request(operation));
            assert.equal(result.providerId, profile.providerId);
            assert.equal(result.model, harness.model);
            assert.deepEqual(result.output, operation === "testConnection"
                ? { connected: true, message: profile.providerId === "lm-studio"
                    ? "Modelo local disponible." : "Modelo disponible." }
                : operation === "askSubmission" ? ANSWER : { message: ANSWER });
        }
        assert.equal(harness.calls.length, 6);
        for (const { url, init } of harness.calls) {
            assert.ok(url.startsWith(`${harness.baseUrl}/`));
            assert.equal(init.headers.Authorization, `Bearer ${SECRET}`);
            assert.equal(init.redirect, "error");
            if (init.body) {
                const body = JSON.parse(init.body);
                assert.equal(body.model, harness.model);
                assert.equal(body.stream, false);
            }
        }
        assertSafeLogs(harness);
    });

    test(`${profile.providerId}: recupera fallos transitorios sin cambiar de proveedor`, async () => {
        const failures = [
            () => { throw new Error(`ECONNRESET ${SECRET} ${PRIVATE_CONTEXT}`); },
            () => new Response(SECRET, { status: 503 }),
            () => completion(""),
            () => completion("JSON incompleto {")
        ];
        for (const fail of failures) {
            const harness = createHarness(profile, (url, init, attempt) => attempt === 1
                ? fail() : successfulResponse(url, init));
            const result = await harness.registry.generateContract(request());
            assert.deepEqual(result.output, { message: ANSWER });
            assert.equal(harness.calls.length, 2);
            assert.equal(harness.calls[0].url, harness.calls[1].url);
            assertSafeLogs(harness);
        }
    });

    test(`${profile.providerId}: no reintenta fallos definitivos y acota la indisponibilidad persistente`, async () => {
        for (const [status, kind, attempts] of [
            [401, "authentication", 1],
            [
                403,
                ["together", "openrouter"]
                    .includes(profile.providerId)
                    ? "provider"
                    : "authentication",
                1
            ],
            [402, "quota", 1], [429, "quota", 1],
            [404, "model-unavailable", 1], [503, "http", 2]
        ]) {
            const harness = createHarness(profile, () => new Response(SECRET, { status }));
            await assert.rejects(harness.registry.generateContract(request()), error => {
                assert.equal(error.failureKind, kind);
                assert.equal(JSON.stringify(error).includes(SECRET), false);
                return true;
            });
            assert.equal(harness.calls.length, attempts);
            assertSafeLogs(harness);
        }
    });

    test(`${profile.providerId}: reconstruye SSE UTF-8 fragmentado y no duplica streams interrumpidos`, async () => {
        for (const completed of [true, false]) {
            const deltas = [];
            const harness = createHarness(profile, () => streamResponse(completed));
            const pending = harness.registry.askSubmission(request("askSubmission", true), {
                onDelta(delta) { deltas.push(delta); }
            });
            if (completed) {
                assert.equal((await pending).output, ANSWER);
            } else {
                await assert.rejects(pending, error => error.failureKind === "invalid-stream");
            }
            assert.equal(deltas.map(delta => delta.text).join(""), ANSWER);
            assert.equal(harness.calls.length, 1);
            assertSafeLogs(harness);
        }
    });

    test(`${profile.providerId}: cancela antes de enviar y durante la recepción sin reintentos`, async () => {
        const controller = new AbortController();
        const harness = createHarness(profile, () => streamResponse(true));
        controller.abort();
        await assert.rejects(harness.registry.generateContract(request(), {
            signal: controller.signal
        }), error => error.code === "BROKER95_LLM_REQUEST_ABORTED");
        assert.equal(harness.calls.length, 0);

        const streamingController = new AbortController();
        await assert.rejects(harness.registry.askSubmission(request("askSubmission", true), {
            signal: streamingController.signal,
            onDelta() { streamingController.abort(); }
        }), error => error.code === "BROKER95_LLM_REQUEST_ABORTED");
        assert.equal(harness.calls.length, 1);
    });

    test(`${profile.providerId}: mantiene el timeout mientras espera el cuerpo HTTP o SSE`, async () => {
        for (const streaming of [false, true]) {
            const harness = createHarness(profile, (_url, init) => new Response(new ReadableStream({
                start(controller) {
                    init.signal.addEventListener("abort", () => {
                        controller.error(new Error("aborted"));
                    }, { once: true });
                }
            })), { timeoutMs: 10 });
            const operation = streaming ? "askSubmission" : "generateContract";
            await assert.rejects(harness.registry[operation](request(operation, streaming),
                streaming ? { onDelta() {} } : {}), error => error.failureKind === "timeout");
            assert.equal(harness.calls.length, streaming ? 1 : 2);
        }
    });
}

function createHarness(profile, fetchResponse, { timeoutMs = 5_000 } = {}) {
    const descriptor = getBrokerLLMProviderDescriptor(profile.providerId);
    const baseUrl = profile.baseUrl ?? "http://127.0.0.1:1234/v1";
    const model = `${profile.providerId}/corpus-model`;
    const calls = [];
    const logs = [];
    const logger = {
        error(...args) { logs.push(args); },
        warn(...args) { logs.push(args); }
    };
    const adapter = new OpenAICompatibleBroker95LLMAdapter({
        providerId: profile.providerId,
        configurationService: {
            async resolvePrivateLlmSettings(providerId) {
                assert.equal(providerId, profile.providerId);
                return {
                    providerId, model,
                    baseUrl: profile.baseUrl ? "https://untrusted.invalid/v1" : baseUrl,
                    credential: { providerId, kind: descriptor.credentialKind, value: SECRET }
                };
            }
        },
        async fetch(url, init) {
            calls.push({ url, init });
            return fetchResponse(url, init, calls.length, model);
        },
        timeoutMs,
        developerLogger: logger
    });
    const registry = new BrokerLLMProviderRegistry({
        resolveSelectedProviderId: () => profile.providerId,
        resiliencePolicy: new BrokerLLMResiliencePolicy({ retryDelayMs: 0, developerLogger: logger })
    });
    registry.register(descriptor, adapter);
    return { registry, calls, logs, model, baseUrl };
}

function request(operation = "generateContract", stream = false) {
    return {
        requestId: `corpus:${operation}`,
        model: "ignored-client-model",
        input: operation === "chat" ? { message: "Una pista, por favor." } : {},
        context: { source: PRIVATE_CONTEXT },
        stream
    };
}

function successfulResponse(url, init, _attempt, model) {
    if (url === "https://api.x.ai/v1/language-models") {
        return Response.json({ models: [{ id: model }] });
    }
    if (url.endsWith("/models")) {
        const models = [{ id: model }];
        return Response.json(url === "https://api.together.ai/v1/models" ? models : { data: models });
    }
    const body = JSON.parse(init.body);
    if (body.messages.length === 1 && body.messages[0].content === "Responde únicamente con OK.") {
        return completion("OK");
    }
    const operation = JSON.parse(body.messages.at(-1).content).operation;
    return completion(operation === "askSubmission" ? ANSWER : JSON.stringify({ message: ANSWER }));
}

function completion(content) {
    return Response.json({
        choices: [{ message: { content, reasoning_content: "private-reasoning" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
    });
}

function streamResponse(completed) {
    const event = payload => `data: ${JSON.stringify(payload)}\r\n\r\n`;
    const bytes = new TextEncoder().encode(
        ": heartbeat\r\n\r\n" + event({ choices: [{ delta: { reasoning_content: "private-reasoning" } }] }) +
        event({ choices: [{ delta: { content: ANSWER } }] }) +
        (completed ? event({ choices: [{ delta: {}, finish_reason: "stop" }] }) + "data: [DONE]\r\n\r\n" : "")
    );
    return new Response(new ReadableStream({
        start(controller) {
            // Incluye cortes dentro de caracteres multibyte y separadores CRLF.
            for (const byte of bytes) { controller.enqueue(Uint8Array.of(byte)); }
            controller.close();
        }
    }));
}

function assertSafeLogs({ logs }) {
    for (const privateValue of [SECRET, PRIVATE_CONTEXT, "private-reasoning"]) {
        assert.equal(JSON.stringify(logs).includes(privateValue), false);
    }
}

function source(relativePath) {
    return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}
