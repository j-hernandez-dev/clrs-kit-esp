import assert from "node:assert/strict";
import test from "node:test";

import {
    BROKER_TEST_COMPARISON_FORMATS,
    BROKER_TEST_COMPARISON_LIMITS,
    BrokerContractValidator,
    BrokerRisk,
    BrokerTestComparison,
    compareBrokerTestOutput,
    createBrokerSafeRegex,
    createBrokerTestCase
} from "../src/broker95/index.js";

test("compara salidas de texto, lineas y valores escalares", () => {
    const cases = [
        ["exact", "hola\n", "hola\n"],
        ["trimmed", "  hola\n", "hola"],
        [
            "normalized-whitespace",
            "uno\n\t dos",
            "uno dos"
        ],
        ["lines", "uno\r\ndos\r\n", "uno\ndos"],
        [
            "unordered-lines",
            "dos\nuno\ndos\n",
            "uno\ndos\ndos"
        ],
        ["number", "-0", "0"],
        ["number", "1.25e2\n", "125"],
        [
            "number-tolerance",
            "1.1",
            "1 \u00b1 0.1"
        ],
        ["boolean", "FALSO\n", "false"],
        ["contains", "resultado: 42\n", "42"],
        ["regex-safe", "item-42", "^item-\\d+$"]
    ];

    for (const [comparison, actual, expected] of cases) {
        const result = compareBrokerTestOutput(
            testCase({ comparison, expected }),
            actual
        );

        assert.equal(result.passed, true, comparison);
        assert.equal(result.reason, null, comparison);
        assert.equal(Object.isFrozen(result), true);
    }
});

test("compara JSON y arreglos estructuralmente sin perder duplicados", () => {
    const cases = [
        ["json", "null", "null"],
        [
            "json",
            '{"b":2,"a":{"d":4,"c":3}}',
            '{"a":{"c":3,"d":4},"b":2}'
        ],
        [
            "array-ordered",
            '[{"b":2,"a":1},[3,4]]',
            '[{"a":1,"b":2},[3,4]]'
        ],
        [
            "array-unordered",
            '[2,{"b":1,"a":0},2]',
            '[{"a":0,"b":1},2,2]'
        ]
    ];

    for (const [comparison, actual, expected] of cases) {
        assert.equal(
            compareBrokerTestOutput(
                testCase({ comparison, expected }),
                actual
            ).passed,
            true,
            comparison
        );
    }
});

test("distingue resultados incorrectos en cada familia de comparacion", () => {
    const cases = [
        ["exact", "hola", "Hola"],
        ["lines", "uno\ndos", "uno\ntres"],
        [
            "unordered-lines",
            "uno\ndos\ndos",
            "uno\nuno\ndos"
        ],
        ["number", "12 datos", "12"],
        [
            "number-tolerance",
            "10.101",
            "10 \u00b1 0.1"
        ],
        ["json", "{mal}", "null"],
        ["array-ordered", "[2,1]", "[1,2]"],
        ["array-unordered", "[1,2]", "[1,2,2]"],
        ["boolean", "si", "true"],
        ["contains", "resultado", "42"],
        ["regex-safe", "item-x", "^item-\\d+$"]
    ];

    for (const [comparison, actual, expected] of cases) {
        const result = compareBrokerTestOutput(
            testCase({ comparison, expected }),
            actual
        );

        assert.equal(result.passed, false, comparison);
        assert.equal(typeof result.reason, "string");
    }
});

test("valida el formato del oraculo antes de persistir un caso", () => {
    const invalidCases = [
        [
            BrokerTestComparison.NUMBER,
            "0x10",
            "BROKER95_TEST_EXPECTED_NUMBER_INVALID"
        ],
        [
            BrokerTestComparison.NUMBER_TOLERANCE,
            "3.14",
            "BROKER95_TEST_EXPECTED_TOLERANCE_INVALID"
        ],
        [
            BrokerTestComparison.NUMBER_TOLERANCE,
            "3 +/- -0.1",
            "BROKER95_TEST_EXPECTED_TOLERANCE_INVALID"
        ],
        [
            BrokerTestComparison.JSON,
            "{",
            "BROKER95_TEST_EXPECTED_JSON_INVALID"
        ],
        [
            BrokerTestComparison.ARRAY_ORDERED,
            "{}",
            "BROKER95_TEST_EXPECTED_ARRAY_INVALID"
        ],
        [
            BrokerTestComparison.BOOLEAN,
            "si",
            "BROKER95_TEST_EXPECTED_BOOLEAN_INVALID"
        ],
        [
            BrokerTestComparison.CONTAINS,
            "",
            "BROKER95_TEST_EXPECTED_CONTAINS_INVALID"
        ],
        [
            BrokerTestComparison.REGEX_SAFE,
            "(a+)+$",
            "BROKER95_TEST_REGEX_INVALID"
        ],
        [
            BrokerTestComparison.REGEX_SAFE,
            "a*a*",
            "BROKER95_TEST_REGEX_INVALID"
        ]
    ];

    for (const [comparison, expected, code] of invalidCases) {
        assert.throws(
            () => createBrokerTestCase(
                testCase({ comparison, expected })
            ),
            error => error.code === code,
            comparison
        );
    }
});

test("limita la regex segura y publica formatos para CIPHER", () => {
    assert.equal(
        createBrokerSafeRegex("^item-\\d+$")
            .test("item-95"),
        true
    );
    assert.throws(
        () => createBrokerSafeRegex("a|b"),
        error => error.code === "BROKER95_TEST_REGEX_INVALID"
    );
    assert.throws(
        () => createBrokerSafeRegex("a".repeat(
            BROKER_TEST_COMPARISON_LIMITS
                .maximumRegexPatternCharacters + 1
        )),
        error => error.code === "BROKER95_TEST_REGEX_INVALID"
    );
    assert.equal(
        BROKER_TEST_COMPARISON_FORMATS.number.includes(
            "finito"
        ),
        true
    );
    assert.equal(
        Object.isFrozen(BROKER_TEST_COMPARISON_FORMATS),
        true
    );
    assert.deepEqual(
        Object.keys(BROKER_TEST_COMPARISON_FORMATS).sort(),
        Object.values(BrokerTestComparison).sort()
    );
});

test("el validador de propuestas rechaza el oraculo incompatible del LLM", () => {
    const validator = new BrokerContractValidator();

    assert.throws(
        () => validator.validate({
            title: "Contrato numerico",
            description: "Produce un valor numerico.",
            requirements: ["Mostrar el valor."],
            client: "Laboratorio",
            testCases: [testCase({
                comparison: BrokerTestComparison.NUMBER,
                expected: "doce"
            })]
        }, {
            risk: BrokerRisk.LOW
        }),
        error => error.code ===
            "BROKER95_TEST_EXPECTED_NUMBER_INVALID"
    );
});

function testCase(overrides = {}) {
    return {
        id: "TC-1",
        kind: "normal",
        requirementIds: ["REQ-1"],
        explanation:
            "Comprueba el resultado para la entrada indicada.",
        stdin: "",
        expected: "salida",
        comparison: BrokerTestComparison.EXACT,
        timeoutMs: 1_000,
        ...overrides
    };
}
