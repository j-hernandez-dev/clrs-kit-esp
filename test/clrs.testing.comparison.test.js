import assert from "node:assert/strict";
import test from "node:test";

import {
    CLRS_TEST_COMPARISON_FORMATS,
    CLRS_TEST_COMPARISON_LABELS,
    CLRSTestComparison,
    CLRSTestDomainError,
    compareCLRSTestOutput,
    createCLRSTestExpectation
} from "../src/testing/index.js";

test("compara texto, líneas y valores escalares con reglas explícitas", () => {
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
        ["number", "1.25e2\n", "125"],
        ["number-tolerance", "1.1", "1 ± 0.1"],
        ["boolean", "FALSO\n", "false"],
        ["contains", "resultado: 42\n", "42"],
        ["regex-safe", "item-42", "^item-\\d+$"]
    ];

    for (const [comparison, actual, expected] of cases) {
        const result = compareCLRSTestOutput(
            { comparison, stdout: expected },
            actual
        );

        assert.deepEqual({ ...result }, {
            passed: true,
            comparison,
            reason: null,
            divergence: null
        });
        assert.equal(Object.isFrozen(result), true);
    }
});

test("compara objetos, matrices y arreglos como estructuras JSON", () => {
    const cases = [
        [
            "json",
            '{"matriz":[[1,2],[3,4]],"meta":{"b":2,"a":1}}',
            '{"meta":{"a":1,"b":2},"matriz":[[1,2],[3,4]]}'
        ],
        [
            "array-ordered",
            '[[1,2],{"b":2,"a":1}]',
            '[[1,2],{"a":1,"b":2}]'
        ],
        [
            "array-unordered",
            '[2,{"b":1,"a":0},2,[3,4]]',
            '[[3,4],{"a":0,"b":1},2,2]'
        ]
    ];

    for (const [comparison, actual, expected] of cases) {
        assert.equal(
            compareCLRSTestOutput(
                { comparison, stdout: expected },
                actual
            ).passed,
            true,
            comparison
        );
    }

    assert.equal(
        compareCLRSTestOutput({
            comparison: "array-unordered",
            stdout: "[1,1,2]"
        }, "[1,2]").passed,
        false,
        "los duplicados forman parte de la estructura"
    );
});

test("identifica de forma estable el comparador que rechazó la salida", () => {
    const cases = [
        ["exact", "exact-mismatch", "Hola", "hola"],
        ["lines", "lines-mismatch", "uno", "dos"],
        ["number", "number-mismatch", "12 datos", "12"],
        ["json", "json-mismatch", "{mal}", "{}"],
        [
            "array-ordered",
            "array-ordered-mismatch",
            "[2,1]",
            "[1,2]"
        ],
        [
            "array-unordered",
            "array-unordered-mismatch",
            "[1,2]",
            "[1,2,2]"
        ]
    ];

    for (
        const [comparison, reason, actual, expected]
        of cases
    ) {
        const result = compareCLRSTestOutput(
            { comparison, stdout: expected },
            actual
        );

        assert.equal(result.passed, false);
        assert.equal(result.comparison, comparison);
        assert.equal(result.reason, reason);
        assert.notEqual(result.divergence, null);
    }
});

test("localiza la primera diferencia textual por índice, línea y columna", () => {
    const result = compareCLRSTestOutput({
        comparison: "exact",
        stdout: "uno\nabY\n"
    }, "uno\nabX\n");
    const divergence = result.divergence;

    assert.equal(divergence.kind, "text");
    assert.equal(divergence.reason, "value-mismatch");
    assert.equal(divergence.index, 6);
    assert.equal(divergence.line, 2);
    assert.equal(divergence.column, 3);
    assert.equal(divergence.expected, "Y");
    assert.equal(divergence.actual, "X");
    assert.equal(Object.isFrozen(divergence), true);
});

test("distingue líneas ausentes y excedentes conservando su posición", () => {
    const missing = compareCLRSTestOutput({
        comparison: "lines",
        stdout: "uno\ndos\ntres"
    }, "uno\ndos").divergence;
    const unexpected = compareCLRSTestOutput({
        comparison: "lines",
        stdout: "uno"
    }, "uno\ndos").divergence;

    assert.deepEqual({
        reason: missing.reason,
        path: [...missing.path],
        line: missing.line,
        expected: missing.expected,
        actualPresent: missing.actualPresent
    }, {
        reason: "missing-value",
        path: [2],
        line: 3,
        expected: "tres",
        actualPresent: false
    });
    assert.deepEqual({
        reason: unexpected.reason,
        line: unexpected.line,
        expectedPresent: unexpected.expectedPresent,
        actual: unexpected.actual
    }, {
        reason: "unexpected-value",
        line: 2,
        expectedPresent: false,
        actual: "dos"
    });
});

test("recorre objetos, arreglos y matrices hasta la primera ruta divergente", () => {
    const value = compareCLRSTestOutput({
        comparison: "json",
        stdout: JSON.stringify({
            items: [
                { name: "Ada" },
                { name: "Grace" }
            ]
        })
    }, JSON.stringify({
        items: [
            { name: "Ada" },
            { name: "Gracia" }
        ]
    })).divergence;
    const missing = compareCLRSTestOutput({
        comparison: "array-ordered",
        stdout: "[[1,2],[3,4]]"
    }, "[[1,2],[3]]").divergence;

    assert.deepEqual([...value.path], [
        "items",
        1,
        "name"
    ]);
    assert.equal(value.expected, "Grace");
    assert.equal(value.actual, "Gracia");
    assert.deepEqual([...missing.path], [1, 1]);
    assert.equal(missing.reason, "missing-value");
    assert.equal(missing.expected, 4);
    assert.equal(missing.actualPresent, false);
    assert.equal(Object.isFrozen(value.path), true);
});

test("cuantifica la divergencia numérica y la tolerancia incumplida", () => {
    const number = compareCLRSTestOutput({
        comparison: "number",
        stdout: "10"
    }, "12").divergence;
    const tolerance = compareCLRSTestOutput({
        comparison: "number-tolerance",
        stdout: "10 ± 0.25"
    }, "10.5").divergence;
    const invalid = compareCLRSTestOutput({
        comparison: "number",
        stdout: "10"
    }, "diez").divergence;

    assert.equal(number.difference, 2);
    assert.equal(tolerance.reason, "outside-tolerance");
    assert.equal(tolerance.difference, 0.5);
    assert.equal(tolerance.tolerance, 0.25);
    assert.equal(invalid.reason, "invalid-actual");
    assert.equal(invalid.actual, "diez");
});

test("localiza faltantes y excedentes sin confundir elementos reordenados", () => {
    const array = compareCLRSTestOutput({
        comparison: "array-unordered",
        stdout: "[1,2]"
    }, "[2,3]").divergence;
    const lines = compareCLRSTestOutput({
        comparison: "unordered-lines",
        stdout: "uno\nuno\ndos"
    }, "dos\nuno").divergence;

    assert.equal(array.expected, 1);
    assert.equal(array.actual, 3);
    assert.equal(array.reason, "value-mismatch");
    assert.equal(lines.expected, "uno");
    assert.equal(lines.actualPresent, false);
    assert.equal(lines.reason, "missing-value");
});

test("clasifica divergencias booleanas, de contenido y de patrón", () => {
    const cases = [
        ["boolean", "true", "quizá", "boolean", "invalid-actual"],
        [
            "contains",
            "resultado: 42",
            "resultado",
            "contains",
            "fragment-missing"
        ],
        [
            "regex-safe",
            "^item-\\d+$",
            "item-x",
            "regex",
            "pattern-mismatch"
        ]
    ];

    for (
        const [comparison, expected, actual, kind, reason]
        of cases
    ) {
        const divergence = compareCLRSTestOutput({
            comparison,
            stdout: expected
        }, actual).divergence;

        assert.equal(divergence.kind, kind);
        assert.equal(divergence.reason, reason);
    }
});

test("valida el formato estructural del resultado esperado", () => {
    const cases = [
        ["number", "doce", "CLRS_TEST_EXPECTED_NUMBER_INVALID"],
        [
            "number-tolerance",
            "3.14",
            "CLRS_TEST_EXPECTED_TOLERANCE_INVALID"
        ],
        ["json", "{", "CLRS_TEST_EXPECTED_JSON_INVALID"],
        [
            "array-ordered",
            "{}",
            "CLRS_TEST_EXPECTED_ARRAY_INVALID"
        ],
        [
            "boolean",
            "sí",
            "CLRS_TEST_EXPECTED_BOOLEAN_INVALID"
        ],
        [
            "contains",
            "",
            "CLRS_TEST_EXPECTED_CONTAINS_INVALID"
        ],
        [
            "regex-safe",
            "(a+)+$",
            "CLRS_TEST_EXPECTED_REGEX_INVALID"
        ]
    ];

    for (const [comparison, stdout, code] of cases) {
        assert.throws(
            () => createCLRSTestExpectation({
                comparison,
                stdout
            }),
            error =>
                error instanceof CLRSTestDomainError &&
                error.code === code,
            comparison
        );
    }
});

test("publica el catálogo completo de comparadores para sus consumidores", () => {
    assert.deepEqual(
        Object.keys(CLRS_TEST_COMPARISON_FORMATS).sort(),
        Object.values(CLRSTestComparison).sort()
    );
    assert.deepEqual(
        Object.keys(CLRS_TEST_COMPARISON_LABELS).sort(),
        Object.values(CLRSTestComparison).sort()
    );
    assert.equal(Object.isFrozen(
        CLRS_TEST_COMPARISON_FORMATS
    ), true);
    assert.equal(Object.isFrozen(
        CLRS_TEST_COMPARISON_LABELS
    ), true);
});
