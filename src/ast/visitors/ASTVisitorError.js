import { LanguageError } from "../../errors/LanguageError.js";

export class ASTVisitorError extends LanguageError {

    constructor(message, node = null, options = {}) {
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
            "CLRS_AST_VISITOR_ERROR";
        const diagnostics =
            options.diagnostics ??
            [{
                code,
                message,
                nodeType,
                location
            }];

        super(message, "ASTVisitorError", location, {
            ...options,
            phase: "ast-visitor",
            code,
            audience:
                options.audience ??
                "developer",
            publicMessage:
                options.publicMessage ??
                "Ocurrió un error interno al procesar el programa.",
            technicalMessage:
                options.technicalMessage ??
                message,
            diagnostics
        });

        this.nodeType = nodeType;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            nodeType: this.nodeType
        };
    }

    static invalidNode(node) {
        return new ASTVisitorError(
            "The AST visitor received an invalid node.",
            node,
            {
                code: "CLRS_INVALID_AST_VISITOR_NODE"
            }
        );
    }

    static unsupportedNode(node) {
        return new ASTVisitorError(
            `The AST visitor does not support node ${node.type}.`,
            node,
            {
                code: "CLRS_UNSUPPORTED_AST_NODE"
            }
        );
    }

    static invalidHandler(nodeType) {
        return new ASTVisitorError(
            `The handler registered for ${String(nodeType)} is not a function.`,
            null,
            {
                code: "CLRS_INVALID_AST_VISITOR_HANDLER",
                nodeType
            }
        );
    }

    static invalidNodeList() {
        return new ASTVisitorError(
            "The AST visitor expected an array of nodes.",
            null,
            {
                code: "CLRS_AST_VISITOR_LIST_REQUIRED"
            }
        );
    }
}
