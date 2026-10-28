import {
    CLRSTestComparison,
    CLRSTestDivergenceKind,
    CLRSTestDivergenceReason
} from "./CLRSTestTypes.js";
import {
    canonicalizeCLRSTestJson,
    parseCLRSTestBoolean,
    parseCLRSTestFiniteNumber,
    parseCLRSTestJson,
    parseCLRSTestNumberTolerance,
    parseCLRSTestSafeRegex
} from "./CLRSTestComparisonSupport.js";
import {
    createCLRSTestDivergence
} from "./CLRSTestDivergence.js";

export function compareCLRSTestOutput(
    expectation,
    actualOutput
) {
    const comparison = expectation?.comparison ??
        CLRSTestComparison.EXACT;
    const expected = requireText(
        expectation?.stdout,
        "expected output"
    );
    const actual = requireText(
        actualOutput,
        "actual output"
    );
    let divergence;
    let reason;

    switch (comparison) {
        case CLRSTestComparison.EXACT:
            divergence = firstTextDivergence(
                actual,
                expected
            );
            reason = "exact-mismatch";
            break;
        case CLRSTestComparison.TRIMMED:
            divergence = firstTextDivergence(
                actual.trim(),
                expected.trim()
            );
            reason = "trimmed-mismatch";
            break;
        case CLRSTestComparison.NORMALIZED_WHITESPACE:
            divergence = firstTextDivergence(
                normalizeWhitespace(actual),
                normalizeWhitespace(expected)
            );
            reason = "whitespace-mismatch";
            break;
        case CLRSTestComparison.LINES:
            divergence = firstLineDivergence(
                normalizedLines(actual),
                normalizedLines(expected)
            );
            reason = "lines-mismatch";
            break;
        case CLRSTestComparison.UNORDERED_LINES:
            divergence = firstUnorderedLineDivergence(
                normalizedLines(actual),
                normalizedLines(expected)
            );
            reason = "unordered-lines-mismatch";
            break;
        case CLRSTestComparison.NUMBER:
            divergence = firstNumberDivergence(
                actual,
                expected
            );
            reason = "number-mismatch";
            break;
        case CLRSTestComparison.NUMBER_TOLERANCE:
            divergence = firstToleranceDivergence(
                actual,
                expected
            );
            reason = "number-tolerance-mismatch";
            break;
        case CLRSTestComparison.JSON:
            divergence = firstJsonDivergence(
                actual,
                expected,
                CLRSTestDivergenceKind.JSON
            );
            reason = "json-mismatch";
            break;
        case CLRSTestComparison.ARRAY_ORDERED:
            divergence = firstOrderedArrayDivergence(
                actual,
                expected
            );
            reason = "array-ordered-mismatch";
            break;
        case CLRSTestComparison.ARRAY_UNORDERED:
            divergence = firstUnorderedArrayDivergence(
                actual,
                expected
            );
            reason = "array-unordered-mismatch";
            break;
        case CLRSTestComparison.BOOLEAN:
            divergence = firstBooleanDivergence(
                actual,
                expected
            );
            reason = "boolean-mismatch";
            break;
        case CLRSTestComparison.CONTAINS:
            divergence = actual.includes(expected)
                ? null
                : divergenceValue({
                    kind:
                        CLRSTestDivergenceKind.CONTAINS,
                    reason:
                        CLRSTestDivergenceReason
                            .FRAGMENT_MISSING,
                    expected,
                    actual
                });
            reason = "contains-mismatch";
            break;
        case CLRSTestComparison.REGEX_SAFE:
            divergence = firstRegexDivergence(
                actual,
                expected
            );
            reason = "regex-mismatch";
            break;
        default:
            throw new TypeError(
                "The CLRS test comparison is invalid."
            );
    }

    const passed = divergence == null;

    return Object.freeze({
        passed,
        comparison,
        reason: passed ? null : reason,
        divergence
    });
}

function firstTextDivergence(actual, expected) {
    const actualCharacters = [...actual];
    const expectedCharacters = [...expected];
    const index = firstDifferentIndex(
        actualCharacters,
        expectedCharacters
    );

    if (index == null) {
        return null;
    }

    const actualPresent =
        index < actualCharacters.length;
    const expectedPresent =
        index < expectedCharacters.length;
    const positionSource = actualPresent
        ? actualCharacters
        : expectedCharacters;
    const position = characterPosition(
        positionSource,
        index
    );

    return divergenceValue({
        kind: CLRSTestDivergenceKind.TEXT,
        reason: presenceReason(
            expectedPresent,
            actualPresent
        ),
        index,
        line: position.line,
        column: position.column,
        expectedPresent,
        actualPresent,
        expected: expectedPresent
            ? expectedCharacters[index]
            : null,
        actual: actualPresent
            ? actualCharacters[index]
            : null
    });
}

function firstLineDivergence(actual, expected) {
    const lineIndex = firstDifferentIndex(
        actual,
        expected
    );

    if (lineIndex == null) {
        return null;
    }

    const actualPresent = lineIndex < actual.length;
    const expectedPresent = lineIndex < expected.length;
    const actualLine = actualPresent
        ? actual[lineIndex]
        : null;
    const expectedLine = expectedPresent
        ? expected[lineIndex]
        : null;
    const characterIndex =
        actualPresent && expectedPresent
            ? firstDifferentIndex(
                [...actualLine],
                [...expectedLine]
            )
            : 0;

    return divergenceValue({
        kind: CLRSTestDivergenceKind.LINES,
        reason: presenceReason(
            expectedPresent,
            actualPresent
        ),
        path: [lineIndex],
        index: lineIndex,
        line: lineIndex + 1,
        column: (characterIndex ?? 0) + 1,
        expectedPresent,
        actualPresent,
        expected: expectedLine,
        actual: actualLine
    });
}

function firstUnorderedLineDivergence(
    actual,
    expected
) {
    const remaining = actual.map(
        (value, index) => ({ value, index })
    );

    for (
        let index = 0;
        index < expected.length;
        index += 1
    ) {
        const match = remaining.findIndex(
            item => item.value === expected[index]
        );

        if (match < 0) {
            return divergenceValue({
                kind: CLRSTestDivergenceKind.LINES,
                reason:
                    CLRSTestDivergenceReason
                        .MISSING_VALUE,
                path: [index],
                index,
                line: index + 1,
                column: 1,
                expected: expected[index],
                actual: null,
                actualPresent: false
            });
        }

        remaining.splice(match, 1);
    }

    if (remaining.length > 0) {
        const item = remaining[0];

        return divergenceValue({
            kind: CLRSTestDivergenceKind.LINES,
            reason:
                CLRSTestDivergenceReason
                    .UNEXPECTED_VALUE,
            path: [item.index],
            index: item.index,
            line: item.index + 1,
            column: 1,
            expected: null,
            actual: item.value,
            expectedPresent: false
        });
    }

    return null;
}

function firstNumberDivergence(actual, expected) {
    const actualNumber =
        parseCLRSTestFiniteNumber(actual);
    const expectedNumber =
        parseCLRSTestFiniteNumber(expected);

    if (
        actualNumber != null &&
        expectedNumber != null &&
        actualNumber === expectedNumber
    ) {
        return null;
    }

    return divergenceValue({
        kind: CLRSTestDivergenceKind.NUMBER,
        reason: actualNumber == null
            ? CLRSTestDivergenceReason.INVALID_ACTUAL
            : CLRSTestDivergenceReason.VALUE_MISMATCH,
        expected: expectedNumber ?? expected,
        actual: actualNumber ?? actual,
        difference:
            actualNumber != null && expectedNumber != null
                ? finiteDifference(
                    actualNumber,
                    expectedNumber
                )
                : null
    });
}

function firstToleranceDivergence(actual, expected) {
    const actualNumber =
        parseCLRSTestFiniteNumber(actual);
    const expectation =
        parseCLRSTestNumberTolerance(expected);

    if (actualNumber == null || expectation == null) {
        return divergenceValue({
            kind: CLRSTestDivergenceKind.NUMBER,
            reason:
                CLRSTestDivergenceReason.INVALID_ACTUAL,
            expected: expectation?.value ?? expected,
            actual: actualNumber ?? actual,
            tolerance: expectation?.tolerance ?? null
        });
    }

    const difference = finiteDifference(
        actualNumber,
        expectation.value
    );
    const roundingMargin = Number.EPSILON * Math.max(
        1,
        Math.abs(actualNumber),
        Math.abs(expectation.value)
    );

    if (
        difference != null &&
        difference <=
            expectation.tolerance + roundingMargin
    ) {
        return null;
    }

    return divergenceValue({
        kind: CLRSTestDivergenceKind.NUMBER,
        reason:
            CLRSTestDivergenceReason
                .OUTSIDE_TOLERANCE,
        expected: expectation.value,
        actual: actualNumber,
        difference,
        tolerance: expectation.tolerance
    });
}

function firstJsonDivergence(
    actual,
    expected,
    kind
) {
    const actualValue = parseCLRSTestJson(actual);
    const expectedValue = parseCLRSTestJson(expected);

    if (!actualValue.ok || !expectedValue.ok) {
        return divergenceValue({
            kind,
            reason:
                CLRSTestDivergenceReason.INVALID_ACTUAL,
            expected: expectedValue.ok
                ? expectedValue.value
                : expected,
            actual: actualValue.ok
                ? actualValue.value
                : actual
        });
    }

    return firstStructuralDivergence(
        actualValue.value,
        expectedValue.value,
        [],
        kind
    );
}

function firstOrderedArrayDivergence(actual, expected) {
    const parsed = parseArrayPair(actual, expected);

    if (parsed.divergence != null) {
        return parsed.divergence;
    }

    return firstStructuralDivergence(
        parsed.actual,
        parsed.expected,
        [],
        CLRSTestDivergenceKind.ARRAY
    );
}

function firstUnorderedArrayDivergence(
    actual,
    expected
) {
    const parsed = parseArrayPair(actual, expected);

    if (parsed.divergence != null) {
        return parsed.divergence;
    }

    const used = new Set();
    const actualCanonical = parsed.actual.map(
        canonicalizeCLRSTestJson
    );
    let missingIndex = null;

    for (
        let index = 0;
        index < parsed.expected.length;
        index += 1
    ) {
        const canonical = canonicalizeCLRSTestJson(
            parsed.expected[index]
        );
        const match = actualCanonical.findIndex(
            (value, actualIndex) =>
                !used.has(actualIndex) &&
                value === canonical
        );

        if (match < 0) {
            missingIndex ??= index;
            continue;
        }

        used.add(match);
    }

    const unexpected = actualCanonical.findIndex(
        (unused, index) => !used.has(index)
    );

    if (missingIndex != null) {
        return divergenceValue({
            kind: CLRSTestDivergenceKind.ARRAY,
            reason: unexpected < 0
                ? CLRSTestDivergenceReason
                    .MISSING_VALUE
                : CLRSTestDivergenceReason
                    .VALUE_MISMATCH,
            path: [missingIndex],
            index: missingIndex,
            expected: parsed.expected[missingIndex],
            actual: unexpected < 0
                ? null
                : parsed.actual[unexpected],
            actualPresent: unexpected >= 0
        });
    }

    return unexpected < 0
        ? null
        : divergenceValue({
            kind: CLRSTestDivergenceKind.ARRAY,
            reason:
                CLRSTestDivergenceReason
                    .UNEXPECTED_VALUE,
            path: [unexpected],
            index: unexpected,
            expected: null,
            actual: parsed.actual[unexpected],
            expectedPresent: false
        });
}

function parseArrayPair(actual, expected) {
    const actualValue = parseCLRSTestJson(actual);
    const expectedValue = parseCLRSTestJson(expected);
    const actualIsArray =
        actualValue.ok && Array.isArray(actualValue.value);
    const expectedIsArray =
        expectedValue.ok && Array.isArray(expectedValue.value);

    if (!actualIsArray || !expectedIsArray) {
        return {
            actual: null,
            expected: null,
            divergence: divergenceValue({
                kind: CLRSTestDivergenceKind.ARRAY,
                reason: actualValue.ok
                    ? CLRSTestDivergenceReason
                        .TYPE_MISMATCH
                    : CLRSTestDivergenceReason
                        .INVALID_ACTUAL,
                expected: expectedValue.ok
                    ? expectedValue.value
                    : expected,
                actual: actualValue.ok
                    ? actualValue.value
                    : actual
            })
        };
    }

    return {
        actual: actualValue.value,
        expected: expectedValue.value,
        divergence: null
    };
}

function firstStructuralDivergence(
    actual,
    expected,
    path,
    kind
) {
    const actualType = jsonType(actual);
    const expectedType = jsonType(expected);

    if (actualType !== expectedType) {
        return divergenceValue({
            kind,
            reason:
                CLRSTestDivergenceReason.TYPE_MISMATCH,
            path,
            expected,
            actual
        });
    }

    if (actualType === "array") {
        const length = Math.max(
            actual.length,
            expected.length
        );

        for (let index = 0; index < length; index += 1) {
            const actualPresent = index < actual.length;
            const expectedPresent = index < expected.length;

            if (!actualPresent || !expectedPresent) {
                return divergenceValue({
                    kind,
                    reason: presenceReason(
                        expectedPresent,
                        actualPresent
                    ),
                    path: [...path, index],
                    index,
                    expectedPresent,
                    actualPresent,
                    expected: expectedPresent
                        ? expected[index]
                        : null,
                    actual: actualPresent
                        ? actual[index]
                        : null
                });
            }

            const nested = firstStructuralDivergence(
                actual[index],
                expected[index],
                [...path, index],
                kind
            );

            if (nested != null) {
                return nested;
            }
        }

        return null;
    }

    if (actualType === "object") {
        const expectedKeys = Object.keys(expected);
        const keys = [
            ...expectedKeys,
            ...Object.keys(actual).filter(
                key => !Object.hasOwn(expected, key)
            )
        ];

        for (const key of keys) {
            const actualPresent = Object.hasOwn(actual, key);
            const expectedPresent = Object.hasOwn(expected, key);

            if (!actualPresent || !expectedPresent) {
                return divergenceValue({
                    kind,
                    reason: presenceReason(
                        expectedPresent,
                        actualPresent
                    ),
                    path: [...path, key],
                    expectedPresent,
                    actualPresent,
                    expected: expectedPresent
                        ? expected[key]
                        : null,
                    actual: actualPresent
                        ? actual[key]
                        : null
                });
            }

            const nested = firstStructuralDivergence(
                actual[key],
                expected[key],
                [...path, key],
                kind
            );

            if (nested != null) {
                return nested;
            }
        }

        return null;
    }

    return actual === expected
        ? null
        : divergenceValue({
            kind,
            reason:
                CLRSTestDivergenceReason.VALUE_MISMATCH,
            path,
            expected,
            actual
        });
}

function firstBooleanDivergence(actual, expected) {
    const actualBoolean = parseCLRSTestBoolean(actual);
    const expectedBoolean = parseCLRSTestBoolean(expected);

    if (
        actualBoolean != null &&
        expectedBoolean != null &&
        actualBoolean === expectedBoolean
    ) {
        return null;
    }

    return divergenceValue({
        kind: CLRSTestDivergenceKind.BOOLEAN,
        reason: actualBoolean == null
            ? CLRSTestDivergenceReason.INVALID_ACTUAL
            : CLRSTestDivergenceReason.VALUE_MISMATCH,
        expected: expectedBoolean ?? expected,
        actual: actualBoolean ?? actual
    });
}

function firstRegexDivergence(actual, expected) {
    const parsed = parseCLRSTestSafeRegex(expected);

    if (parsed.ok && parsed.value.test(actual)) {
        return null;
    }

    return divergenceValue({
        kind: CLRSTestDivergenceKind.REGEX,
        reason:
            CLRSTestDivergenceReason.PATTERN_MISMATCH,
        expected,
        actual
    });
}

function firstDifferentIndex(actual, expected) {
    const length = Math.max(
        actual.length,
        expected.length
    );

    for (let index = 0; index < length; index += 1) {
        if (actual[index] !== expected[index]) {
            return index;
        }
    }

    return null;
}

function characterPosition(characters, index) {
    let line = 1;
    let column = 1;

    for (
        let characterIndex = 0;
        characterIndex < index;
        characterIndex += 1
    ) {
        if (characters[characterIndex] === "\n") {
            line += 1;
            column = 1;
        } else {
            column += 1;
        }
    }

    return { line, column };
}

function presenceReason(expectedPresent, actualPresent) {
    if (!actualPresent) {
        return CLRSTestDivergenceReason.MISSING_VALUE;
    }

    if (!expectedPresent) {
        return CLRSTestDivergenceReason.UNEXPECTED_VALUE;
    }

    return CLRSTestDivergenceReason.VALUE_MISMATCH;
}

function jsonType(value) {
    if (value === null) {
        return "null";
    }

    if (Array.isArray(value)) {
        return "array";
    }

    return typeof value;
}

function finiteDifference(left, right) {
    const difference = Math.abs(left - right);

    return Number.isFinite(difference)
        ? difference
        : null;
}

function divergenceValue(source) {
    return createCLRSTestDivergence(source);
}

function normalizeWhitespace(value) {
    return value.replace(/\s+/gu, " ").trim();
}

function normalizedLines(value) {
    const lines = value.replace(/\r\n?/gu, "\n")
        .split("\n");

    if (lines.at(-1) === "") {
        lines.pop();
    }

    return lines;
}

function requireText(value, name) {
    if (typeof value !== "string") {
        throw new TypeError(
            `The CLRS test ${name} is invalid.`
        );
    }

    return value;
}
