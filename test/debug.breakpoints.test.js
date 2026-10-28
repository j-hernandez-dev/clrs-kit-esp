import test from "node:test";
import assert from "node:assert/strict";

import {
    BreakpointExpressionCompiler
} from "../extension/debug/BreakpointExpressionCompiler.js";

test("compila condiciones CLRS y llamadas estándar seguras", () => {
    const compiler =
        new BreakpointExpressionCompiler();
    const result = compiler.compileBreakpoint({
        condition:
            "i >= 3 y LONG(A) > 1"
    });

    assert.equal(result.ok, true);
    assert.equal(
        result.value.condition.type,
        "LogicalExpression"
    );
    assert.equal(
        result.value.condition
            .right.left.name,
        "LONG"
    );
    assert.equal(
        result.value.condition
            .right.left.arguments[0].name,
        "A"
    );
});

test("compila arreglos literales anidados en expresiones de depuración", () => {
    const result =
        new BreakpointExpressionCompiler()
            .compileBreakpoint({
                condition:
                    "CONT([1, MAX(2, 3), [4]], i)"
            });
    const literal =
        result.value.condition.arguments[0];

    assert.equal(result.ok, true);
    assert.equal(
        literal.type,
        "ArrayExpression"
    );
    assert.equal(literal.elements.length, 3);
    assert.equal(
        literal.elements[1].name,
        "MAX"
    );
    assert.equal(
        literal.elements[2].type,
        "ArrayExpression"
    );
});

test("compila logpoints interpolados y llaves literales", () => {
    const compiler =
        new BreakpointExpressionCompiler();
    const result = compiler.compileBreakpoint({
        logMessage:
            "{{i}} = {i}; tamaño={LONG(A)}"
    });

    assert.equal(result.ok, true);
    assert.deepEqual(
        result.value.logSegments
            .map(segment => segment.type),
        [
            "text",
            "expression",
            "text",
            "expression"
        ]
    );
    assert.equal(
        result.value.logSegments[0]
            .value,
        "{i} = "
    );
    assert.equal(
        result.value.logSegments[1]
            .expression.name,
        "i"
    );
});

test("aplica a las cadenas las mismas secuencias de escape que CLRS", () => {
    const compiler =
        new BreakpointExpressionCompiler();
    const escaped = compiler.compileBreakpoint({
        condition:
            'texto == "línea\\ncolumna\\t\\\"fin\\\""'
    });
    const preserved = compiler.compileBreakpoint({
        condition:
            'texto == "ruta\\\\nueva\\q"'
    });

    assert.equal(escaped.ok, true);
    assert.equal(
        escaped.value.condition.right.value,
        "línea\ncolumna\t\"fin\""
    );
    assert.equal(preserved.ok, true);
    assert.equal(
        preserved.value.condition.right.value,
        "ruta\\\\nueva\\q"
    );
});

test("valida todas las formas de conteo de impactos", () => {
    const compiler =
        new BreakpointExpressionCompiler();
    const cases = [
        ["3", "=", 3],
        ["= 4", "=", 4],
        ["== 5", "==", 5],
        ["> 2", ">", 2],
        [">= 7", ">=", 7],
        ["< 9", "<", 9],
        ["<= 10", "<=", 10],
        ["% 2", "%", 2]
    ];

    for (const [source, operator, value] of cases) {
        const result = compiler
            .compileBreakpoint({
                hitCondition: source
            });

        assert.equal(result.ok, true);
        assert.deepEqual(
            result.value.hitCondition,
            { operator, value }
        );
    }
});

test("rechaza condiciones, impactos y llamadas no seguras", () => {
    const compiler =
        new BreakpointExpressionCompiler();
    const invalidSyntax =
        compiler.compileBreakpoint({
            condition: "i >"
        });
    const invalidHit =
        compiler.compileBreakpoint({
            hitCondition: "cada 3"
        });
    const unsafeCall =
        compiler.compileBreakpoint({
            condition: "CALCULA(i) > 0"
        });

    assert.equal(invalidSyntax.ok, false);
    assert.match(
        invalidSyntax.error,
        /expresión CLRS válida/
    );
    assert.equal(invalidHit.ok, false);
    assert.match(
        invalidHit.error,
        /conteo de impactos/
    );
    assert.equal(unsafeCall.ok, false);
    assert.match(
        unsafeCall.error,
        /sin efectos secundarios/
    );
});
