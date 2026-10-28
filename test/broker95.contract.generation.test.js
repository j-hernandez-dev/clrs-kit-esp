import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER_CONTRACT_GENERATION_MAX_ATTEMPTS,
    BROKER_TEST_COMPARISON_FORMATS,
    BrokerContractService,
    BrokerContractValidator,
    BrokerLlmAvailabilityError,
    BrokerLlmStatus,
    BrokerLlmStatusReason,
    BrokerRisk,
    createBrokerContractDraftExample,
    createBrokerContractDraftJsonSchema,
    createBrokerContractGenerationRequest,
    createBrokerGameState,
    requiresAnonymousClient
} from "../src/broker95/index.js";
import {
    brokerCategoryCatalog
} from "../src/broker95/catalog/BrokerCategoryCatalog.js";

test("el esquema de CIPHER refleja exactamente la politica de cliente", () => {
    const named = createBrokerContractDraftJsonSchema(
        "named"
    );
    const anonymous =
        createBrokerContractDraftJsonSchema(
            "anonymous"
        );

    assert.equal(named.additionalProperties, false);
    assert.equal(
        named.required.includes("client"),
        true
    );
    assert.equal(
        Object.hasOwn(named.properties, "client"),
        true
    );
    assert.equal(
        anonymous.required.includes("client"),
        false
    );
    assert.equal(
        Object.hasOwn(
            anonymous.properties,
            "client"
        ),
        false
    );
    assert.deepEqual(
        named.properties.testCases.items.required,
        [
            "id",
            "kind",
            "requirementIds",
            "explanation",
            "stdin",
            "expected",
            "comparison",
            "timeoutMs"
        ]
    );
    assert.equal(
        named.properties.testCases.items
            .additionalProperties,
        false
    );
    assert.equal(Object.isFrozen(named), true);
    assert.equal(
        Object.isFrozen(named.properties),
        true
    );

    const validator = new BrokerContractValidator();
    assert.doesNotThrow(() => validator.validate(
        createBrokerContractDraftExample("named"),
        { risk: BrokerRisk.LOW }
    ));
    assert.doesNotThrow(() => validator.validate(
        createBrokerContractDraftExample("anonymous"),
        { risk: BrokerRisk.HIGH }
    ));
});

test("la solicitud de generaciÃ³n entrega sÃ³lo contexto no autoritativo al LLM", () => {
    const category = brokerCategoryCatalog.requireCategory(
        "NUM-ARITH"
    );
    const request = createBrokerContractGenerationRequest({
        requestId: "contract:request-1",
        model: "modelo-local",
        risk: BrokerRisk.HIGH,
        category
    });
    const { testCases, ...responseShape } =
        request.input.responseShape;

    assert.deepEqual({
        ...request.input,
        responseShape
    }, {
        category: {
            categoryId: category.categoryId,
            categoryName: category.categoryName,
            familyId: category.familyId,
            familyName: category.familyName,
            scope: category.scope,
            representativeExamples:
                category.representativeExamples
        },
        risk: BrokerRisk.HIGH,
        difficulty:
            request.input.difficulty,
        clientPolicy: "anonymous",
        responseShape: {
            required: [
                "title",
                "description",
                "requirements",
                "testCases"
            ],
            requirementCount: {
                minimum: 1,
                maximum: 8
            }
        }
    });
    assert.deepEqual(testCases.fields, [
        "id",
        "kind",
        "requirementIds",
        "explanation",
        "stdin",
        "expected",
        "comparison",
        "timeoutMs"
    ]);
    assert.equal(testCases.limits.maximumCases, 16);
    assert.deepEqual(
        testCases.expectedFormats,
        BROKER_TEST_COMPARISON_FORMATS
    );
    assert.equal(
        request.context.constraints.noExecutableTestCode,
        true
    );
    assert.equal(
        request.input.difficulty.difficultyId,
        "hard"
    );
    assert.equal(
        request.input.difficulty.programShape.recursion,
        "allowed"
    );
    assert.equal(
        Object.isFrozen(request.input.difficulty),
        true
    );
    assert.equal(
        Object.hasOwn(request.input, "payPotential"),
        false
    );
    assert.equal(
        Object.hasOwn(request.context, "id"),
        false
    );
    assert.equal(
        Object.hasOwn(
            request.context.constraints,
            "noTestCasesInThisPhase"
        ),
        false
    );
    assert.equal(Object.isFrozen(request), true);
    assert.equal(
        requiresAnonymousClient(BrokerRisk.HIGH),
        true
    );
});

test("la solicitud de reparacion conserva el fallo sin darle autoridad al LLM", () => {
    const category = brokerCategoryCatalog.requireCategory(
        "NUM-ARITH"
    );
    const previousDraft = {
        title: "Borrador",
        payPotential: 999
    };
    const request = createBrokerContractGenerationRequest({
        requestId: "contract:request-1:repair",
        model: "modelo-local",
        risk: BrokerRisk.LOW,
        category,
        repair: {
            attempt:
                BROKER_CONTRACT_GENERATION_MAX_ATTEMPTS,
            validationCode:
                "BROKER95_CONTRACT_DRAFT_FIELDS_INVALID",
            previousDraft
        }
    });

    assert.deepEqual(request.input.repair, {
        attempt: 2,
        validationCode:
            "BROKER95_CONTRACT_DRAFT_FIELDS_INVALID",
        previousDraft
    });
    assert.equal(
        Object.isFrozen(
            request.input.repair.previousDraft
        ),
        true
    );
    assert.equal(
        Object.hasOwn(
            request.context,
            "payPotential"
        ),
        false
    );
});

test("el validador acepta sÃ³lo la propuesta narrativa y anonimiza riesgos altos", () => {
    const validator = new BrokerContractValidator();
    const low = validator.validate({
        testCases: [
            testCase("TC-low-1", ["REQ-1"]),
            testCase("TC-low-2", ["REQ-2"])
        ],
        title: "  Suma bajo contrato  ",
        description: "Resuelve la operaciÃ³n solicitada.",
        requirements: [
            "Leer dos nÃºmeros.",
            "Mostrar el resultado."
        ],
        client: "  Laboratorio Aurora  "
    }, {
        risk: BrokerRisk.LOW
    });
    const high = validator.validate({
        testCases: [
            testCase("TC-high-1", ["REQ-1"])
        ],
        title: "AuditorÃ­a de seÃ±ales",
        description: "Procesa las seÃ±ales recibidas.",
        requirements: ["Conservar el orden de entrada."]
    }, {
        risk: BrokerRisk.HIGH
    });

    assert.deepEqual(low, {
        title: "Suma bajo contrato",
        description: "Resuelve la operaciÃ³n solicitada.",
        requirements: [
            "Leer dos nÃºmeros.",
            "Mostrar el resultado."
        ],
        requirementIds: ["REQ-1", "REQ-2"],
        testCases: [
            testCase("TC-low-1", ["REQ-1"]),
            testCase("TC-low-2", ["REQ-2"])
        ],
        client: "Laboratorio Aurora"
    });
    assert.equal(high.client, "An\u00f3nimo");
    assert.equal(Object.isFrozen(high.requirements), true);
    assert.deepEqual(high.requirementIds, ["REQ-1"]);
    assert.equal(high.testCases[0].id, "TC-high-1");
});

test("el validador rechaza campos que intentan sustituir reglas del Host", () => {
    const validator = new BrokerContractValidator();
    const proposal = {
        title: "Contrato inyectado",
        description: "No debe persistirse.",
        requirements: ["Resolver el caso base."],
        client: "Cliente",
        risk: BrokerRisk.EXTREME,
        payPotential: 4_000,
        state: "completed",
        efficiency: 100,
        testCases: [
            testCase("TC-injected-1", ["REQ-1"])
        ]
    };

    assert.throws(
        () => validator.validate(proposal, {
            risk: BrokerRisk.LOW
        }),
        error =>
            error.code ===
            "BROKER95_CONTRACT_DRAFT_FIELDS_INVALID"
    );
    assert.throws(
        () => validator.validate({
            title: "Duplicado",
            testCases: [
                testCase("TC-duplicate-1", ["REQ-1"])
            ],
            description: "No debe pasar.",
            requirements: ["Leer datos.", "leer datos."],
            client: "Cliente"
        }, {
            risk: BrokerRisk.LOW
        }),
        error =>
            error.code ===
            "BROKER95_CONTRACT_DRAFT_REQUIREMENTS_DUPLICATED"
    );
});

test("el servicio fija la identidad, pago y categorÃ­a antes de persistir", async () => {
    const session = createMemorySession();
    const llm = createLlm({
        testCases: [
            testCase("TC-service-1", ["REQ-1"])
        ],
        title: "El mensaje de CIPHER",
        description: "Procesa los registros recibidos.",
        requirements: ["Conservar los registros vÃ¡lidos."],
        client: "Cliente generado"
    });
    const service = new BrokerContractService({
        gameSession: session,
        llm,
        availability: readyAvailability(),
        categorySelector: fixedCategorySelector(),
        random: sequenceRandom([0.999999]),
        now: () => 1_234,
        createRequestId: () => "contract:fixed"
    });
    const result = await service.generate({
        risk: BrokerRisk.MEDIUM
    });
    const contract = result.contract;

    assert.equal(contract.id, 1);
    assert.equal(contract.risk, BrokerRisk.MEDIUM);
    assert.equal(contract.payPotential, 650);
    assert.equal(contract.categoryId, "NUM-ARITH");
    assert.equal(contract.client, "Cliente generado");
    assert.equal(contract.state, "pending");
    assert.equal(contract.createdAt, 1_234);
    assert.deepEqual(
        contract.metadata.requirementIds,
        ["REQ-1"]
    );
    assert.equal(session.transactions, 1);
    assert.equal(llm.requests.length, 1);
    assert.equal(
        Object.hasOwn(llm.requests[0].input, "payPotential"),
        false
    );
    assert.equal(
        Object.hasOwn(llm.requests[0].context, "state"),
        false
    );
    assert.equal(
        Object.hasOwn(contract.metadata.generation, "responseId"),
        true
    );
    assert.equal(
        contract.metadata.generation.attempts,
        1
    );
    assert.equal(
        contract.metadata.generation.repaired,
        false
    );
});

test("el servicio repara una sola vez un borrador estructuralmente invalido", async () => {
    const session = createMemorySession();
    const invalidDraft = {
        ...contractDraft(),
        payPotential: 999
    };
    const validDraft = contractDraft();
    const llm = createSequenceLlm([
        invalidDraft,
        validDraft
    ]);
    const service = new BrokerContractService({
        gameSession: session,
        llm,
        availability: readyAvailability(),
        categorySelector: fixedCategorySelector(),
        random: sequenceRandom([0]),
        createRequestId: () => "contract:repairable"
    });

    const result = await service.generate({
        risk: BrokerRisk.LOW
    });

    assert.equal(llm.requests.length, 2);
    assert.equal(
        llm.requests[1].requestId,
        "contract:repairable:repair"
    );
    assert.equal(
        llm.requests[1].input.repair.validationCode,
        "BROKER95_CONTRACT_DRAFT_FIELDS_INVALID"
    );
    assert.deepEqual(
        llm.requests[1].input.repair.previousDraft,
        invalidDraft
    );
    assert.equal(session.transactions, 1);
    assert.equal(
        result.contract.metadata.generation.attempts,
        2
    );
    assert.equal(
        result.contract.metadata.generation.repaired,
        true
    );
    assert.equal(
        result.contract.metadata.generation.responseId,
        "response:2"
    );
});

test("un borrador invÃ¡lido o CIPHER no disponible no modifica la partida", async () => {
    const invalidSession = createMemorySession();
    const invalidLlm = createLlm({
        testCases: [
            testCase("TC-invalid-1", ["REQ-1"])
        ],
        title: "Borrador",
        description: "No debe guardarse.",
        requirements: ["Resolver."],
        client: "Cliente",
        payPotential: 200
    });
    const invalidService = new BrokerContractService({
        gameSession: invalidSession,
        llm: invalidLlm,
        availability: readyAvailability(),
        categorySelector: fixedCategorySelector(),
        random: sequenceRandom([0]),
        createRequestId: () => "contract:invalid"
    });

    await assert.rejects(
        invalidService.generate({ risk: BrokerRisk.LOW }),
        error =>
            error.code ===
            "BROKER95_CONTRACT_DRAFT_FIELDS_INVALID"
    );
    assert.equal(invalidLlm.requests.length, 2);
    assert.equal(invalidSession.transactions, 0);
    assert.equal(invalidSession.getState().contracts.length, 0);

    const unavailableSession = createMemorySession();
    const unavailableLlm = createLlm(contractDraft());
    const unavailableService = new BrokerContractService({
        gameSession: unavailableSession,
        llm: unavailableLlm,
        availability: unavailableAvailability(),
        categorySelector: fixedCategorySelector(),
        random: sequenceRandom([0])
    });

    await assert.rejects(
        unavailableService.generate({ risk: BrokerRisk.LOW }),
        error =>
            error instanceof BrokerLlmAvailabilityError &&
            error.code === "BROKER95_LLM_MODEL_MISSING"
    );
    assert.equal(unavailableLlm.requests.length, 0);
    assert.equal(unavailableSession.transactions, 0);
});

test("la generación correlacionada invoca a CIPHER y persiste una sola vez", async () => {
    const session = createMemorySession();
    const llm = createLlm(contractDraft());
    const service = new BrokerContractService({
        gameSession: session,
        llm,
        availability: readyAvailability(),
        categorySelector: fixedCategorySelector(),
        random: sequenceRandom([0]),
        now: () => 1_234
    });
    const options = {
        risk: BrokerRisk.LOW,
        requestId: "contract:idempotent:1"
    };
    const [first, duplicate] =
        await Promise.all([
            service.generate(options),
            service.generate(options)
        ]);

    assert.equal(first, duplicate);
    assert.equal(llm.requests.length, 1);
    assert.equal(session.transactions, 1);
    assert.equal(
        session.getState().contracts.length,
        1
    );
    assert.equal(
        await service.generate(options),
        first
    );
    assert.equal(llm.requests.length, 1);
    assert.equal(session.transactions, 1);
});

function createMemorySession() {
    let state = createBrokerGameState();

    return {
        transactions: 0,
        async initialize() {
            return Object.freeze({ state });
        },
        getState() {
            return state;
        },
        async transact(transition) {
            this.transactions += 1;
            state = transition(state);

            return state;
        }
    };
}

function fixedCategorySelector() {
    const category = brokerCategoryCatalog.requireCategory(
        "NUM-ARITH"
    );

    return {
        select({ risk }) {
            return Object.freeze({
                risk,
                category,
                candidateCount: 115,
                selectedWeight: 1,
                totalWeight: 115,
                randomValue: 0,
                candidates: Object.freeze([])
            });
        }
    };
}

function createLlm(output) {
    return {
        requests: [],
        async generateContract(request) {
            this.requests.push(request);

            return Object.freeze({
                output,
                responseId: "response:1",
                model: "modelo"
            });
        }
    };
}

function createSequenceLlm(outputs) {
    return {
        requests: [],
        async generateContract(request) {
            this.requests.push(request);
            const index = this.requests.length - 1;

            return Object.freeze({
                output: outputs[index],
                responseId: `response:${index + 1}`,
                model: "modelo"
            });
        }
    };
}

function readyAvailability() {
    return {
        getSnapshot() {
            return Object.freeze({
                settings: Object.freeze({
                    model: "modelo",
                    hasApiKey: true
                }),
                llmStatus: Object.freeze({
                    status: BrokerLlmStatus.READY,
                    reason: BrokerLlmStatusReason.READY,
                    message: "CIPHER estÃ¡ configurado."
                })
            });
        }
    };
}

function unavailableAvailability() {
    return {
        getSnapshot() {
            return Object.freeze({
                settings: Object.freeze({
                    model: "",
                    hasApiKey: false
                }),
                llmStatus: Object.freeze({
                    status: BrokerLlmStatus.UNCONFIGURED,
                    reason: BrokerLlmStatusReason.MODEL_MISSING,
                    message: "CIPHER DESCONECTADO"
                })
            });
        }
    };
}

function sequenceRandom(values) {
    let index = 0;

    return () => values[index++] ?? 0;
}

function contractDraft() {
    return {
        testCases: [
            testCase("TC-draft-1", ["REQ-1"])
        ],
        title: "Contrato",
        description: "Procesa los datos recibidos.",
        requirements: ["Mostrar un resultado."],
        client: "Cliente"
    };
}

function testCase(id, requirementIds) {
    return {
        id,
        kind: "normal",
        requirementIds,
        explanation:
            "Comprueba el comportamiento esperado para esta entrada.",
        stdin: "5\n",
        expected: "5\n",
        comparison: "exact",
        timeoutMs: 1_000
    };
}
