import test from "node:test";
import assert from "node:assert/strict";

import {
    BrokerHostMessageType,
    BrokerLlmStatus,
    BrokerLlmStatusReason,
    BrokerWebviewRequestGuard,
    BrokerWebviewMessageType,
    createBrokerGameState,
    createBrokerPublicGameState,
    createBrokerWebviewMessage,
    listBrokerLLMProviderDescriptors,
    parseBrokerHostMessage
} from "../src/broker95/index.js";
import {
    BrokerCommandController
} from "../extension/controllers/BrokerCommandController.js";
import {
    VSCodeBrokerHost
} from "../extension/adapters/VSCodeBrokerHost.js";

const llmStatus = Object.freeze({
    status: BrokerLlmStatus.UNCONFIGURED,
    reason:
        BrokerLlmStatusReason.MISSING_MODEL,
    message:
        "Introduce un modelo para conectar a CIPHER."
});
const publicConfiguration = Object.freeze({
    settings: Object.freeze({
        providerId: "groq",
        providers:
            listBrokerLLMProviderDescriptors(),
        model: "",
        credential: Object.freeze({
            kind: "api-key",
            required: true,
            configured: false
        }),
        hasApiKey: false,
        audio: Object.freeze({
            muted: false,
            volume: 45
        })
    }),
    llmStatus
});

test("abre una sola instancia de BROKER.95 y completa el handshake tipado", async () => {
    const panel = createPanel();
    const state = createBrokerGameState();
    const presented = [];
    let initialized = 0;
    let gameListener;
    let configurationListener;
    const controller =
        new BrokerCommandController({
            host: {
                createPanel() {
                    return panel;
                }
            },
            presenter: {
                present(result) {
                    presented.push(result);
                }
            },
            gameSession: {
                getState() {
                    return state;
                },
                subscribe(listener) {
                    gameListener = listener;
                    return disposable();
                }
            },
            configuration: {
                getSnapshot() {
                    return publicConfiguration;
                },
                subscribe(listener) {
                    configurationListener =
                        listener;
                    return disposable();
                }
            },
            async initialize() {
                initialized += 1;
            },
            createSessionId() {
                return "broker95:test-session";
            },
            developerLogger: silentLogger()
        });

    const first = controller.open({});
    const second = controller.open({});

    assert.equal(first.ok, true);
    assert.equal(first.value.reused, false);
    assert.equal(second.ok, true);
    assert.equal(second.value.reused, true);
    assert.equal(panel.revealCount, 1);

    const ready =
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType.READY,
            requestId: "request:ready",
            payload: {
                clientVersion: "1.3.9"
            }
        });
    const result =
        await controller.handleMessage(
            ready
        );

    assert.equal(result.ok, true);
    assert.equal(initialized, 1);
    assert.equal(panel.messages.length, 1);

    const response = parseBrokerHostMessage(
        panel.messages[0]
    );

    assert.equal(
        response.type,
        BrokerHostMessageType.READY
    );
    assert.equal(
        response.requestId,
        "request:ready"
    );
    assert.equal(
        response.payload.sessionId,
        "broker95:test-session"
    );
    assert.deepEqual(
        response.payload.state,
        createBrokerPublicGameState(state)
    );
    assert.deepEqual(
        response.payload.settings,
        publicConfiguration.settings
    );
    assert.equal(
        Object.hasOwn(
            response.payload.settings,
            "apiKey"
        ),
        false
    );

    gameListener(state);
    configurationListener(
        publicConfiguration
    );
    await Promise.resolve();

    assert.deepEqual(
        panel.messages.slice(1)
            .map(message => message.type),
        [
            BrokerHostMessageType
                .STATE_UPDATED,
            BrokerHostMessageType
                .SETTINGS_UPDATED,
            BrokerHostMessageType.LLM_STATUS
        ]
    );
    assert.deepEqual(presented, []);

    controller.dispose();
    controller.dispose();

    assert.equal(panel.disposed, true);
    assert.ok(
        panel.resources.every(
            resource => resource.disposed
        )
    );
});

test("titula BROKER.95 con el documento CLRS inicial y revela el mismo panel", () => {
    const revealCalls = [];
    const createdPanels = [];
    const rawPanel = {
        viewColumn: 6,
        webview: {
            html: "",
            postMessage() {},
            onDidReceiveMessage() {
                return disposable();
            }
        },
        onDidDispose() {
            return disposable();
        },
        reveal(...args) {
            revealCalls.push(args);
        },
        dispose() {}
    };
    const vscode = {
        ViewColumn: { Beside: 2 },
        Uri: {
            joinPath() {
                return {};
            }
        },
        window: {
            activeTextEditor: {
                document: {
                    languageId: "clrs-es",
                    fileName:
                        "C:\\workspace\\reto.clrs",
                    uri: {
                        fsPath:
                            "C:\\workspace\\reto.clrs"
                    }
                }
            },
            createWebviewPanel(
                viewType,
                title
            ) {
                createdPanels.push({
                    viewType,
                    title
                });
                return rawPanel;
            }
        }
    };
    const host = new VSCodeBrokerHost(
        vscode,
        () => "<html></html>",
        {
            brokerViewType: "clrsBroker95",
            brokerTitle: "BROKER.95",
            languageId: "clrs-es"
        }
    );
    const panel = host.createPanel({
        extensionUri: {}
    });

    panel.reveal();

    assert.deepEqual(createdPanels, [
        {
            viewType: "clrsBroker95",
            title: "BROKER.95 - reto.clrs"
        }
    ]);
    assert.deepEqual(
        revealCalls,
        [[6, true]]
    );
});

test("rechaza mensajes inválidos y operaciones todavía no compuestas", async () => {
    const panel = createPanel();
    const controller = createController(panel);

    controller.open({});

    const invalid =
        await controller.handleMessage({});

    assert.equal(invalid.ok, false);
    assert.equal(
        panel.messages.at(-1).type,
        BrokerHostMessageType.ERROR
    );
    assert.equal(
        panel.messages.at(-1)
            .payload.recoverable,
        true
    );

    const unavailable =
        await controller.handleMessage(
            createBrokerWebviewMessage({
                type:
                    BrokerWebviewMessageType
                        .SUBMIT_TERMINAL,
                requestId:
                    "request:terminal",
                payload: {
                    input: "ai -?"
                }
            })
        );

    assert.equal(unavailable.ok, false);
    assert.equal(
        panel.messages.at(-1)
            .requestId,
        "request:terminal"
    );
    assert.equal(
        panel.messages.at(-1).payload.code,
        "BROKER95_OPERATION_NOT_AVAILABLE"
    );

    const replay =
        await controller.handleMessage(
            createBrokerWebviewMessage({
                type:
                    BrokerWebviewMessageType
                        .SUBMIT_TERMINAL,
                requestId:
                    "request:terminal",
                payload: {
                    input: "ai -?"
                }
            })
        );

    assert.equal(replay.ok, false);
    assert.equal(
        panel.messages.at(-1).payload.code,
        "BROKER95_PROTOCOL_REQUEST_REPLAYED"
    );

    controller.dispose();
});

test("aplica una contramedida económica desde el Webview y correlaciona la respuesta", async () => {
    const panel = createPanel();
    const purchases = [];
    const controller = createController(
        panel,
        {
            economy: {
                async purchase(id, execution) {
                    purchases.push({
                        id,
                        execution
                    });

                    return Object.freeze({
                        operation:
                            "economy/purchase-countermeasure",
                        countermeasure:
                            Object.freeze({
                                id,
                                name:
                                    "Borrar rastros",
                                price: 250,
                                reduction: 1,
                                reset: false
                            }),
                        money: 750,
                        alertLevel: 2,
                        stateRevision: 4,
                        messages: Object.freeze([
                            Object.freeze({
                                kind: "system",
                                text:
                                    "Contramedida aplicada: Borrar rastros."
                            })
                        ])
                    });
                }
            }
        }
    );

    controller.open({});

    const result = await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .PURCHASE_COUNTERMEASURE,
            requestId: "request:economy",
            payload: {
                countermeasureId: "scrub"
            }
        })
    );

    assert.equal(result.ok, true);
    assert.deepEqual(purchases, [{
        id: "scrub",
        execution: {
            requestId: "request:economy"
        }
    }]);
    assert.deepEqual(
        panel.messages.map(message =>
            message.type
        ),
        [
            BrokerHostMessageType
                .OPERATION_STATUS,
            BrokerHostMessageType
                .TERMINAL_APPEND,
            BrokerHostMessageType
                .OPERATION_STATUS
        ]
    );
    assert.equal(
        panel.messages[1].requestId,
        "request:economy"
    );
    assert.match(
        panel.messages[1].payload
            .entries[0].text,
        /Borrar rastros/
    );
    assert.equal(
        panel.messages[2].payload.status,
        "idle"
    );

    controller.dispose();
});

test("aplica contrapresión mientras una operación del Webview sigue pendiente", async () => {
    const panel = createPanel();
    let releasePurchase;
    const purchaseResult =
        new Promise(resolve => {
            releasePurchase = () => resolve(
                Object.freeze({
                    operation:
                        "economy/purchase-countermeasure",
                    countermeasure:
                        Object.freeze({
                            id: "scrub"
                        }),
                    money: 0,
                    alertLevel: 0,
                    stateRevision: 1,
                    messages: Object.freeze([
                        Object.freeze({
                            kind: "system",
                            text:
                                "Contramedida aplicada."
                        })
                    ])
                })
            );
        });
    const controller = createController(
        panel,
        {
            economy: {
                purchase() {
                    return purchaseResult;
                }
            },
            requestGuard:
                new BrokerWebviewRequestGuard({
                    maxInFlight: 1,
                    maxRemembered: 8,
                    maxRequestsPerWindow: 8,
                    windowMs: 1_000,
                    clock: () => 100
                })
        }
    );

    controller.open({});

    const pending = controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .PURCHASE_COUNTERMEASURE,
            requestId: "request:pending",
            payload: {
                countermeasureId: "scrub"
            }
        })
    );

    await Promise.resolve();

    const rejected =
        await controller.handleMessage(
            createBrokerWebviewMessage({
                type:
                    BrokerWebviewMessageType
                        .REQUEST_STATE,
                requestId: "request:parallel",
                payload: {}
            })
        );

    assert.equal(rejected.ok, false);
    assert.equal(
        panel.messages.at(-1).payload.code,
        "BROKER95_PROTOCOL_REQUEST_LIMIT_EXCEEDED"
    );

    releasePurchase();

    assert.equal((await pending).ok, true);

    controller.dispose();
});

test("bloquea los comandos LLM sin modelo antes de alterar la partida", async () => {
    const panel = createPanel();
    const controller = createController(panel);

    controller.open({});

    for (const [index, input] of [
        "ai -new",
        "ai -review",
        "ai -push"
    ].entries()) {
        const result = await controller.handleMessage(
            createBrokerWebviewMessage({
                type:
                    BrokerWebviewMessageType
                        .SUBMIT_TERMINAL,
                requestId: `request:llm:${index}`,
                payload: { input }
            })
        );
        const response = panel.messages.at(-1);

        assert.equal(result.ok, false);
        assert.equal(
            response.type,
            BrokerHostMessageType.ERROR
        );
        assert.equal(
            response.payload.code,
            "BROKER95_LLM_MODEL_MISSING"
        );
        assert.match(
            response.payload.message,
            /CIPHER DESCONECTADO/u
        );
    }

    controller.dispose();
});

test("rechaza los mensajes libres antes de consultar la disponibilidad del LLM", async () => {
    const panel = createPanel();
    const controller = createController(panel);

    controller.open({});

    const result = await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .SUBMIT_TERMINAL,
            requestId: "request:free-message",
            payload: {
                input: "ai necesito una pista"
            }
        })
    );
    const response = panel.messages.at(-1);

    assert.equal(result.ok, false);
    assert.equal(
        response.payload.code,
        "BROKER95_TERMINAL_FREE_MESSAGE_DISABLED"
    );

    controller.dispose();
});

test("ejecuta el ciclo de contratos y publica una respuesta de terminal correlacionada", async () => {
    const panel = createPanel();
    const state = createBrokerGameState();
    const commands = [];
    const controller = new BrokerCommandController({
        host: {
            createPanel() {
                return panel;
            }
        },
        presenter: { present() {} },
        gameSession: {
            getState() {
                return state;
            },
            subscribe() {
                return disposable();
            }
        },
        configuration: {
            getSnapshot() {
                return publicConfiguration;
            },
            subscribe() {
                return disposable();
            }
        },
        contractCycle: {
            canExecute(command) {
                return command.type === "help";
            },
            async execute(command, execution) {
                commands.push({
                    command,
                    execution
                });

                return Object.freeze({
                    operation: "contract/help",
                    messages: Object.freeze([Object.freeze({
                        kind: "system",
                        text: "AYUDA DISPONIBLE"
                    })])
                });
            }
        },
        async initialize() {},
        createSessionId() {
            return "broker95:cycle-test";
        },
        developerLogger: silentLogger()
    });

    controller.open({});
    await controller.handleMessage(
        createBrokerWebviewMessage({
            type: BrokerWebviewMessageType.READY,
            requestId: "request:ready",
            payload: { clientVersion: null }
        })
    );
    const result = await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .SUBMIT_TERMINAL,
            requestId: "request:help",
            payload: { input: "ai -?" }
        })
    );
    const terminal = panel.messages.find(message =>
        message.type ===
        BrokerHostMessageType.TERMINAL_APPEND
    );
    const statuses = panel.messages.filter(message =>
        message.type ===
        BrokerHostMessageType.OPERATION_STATUS
    );

    assert.equal(result.ok, true);
    assert.equal(commands.length, 1);
    assert.equal(
        commands[0].command.type,
        "help"
    );
    assert.deepEqual(
        commands[0].execution,
        { requestId: "request:help" }
    );
    assert.equal(terminal.requestId, "request:help");
    assert.equal(terminal.payload.entries[0].kind, "system");
    assert.equal(terminal.payload.entries[0].text, "AYUDA DISPONIBLE");
    assert.deepEqual(
        statuses.map(message => message.payload.status),
        ["busy", "idle"]
    );

    controller.dispose();
});

test("ejecuta ai -review como tutoría CIPHER correlacionada y no definitiva", async () => {
    const panel = createPanel();
    const state = createBrokerGameState();
    const configuration = createConfiguration(
        "modelo-revision",
        true
    );
    const calls = [];
    const controller = new BrokerCommandController({
        host: {
            createPanel() {
                return panel;
            }
        },
        presenter: { present() {} },
        gameSession: {
            getState() {
                return state;
            },
            subscribe() {
                return disposable();
            }
        },
        configuration: {
            getSnapshot() {
                return configuration;
            },
            subscribe() {
                return disposable();
            }
        },
        submissionReview: {
            async review(options) {
                calls.push(options);

                return Object.freeze({
                    contractId: 7,
                    document: Object.freeze({
                        name: "solucion.clrs",
                        languageId: "clrs-es",
                        version: 4,
                        sourceHash: "hash-privado"
                    }),
                    deterministicEvidence:
                        Object.freeze({
                            testSummary:
                                Object.freeze({
                                    total: 2,
                                    passed: 1
                                })
                        }),
                    review: Object.freeze({
                        reviewVersion: 1,
                        summary:
                            "La solución requiere un ajuste.",
                        readiness:
                            "needs-changes",
                        findings: Object.freeze([
                            Object.freeze({
                                severity: "important",
                                criterion: "F-COR",
                                location: "PRINCIPAL",
                                problem:
                                    "Un resultado no coincide.",
                                evidence:
                                    "Una prueba no fue superada.",
                                recommendation:
                                    "Revisa el cálculo."
                            })
                        ]),
                        nextSteps: Object.freeze([
                            "Corrige y vuelve a revisar."
                        ])
                    })
                });
            }
        },
        async initialize() {},
        createSessionId() {
            return "broker95:review-test";
        },
        developerLogger: silentLogger()
    });

    controller.open({});
    const result = await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .SUBMIT_TERMINAL,
            requestId: "request:review",
            payload: {
                input:
                    "ai -review \"Curso Uno/tareas/solucion.clrs\""
            }
        })
    );
    const cipher = panel.messages.find(message =>
        message.type ===
            BrokerHostMessageType.CIPHER_STREAM
    );
    const statuses = panel.messages.filter(message =>
        message.type ===
            BrokerHostMessageType.OPERATION_STATUS
    );

    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(
        calls[0].requestId,
        "request:review"
    );
    assert.equal(
        calls[0].signal instanceof AbortSignal,
        true
    );
    assert.equal(
        calls[0].documentSelector,
        "Curso Uno/tareas/solucion.clrs"
    );
    assert.equal(cipher.requestId, "request:review");
    assert.equal(cipher.payload.phase, "end");
    assert.match(
        cipher.payload.text,
        /REVISIÓN NO DEFINITIVA/u
    );
    assert.match(cipher.payload.text, /F-COR/u);
    assert.deepEqual(
        statuses.map(message =>
            message.payload.status
        ),
        ["busy", "idle"]
    );
    assert.equal(
        panel.messages.some(message =>
            message.type ===
                BrokerHostMessageType
                    .TERMINAL_APPEND
        ),
        false
    );

    controller.dispose();
});

test("ejecuta ai -ask como tutoría abierta contextual", async () => {
    const panel = createPanel();
    const state = createBrokerGameState();
    const configuration = createConfiguration(
        "modelo-tutor",
        true
    );
    const calls = [];
    const controller = new BrokerCommandController({
        host: {
            createPanel() {
                return panel;
            }
        },
        presenter: { present() {} },
        gameSession: {
            getState() {
                return state;
            },
            subscribe() {
                return disposable();
            }
        },
        configuration: {
            getSnapshot() {
                return configuration;
            },
            subscribe() {
                return disposable();
            }
        },
        submissionAsk: {
            async ask(options) {
                calls.push(options);

                return Object.freeze({
                    contract: Object.freeze({
                        id: 7,
                        title: "Ciclo de señales"
                    }),
                    document: Object.freeze({
                        name: "solucion.clrs",
                        languageId: "clrs-es",
                        version: 4,
                        sourceHash: "hash-privado"
                    }),
                    answer:
                        "Tu condición sigue siendo verdadera. Revisa cuándo cambia i."
                });
            }
        },
        async initialize() {},
        createSessionId() {
            return "broker95:ask-test";
        },
        developerLogger: silentLogger()
    });

    controller.open({});
    const result = await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .SUBMIT_TERMINAL,
            requestId: "request:ask",
            payload: {
                input:
                    "ai -ask ¿Por qué mi ciclo no termina?"
            }
        })
    );
    const cipher = panel.messages.find(message =>
        message.type ===
            BrokerHostMessageType.CIPHER_STREAM
    );
    const statuses = panel.messages.filter(message =>
        message.type ===
            BrokerHostMessageType.OPERATION_STATUS
    );

    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(
        calls[0].question,
        "¿Por qué mi ciclo no termina?"
    );
    assert.equal(
        calls[0].signal instanceof AbortSignal,
        true
    );
    assert.match(cipher.payload.streamId, /^ask:/u);
    assert.match(
        cipher.payload.text,
        /CIPHER \/\/ CONSULTA/u
    );
    assert.match(
        cipher.payload.text,
        /Revisa cuándo cambia i/u
    );
    assert.deepEqual(
        statuses.map(message =>
            message.payload.status
        ),
        ["busy", "idle"]
    );

    controller.dispose();
});

test("ejecuta ai -push como entrega definitiva correlacionada", async () => {
    const panel = createPanel();
    const state = createBrokerGameState();
    const configuration = createConfiguration(
        "modelo-evaluador",
        true
    );
    const calls = [];
    const controller = new BrokerCommandController({
        host: {
            createPanel() {
                return panel;
            }
        },
        presenter: { present() {} },
        gameSession: {
            getState() {
                return state;
            },
            subscribe() {
                return disposable();
            }
        },
        configuration: {
            getSnapshot() {
                return configuration;
            },
            subscribe() {
                return disposable();
            }
        },
        submissionPush: {
            async push(options) {
                calls.push(options);
                return pushResult();
            }
        },
        async initialize() {},
        createSessionId() {
            return "broker95:push-test";
        },
        developerLogger: silentLogger()
    });

    controller.open({});
    const result = await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .SUBMIT_TERMINAL,
            requestId: "request:push",
            payload: {
                input:
                    "ai -push Practicas/final.clrs"
            }
        })
    );
    const cipher = panel.messages.find(message =>
        message.type ===
            BrokerHostMessageType.CIPHER_STREAM
    );
    const statuses = panel.messages.filter(message =>
        message.type ===
            BrokerHostMessageType.OPERATION_STATUS
    );

    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].requestId, "request:push");
    assert.equal(
        calls[0].signal instanceof AbortSignal,
        true
    );
    assert.equal(
        calls[0].documentSelector,
        "Practicas/final.clrs"
    );
    assert.equal(cipher.requestId, "request:push");
    assert.match(cipher.payload.streamId, /^push:/u);
    assert.match(cipher.payload.text, /ENTREGA DEFINITIVA/u);
    assert.match(cipher.payload.text, /Calificación final: 85\/100/u);
    assert.deepEqual(
        statuses.map(message =>
            message.payload.status
        ),
        ["busy", "idle"]
    );

    controller.dispose();
});

test("guarda modelo y credencial sin devolver secretos al Webview", async () => {
    const panel = createPanel();
    const state = createBrokerGameState();
    let apiKey = null;
    let baseUrl = null;
    let snapshot = publicConfiguration;
    const controller = new BrokerCommandController({
        host: {
            createPanel() {
                return panel;
            }
        },
        presenter: { present() {} },
        gameSession: {
            getState() {
                return state;
            },
            subscribe() {
                return disposable();
            }
        },
        configuration: {
            getSnapshot() {
                return snapshot;
            },
            subscribe() {
                return disposable();
            }
        },
        configurationCommands: {
            async setProvider(providerId) {
                assert.equal(providerId, "groq");
            },
            async setBaseUrl(value) {
                baseUrl = value;
            },
            async setModel(model) {
                snapshot = createConfiguration(
                    model,
                    apiKey != null
                );
            },
            async setApiKey(value) {
                apiKey = value;
                snapshot = createConfiguration(
                    snapshot.settings.model,
                    true
                );
            },
            async deleteApiKey() {
                apiKey = null;
                snapshot = createConfiguration(
                    snapshot.settings.model,
                    false
                );
            },
            async setAudioPreferences(audio) {
                snapshot = Object.freeze({
                    ...snapshot,
                    settings: Object.freeze({
                        ...snapshot.settings,
                        audio: Object.freeze({
                            ...audio
                        })
                    })
                });
            }
        },
        async initialize() {},
        createSessionId() {
            return "broker95:settings-test";
        },
        developerLogger: silentLogger()
    });

    controller.open({});
    await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType.READY,
            requestId: "request:ready",
            payload: { clientVersion: null }
        })
    );
    await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .SET_BASE_URL,
            requestId: "request:base-url",
            payload: {
                baseUrl:
                    "http://127.0.0.1:1234/v1"
            }
        })
    );
    await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .SET_PROVIDER,
            requestId: "request:provider",
            payload: {
                providerId: "groq"
            }
        })
    );
    await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .SET_MODEL,
            requestId: "request:model",
            payload: {
                model: "modelo-prueba"
            }
        })
    );
    await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .SET_API_KEY,
            requestId: "request:key",
            payload: {
                apiKey: "secreto-no-publicable"
            }
        })
    );
    await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .SET_AUDIO,
            requestId: "request:audio",
            payload: {
                muted: true,
                volume: 72
            }
        })
    );

    assert.equal(
        apiKey,
        "secreto-no-publicable"
    );
    assert.equal(
        baseUrl,
        "http://127.0.0.1:1234/v1"
    );
    assert.equal(
        snapshot.settings.model,
        "modelo-prueba"
    );
    assert.equal(
        snapshot.settings.hasApiKey,
        true
    );
    assert.deepEqual(
        snapshot.settings.audio,
        {
            muted: true,
            volume: 72
        }
    );
    assert.equal(
        JSON.stringify(panel.messages)
            .includes(
                "secreto-no-publicable"
            ),
        false
    );
    assert.equal(
        panel.messages.some(message =>
            message.requestId ===
                "request:provider" &&
            message.type ===
                BrokerHostMessageType
                    .SETTINGS_UPDATED
        ),
        true
    );
    assert.equal(
        panel.messages.some(message =>
            message.requestId ===
                "request:key" &&
            message.type ===
                BrokerHostMessageType
                    .SETTINGS_UPDATED
        ),
        true
    );
    assert.equal(
        panel.messages.some(message =>
            message.requestId ===
                "request:audio" &&
            message.type ===
                BrokerHostMessageType
                    .SETTINGS_UPDATED
        ),
        true
    );

    controller.dispose();
});

test("atiende las acciones de datos locales desde los paneles", async () => {
    const panel = createPanel();
    let state = createBrokerGameState({
        money: 375,
        alertLevel: 2,
        categoryHistory: {
            "NUM-ARITH": {
                categoryId: "NUM-ARITH",
                familyId: "NUM",
                generatedCount: 1,
                acceptedCount: 0,
                completedCount: 0,
                failedCount: 0,
                lastGenerated: 1,
                lastCompleted: null
            }
        },
        statistics: {
            completed: 1,
            failed: 0,
            totalEarned: 375,
            byRisk: {
                low: {
                    completed: 1,
                    failed: 0
                }
            },
            familyCompleted: {
                NUM: 1
            }
        },
        technicalProfile: {
            functionality: {
                sum: 90,
                sampleCount: 1
            }
        }
    });
    const controller = new BrokerCommandController({
        host: {
            createPanel() {
                return panel;
            }
        },
        presenter: { present() {} },
        gameSession: {
            getState() {
                return state;
            },
            subscribe() {
                return disposable();
            },
            async transact(transition) {
                state = transition(state);
                return state;
            }
        },
        configuration: {
            getSnapshot() {
                return publicConfiguration;
            },
            subscribe() {
                return disposable();
            }
        },
        async initialize() {},
        createSessionId() {
            return "broker95:panel-actions";
        },
        developerLogger: silentLogger()
    });

    const preservedCategoryHistory =
        state.categoryHistory;

    controller.open({});
    const resetResult =
        await controller.handleMessage(
            createBrokerWebviewMessage({
                type:
                    BrokerWebviewMessageType
                        .RESET_GAME_PROGRESS,
                requestId:
                    "request:reset-progress",
                payload: {}
            })
        );
    assert.equal(resetResult.ok, true);
    assert.equal(state.money, 0);
    assert.equal(state.alertLevel, 0);
    assert.equal(state.statistics.completed, 0);
    assert.equal(
        state.technicalProfile.functionality
            .sampleCount,
        0
    );
    assert.deepEqual(
        state.categoryHistory,
        preservedCategoryHistory
    );

    const clearResult =
        await controller.handleMessage(
            createBrokerWebviewMessage({
                type:
                    BrokerWebviewMessageType
                        .CLEAR_CATEGORY_HISTORY,
                requestId:
                    "request:clear-history",
                payload: {}
            })
        );

    assert.equal(clearResult.ok, true);
    assert.deepEqual(state.categoryHistory, {});
    assert.equal(
        panel.messages.filter(message =>
            message.type ===
                BrokerHostMessageType
                    .TERMINAL_APPEND
        ).length,
        2
    );
    assert.deepEqual(
        panel.messages
            .filter(message =>
                message.type ===
                    BrokerHostMessageType
                        .OPERATION_STATUS
            )
            .map(message =>
                message.payload.status
            ),
        ["busy", "idle", "busy", "idle"]
    );

    controller.dispose();
});

function pushResult() {
    return Object.freeze({
        contract: Object.freeze({
            id: 7,
            title: "Contrato evaluado",
            risk: "low",
            state: "completed",
            completed: true,
            payPotential: 100,
            payout: 90,
            payoutMultiplier: 0.9,
            closedAt: 10
        }),
        document: Object.freeze({
            name: "solucion.clrs",
            languageId: "clrs-es",
            version: 4,
            sourceHash: "hash-privado"
        }),
        deterministicEvidence: Object.freeze({
            testSummary: Object.freeze({
                total: 2,
                passed: 2
            })
        }),
        evaluation: Object.freeze({
            summary: "La entrega fue aprobada.",
            criteria: Object.freeze([
                "F-CUM",
                "F-COR",
                "F-LIM"
            ].map(criterion => Object.freeze({
                criterion,
                score: 85,
                evidence: Object.freeze([
                    "Evidencia observable."
                ]),
                rationale:
                    "Puntuación justificada."
            }))),
            findings: Object.freeze([])
        }),
        criterionScores: Object.freeze({
            "F-CUM": 85,
            "F-COR": 85,
            "F-LIM": 85
        }),
        dimensionScores: Object.freeze({
            functionality: 85
        }),
        finalScore: 85,
        settlement: Object.freeze({
            performed: true,
            stateRevision: 3,
            money: 90,
            alertLevel: 0,
            completedContracts: 1,
            failedContracts: 0
        })
    });
}

test("comprueba el proveedor seleccionado desde Configuración sin exponer credenciales", async () => {
    const panel = createPanel();
    const configuration =
        createConfiguration(
            "modelo-prueba",
            true
        );
    const calls = [];
    const controller = createController(
        panel,
        {
            configuration: {
                getSnapshot() {
                    return configuration;
                },
                subscribe() {
                    return disposable();
                }
            },
            llm: {
                async testConnection(
                    request,
                    execution
                ) {
                    calls.push({
                        request,
                        aborted:
                            execution.signal.aborted
                    });

                    return Object.freeze({
                        providerId: "groq",
                        model: request.model,
                        output: Object.freeze({
                            connected: true,
                            message:
                                "Modelo disponible."
                        })
                    });
                }
            }
        }
    );

    controller.open({});
    await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .TEST_LLM_CONNECTION,
            requestId:
                "request:test-connection",
            payload: {}
        })
    );

    assert.deepEqual(calls, [{
        request: {
            requestId:
                "request:test-connection",
            model: "modelo-prueba"
        },
        aborted: false
    }]);
    assert.deepEqual(
        panel.messages.map(message =>
            message.type
        ),
        [
            BrokerHostMessageType
                .OPERATION_STATUS,
            BrokerHostMessageType
                .LLM_CONNECTION_RESULT,
            BrokerHostMessageType
                .OPERATION_STATUS
        ]
    );
    assert.equal(
        panel.messages[1].payload.message,
        "Modelo disponible."
    );
    assert.equal(
        JSON.stringify(panel.messages)
            .includes("api" + "Key"),
        false
    );

    controller.dispose();
});

test("permite volver a comprobar tras un fallo sin omitir la configuración obligatoria", async () => {
    for (const [model, hasKey, shouldCall] of [
        ["modelo-prueba", true, true],
        ["", true, false],
        ["modelo-prueba", false, false]
    ]) {
        const panel = createPanel();
        const saved = createConfiguration(model, hasKey);
        const snapshot = {
            ...saved,
            llmStatus: { status: "unavailable", reason: "authentication_failed", message: "Credencial rechazada." }
        };
        let calls = 0;
        const controller = createController(panel, {
            configuration: { getSnapshot: () => snapshot, subscribe: () => disposable() },
            llm: {
                async testConnection() {
                    calls += 1;
                    return { providerId: "groq", model, output: { connected: true, message: "Modelo disponible." } };
                }
            }
        });
        controller.open({});
        const result = await controller.handleMessage(createBrokerWebviewMessage({
            type: BrokerWebviewMessageType.TEST_LLM_CONNECTION,
            requestId: "request:retry-connection",
            payload: {}
        }));
        assert.equal(calls, shouldCall ? 1 : 0);
        assert.equal(result.ok, shouldCall);
        controller.dispose();
    }
});

test("descubre modelos de LM Studio sin exigir una selección previa", async () => {
    const panel = createPanel();
    const configuration =
        createLmStudioConfiguration();
    const calls = [];
    const controller = createController(
        panel,
        {
            configuration: {
                getSnapshot() {
                    return configuration;
                },
                subscribe() {
                    return disposable();
                }
            },
            lmStudioLocalService: {
                async discoverModels(execution) {
                    calls.push({
                        aborted:
                            execution.signal.aborted
                    });

                    return Object.freeze({
                        providerId: "lm-studio",
                        baseUrl:
                            "http://127.0.0.1:1234/v1",
                        models: Object.freeze([
                            "qwen/qwen3-8b",
                            "meta/llama-3.2"
                        ])
                    });
                }
            }
        }
    );

    controller.open({});
    const result = await controller.handleMessage(
        createBrokerWebviewMessage({
            type:
                BrokerWebviewMessageType
                    .DISCOVER_LM_STUDIO_MODELS,
            requestId:
                "request:discover-lm-studio",
            payload: {}
        })
    );

    assert.equal(result.ok, true);
    assert.deepEqual(calls, [{ aborted: false }]);
    assert.deepEqual(
        panel.messages.map(message =>
            message.type
        ),
        [
            BrokerHostMessageType
                .OPERATION_STATUS,
            BrokerHostMessageType
                .LM_STUDIO_MODELS,
            BrokerHostMessageType
                .OPERATION_STATUS
        ]
    );
    assert.deepEqual(
        panel.messages[1].payload.models,
        [
            "qwen/qwen3-8b",
            "meta/llama-3.2"
        ]
    );
    assert.equal(
        panel.messages[1].requestId,
        "request:discover-lm-studio"
    );

    controller.dispose();
});

function createController(
    panel,
    options = {}
) {
    const state = createBrokerGameState();

    return new BrokerCommandController({
        host: {
            createPanel() {
                return panel;
            }
        },
        presenter: {
            present() {}
        },
        gameSession: {
            getState() {
                return state;
            },
            subscribe() {
                return disposable();
            }
        },
        configuration: options.configuration ?? {
            getSnapshot() {
                return publicConfiguration;
            },
            subscribe() {
                return disposable();
            }
        },
        llm: options.llm,
        lmStudioLocalService:
            options.lmStudioLocalService,
        economy: options.economy,
        requestGuard:
            options.requestGuard,
        async initialize() {},
        createSessionId() {
            return "broker95:test-session";
        },
        developerLogger: silentLogger()
    });
}

function createLmStudioConfiguration() {
    return Object.freeze({
        settings: Object.freeze({
            providerId: "lm-studio",
            providers:
                listBrokerLLMProviderDescriptors(),
            model: "",
            credential: Object.freeze({
                kind: "optional-api-key",
                required: false,
                configured: false
            }),
            hasApiKey: false,
            baseUrl:
                "http://127.0.0.1:1234/v1",
            audio: Object.freeze({
                muted: false,
                volume: 45
            })
        }),
        llmStatus: Object.freeze({
            status:
                BrokerLlmStatus.UNCONFIGURED,
            reason:
                BrokerLlmStatusReason
                    .MISSING_MODEL,
            message:
                "Selecciona un modelo local."
        })
    });
}

function createConfiguration(
    model,
    hasApiKey
) {
    const configuredModel =
        model.trim().length > 0;

    return Object.freeze({
        settings: Object.freeze({
            providerId: "groq",
            providers:
                listBrokerLLMProviderDescriptors(),
            model,
            credential: Object.freeze({
                kind: "api-key",
                required: true,
                configured: hasApiKey
            }),
            hasApiKey,
            audio: Object.freeze({
                muted: false,
                volume: 45
            })
        }),
        llmStatus: Object.freeze({
            status:
                configuredModel && hasApiKey
                    ? BrokerLlmStatus.READY
                    : BrokerLlmStatus
                        .UNCONFIGURED,
            reason:
                !configuredModel
                    ? BrokerLlmStatusReason
                        .MISSING_MODEL
                    : !hasApiKey
                        ? BrokerLlmStatusReason
                            .MISSING_API_KEY
                        : BrokerLlmStatusReason
                            .READY,
            message:
                configuredModel && hasApiKey
                    ? "CIPHER está disponible."
                    : "Configuración incompleta."
        })
    });
}

function createPanel() {
    const messageListeners = [];
    const disposeListeners = [];
    const resources = [];
    const panel = {
        messages: [],
        resources,
        revealCount: 0,
        disposed: false,
        async postMessage(message) {
            panel.messages.push(message);
            return true;
        },
        onMessage(listener) {
            messageListeners.push(listener);
            const resource = disposable();
            resources.push(resource);
            return resource;
        },
        onDispose(listener) {
            disposeListeners.push(listener);
            const resource = disposable();
            resources.push(resource);
            return resource;
        },
        reveal() {
            panel.revealCount += 1;
        },
        dispose() {
            if (panel.disposed) {
                return;
            }

            panel.disposed = true;

            for (const listener of disposeListeners) {
                listener();
            }
        }
    };

    return panel;
}

function disposable() {
    return {
        disposed: false,
        dispose() {
            this.disposed = true;
        }
    };
}

function silentLogger() {
    return {
        error() {}
    };
}
