import {
    createHash
} from "node:crypto";

import {
    NodeTypes
} from "../../ast/core/NodeTypes.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";

export const BROKER_CLRS_DOCUMENT_CAPTURE_VERSION = 1;

export const BROKER_CLRS_DOCUMENT_CAPTURE_LIMITS =
    Object.freeze({
        maximumSourceCharacters: 262_144,
        maximumDiagnostics: 64,
        maximumDiagnosticCharacters: 4_096,
        maximumFunctions: 128
    });

/**
 * Crea una instant\u00e1nea inmutable de una versi\u00f3n concreta del documento.
 * `documentId` pertenece al Host: la proyecci\u00f3n para CIPHER no lo expone.
 */
export function createBrokerClrsDocumentCapture(source = {}) {
    const document = normalizeDocument(source.document);
    const sourceCode = requireSourceCode(source.sourceCode);
    const analysis = normalizeAnalysis(source.analysis);

    return Object.freeze({
        captureVersion:
            BROKER_CLRS_DOCUMENT_CAPTURE_VERSION,
        capturedAt: requireTimestamp(source.capturedAt),
        document,
        sourceCode,
        sourceHash: hashSource(sourceCode),
        analysis,
        staticMetrics: createStaticMetrics(
            sourceCode,
            source.ast ?? null
        )
    });
}

/**
 * Proyecci\u00f3n serializable para una futura solicitud de review o push. Omite
 * de forma deliberada la identidad local del documento y el instante Host.
 */
export function createBrokerClrsDocumentLlmContext(capture) {
    const normalized = requireCapture(capture);

    return Object.freeze({
        captureVersion: normalized.captureVersion,
        document: Object.freeze({
            name: normalized.document.name,
            languageId: normalized.document.languageId,
            version: normalized.document.version,
            sourceHash: normalized.sourceHash
        }),
        sourceCode: normalized.sourceCode,
        analysis: normalized.analysis,
        staticMetrics: normalized.staticMetrics
    });
}

function normalizeDocument(value) {
    if (!isRecord(value)) {
        invalid("BROKER95_DOCUMENT_CAPTURE_DOCUMENT_INVALID");
    }

    requireExactKeys(
        value,
        ["documentId", "name", "languageId", "version"]
    );

    return Object.freeze({
        documentId: requireText(
            value.documentId,
            "BROKER95_DOCUMENT_CAPTURE_DOCUMENT_INVALID",
            4_096
        ),
        name: requireText(
            value.name,
            "BROKER95_DOCUMENT_CAPTURE_DOCUMENT_INVALID",
            1_024
        ),
        languageId: requireText(
            value.languageId,
            "BROKER95_DOCUMENT_CAPTURE_DOCUMENT_INVALID",
            128
        ),
        version: requireVersion(value.version)
    });
}

function requireSourceCode(value) {
    if (
        typeof value !== "string" ||
        value.length > BROKER_CLRS_DOCUMENT_CAPTURE_LIMITS
            .maximumSourceCharacters ||
        value.includes("\u0000")
    ) {
        invalid("BROKER95_DOCUMENT_SOURCE_INVALID");
    }

    return value;
}

function normalizeAnalysis(value) {
    if (!isRecord(value)) {
        invalid("BROKER95_DOCUMENT_CAPTURE_ANALYSIS_INVALID");
    }

    requireExactKeys(value, ["ok", "diagnostics"]);

    if (typeof value.ok !== "boolean") {
        invalid("BROKER95_DOCUMENT_CAPTURE_ANALYSIS_INVALID");
    }

    if (!Array.isArray(value.diagnostics)) {
        invalid("BROKER95_DOCUMENT_CAPTURE_ANALYSIS_INVALID");
    }

    const diagnostics = value.diagnostics.map(
        normalizeDiagnostic
    );
    const limited = diagnostics.slice(
        0,
        BROKER_CLRS_DOCUMENT_CAPTURE_LIMITS
            .maximumDiagnostics
    );

    return Object.freeze({
        status: value.ok ? "valid" : "invalid",
        diagnosticCount: diagnostics.length,
        diagnosticsTruncated:
            limited.length !== diagnostics.length,
        diagnostics: Object.freeze(limited)
    });
}

function normalizeDiagnostic(value) {
    if (!isRecord(value)) {
        invalid("BROKER95_DOCUMENT_CAPTURE_DIAGNOSTIC_INVALID");
    }

    return Object.freeze({
        code: requireText(
            value.code,
            "BROKER95_DOCUMENT_CAPTURE_DIAGNOSTIC_INVALID",
            256
        ),
        message: requireText(
            value.message,
            "BROKER95_DOCUMENT_CAPTURE_DIAGNOSTIC_INVALID",
            BROKER_CLRS_DOCUMENT_CAPTURE_LIMITS
                .maximumDiagnosticCharacters
        ),
        phase: requireText(
            value.phase,
            "BROKER95_DOCUMENT_CAPTURE_DIAGNOSTIC_INVALID",
            128
        ),
        severity: requireText(
            value.severity,
            "BROKER95_DOCUMENT_CAPTURE_DIAGNOSTIC_INVALID",
            64
        ),
        location: normalizeLocation(value.location)
    });
}

function normalizeLocation(value) {
    if (value == null) {
        return null;
    }

    if (!isRecord(value)) {
        invalid("BROKER95_DOCUMENT_CAPTURE_DIAGNOSTIC_INVALID");
    }

    requireExactKeys(
        value,
        [
            "startLine",
            "startColumn",
            "endLine",
            "endColumn"
        ]
    );

    return Object.freeze({
        startLine: nullablePosition(value.startLine),
        startColumn: nullablePosition(value.startColumn),
        endLine: nullablePosition(value.endLine),
        endColumn: nullablePosition(value.endColumn)
    });
}

function createStaticMetrics(sourceCode, ast) {
    const lines = sourceCode.split(/\r\n|\r|\n/u);
    const functions = getFunctionSummaries(ast);

    return Object.freeze({
        characterCount: sourceCode.length,
        nonWhitespaceCharacterCount:
            sourceCode.replace(/\s/gu, "").length,
        lineCount: lines.length,
        nonEmptyLineCount: lines.filter(
            line => line.trim().length > 0
        ).length,
        topLevelStatementCount:
            Array.isArray(ast?.statements)
                ? ast.statements.length
                : null,
        functionCount: functions.items.length,
        functionsTruncated: functions.truncated,
        functions: Object.freeze(functions.items)
    });
}

function getFunctionSummaries(ast) {
    const functions = Array.isArray(ast?.statements)
        ? ast.statements.filter(
            statement => statement?.type ===
                NodeTypes.FUNCTION_DECLARATION
        )
        : [];
    const items = functions.slice(
        0,
        BROKER_CLRS_DOCUMENT_CAPTURE_LIMITS
            .maximumFunctions
    ).map(functionDeclaration =>
        Object.freeze({
            name: String(
                functionDeclaration.identifier?.name ?? ""
            ),
            parameterCount:
                Array.isArray(functionDeclaration.parameters)
                    ? functionDeclaration.parameters.length
                    : 0,
            startLine:
                nullablePosition(
                    functionDeclaration.location?.startLine
                )
        })
    );

    return Object.freeze({
        items,
        truncated: items.length !== functions.length
    });
}

function requireCapture(value) {
    if (
        value?.captureVersion !==
        BROKER_CLRS_DOCUMENT_CAPTURE_VERSION
    ) {
        invalid("BROKER95_DOCUMENT_CAPTURE_INVALID");
    }

    return value;
}

function requireVersion(value) {
    if (!Number.isSafeInteger(value) || value < 0) {
        invalid("BROKER95_DOCUMENT_CAPTURE_DOCUMENT_INVALID");
    }

    return value;
}

function requireTimestamp(value) {
    if (!Number.isFinite(value) || value < 0) {
        invalid("BROKER95_DOCUMENT_CAPTURE_TIMESTAMP_INVALID");
    }

    return value;
}

function nullablePosition(value) {
    if (value == null) {
        return null;
    }

    if (!Number.isSafeInteger(value) || value < 1) {
        invalid("BROKER95_DOCUMENT_CAPTURE_DIAGNOSTIC_INVALID");
    }

    return value;
}

function hashSource(sourceCode) {
    return createHash("sha256")
        .update(sourceCode, "utf8")
        .digest("hex");
}

function requireText(value, code, maximum) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > maximum ||
        value.includes("\u0000")
    ) {
        invalid(code);
    }

    return value;
}

function requireExactKeys(value, keys) {
    if (
        Object.keys(value).length !== keys.length ||
        keys.some(key => !Object.hasOwn(value, key))
    ) {
        invalid("BROKER95_DOCUMENT_CAPTURE_ANALYSIS_INVALID");
    }
}

function isRecord(value) {
    return value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        (
            Object.getPrototypeOf(value) === Object.prototype ||
            Object.getPrototypeOf(value) === null
        );
}

function invalid(code) {
    throw BrokerGameError.invalidRule(
        code,
        "No fue posible capturar el documento CLRS activo.",
        []
    );
}
