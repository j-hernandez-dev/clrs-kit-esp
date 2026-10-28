import test from "node:test";
import assert from "node:assert/strict";

import {
    CostAnalysisVisitor
} from "../src/complex/CostAnalysisVisitor.js";
import {
    ComplexityCoverageOutcome,
    summarizeComplexityCoverage,
    summarizeCoverageMatrix
} from "../src/complex/coverage/index.js";
import {
    listUnknownComplexityDefinitions
} from "../src/complex/unknown/index.js";
import {
    parseSource
} from "../src/language/LanguageFrontend.js";
import {
    SemanticAnalyzer
} from "../src/semantic/SemanticAnalyzer.js";
import {
    complexityCoverageMatrix
} from "./fixtures/complexity-coverage-matrix.js";

test("la matriz cubre los resultados de complejidad comunicables", () => {
    const allowedOutcomes = new Set(
        Object.values(
            ComplexityCoverageOutcome
        )
    );
    const identifiers = new Set();

    for (const item of complexityCoverageMatrix) {
        assert.equal(
            identifiers.has(item.id),
            false,
            `Identificador repetido: ${item.id}`
        );
        identifiers.add(item.id);

        assert.equal(
            allowedOutcomes.has(
                item.expectedCurrentOutcome
            ),
            true,
            `${item.id}: resultado actual inválido`
        );
        assert.equal(
            allowedOutcomes.has(
                item.targetOutcome
            ),
            true,
            `${item.id}: resultado objetivo inválido`
        );
        assert.match(
            item.targetBlock,
            /\S/
        );

        const result = analyzeCoverageCase(item);

        assert.equal(
            result.outcome,
            item.expectedCurrentOutcome,
            `${item.id}: resultado actual inesperado`
        );

        if (item.expectedNotation != null) {
            assert.equal(
                result.notation.includes(
                    item.expectedNotation
                ),
                true,
                `${item.id}: falta ${item.expectedNotation}`
            );
        }

        if (result.report != null) {
            for (
                const code
                of item.expectedCurrentCodes
            ) {
                assert.equal(
                    result.summary.unknownCodes
                        .includes(code),
                    true,
                    `${item.id}: falta ${code}`
                );
            }
        }
    }

    assert.equal(
        allowedOutcomes.has(
            ComplexityCoverageOutcome
                .LOWER_BOUND
        ),
        true
    );
});

test("la matriz mide el catálogo caracterizado y los pendientes", () => {
    const observed = complexityCoverageMatrix
        .map(item => ({
            ...item,
            actualCoverage:
                analyzeCoverageCase(item)
                    .summary
        }));
    const summary = summarizeCoverageMatrix(
        observed,
        listUnknownComplexityDefinitions()
    );

    assert.equal(summary.verified, true);
    assert.equal(summary.cases, 26);
    assert.equal(summary.catalog.total, 48);
    assert.equal(summary.catalog.characterized, 17);
    assert.equal(summary.catalog.resolved, 4);
    assert.equal(summary.catalog.unresolved, 13);
    assert.equal(summary.catalog.pending, 30);
    assert.deepEqual(
        summary.catalog.resolvedCodes,
        [
            "CLRS_ASYMPTOTIC_EXPRESSION_UNSUPPORTED",
            "CLRS_ASYMPTOTIC_INTERNAL_SYMBOL_UNRESOLVED",
            "CLRS_ITERATION_UPDATE_PATH_INCOMPLETE",
            "CLRS_RECURRENCE_ARGUMENT_UNSUPPORTED"
        ]
    );
    assert.deepEqual(
        summary.catalog.semanticExcludedCodes,
        ["CLRS_ASYMPTOTIC_CALL_UNRESOLVED"]
    );
    assert.deepEqual(
        summary.catalog.missingCodes,
        []
    );
    assert.deepEqual(
        summary.outcomes,
        {
            conditional: 9,
            exact: 3,
            "non-terminating": 1,
            "semantic-error": 1,
            "unknown": 9,
            "upper-bound": 3
        }
    );
});

test("aÃ­sla la funciÃ³n y el escenario verificados", () => {
    const item = {
        source: [
            "AUXILIAR()",
            "    mientras VERDAD",
            "        escribir 1",
            "OBJETIVO(n)",
            "    para i = 0 hasta n - 1",
            "        escribir i"
        ],
        functionName: "OBJETIVO"
    };
    const result = analyzeCoverageCase(item);
    const auxiliary = result.summary
        .functions.find(entry =>
            entry.name === "AUXILIAR"
        );

    assert.equal(result.outcome, "exact");
    assert.equal(
        auxiliary.scenarios.worst.outcome,
        "non-terminating"
    );
});

test("la matriz exige observaciones ejecutadas y detecta falsos resueltos", () => {
    assert.throws(
        () => summarizeCoverageMatrix(
            [{
                id: "sin-observacion",
                targetOutcome: "exact"
            }],
            []
        ),
        /actualCoverage/
    );

    const summary = summarizeCoverageMatrix(
        [{
            id: "resuelto-invalido",
            expectedCurrentOutcome: "unknown",
            targetOutcome: "exact",
            resolvedCodes: ["CLRS_X"],
            actualCoverage: {
                outcome: "unknown",
                notation: ["O(?)"],
                unknownCodes: ["CLRS_X"]
            }
        }],
        [{ code: "CLRS_X" }]
    );

    assert.equal(summary.verified, false);
    assert.deepEqual(
        summary.verification[0]
            .resolvedCodesStillPresent,
        ["CLRS_X"]
    );
});

test("conserva nombres fuente que comienzan con T", () => {
    const result = analyzeCoverageCase({
        source: [
            "TAREA(n)",
            "    para i = 0 hasta n - 1",
            "        escribir i"
        ],
        functionName: "TAREA"
    });

    assert.equal(
        result.summary.functionName,
        "TAREA"
    );
    assert.equal(result.outcome, "exact");
});

function analyzeCoverageCase(item) {
    const lines = item.source;
    const ast = parseSource(
        lines.join("\n")
    ).ast;

    try {
        new SemanticAnalyzer()
            .analyze(ast);
    } catch (semanticError) {
        return Object.freeze({
            report: null,
            summary:
                summarizeComplexityCoverage({
                    semanticError
                }),
            outcome:
                ComplexityCoverageOutcome
                    .SEMANTIC_ERROR,
            notation: []
        });
    }

    const report = new CostAnalysisVisitor()
        .costAnalysis(ast);
    const summary = summarizeComplexityCoverage({
        report,
        functionName:
            item.functionName ?? null,
        scenario:
            item.scenario ?? "worst"
    });

    return Object.freeze({
        report,
        summary,
        outcome: summary.outcome,
        notation: summary.notation
    });
}
