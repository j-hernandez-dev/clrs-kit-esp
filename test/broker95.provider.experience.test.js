import assert from "node:assert/strict";
import test from "node:test";
import {
    createBroker95ProviderExperience,
    focusBroker95Configuration
} from "../frontend/src/broker95/panels/Broker95ProviderExperience.js";
import { Broker95ViewStore } from "../frontend/src/broker95/Broker95ViewStore.js";
import { createBrokerHostMessage, createBrokerGameState } from "../src/broker95/index.js";
import { listBrokerLLMProviderDescriptors } from "../src/broker95/llm/BrokerLLMProvider.js";

test("agrupa únicamente los proveedores publicados y conserva la selección", () => {
    const state = configuredState("lm-studio");
    const experience = createBroker95ProviderExperience(state);
    assert.equal(experience.provider.label, "LM Studio (local)");
    assert.deepEqual(experience.groups[0].providers.map(item => item.id), ["ollama", "lm-studio"]);
    assert.equal(experience.groups[1].providers.some(item => item.id === "anthropic"), false);
    const restricted = createBroker95ProviderExperience({
        ...state, settings: { ...state.settings, providers: [state.settings.providers.find(item => item.id === "lm-studio")] }
    });
    assert.equal(restricted.groups.length, 1);
});

test("guardar configuración no equivale a comprobar conexión y los alias se conservan", () => {
    const state = configuredState("xai");
    assert.equal(createBroker95ProviderExperience(state).title, "CONFIGURACIÓN GUARDADA");
    assert.equal(createBroker95ProviderExperience(state).verified, false);
    state.connectionCheck = { providerId: "xai", model: "modelo-versionado", connected: true };
    assert.equal(createBroker95ProviderExperience(state).verified, true);
    state.connectionCheck.providerId = "groq";
    assert.equal(createBroker95ProviderExperience(state).verified, false);
});

test("orienta por modelo y credencial faltantes y respeta el token local opcional", () => {
    const remote = configuredState("hugging-face");
    remote.settings.model = "";
    assert.equal(createBroker95ProviderExperience(remote).actionTarget, "broker95-model");
    remote.settings.model = "organizacion/modelo";
    remote.settings.credential.configured = false;
    assert.equal(createBroker95ProviderExperience(remote).canTest, false);
    assert.match(createBroker95ProviderExperience(remote).message, /Make calls to Inference Providers/u);
    const local = configuredState("lm-studio");
    local.settings.credential.configured = false;
    assert.equal(createBroker95ProviderExperience(local).canTest, true);
    assert.equal(createBroker95ProviderExperience(configuredState("ollama")).canTest, true);
});

test("un fallo remoto permite reintentar y un fallo local indica servidor y puerto", () => {
    for (const id of ["lm-studio", "openrouter"]) {
        const state = configuredState(id);
        state.lastError = { code: "BROKER95_LLM_OFFLINE" };
        const experience = createBroker95ProviderExperience(state);
        assert.equal(experience.canTest, true);
        assert.equal(experience.tone, "warning");
        assert.match(experience.message, id === "lm-studio" ? /servidor local/u : /internet/u);
    }
    const auth = configuredState("openrouter");
    auth.llmStatus = { status: "unavailable", reason: "authentication_failed" };
    assert.equal(createBroker95ProviderExperience(auth).canTest, true);
    assert.equal(createBroker95ProviderExperience(auth).actionTarget, "broker95-api-key");
});

test("los errores de formato no se atribuyen al programa y el diagnóstico no bloquea lecciones", () => {
    const state = configuredState("hugging-face");
    state.lastError = { code: "BROKER95_LLM_INVALID_RESPONSE" };
    const experience = createBroker95ProviderExperience(state);
    assert.match(experience.message, /no indica un error en tu programa/u);
    assert.equal(experience.configured, true);
    assert.equal(Object.hasOwn(experience, "gameState"), false);
    assert.match(experience.testHint, /puede consumir créditos/u);
});

test("espera al Host y desactiva reintentos durante una operación", () => {
    const state = configuredState("groq");
    state.connection = "connecting";
    assert.equal(createBroker95ProviderExperience(state).canTest, false);
    state.connection = "ready";
    state.operation = { status: "busy", operation: "llm/test-connection" };
    const experience = createBroker95ProviderExperience(state);
    assert.equal(experience.canTest, false);
    assert.equal(experience.testing, true);
    assert.equal(experience.title, "COMPROBANDO CONEXIÓN");
});

test("la navegación de pasos lleva el foco al control y no activa controles deshabilitados", () => {
    const calls = [];
    const control = { disabled: false, focus: () => calls.push("focus"), scrollIntoView: () => calls.push("scroll") };
    const document = { getElementById: id => id === "broker95-model" ? control : null };
    assert.equal(focusBroker95Configuration("broker95-model", document), true);
    assert.deepEqual(calls, ["scroll", "focus"]);
    control.disabled = true;
    assert.equal(focusBroker95Configuration("broker95-model", document), false);
    assert.equal(focusBroker95Configuration("missing", document), false);
});

test("invalida un diagnóstico tras un fallo y descarta resultados de otro proveedor", () => {
    const store = new Broker95ViewStore();
    const state = configuredState("groq");
    store.applyHostMessage(createBrokerHostMessage({
        type: "host/ready", payload: { sessionId: "experience:test", state: createBrokerGameState(), settings: state.settings, llmStatus: state.llmStatus }
    }));
    const success = providerId => createBrokerHostMessage({
        type: "llm/connection-result", payload: { providerId, model: "modelo", connected: true, message: "Modelo disponible." }
    });
    store.applyHostMessage(success("groq"));
    assert.equal(createBroker95ProviderExperience(store.getState()).verified, true);
    store.applyHostMessage(createBrokerHostMessage({
        type: "host/error", payload: { code: "BROKER95_LLM_OFFLINE", message: "Sin enlace", recoverable: true, requestType: "settings/test-llm-connection" }
    }));
    assert.equal(store.getState().connectionCheck, null);
    assert.equal(createBroker95ProviderExperience(store.getState()).tone, "warning");
    store.applyHostMessage(success("groq"));
    assert.equal(store.getState().lastError, null);
    store.applyHostMessage(createBrokerHostMessage({ type: "settings/updated", payload: { settings: configuredState("openrouter").settings } }));
    store.applyHostMessage(success("groq"));
    assert.equal(store.getState().connectionCheck, null);
});

function configuredState(providerId) {
    const providers = listBrokerLLMProviderDescriptors();
    const provider = providers.find(item => item.id === providerId);
    return {
        connection: "ready",
        settings: {
            providerId, providers, model: "modelo",
            credential: {
                kind: provider.credentialKind,
                required: provider.credentialKind === "api-key",
                configured: true
            },
            hasApiKey: provider.credentialKind !== "none",
            ...(provider.endpointKind === "local" ? { baseUrl: "http://127.0.0.1:1234/v1" } : {}),
            audio: { muted: false, volume: 45 }
        },
        operation: { status: "idle", operation: null },
        llmStatus: { status: "ready", reason: "ready", message: "CIPHER está configurado." },
        connectionCheck: null,
        lastError: null
    };
}
