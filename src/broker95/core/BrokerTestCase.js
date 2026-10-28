import {
    BrokerGameError
} from "./BrokerGameError.js";
import {
    BrokerTestComparison,
    validateBrokerTestExpectation
} from "./BrokerTestComparison.js";

export {
    BrokerTestComparison
} from "./BrokerTestComparison.js";

const TEST_CASE_KEYS = Object.freeze([
    "id",
    "kind",
    "requirementIds",
    "explanation",
    "stdin",
    "expected",
    "comparison",
    "timeoutMs"
]);

export const BrokerTestCaseKind = Object.freeze({
    NORMAL: "normal",
    BOUNDARY: "boundary",
    INVALID: "invalid"
});

/**
 * La ejecuciÃ³n llega en el bloque 5.3. Este catÃ¡logo solamente fija las
 * comparaciones declarativas que esa ejecuciÃ³n podrÃ¡ implementar.
 */
export const BROKER_TEST_CASE_LIMITS = Object.freeze({
    maximumCases: 16,
    maximumRequirementIds: 8,
    maximumExplanationCharacters: 500,
    maximumInputCharacters: 16_384,
    maximumExpectedCharacters: 16_384,
    minimumTimeoutMs: 100,
    maximumTimeoutMs: 10_000
});

export function createBrokerRequirementIds(
    requirements,
    source = null
) {
    if (!Array.isArray(requirements) ||
        requirements.length === 0) {
        invalid(
            "BROKER95_CONTRACT_REQUIREMENT_IDS_INVALID"
        );
    }

    const ids = source == null
        ? requirements.map(
            (_requirement, index) =>
                `REQ-${index + 1}`
        )
        : source;

    if (
        !Array.isArray(ids) ||
        ids.length !== requirements.length
    ) {
        invalid(
            "BROKER95_CONTRACT_REQUIREMENT_IDS_INVALID"
        );
    }

    const normalized = ids.map(value =>
        requireIdentifier(
            value,
            "BROKER95_CONTRACT_REQUIREMENT_IDS_INVALID"
        )
    );

    if (new Set(normalized).size !== normalized.length) {
        invalid(
            "BROKER95_CONTRACT_REQUIREMENT_IDS_DUPLICATED"
        );
    }

    return Object.freeze(normalized);
}

export function createBrokerTestCase(
    source = {},
    options = {}
) {
    const input = requireRecord(
        source,
        "BROKER95_TEST_CASE_INVALID"
    );

    if (
        Object.keys(input).some(key =>
            !TEST_CASE_KEYS.includes(key)
        ) ||
        TEST_CASE_KEYS
            .filter(key => key !== "explanation")
            .some(key => !Object.hasOwn(input, key)) ||
        (
            options.requireExplanation === true &&
            !Object.hasOwn(input, "explanation")
        )
    ) {
        invalid("BROKER95_TEST_CASE_FIELDS_INVALID");
    }

    const comparison = requireEnum(
        input.comparison,
        BrokerTestComparison,
        "BROKER95_TEST_CASE_COMPARISON_INVALID"
    );
    const expected = validateBrokerTestExpectation(
        comparison,
        requireDataText(
            input.expected,
            BROKER_TEST_CASE_LIMITS
                .maximumExpectedCharacters,
            "BROKER95_TEST_CASE_EXPECTED_INVALID"
        )
    );

    return Object.freeze({
        id: requireIdentifier(
            input.id,
            "BROKER95_TEST_CASE_ID_INVALID"
        ),
        kind: requireEnum(
            input.kind,
            BrokerTestCaseKind,
            "BROKER95_TEST_CASE_KIND_INVALID"
        ),
        requirementIds: createBrokerTestRequirementIds(
            input.requirementIds
        ),
        ...(Object.hasOwn(input, "explanation")
            ? {
                explanation: requireExplanation(
                    input.explanation
                )
            }
            : {}),
        stdin: requireDataText(
            input.stdin,
            BROKER_TEST_CASE_LIMITS
                .maximumInputCharacters,
            "BROKER95_TEST_CASE_STDIN_INVALID"
        ),
        expected,
        comparison,
        timeoutMs: requireTimeout(input.timeoutMs)
    });
}

export function createBrokerTestCases(
    source,
    requirementIds,
    options = {}
) {
    const requireAtLeastOne =
        options.requireAtLeastOne === true;

    if (
        !Array.isArray(source) ||
        source.length > BROKER_TEST_CASE_LIMITS
            .maximumCases ||
        (requireAtLeastOne && source.length === 0)
    ) {
        invalid("BROKER95_TEST_CASES_INVALID");
    }

    const knownRequirementIds = new Set(
        createBrokerRequirementIds(
            requirementIds,
            requirementIds
        )
    );
    const testCases = source.map(item =>
        createBrokerTestCase(item, options)
    );

    if (
        new Set(testCases.map(item => item.id))
            .size !== testCases.length
    ) {
        invalid("BROKER95_TEST_CASE_IDS_DUPLICATED");
    }

    for (const testCase of testCases) {
        if (testCase.requirementIds.some(id =>
            !knownRequirementIds.has(id)
        )) {
            invalid(
                "BROKER95_TEST_CASE_REQUIREMENT_UNKNOWN"
            );
        }
    }

    return Object.freeze(testCases);
}

function createBrokerTestRequirementIds(source) {
    if (
        !Array.isArray(source) ||
        source.length === 0 ||
        source.length > BROKER_TEST_CASE_LIMITS
            .maximumRequirementIds
    ) {
        invalid(
            "BROKER95_TEST_CASE_REQUIREMENT_IDS_INVALID"
        );
    }

    const ids = source.map(value =>
        requireIdentifier(
            value,
            "BROKER95_TEST_CASE_REQUIREMENT_IDS_INVALID"
        )
    );

    if (new Set(ids).size !== ids.length) {
        invalid(
            "BROKER95_TEST_CASE_REQUIREMENT_IDS_DUPLICATED"
        );
    }

    return Object.freeze(ids);
}

function requireIdentifier(value, code) {
    if (
        typeof value !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u
            .test(value)
    ) {
        invalid(code);
    }

    return value;
}

function requireDataText(value, maximum, code) {
    if (
        typeof value !== "string" ||
        value.length > maximum ||
        value.includes("\u0000") ||
        containsUnsafeControl(value)
    ) {
        invalid(code);
    }

    return value;
}

function requireExplanation(value) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > BROKER_TEST_CASE_LIMITS
            .maximumExplanationCharacters ||
        value.includes("\u0000") ||
        [...value].some(character =>
            character.codePointAt(0) < 32 &&
            character !== "\t" &&
            character !== "\n" &&
            character !== "\r"
        )
    ) {
        invalid(
            "BROKER95_TEST_CASE_EXPLANATION_INVALID"
        );
    }

    const normalized = value
        .replace(/\s+/gu, " ")
        .trim();

    if (normalized.length === 0) {
        invalid(
            "BROKER95_TEST_CASE_EXPLANATION_INVALID"
        );
    }

    return normalized;
}

function containsUnsafeControl(value) {
    return [...value].some(character => {
        const code = character.codePointAt(0);

        return code < 32 &&
            character !== "\t" &&
            character !== "\n" &&
            character !== "\r";
    });
}

function requireTimeout(value) {
    if (
        !Number.isSafeInteger(value) ||
        value < BROKER_TEST_CASE_LIMITS
            .minimumTimeoutMs ||
        value > BROKER_TEST_CASE_LIMITS
            .maximumTimeoutMs
    ) {
        invalid("BROKER95_TEST_CASE_TIMEOUT_INVALID");
    }

    return value;
}

function requireEnum(value, enumeration, code) {
    if (!Object.values(enumeration).includes(value)) {
        invalid(code);
    }

    return value;
}

function requireRecord(value, code) {
    if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        (
            Object.getPrototypeOf(value) !==
                Object.prototype &&
            Object.getPrototypeOf(value) !== null
        )
    ) {
        invalid(code);
    }

    return value;
}

function invalid(code) {
    throw BrokerGameError.invalidRule(
        code,
        "Los casos de prueba del contrato no son v\u00e1lidos.",
        []
    );
}
