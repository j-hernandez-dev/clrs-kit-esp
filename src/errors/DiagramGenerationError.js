import { LanguageError } from "./LanguageError.js";

export class DiagramGenerationError extends LanguageError {

    constructor(
        message,
        node = null,
        options = {}
    ) {
        const nodeType =
            options.nodeType ??
            node?.type ??
            null;
        const location =
            options.location ??
            node?.location ??
            null;
        const code =
            options.code ??
            "CLRS_DIAGRAM_GENERATION_ERROR";

        super(
            message,
            "DiagramGenerationError",
            location,
            {
                ...options,
                phase: "diagram",
                code,
                audience:
                    options.audience ??
                    "developer",
                publicMessage:
                    options.publicMessage ??
                    "Ocurrió un error interno al generar el diagrama.",
                technicalMessage:
                    options.technicalMessage ??
                    message,
                diagnostics:
                    options.diagnostics ??
                    [{
                        code,
                        message,
                        nodeType,
                        location
                    }]
            }
        );

        this.nodeType = nodeType;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            nodeType: this.nodeType
        };
    }

    static astRequired() {
        return new DiagramGenerationError(
            "No AST was provided for diagram generation.",
            null,
            {
                code:
                    "CLRS_DIAGRAM_AST_REQUIRED"
            }
        );
    }

    static programRequired(node) {
        return new DiagramGenerationError(
            "Diagram generation requires a Program root node.",
            node,
            {
                code:
                    "CLRS_DIAGRAM_PROGRAM_REQUIRED"
            }
        );
    }

    static unsupportedNode(node) {
        return new DiagramGenerationError(
            `No diagram builder is registered for node: ${String(node?.type)}.`,
            node,
            {
                code:
                    "CLRS_UNSUPPORTED_DIAGRAM_NODE"
            }
        );
    }

    static invalidNode(node, cause = null) {
        return new DiagramGenerationError(
            "The diagram visitor received an invalid AST node.",
            node,
            {
                code:
                    "CLRS_INVALID_DIAGRAM_NODE",
                cause
            }
        );
    }

    static invalidStructure(
        message,
        node,
        code =
            "CLRS_INVALID_DIAGRAM_STRUCTURE"
    ) {
        return new DiagramGenerationError(
            message,
            node,
            { code }
        );
    }
}
