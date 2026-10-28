import assert from "node:assert/strict";
import test from "node:test";

import {
    BrokerClrsDocumentCaptureService,
    BrokerStaticEvidenceService,
    BrokerStaticEvidenceStatus,
    createBrokerStaticEvidence
} from "../src/broker95/index.js";
import {
    DocumentAnalysisService
} from "../src/language/analysis/DocumentAnalysisService.js";
import {
    LanguageDiagnosticsService
} from "../src/language/diagnostics/LanguageDiagnosticsService.js";

const LANGUAGE_ID = "clrs-es";

const EVIDENCE_SOURCE = [
    "globalSinUso = 1",
    "AYUDANTE(fantasma)",
    "    temporal = 1",
    "    retornar temporal",
    "PROCESA(datos[], divisor, extra)",
    '    dato = ""',
    "    resultado = 0",
    "    leer dato",
    "    si ES_NUM(dato) y divisor != 0",
    "        para i = 0 hasta LONG(datos) - 1",
    "            resultado = resultado + datos[i] / divisor",
    "    sino",
    "        retornar 0",
    "    retornar resultado",
    '    escribir "inalcanzable"',
    "PRINCIPAL()",
    "    A[0] = 4",
    "    escribir PROCESA(A, 2, 99)"
].join("\n");

test("extrae métricas, símbolos y flujo sin asignar calificaciones", () => {
    const { evidence, analysisCalls } = collectEvidence(
        EVIDENCE_SOURCE
    );

    assert.equal(evidence.status, BrokerStaticEvidenceStatus.COMPLETE);
    assert.equal(analysisCalls(), 1);
    assert.equal(evidence.metrics.functionCount, 3);
    assert.equal(evidence.metrics.globalVariableCount, 1);
    assert.equal(evidence.metrics.unusedVariableCount, 1);
    assert.equal(evidence.metrics.unusedParameterCount, 1);
    assert.equal(evidence.metrics.unusedFunctionCount, 1);
    assert.equal(evidence.metrics.unreachableStatementCount, 1);
    assert.equal(evidence.metrics.divisionCount, 1);
    assert.equal(evidence.metrics.indexedAccessCount, 2);
    assert.equal(evidence.metrics.cyclomaticComplexityMaximum, 4);
    assert.equal(evidence.metrics.nestingDepthMaximum, 2);
    assert.equal(evidence.interpretation.scoresProduced, false);
    assert.equal(
        evidence.interpretation.signalsAreAutomaticPenalties,
        false
    );
    assert.equal(Object.isFrozen(evidence), true);
    assert.equal(Object.isFrozen(evidence.metrics), true);
});

test("construye grafo de llamadas y detecta funciones no alcanzables", () => {
    const { evidence } = collectEvidence(EVIDENCE_SOURCE);
    const userEdge = evidence.calls.edges.items.find(
        edge => edge.kind === "user"
    );
    const unused = evidence.symbols.unused.items.map(
        symbol => [symbol.kind, symbol.name]
    );

    assert.deepEqual(userEdge, {
        caller: "PRINCIPAL",
        callee: "PROCESA",
        kind: "user",
        count: 1,
        argumentCounts: [3],
        locations: [userEdge.locations[0]]
    });
    assert.deepEqual(unused.sort(), [
        ["function", "AYUDANTE"],
        ["parameter", "extra"],
        ["variable", "globalSinUso"]
    ]);
    assert.equal(
        evidence.symbols.records.items.find(symbol =>
            symbol.name === "fantasma"
        )?.usageStatus,
        "scope-unreachable"
    );
    assert.equal(
        evidence.findings.items.some(finding =>
            finding.code ===
                "BROKER95_STATIC_UNREACHABLE_STATEMENT"
        ),
        true
    );
});

test("presenta validaciones sólo como candidatos y no inventa pruebas", () => {
    const { evidence } = collectEvidence(EVIDENCE_SOURCE);
    const input = evidence.inputs.records.items[0];
    const division = evidence.operations.divisions.items[0];
    const accesses = evidence.operations.indexedAccesses.items;

    assert.equal(input.name, "dato");
    assert.equal(input.candidateGuardCount, 1);
    assert.deepEqual(input.predicateCalls, ["ES_NUM"]);
    assert.equal(input.validationProof, "candidate-only");
    assert.equal(division.nonZeroProof, "not-analyzed");
    assert.equal(
        accesses.every(access =>
            access.boundsProof === "not-analyzed"
        ),
        true
    );
    assert.equal(
        evidence.interpretation.unresolvedSafetyMeansFailure,
        false
    );
});

test("identifica componentes recursivos directos y mutuos", () => {
    const source = [
        "A(n)",
        "    si n > 0",
        "        B(n - 1)",
        "B(n)",
        "    si n > 0",
        "        A(n - 1)",
        "PRINCIPAL()",
        "    A(2)"
    ].join("\n");
    const { evidence } = collectEvidence(source);

    assert.deepEqual(
        evidence.calls.recursiveComponents.items,
        [{
            functions: ["A", "B"],
            mutual: true
        }]
    );
    assert.equal(evidence.metrics.unusedFunctionCount, 0);
});

test("recorre arreglos literales al construir evidencia estática", () => {
    const source = [
        "DUPLICA(valor)",
        "    retornar valor + valor",
        "PRINCIPAL()",
        "    base = 4",
        "    datos = [base, DUPLICA(2), [3, base]]",
        "    escribir datos[1]"
    ].join("\n");
    const { evidence } = collectEvidence(source);
    const call = evidence.calls.edges.items.find(
        edge => edge.callee === "DUPLICA"
    );
    const base = evidence.symbols.records.items.find(
        symbol =>
            symbol.scope === "PRINCIPAL" &&
            symbol.name === "base"
    );

    assert.equal(
        evidence.status,
        BrokerStaticEvidenceStatus.COMPLETE
    );
    assert.equal(call?.count, 1);
    assert.equal(call?.argumentCounts[0], 1);
    assert.equal(base?.referenceCount, 2);
    assert.equal(base?.usageStatus, "used");
    assert.equal(
        evidence.operations.indexedAccesses.items
            .some(access =>
                access.target === "datos" &&
                access.mode === "read"
            ),
        true
    );
});

test("conserva diagnósticos para una fuente inválida sin fabricar hechos", () => {
    const { evidence } = collectEvidence("escribir ,");

    assert.equal(
        evidence.status,
        BrokerStaticEvidenceStatus.SOURCE_INVALID
    );
    assert.equal(evidence.diagnostics.totalCount > 0, true);
    assert.equal(evidence.scopes.totalCount, 0);
    assert.equal(evidence.metrics.statementCount, 0);
    assert.equal(evidence.findings.totalCount, 0);
});

test("la evidencia es serializable y omite fuente e identidad local", () => {
    const { evidence } = collectEvidence(EVIDENCE_SOURCE);
    const serialized = JSON.stringify(evidence);

    assert.equal(Object.hasOwn(evidence.document, "documentId"), false);
    assert.equal(Object.hasOwn(evidence, "sourceCode"), false);
    assert.equal(Object.hasOwn(evidence, "capturedAt"), false);
    assert.equal(serialized.includes("file:///privado"), false);
    assert.equal(serialized.includes("inalcanzable"), false);
    assert.doesNotThrow(() => JSON.parse(serialized));
});

test("rechaza mezclar la captura con otra versión documental", () => {
    const context = createEvidenceContext(EVIDENCE_SOURCE);
    const capture = context.documentCapture.capture();
    const otherVersion = context.analysisService.analyze({
        key: capture.document.documentId,
        version: capture.document.version + 1,
        sourceCode: capture.sourceCode
    });

    assert.throws(
        () => createBrokerStaticEvidence({
            capture,
            analysis: otherVersion
        }),
        error => error.code ===
            "BROKER95_STATIC_EVIDENCE_SNAPSHOT_MISMATCH"
    );
});

function collectEvidence(sourceCode) {
    const context = createEvidenceContext(sourceCode);

    return {
        evidence: context.service.collect(),
        analysisCalls: context.analysisCalls
    };
}

function createEvidenceContext(sourceCode) {
    let calls = 0;
    const diagnostics = new LanguageDiagnosticsService();
    const analysisService = new DocumentAnalysisService({
        languageDiagnosticsService: {
            analyze(source) {
                calls += 1;
                return diagnostics.analyze(source);
            }
        },
        analyzeCost() {
            return null;
        }
    });
    const documentCapture =
        new BrokerClrsDocumentCaptureService({
            documentHost: {
                captureActiveDocument() {
                    return {
                        documentId:
                            "file:///privado/programa.clrs",
                        name: "programa.clrs",
                        languageId: LANGUAGE_ID,
                        version: 7,
                        sourceCode
                    };
                }
            },
            documentAnalysisService: analysisService,
            languageId: LANGUAGE_ID,
            now: () => 1
        });
    const service = new BrokerStaticEvidenceService({
        documentCapture,
        documentAnalysisService: analysisService
    });

    return {
        service,
        documentCapture,
        analysisService,
        analysisCalls: () => calls
    };
}
