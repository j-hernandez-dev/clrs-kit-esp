import assert from "node:assert/strict";
import test from "node:test";

import {
    CLRS_TEST_EXPLANATION_LIMITS,
    CLRSTestPedagogicalExplanation,
    compareCLRSTestOutput,
    explainCLRSTestDivergence
} from "../src/testing/index.js";

test("explica una diferencia textual con su posición verificable", () => {
    const explanation = explain(
        "exact",
        "uno\nabc",
        "uno\naxc"
    );

    assert.ok(
        explanation instanceof
            CLRSTestPedagogicalExplanation
    );
    assert.match(
        explanation.summary,
        /línea 2, columna 2/u
    );
    assert.match(explanation.summary, /"b"/u);
    assert.match(explanation.summary, /"x"/u);
    assert.match(
        explanation.technicalDetail,
        /Comparador: Texto exacto \(exact\)/u
    );
    assert.equal(
        explanation.summary.includes("concaten"),
        false,
        "no debe inventar una causa a partir de la salida"
    );
    assert.equal(Object.isFrozen(explanation), true);
});

test("distingue salida truncada, texto adicional y líneas sin orden", () => {
    const missing = explain("exact", "hola", "hol");
    const unexpected = explain("exact", "hola", "hola!");
    const unordered = explain(
        "unordered-lines",
        "uno\nuno\ndos",
        "dos\nuno"
    );

    assert.equal(
        missing.title,
        "La salida terminó antes de tiempo"
    );
    assert.equal(
        unexpected.title,
        "La salida contiene texto adicional"
    );
    assert.match(
        unordered.summary,
        /cantidad de apariciones/u
    );
});

test("explica números inválidos, diferencias y tolerancias", () => {
    const invalid = explain("number", "10", "diez");
    const different = explain("number", "10", "12");
    const tolerance = explain(
        "number-tolerance",
        "10 ± 0.25",
        "10.5"
    );

    assert.equal(
        invalid.title,
        "La salida no es un número válido"
    );
    assert.match(
        different.summary,
        /2 unidades por encima/u
    );
    assert.match(
        tolerance.summary,
        /tolerancia de 0\.25/u
    );
    assert.match(
        tolerance.summary,
        /La diferencia es 0\.5/u
    );
});

test("explica la ruta exacta de objetos, arreglos y matrices", () => {
    const value = explain(
        "json",
        JSON.stringify({
            items: [
                { name: "Ada" },
                { name: "Grace" }
            ]
        }),
        JSON.stringify({
            items: [
                { name: "Ada" },
                { name: "Gracia" }
            ]
        })
    );
    const missing = explain(
        "array-ordered",
        "[[1,2],[3,4]]",
        "[[1,2],[3]]"
    );
    const unordered = explain(
        "array-unordered",
        "[1,2]",
        "[2,3]"
    );

    assert.match(
        value.summary,
        /\$\.items\[1\]\.name/u
    );
    assert.match(
        value.technicalDetail,
        /Ruta: \$\.items\[1\]\.name/u
    );
    assert.match(missing.summary, /\$\[1\]\[1\]/u);
    assert.match(
        unordered.summary,
        /falta 1 y sobra 3/u
    );
});

test("separa diferencias de tipo, booleanos, fragmentos y patrones", () => {
    const type = explain(
        "json",
        '{"valor":[1]}',
        '{"valor":"1"}'
    );
    const boolean = explain(
        "boolean",
        "true",
        "false"
    );
    const contains = explain(
        "contains",
        "resultado",
        "valor: 42"
    );
    const regex = explain(
        "regex-safe",
        "^item-\\d+$",
        "item-x"
    );

    assert.match(
        type.summary,
        /se esperaba un arreglo/u
    );
    assert.match(type.summary, /se obtuvo una cadena/u);
    assert.equal(
        boolean.title,
        "El resultado booleano está invertido"
    );
    assert.equal(
        contains.title,
        "Falta el fragmento requerido"
    );
    assert.equal(
        regex.title,
        "La salida no cumple el patrón esperado"
    );
});

test("la explicación es determinista, acotada y no altera la evidencia", () => {
    const actual = "x".repeat(10_000);
    const first = explain("contains", "z", actual);
    const second = explain("contains", "z", actual);

    assert.deepEqual(first, second);
    assert.equal(
        first.technicalDetail.length <=
            CLRS_TEST_EXPLANATION_LIMITS
                .maximumFieldCharacters,
        true
    );
    assert.match(first.technicalDetail, /…/u);

    const extreme = explain(
        "number",
        "1e308",
        "-1e308"
    );

    assert.match(
        extreme.summary,
        /por debajo del valor esperado/u
    );
});

function explain(comparison, expected, actual) {
    const result = compareCLRSTestOutput({
        comparison,
        stdout: expected
    }, actual);

    assert.equal(result.passed, false);

    return explainCLRSTestDivergence({
        comparison,
        divergence: result.divergence
    });
}
