import {
    requirePort
} from "../../application/ports/ApplicationPorts.js";
import {
    BrokerGameError
} from "../core/BrokerGameError.js";
import {
    createBrokerStaticEvidence
} from "./BrokerStaticEvidence.js";

/**
 * Coordina una captura del editor y reutiliza exactamente el snapshot
 * documental ya calculado para esa versión y ese contenido.
 */
export class BrokerStaticEvidenceService {

    constructor(options = {}) {
        this.documentCapture = requirePort(
            options.documentCapture,
            "brokerDocumentCapture",
            ["capture"]
        );
        this.documentAnalysisService = requirePort(
            options.documentAnalysisService,
            "documentAnalysisService",
            ["analyze"]
        );
    }

    collect() {
        return this.collectCapture(
            this.documentCapture.capture()
        );
    }

    collectCapture(capture) {
        if (
            capture?.document == null ||
            typeof capture.document.documentId !== "string" ||
            typeof capture.document.version !== "number" ||
            typeof capture.sourceCode !== "string"
        ) {
            throw BrokerGameError.invalidRule(
                "BROKER95_STATIC_EVIDENCE_INPUT_INVALID",
                "No fue posible obtener la evidencia estática del programa.",
                []
            );
        }

        const analysis = this.documentAnalysisService.analyze({
            key: capture.document.documentId,
            version: capture.document.version,
            sourceCode: capture.sourceCode
        });

        return createBrokerStaticEvidence({
            capture,
            analysis
        });
    }
}
