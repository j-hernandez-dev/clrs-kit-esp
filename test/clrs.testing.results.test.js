import assert from "node:assert/strict";
import test from "node:test";

import {
    CLRSTestFailureKind,
    CLRSTestResultStatus,
    compareCLRSTestOutput,
    createCLRSTestCase,
    createCLRSTestResult,
    explainCLRSTestDivergence
} from "../src/testing/index.js";
import {
    CLRS_TEST_RESULT_PRESENTATION_LIMITS,
    CLRSTestResultPresenter
} from "../extension/testing/index.js";

const PROGRAM_PATH = "C:\\workspace\\programa.clrs";

test("presenta entrada, salidas, duración y semilla de una prueba aprobada", () => {
    const fixture = createFixture();
    const result = testResult({
        status: CLRSTestResultStatus.PASSED,
        stdout: "13\n",
        durationMs: 17,
        seed: 91,
        exitCode: 0
    });

    fixture.presenter.present({
        testRun: fixture.run,
        item: fixture.item,
        testCase: testCase(),
        result,
        programPath: PROGRAM_PATH
    });

    assert.deepEqual(fixture.run.passedItems, [{
        item: fixture.item,
        duration: 17
    }]);
    assert.equal(fixture.run.outputs.length, 1);
    assert.match(
        fixture.run.outputs[0].text,
        /Prueba CLRS · Suma dos valores/u
    );
    assert.match(
        fixture.run.outputs[0].text,
        /Entrada:\r\n5\r\n8/u
    );
    assert.match(
        fixture.run.outputs[0].text,
        /Salida esperada:\r\n13/u
    );
    assert.match(
        fixture.run.outputs[0].text,
        /Salida obtenida:\r\n13/u
    );
    assert.match(
        fixture.run.outputs[0].text,
        /Duración: 17 ms/u
    );
    assert.match(
        fixture.run.outputs[0].text,
        /Comparación: Texto exacto/u
    );
    assert.match(
        fixture.run.outputs[0].text,
        /Semilla: 91/u
    );
    assert.equal(
        /(?<!\r)\n/u.test(
            fixture.run.outputs[0].text
        ),
        false
    );
    assert.equal(
        fixture.run.outputs[0].text.includes(
            "\r\n\r\n\r\n"
        ),
        false
    );
    assert.match(
        fixture.run.outputs[0].text,
        /Código de salida: 0\r\n\r\nEntrada:\r\n5\r\n8\r\n\r\nSalida esperada:\r\n13\r\n\r\nSalida obtenida:\r\n13\r\n\r\n$/u
    );
});

test("usa la diferencia nativa y enlaza un resultado fallido al código", () => {
    const fixture = createFixture();
    const comparison = compareCLRSTestOutput({
        comparison: "exact",
        stdout: "13\n"
    }, "58\n");
    const result = testResult({
        status: CLRSTestResultStatus.FAILED,
        stdout: "58\n",
        durationMs: 4,
        failure: {
            kind: CLRSTestFailureKind.ASSERTION,
            code: "CLRS_TEST_OUTPUT_MISMATCH",
            message: "La salida no coincide con la esperada.",
            expected: "13\n",
            actual: "58\n",
            divergence: comparison.divergence,
            pedagogicalExplanation:
                explainCLRSTestDivergence({
                    comparison: "exact",
                    divergence:
                        comparison.divergence
                }),
            location: {
                sourcePath: PROGRAM_PATH,
                startLine: 6,
                startColumn: 5,
                endLine: 6,
                endColumn: 18
            }
        }
    });

    fixture.presenter.present({
        testRun: fixture.run,
        item: fixture.item,
        testCase: testCase(),
        result,
        programPath: PROGRAM_PATH
    });

    const failed = fixture.run.failedItems[0];
    const pedagogical = failed.message[0];
    const difference = failed.message[1];

    assert.equal(failed.message.length, 2);
    assert.match(
        pedagogical.message,
        /primer carácter diferente/u
    );
    assert.match(
        pedagogical.message,
        /Siguiente paso:/u
    );
    assert.equal(difference.expectedOutput, "13\n");
    assert.equal(difference.actualOutput, "58\n");
    assert.equal(
        difference.location.uri.fsPath,
        PROGRAM_PATH
    );
    assert.deepEqual(
        difference.location.range.values,
        [5, 4, 5, 17]
    );
    assert.deepEqual(
        fixture.run.outputs[0].location.range.values,
        [5, 4, 5, 17]
    );
    assert.match(
        fixture.run.outputs[0].text,
        /\[CLRS_TEST_OUTPUT_MISMATCH\]/u
    );
    assert.match(
        fixture.run.outputs[0].text,
        /Primera divergencia:\r\n/u
    );
    assert.match(
        fixture.run.outputs[0].text,
        /Detalle técnico:\r\nComparador: Texto exacto/u
    );
    assert.match(
        fixture.run.outputs[0].text,
        /Salida obtenida:\r\n58\r\n\r\nResultado:\r\n/u
    );
    assert.doesNotMatch(
        fixture.run.outputs[0].text,
        /\r\n\r\n\r\n/u
    );
});

test("separa con una sola línea vacía todas las secciones con evidencia", () => {
    const fixture = createFixture();
    const result = testResult({
        status: CLRSTestResultStatus.ERRORED,
        stdout: "salida\r\n",
        stderr: "detalle técnico\r\n",
        exitCode: 1,
        failure: {
            kind: CLRSTestFailureKind.RUNTIME,
            code: "CLRS_TEST_RUNTIME_ERROR",
            message: "La ejecución terminó con un error."
        }
    });

    fixture.presenter.present({
        testRun: fixture.run,
        item: fixture.item,
        testCase: testCase({
            stdin: "dato\r\n",
            expected: "esperada\r\n"
        }),
        result,
        programPath: PROGRAM_PATH
    });

    const output = fixture.run.outputs[0].text;

    assert.doesNotMatch(
        output,
        /\r\n\r\n\r\n/u
    );
    assert.match(
        output,
        /Entrada:\r\ndato\r\n\r\nSalida esperada:\r\nesperada\r\n\r\nSalida obtenida:\r\nsalida\r\n\r\nResultado:\r\n/u
    );
    assert.match(
        output,
        /La ejecución terminó con un error\.\r\n\r\nSalida de error:\r\ndetalle técnico\r\n\r\n$/u
    );
});

test("publica todos los diagnósticos de fuente como mensajes navegables", () => {
    const fixture = createFixture();
    const diagnostics = [
        diagnostic({
            code: "CLRS_SYNTACTIC_ONE",
            message: "Falta una expresión.",
            line: 2,
            column: 9
        }),
        diagnostic({
            code: "CLRS_SYNTACTIC_TWO",
            message: "La instrucción está incompleta.",
            line: 4,
            column: 3
        })
    ];
    const result = testResult({
        status: CLRSTestResultStatus.ERRORED,
        durationMs: 0,
        failure: {
            kind: CLRSTestFailureKind.SYNTAX,
            code: "CLRS_SYNTACTIC_ONE",
            message: "Falta una expresión.",
            location: {
                sourcePath: PROGRAM_PATH,
                startLine: 2,
                startColumn: 9,
                endLine: 2,
                endColumn: 9
            },
            diagnostics
        }
    });

    fixture.presenter.present({
        testRun: fixture.run,
        item: fixture.item,
        testCase: testCase(),
        result,
        programPath: PROGRAM_PATH
    });

    const messages = fixture.run.erroredItems[0]
        .message;

    assert.equal(messages.length, 2);
    assert.equal(
        messages[0].message,
        "[CLRS_SYNTACTIC_ONE] Falta una expresión."
    );
    assert.deepEqual(
        messages.map(message =>
            message.location.range.values
        ),
        [
            [1, 8, 1, 8],
            [3, 2, 3, 2]
        ]
    );
});

test("acota evidencia extensa sin alterar el resultado semántico", () => {
    const fixture = createFixture();
    const content = "x".repeat(
        CLRS_TEST_RESULT_PRESENTATION_LIMITS
            .maximumDiffCharacters + 10
    );
    const result = testResult({
        status: CLRSTestResultStatus.FAILED,
        stdout: content,
        failure: {
            kind: CLRSTestFailureKind.ASSERTION,
            message: "La salida no coincide.",
            expected: content,
            actual: content
        }
    });

    fixture.presenter.present({
        testRun: fixture.run,
        item: fixture.item,
        testCase: testCase({ expected: content }),
        result,
        programPath: PROGRAM_PATH
    });

    const failed = fixture.run.failedItems[0];

    assert.match(
        failed.message.expectedOutput,
        /contenido truncado/u
    );
    assert.match(
        fixture.run.outputs[0].text,
        /contenido truncado/u
    );
    assert.equal(result.failure.expected, content);
});

test("distingue una cancelación y conserva su evidencia en la salida", () => {
    const fixture = createFixture();
    const result = testResult({
        status: CLRSTestResultStatus.CANCELLED
    });

    fixture.presenter.present({
        testRun: fixture.run,
        item: fixture.item,
        testCase: testCase(),
        result,
        programPath: PROGRAM_PATH
    });

    assert.deepEqual(
        fixture.run.skippedItems,
        [fixture.item]
    );
    assert.match(
        fixture.run.outputs[0].text,
        /Estado: Cancelada/u
    );
});

function createFixture() {
    const vscode = fakeVSCode();

    return {
        presenter: new CLRSTestResultPresenter({
            vscodeApi: vscode,
            workspace: {
                toUri(sourcePath) {
                    return { fsPath: sourcePath };
                }
            }
        }),
        run: testRun(),
        item: { id: "case:item" }
    };
}

function testCase(overrides = {}) {
    return createCLRSTestCase({
        id: "case:suma",
        name: "Suma dos valores",
        input: { stdin: overrides.stdin ?? "5\n8\n" },
        expectation: {
            stdout: overrides.expected ?? "13\n",
            ...(overrides.comparison == null
                ? {}
                : { comparison: overrides.comparison })
        }
    });
}

function testResult(overrides) {
    return createCLRSTestResult({
        suiteId: "suite:suma",
        caseId: "case:suma",
        status: overrides.status,
        durationMs: overrides.durationMs ?? null,
        seed: overrides.seed ?? null,
        stdout: overrides.stdout ?? "",
        stderr: overrides.stderr ?? "",
        exitCode: overrides.exitCode ?? null,
        signal: overrides.signal ?? null,
        failure: overrides.failure ?? null
    });
}

function diagnostic({ code, message, line, column }) {
    return {
        code,
        message,
        phase: "syntax",
        location: {
            startLine: line,
            startColumn: column,
            endLine: line,
            endColumn: column
        }
    };
}

function testRun() {
    return {
        passedItems: [],
        failedItems: [],
        erroredItems: [],
        skippedItems: [],
        outputs: [],
        passed(item, duration) {
            this.passedItems.push({ item, duration });
        },
        failed(item, message, duration) {
            this.failedItems.push({
                item,
                message,
                duration
            });
        },
        errored(item, message, duration) {
            this.erroredItems.push({
                item,
                message,
                duration
            });
        },
        skipped(item) {
            this.skippedItems.push(item);
        },
        appendOutput(text, location, item) {
            this.outputs.push({
                text,
                location,
                item
            });
        }
    };
}

function fakeVSCode() {
    class TestMessage {

        constructor(message) {
            this.message = message;
        }

        static diff(message, expected, actual) {
            const value = new TestMessage(message);
            value.expectedOutput = expected;
            value.actualOutput = actual;
            return value;
        }
    }

    class Range {

        constructor(...values) {
            this.values = values;
        }
    }

    class Location {

        constructor(uri, range) {
            this.uri = uri;
            this.range = range;
        }
    }

    return { TestMessage, Range, Location };
}
