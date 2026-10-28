import {
    CLRSTestComparison
} from "./CLRSTestTypes.js";
import {
    invalid
} from "./CLRSTestValidation.js";

export const CLRS_TEST_COMPARISON_LIMITS =
    Object.freeze({
        maximumRegexPatternCharacters: 1_024,
        maximumRegexQuantifiers: 1
    });

export const CLRS_TEST_COMPARISON_FORMATS =
    Object.freeze({
        [CLRSTestComparison.EXACT]:
            "texto exacto, incluyendo espacios y saltos de línea",
        [CLRSTestComparison.TRIMMED]:
            "texto ignorando espacios exteriores",
        [CLRSTestComparison.NORMALIZED_WHITESPACE]:
            "texto ignorando diferencias entre bloques de espacios",
        [CLRSTestComparison.LINES]:
            "líneas en el mismo orden; CRLF y LF son equivalentes",
        [CLRSTestComparison.UNORDERED_LINES]:
            "líneas en cualquier orden, conservando duplicados",
        [CLRSTestComparison.NUMBER]:
            "número finito, sin texto adicional",
        [CLRSTestComparison.NUMBER_TOLERANCE]:
            "<valor> ± <tolerancia absoluta no negativa>",
        [CLRSTestComparison.JSON]:
            "JSON estructural válido",
        [CLRSTestComparison.ARRAY_ORDERED]:
            "arreglo JSON estructural en el mismo orden",
        [CLRSTestComparison.ARRAY_UNORDERED]:
            "arreglo JSON estructural en cualquier orden, conservando duplicados",
        [CLRSTestComparison.BOOLEAN]:
            "true, false, VERDAD o FALSO",
        [CLRSTestComparison.CONTAINS]:
            "fragmento de texto no vacío",
        [CLRSTestComparison.REGEX_SAFE]:
            "regex lineal sin grupos, alternancias, referencias ni más de un cuantificador"
    });

export const CLRS_TEST_COMPARISON_LABELS =
    Object.freeze({
        [CLRSTestComparison.EXACT]: "Texto exacto",
        [CLRSTestComparison.TRIMMED]:
            "Texto sin espacios exteriores",
        [CLRSTestComparison.NORMALIZED_WHITESPACE]:
            "Texto con espacios normalizados",
        [CLRSTestComparison.LINES]:
            "Líneas ordenadas",
        [CLRSTestComparison.UNORDERED_LINES]:
            "Líneas sin orden",
        [CLRSTestComparison.NUMBER]: "Número",
        [CLRSTestComparison.NUMBER_TOLERANCE]:
            "Número con tolerancia",
        [CLRSTestComparison.JSON]: "JSON estructural",
        [CLRSTestComparison.ARRAY_ORDERED]:
            "Arreglo JSON ordenado",
        [CLRSTestComparison.ARRAY_UNORDERED]:
            "Arreglo JSON sin orden",
        [CLRSTestComparison.BOOLEAN]: "Booleano",
        [CLRSTestComparison.CONTAINS]:
            "Contiene el fragmento",
        [CLRSTestComparison.REGEX_SAFE]:
            "Expresión regular segura"
    });

/**
 * Valida el oráculo según el comparador seleccionado. Esta validación vive en
 * el dominio neutral para que el Explorador de pruebas y BROKER.95 compartan
 * exactamente la misma interpretación de números, JSON, arreglos y regex.
 */
export function validateCLRSTestExpectationFormat(
    comparison,
    expected
) {
    switch (comparison) {
        case CLRSTestComparison.NUMBER:
            requireParsed(
                parseCLRSTestFiniteNumber(expected),
                "CLRS_TEST_EXPECTED_NUMBER_INVALID"
            );
            break;
        case CLRSTestComparison.NUMBER_TOLERANCE:
            requireParsed(
                parseCLRSTestNumberTolerance(expected),
                "CLRS_TEST_EXPECTED_TOLERANCE_INVALID"
            );
            break;
        case CLRSTestComparison.JSON:
            if (!parseCLRSTestJson(expected).ok) {
                invalid(
                    "CLRS_TEST_EXPECTED_JSON_INVALID",
                    "expectation.stdout"
                );
            }
            break;
        case CLRSTestComparison.ARRAY_ORDERED:
        case CLRSTestComparison.ARRAY_UNORDERED: {
            const parsed = parseCLRSTestJson(expected);

            if (!parsed.ok || !Array.isArray(parsed.value)) {
                invalid(
                    "CLRS_TEST_EXPECTED_ARRAY_INVALID",
                    "expectation.stdout"
                );
            }
            break;
        }
        case CLRSTestComparison.BOOLEAN:
            requireParsed(
                parseCLRSTestBoolean(expected),
                "CLRS_TEST_EXPECTED_BOOLEAN_INVALID"
            );
            break;
        case CLRSTestComparison.CONTAINS:
            if (expected.length === 0) {
                invalid(
                    "CLRS_TEST_EXPECTED_CONTAINS_INVALID",
                    "expectation.stdout"
                );
            }
            break;
        case CLRSTestComparison.REGEX_SAFE:
            if (!parseCLRSTestSafeRegex(expected).ok) {
                invalid(
                    "CLRS_TEST_EXPECTED_REGEX_INVALID",
                    "expectation.stdout"
                );
            }
            break;
        default:
            break;
    }

    return expected;
}

export function parseCLRSTestFiniteNumber(value) {
    const normalized = String(value).trim();

    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u
        .test(normalized)) {
        return null;
    }

    const number = Number(normalized);

    return Number.isFinite(number) ? number : null;
}

export function parseCLRSTestNumberTolerance(value) {
    const match = String(value).trim().match(
        /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*(?:±|\+\/-)\s*([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/u
    );

    if (match == null) {
        return null;
    }

    const expected = Number(match[1]);
    const tolerance = Number(match[2]);

    return Number.isFinite(expected) &&
        Number.isFinite(tolerance) &&
        tolerance >= 0
        ? Object.freeze({
            value: expected,
            tolerance
        })
        : null;
}

export function parseCLRSTestJson(value) {
    try {
        return Object.freeze({
            ok: true,
            value: JSON.parse(String(value).trim())
        });
    } catch {
        return Object.freeze({
            ok: false,
            value: null
        });
    }
}

export function parseCLRSTestBoolean(value) {
    switch (String(value).trim()
        .toLocaleLowerCase("es-MX")) {
        case "true":
        case "verdad":
            return true;
        case "false":
        case "falso":
            return false;
        default:
            return null;
    }
}

export function parseCLRSTestSafeRegex(pattern) {
    if (
        typeof pattern !== "string" ||
        pattern.length === 0 ||
        pattern.length >
            CLRS_TEST_COMPARISON_LIMITS
                .maximumRegexPatternCharacters ||
        /[()|]/u.test(pattern) ||
        /\\[1-9]/u.test(pattern) ||
        !hasLinearQuantifiers(pattern)
    ) {
        return Object.freeze({
            ok: false,
            value: null
        });
    }

    try {
        return Object.freeze({
            ok: true,
            value: new RegExp(pattern, "u")
        });
    } catch {
        return Object.freeze({
            ok: false,
            value: null
        });
    }
}

export function canonicalizeCLRSTestJson(value) {
    if (Array.isArray(value)) {
        return `[${value.map(
            canonicalizeCLRSTestJson
        ).join(",")}]`;
    }

    if (value != null && typeof value === "object") {
        return `{${Object.keys(value).sort().map(
            key =>
                `${JSON.stringify(key)}:${canonicalizeCLRSTestJson(value[key])}`
        ).join(",")}}`;
    }

    return JSON.stringify(value);
}

function requireParsed(value, code) {
    if (value == null) {
        invalid(code, "expectation.stdout");
    }
}

function hasLinearQuantifiers(pattern) {
    let index = 0;
    let previousWasQuantifier = false;
    let quantifierCount = 0;

    while (index < pattern.length) {
        const character = pattern[index];

        if (character === "\\") {
            index += 2;
            previousWasQuantifier = false;
            continue;
        }

        if (character === "[") {
            const closing = findClassEnd(
                pattern,
                index + 1
            );

            if (closing < 0) {
                return false;
            }

            index = closing + 1;
            previousWasQuantifier = false;
            continue;
        }

        if (
            character === "*" ||
            character === "+" ||
            character === "?" ||
            character === "{"
        ) {
            quantifierCount += 1;

            if (
                previousWasQuantifier ||
                index === 0 ||
                quantifierCount >
                    CLRS_TEST_COMPARISON_LIMITS
                        .maximumRegexQuantifiers
            ) {
                return false;
            }

            if (character === "{") {
                const closing = pattern.indexOf(
                    "}",
                    index + 1
                );

                if (
                    closing < 0 ||
                    !/^\d+(?:,\d*)?$/u.test(
                        pattern.slice(index + 1, closing)
                    )
                ) {
                    return false;
                }
                index = closing + 1;
            } else {
                index += 1;
            }

            previousWasQuantifier = true;
            continue;
        }

        if (character === "}" || character === "]") {
            return false;
        }

        index += 1;
        previousWasQuantifier = false;
    }

    return true;
}

function findClassEnd(pattern, start) {
    for (
        let index = start;
        index < pattern.length;
        index += 1
    ) {
        if (pattern[index] === "\\") {
            index += 1;
        } else if (pattern[index] === "]") {
            return index;
        }
    }

    return -1;
}
