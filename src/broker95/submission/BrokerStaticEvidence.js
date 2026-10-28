import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    BROKER_CLRS_DOCUMENT_CAPTURE_VERSION
} from "./BrokerClrsDocumentCapture.js";
import {
    collectBrokerStaticAstEvidence
} from "./BrokerStaticEvidenceCollector.js";

export const BROKER_STATIC_EVIDENCE_VERSION = 1;

export const BrokerStaticEvidenceStatus = Object.freeze({
    COMPLETE: "complete",
    SOURCE_INVALID: "source-invalid"
});

/**
 * Construye la evidencia determinista de una captura exacta. Su forma es
 * serializable y apta para el puerto LLM, pero no incluye fuente ni URI.
 */
export function createBrokerStaticEvidence({
    capture,
    analysis
} = {}) {
    validateInputs(capture, analysis);

    const complete = analysis.ok === true &&
        analysis.ast != null;
    let collected;

    if (complete) {
        if (analysis.semanticModel == null) {
            throw BrokerGameError.invalidRule(
                "BROKER95_STATIC_EVIDENCE_SEMANTIC_MODEL_REQUIRED",
                "No fue posible obtener la evidencia estática del programa.",
                []
            );
        }

        collected = collectBrokerStaticAstEvidence(
            analysis.ast,
            analysis.semanticModel
        );
    } else {
        collected = emptyCollectedEvidence();
    }

    return freezeJson({
        evidenceVersion: BROKER_STATIC_EVIDENCE_VERSION,
        status: complete
            ? BrokerStaticEvidenceStatus.COMPLETE
            : BrokerStaticEvidenceStatus.SOURCE_INVALID,
        document: {
            name: capture.document.name,
            languageId: capture.document.languageId,
            version: capture.document.version,
            sourceHash: capture.sourceHash
        },
        diagnostics: {
            status: capture.analysis.status,
            totalCount: capture.analysis.diagnosticCount,
            truncated: capture.analysis.diagnosticsTruncated,
            items: capture.analysis.diagnostics
        },
        sourceMetrics: capture.staticMetrics,
        metrics: collected.metrics,
        scopes: collected.scopes,
        symbols: collected.symbols,
        calls: collected.calls,
        inputs: collected.inputs,
        operations: collected.operations,
        findings: collected.findings,
        interpretation: {
            ...(analysis.semanticModel?.gui?.usage.requiresGui ? {
                gui: { reachability: "potential-not-observed", callbackRegistrationIsExecution: false,
                    visualBehaviorValidated: false, interactiveSessionCostBounded: false,
                    note: "Las llamadas GUI son biblioteca estándar. Registrar callbacks sólo demuestra una posible activación; no acredita ejecución ni corrección visual. La complejidad directa no acota esperas o la sesión interactiva." }
            } : {}),
            scoresProduced: false,
            signalsAreAutomaticPenalties: false,
            unresolvedSafetyMeansFailure: false,
            criteria: [
                "F-CUM",
                "F-COR",
                "F-LIM",
                "R-VAL",
                "R-SEG",
                "R-MAN",
                "D-CLA",
                "D-SIM",
                "D-MOD",
                "D-COH",
                "D-ACO",
                "D-ABS"
            ]
        }
    });
}

function validateInputs(capture, analysis) {
    if (
        capture == null ||
        typeof capture !== "object" ||
        capture.captureVersion !==
            BROKER_CLRS_DOCUMENT_CAPTURE_VERSION ||
        typeof capture.sourceCode !== "string" ||
        capture.document == null ||
        typeof capture.sourceHash !== "string" ||
        analysis == null ||
        typeof analysis !== "object" ||
        typeof analysis.ok !== "boolean" ||
        typeof analysis.sourceCode !== "string"
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_STATIC_EVIDENCE_INPUT_INVALID",
            "No fue posible obtener la evidencia estática del programa.",
            []
        );
    }

    if (
        analysis.sourceCode !== capture.sourceCode ||
        !Object.is(
            analysis.version,
            capture.document.version
        ) ||
        (capture.analysis.status === "valid") !==
            analysis.ok
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_STATIC_EVIDENCE_SNAPSHOT_MISMATCH",
            "El documento cambió antes de completar su análisis estático.",
            []
        );
    }
}

function emptyCollectedEvidence() {
    const emptyCollection = () => ({
        totalCount: 0,
        truncated: false,
        items: []
    });

    return {
        metrics: {
            functionCount: 0,
            globalVariableCount: 0,
            symbolCount: 0,
            unusedSymbolCount: 0,
            unusedVariableCount: 0,
            unusedParameterCount: 0,
            unusedFunctionCount: 0,
            statementCount: 0,
            assignmentCount: 0,
            decisionPointCount: 0,
            logicalConnectorCount: 0,
            loopCount: 0,
            returnCount: 0,
            readStatementCount: 0,
            inputValueCount: 0,
            writeStatementCount: 0,
            callSiteCount: 0,
            userCallEdgeCount: 0,
            cyclomaticComplexityTotal: 0,
            cyclomaticComplexityMaximum: 0,
            nestingDepthMaximum: 0,
            indexedAccessCount: 0,
            divisionCount: 0,
            unreachableStatementCount: 0
        },
        scopes: emptyCollection(),
        symbols: {
            totalCount: 0,
            records: emptyCollection(),
            globalVariableCount: 0,
            globalVariables: emptyCollection(),
            unusedCount: 0,
            unusedVariableCount: 0,
            unusedParameterCount: 0,
            unusedFunctionCount: 0,
            unused: emptyCollection()
        },
        calls: {
            edgeCount: 0,
            userEdgeCount: 0,
            callSiteCount: 0,
            edges: emptyCollection(),
            recursiveComponents: emptyCollection()
        },
        inputs: {
            valueCount: 0,
            bindingCount: 0,
            records: emptyCollection()
        },
        operations: {
            divisions: emptyCollection(),
            indexedAccesses: emptyCollection(),
            loops: emptyCollection()
        },
        findings: emptyCollection()
    };
}

function freezeJson(value) {
    if (Array.isArray(value)) {
        return Object.freeze(value.map(freezeJson));
    }

    if (value != null && typeof value === "object") {
        const result = {};

        for (const [key, item] of Object.entries(value)) {
            result[key] = freezeJson(item);
        }

        return Object.freeze(result);
    }

    return value;
}
