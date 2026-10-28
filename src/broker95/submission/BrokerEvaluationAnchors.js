import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    BrokerTestCaseKind
} from "../core/BrokerTestCase.js";
import {
    getBrokerActiveEvaluationCriteria
} from "./BrokerEvaluationRubric.js";

export const BROKER_EVALUATION_ANCHORS_VERSION = 1;

export const BrokerEvaluationAnchorConfidence =
    Object.freeze({
        STRONG: "strong",
        PARTIAL: "partial",
        SIGNALS_ONLY: "signals-only",
        INSUFFICIENT: "insufficient"
    });

export function createBrokerEvaluationAnchors({
    contract,
    testExecution,
    staticEvidence
} = {}) {
    validateInputs(
        contract,
        testExecution,
        staticEvidence
    );

    const byKind = Object.freeze({
        normal: summarizeTests(
            testExecution.testCases.filter(
                item => item.kind ===
                    BrokerTestCaseKind.NORMAL
            )
        ),
        boundary: summarizeTests(
            testExecution.testCases.filter(
                item => item.kind ===
                    BrokerTestCaseKind.BOUNDARY
            )
        ),
        invalid: summarizeTests(
            testExecution.testCases.filter(
                item => item.kind ===
                    BrokerTestCaseKind.INVALID
            )
        )
    });
    const requirements = summarizeRequirements(
        contract,
        testExecution.testCases
    );
    const metrics = staticEvidence.metrics;
    const anchors = {
        "F-CUM": scoredAnchor(
            requirements.observedScore,
            requirements.confidence,
            { requirements }
        ),
        "F-COR": testAnchor(byKind.normal),
        "F-LIM": testAnchor(byKind.boundary),
        "R-VAL": testAnchor(
            byKind.invalid,
            "Las pruebas inválidas son evidencia parcial: CIPHER debe distinguir validación de manejo posterior."
        ),
        "R-SEG": signalAnchor({
            runtimeErrors:
                testExecution.summary.runtimeErrors,
            timedOut:
                testExecution.summary.timedOut,
            outputLimited:
                testExecution.summary.outputLimited,
            divisions: metrics.divisionCount,
            indexedAccesses:
                metrics.indexedAccessCount,
            loops: metrics.loopCount,
            safetyProofPolicy:
                "not-analyzed is not evidence of failure"
        }),
        "R-MAN": testAnchor(
            byKind.invalid,
            "Las pruebas inválidas son evidencia parcial: CIPHER debe comprobar que la respuesta posterior sea controlada."
        ),
        "D-CLA": signalAnchor({
            symbolCount: metrics.symbolCount,
            unusedSymbols:
                metrics.unusedSymbolCount
        }),
        "D-SIM": signalAnchor({
            cyclomaticComplexityMaximum:
                metrics.cyclomaticComplexityMaximum,
            nestingDepthMaximum:
                metrics.nestingDepthMaximum,
            decisionPoints:
                metrics.decisionPointCount,
            logicalConnectors:
                metrics.logicalConnectorCount,
            policy:
                "complexity metrics are signals, not automatic penalties"
        }),
        "D-MOD": signalAnchor({
            functionCount: metrics.functionCount,
            statementCount: metrics.statementCount,
            callSites: metrics.callSiteCount,
            unreachableStatements:
                metrics.unreachableStatementCount,
            policy:
                "more functions are not automatically better"
        }),
        "D-COH": signalAnchor({
            functionCount: metrics.functionCount,
            callSites: metrics.callSiteCount,
            assignments: metrics.assignmentCount
        }),
        "D-ACO": signalAnchor({
            globalVariables:
                metrics.globalVariableCount,
            userCallEdges:
                metrics.userCallEdgeCount,
            unusedParameters:
                metrics.unusedParameterCount,
            policy:
                "call count alone is not coupling"
        }),
        "D-ABS": signalAnchor({
            functionCount: metrics.functionCount,
            globalVariables:
                metrics.globalVariableCount,
            callSites: metrics.callSiteCount
        })
    };
    const activeCriteria =
        getBrokerActiveEvaluationCriteria(
            contract.risk
        );

    return freezeJson({
        anchorsVersion:
            BROKER_EVALUATION_ANCHORS_VERSION,
        status: testExecution.status,
        testGroups: byKind,
        criteria: activeCriteria.map(
            criterion => ({
                criterion,
                ...anchors[criterion]
            })
        ),
        policy: {
            llmChoosesCriterionScores: true,
            observedScoresAreStartingPoints: true,
            absentProofIsNotFailure: true,
            avoidDuplicatePenalties: true
        }
    });
}

function summarizeRequirements(contract, cases) {
    const requirements = contract.metadata
        .requirementIds.map((id, index) => {
            const linked = cases.filter(item =>
                item.requirementIds.includes(id)
            );
            const passed = linked.length > 0 &&
                linked.every(
                    item => item.status === "passed"
                );
            const observed = linked.filter(
                item => item.status !== "not-run"
            ).length;

            return {
                id,
                text: contract.requirements[index],
                linkedCaseCount: linked.length,
                passedCaseCount: linked.filter(
                    item => item.status === "passed"
                ).length,
                observedCaseCount: observed,
                satisfiedByTests: passed
            };
        });
    const linked = requirements.filter(
        item => item.linkedCaseCount > 0
    ).length;
    const satisfied = requirements.filter(
        item => item.satisfiedByTests
    ).length;
    const allLinkedCasesObserved =
        requirements.every(item =>
            item.linkedCaseCount > 0 &&
            item.observedCaseCount ===
                item.linkedCaseCount
        );

    return freezeJson({
        total: requirements.length,
        linked,
        satisfied,
        observedScore: Math.round(
            satisfied / requirements.length * 100
        ),
        confidence: allLinkedCasesObserved
            ? BrokerEvaluationAnchorConfidence.STRONG
            : linked > 0
                ? BrokerEvaluationAnchorConfidence.PARTIAL
                : BrokerEvaluationAnchorConfidence.INSUFFICIENT,
        items: requirements
    });
}

function summarizeTests(cases) {
    const passed = cases.filter(
        item => item.status === "passed"
    ).length;
    const notRun = cases.filter(
        item => item.status === "not-run"
    ).length;

    return freezeJson({
        total: cases.length,
        passed,
        failed: cases.length - passed - notRun,
        notRun,
        observedScore: cases.length === 0
            ? null
            : Math.round(passed / cases.length * 100),
        confidence: cases.length === 0
            ? BrokerEvaluationAnchorConfidence.INSUFFICIENT
            : notRun === 0
                ? BrokerEvaluationAnchorConfidence.STRONG
                : BrokerEvaluationAnchorConfidence.PARTIAL,
        caseIds: cases.map(item => item.id)
    });
}

function testAnchor(summary, note = null) {
    return scoredAnchor(
        summary.observedScore,
        summary.confidence,
        {
            tests: summary,
            ...(note == null ? {} : { note })
        }
    );
}

function scoredAnchor(
    observedScore,
    confidence,
    facts
) {
    return {
        observedScore,
        confidence,
        facts
    };
}

function signalAnchor(facts) {
    return scoredAnchor(
        null,
        BrokerEvaluationAnchorConfidence
            .SIGNALS_ONLY,
        facts
    );
}

function validateInputs(
    contract,
    testExecution,
    staticEvidence
) {
    if (
        contract == null ||
        typeof contract !== "object" ||
        !Array.isArray(contract.requirements) ||
        !Array.isArray(
            contract.metadata?.requirementIds
        ) ||
        testExecution?.contractId !== contract.id ||
        !Array.isArray(testExecution?.testCases) ||
        staticEvidence == null ||
        typeof staticEvidence !== "object" ||
        staticEvidence.metrics == null
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_EVALUATION_ANCHORS_INPUT_INVALID",
            "No fue posible preparar la base objetiva de la evaluación.",
            []
        );
    }
}

function freezeJson(value) {
    if (Array.isArray(value)) {
        return Object.freeze(value.map(freezeJson));
    }

    if (value != null && typeof value === "object") {
        return Object.freeze(
            Object.fromEntries(
                Object.entries(value).map(
                    ([key, item]) => [
                        key,
                        freezeJson(item)
                    ]
                )
            )
        );
    }

    return value;
}
