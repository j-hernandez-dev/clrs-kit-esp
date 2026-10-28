import {
    requireFunction,
    requirePort
} from "../../application/ports/ApplicationPorts.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    BROKER_CLRS_DOCUMENT_CAPTURE_LIMITS,
    createBrokerClrsDocumentCapture
} from "./BrokerClrsDocumentCapture.js";

/**
 * Toma una instant\u00e1nea del editor activo y reutiliza la sesi\u00f3n documental
 * compartida de CLRS Kit. No guarda el documento ni lo enlaza a un contrato.
 */
export class BrokerClrsDocumentCaptureService {

    constructor(options = {}) {
        this.documentHost = requirePort(
            options.documentHost,
            "brokerDocumentHost",
            ["captureActiveDocument"]
        );
        this.documentAnalysisService = requirePort(
            options.documentAnalysisService,
            "documentAnalysisService",
            ["analyze"]
        );
        this.now = requireFunction(
            options.now ?? Date.now,
            "brokerDocumentCaptureClock"
        );
        this.languageId = requireLanguageId(
            options.languageId
        );
    }

    capture() {
        const document = this.documentHost
            .captureActiveDocument();

        if (document == null) {
            throw BrokerGameError.invalidRule(
                "BROKER95_DOCUMENT_ACTIVE_REQUIRED",
                "Abre un documento CLRS activo para continuar.",
                []
            );
        }

        return this.#createCapture(document);
    }

    async captureSelected(
        documentSelector = null
    ) {
        if (documentSelector == null) {
            return this.capture();
        }

        if (
            typeof this.documentHost
                .captureDocument !== "function"
        ) {
            throw BrokerGameError.invalidRule(
                "BROKER95_DOCUMENT_SELECTION_UNAVAILABLE",
                "La selección de documentos por ruta no está disponible.",
                []
            );
        }

        const document = await this.documentHost
            .captureDocument(documentSelector);

        return this.#createCapture(document);
    }

    recapture(documentId) {
        if (
            typeof this.documentHost
                .recaptureDocument !== "function"
        ) {
            return this.capture();
        }

        const document = this.documentHost
            .recaptureDocument(documentId);

        if (document == null) {
            throw BrokerGameError.invalidRule(
                "BROKER95_DOCUMENT_CHANGED",
                "El documento seleccionado se cerró o cambió durante la operación.",
                []
            );
        }

        return this.#createCapture(document);
    }

    #createCapture(document) {
        validateCapturedDocument(
            document,
            this.languageId
        );
        const analysis = this.documentAnalysisService.analyze({
            key: document.documentId,
            version: document.version,
            sourceCode: document.sourceCode
        });

        return createBrokerClrsDocumentCapture({
            document: {
                documentId: document.documentId,
                name: document.name,
                languageId: document.languageId,
                version: document.version
            },
            sourceCode: document.sourceCode,
            analysis: {
                ok: analysis.ok,
                diagnostics: analysis.diagnostics
            },
            ast: analysis.ast,
            capturedAt: this.now()
        });
    }
}

function validateCapturedDocument(document, languageId) {
    if (
        document == null ||
        typeof document !== "object" ||
        typeof document.sourceCode !== "string" ||
        document.sourceCode.length >
            BROKER_CLRS_DOCUMENT_CAPTURE_LIMITS
                .maximumSourceCharacters ||
        document.sourceCode.includes("\u0000")
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_DOCUMENT_SOURCE_INVALID",
            "El documento CLRS activo no puede analizarse.",
            []
        );
    }

    if (document.languageId !== languageId) {
        throw BrokerGameError.invalidRule(
            "BROKER95_DOCUMENT_LANGUAGE_INVALID",
            "El documento activo debe usar el lenguaje CLRS.",
            []
        );
    }
}

function requireLanguageId(value) {
    if (
        typeof value !== "string" ||
        value.trim().length === 0
    ) {
        throw BrokerGameError.invalidRule(
            "BROKER95_DOCUMENT_LANGUAGE_INVALID",
            "El lenguaje CLRS no está disponible para capturar el documento.",
            []
        );
    }

    return value;
}
