const GUIDES = Object.freeze({
    groq: ["API key de Groq", "Copia el identificador exacto del modelo en Groq."],
    gemini: ["API key de Gemini", "Usa el identificador del modelo de la API de Gemini."],
    deepseek: ["API key de DeepSeek", "Usa el identificador publicado por la API de DeepSeek."],
    openai: ["API key de OpenAI", "Usa un modelo disponible para tu cuenta de API."],
    xai: ["API key de xAI", "Usa el identificador o alias del modelo de xAI."],
    together: ["API key de Together AI", "Copia el ID completo del catálogo, incluida la organización."],
    zai: ["API key de Z.AI", "Usa un modelo de la API general de Z.AI; este enlace no usa el endpoint del Coding Plan."],
    "hugging-face": ["Token de Hugging Face", "Usa organización/modelo. Se admiten sufijos como :fastest, :cheapest, :preferred o el proveedor."],
    openrouter: ["API key de OpenRouter", "Copia el ID completo del catálogo, incluido :free cuando corresponda."],
    "lm-studio": ["Token local (opcional)", "Inicia el servidor de LM Studio, busca los modelos y guarda el identificador elegido."],
    ollama: ["Sin credencial", "Inicia Ollama, descarga un modelo con ollama pull y copia su nombre exacto, incluida la etiqueta si la tiene."]
});

const FAILURE_CODES = Object.freeze({
    BROKER95_LLM_OFFLINE: "offline",
    BROKER95_LLM_QUOTA_EXHAUSTED: "quota_exhausted",
    BROKER95_LLM_AUTHENTICATION_FAILED: "authentication_failed",
    BROKER95_LLM_MODEL_UNAVAILABLE: "model_unavailable",
    BROKER95_LLM_TIMEOUT: "timeout",
    BROKER95_LLM_PROVIDER_ERROR: "provider_error",
    BROKER95_LLM_INVALID_RESPONSE: "invalid_response"
});

export function createBroker95ProviderExperience(state) {
    const settings = state?.settings ?? {};
    const providers = settings.providers ?? [];
    const provider = providers.find(item => item.id === settings.providerId);
    const local = provider?.endpointKind === "local";
    const credential = settings.credential;
    const credentialRequired = credential?.required ?? true;
    const credentialReady = !credentialRequired ||
        (credential?.configured ?? settings.hasApiKey ?? false);
    const modelReady = Boolean(String(settings.model ?? "").trim());
    const configured = Boolean(provider) && modelReady && credentialReady;
    const busy = state?.operation?.status === "busy";
    const hostReady = state?.connection === "ready";
    const testing = busy && state.operation.operation === "llm/test-connection";
    const failure = FAILURE_CODES[state?.lastError?.code] ??
        (state?.llmStatus?.reason !== "ready" ? state?.llmStatus?.reason : null);
    const check = state?.connectionCheck;
    const verified = configured && !failure && check?.connected === true &&
        check.providerId === settings.providerId;
    const guide = GUIDES[settings.providerId] ?? ["Credencial del proveedor", "Copia el identificador exacto del modelo disponible para tu cuenta."];

    let title = "CONFIGURACIÓN GUARDADA";
    let message = "Ya puedes solicitar ayuda a CIPHER. Prueba la conexión para comprobar el modelo seleccionado.";
    let tone = "pending";
    let actionTarget = "broker95-connection-button";
    if (!hostReady) {
        title = "ENLACE CON VS CODE PENDIENTE";
        message = "Espera a que BROKER.95 se conecte con VS Code. Si no se recupera, vuelve a abrir el juego.";
    } else if (testing) {
        title = "COMPROBANDO CONEXIÓN";
        message = `Comprobando el enlace con ${provider?.label ?? "el proveedor"}…`;
    } else if (!provider) {
        title = "ELIGE UN PROVEEDOR";
        message = "Selecciona un servicio remoto o un motor instalado en tu computadora.";
        actionTarget = "broker95-provider";
    } else if (!modelReady) {
        title = "FALTA EL MODELO";
        message = guide[1];
        actionTarget = "broker95-model";
    } else if (!credentialReady) {
        title = "FALTA LA CREDENCIAL";
        message = settings.providerId === "hugging-face"
            ? 'Guarda un token con el permiso "Make calls to Inference Providers".'
            : `Guarda la credencial de ${provider.label} para conectar con el modelo.`;
        actionTarget = "broker95-api-key";
    } else if (failure && !["model_missing", "api_key_missing"].includes(failure)) {
        title = "EL ENLACE NECESITA ATENCIÓN";
        tone = "warning";
        message = failureHelp(failure, local, settings.providerId);
        actionTarget = failure === "authentication_failed" ? "broker95-api-key"
            : failure === "model_unavailable" ? "broker95-model"
            : local && failure === "offline" ? "broker95-base-url"
            : "broker95-connection-button";
    } else if (verified) {
        title = "CONEXIÓN COMPROBADA";
        message = `El proveedor respondió a la última prueba. Modelo: ${check.model}.`;
        tone = "success";
    }

    const completionProbe = [
        "groq",
        "together",
        "zai",
        "hugging-face",
        "openrouter"
    ].includes(settings.providerId);
    return Object.freeze({
        provider, local, configured, verified, busy, testing,
        canTest: configured && hostReady && !busy,
        title, message, tone, actionTarget,
        credentialLabel: guide[0],
        modelHint: guide[1],
        endpointLabel: local ? "En tu computadora" : "Servicio remoto",
        dataHint: local
            ? "BROKER.95 envía las consultas y el código que compartas al servidor de esta computadora. El modelo utiliza sus recursos; puede tardar más según tu equipo."
            : "Las consultas y el código que compartas con CIPHER se envían al proveedor seleccionado. Necesitas conexión y acceso a su API; su uso puede consumir créditos.",
        testHint: completionProbe
            ? "Esta prueba envía una consulta breve al modelo y puede consumir créditos. No genera contratos ni modifica tu partida."
            : "Esta prueba consulta la disponibilidad del modelo. No garantiza su calidad educativa ni su compatibilidad con todas las operaciones.",
        groups: Object.freeze([
            { label: "En tu computadora", providers: providers.filter(item => item.endpointKind === "local") },
            { label: "Servicios remotos", providers: providers.filter(item => item.endpointKind === "remote") }
        ].filter(group => group.providers.length > 0)),
        steps: Object.freeze([
            { label: "Elegir proveedor", complete: Boolean(provider), target: "broker95-provider" },
            { label: "Guardar modelo", complete: modelReady, target: "broker95-model" },
            { label: credentialRequired ? "Guardar credencial" : "Credencial opcional o no necesaria", complete: credentialReady, target: credentialRequired ? "broker95-api-key" : "broker95-model" },
            { label: "Probar conexión", complete: verified, target: "broker95-connection-button" }
        ])
    });
}

function failureHelp(reason, local, providerId) {
    switch (reason) {
        case "offline": return local
            ? "No se pudo contactar con el servidor local. Inícialo y revisa la URL y el puerto en Configuración."
            : "No se pudo contactar con el proveedor. Revisa tu conexión a internet y vuelve a probar.";
        case "authentication_failed": return local
            ? "El servidor rechazó el token. Si activaste autenticación, guarda aquí el mismo token del servidor."
            : providerId === "hugging-face"
            ? 'Revisa el token de Hugging Face y su permiso "Make calls to Inference Providers".'
            : "El proveedor rechazó la credencial. Revisa la clave y los permisos de tu cuenta; después vuelve a probar.";
        case "model_unavailable": return local
            ? "El modelo no está disponible en el servidor. Descárgalo o cárgalo y verifica su identificador."
            : "Revisa el identificador del modelo y que tu cuenta tenga acceso a él.";
        case "quota_exhausted": return "El proveedor limitó la solicitud. Revisa tus créditos o límites de uso; si es un límite temporal, espera antes de reintentar.";
        case "timeout": return local
            ? "El modelo local tardó demasiado. Comprueba que haya terminado de cargar y que tu equipo tenga recursos disponibles."
            : "El proveedor tardó demasiado en responder. Puedes volver a probar en unos momentos.";
        case "invalid_response": return "La respuesta no cumplió el formato que necesita CIPHER. Prueba de nuevo o elige otro modelo compatible con JSON. Esto no indica un error en tu programa CLRS.";
        default: return "El proveedor no pudo completar la solicitud. Vuelve a probar o selecciona otro modelo; tu progreso se conserva.";
    }
}

export function focusBroker95Configuration(target, document = globalThis.document) {
    const element = document?.getElementById(target);
    if (!element || element.disabled) return false;
    element.scrollIntoView?.({ block: "center", behavior: "auto" });
    element.focus();
    return true;
}
