import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER_TEST_CASE_LIMITS,
    BrokerHostMessageType,
    BrokerRisk,
    BrokerTestCaseKind,
    BrokerTestComparison,
    BrokerTestCaseValidator,
    acceptBrokerContract,
    addBrokerContract,
    createBrokerGameState,
    createBrokerHostMessage,
    createBrokerTestCase,
    createBrokerTestCases
} from "../src/broker95/index.js";

test("acepta casos declarativos acotados y preserva la entrada como datos", () => {
    const tests = createBrokerTestCases([
        testCase({
            id: "TC-normal-1",
            requirementIds: ["REQ-1"],
            stdin: 'texto que parece c\u00f3digo: require("fs")\n',
            expected: "recibido\n",
            comparison: BrokerTestComparison.EXACT
        }),
        testCase({
            id: "TC-boundary-1",
            kind: BrokerTestCaseKind.BOUNDARY,
            requirementIds: ["REQ-1", "REQ-2"],
            stdin: "0\n",
            expected: "[]",
            comparison: BrokerTestComparison.JSON
        }),
        testCase({
            id: "TC-invalid-1",
            kind: BrokerTestCaseKind.INVALID,
            requirementIds: ["REQ-2"],
            stdin: "-1\n",
            expected: "Entrada inv\u00e1lida",
            comparison: BrokerTestComparison.CONTAINS
        })
    ], ["REQ-1", "REQ-2"], {
        requireAtLeastOne: true
    });

    assert.equal(tests.length, 3);
    assert.equal(
        tests[0].stdin,
        'texto que parece c\u00f3digo: require("fs")\n'
    );
    assert.equal(
        tests[1].kind,
        BrokerTestCaseKind.BOUNDARY
    );
    assert.equal(
        Object.isFrozen(tests[0]),
        true
    );
    assert.equal(
        Object.values(BrokerTestComparison)
            .includes("regex-safe"),
        true
    );
});

test("rechaza campos ejecutables, eficiencia y datos fuera de los l\u00edmites", () => {
    const cases = [
        [
            {
                ...testCase(),
                code: "process.exit(1)"
            },
            "BROKER95_TEST_CASE_FIELDS_INVALID"
        ],
        [
            {
                ...testCase(),
                efficiency: "O(n)"
            },
            "BROKER95_TEST_CASE_FIELDS_INVALID"
        ],
        [
            {
                ...testCase(),
                comparison: "javascript"
            },
            "BROKER95_TEST_CASE_COMPARISON_INVALID"
        ],
        [
            {
                ...testCase(),
                timeoutMs: BROKER_TEST_CASE_LIMITS
                    .maximumTimeoutMs + 1
            },
            "BROKER95_TEST_CASE_TIMEOUT_INVALID"
        ],
        [
            {
                ...testCase(),
                stdin: "x".repeat(
                    BROKER_TEST_CASE_LIMITS
                        .maximumInputCharacters + 1
                )
            },
            "BROKER95_TEST_CASE_STDIN_INVALID"
        ]
    ];

    for (const [source, code] of cases) {
        assert.throws(
            () => createBrokerTestCase(source),
            error => error.code === code
        );
    }
});

test("valida IDs \u00fanicos y referencias a requisitos existentes", () => {
    const validator = new BrokerTestCaseValidator();

    assert.throws(
        () => validator.validate([], {
            requirements: ["Requisito uno"],
            requirementIds: ["REQ-1"]
        }),
        error => error.code === "BROKER95_TEST_CASES_INVALID"
    );
    assert.throws(
        () => validator.validate([
            testCase({ id: "TC-same" }),
            testCase({ id: "TC-same" })
        ], {
            requirements: ["Requisito uno"],
            requirementIds: ["REQ-1"]
        }),
        error => error.code === "BROKER95_TEST_CASE_IDS_DUPLICATED"
    );
    assert.throws(
        () => validator.validate([
            testCase({
                requirementIds: ["REQ-unknown"]
            })
        ], {
            requirements: ["Requisito uno"],
            requirementIds: ["REQ-1"]
        }),
        error =>
            error.code ===
            "BROKER95_TEST_CASE_REQUIREMENT_UNKNOWN"
    );
});

test("exige explicaciones en propuestas nuevas y conserva casos internos", () => {
    const validator = new BrokerTestCaseValidator();
    const incompleteCase = { ...testCase() };

    delete incompleteCase.explanation;

    assert.throws(
        () => validator.validate([incompleteCase], {
            requirements: ["Requisito uno"],
            requirementIds: ["REQ-1"]
        }),
        error => error.code ===
            "BROKER95_TEST_CASE_FIELDS_INVALID"
    );

    const internal = createBrokerTestCase(
        incompleteCase
    );

    assert.equal(
        Object.hasOwn(internal, "explanation"),
        false
    );
});

test("expone al Webview sólo los casos del contrato activo", () => {
    const pendingState = addBrokerContract(
        createBrokerGameState(),
        {
            ...contractDraft(),
            testCases: [
                testCase({
                    id: "TC-private-1",
                    requirementIds: ["REQ-1"]
                })
            ]
        }
    );
    const contract =
        pendingState.contracts[0];
    const state = acceptBrokerContract(
        pendingState,
        1
    );
    const message = createBrokerHostMessage({
        type: BrokerHostMessageType.READY,
        requestId: "request:private-tests",
        payload: {
            sessionId: "session:private-tests",
            state,
            settings: {
                model: "",
                hasApiKey: false
            },
            llmStatus: {
                status: "unconfigured",
                reason: "model_missing",
                message: "Configura CIPHER."
            }
        }
    });
    const publicContract = message.payload.state.contracts[0];
    const serialized = JSON.stringify(message);

    assert.equal(contract.testCases.length, 1);
    assert.equal(
        Object.isFrozen(contract.testCases),
        true
    );
    assert.equal(
        Object.hasOwn(publicContract, "testCases"),
        true
    );
    assert.equal(
        publicContract.testCases.length,
        1
    );
    assert.deepEqual(
        publicContract.testCases[0],
        testCase({
            id: "TC-private-1",
            requirementIds: ["REQ-1"]
        })
    );
    assert.equal(
        Object.isFrozen(
            publicContract.testCases[0]
        ),
        true
    );
    assert.equal(
        Object.hasOwn(publicContract, "metadata"),
        false
    );
    assert.equal(
        Object.hasOwn(publicContract, "evaluation"),
        false
    );
    assert.equal(serialized.includes("TC-private-1"), true);
    assert.equal(serialized.includes("REQ-1"), true);

    const pendingMessage = createBrokerHostMessage({
        type: BrokerHostMessageType.READY,
        requestId: "request:pending-tests",
        payload: {
            sessionId: "session:pending-tests",
            state: pendingState,
            settings: {
                model: "",
                hasApiKey: false
            },
            llmStatus: {
                status: "unconfigured",
                reason: "model_missing",
                message: "Configura CIPHER."
            }
        }
    });

    assert.deepEqual(
        pendingMessage.payload.state
            .contracts[0].testCases,
        []
    );
});

function contractDraft() {
    return {
        title: "Contrato de prueba",
        categoryId: "NUM-ARITH",
        categoryName: "Aritm\u00e9tica",
        familyId: "NUM",
        familyName: "Procesamiento numérico",
        risk: BrokerRisk.LOW,
        description: "Procesa una entrada simple.",
        requirements: ["Mostrar una salida v\u00e1lida."],
        client: "Laboratorio",
        payPotential: 100,
        metadata: {
            requirementIds: ["REQ-1"],
            privateMarker: "internal"
        }
    };
}

function testCase(overrides = {}) {
    return {
        id: "TC-1",
        kind: BrokerTestCaseKind.NORMAL,
        requirementIds: ["REQ-1"],
        explanation:
            "Comprueba el comportamiento esperado para esta entrada.",
        stdin: "1\n",
        expected: "1\n",
        comparison: BrokerTestComparison.EXACT,
        timeoutMs: 1_000,
        ...overrides
    };
}
