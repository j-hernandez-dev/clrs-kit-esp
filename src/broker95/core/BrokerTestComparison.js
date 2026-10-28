import {
    BrokerGameError
} from "./BrokerGameError.js";
import {
    CLRS_TEST_COMPARISON_FORMATS,
    CLRS_TEST_COMPARISON_LIMITS,
    parseCLRSTestBoolean,
    parseCLRSTestFiniteNumber,
    parseCLRSTestJson,
    parseCLRSTestNumberTolerance,
    parseCLRSTestSafeRegex
} from "../../testing/domain/CLRSTestComparisonSupport.js";
import {
    CLRSTestComparison
} from "../../testing/domain/CLRSTestTypes.js";

export const BrokerTestComparison =
    CLRSTestComparison;

export const BROKER_TEST_COMPARISON_LIMITS =
    CLRS_TEST_COMPARISON_LIMITS;

export const BROKER_TEST_COMPARISON_FORMATS =
    CLRS_TEST_COMPARISON_FORMATS;

/**
 * Valida la parte semántica del oráculo declarativo antes de persistirlo.
 */
export function validateBrokerTestExpectation(
    comparison,
    expected
) {
    switch (comparison) {
        case BrokerTestComparison.NUMBER:
            if (parseBrokerFiniteNumber(expected) == null) {
                invalidExpectation(
                    "BROKER95_TEST_EXPECTED_NUMBER_INVALID"
                );
            }
            break;

        case BrokerTestComparison.NUMBER_TOLERANCE:
            if (parseBrokerNumberTolerance(expected) == null) {
                invalidExpectation(
                    "BROKER95_TEST_EXPECTED_TOLERANCE_INVALID"
                );
            }
            break;

        case BrokerTestComparison.JSON:
            if (!parseBrokerJson(expected).ok) {
                invalidExpectation(
                    "BROKER95_TEST_EXPECTED_JSON_INVALID"
                );
            }
            break;

        case BrokerTestComparison.ARRAY_ORDERED:
        case BrokerTestComparison.ARRAY_UNORDERED: {
            const parsed = parseBrokerJson(expected);

            if (!parsed.ok || !Array.isArray(parsed.value)) {
                invalidExpectation(
                    "BROKER95_TEST_EXPECTED_ARRAY_INVALID"
                );
            }
            break;
        }

        case BrokerTestComparison.BOOLEAN:
            if (parseBrokerBoolean(expected) == null) {
                invalidExpectation(
                    "BROKER95_TEST_EXPECTED_BOOLEAN_INVALID"
                );
            }
            break;

        case BrokerTestComparison.CONTAINS:
            if (expected.length === 0) {
                invalidExpectation(
                    "BROKER95_TEST_EXPECTED_CONTAINS_INVALID"
                );
            }
            break;

        case BrokerTestComparison.REGEX_SAFE:
            createBrokerSafeRegex(expected);
            break;

        default:
            break;
    }

    return expected;
}

export function parseBrokerFiniteNumber(value) {
    return parseCLRSTestFiniteNumber(value);
}

export function parseBrokerNumberTolerance(value) {
    return parseCLRSTestNumberTolerance(value);
}

export function parseBrokerJson(value) {
    return parseCLRSTestJson(value);
}

export function parseBrokerBoolean(value) {
    return parseCLRSTestBoolean(value);
}

export function createBrokerSafeRegex(pattern) {
    const parsed = parseCLRSTestSafeRegex(pattern);

    if (!parsed.ok) {
        invalidRegex();
    }

    return parsed.value;
}

function invalidRegex() {
    throw BrokerGameError.invalidRule(
        "BROKER95_TEST_REGEX_INVALID",
        "El patrón de comparación del caso de prueba no es seguro.",
        []
    );
}

function invalidExpectation(code) {
    throw BrokerGameError.invalidRule(
        code,
        "El resultado esperado del caso de prueba no corresponde con su comparación.",
        []
    );
}
