import test from "node:test";
import assert from "node:assert/strict";

import {
    AbstractIntegrality,
    AbstractSign
} from "../src/complex/abstract-domain/index.js";
import {
    CostExpressionFactory as Cost
} from "../src/complex/algebra/CostExpressionFactory.js";
import {
    formatCostExpression
} from "../src/complex/algebra/CostExpressionFormatter.js";
import {
    IterationAnalysisKind
} from "../src/complex/iteration/IterationAnalysis.js";
import {
    IterationAnalysisService
} from "../src/complex/iteration/IterationAnalysisService.js";
import {
    SymbolicValueResolver
} from "../src/complex/iteration/SymbolicValueResolver.js";
import {
    RecurrenceInputAnalysisService
} from "../src/complex/recurrence/RecurrenceInputAnalysisService.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";

test("el dominio conserva tamaños estructurales, intervalos y enteros", () => {
    const ast = parse([
        "RECORRE(A)",
        "    n = LONG(A)",
        "    limite = n + 2"
    ]);
    const resolver = new SymbolicValueResolver();
    const statements = ast.statements[0]
        .body.statements;

    resolver.assign(
        statements[0].left.name,
        statements[0].right
    );
    resolver.assign(
        statements[1].left.name,
        statements[1].right
    );

    const size = resolver.getAbstract("n");
    const limit = resolver.getAbstract("limite");

    assert.deepEqual(size.interval, {
        lower: 0,
        upper: Infinity
    });
    assert.equal(
        size.sign,
        AbstractSign.NON_NEGATIVE
    );
    assert.equal(
        size.integral,
        AbstractIntegrality.YES
    );
    assert.equal(
        formatCostExpression(
            size.structuralSize.expression
        ),
        "A"
    );
    assert.deepEqual(limit.interval, {
        lower: 2,
        upper: Infinity
    });
    assert.equal(
        limit.sign,
        AbstractSign.POSITIVE
    );
    assert.equal(
        limit.integral,
        AbstractIntegrality.YES
    );
});

test("el entorno conserva hechos de camino y une rangos sin inventar expresiones", () => {
    const ast = parse([
        "RECORRE(n)",
        "    si n >= 0",
        "        limite = n + 1",
        "    sino",
        "        limite = 1",
        "    i = 0",
        "    mientras i < limite",
        "        i = i + 1"
    ]);
    const loop = whileOf(ast);
    const model = new IterationAnalysisService()
        .analyze(ast);
    const environment = model.getEnvironment(loop);
    const binding = environment.get("limite");

    assert.equal(
        formatCostExpression(
            binding.expression
        ),
        "limite"
    );
    assert.deepEqual(
        binding.abstractValue.interval,
        {
            lower: 1,
            upper: Infinity
        }
    );
    assert.equal(
        binding.abstractValue.sign,
        AbstractSign.POSITIVE
    );
    assert.equal(
        environment.getConstraints().length,
        0
    );
});

test("las condiciones de rama refinan el entorno capturado por un ciclo", () => {
    const ast = parse([
        "RECORRE(n)",
        "    si n >= 0",
        "        i = 0",
        "        mientras i < n",
        "            i = i + 1"
    ]);
    const loop = whileOf(ast);
    const environment = new IterationAnalysisService()
        .analyze(ast)
        .getEnvironment(loop);
    const size = environment.get("n");

    assert.deepEqual(size.abstractValue.interval, {
        lower: 0,
        upper: Infinity
    });
    assert.equal(
        environment.getConstraints().length,
        1
    );
    assert.equal(
        environment.getConstraints()[0].operator,
        ">="
    );
});

test("los hechos estructurales prueban ciclos inicialmente imposibles", () => {
    const ast = parse([
        "SIN_NEGATIVOS(A)",
        "    n = LONG(A)",
        "    mientras n < 0",
        "        escribir n"
    ]);
    const loop = whileOf(ast);
    const analysis = new IterationAnalysisService()
        .analyze(ast)
        .get(loop);

    assert.equal(
        analysis.kind,
        IterationAnalysisKind.CONSTANT
    );
    assert.equal(
        formatCostExpression(
            analysis.iterations
        ),
        "0"
    );
});

test("la extracción de recurrencias comparte las ramas imposibles", () => {
    const ast = parse([
        "REC(A)",
        "    n = LONG(A)",
        "    si n < 0",
        "        retornar REC(A)",
        "    retornar 0"
    ]);
    const definition =
        new RecurrenceInputAnalysisService()
            .analyze(ast)
            .getFunction("TREC");

    assert.deepEqual(
        definition.calls.filter(call =>
            call.callee === "REC"
        ),
        []
    );
});

test("los valores abstractos se conservan al definir expresiones manuales", () => {
    const resolver = new SymbolicValueResolver();

    resolver.define(
        "cero",
        Cost.constant(0)
    );

    assert.equal(
        resolver.getAbstract("cero").sign,
        AbstractSign.ZERO
    );
});

function whileOf(ast) {
    return findStatement(
        ast.statements[0].body,
        "WhileStatement"
    );
}

function findStatement(block, type) {
    for (const statement of block.statements) {
        if (statement.type === type) {
            return statement;
        }

        if (statement.thenBlock != null) {
            const found = findStatement(
                statement.thenBlock,
                type
            );

            if (found != null) {
                return found;
            }
        }

        for (const branch of statement.elseIfBranches ?? []) {
            const found = findStatement(
                branch.block,
                type
            );

            if (found != null) {
                return found;
            }
        }

        if (statement.elseBlock != null) {
            const found = findStatement(
                statement.elseBlock,
                type
            );

            if (found != null) {
                return found;
            }
        }
    }

    return null;
}

function parse(lines) {
    return parseSource(
        lines.join("\n")
    ).ast;
}
