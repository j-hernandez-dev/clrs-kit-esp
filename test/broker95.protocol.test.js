import test from "node:test";
import assert from "node:assert/strict";

import {
    BROKER_PROTOCOL_ID,
    BROKER_PROTOCOL_VERSION,
    BrokerLLMCapabilitySupport,
    BrokerLLMCredentialKind,
    BrokerLLMEndpointKind,
    BrokerCipherStreamPhase,
    BrokerHostMessageType,
    BrokerLlmStatus,
    BrokerLlmStatusReason,
    BrokerOperationStatus,
    BrokerProtocolDirection,
    BrokerProtocolError,
    BrokerTerminalEntryKind,
    BrokerWebviewRequestGuard,
    BrokerWebviewMessageType,
    createBrokerGameState,
    createBrokerHostMessage,
    createBrokerLLMProviderDescriptor,
    createBrokerWebviewMessage,
    listBrokerLLMProviderDescriptors,
    parseBrokerHostMessage,
    parseBrokerWebviewMessage
} from "../src/broker95/index.js";

test("rechaza replay y limita solicitudes simultáneas del Webview", () => {
    const guard =
        new BrokerWebviewRequestGuard({
            maxInFlight: 1,
            maxRemembered: 4,
            maxRequestsPerWindow: 4,
            windowMs: 1_000,
            clock: () => 100
        });
    const first = guard.begin({
        requestId: "request:guard:1"
    });

    assert.throws(
        () => guard.begin({
            requestId: "request:guard:1"
        }),
        error =>
            error instanceof
                BrokerProtocolError &&
            error.code ===
                "BROKER95_PROTOCOL_REQUEST_REPLAYED"
    );
    assert.throws(
        () => guard.begin({
            requestId: "request:guard:2"
        }),
        error =>
            error instanceof
                BrokerProtocolError &&
            error.code ===
                "BROKER95_PROTOCOL_REQUEST_LIMIT_EXCEEDED"
    );

    first.release();
    first.release();

    const third = guard.begin({
        requestId: "request:guard:3"
    });

    third.release();
});

test("limita la frecuencia, acota memoria y reinicia por panel", () => {
    let now = 0;
    const guard =
        new BrokerWebviewRequestGuard({
            maxInFlight: 2,
            maxRemembered: 2,
            maxRequestsPerWindow: 2,
            windowMs: 100,
            clock: () => now
        });

    guard.begin({ requestId: "rate:1" })
        .release();
    guard.begin({ requestId: "rate:2" })
        .release();

    assert.throws(
        () => guard.begin({
            requestId: "rate:3"
        }),
        error =>
            error.code ===
                "BROKER95_PROTOCOL_RATE_LIMITED"
    );

    now = 101;
    guard.begin({ requestId: "rate:4" })
        .release();

    // La memoria de replay es deliberadamente acotada.
    guard.begin({ requestId: "rate:1" })
        .release();

    guard.reset();
    guard.begin({ requestId: "rate:4" })
        .release();
});

test("crea envelopes Webview a Host versionados y correlacionables", () => {
    const message = createBrokerWebviewMessage({
        type:
            BrokerWebviewMessageType
                .SUBMIT_TERMINAL,
        requestId: "request:1",
        payload: {
            input: "  ai -new high  "
        }
    });

    assert.equal(
        message.protocol,
        BROKER_PROTOCOL_ID
    );
    assert.equal(
        message.protocolVersion,
        BROKER_PROTOCOL_VERSION
    );
    assert.equal(
        message.direction,
        BrokerProtocolDirection
            .WEBVIEW_TO_HOST
    );
    assert.equal(message.requestId, "request:1");
    assert.equal(
        message.payload.input,
        "  ai -new high  "
    );
});

test("valida todas las intenciones permitidas del Webview", () => {
    const cases = [
        [BrokerWebviewMessageType.READY, {
            clientVersion: "1.0.0"
        }],
        [BrokerWebviewMessageType.REQUEST_STATE, {}],
        [BrokerWebviewMessageType.SUBMIT_TERMINAL, {
            input: "ai -get"
        }],
        [BrokerWebviewMessageType.PURCHASE_COUNTERMEASURE, {
            countermeasureId: "scrub"
        }],
        [BrokerWebviewMessageType.SET_PROVIDER, {
            providerId: "groq"
        }],
        [BrokerWebviewMessageType.SET_MODEL, {
            model: "modelo-local"
        }],
        [BrokerWebviewMessageType.SET_BASE_URL, {
            baseUrl:
                "http://127.0.0.1:1234/v1"
        }],
        [BrokerWebviewMessageType.SET_AUDIO, {
            muted: true,
            volume: 72
        }],
        [BrokerWebviewMessageType.SET_API_KEY, {
            apiKey: "clave-secreta"
        }],
        [BrokerWebviewMessageType.DELETE_API_KEY, {}],
        [BrokerWebviewMessageType.TEST_LLM_CONNECTION, {}],
        [
            BrokerWebviewMessageType
                .DISCOVER_LM_STUDIO_MODELS,
            {}
        ],
        [BrokerWebviewMessageType.CLEAR_CATEGORY_HISTORY, {}],
        [BrokerWebviewMessageType.RESET_GAME_PROGRESS, {}]
    ];

    cases.forEach(([type, payload], index) => {
        const message =
            createBrokerWebviewMessage({
                type,
                requestId: `request:${index}`,
                payload
            });

        assert.equal(message.type, type);
    });
});

test("valida todos los eventos permitidos del Host", () => {
    const state = createBrokerGameState();
    const settings = {
        model: "",
        hasApiKey: false
    };
    const llmStatus = {
        status: BrokerLlmStatus.UNCONFIGURED,
        reason:
            BrokerLlmStatusReason
                .MISSING_MODEL,
        message:
            "Introduce un modelo para conectar a CIPHER."
    };
    const cases = [
        [BrokerHostMessageType.READY, {
            sessionId: "session:1",
            state,
            settings,
            llmStatus
        }],
        [BrokerHostMessageType.STATE_UPDATED, {
            state,
            reason: "initialized"
        }],
        [BrokerHostMessageType.TERMINAL_APPEND, {
            entries: [{
                id: "entry:1",
                kind:
                    BrokerTerminalEntryKind
                        .SYSTEM,
                text: "BROKER.95 listo.",
                createdOrder: 1
            }]
        }],
        [BrokerHostMessageType.OPERATION_STATUS, {
            status: BrokerOperationStatus.BUSY,
            operation: "contract/generate"
        }],
        [BrokerHostMessageType.SETTINGS_UPDATED, {
            settings
        }],
        [BrokerHostMessageType.LLM_STATUS, {
            llmStatus
        }],
        [BrokerHostMessageType.LLM_CONNECTION_RESULT, {
            providerId: "groq",
            model: "modelo-prueba",
            connected: true,
            message: "Modelo disponible."
        }],
        [BrokerHostMessageType.LM_STUDIO_MODELS, {
            providerId: "lm-studio",
            baseUrl:
                "http://127.0.0.1:1234/v1",
            models: [
                "qwen/qwen3-8b",
                "meta/llama-3.2"
            ]
        }],
        [BrokerHostMessageType.CIPHER_STREAM, {
            streamId: "stream:1",
            phase:
                BrokerCipherStreamPhase.DELTA,
            text: "Procesando..."
        }],
        [BrokerHostMessageType.ERROR, {
            code: "BROKER95_TEST_ERROR",
            message: "No fue posible completar la operación.",
            recoverable: true,
            requestType: "terminal/submit"
        }]
    ];

    cases.forEach(([type, payload], index) => {
        const message =
            createBrokerHostMessage({
                type,
                requestId: `request:${index}`,
                payload
            });

        assert.equal(message.type, type);
        assert.equal(
            message.direction,
            BrokerProtocolDirection
                .HOST_TO_WEBVIEW
        );
    });
});

test("permite eventos espontáneos y respuestas correlacionadas", () => {
    const spontaneous =
        createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .OPERATION_STATUS,
            payload: {
                status:
                    BrokerOperationStatus.IDLE,
                operation: null
            }
        });
    const response = createBrokerHostMessage({
        type: BrokerHostMessageType.ERROR,
        requestId: "request:8",
        payload: {
            code: "BROKER95_UNAVAILABLE",
            message: "CIPHER no está disponible.",
            recoverable: true
        }
    });

    assert.equal(spontaneous.requestId, null);
    assert.equal(response.requestId, "request:8");
});

test("rechaza protocolo, versión o dirección falsificados", () => {
    const valid = webviewMessage();

    assertProtocolError(
        {
            ...valid,
            protocol: "otro"
        },
        "BROKER95_PROTOCOL_ID_INVALID"
    );
    assertProtocolError(
        {
            ...valid,
            protocolVersion: 99
        },
        "BROKER95_PROTOCOL_VERSION_UNSUPPORTED"
    );
    assertProtocolError(
        {
            ...valid,
            direction:
                BrokerProtocolDirection
                    .HOST_TO_WEBVIEW
        },
        "BROKER95_PROTOCOL_DIRECTION_INVALID"
    );
});

test("rechaza tipos desconocidos e IDs de solicitud inválidos", () => {
    assertProtocolError(
        {
            ...webviewMessage(),
            type: "game/set-money"
        },
        "BROKER95_PROTOCOL_MESSAGE_TYPE_UNKNOWN"
    );
    assertProtocolError(
        {
            ...webviewMessage(),
            requestId: null
        },
        "BROKER95_PROTOCOL_PAYLOAD_INVALID"
    );
    assertProtocolError(
        {
            ...webviewMessage(),
            requestId: "id con espacios"
        },
        "BROKER95_PROTOCOL_PAYLOAD_INVALID"
    );
});

test("el Webview no puede enviar estado ni campos adicionales", () => {
    assertProtocolError(
        {
            ...webviewMessage(),
            payload: {
                input: "ai -get",
                money: 999999,
                alertLevel: 0
            }
        },
        "BROKER95_PROTOCOL_PAYLOAD_INVALID"
    );
    assertProtocolError(
        {
            ...webviewMessage(),
            state: createBrokerGameState()
        },
        "BROKER95_PROTOCOL_PAYLOAD_INVALID"
    );
});

test("la configuración pública nunca acepta una API key", () => {
    assert.throws(
        () => createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .SETTINGS_UPDATED,
            payload: {
                settings: {
                    model: "modelo",
                    hasApiKey: true,
                    apiKey: "NO-DEBE-SALIR"
                }
            }
        }),
        error =>
            error instanceof
                BrokerProtocolError &&
            !JSON.stringify(error)
                .includes("NO-DEBE-SALIR")
    );
    assert.throws(
        () => createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .SETTINGS_UPDATED,
            payload: {
                settings: {
                    providerId: "groq",
                    model: "modelo",
                    hasApiKey: true,
                    credential: {
                        kind: "api-key",
                        required: true,
                        configured: true,
                        value: "SECRETO-ANIDADO"
                    }
                }
            }
        }),
        error =>
            error instanceof
                BrokerProtocolError &&
            !JSON.stringify(error)
                .includes("SECRETO-ANIDADO")
    );
});

test("el protocolo conserva sólo endpoints locales seguros", () => {
    const request = createBrokerWebviewMessage({
        type:
            BrokerWebviewMessageType
                .SET_BASE_URL,
        requestId: "request:local-url",
        payload: {
            baseUrl:
                "http://localhost:1234/v1/"
        }
    });

    assert.equal(
        request.payload.baseUrl,
        "http://localhost:1234/v1"
    );

    for (const baseUrl of [
        "https://localhost:1234/v1",
        "http://10.0.0.8:1234/v1",
        "http://localhost:1234/v1?key=secret"
    ]) {
        assert.throws(
            () => createBrokerWebviewMessage({
                type:
                    BrokerWebviewMessageType
                        .SET_BASE_URL,
                requestId:
                    "request:unsafe-url",
                payload: { baseUrl }
            }),
            error =>
                error instanceof
                    BrokerProtocolError &&
                !JSON.stringify(error)
                    .includes("secret")
        );
    }

    const settingsMessage =
        createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .SETTINGS_UPDATED,
            payload: {
                settings: {
                    providerId: "lm-studio",
                    providers:
                        listBrokerLLMProviderDescriptors(),
                    model: "qwen-local",
                    credential: {
                        kind: "optional-api-key",
                        required: false,
                        configured: false
                    },
                    hasApiKey: false,
                    baseUrl:
                        "http://127.0.0.1:1234/v1",
                    audio: {
                        muted: false,
                        volume: 45
                    }
                }
            }
        });

    assert.equal(
        settingsMessage.payload.settings
            .baseUrl,
        "http://127.0.0.1:1234/v1"
    );
    assert.throws(
        () => createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .SETTINGS_UPDATED,
            payload: {
                settings: {
                    providerId: "groq",
                    model: "modelo",
                    hasApiKey: true,
                    baseUrl:
                        "http://127.0.0.1:1234/v1"
                }
            }
        }),
        error => error instanceof
            BrokerProtocolError
    );
});

test("el catálogo de LM Studio conserva sólo modelos locales válidos", () => {
    const message = createBrokerHostMessage({
        type:
            BrokerHostMessageType
                .LM_STUDIO_MODELS,
        requestId: "request:local-models",
        payload: {
            providerId: "lm-studio",
            baseUrl:
                "http://localhost:1234/v1/",
            models: [
                "qwen/qwen3-8b",
                "meta/llama-3.2"
            ]
        }
    });

    assert.deepEqual(message.payload, {
        providerId: "lm-studio",
        baseUrl:
            "http://localhost:1234/v1",
        models: [
            "qwen/qwen3-8b",
            "meta/llama-3.2"
        ]
    });

    for (const payload of [
        {
            providerId: "groq",
            baseUrl:
                "http://localhost:1234/v1",
            models: ["modelo"]
        },
        {
            providerId: "lm-studio",
            baseUrl:
                "http://192.168.1.20:1234/v1",
            models: ["modelo"]
        },
        {
            providerId: "lm-studio",
            baseUrl:
                "http://localhost:1234/v1",
            models: ["modelo", "modelo"]
        },
        {
            providerId: "lm-studio",
            baseUrl:
                "http://localhost:1234/v1",
            models: ["modelo\ninyectado"]
        }
    ]) {
        assert.throws(
            () => createBrokerHostMessage({
                type:
                    BrokerHostMessageType
                        .LM_STUDIO_MODELS,
                requestId:
                    "request:invalid-local-models",
                payload
            }),
            error =>
                error.code ===
                    "BROKER95_PROTOCOL_PAYLOAD_INVALID"
        );
    }
});

test("la configuración pública acepta sólo proveedores registrados", () => {
    const valid = createBrokerHostMessage({
        type:
            BrokerHostMessageType
                .SETTINGS_UPDATED,
        payload: {
            settings: {
                providerId: "groq",
                model: "modelo",
                hasApiKey: true
            }
        }
    });

    assert.equal(
        valid.payload.settings.providerId,
        "groq"
    );
    assert.deepEqual(
        valid.payload.settings.credential,
        {
            kind: "api-key",
            required: true,
            configured: true
        }
    );
    const gemini = createBrokerHostMessage({
        type: BrokerHostMessageType.SETTINGS_UPDATED,
        payload: {
            settings: {
                providerId: "gemini",
                model: "modelo",
                hasApiKey: true
            }
        }
    });

    assert.equal(
        gemini.payload.settings.providerId,
        "gemini"
    );
    assert.throws(
        () => createBrokerHostMessage({
            type: BrokerHostMessageType.SETTINGS_UPDATED,
            payload: {
                settings: {
                    providerId: "unregistered-provider",
                    model: "modelo",
                    hasApiKey: true
                }
            }
        }),
        error => error.code === "BROKER95_PROTOCOL_PAYLOAD_INVALID"
    );
    assert.throws(
        () => createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .SETTINGS_UPDATED,
            payload: {
                settings: {
                    providerId: "groq",
                    model: "modelo",
                    hasApiKey: true,
                    credential: {
                        kind: "api-key",
                        required: true,
                        configured: false
                    }
                }
            }
        }),
        error =>
            error.code ===
                "BROKER95_PROTOCOL_PAYLOAD_INVALID"
    );
});

test("la configuración pública valida el catálogo operativo enviado por el Host", () => {
    const local =
        createBrokerLLMProviderDescriptor({
            id: "local-test",
            label: "Proveedor local",
            credentialKind:
                BrokerLLMCredentialKind.NONE,
            endpointKind:
                BrokerLLMEndpointKind.LOCAL,
            capabilities: {
                streaming:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED,
                jsonObject:
                    BrokerLLMCapabilitySupport
                        .MODEL_DEPENDENT,
                strictJsonSchema:
                    BrokerLLMCapabilitySupport
                        .UNSUPPORTED,
                connectionTest:
                    BrokerLLMCapabilitySupport
                        .SUPPORTED
            }
        });
    const valid = createBrokerHostMessage({
        type:
            BrokerHostMessageType
                .SETTINGS_UPDATED,
        payload: {
            settings: {
                providerId: "local-test",
                providers: [local],
                model: "modelo-local",
                credential: {
                    kind: "none",
                    required: false,
                    configured: true
                },
                hasApiKey: false
            }
        }
    });

    assert.deepEqual(
        valid.payload.settings.providers,
        [local]
    );
    assert.throws(
        () => createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .SETTINGS_UPDATED,
            payload: {
                settings: {
                    providerId: "local-test",
                    providers: [local, local],
                    model: "modelo-local",
                    credential: {
                        kind: "none",
                        required: false,
                        configured: true
                    },
                    hasApiKey: false
                }
            }
        }),
        error =>
            error.code ===
                "BROKER95_PROTOCOL_PAYLOAD_INVALID"
    );
});

test("los errores de credenciales no filtran su contenido", () => {
    const secret =
        `SECRETO-${"x".repeat(17000)}`;

    assert.throws(
        () => createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .SET_API_KEY,
            requestId: "request:secret",
            payload: {
                apiKey: secret
            }
        }),
        error => {
            const exposed = JSON.stringify({
                message: error.message,
                publicMessage:
                    error.publicMessage,
                diagnostics:
                    error.diagnostics
            });

            return error instanceof
                    BrokerProtocolError &&
                !exposed.includes("SECRETO-");
        }
    );
});

test("valida coherencia entre estado y causa del LLM", () => {
    assert.throws(
        () => createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .LLM_STATUS,
            payload: {
                llmStatus: {
                    status:
                        BrokerLlmStatus.READY,
                    reason:
                        BrokerLlmStatusReason
                            .MISSING_MODEL,
                    message: "Estado imposible."
                }
            }
        }),
        error =>
            error.code ===
            "BROKER95_PROTOCOL_PAYLOAD_INVALID"
    );
});

test("valida coherencia del estado ocupado", () => {
    assert.throws(
        () => createBrokerHostMessage({
            type:
                BrokerHostMessageType
                    .OPERATION_STATUS,
            payload: {
                status:
                    BrokerOperationStatus.BUSY,
                operation: null
            }
        }),
        error =>
            error.code ===
            "BROKER95_PROTOCOL_PAYLOAD_INVALID"
    );
});

test("normaliza y congela snapshots antes de publicarlos", () => {
    const source = {
        model: "  modelo-prueba  ",
        hasApiKey: true
    };
    const message = createBrokerHostMessage({
        type:
            BrokerHostMessageType
                .SETTINGS_UPDATED,
        payload: {
            settings: source
        }
    });

    source.model = "mutado";

    assert.equal(
        message.payload.settings.model,
        "modelo-prueba"
    );
    assert.equal(
        message.payload.settings.providerId,
        "groq"
    );
    assert.equal(
        Object.isFrozen(message),
        true
    );
    assert.equal(
        Object.isFrozen(message.payload),
        true
    );
    assert.equal(
        Object.isFrozen(
            message.payload.settings
        ),
        true
    );
    assert.deepEqual(
        message.payload.settings.audio,
        {
            muted: false,
            volume: 45
        }
    );
});

test("el protocolo sobrevive un ciclo JSON completo", () => {
    const original = createBrokerWebviewMessage({
        type:
            BrokerWebviewMessageType.READY,
        requestId: "request:json",
        payload: {
            clientVersion: "1.3.9"
        }
    });
    const restored =
        parseBrokerWebviewMessage(
            JSON.parse(
                JSON.stringify(original)
            )
        );

    assert.deepEqual(restored, original);
});

test("el Webview puede validar mensajes recibidos del Host", () => {
    const original = createBrokerHostMessage({
        type: BrokerHostMessageType.ERROR,
        requestId: "request:error",
        payload: {
            code: "BROKER95_TEST",
            message: "Error controlado.",
            recoverable: true
        }
    });
    const parsed = parseBrokerHostMessage(
        JSON.parse(JSON.stringify(original))
    );

    assert.deepEqual(parsed, original);
});

test("el protocolo limita las preferencias de audio", () => {
    const valid = createBrokerWebviewMessage({
        type: BrokerWebviewMessageType.SET_AUDIO,
        requestId: "request:audio",
        payload: {
            muted: true,
            volume: 72
        }
    });

    assert.deepEqual(valid.payload, {
        muted: true,
        volume: 72
    });
    assertProtocolError(
        {
            ...valid,
            payload: {
                muted: false,
                volume: 101
            }
        },
        "BROKER95_PROTOCOL_PAYLOAD_INVALID"
    );
    assertProtocolError(
        {
            ...valid,
            payload: {
                muted: false,
                volume: 50,
                masterGain: 1
            }
        },
        "BROKER95_PROTOCOL_PAYLOAD_INVALID"
    );
});

function webviewMessage() {
    return createBrokerWebviewMessage({
        type:
            BrokerWebviewMessageType
                .SUBMIT_TERMINAL,
        requestId: "request:valid",
        payload: {
            input: "ai -get"
        }
    });
}

function assertProtocolError(value, code) {
    assert.throws(
        () => parseBrokerWebviewMessage(
            value
        ),
        error =>
            error instanceof
                BrokerProtocolError &&
            error.code === code &&
            typeof error.publicMessage ===
                "string"
    );
}
