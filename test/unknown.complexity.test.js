import test from "node:test";
import assert from "node:assert/strict";

import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    getUnknownComplexityDefinition,
    listUnknownComplexityDefinitions,
    UnknownComplexityCategory
} from "../src/complex/unknown/index.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";
import {
    unknownComplexityCorpus
} from "./fixtures/unknown-complexity-corpus.js";

test("cataloga todas las causas de O(?) sin incluir errores de API", () => {
    const definitions =
        listUnknownComplexityDefinitions();
    const codes =
        new Set(
            definitions.map(
                definition =>
                    definition.code
            )
        );

    assert.equal(definitions.length, 48);
    assert.equal(codes.size, 48);
    assert.equal(
        codes.has(
            "CLRS_INVALID_COST_EXPRESSION"
        ),
        false
    );
    assert.equal(
        codes.has(
            "CLRS_ITERATION_PROGRAM_REQUIRED"
        ),
        false
    );
    assert.equal(
        codes.has(
            "CLRS_SCENARIO_CALL_PROPAGATION_PENDING"
        ),
        false
    );
    assert.deepEqual(
        getUnknownComplexityDefinition(
            "CLRS_ITERATION_BOUND_MUTATED"
        ),
        {
            code:
                "CLRS_ITERATION_BOUND_MUTATED",
            phase: "iteration",
            category:
                UnknownComplexityCategory
                    .MUTATION_INVALIDATES_PROOF,
            recoverability:
                "extend-analyzer"
        }
    );
});

test("el corpus caracteriza los O(?) actuales y su bloque futuro", () => {
    for (const item of unknownComplexityCorpus) {
        const report = analyze(item.source);
        const codes =
            new Set(
                report
                    .unknownComplexityAnalysis
                    .all()
                    .map(reason =>
                        reason.code
                    )
            );

        for (
            const expected
            of item.expectedCurrentCodes
        ) {
            assert.equal(
                codes.has(expected),
                true,
                `${item.name}: falta ${expected}`
            );
        }

        assert.match(
            item.targetBlock,
            /\S/
        );
        assert.match(
            item.expectedFuture,
            /\S/
        );
    }
});

test("conserva la causa de iteración y la enlaza al O(?) derivado", () => {
    const report = analyze([
        "F(n)",
        "    i = 0",
        "    mientras i < n",
        "        i = i + 1",
        "        n = n + 1"
    ]);
    const functionNode =
        report.statementsCost[0];
    const loop =
        functionNode.instructions[1];
    const reasons =
        report
            .unknownComplexityAnalysis
            .get(loop);
    const primary = reasons.find(
        reason =>
            reason.code ===
                "CLRS_ITERATION_BOUND_MUTATED"
    );
    const derived = reasons.find(
        reason =>
            reason.code ===
                "CLRS_ASYMPTOTIC_UNKNOWN_COST" &&
            reason.scenario === "worst"
    );

    assert.equal(primary.scenario, "both");
    assert.deepEqual(
        derived.causes,
        ["CLRS_ITERATION_BOUND_MUTATED"]
    );
    assert.equal(
        Object.isFrozen(primary),
        true
    );
    assert.equal(
        report
            .unknownComplexityAnalysis
            .byCategory(
                UnknownComplexityCategory
                    .MUTATION_INVALIDATES_PROOF
            ).length,
        2
    );
});

test("el catálogo permanece fuera del contrato JSON histórico", () => {
    const report = analyze([
        "F(n)",
        "    mientras VERDAD",
        "        escribir n"
    ]);

    assert.equal(
        Object.keys(report).includes(
            "unknownComplexityAnalysis"
        ),
        false
    );
    assert.equal(
        JSON.stringify(report).includes(
            "unknownComplexityAnalysis"
        ),
        false
    );
});

function analyze(lines) {
    return new CostAnalysisVisitor()
        .costAnalysis(
            parseSource(
                lines.join("\n")
            ).ast
        );
}
